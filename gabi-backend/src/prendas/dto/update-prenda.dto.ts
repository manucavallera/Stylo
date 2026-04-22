import {
    IsNumber,
    IsOptional,
    IsPositive,
    IsEnum,
    IsString,
} from 'class-validator';

export enum EstadoPrenda {
    DISPONIBLE = 'DISPONIBLE',
    RESERVADO = 'RESERVADO',
    VENDIDO = 'VENDIDO',
    RETIRADO = 'RETIRADO',
    FALLA = 'FALLA',
}

export class UpdatePrendaDto {
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @IsOptional()
    precioVenta?: number;

    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @IsOptional()
    precioPromocional?: number;

    @IsEnum(EstadoPrenda)
    @IsOptional()
    estado?: EstadoPrenda;

    @IsString()
    @IsOptional()
    descripcionFalla?: string;

    @IsString()
    @IsOptional()
    nota?: string;

    @IsString()
    @IsOptional()
    categoriaId?: string;

    @IsString()
    @IsOptional()
    talleId?: string;
}
