import { Controller, Post, Body, Get, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { RegisterFromCheckoutDto } from './dto/register-from-checkout.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('register-from-checkout')
  async registerFromCheckout(@Body() registerDto: RegisterFromCheckoutDto) {
    return this.authService.registerFromCheckout(registerDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
  @Post('store-sso')
  @UseGuards(JwtAuthGuard)
  async createStoreSsoUrl(
    @Request() req,
    @Body() body: { vendorId?: string },
  ) {
    return this.authService.createStoreSsoUrl(req.user.sub, body?.vendorId);
  }

  @Post('store-sso/consume')
  async consumeStoreSsoToken(@Body() body: { token: string; vendorSlug: string }) {
    return this.authService.consumeStoreSsoToken(body.token, body.vendorSlug);
  }


  @Post('panel/login')
  async panelLogin(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);
    
    // Validar que sea admin
    if (result.user.role !== 'admin') {
      throw new UnauthorizedException('Solo administradores pueden acceder al panel');
    }
    
    return result;
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user.sub);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Request() req,
    @Body() body: { currentPassword?: string; newPassword: string },
  ) {
    return this.authService.changePassword(
      req.user.sub,
      body.currentPassword,
      body.newPassword,
    );
  }
}
