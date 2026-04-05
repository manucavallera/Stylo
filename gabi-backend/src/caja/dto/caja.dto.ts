import { IsEnum, IsNumber, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

export class AbrirCajaDto {
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    montoApertura: number; // cuánta plata había en la caja al abrir
}

export class CerrarCajaDto {
    @IsNumber({ maxDecimalPlaces: 2 })
    montoReal: number;
}

export class RegistrarGastoDto {
    @IsString()
    @MinLength(1)
    concepto: string;

    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    monto: number;

    @IsEnum(['GASTO', 'RETIRO'])
    @IsOptional()
    tipo?: 'GASTO' | 'RETIRO';
}
