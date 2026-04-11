import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { UserRole } from './user.entity';
import {
  type CreateUserInput,
  type UpdateUserInput,
  UsersService,
} from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAllPublic();
  }

  @Post()
  create(
    @Body()
    body: {
      username: string;
      password: string;
      firstname: string;
      lastname: string;
      role: UserRole;
    },
  ) {
    const input: CreateUserInput = {
      username: body.username,
      password: body.password,
      firstname: body.firstname,
      lastname: body.lastname,
      role: body.role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.STAFF,
    };
    return this.usersService.create(input);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      username?: string;
      firstname?: string;
      lastname?: string;
      role?: UserRole;
    },
  ) {
    const input: UpdateUserInput = {};
    if (body.username !== undefined) input.username = body.username;
    if (body.firstname !== undefined) input.firstname = body.firstname;
    if (body.lastname !== undefined) input.lastname = body.lastname;
    if (body.role !== undefined) {
      input.role =
        body.role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.STAFF;
    }
    return this.usersService.update(id, input);
  }

  @Patch(':id/password')
  setPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { password: string },
  ) {
    if (!body.password?.trim()) {
      throw new BadRequestException('Password is required');
    }
    return this.usersService.setPassword(id, body.password);
  }

  @Patch(':id/enabled')
  setEnabled(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { enabled: boolean },
  ) {
    return this.usersService.setEnabled(id, Boolean(body.enabled));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.usersService.remove(id);
  }
}
