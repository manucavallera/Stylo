import {
    IsString,
    IsOptional,
    IsNumber,
    IsEnum,
    IsDateString,
    IsPositive,
    IsInt,
    Min,
} from 'class-validator';

export enum Moneda {
    ARS = 'ARS',
    USD = 'USD',
}

export class CreateFardoDto {
    @IsString()
    proveedorId: string;

    @IsDateString()
    fechaCompra: string;

    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    costoTotal: number;

    @IsEnum(Moneda)
    moneda: Moneda;

    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @IsOptional()
    pesoKg?: number;

    @IsString()
    @IsOptional()
    notas?: string;
}
