import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
  Request,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { LiquidacionesService } from './liquidaciones.service';
import { StorageService } from '../storage/storage.service';

@Controller('liquidaciones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class LiquidacionesController {
  constructor(
    private readonly liquidacionesService: LiquidacionesService,
    private readonly storageService: StorageService,
  ) {}

  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(xlsx|xls)$/i)) {
          return cb(new BadRequestException('Solo se permiten archivos Excel (.xlsx, .xls)'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    }),
  )
  async importExcel(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Archivo Excel requerido');
    }
    return this.liquidacionesService.importFromBuffer(file.buffer);
  }

  @Get()
  async findAll(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('estado') estado: string,
    @Query('search') search: string,
    @Query('fechaDesde') fechaDesde: string,
    @Query('fechaHasta') fechaHasta: string,
  ) {
    return this.liquidacionesService.findAll({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
      estado: estado || undefined,
      search: search || undefined,
      fechaDesde: fechaDesde || undefined,
      fechaHasta: fechaHasta || undefined,
    });
  }

  @Get('stats')
  async getStats() {
    return this.liquidacionesService.getStats();
  }

  @Get('resumen-tiendas')
  async getResumenTiendas() {
    return this.liquidacionesService.getResumenTiendas();
  }

  // ─── Depósitos Tiendas ──────────────────────────────────────────────────

  @Get('vendors-list')
  async getVendorsList() {
    return this.liquidacionesService.getVendorsList();
  }

  @Get('depositos-pendientes')
  async getDepositosPendientes(@Query('vendorId') vendorId?: string) {
    return this.liquidacionesService.getDepositosPendientes(vendorId);
  }

  @Get('vendor-payments')
  async getVendorPayments(@Query('vendorId') vendorId?: string) {
    return this.liquidacionesService.getVendorPayments(vendorId);
  }

  @Post('devoluciones/:orderId/notificar-vendedor')
  async notifyVendorPendingRefund(@Param('orderId') orderId: string) {
    return this.liquidacionesService.notifyVendorPendingRefund(orderId);
  }

  @Post('pagar-vendor')
  @UseInterceptors(
    FileInterceptor('comprobante', {
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|pdf|webp)$/i)) {
          return cb(new BadRequestException('Solo imágenes o PDF'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  async pagarVendor(
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const {
      vendorId,
      vendorEmail,
      vendorStoreName,
      orderIds,
      numeroTransferencia,
      comprobanteNota,
      valorDepositado,
      fechaPago,
    } = body;

    if (!vendorId || !orderIds || !numeroTransferencia || !valorDepositado) {
      throw new BadRequestException('Faltan campos requeridos');
    }

    const ids: string[] = Array.isArray(orderIds)
      ? orderIds
      : JSON.parse(orderIds);

    const filePath = file
      ? (await this.storageService.uploadFile(file, 'comprobantes/liquidaciones')).url
      : undefined;

    return this.liquidacionesService.createVendorPayment(
      {
        vendorId,
        vendorEmail,
        vendorStoreName,
        orderIds: ids,
        numeroTransferencia,
        comprobanteNota,
        valorDepositado: Number(valorDepositado),
        fechaPago,
      },
      filePath,
    );
  }
}
