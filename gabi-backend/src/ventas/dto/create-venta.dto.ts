import { IsString, IsNumber, IsPositive, IsEnum, IsOptional } from 'class-validator';

export enum MetodoPago {
    EFECTIVO = 'EFECTIVO',
    MERCADOPAGO = 'MERCADOPAGO',
    TRANSFERENCIA = 'TRANSFERENCIA',
}

export enum CanalVenta {
    LOCAL = 'LOCAL',
    ONLINE = 'ONLINE',
}

export class CreateVentaDto {
    @IsString()
    prendaId: string;

    @IsString()
    @IsOptional()
    reservaId?: string; // si viene de una reserva previa

    @IsString()
    @IsOptional()
    clienteId?: string;

    @IsString()
    @IsOptional()
    cajaId?: string; // obligatorio para ventas locales

    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    precioFinal: number;

    @IsEnum(MetodoPago)
    metodoPago: MetodoPago;

    @IsEnum(CanalVenta)
    canalVenta: CanalVenta;
}
