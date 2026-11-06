import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ServiceUnavailableException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { EstateService } from './estate.service';
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
const secret = () => randomBytes(32).toString('base64url');
const callback =
  'https://clownfish-app-2-bgbzm.ondigitalocean.app/api/auth/google/callback';
@Injectable()
export class GoogleAuthService {
  constructor(
    private config: ConfigService,
    private estate: EstateService,
    private jwt: JwtService,
  ) {}
  get enabled() {
    return (
      this.estate.onboardingEnabled &&
      this.config.get('GOOGLE_AUTH_ENABLED') === 'true' &&
      !!this.config.get('GOOGLE_CLIENT_ID') &&
      !!this.config.get('GOOGLE_CLIENT_SECRET')
    );
  }
  client() {
    if (!this.enabled)
      throw new ServiceUnavailableException(
        'El acceso con Google estará disponible pronto. Puedes registrarte con tu correo.',
      );
    return new OAuth2Client(
      this.config.get('GOOGLE_CLIENT_ID'),
      this.config.get('GOOGLE_CLIENT_SECRET'),
      callback,
    );
  }
  async start(ip: string) {
    this.client();
    this.estate.throttle(`google-start:${ip}`, 10, 3600000);
    const id = randomUUID(),
      poll = secret(),
      launch = secret();
    await this.estate.db.query(
      'DELETE FROM estate_google_requests WHERE expires_at < UTC_TIMESTAMP()',
    );
    await this.estate.db.query(
      'INSERT INTO estate_google_requests(id,poll_hash,launch_hash,nonce,verifier,expires_at) VALUES (?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 5 MINUTE))',
      [id, hash(poll), hash(launch), secret(), secret()],
    );
    return {
      id,
      poll,
      url: callback.replace('/callback', '/launch') + `?id=${id}&key=${launch}`,
    };
  }
  async launch(id: string, key: string) {
    const client = this.client();
    return this.estate.db.transaction(async (tx) => {
      const [r] = await tx.query(
        "SELECT * FROM estate_google_requests WHERE id=? AND launch_hash=? AND status='new' AND expires_at>UTC_TIMESTAMP() FOR UPDATE",
        [id, hash(String(key || ''))],
      );
      if (!r)
        throw new BadRequestException(
          'El acceso expiró. Vuelve a la app e inténtalo nuevamente.',
        );
      await tx.query(
        "UPDATE estate_google_requests SET status='started' WHERE id=?",
        [id],
      );
      return {
        state: id,
        url: client.generateAuthUrl({
          scope: ['openid', 'email', 'profile'],
          state: id,
          nonce: r.nonce,
          prompt: 'select_account',
          code_challenge: createHash('sha256')
            .update(r.verifier)
            .digest('base64url'),
          code_challenge_method: 'S256' as any,
        }),
      };
    });
  }
  async finish(state: string, code: string, cookie: string) {
    this.client();
    if (!state || cookie !== state)
      throw new UnauthorizedException(
        'La sesión de Google no coincide. Inicia nuevamente desde Propiedades.',
      );
    const r = await this.estate.db.transaction(async (tx) => {
      const [row] = await tx.query(
        "SELECT * FROM estate_google_requests WHERE id=? AND status='started' AND expires_at>UTC_TIMESTAMP() FOR UPDATE",
        [state],
      );
      if (!row)
        throw new UnauthorizedException('El acceso expiró o ya fue utilizado.');
      await tx.query(
        "UPDATE estate_google_requests SET status='processing' WHERE id=?",
        [state],
      );
      return row;
    });
    try {
      if (!code) throw new UnauthorizedException('Acceso cancelado.');
      const client = this.client();
      const { tokens } = await client.getToken({
        code,
        codeVerifier: r.verifier,
      });
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token || '',
        audience: this.config.get('GOOGLE_CLIENT_ID'),
      });
      const p = ticket.getPayload();
      if (
        !p?.sub ||
        !p.email ||
        p.email_verified !== true ||
        p.nonce !== r.nonce
      )
        throw new UnauthorizedException('Google no confirmó la identidad.');
      const userId = await this.estate.db.transaction(async (tx) => {
        const [identity] = await tx.query(
          'SELECT user_id FROM estate_google_identities WHERE google_sub=?',
          [p.sub],
        );
        if (identity) {
          const [user] = await tx.query(
            'SELECT id FROM users WHERE id=? AND isActive=1',
            [identity.user_id],
          );
          if (!user) throw new UnauthorizedException();
          return user.id;
        }
        const address = p.email!.toLowerCase();
        const [existing] = await tx.query(
          'SELECT id FROM users WHERE email=?',
          [address],
        );
        // Never attach a Google identity to an existing password account by email alone.
        if (existing)
          throw new ConflictException(
            'Este correo ya tiene cuenta. Ingresa con tu contraseña.',
          );
        const id = randomUUID();
        await tx.query(
          "INSERT INTO users(id,email,password,firstName,lastName,role,isActive,requirePasswordChange,createdBy,createdAt,updatedAt) VALUES (?,?,?,?,?,'customer',1,0,'self-registration',UTC_TIMESTAMP(),UTC_TIMESTAMP())",
          [
            id,
            address,
            await bcrypt.hash(secret(), 12),
            (p.given_name || p.name || 'Usuario').slice(0, 100),
            (p.family_name || '').slice(0, 100),
          ],
        );
        await tx.query(
          'INSERT INTO estate_google_identities(google_sub,user_id) VALUES (?,?)',
          [p.sub, id],
        );
        return id;
      });
      await this.estate.db.query(
        "UPDATE estate_google_requests SET status='complete',user_id=?,verifier='',nonce='' WHERE id=?",
        [userId, state],
      );
    } catch (e) {
      await this.estate.db.query(
        "UPDATE estate_google_requests SET status='failed',verifier='',nonce='' WHERE id=?",
        [state],
      );
      throw e;
    }
  }
  async result(id: string, poll: string, ip: string) {
    this.client();
    this.estate.throttle(`google-poll:${ip}`, 240, 600000);
    return this.estate.db.transaction(async (tx) => {
      const [r] = await tx.query(
        'SELECT * FROM estate_google_requests WHERE id=? AND poll_hash=? AND expires_at>UTC_TIMESTAMP() FOR UPDATE',
        [id, hash(String(poll || ''))],
      );
      if (!r || r.status === 'consumed')
        throw new UnauthorizedException('El acceso expiró.');
      if (r.status === 'failed')
        throw new UnauthorizedException(
          'No se completó Google. Si ya tienes cuenta, ingresa con tu contraseña.',
        );
      if (r.status !== 'complete') return { pending: true };
      const user = await this.estate.actor(r.user_id);
      await tx.query(
        "UPDATE estate_google_requests SET status='consumed',poll_hash='' WHERE id=?",
        [id],
      );
      return {
        access_token: this.jwt.sign({ sub: user.id, aud: 'estate-session' }),
        user,
      };
    });
  }
}
@Controller('auth')
export class GoogleAuthController {
  constructor(
    private google: GoogleAuthService,
    private estate: EstateService,
  ) {}
  @Get('options') options() {
    return {
      google: this.google.enabled,
      onboarding: this.estate.onboardingEnabled,
    };
  }
  @Post('google/start') start(@Req() req: any) {
    return this.google.start(req.ip);
  }
  @Post('google/result') result(
    @Body() b: any,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    res.set('Cache-Control', 'no-store');
    return this.google.result(b.id, b.poll, req.ip);
  }
  @Get('google/launch') async launch(@Query() q: any, @Res() res: any) {
    const r = await this.google.launch(q.id, q.key);
    res.cookie('propiedades_google_state', r.state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 300000,
      path: '/api/auth/google',
    });
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    res.redirect(r.url);
  }
  @Get('google/callback') async callback(
    @Query() q: any,
    @Req() req: any,
    @Res() res: any,
  ) {
    const cookie =
      String(req.headers.cookie || '')
        .split(';')
        .map((v) => v.trim())
        .find((v) => v.startsWith('propiedades_google_state='))
        ?.split('=')[1] || '';
    let ok = false;
    try {
      await this.google.finish(q.state, q.code, cookie);
      ok = true;
    } catch {
      /* No provider tokens or errors in HTML/logs. */
    }
    res.clearCookie('propiedades_google_state', { path: '/api/auth/google' });
    res.set({
      'Cache-Control': 'no-store',
      'Content-Security-Policy':
        "default-src 'none'; style-src 'unsafe-inline'",
      'Referrer-Policy': 'no-referrer',
    });
    res
      .status(ok ? 200 : 400)
      .type('html')
      .send(
        `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Propiedades</title><body style="font:20px system-ui;padding:40px;background:#f3f8f5;color:#163e35"><h1>${ok ? 'Cuenta confirmada' : 'No se pudo completar el acceso'}</h1><p>${ok ? 'Vuelve a la app o a la pestaña de Propiedades para continuar.' : 'Vuelve a Propiedades e inténtalo nuevamente. Si ya tienes cuenta con ese correo, utiliza tu contraseña.'}</p></body></html>`,
      );
  }
}
