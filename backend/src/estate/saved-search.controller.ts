import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EstateGuard } from './estate.guard';
import { Actor } from './rules';
import { SavedSearchService } from './saved-search.service';
@Controller('me/saved-searches')
@UseGuards(EstateGuard)
export class SavedSearchController {
  constructor(private searches: SavedSearchService) {}
  @Get() list(@Req() req: { user: Actor }) {
    return this.searches.list(req.user);
  }
  @Get('matches') matches(
    @Req() req: { user: Actor },
    @Query('before') before?: string,
  ) {
    return this.searches.matches(req.user, before);
  }
  @Post('matches/:id/read') read(
    @Req() req: { user: Actor },
    @Param('id') id: string,
  ) {
    return this.searches.readMatch(req.user, id);
  }
  @Get(':id') get(@Req() req: { user: Actor }, @Param('id') id: string) {
    return this.searches.get(req.user, id);
  }
  @Post() create(
    @Req() req: { user: Actor },
    @Body() body: { name?: unknown; filters?: unknown; enabled?: unknown },
  ) {
    return this.searches.create(req.user, body);
  }
  @Patch(':id') update(
    @Req() req: { user: Actor },
    @Param('id') id: string,
    @Body() body: { enabled?: unknown },
  ) {
    return this.searches.update(req.user, id, body);
  }
  @Delete(':id') remove(@Req() req: { user: Actor }, @Param('id') id: string) {
    return this.searches.remove(req.user, id);
  }
}

@Controller('saved-searches')
export class SavedSearchCapabilitiesController {
  constructor(private searches: SavedSearchService) {}
  @Get('capabilities')
  async capabilities() {
    return { enabled: await this.searches.available() };
  }
}
