import { IsString, IsOptional, MinLength } from 'class-validator';

export class CreateCategoriaDto {
    @IsString()
    @MinLength(2)
    nombre: string;
}
