import { IsString, IsOptional, MinLength } from 'class-validator';

export class CreateProveedorDto {
    @IsString()
    @MinLength(2)
    nombre: string;

    @IsString()
    @IsOptional()
    telefono?: string;

    @IsString()
    @IsOptional()
    notas?: string;
}
