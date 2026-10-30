import { Body, Controller, Get, Header, Headers, Param, Patch, Post, Request, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PosService } from './pos.service';

@Controller('pos')
export class PosController {
  constructor(private readonly pos: PosService) {}

  private vendorId(req: any) {
    const id = req.user?.vendorId;
    if (!id) throw new UnauthorizedException('Tu cuenta no está asociada a una tienda');
    return id;
  }

  @Get('registers') @UseGuards(JwtAuthGuard) registers(@Request() req: any) { return this.pos.listRegisters(this.vendorId(req)); }
  @Post('registers') @UseGuards(JwtAuthGuard) createRegister(@Request() req: any, @Body() body: any) { return this.pos.createRegister(this.vendorId(req), body); }
  @Patch('registers/:id') @UseGuards(JwtAuthGuard) updateRegister(@Request() req: any, @Param('id') id: string, @Body() body: any) { return this.pos.updateRegister(this.vendorId(req), id, body); }

  @Get('staff') @UseGuards(JwtAuthGuard) staff(@Request() req: any) { return this.pos.listStaff(this.vendorId(req)); }
  @Post('staff') @UseGuards(JwtAuthGuard) createStaff(@Request() req: any, @Body() body: any) { return this.pos.createStaff(this.vendorId(req), body); }
  @Patch('staff/:id') @UseGuards(JwtAuthGuard) updateStaff(@Request() req: any, @Param('id') id: string, @Body() body: any) { return this.pos.updateStaff(this.vendorId(req), id, body); }

  @Post('login') @UseGuards(JwtAuthGuard) login(@Request() req: any, @Body() body: any) { return this.pos.login(this.vendorId(req), body.username, body.pin); }
  @Post('public/login') loginPublic(@Body() body: any) { return this.pos.loginPublic(body.store, body.username, body.pin); }

  @Get('public/registers') async publicRegisters(@Headers('x-pos-token') token?: string) {
    const session = await this.pos.sessionFromToken(token);
    return this.pos.listRegisters(session.vendorId);
  }

  @Get('shifts/current')
  @Header('Cache-Control', 'private, no-store, no-cache, must-revalidate')
  async current(@Headers('x-pos-token') token?: string) {
    return this.pos.currentShift(await this.pos.sessionFromToken(token));
  }
  @Post('shifts/current-state') async currentState(@Headers('x-pos-token') token?: string) {
    return this.pos.currentShift(await this.pos.sessionFromToken(token));
  }
  @Post('shifts/open') async open(@Headers('x-pos-token') token: string, @Body() body: any) {
    return this.pos.openShift(await this.pos.sessionFromToken(token), body.registerId, body.openingCash);
  }
  @Post('shifts/:id/movements') async movement(@Headers('x-pos-token') token: string, @Param('id') id: string, @Body() body: any) {
    return this.pos.addMovement(await this.pos.sessionFromToken(token), id, body);
  }
  @Post('shifts/close-current') async closeCurrent(@Headers('x-pos-token') token: string, @Body() body: any) {
    return this.pos.closeCurrentShift(await this.pos.sessionFromToken(token), body.countedCash, body.note);
  }
  @Post('shifts/:id/close') async close(@Headers('x-pos-token') token: string, @Param('id') id: string, @Body() body: any) {
    return this.pos.closeShift(await this.pos.sessionFromToken(token), id, body.countedCash, body.note);
  }
  @Get('shifts/history') @UseGuards(JwtAuthGuard) history(@Request() req: any) { return this.pos.listHistory(this.vendorId(req)); }
}
