import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EstateGuard } from './estate.guard';
import { CompanyTeamService } from './company-team.service';
import type { Actor } from './rules';
@Controller()
export class CompanyTeamController {
  constructor(private team: CompanyTeamService) {}
  @Get('company-teams/capabilities') async capabilities() {
    return { enabled: await this.team.available(), version: 1 };
  }
  @Get('me/company-team') @UseGuards(EstateGuard) overview(
    @Req() r: { user: Actor },
  ) {
    return this.team.overview(r.user);
  }
  @Post('me/company-team') @UseGuards(EstateGuard) create(
    @Req() r: { user: Actor },
  ) {
    return this.team.create(r.user);
  }
  @Post('me/company-team/invitations') @UseGuards(EstateGuard) invite(
    @Req() r: { user: Actor },
    @Body() b: { email?: unknown },
  ) {
    return this.team.invite(r.user, b.email);
  }
  @Post('me/company-team/invitations/:id/revoke')
  @UseGuards(EstateGuard)
  cancel(@Req() r: { user: Actor }, @Param('id') id: string) {
    return this.team.cancelInvite(r.user, id);
  }
  @Post('me/company-team/accept') @UseGuards(EstateGuard) accept(
    @Req() r: { user: Actor },
    @Body() b: { token?: unknown },
  ) {
    return this.team.accept(r.user, b.token);
  }
  @Post('me/company-team/members/:id/revoke') @UseGuards(EstateGuard) revoke(
    @Req() r: { user: Actor },
    @Param('id') id: string,
  ) {
    return this.team.revoke(r.user, id);
  }
  @Post('me/company-team/assignments') @UseGuards(EstateGuard) assign(
    @Req() r: { user: Actor },
    @Body()
    b: {
      user_id?: unknown;
      property_id?: unknown;
      can_edit?: unknown;
      remove?: unknown;
    },
  ) {
    return this.team.assign(r.user, b);
  }
  @Get('me/company-teams/:id/properties') @UseGuards(EstateGuard) properties(
    @Req() r: { user: Actor },
    @Param('id') id: string,
  ) {
    return this.team.assigned(r.user, id);
  }
  @Post('me/company-teams/:team/properties/:id/proposals')
  @UseGuards(EstateGuard)
  propose(
    @Req() r: { user: Actor },
    @Param('team') team: string,
    @Param('id') id: string,
    @Body() b: { revision?: unknown; changes?: unknown },
  ) {
    return this.team.propose(r.user, team, id, b);
  }
  @Post('me/company-team/proposals/:id/review') @UseGuards(EstateGuard) review(
    @Req() r: { user: Actor },
    @Param('id') id: string,
    @Body() b: { accept?: unknown },
  ) {
    return this.team.review(r.user, id, b.accept);
  }
}
