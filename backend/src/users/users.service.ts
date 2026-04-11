import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Not, Repository } from 'typeorm';
import { capitalizeWords } from '../common/text-case.util';
import { User, UserRole } from './user.entity';

const BCRYPT_ROUNDS = 10;

export type PublicUser = {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  role: UserRole;
  enabled: boolean;
};

export type CreateUserInput = {
  username: string;
  password: string;
  firstname: string;
  lastname: string;
  role: UserRole;
};

export type UpdateUserInput = {
  username?: string;
  firstname?: string;
  lastname?: string;
  role?: UserRole;
};

function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$/.test(value);
}

function toPublic(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    firstname: user.firstname,
    lastname: user.lastname,
    role: user.role,
    enabled: user.enabled,
  };
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  findAllPublic(): Promise<PublicUser[]> {
    return this.usersRepository
      .find({ order: { id: 'ASC' } })
      .then((rows) => rows.map(toPublic));
  }

  async verifyPassword(plain: string, stored: string): Promise<boolean> {
    if (isBcryptHash(stored)) {
      return bcrypt.compare(plain, stored);
    }
    return plain === stored;
  }

  private async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  }

  async create(input: CreateUserInput): Promise<PublicUser> {
    const taken = await this.usersRepository.findOne({
      where: { username: input.username.trim() },
    });
    if (taken) {
      throw new ConflictException('Username already exists');
    }
    const password = await this.hashPassword(input.password);
    const user = this.usersRepository.create({
      username: input.username.trim(),
      password,
      firstname: capitalizeWords(input.firstname),
      lastname: capitalizeWords(input.lastname),
      role: input.role,
      enabled: true,
    });
    const saved = await this.usersRepository.save(user);
    return toPublic(saved);
  }

  async update(id: number, input: UpdateUserInput): Promise<PublicUser> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (input.username !== undefined && input.username.trim() !== user.username) {
      const conflict = await this.usersRepository.findOne({
        where: { username: input.username.trim() },
      });
      if (conflict && conflict.id !== id) {
        throw new ConflictException('Username already exists');
      }
      user.username = input.username.trim();
    }
    if (input.firstname !== undefined) {
      user.firstname = capitalizeWords(input.firstname);
    }
    if (input.lastname !== undefined) {
      user.lastname = capitalizeWords(input.lastname);
    }
    if (input.role !== undefined) {
      if (user.role === UserRole.ADMIN && input.role === UserRole.STAFF) {
        const otherAdmins = await this.usersRepository.count({
          where: { role: UserRole.ADMIN, id: Not(id) },
        });
        if (otherAdmins === 0) {
          throw new BadRequestException('Cannot demote the only admin.');
        }
      }
      user.role = input.role;
    }
    const saved = await this.usersRepository.save(user);
    return toPublic(saved);
  }

  async setPassword(id: number, plainPassword: string): Promise<PublicUser> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.password = await this.hashPassword(plainPassword);
    const saved = await this.usersRepository.save(user);
    return toPublic(saved);
  }

  async setEnabled(id: number, enabled: boolean): Promise<PublicUser> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!enabled && user.role === UserRole.ADMIN && user.enabled) {
      const otherActiveAdmins = await this.usersRepository.count({
        where: { role: UserRole.ADMIN, enabled: true, id: Not(id) },
      });
      if (otherActiveAdmins === 0) {
        throw new BadRequestException('Cannot disable the only active admin.');
      }
    }
    user.enabled = enabled;
    const saved = await this.usersRepository.save(user);
    return toPublic(saved);
  }

  async remove(id: number): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role === UserRole.ADMIN) {
      const otherAdmins = await this.usersRepository.count({
        where: { role: UserRole.ADMIN, id: Not(id) },
      });
      if (otherAdmins === 0) {
        throw new BadRequestException('Cannot delete the only admin.');
      }
    }
    await this.usersRepository.remove(user);
  }
}
