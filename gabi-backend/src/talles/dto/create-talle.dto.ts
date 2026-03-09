import { IsString, MinLength } from 'class-validator';

export class CreateTalleDto {
    @IsString()
    @MinLength(1)
    nombre: string;
}
