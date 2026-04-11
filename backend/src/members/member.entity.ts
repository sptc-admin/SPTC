import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type MemberFullNameJson = {
  first: string;
  middle: string;
  last: string;
  suffix: string;
};

export type MemberAddressJson = {
  province: string;
  city: string;
  barangay: string;
  line: string;
};

export type MemberFinancialsJson = {
  loan: number;
  savings: number;
  arkilahan: number;
  butawHulog: number;
  lipatan: number;
  shareCapital: number;
};

export type LipatanHistoryEntryJson = {
  transferredAt: string;
  fromOperatorName: string;
  toOperatorName: string;
  shareCapitalDeducted: number;
  /** Uploaded lipatan document (PDF or image URL). */
  documentUrl: string;
  previousPersonal: {
    fullName: MemberFullNameJson;
    birthday: string;
    address: MemberAddressJson;
    contactMobile10: string;
    tinDigits: string;
    /** Prior operator precinct before this transfer (optional on legacy rows). */
    precinctNumber?: string;
  };
};

@Entity('members')
export class Member {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  bodyNumber: string;

  @Column({ type: 'varchar', length: 120 })
  precinctNumber: string;

  @Column({ type: 'json' })
  fullName: MemberFullNameJson;

  @Column({ type: 'varchar', length: 10 })
  birthday: string;

  @Column({ type: 'json' })
  address: MemberAddressJson;

  @Column({ type: 'varchar', length: 10 })
  contactMobile10: string;

  @Column({ type: 'varchar', length: 12 })
  tinDigits: string;

  @Column({ type: 'text' })
  profileImageSrc: string;

  @Column({ type: 'json' })
  financials: MemberFinancialsJson;

  /** Prior operators for this franchise (body); personal snapshots + outgoing member id. */
  @Column({ type: 'json', nullable: true })
  lipatanHistory: LipatanHistoryEntryJson[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
