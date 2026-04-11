import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async login(username: string, password: string) {
    const user = await this.usersService.findByUsername(username);

    if (!user || !(user.enabled ?? true)) {
      return null;
    }

    const valid = await this.usersService.verifyPassword(
      password,
      user.password,
    );
    if (!valid) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      firstname: user.firstname,
      lastname: user.lastname,
      role: user.role,
    };
  }
}
