import {
  Controller,
  BadRequestException,
  ForbiddenException,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
  ValidationPipe,
  Query,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  Delete,
  Redirect,
  Res,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { VendorsService } from './vendors.service';
import { DiscogsService } from './discogs.service';
import { EmailService } from '../email/email.service';
import { CreateVendorDto, UpdateVendorDto } from './dto/vendor.dto';
import { UpdateVendorSettingsDto } from './dto/vendor-settings.dto';
import { DiscogsSearchDto } from './dto/discogs-search.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { ApplicationStatus } from './vendor-application.entity';
import { StorageService } from '../storage/storage.service';

@Controller('vendors')
export class VendorsController {
  constructor(
    private readonly vendorsService: VendorsService,
    private readonly discogsService: DiscogsService,
    private readonly emailService: EmailService,
    private readonly storageService: StorageService,
  ) {}

  @Get()
  findAll() {
    return this.vendorsService.findAll();
  }

  // Public endpoint — no auth required
  @Post('aplicar')
  async submitApplication(@Body() body: Record<string, any>) {
    const application = await this.vendorsService.createApplication(body);
    return { success: true, id: application.id, message: 'Solicitud recibida. Te contactaremos en 1–3 días hábiles.' };
  }

  @Post('aplicar/logo')
  @UseInterceptors(FileInterceptor('logo', {
    fileFilter: (_req, file, callback) => {
      if (!/^image\/(png|jpeg|webp)$/.test(file.mimetype)) {
        return callback(new Error('El logo debe ser PNG, JPG o WebP'), false);
      }
      callback(null, true);
    },
    limits: { fileSize: 3 * 1024 * 1024 },
  }))
  async uploadApplicationLogo(@UploadedFile() logo: Express.Multer.File) {
    if (!logo) {
      throw new BadRequestException('Debes seleccionar un logo válido');
    }
    const uploaded = await this.storageService.uploadFile(logo, 'vendor-applications');
    return { url: uploaded.url };
  }

  // Admin: list all applications
  @Get('aplicaciones')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  listApplications(@Query('status') status?: ApplicationStatus) {
    return this.vendorsService.findAllApplications(status);
  }

  @Post('aplicaciones/:id/aprobar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  approveApplication(
    @Param('id') id: string,
    @Body() body: { adminNotes?: string },
    @Request() req,
  ) {
    return this.vendorsService.approveApplication(id, req.user.email, body?.adminNotes);
  }

  @Post('aplicaciones/:id/rechazar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  rejectApplication(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Request() req,
  ) {
    return this.vendorsService.rejectApplication(id, req.user.email, body?.reason);
  }

  @Get('domain/:domain')
  findByCustomDomain(@Param('domain') domain: string) {
    return this.vendorsService.findByCustomDomain(domain);
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.vendorsService.findBySlug(slug);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vendorsService.findOne(id);
  }

  @Get(':id/stats')
  @UseGuards(JwtAuthGuard)
  getStats(
    @Param('id') id: string,
    @Query('days') days?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Request() req?: any,
  ) {
    if (req?.user?.role !== UserRole.ADMIN && req?.user?.vendorId && req.user.vendorId !== id) {
      throw new ForbiddenException('You can only view your own vendor statistics');
    }
    return this.vendorsService.getVendorStats(id, days ? Number(days) : 30, startDate, endDate);
  }

  @Get('my/profile')
  @UseGuards(JwtAuthGuard)
  async getMyVendor(@Request() req) {
    const vendor = await this.vendorsService.findByUserId(req.user.userId);
    if (!vendor) {
      return { message: 'No vendor profile found', hasVendor: false };
    }
    return { ...vendor, hasVendor: true };
  }

  @Get('my/settings')
  @UseGuards(JwtAuthGuard)
  async getMySettings(@Request() req) {
    const vendor = await this.vendorsService.findByUserId(req.user.userId);
    if (!vendor) {
      throw new Error('Vendor not found');
    }
    return this.vendorsService.getSettings(vendor.id);
  }

  @Patch('my/settings')
  @UseGuards(JwtAuthGuard)
  async updateMySettings(
    @Request() req,
    @Body(ValidationPipe) updateSettingsDto: UpdateVendorSettingsDto,
  ) {
    const vendor = await this.vendorsService.findByUserId(req.user.userId);
    if (!vendor) {
      throw new Error('Vendor not found');
    }
    return this.vendorsService.updateSettingsPublic(vendor.id, updateSettingsDto);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body(ValidationPipe) createVendorDto: CreateVendorDto,
    @Request() req,
  ) {
    return this.vendorsService.create(createVendorDto, req.user.userId);
  }

  @Post('admin/create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  createByAdmin(
    @Body(ValidationPipe) createVendorDto: any,
  ) {
    return this.vendorsService.createByAdmin(createVendorDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateVendorDto: UpdateVendorDto,
    @Request() req,
  ) {
    return this.vendorsService.update(
      id,
      updateVendorDto,
      req.user.userId,
      req.user.role,
    );
  }

  @Get(':id/billing-profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  getBillingProfile(@Param('id') id: string, @Request() req) {
    return this.vendorsService.getBillingProfile(id, req.user.userId, req.user.role);
  }

  @Patch(':id/billing-profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  updateBillingProfile(
    @Param('id') id: string,
    @Body(ValidationPipe) data: UpdateVendorDto,
    @Request() req,
  ) {
    return this.vendorsService.updateBillingProfile(id, data, req.user.userId, req.user.role);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async remove(@Param('id') id: string) {
    try {
      return await this.vendorsService.remove(id);
    } catch (error) {
      console.error('❌ Controller error:', error);
      throw error;
    }
  }

  @Get(':id/deletion-check')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async checkDeletion(@Param('id') id: string) {
    return await this.vendorsService.checkDeletionDependencies(id);
  }

  @Get(':id/settings')
  async getSettings(@Param('id') id: string) {
    try {
      console.log('🔵 GET /vendors/:id/settings - vendorId:', id);
      const settings = await this.vendorsService.getSettings(id);
      console.log('✅ Settings retrieved successfully');
      return settings;
    } catch (error) {
      console.error('❌ Error getting vendor settings:', error.message, error.stack);
      throw error;
    }
  }

  @Patch(':id/settings')
  async updateSettings(
    @Param('id') id: string,
    @Body() rawBody: any,
  ) {
    try {
      console.log('Update settings request - Vendor ID:', id);
      console.log('🔍 RAW BODY RECEIVED:', JSON.stringify(rawBody, null, 2));
      console.log('🔍 Has customMenus in raw body?', 'customMenus' in rawBody);

      return await this.vendorsService.updateSettingsPublic(
        id,
        rawBody,
      );
    } catch (error) {
      console.error('Error updating vendor settings:', error);
      throw error;
    }
  }

  @Get(':id/discogs/search')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async searchDiscogs(
    @Param('id') id: string,
    @Query() searchDto: DiscogsSearchDto,
  ) {
    const settings = await this.vendorsService.getSettings(id);
    return this.discogsService.search(settings.discogsApiKey, {
      query: searchDto.query,
      format: searchDto.format,
      artist: searchDto.artist,
      release_title: searchDto.album,
      label: searchDto.label,
      catno: searchDto.catno,
      barcode: searchDto.barcode,
      per_page: searchDto.per_page || 100,
      page: searchDto.page || 1,
    });
  }

  @Get(':id/spotify/search')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async searchSpotify(
    @Param('id') id: string,
    @Query('query') query: string,
  ) {
    return this.vendorsService.searchSpotify(id, query);
  }

  @Get(':id/spotify/player-search')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async searchSpotifyForPlayer(
    @Param('id') id: string,
    @Query('query') query: string,
    @Query('type') type: string,
  ) {
    return this.vendorsService.searchSpotifyForPlayer(id, query, type);
  }

  // ─── Spotify OAuth ───────────────────────────────────────────

  @Get(':id/spotify/auth-url')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async getSpotifyAuthUrl(@Param('id') id: string, @Request() req: any) {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const url = await this.vendorsService.buildSpotifyAuthUrl(id, backendUrl);
    return { url };
  }

  @Get(':id/spotify/callback')
  async spotifyCallback(
    @Param('id') id: string,
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: any,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    if (error || !code) {
      return res.redirect(`${frontendUrl}/panel/settings?spotify_error=${error || 'cancelled'}`);
    }
    try {
      await this.vendorsService.handleSpotifyCallback(id, code, backendUrl);
      return res.redirect(`${frontendUrl}/panel/settings?spotify_connected=1&section=integraciones&subsection=spotify`);
    } catch (e: any) {
      return res.redirect(`${frontendUrl}/panel/settings?spotify_error=${encodeURIComponent(e.message)}`);
    }
  }

  @Get(':id/spotify/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async getSpotifyStatus(@Param('id') id: string) {
    const settings = await this.vendorsService.getSettings(id);
    return {
      connected: !!settings.spotifyRefreshToken,
      userId: settings.spotifyUserId || null,
      playlistId: settings.spotifyPlaylistId || null,
    };
  }

  @Post(':id/spotify/disconnect')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async disconnectSpotify(@Param('id') id: string) {
    await this.vendorsService.disconnectSpotifyOAuth(id);
    return { success: true };
  }

  @Get(':id/spotify/currently-playing')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async getCurrentlyPlaying(@Param('id') id: string) {
    return this.vendorsService.getCurrentlyPlaying(id);
  }

  @Get(':id/spotify/currently-playing/public')
  async getCurrentlyPlayingPublic(@Param('id') id: string) {
    try {
      return await this.vendorsService.getCurrentlyPlaying(id);
    } catch {
      return { playing: false };
    }
  }

  @Get(':id/spotify/playlists')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async getSpotifyPlaylists(@Param('id') id: string) {
    return this.vendorsService.getSpotifyPlaylists(id);
  }

  @Get(':id/spotify/album-top-tracks/:albumId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async getAlbumTopTracks(
    @Param('id') id: string,
    @Param('albumId') albumId: string,
    @Query('limit') limit: string,
  ) {
    return this.vendorsService.getAlbumTopTracks(id, albumId, limit ? parseInt(limit) : 2);
  }

  @Post(':id/spotify/playlist/add-tracks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async addTracksToPlaylist(
    @Param('id') id: string,
    @Body() body: { playlistId: string; trackUris: string[] },
  ) {
    await this.vendorsService.addTracksToPlaylist(id, body.playlistId, body.trackUris);
    return { success: true };
  }

  // ─────────── Spotify Sync ────────────────────────────────────────────────

  @Get(':id/spotify/sync/preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async getSpotifySyncPreview(@Param('id') id: string) {
    return this.vendorsService.getSpotifySyncPreview(id);
  }

  @Post(':id/spotify/sync/run')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async syncAllProducts(@Param('id') id: string, @Body() body: { limit?: number }) {
    return this.vendorsService.syncAllProductsSpotifyTracks(id, body.limit || 2);
  }

  @Post(':id/spotify/sync/product/:productId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async syncSingleProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Body() body: { limit?: number },
  ) {
    return this.vendorsService.syncProductSpotifyTracks(id, productId, body.limit || 2);
  }

  @Delete(':id/spotify/sync/product/:productId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async deleteProductSyncPermanently(
    @Param('id') id: string,
    @Param('productId') productId: string,
  ) {
    return this.vendorsService.deleteProductSyncPermanently(id, productId);
  }

  @Post(':id/spotify/sync/discard/:productId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async discardProductSync(
    @Param('id') id: string,
    @Param('productId') productId: string,
  ) {
    await this.vendorsService.discardProductSync(id, productId);
    return { success: true };
  }

  @Post(':id/spotify/sync/restore/:productId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async restoreProductSync(
    @Param('id') id: string,
    @Param('productId') productId: string,
  ) {
    await this.vendorsService.restoreProductSync(id, productId);
    return { success: true };
  }

  @Get(':id/spotify/sync/inactive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async getInactiveButSynced(@Param('id') id: string) {
    return this.vendorsService.getInactiveButSyncedProducts(id);
  }

  @Post(':id/spotify/sync/deactivate/:productId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async removeFromPlaylistSoft(
    @Param('id') id: string,
    @Param('productId') productId: string,
  ) {
    return this.vendorsService.removeProductFromPlaylistSoft(id, productId);
  }

  @Post(':id/gemini/generate-description')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async generateDescription(
    @Param('id') id: string,
    @Body() productData: any,
  ) {
    try {
      console.log('Generate description request for vendor:', id);
      console.log('Product data:', productData);
      return await this.vendorsService.generateDescriptionWithGemini(id, productData);
    } catch (error) {
      console.error('Error in generateDescription controller:', error);
      throw error;
    }
  }

  @Get(':id/discogs/release/:releaseId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async getDiscogsRelease(
    @Param('id') id: string,
    @Param('releaseId') releaseId: string,
  ) {
    const settings = await this.vendorsService.getSettings(id);
    return this.discogsService.getRelease(settings.discogsApiKey, releaseId);
  }

  @Post(':id/upload-images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async uploadImages(
    @Param('id') id: string,
    @Body() uploadDto: { imageUrls: string[] },
  ) {
    return this.vendorsService.downloadAndSaveImages(id, uploadDto.imageUrls);
  }

  @Post(':id/upload-images-optimized')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async uploadImagesOptimized(
    @Param('id') id: string,
    @Body() uploadDto: { imageUrls: string[] },
  ): Promise<{ urls: string[]; imagesMeta: any[] }> {
    return this.vendorsService.downloadAndSaveImagesWithMeta(id, uploadDto.imageUrls);
  }

  @Post(':id/upload-files')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @UseInterceptors(FilesInterceptor('files', 10, {
    fileFilter: (req, file, cb) => {
      // Permitir imágenes y videos
      if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp|mp4|webm|ogg)$/)) {
        return cb(new Error('Only image and video files are allowed!'), false);
      }
      cb(null, true);
    },
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB max
    }
  }))
  async uploadFiles(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.vendorsService.uploadAndOptimizeFiles(id, files);
  }

  @Post(':id/optimize-product-images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async optimizeProductImages(
    @Param('id') id: string,
    @Body() body: { limit?: number; offset?: number; force?: boolean },
    @Request() req,
  ) {
    if (req.user.role === UserRole.VENDOR) {
      const ownVendor = await this.vendorsService.findByUserId(req.user.userId);
      if (!ownVendor || ownVendor.id !== id) {
        throw new ForbiddenException('You can only optimize your own vendor products');
      }
    }

    return this.vendorsService.optimizeProductImagesByVendor(id, {
      limit: body?.limit,
      offset: body?.offset,
      force: body?.force,
    });
  }

  // Endpoints de Categorías
  @Get(':id/categories')
  async getVendorCategories(@Param('id') vendorId: string) {
    return this.vendorsService.getCategories(vendorId);
  }

  @Get(':id/categories/with-products')
  async getVendorCategoriesWithProducts(@Param('id') vendorId: string) {
    return this.vendorsService.getCategoriesWithProducts(vendorId);
  }

  @Get(':id/categories/all')
  async getAllCategories() {
    return this.vendorsService.getAllCategories();
  }

  @Post(':id/categories/:categoryId/enable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async enableCategory(
    @Param('id') vendorId: string,
    @Param('categoryId') categoryId: string,
    @Body() data: { displayOrder?: number },
    @Request() req,
  ) {
    if (req.user.role === UserRole.VENDOR) {
      const ownVendor = await this.vendorsService.findByUserId(req.user.userId);
      if (!ownVendor || ownVendor.id !== vendorId) {
        throw new ForbiddenException('Solo puedes configurar las categorías de tu propia tienda');
      }
    }
    return this.vendorsService.enableCategory(vendorId, categoryId, data.displayOrder);
  }

  // Endpoint PATCH removido - ya no es necesario con la relación ManyToMany simple

  @Post(':id/categories/:categoryId/disable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async disableCategory(
    @Param('id') vendorId: string,
    @Param('categoryId') categoryId: string,
    @Request() req,
  ) {
    if (req.user.role === UserRole.VENDOR) {
      const ownVendor = await this.vendorsService.findByUserId(req.user.userId);
      if (!ownVendor || ownVendor.id !== vendorId) {
        throw new ForbiddenException('Solo puedes configurar las categorías de tu propia tienda');
      }
    }
    return this.vendorsService.disableCategory(vendorId, categoryId);
  }

  // Grid Configuration
  @Get(':id/grid-config')
  async getGridConfig(@Param('id') vendorId: string) {
    return this.vendorsService.getGridConfig(vendorId);
  }

  @Patch(':id/grid-config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async updateGridConfig(
    @Param('id') vendorId: string,
    @Body() updateGridConfigDto: any,
    @Request() req,
  ) {
    return this.vendorsService.updateGridConfig(
      vendorId,
      updateGridConfigDto.gridConfig,
      req.user.userId,
      req.user.role,
    );
  }

  // Home Page Configuration
  @Get(':id/home-page-config')
  async getHomePageConfig(@Param('id') vendorId: string) {
    return this.vendorsService.getHomePageConfig(vendorId);
  }

  @Patch(':id/home-page-config')
  async updateHomePageConfig(
    @Param('id') vendorId: string,
    @Body() homePageConfig: any,
  ) {
    // Public endpoint for marketplace configuration
    return this.vendorsService.updateHomePageConfigPublic(
      vendorId,
      homePageConfig,
    );
  }

  // Public endpoint to get vendor pages
  @Get(':id/pages')
  async getVendorPages(@Param('id') vendorId: string) {
    return this.vendorsService.getVendorPages(vendorId);
  }

  // Public endpoint to create vendor page
  @Post(':id/pages')
  async createVendorPage(@Param('id') vendorId: string, @Body() createPageDto: any) {
    return this.vendorsService.createVendorPage(vendorId, createPageDto);
  }

  // Public endpoint to update vendor page
  @Patch(':id/pages/:pageId')
  async updateVendorPage(
    @Param('id') vendorId: string,
    @Param('pageId') pageId: string,
    @Body() updatePageDto: any,
  ) {
    return this.vendorsService.updateVendorPage(vendorId, pageId, updatePageDto);
  }

  // Public endpoint to delete vendor page
  @Delete(':id/pages/:pageId')
  async deleteVendorPage(@Param('id') vendorId: string, @Param('pageId') pageId: string) {
    return this.vendorsService.deleteVendorPage(vendorId, pageId);
  }

  // Test SMTP connection
  @Post('test-smtp')
  async testSmtpConnection(@Body() smtpConfig: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    fromEmail: string;
    fromName: string;
    testEmail?: string;
  }) {
    console.log('[VendorsController] Testing SMTP connection...');
    
    // Test basic connection
    const connectionTest = await this.emailService.testSmtpConnection(smtpConfig);
    
    if (!connectionTest.success) {
      return connectionTest;
    }

    // If connection is successful and testEmail is provided, send test email
    if (smtpConfig.testEmail) {
      return await this.emailService.sendTestEmail(smtpConfig, smtpConfig.testEmail);
    }

    return connectionTest;
  }

  // Custom Domain Endpoints
  @Get(':id/custom-domain')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async getCustomDomain(@Param('id') id: string) {
    return this.vendorsService.getCustomDomainInfo(id);
  }

  @Patch(':id/custom-domain')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async updateCustomDomain(
    @Param('id') id: string,
    @Body('customDomain') customDomain: string,
    @Request() req,
  ) {
    return this.vendorsService.updateCustomDomain(
      id,
      customDomain,
      req.user.userId,
      req.user.role,
    );
  }

  @Post(':id/verify-custom-domain')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async verifyCustomDomain(
    @Param('id') id: string,
    @Request() req,
  ) {
    return this.vendorsService.verifyCustomDomain(
      id,
      req.user.userId,
      req.user.role,
    );
  }

  // ============================================
  // Commission Settings (Admin Only)
  // ============================================

  @Patch(':id/settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateVendorSettings(
    @Param('id') id: string,
    @Body() settings: {
      commissionPercentage?: number;
      wholesaleCommissionPercentage?: number;
      assistedCommissionPercentage?: number;
      assistedCommissionType?: 'percentage' | 'fixed';
      assistedCommissionFixedAmount?: number;
      isWholesaleEnabledByAdmin?: boolean;
    },
  ) {
    return this.vendorsService.updateVendorSettings(id, settings);
  }

  @Get(':id/settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getVendorSettings(@Param('id') id: string) {
    return this.vendorsService.getVendorSettings(id);
  }

  // ============================================
  // Migrations (Admin Only)
  // ============================================

  /**
   * Endpoint temporal para ejecutar la migración de páginas predefinidas
   * Solo admin puede ejecutar esta migración
   * Una vez ejecutada exitosamente, este endpoint puede ser eliminado
   * 
   * Para ejecutar: POST https://tu-api.com/vendors/migrate/default-pages
   * (requiere autenticación como admin)
   */
  @Post('migrate/default-pages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async migrateDefaultPages() {
    return this.vendorsService.migrateDefaultPagesForAllVendors();
  }
}

