import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateReservaDto {
    @IsString()
    prendaId: string;

    @IsString()
    clienteId: string;

    // Minutos hasta que expira la reserva (default: 20 min)
    @IsInt()
    @Min(5)
    @Max(1440) // máximo 24hs
    @IsOptional()
    minutosExpiracion?: number;
}

export class ReservaBotDto {
    @IsString()
    telefonoWhatsapp: string;

    @IsString()
    prendaId: string;

    @IsString()
    @IsOptional()
    nombreCliente?: string;
}

export class ConfirmarReservaDto {
    @IsString()
    @IsOptional()
    comprobanteUrl?: string; // URL de la foto del comprobante en Supabase Storage
}

export class ConfirmarPorBotDto {
    @IsString()
    telefonoWhatsapp: string;

    @IsString()
    @IsOptional()
    comprobanteUrl?: string;
}
