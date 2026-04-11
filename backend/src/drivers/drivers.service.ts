import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { capitalizeFullName } from '../common/text-case.util';
import {
  getBodyNumberFormatError,
  normalizeBodyNumber,
} from '../members/body-number.util';
import {
  getMemberFullNameFormatError,
  normalizeMemberFullNameParts,
} from '../members/member-name.util';
import { Member } from '../members/member.entity';
import { Driver } from './driver.entity';

export type CreateDriverInput = {
  bodyNumber: string;
  precinctNumber: string;
  fullName: Driver['fullName'];
  birthday: string;
  address: Driver['address'];
  contactMobile10: string;
  tinDigits: string;
  profileImageSrc: string;
};

export type UpdateDriverInput = Partial<CreateDriverInput>;

@Injectable()
export class DriversService {
  constructor(
    @InjectRepository(Driver)
    private readonly driversRepository: Repository<Driver>,
    @InjectRepository(Member)
    private readonly membersRepository: Repository<Member>,
  ) {}

  findAll(): Promise<Driver[]> {
    return this.driversRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Driver> {
    const driver = await this.driversRepository.findOne({ where: { id } });
    if (!driver) {
      throw new NotFoundException(`Driver ${id} not found`);
    }
    return driver;
  }

  private async assertBodyNumberMatchesMember(
    normalizedBody: string,
  ): Promise<void> {
    const key = normalizedBody.toLowerCase();
    const rows = await this.membersRepository.find({
      select: ['id', 'bodyNumber'],
    });
    const ok = rows.some(
      (m) => normalizeBodyNumber(m.bodyNumber).toLowerCase() === key,
    );
    if (!ok) {
      throw new BadRequestException(
        'Body # must match an existing member’s Body #.',
      );
    }
  }

  async create(data: CreateDriverInput): Promise<Driver> {
    const bodyFmt = getBodyNumberFormatError(data.bodyNumber);
    if (bodyFmt) throw new BadRequestException(bodyFmt);
    const bodyNumber = normalizeBodyNumber(data.bodyNumber);
    const precinct =
      typeof data.precinctNumber === 'string' ? data.precinctNumber.trim() : '';
    if (!precinct) {
      throw new BadRequestException('Precinct number is required.');
    }
    await this.assertBodyNumberMatchesMember(bodyNumber);
    const nameErr = getMemberFullNameFormatError(data.fullName);
    if (nameErr) throw new BadRequestException(nameErr);
    const nameParts = normalizeMemberFullNameParts(data.fullName);
    const entity = this.driversRepository.create({
      ...data,
      bodyNumber,
      precinctNumber: precinct,
      fullName: capitalizeFullName(nameParts),
    });
    return this.driversRepository.save(entity);
  }

  async update(id: string, data: UpdateDriverInput): Promise<Driver> {
    const driver = await this.findOne(id);
    if (data.bodyNumber !== undefined) {
      const bodyFmt = getBodyNumberFormatError(data.bodyNumber);
      if (bodyFmt) throw new BadRequestException(bodyFmt);
      const bodyNumber = normalizeBodyNumber(data.bodyNumber);
      await this.assertBodyNumberMatchesMember(bodyNumber);
      driver.bodyNumber = bodyNumber;
    }
    if (data.precinctNumber !== undefined) {
      const p =
        typeof data.precinctNumber === 'string' ? data.precinctNumber.trim() : '';
      if (!p) throw new BadRequestException('Precinct number is required.');
      driver.precinctNumber = p;
    }
    const next: UpdateDriverInput = { ...data };
    delete (next as { bodyNumber?: string }).bodyNumber;
    delete (next as { precinctNumber?: string }).precinctNumber;
    if (data.fullName !== undefined) {
      const nameErr = getMemberFullNameFormatError(data.fullName);
      if (nameErr) throw new BadRequestException(nameErr);
      const nameParts = normalizeMemberFullNameParts(data.fullName);
      next.fullName = capitalizeFullName(nameParts);
    }
    Object.assign(driver, next);
    return this.driversRepository.save(driver);
  }

  async remove(id: string): Promise<void> {
    const result = await this.driversRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Driver ${id} not found`);
    }
  }
}
