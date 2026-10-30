import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import sharp from 'sharp';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { StorageService } from '../storage/storage.service';
import { InventoryService } from './inventory.service';
import { InventorySetupService } from './inventory-setup.service';
import { CoverRecognitionService } from './cover-recognition.service';

const photoUpload = FileInterceptor('photo', {
  limits: { fileSize: 8 * 1024 * 1024 },
});

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly setup: InventorySetupService,
    private readonly covers: CoverRecognitionService,
    private readonly storage: StorageService,
  ) {}

  private vendor(req: any) {
    return this.inventory.vendorForUser(req.user.userId);
  }
  private async photo(file: any) {
    if (!file?.buffer) throw new BadRequestException('Adjunta una foto');
    try {
      return await sharp(file.buffer, { limitInputPixels: 25000000 })
        .rotate()
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      throw new BadRequestException(
        'La imagen no es válida o es demasiado grande',
      );
    }
  }

  @Get('admin/status')
  @Roles(UserRole.ADMIN)
  status() {
    return this.covers.status();
  }

  @Post('admin/setup')
  @Roles(UserRole.ADMIN)
  install() {
    return this.setup.install();
  }

  @Post('admin/index')
  @Roles(UserRole.ADMIN)
  index(@Body() data: any) {
    if (typeof data.enabled !== 'boolean')
      throw new BadRequestException('Estado inválido');
    return this.covers.setEnabled(data.enabled, data.retry === true);
  }

  @Get('covers/status')
  @Roles(UserRole.VENDOR)
  async coverStatus(@Request() req: any) {
    return this.covers.status(await this.vendor(req));
  }

  @Get('mine')
  @Roles(UserRole.VENDOR)
  async list(@Request() req: any) {
    return this.inventory.list(await this.vendor(req));
  }

  @Post('sessions')
  @Roles(UserRole.VENDOR)
  async create(@Request() req: any, @Body() data: any) {
    return this.inventory.create(await this.vendor(req), req.user.userId, data);
  }

  @Get('sessions/:id')
  @Roles(UserRole.VENDOR)
  async detail(
    @Request() req: any,
    @Param('id') id: string,
    @Query() query: any,
  ) {
    return this.inventory.detail(await this.vendor(req), id, query);
  }

  @Get('sessions/:id/search')
  @Roles(UserRole.VENDOR)
  async search(
    @Request() req: any,
    @Param('id') id: string,
    @Query('term') term: string,
  ) {
    return this.inventory.search(await this.vendor(req), id, term);
  }

  @Post('sessions/:id/count')
  @Roles(UserRole.VENDOR)
  async count(@Request() req: any, @Param('id') id: string, @Body() data: any) {
    return this.inventory.count(
      await this.vendor(req),
      id,
      req.user.userId,
      data,
    );
  }

  @Patch('sessions/:id/lines/:productId')
  @Roles(UserRole.VENDOR)
  async review(
    @Request() req: any,
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Body() data: any,
  ) {
    return this.inventory.reviewLine(
      await this.vendor(req),
      id,
      productId,
      data,
    );
  }

  @Post('sessions/:id/found')
  @Roles(UserRole.VENDOR)
  @UseInterceptors(photoUpload)
  async found(
    @Request() req: any,
    @Param('id') id: string,
    @Body() data: any,
    @UploadedFile() file: any,
  ) {
    const vendorId = await this.vendor(req);
    await this.inventory.verifySession(vendorId, id);
    let url: string | undefined;
    if (file) {
      const buffer = await this.photo(file);
      url = (
        await this.storage.uploadFile(
          { buffer, originalname: 'inventory.jpg', mimetype: 'image/jpeg' },
          'inventory',
        )
      ).url;
    }
    return this.inventory.addFound(vendorId, id, data, url);
  }

  @Patch('sessions/:id/found/:foundId')
  @Roles(UserRole.VENDOR)
  async resolve(
    @Request() req: any,
    @Param('id') id: string,
    @Param('foundId') foundId: string,
    @Body() data: any,
  ) {
    return this.inventory.resolveFound(
      await this.vendor(req),
      id,
      foundId,
      req.user.userId,
      data,
    );
  }

  @Patch('sessions/:id/status')
  @Roles(UserRole.VENDOR)
  async changeStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.inventory.changeStatus(
      await this.vendor(req),
      id,
      req.user.userId,
      status,
    );
  }

  @Post('sessions/:id/sync-retry')
  @Roles(UserRole.VENDOR)
  async retrySync(@Request() req: any, @Param('id') id: string) {
    return this.inventory.retrySync(await this.vendor(req), id);
  }

  @Get('sessions/:id/found/:foundId')
  @Roles(UserRole.VENDOR)
  async getFound(
    @Request() req: any,
    @Param('id') id: string,
    @Param('foundId') foundId: string,
  ) {
    return this.inventory.getFound(await this.vendor(req), id, foundId);
  }

  @Post('sessions/:id/photo-search')
  @Roles(UserRole.VENDOR)
  @UseInterceptors(photoUpload)
  async recognize(
    @Request() req: any,
    @Param('id') id: string,
    @UploadedFile() file: any,
  ) {
    const vendorId = await this.vendor(req);
    await this.inventory.verifySession(vendorId, id);
    const result = await this.covers.search(vendorId, await this.photo(file));
    const counts = await this.inventory.getCounts(
      vendorId,
      id,
      result.matches.flatMap((match) =>
        match.product ? [match.product.id] : [],
      ),
    );
    return {
      ...result,
      matches: result.matches.map((match) => ({
        ...match,
        product: match.product
          ? { ...match.product, inventoryCount: counts[match.product.id] ?? 0 }
          : match.product,
      })),
    };
  }
}
