import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { butawAmountToShareCapital } from '../butaw/butaw-split.util';
import { capitalizeFullName } from '../common/text-case.util';
import { ButawRecord } from '../butaw/butaw-record.entity';
import { Loan } from '../loans/loan.entity';
import { memberHasOutstandingLoan } from '../loans/loan-outstanding.util';
import { SavingsRecord } from '../savings/savings-record.entity';
import { LIPATAN_SHARE_CAPITAL_DEDUCTION } from './lipatan.constants';
import {
  getBodyNumberFormatError,
  normalizeBodyNumber,
} from './body-number.util';
import {
  getMemberFullNameFormatError,
  normalizeMemberFullNameParts,
} from './member-name.util';
import {
  LipatanHistoryEntryJson,
  Member,
  MemberFinancialsJson,
} from './member.entity';

export type CreateMemberInput = {
  bodyNumber: string;
  precinctNumber: string;
  fullName: Member['fullName'];
  birthday: string;
  address: Member['address'];
  contactMobile10: string;
  tinDigits: string;
  profileImageSrc: string;
  financials: Member['financials'];
};

export type UpdateMemberInput = Partial<CreateMemberInput>;

export type LipatanInput = {
  fullName: Member['fullName'];
  birthday: string;
  address: Member['address'];
  contactMobile10: string;
  tinDigits: string;
  profileImageSrc: string;
  precinctNumber: string;
  documentUrl?: string;
};

const defaultFinancials = (): MemberFinancialsJson => ({
  loan: 0,
  savings: 0,
  arkilahan: 0,
  butawHulog: 0,
  lipatan: 0,
  shareCapital: 0,
});

function normalizeFinancials(
  f: MemberFinancialsJson | null | undefined,
): MemberFinancialsJson {
  const d = defaultFinancials();
  if (!f || typeof f !== 'object') return { ...d };
  return {
    ...d,
    ...f,
    shareCapital:
      typeof f.shareCapital === 'number' && !Number.isNaN(f.shareCapital)
        ? f.shareCapital
        : 0,
  };
}

function displayNameFromMember(m: Member): string {
  return displayNameFromFullName(m.fullName);
}

function displayNameFromFullName(fn: Member['fullName']): string {
  const { first, last, suffix } = fn;
  const head = last.trim()
    ? `${last.trim()}, ${first.trim()}`.trim()
    : first.trim();
  const suf = suffix.trim();
  return suf ? `${head} ${suf}`.trim() : head || '—';
}

function normalizeMemberRow(m: Member): Member {
  m.financials = normalizeFinancials(m.financials);
  if (!Array.isArray(m.lipatanHistory)) {
    m.lipatanHistory = [];
  } else {
    m.lipatanHistory = m.lipatanHistory.map((e) => ({
      ...e,
      documentUrl:
        typeof e.documentUrl === 'string' ? e.documentUrl : '',
    }));
  }
  return m;
}

@Injectable()
export class MembersService {
  constructor(
    @InjectRepository(Member)
    private readonly membersRepository: Repository<Member>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<Member[]> {
    const rows = await this.membersRepository.find({
      order: { createdAt: 'DESC' },
    });
    return rows.map((m) => normalizeMemberRow(m));
  }

  async findOne(id: string): Promise<Member> {
    const member = await this.membersRepository.findOne({ where: { id } });
    if (!member) {
      throw new NotFoundException(`Member ${id} not found`);
    }
    return normalizeMemberRow(member);
  }

  private async assertBodyNumberUnique(
    normalizedBody: string,
    excludeMemberId: string | null,
  ): Promise<void> {
    const key = normalizedBody.toLowerCase();
    const rows = await this.membersRepository.find({
      select: ['id', 'bodyNumber'],
    });
    const clash = rows.find(
      (m) =>
        m.id !== excludeMemberId &&
        normalizeBodyNumber(m.bodyNumber).toLowerCase() === key,
    );
    if (clash) {
      throw new BadRequestException(
        'This Body # is already assigned to another member.',
      );
    }
  }

  async create(data: CreateMemberInput): Promise<Member> {
    const fmt = getBodyNumberFormatError(data.bodyNumber);
    if (fmt) throw new BadRequestException(fmt);
    const bodyNumber = normalizeBodyNumber(data.bodyNumber);
    await this.assertBodyNumberUnique(bodyNumber, null);
    const nameErr = getMemberFullNameFormatError(data.fullName);
    if (nameErr) throw new BadRequestException(nameErr);
    const nameParts = normalizeMemberFullNameParts(data.fullName);
    const normalizedName = capitalizeFullName(nameParts);
    const entity = this.membersRepository.create({
      ...data,
      bodyNumber,
      fullName: normalizedName,
      financials: normalizeFinancials(data.financials),
      lipatanHistory: [],
    });
    const saved = await this.membersRepository.save(entity);
    return normalizeMemberRow(saved);
  }

  async update(id: string, data: UpdateMemberInput): Promise<Member> {
    const member = await this.findOne(id);
    if (data.bodyNumber !== undefined) {
      const fmt = getBodyNumberFormatError(data.bodyNumber);
      if (fmt) throw new BadRequestException(fmt);
      const bodyNumber = normalizeBodyNumber(data.bodyNumber);
      await this.assertBodyNumberUnique(bodyNumber, id);
      member.bodyNumber = bodyNumber;
    }
    const next: Partial<Member> = { ...data };
    delete (next as { bodyNumber?: string }).bodyNumber;
    if (data.financials !== undefined) {
      next.financials = normalizeFinancials(data.financials);
    }
    if (data.fullName !== undefined) {
      const nameErr = getMemberFullNameFormatError(data.fullName);
      if (nameErr) throw new BadRequestException(nameErr);
      const nameParts = normalizeMemberFullNameParts(data.fullName);
      next.fullName = capitalizeFullName(nameParts);
    }
    Object.assign(member, next);
    const saved = await this.membersRepository.save(member);
    return normalizeMemberRow(saved);
  }

  async remove(id: string): Promise<void> {
    const result = await this.membersRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Member ${id} not found`);
    }
  }

  async lipatan(franchiseMemberId: string, dto: LipatanInput): Promise<Member> {
    return this.dataSource.transaction(async (manager) => {
      const franchiseRepo = manager.getRepository(Member);
      const franchise = await franchiseRepo.findOne({
        where: { id: franchiseMemberId },
      });
      if (!franchise) {
        throw new NotFoundException(`Member ${franchiseMemberId} not found`);
      }

      const loanRepo = manager.getRepository(Loan);
      const bodyLoans = await loanRepo.find({
        where: { memberId: franchiseMemberId },
      });
      if (memberHasOutstandingLoan(bodyLoans, franchiseMemberId)) {
        throw new BadRequestException(
          'Lipatan is not allowed while this body has an outstanding regular or emergency loan balance. Settle the loan first.',
        );
      }

      const nextPrecinct =
        typeof dto.precinctNumber === 'string' ? dto.precinctNumber.trim() : '';
      if (!nextPrecinct) {
        throw new BadRequestException('Precinct number is required.');
      }

      const fromOperatorName = displayNameFromMember(franchise);
      const lipatanNameErr = getMemberFullNameFormatError(dto.fullName);
      if (lipatanNameErr) throw new BadRequestException(lipatanNameErr);
      const lipatanNameParts = normalizeMemberFullNameParts(dto.fullName);
      const normalizedLipatanName = capitalizeFullName(lipatanNameParts);
      const toOperatorName = displayNameFromFullName(normalizedLipatanName);

      const butawRepo = manager.getRepository(ButawRecord);
      const butawRows = await butawRepo.find({
        where: { memberId: franchiseMemberId },
      });
      const shareCapitalFromButaw = butawRows.reduce(
        (sum, r) => sum + butawAmountToShareCapital(r.amount),
        0,
      );

      const priorHistory = Array.isArray(franchise.lipatanHistory)
        ? franchise.lipatanHistory
        : [];
      const priorDeductions = priorHistory.reduce(
        (sum, h) =>
          sum +
          (typeof h.shareCapitalDeducted === 'number' &&
          !Number.isNaN(h.shareCapitalDeducted)
            ? h.shareCapitalDeducted
            : LIPATAN_SHARE_CAPITAL_DEDUCTION),
        0,
      );
      const availableShareCapital = shareCapitalFromButaw - priorDeductions;
      if (availableShareCapital < LIPATAN_SHARE_CAPITAL_DEDUCTION) {
        throw new BadRequestException(
          `Insufficient share capital from Butaw financial records. Gross from Butaw: ₱${shareCapitalFromButaw.toFixed(2)}; already applied to lipatan: ₱${priorDeductions.toFixed(2)}; available: ₱${availableShareCapital.toFixed(2)} (need ₱${LIPATAN_SHARE_CAPITAL_DEDUCTION}).`,
        );
      }

      const fin = normalizeFinancials(franchise.financials);
      const newTotalDeductions =
        priorDeductions + LIPATAN_SHARE_CAPITAL_DEDUCTION;
      franchise.financials = {
        ...fin,
        loan: 0,
        savings: 0,
        shareCapital: shareCapitalFromButaw - newTotalDeductions,
      };

      const docUrl =
        typeof dto.documentUrl === 'string' ? dto.documentUrl.trim() : '';
      const historyEntry: LipatanHistoryEntryJson = {
        transferredAt: new Date().toISOString(),
        fromOperatorName,
        toOperatorName,
        shareCapitalDeducted: LIPATAN_SHARE_CAPITAL_DEDUCTION,
        documentUrl: docUrl,
        previousPersonal: {
          fullName: { ...franchise.fullName },
          birthday: franchise.birthday,
          address: { ...franchise.address },
          contactMobile10: franchise.contactMobile10,
          tinDigits: franchise.tinDigits,
          precinctNumber:
            typeof franchise.precinctNumber === 'string'
              ? franchise.precinctNumber.trim()
              : '',
        },
      };

      const hist = Array.isArray(franchise.lipatanHistory)
        ? [...franchise.lipatanHistory]
        : [];
      hist.push(historyEntry);

      franchise.fullName = { ...normalizedLipatanName };
      franchise.birthday = dto.birthday;
      franchise.address = { ...dto.address };
      franchise.contactMobile10 = dto.contactMobile10;
      franchise.tinDigits = dto.tinDigits;
      franchise.profileImageSrc = dto.profileImageSrc;
      franchise.precinctNumber = nextPrecinct;
      franchise.lipatanHistory = hist;

      const saved = await franchiseRepo.save(franchise);
      const savingsRepo = manager.getRepository(SavingsRecord);
      await butawRepo.delete({ memberId: franchiseMemberId });
      await savingsRepo.delete({ memberId: franchiseMemberId });
      await loanRepo.delete({ memberId: franchiseMemberId });
      return normalizeMemberRow(saved);
    });
  }
}
