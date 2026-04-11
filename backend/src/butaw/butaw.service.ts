import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BUTAW_MONTHLY_AMOUNT,
  addMonthsYm,
  currentYmLocal,
  recordEndYm,
} from './butaw-month.util';
import { capitalizeWords } from '../common/text-case.util';
import { ButawRecord } from './butaw-record.entity';

export type CreateButawDto = Pick<
  ButawRecord,
  'memberId' | 'bodyNumber' | 'memberName' | 'amount'
> & { isAdvance?: boolean; month?: string };

@Injectable()
export class ButawService {
  constructor(
    @InjectRepository(ButawRecord)
    private readonly repo: Repository<ButawRecord>,
  ) {}

  findAll(): Promise<ButawRecord[]> {
    return this.repo.find({
      order: { month: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<ButawRecord> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Butaw record ${id} not found`);
    }
    return row;
  }

  async create(data: CreateButawDto): Promise<ButawRecord> {
    const cents = Math.round(Number(data.amount) * 100);
    if (cents <= 0 || cents % (BUTAW_MONTHLY_AMOUNT * 100) !== 0) {
      throw new BadRequestException(
        `Amount must be a positive multiple of ${BUTAW_MONTHLY_AMOUNT}.`,
      );
    }
    const amount = cents / 100;
    const monthsPaid = cents / (BUTAW_MONTHLY_AMOUNT * 100);
    const existing = await this.repo.find({
      where: { memberId: data.memberId },
    });
    let lastEnd: string | null = null;
    for (const r of existing) {
      const end = recordEndYm(r.month, r.monthEnd);
      if (!lastEnd || end.localeCompare(lastEnd) > 0) {
        lastEnd = end;
      }
    }
    const autoStart = lastEnd ? addMonthsYm(lastEnd, 1) : currentYmLocal();
    const trimmed = data.month?.trim();
    const monthStart =
      trimmed && /^\d{4}-\d{2}$/.test(trimmed) ? trimmed : autoStart;
    const monthEnd = addMonthsYm(monthStart, monthsPaid - 1);

    return this.repo.save(
      this.repo.create({
        memberId: data.memberId,
        bodyNumber: data.bodyNumber,
        memberName: capitalizeWords(data.memberName),
        amount,
        month: monthStart,
        monthEnd,
        isAdvance: data.isAdvance ?? false,
      }),
    );
  }

  async remove(id: string): Promise<void> {
    const result = await this.repo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Butaw record ${id} not found`);
    }
  }
}
