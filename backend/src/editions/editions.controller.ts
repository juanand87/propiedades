import { Controller, Get, Param } from '@nestjs/common';
import { EditionsService } from './editions.service';

@Controller('editions')
export class EditionsController {
  constructor(private readonly editionsService: EditionsService) {}

  @Get()
  async findAll() {
    return this.editionsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.editionsService.findById(+id);
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.editionsService.findBySlug(slug);
  }
}
