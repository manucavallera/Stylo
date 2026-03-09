import { Type } from 'class-transformer';
import {
    IsString,
    IsArray,
    ValidateNested,
    IsInt,
    IsBoolean,
    IsOptional,
    IsNumber,
    IsPositive,
    Min,
    ArrayMinSize,
} from 'class-validator';

enum EstadoPrenda {
    DISPONIBLE = 'DISPONIBLE',
    FALLA = 'FALLA',
}

// Cada ítem del desglose al abrir el fardo
export class ItemAperturaDto {
    @IsString()
    categoriaId: string;

    @IsString()
    talleId: string;

    @IsInt()
    @Min(1)
    cantidad: number;

    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    precioVenta: number;

    @IsBoolean()
    @IsOptional()
    tieneFalla?: boolean;

    @IsString()
    @IsOptional()
    descripcionFalla?: string;
}

// Body para abrir un fardo: se envía el desglose completo
export class AbrirFardoDto {
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => ItemAperturaDto)
    items: ItemAperturaDto[];
}
