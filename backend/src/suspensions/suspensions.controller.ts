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
  CreateSuspensionInput,
  UpdateSuspensionInput,
} from './suspensions.service';
import { SuspensionsService } from './suspensions.service';

@Controller('suspensions')
export class SuspensionsController {
  constructor(private readonly suspensionsService: SuspensionsService) {}

  @Get()
  findAll() {
    return this.suspensionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.suspensionsService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateSuspensionInput) {
    return this.suspensionsService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateSuspensionInput) {
    return this.suspensionsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.suspensionsService.remove(id);
  }
}
