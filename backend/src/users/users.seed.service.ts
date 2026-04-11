import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User, UserRole } from './user.entity';

@Injectable()
export class UsersSeedService implements OnModuleInit {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async onModuleInit(): Promise<void> {
    const adminUsername = this.configService.getOrThrow<string>('ADMIN_USERNAME');
    const adminPassword = this.configService.getOrThrow<string>('ADMIN_PASSWORD');
    const adminFirstname =
      this.configService.getOrThrow<string>('ADMIN_FIRSTNAME');
    const adminLastname =
      this.configService.getOrThrow<string>('ADMIN_LASTNAME');

    const existingAdmin = await this.usersRepository.findOne({
      where: { username: adminUsername },
    });

    if (existingAdmin) {
      return;
    }

    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await this.usersRepository.save({
      username: adminUsername,
      password: passwordHash,
      firstname: adminFirstname,
      lastname: adminLastname,
      role: UserRole.ADMIN,
      enabled: true,
    });
  }
}
