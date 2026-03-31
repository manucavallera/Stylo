import { Controller, Get, Put, Body } from '@nestjs/common';
import { ConfiguracionService } from './configuracion.service';

@Controller('configuracion')
export class ConfiguracionController {
    constructor(private readonly configuracionService: ConfiguracionService) { }

    @Get()
    getConfig() {
        return this.configuracionService.getConfig();
    }

    @Put()
    updateConfig(@Body() body: { minutosReserva?: number }) {
        return this.configuracionService.updateConfig(body);
    }
}
