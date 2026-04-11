import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type DriverFullNameJson = {
  first: string;
  middle: string;
  last: string;
  suffix: string;
};

export type DriverAddressJson = {
  province: string;
  city: string;
  barangay: string;
  line: string;
};

@Entity('drivers')
export class Driver {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  bodyNumber: string;

  @Column({ type: 'varchar', length: 120 })
  precinctNumber: string;

  @Column({ type: 'json' })
  fullName: DriverFullNameJson;

  @Column({ type: 'varchar', length: 10 })
  birthday: string;

  @Column({ type: 'json' })
  address: DriverAddressJson;

  @Column({ type: 'varchar', length: 10 })
  contactMobile10: string;

  @Column({ type: 'varchar', length: 12 })
  tinDigits: string;

  @Column({ type: 'text' })
  profileImageSrc: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
