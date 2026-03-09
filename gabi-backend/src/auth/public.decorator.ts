import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca un endpoint como público — no requiere autenticación JWT.
 * Usar en el catálogo web y en el endpoint de expiración de reservas (n8n).
 *
 * @example
 * @Public()
 * @Get('catalogo')
 * getCatalogo() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
