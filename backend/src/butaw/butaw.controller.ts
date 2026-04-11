import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import type { CreateButawDto } from './butaw.service';
import { ButawService } from './butaw.service';

@Controller('butaw')
export class ButawController {
  constructor(private readonly butawService: ButawService) {}

  @Get()
  findAll() {
    return this.butawService.findAll();
  }

  @Post()
  create(@Body() body: CreateButawDto) {
    return this.butawService.create(body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.butawService.remove(id);
  }
}
