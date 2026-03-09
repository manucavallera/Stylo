import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { TallesService } from './talles.service';
import { CreateTalleDto } from './dto/create-talle.dto';
import { UpdateTalleDto } from './dto/update-talle.dto';

@Controller('talles')
export class TallesController {
    constructor(private readonly tallesService: TallesService) { }

    @Post()
    create(@Body() dto: CreateTalleDto) {
        return this.tallesService.create(dto);
    }

    @Get()
    findAll() {
        return this.tallesService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.tallesService.findOne(id);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() dto: UpdateTalleDto) {
        return this.tallesService.update(id, dto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.tallesService.remove(id);
    }
}
