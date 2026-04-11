import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type {
  CreateMemberInput,
  LipatanInput,
  UpdateMemberInput,
} from './members.service';
import { MembersService } from './members.service';

@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  findAll() {
    return this.membersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.membersService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateMemberInput) {
    return this.membersService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateMemberInput) {
    return this.membersService.update(id, body);
  }

  @Post(':id/lipatan')
  lipatan(@Param('id') id: string, @Body() body: LipatanInput) {
    return this.membersService.lipatan(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.membersService.remove(id);
  }
}
