import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EstateService } from './estate.service';

@Injectable()
export class EstateGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private estate: EstateService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const token = String(req.headers.authorization || '').match(
      /^Bearer (.+)$/,
    )?.[1];
    if (!token)
      throw new UnauthorizedException('Inicia sesión para continuar.');
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(token, {
        audience: 'estate-session',
      });
    } catch {
      throw new UnauthorizedException('La sesión venció.');
    }
    req.user = await this.estate.actor(payload.sub);
    return true;
  }
}
