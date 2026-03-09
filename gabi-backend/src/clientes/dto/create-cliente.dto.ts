import { IsString, IsOptional } from 'class-validator';

export class CreateClienteDto {
    @IsString()
    nombre: string;

    @IsString()
    @IsOptional()
    telefonoWhatsapp?: string;

    @IsString()
    @IsOptional()
    notas?: string;
}
