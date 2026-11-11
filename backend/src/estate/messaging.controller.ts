import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EstateGuard } from './estate.guard';
import { MessagingService } from './messaging.service';
import type {
  NewConversation,
  NewMessage,
  HistoryQuery,
} from './messaging.service';
import { Actor } from './rules';
import { PushService } from './push.service';
type MessageRequest = { user: Actor };

@Controller('messages')
export class MessagingController {
  constructor(
    private messaging: MessagingService,
    private push: PushService,
  ) {}

  @Post('devices')
  @UseGuards(EstateGuard)
  device(
    @Req() req: MessageRequest,
    @Body() body: { token?: unknown; enabled?: unknown },
  ) {
    return body?.enabled === false
      ? this.push.unregister(req.user, body.token)
      : this.push.register(req.user, body?.token);
  }

  @Get('capabilities') capabilities() {
    return this.messaging.capabilities();
  }
  @Post('notifications/test')
  @UseGuards(EstateGuard)
  testOwn(@Req() req: MessageRequest) {
    return this.push.testOwnDevices(req.user);
  }
  @Get('conversations')
  @UseGuards(EstateGuard)
  inbox(@Req() req: MessageRequest, @Query('page') page: string) {
    return this.messaging.inbox(req.user, page);
  }
  @Post('conversations')
  @UseGuards(EstateGuard)
  create(@Req() req: MessageRequest, @Body() body: NewConversation) {
    return this.messaging.create(req.user, body);
  }
  @Get('conversations/:id')
  @UseGuards(EstateGuard)
  history(
    @Req() req: MessageRequest,
    @Param('id') id: string,
    @Query() query: HistoryQuery,
  ) {
    return this.messaging.history(req.user, id, query);
  }
  @Post('conversations/:id')
  @UseGuards(EstateGuard)
  send(
    @Req() req: MessageRequest,
    @Param('id') id: string,
    @Body() body: NewMessage,
  ) {
    return this.messaging.send(req.user, id, body);
  }
  @Post('conversations/:id/read')
  @UseGuards(EstateGuard)
  read(
    @Req() req: MessageRequest,
    @Param('id') id: string,
    @Body() body: { last_message_id?: unknown },
  ) {
    return this.messaging.markRead(req.user, id, body?.last_message_id);
  }
}
