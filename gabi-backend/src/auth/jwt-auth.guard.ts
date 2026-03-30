import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createClient } from '@supabase/supabase-js';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    private supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    private cache = new Map<string, { user: any; exp: number }>();

    constructor(private reflector: Reflector) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) return true;

        const request = context.switchToHttp().getRequest();
        const authorization = request.headers.authorization;

        if (!authorization?.startsWith('Bearer ')) {
            throw new UnauthorizedException('Token no proporcionado');
        }

        const token = authorization.split(' ')[1];
        const now = Math.floor(Date.now() / 1000);

        // Servir desde cache si el token ya fue verificado y no expiró
        const cached = this.cache.get(token);
        if (cached && cached.exp > now) {
            request.user = cached.user;
            return true;
        }

        const {
            data: { user },
            error,
        } = await this.supabase.auth.getUser(token);

        if (error || !user) {
            throw new UnauthorizedException('Token inválido o expirado');
        }

        // Guardar en cache hasta que expire el token
        try {
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
            this.cache.set(token, { user, exp: payload.exp ?? now + 3600 });
        } catch {
            this.cache.set(token, { user, exp: now + 3600 });
        }

        request.user = user;
        return true;
    }
}
