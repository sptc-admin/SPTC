import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { capitalizeWords } from '../common/text-case.util';
import { Loan } from './loan.entity';

export type CreateLoanInput = Omit<Loan, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateLoanInput = Partial<CreateLoanInput>;

@Injectable()
export class LoansService {
  constructor(
    @InjectRepository(Loan)
    private readonly loansRepository: Repository<Loan>,
  ) {}

  findAll(): Promise<Loan[]> {
    return this.loansRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Loan> {
    const loan = await this.loansRepository.findOne({ where: { id } });
    if (!loan) {
      throw new NotFoundException(`Loan ${id} not found`);
    }
    return loan;
  }

  create(data: CreateLoanInput): Promise<Loan> {
    const entity = this.loansRepository.create({
      ...data,
      memberName: capitalizeWords(data.memberName),
      reason: data.reason ?? null,
      paidDueDates: data.paidDueDates ?? [],
      emergencySettled: data.emergencySettled ?? false,
      emergencyPaidOn: data.emergencyPaidOn ?? null,
      emergencyAmountPaid: data.emergencyAmountPaid ?? null,
    });
    return this.loansRepository.save(entity);
  }

  async update(id: string, data: UpdateLoanInput): Promise<Loan> {
    const loan = await this.findOne(id);
    const next: UpdateLoanInput = { ...data };
    if (data.memberName !== undefined) {
      next.memberName = capitalizeWords(data.memberName);
    }
    if (data.emergencySettled === true && !loan.emergencySettled) {
      const fromClient = data.emergencyPaidOn;
      if (
        typeof fromClient === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(fromClient.trim())
      ) {
        next.emergencyPaidOn = fromClient.trim();
      } else {
        next.emergencyPaidOn = new Date().toISOString().slice(0, 10);
      }
      const amt = data.emergencyAmountPaid;
      if (typeof amt === 'number' && Number.isFinite(amt) && amt >= 0) {
        next.emergencyAmountPaid = amt;
      } else {
        next.emergencyAmountPaid = null;
      }
    }
    if (data.emergencySettled === false) {
      next.emergencyPaidOn = null;
      next.emergencyAmountPaid = null;
    }
    Object.assign(loan, next);
    return this.loansRepository.save(loan);
  }

  async remove(id: string): Promise<void> {
    const result = await this.loansRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Loan ${id} not found`);
    }
  }
}
