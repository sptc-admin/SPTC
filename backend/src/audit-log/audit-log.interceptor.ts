import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { DataSource } from 'typeorm';
import { Arkilahan } from '../arkilahan/arkilahan.entity';
import { ButawRecord } from '../butaw/butaw-record.entity';
import { Driver } from '../drivers/driver.entity';
import { Loan } from '../loans/loan.entity';
import { Member } from '../members/member.entity';
import { Operation } from '../operations/operation.entity';
import { SavingsRecord } from '../savings/savings-record.entity';
import { Suspension } from '../suspensions/suspension.entity';
import { User } from '../users/user.entity';
import { AuditLogService } from './audit-log.service';

type ActionType = 'create' | 'update' | 'delete';

const NOUN_BY_MODULE: Record<string, string> = {
  members: 'member',
  drivers: 'driver',
  arkilahan: 'arkilahan record',
  operations: 'operation record',
  suspensions: 'suspension record',
  loans: 'loan record',
  savings: 'savings record',
  butaw: 'butaw record',
  users: 'staff account',
  lipatan: 'lipatan record',
};

const VERB_BY_ACTION: Record<ActionType, string> = {
  create: 'added a new',
  update: 'updated',
  delete: 'deleted',
};

function actionFromMethod(method: string): ActionType | null {
  if (method === 'POST') return 'create';
  if (method === 'PATCH') return 'update';
  if (method === 'DELETE') return 'delete';
  return null;
}

function normalizeRole(role: string): string {
  const r = role.trim().toLowerCase();
  if (r === 'admin') return 'Admin';
  if (r === 'staff') return 'Staff';
  return '';
}

function stringifySimple(value: unknown): string {
  if (value == null) return 'none';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'none';
  const text = String(value).trim();
  return text || 'none';
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly dataSource: DataSource,
  ) {}

  private displayNameFromJsonName(
    fullName: unknown,
    bodyNumber?: string,
  ): string | null {
    if (!fullName || typeof fullName !== 'object') return null;
    const fn = fullName as {
      first?: string;
      middle?: string;
      last?: string;
      suffix?: string;
    };
    const first = (fn.first ?? '').trim();
    const last = (fn.last ?? '').trim();
    const suffix = (fn.suffix ?? '').trim();
    const name = `${first} ${last} ${suffix}`.trim();
    if (!name) return bodyNumber ? `Body #${bodyNumber}` : null;
    return bodyNumber ? `${name} (Body #${bodyNumber})` : name;
  }

  private subjectLabel(moduleName: string, payload: unknown, id?: string): string {
    if (!payload || typeof payload !== 'object') {
      return id ? `ID ${id}` : 'record';
    }
    const row = payload as Record<string, unknown>;

    if (moduleName === 'members' || moduleName === 'lipatan') {
      const fromName = this.displayNameFromJsonName(
        row.fullName,
        String(row.bodyNumber ?? ''),
      );
      return fromName ?? (id ? `ID ${id}` : 'member');
    }
    if (moduleName === 'drivers') {
      const fromName = this.displayNameFromJsonName(
        row.fullName,
        String(row.bodyNumber ?? ''),
      );
      return fromName ?? (id ? `ID ${id}` : 'driver');
    }
    if (moduleName === 'users') {
      const first = String(row.firstname ?? '').trim();
      const last = String(row.lastname ?? '').trim();
      const username = String(row.username ?? '').trim();
      const full = `${first} ${last}`.trim();
      if (full && username) return `${full} (@${username})`;
      return full || username || (id ? `ID ${id}` : 'staff account');
    }
    if (moduleName === 'arkilahan') {
      const name = String(row.name ?? '').trim();
      const body = String(row.bodyNumber ?? '').trim();
      if (name && body) return `${name} (Body #${body})`;
      return name || (body ? `Body #${body}` : id ? `ID ${id}` : 'arkilahan');
    }
    if (moduleName === 'operations') {
      const body = String(row.bodyNumber ?? '').trim();
      return body ? `Body #${body}` : id ? `ID ${id}` : 'operation';
    }
    if (moduleName === 'suspensions') {
      const name = String(row.driverName ?? '').trim();
      const body = String(row.bodyNumber ?? '').trim();
      if (name && body) return `${name} (Body #${body})`;
      return name || (body ? `Body #${body}` : id ? `ID ${id}` : 'suspension');
    }
    if (moduleName === 'loans') {
      const name = String(row.memberName ?? '').trim();
      const body = String(row.bodyNumber ?? '').trim();
      const type = String(row.loanType ?? '').trim();
      const who = name && body ? `${name} (Body #${body})` : name || body;
      if (who && type) return `${who} [${type}]`;
      return who || (id ? `ID ${id}` : 'loan');
    }
    if (moduleName === 'savings') {
      const name = String(row.memberName ?? '').trim();
      const body = String(row.bodyNumber ?? '').trim();
      return name && body
        ? `${name} (Body #${body})`
        : name || (body ? `Body #${body}` : id ? `ID ${id}` : 'savings');
    }
    if (moduleName === 'butaw') {
      const name = String(row.memberName ?? '').trim();
      const body = String(row.bodyNumber ?? '').trim();
      return name && body
        ? `${name} (Body #${body})`
        : name || (body ? `Body #${body}` : id ? `ID ${id}` : 'butaw');
    }
    return id ? `ID ${id}` : 'record';
  }

  private async fetchTargetBeforeDelete(
    moduleName: string,
    id: string,
  ): Promise<unknown> {
    if (!id) return null;
    if (moduleName === 'members') {
      return this.dataSource.getRepository(Member).findOne({ where: { id } });
    }
    if (moduleName === 'drivers') {
      return this.dataSource.getRepository(Driver).findOne({ where: { id } });
    }
    if (moduleName === 'users') {
      return this.dataSource.getRepository(User).findOne({ where: { id: Number(id) } });
    }
    if (moduleName === 'arkilahan') {
      return this.dataSource.getRepository(Arkilahan).findOne({ where: { id } });
    }
    if (moduleName === 'operations') {
      return this.dataSource.getRepository(Operation).findOne({ where: { id } });
    }
    if (moduleName === 'suspensions') {
      return this.dataSource.getRepository(Suspension).findOne({ where: { id } });
    }
    if (moduleName === 'loans') {
      return this.dataSource.getRepository(Loan).findOne({ where: { id } });
    }
    if (moduleName === 'savings') {
      return this.dataSource.getRepository(SavingsRecord).findOne({ where: { id } });
    }
    if (moduleName === 'butaw') {
      return this.dataSource.getRepository(ButawRecord).findOne({ where: { id } });
    }
    return null;
  }

  private fieldLabel(moduleName: string, key: string): string | null {
    if (key === 'fullName') {
      if (moduleName === 'members' || moduleName === 'lipatan') return 'member name';
      if (moduleName === 'drivers') return 'driver name';
      return 'name';
    }
    const labels: Record<string, string> = {
      bodyNumber: 'body number',
      precinctNumber: 'precinct number',
      birthday: 'birthday',
      address: 'address',
      contactMobile10: 'mobile number',
      tinDigits: 'TIN',
      name: 'name',
      fee: 'fee',
      dueDate: 'due date',
      termValue: 'term value',
      termUnit: 'term unit',
      date: 'date',
      status: 'status',
      startDate: 'start date',
      endDate: 'end date',
      role: 'role',
      enabled: 'account status',
      amount: 'amount',
      month: 'month',
      loanType: 'loan type',
      dateReleased: 'date released',
      maturityDate: 'maturity date',
      mtopExpirationDate: 'MTOP expiration date',
      ltoExpirationDate: 'LTO expiration date',
      reason: 'reason',
      documentUrl: 'contract',
      mtopDocumentUrl: 'MTOP document',
      ltoDocumentUrl: 'LTO document',
    };
    return labels[key] ?? null;
  }

  private valueForField(row: unknown, key: string): string {
    if (!row || typeof row !== 'object') return 'none';
    const obj = row as Record<string, unknown>;
    if (key === 'fullName') {
      const full = this.displayNameFromJsonName(
        obj.fullName,
        String(obj.bodyNumber ?? ''),
      );
      return full ?? 'none';
    }
    if (key === 'address') {
      const a = obj.address as
        | { line?: string; barangay?: string; city?: string; province?: string }
        | undefined;
      if (!a || typeof a !== 'object') return 'none';
      const parts = [a.line, a.barangay, a.city, a.province]
        .map((v) => (v ?? '').trim())
        .filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : 'none';
    }
    if (key === 'enabled') {
      return obj.enabled ? 'enabled' : 'disabled';
    }
    if (key === 'documentUrl' || key === 'mtopDocumentUrl' || key === 'ltoDocumentUrl') {
      return String(obj[key] ?? '').trim() ? 'attached' : 'none';
    }
    return stringifySimple(obj[key]);
  }

  private updateDetails(
    moduleName: string,
    beforeRow: unknown,
    afterRow: unknown,
    changedKeys: string[],
  ): string[] {
    const details: string[] = [];
    for (const key of changedKeys) {
      const label = this.fieldLabel(moduleName, key);
      if (!label) continue;
      const from = this.valueForField(beforeRow, key);
      const to = this.valueForField(afterRow, key);
      if (from === to) continue;
      details.push(`${label} from "${from}" to "${to}"`);
    }
    return details;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method?: string;
      originalUrl?: string;
      body?: Record<string, unknown>;
      params?: Record<string, string | undefined>;
      headers?: Record<string, string | string[] | undefined>;
    }>();
    const method = (req.method ?? '').toUpperCase();
    const action = actionFromMethod(method);
    if (!action) return next.handle();

    const originalUrl = req.originalUrl ?? '';
    const pathOnly = originalUrl.split('?')[0];
    const first = pathOnly.split('/').filter(Boolean)[0] ?? '';

    const moduleName =
      pathOnly.includes('/members/') && pathOnly.endsWith('/lipatan')
        ? 'lipatan'
        : first;

    if (!moduleName || moduleName === 'auth' || moduleName === 'audit-logs') {
      return next.handle();
    }

    const headers = req.headers ?? {};
    const actorNameRaw = headers['x-actor-name'];
    const actorRoleRaw = headers['x-actor-role'];
    const actorName =
      (Array.isArray(actorNameRaw) ? actorNameRaw[0] : actorNameRaw)?.trim() ||
      'Unknown User';
    const actorRole = normalizeRole(
      (Array.isArray(actorRoleRaw) ? actorRoleRaw[0] : actorRoleRaw) || 'staff',
    );
    if (!actorRole) return next.handle();

    const noun = NOUN_BY_MODULE[moduleName] ?? `${moduleName} record`;
    const pathParts = pathOnly.split('/').filter(Boolean);
    const targetId = pathParts[1] ?? req.params?.id ?? '';
    const changedKeys = Object.keys(req.body ?? {}).filter(
      (k) => !['id', 'createdAt', 'updatedAt'].includes(k),
    );
    let deletedTarget: unknown = null;
    let beforeUpdateTarget: unknown = null;

    return new Observable((subscriber) => {
      (async () => {
        if (action === 'delete' && targetId) {
          deletedTarget = await this.fetchTargetBeforeDelete(moduleName, targetId);
        }
        if (action === 'update' && targetId) {
          beforeUpdateTarget = await this.fetchTargetBeforeDelete(moduleName, targetId);
        }
      })()
        .finally(() => {
          next
            .handle()
            .pipe(
      tap({
        next: (responseBody) => {
          const source = action === 'delete' ? deletedTarget : responseBody;
          const subject = this.subjectLabel(moduleName, source, targetId);
          let message = `${actorName} (${actorRole}) ${VERB_BY_ACTION[action]} ${noun}: ${subject}.`;
          if (action === 'update' && changedKeys.length > 0) {
            const details = this.updateDetails(
              moduleName,
              beforeUpdateTarget,
              responseBody,
              changedKeys,
            );
            if (details.length > 0) {
              message = `${actorName} (${actorRole}) updated ${noun}: ${subject}; ${details.join('; ')}.`;
            }
          }
          void this.auditLogService.create({
            module: moduleName,
            action,
            message,
            actorName,
            actorRole: actorRole.toLowerCase(),
            method,
            path: originalUrl,
          });
        },
      }),
            )
            .subscribe(subscriber);
        })
        .catch(() => {
          next.handle().subscribe(subscriber);
        });
    });
  }
}
