import { BadRequestException, Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';

@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  findAll(@Query('module') module?: string) {
    return this.auditLogService.findAll(module);
  }

  @Post('events')
  createEvent(
    @Body()
    body: {
      module?: string;
      action?: 'export' | 'import';
      message?: string;
      method?: string;
      path?: string;
    },
    @Headers('x-actor-name') actorNameRaw?: string,
    @Headers('x-actor-role') actorRoleRaw?: string,
  ) {
    const module = (body.module ?? '').trim();
    const action = body.action;
    const message = (body.message ?? '').trim();
    const actorName = (actorNameRaw ?? '').trim();
    const actorRole = (actorRoleRaw ?? '').trim().toLowerCase();

    if (!module || (action !== 'export' && action !== 'import') || !message) {
      throw new BadRequestException('Invalid audit event payload.');
    }
    if (!actorName || !actorRole) {
      throw new BadRequestException('Missing actor headers.');
    }

    return this.auditLogService.create({
      module,
      action,
      message,
      actorName,
      actorRole,
      method: (body.method ?? 'POST').trim() || 'POST',
      path: (body.path ?? `/audit-logs/events`).trim() || '/audit-logs/events',
    });
  }
}
