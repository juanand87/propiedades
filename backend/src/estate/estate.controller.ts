import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EstateService } from './estate.service';
import { EstateGuard } from './estate.guard';

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  catch(error: any, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const status = error instanceof HttpException ? error.getStatus() : 503;
    const result =
      error instanceof HttpException
        ? error.getResponse()
        : {
            message:
              'No se pudo completar la operación. Revisa que el esquema inmobiliario esté actualizado.',
          };
    if (status >= 500)
      console.error(
        'Estate operation failed:',
        /^[A-Z0-9_]+$/.test(error?.code || '') ? error.code : 'INTERNAL_ERROR',
      );
    response
      .status(status)
      .json(typeof result === 'string' ? { message: result } : result);
  }
}

@Controller()
export class EstateController {
  constructor(private estate: EstateService) {}
  @Get() health() {
    return this.estate.health();
  }
  @Get('ready') ready() {
    return this.estate.ready();
  }
  @Get('catalog') catalog() {
    return this.estate.catalog();
  }
  @Get('settings') settings() {
    return this.estate.settings();
  }
  @Get('properties') properties(@Query() q: any) {
    return this.estate.list(q);
  }
  @Get('properties/:id') property(@Param('id') id: string) {
    return this.estate.get(id);
  }
  @Post('properties/:id/view') view(@Param('id') id: string, @Req() req: any) {
    this.estate.throttle('view:' + req.ip, 100, 600000);
    return this.estate.view(id);
  }
  @Post('properties/:id/inquiries') inquiry(
    @Param('id') id: string,
    @Body() b: any,
    @Req() req: any,
  ) {
    return this.estate.inquiry(id, b, req.ip);
  }
  @Get('advertisers') advertisers() {
    return this.estate.advertisers();
  }
  @Get('advertisers/:slug') advertiser(@Param('slug') slug: string) {
    return this.estate.publicAdvertiser(slug);
  }
  @Get('media/:id') async media(
    @Param('id') id: string,
    @Query('signature') signature: string,
    @Res() res: any,
  ) {
    const m = await this.estate.media(id, signature);
    res.set({
      'Content-Type': m.mime,
      'Content-Length': m.size_bytes,
      'Cache-Control': m.public ? 'public,max-age=3600' : 'private,no-store',
    });
    res.send(m.content);
  }
  @Post('auth/login') login(@Body() b: any, @Req() req: any) {
    return this.estate.login(b, req.ip);
  }
  @Post('auth/panel/login') panelLogin(@Body() b: any, @Req() req: any) {
    return this.estate.login(b, req.ip, true);
  }
  @Post('auth/register') register(@Body() b: any, @Req() req: any) {
    return this.estate.register(b, req.ip);
  }
  @Get('auth/profile') @UseGuards(EstateGuard) profile(@Req() req: any) {
    return req.user;
  }
  @Post('auth/change-password') @UseGuards(EstateGuard) password(
    @Req() req: any,
    @Body() b: any,
  ) {
    return this.estate.changePassword(req.user, b);
  }
  @Get('me/advertiser') @UseGuards(EstateGuard) me(@Req() req: any) {
    return this.estate.advertiser(req.user);
  }
  @Post('me/advertiser') @UseGuards(EstateGuard) saveMe(
    @Req() req: any,
    @Body() b: any,
  ) {
    return this.estate.saveAdvertiser(req.user, b);
  }
  @Get('manage/properties') @UseGuards(EstateGuard) manage(
    @Req() req: any,
    @Query() q: any,
  ) {
    return this.estate.list(q, req.user);
  }
  @Post('manage/properties') @UseGuards(EstateGuard) create(
    @Req() req: any,
    @Body() b: any,
  ) {
    return this.estate.saveProperty(req.user, b);
  }
  @Get('manage/properties/:id') @UseGuards(EstateGuard) edit(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.estate.get(id, req.user);
  }
  @Patch('manage/properties/:id') @UseGuards(EstateGuard) save(
    @Req() req: any,
    @Param('id') id: string,
    @Body() b: any,
  ) {
    return this.estate.saveProperty(req.user, b, id);
  }
  @Patch('manage/properties/:id/status') @UseGuards(EstateGuard) status(
    @Req() req: any,
    @Param('id') id: string,
    @Body() b: any,
  ) {
    return this.estate.setStatus(req.user, id, b);
  }
  @Patch('manage/properties/:id/availability')
  @UseGuards(EstateGuard)
  availability(@Req() req: any, @Param('id') id: string, @Body() b: any) {
    return this.estate.availability(req.user, id, b);
  }
  @Patch('manage/properties/:id/featured') @UseGuards(EstateGuard) featured(
    @Req() req: any,
    @Param('id') id: string,
    @Body() b: any,
  ) {
    return this.estate.feature(req.user, id, b);
  }
  @Get('manage/properties/:id/history') @UseGuards(EstateGuard) history(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.estate.historyFor(req.user, id);
  }
  @Get('manage/stats') @UseGuards(EstateGuard) stats(@Req() req: any) {
    return this.estate.stats(req.user);
  }
  @Get('manage/inquiries') @UseGuards(EstateGuard) inquiries(@Req() req: any) {
    return this.estate.inquiries(req.user);
  }
  @Patch('manage/inquiries/:id') @UseGuards(EstateGuard) updateInquiry(
    @Req() req: any,
    @Param('id') id: string,
    @Body() b: any,
  ) {
    return this.estate.updateInquiry(req.user, id, b);
  }
  @Get('manage/inquiries/:id/messages') @UseGuards(EstateGuard) messages(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.estate.inquiryMessages(req.user, id);
  }
  @Get('me/favorites') @UseGuards(EstateGuard) favorites(@Req() req: any) {
    return this.estate.favorites(req.user);
  }
  @Post('me/favorites/:id') @UseGuards(EstateGuard) favorite(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.estate.favorite(req.user, id);
  }
  @Delete('me/favorites/:id') @UseGuards(EstateGuard) unfavorite(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.estate.favorite(req.user, id, true);
  }
  @Get('manage/media') @UseGuards(EstateGuard) library(@Req() req: any) {
    return this.estate.library(req.user);
  }
  @Post('manage/media')
  @UseGuards(EstateGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 8 * 1024 * 1024, files: 1 },
    }),
  )
  upload(@Req() req: any, @UploadedFile() file: any) {
    return this.estate.upload(req.user, file);
  }
  @Delete('manage/media/:id') @UseGuards(EstateGuard) remove(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.estate.removeMedia(req.user, id);
  }
  @Get('admin/advertisers') @UseGuards(EstateGuard) adminAdvertisers(
    @Req() req: any,
  ) {
    return this.estate.advertisers(req.user);
  }
  @Patch('admin/advertisers/:id') @UseGuards(EstateGuard) moderateAdvertiser(
    @Req() req: any,
    @Param('id') id: string,
    @Body() b: any,
  ) {
    return this.estate.moderateAdvertiser(req.user, id, b);
  }
  @Get('admin/users') @UseGuards(EstateGuard) users(@Req() req: any) {
    return this.estate.users(req.user);
  }
  @Patch('admin/users/:id') @UseGuards(EstateGuard) updateUser(
    @Req() req: any,
    @Param('id') id: string,
    @Body() b: any,
  ) {
    return this.estate.updateUser(req.user, id, b);
  }
  @Patch('admin/settings') @UseGuards(EstateGuard) saveSettings(
    @Req() req: any,
    @Body() b: any,
  ) {
    return this.estate.saveSettings(req.user, b);
  }
  @Patch('admin/design') @UseGuards(EstateGuard) saveDesign(
    @Req() req: any,
    @Body() b: any,
  ) {
    return this.estate.saveDesign(req.user, b);
  }
  @Post('admin/catalog') @UseGuards(EstateGuard) saveCatalog(
    @Req() req: any,
    @Body() b: any,
  ) {
    return this.estate.saveCatalog(req.user, b);
  }
}
