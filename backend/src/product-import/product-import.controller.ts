import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProductImportService } from './product-import.service';
import { StorageService } from '../storage/storage.service';
import { ExecuteImportDto } from './dtos/bulk-import.dto';

@Controller('vendors/:vendorId/products/import')
@UseGuards(JwtAuthGuard)
export class ProductImportController {
  constructor(
    private readonly productImportService: ProductImportService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * NUEVO: Validar archivo de importación masiva
   */
  @Post('validate')
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(xlsx|xls|csv)$/)) {
          return cb(new BadRequestException('Only Excel/CSV files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  async validateImport(
    @Param('vendorId') vendorId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('config') configStr: string,
  ) {
    console.log('📦 [BulkImport] Validate request received');
    console.log('   VendorId:', vendorId);
    console.log('   File:', file?.originalname);
    console.log('   Config:', configStr);

    if (!file) {
      throw new BadRequestException('File is required');
    }

    const config = JSON.parse(configStr);
    const result = await this.productImportService.validateImport(
      vendorId,
      file.buffer,
      file.originalname,
      config,
    );

    return result;
  }

  /**
   * NUEVO: Ejecutar importación masiva (síncrono)
   */
  @Post('execute')
  async executeImport(
    @Param('vendorId') vendorId: string,
    @Body() data: any, // Cambiar a any para debug
  ) {
    console.log('📦 [BulkImport] Execute request received');
    console.log('   VendorId:', vendorId);
    console.log('   Raw body:', JSON.stringify(data, null, 2));
    console.log('   Products count:', data.products?.length);
    console.log('   Config:', data.config);

    // Validación manual
    if (!data.products || !Array.isArray(data.products)) {
      throw new BadRequestException('Products array is required');
    }

    if (!data.config) {
      throw new BadRequestException('Config is required');
    }

    try {
      const result = await this.productImportService.executeBulkImport(
        vendorId,
        data.products,
        data.config,
      );

      console.log('✅ [BulkImport] Execute completed successfully');
      return result;
    } catch (error) {
      console.error('❌ [BulkImport] Execute failed:', error);
      console.error('   Error message:', error.message);
      console.error('   Error stack:', error.stack);
      throw error;
    }
  }

  /**
   * NUEVO: Descargar plantilla Excel
   */
  @Get('template')
  async downloadTemplate(
    @Param('vendorId') vendorId: string,
    @Query('includeWholesale') includeWholesale: string,
  ) {
    const includeWholesalePrices = includeWholesale === 'true';
    const buffer = await this.productImportService.generateTemplate(includeWholesalePrices);

    return {
      filename: 'plantilla-importacion.xlsx',
      buffer: buffer.toString('base64'),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  // LEGACY ENDPOINT (mantener para compatibilidad)
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(xlsx|xls|csv)$/)) {
          return cb(new BadRequestException('Only Excel files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadAndProcessFile(
    @Param('vendorId') vendorId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const { url, key } = await this.storageService.uploadFile(file, 'imports');
    
    // El servicio necesitará acceso al archivo, así que si estamos en Spaces
    // necesitamos descargar temporalmente o modificar el servicio para trabajar con buffer
    // Por ahora, pasamos el buffer directamente
    const results = await this.productImportService.processImportFileBuffer(vendorId, file.buffer, file.originalname);
    return { data: results };
  }

  // LEGACY ENDPOINT (mantener para compatibilidad)
  @Post()
  async importProducts(
    @Param('vendorId') vendorId: string,
    @Body('products') products: Array<{ 
      discogsId: string; 
      catalog: string; 
      precio?: number;
      categoria?: string;
      condicion?: string;
      stock?: number;
    }>,
  ) {
    const results = await this.productImportService.importProducts(vendorId, products);
    return { 
      message: `${results.length} products imported successfully`,
      data: results 
    };
  }
}
