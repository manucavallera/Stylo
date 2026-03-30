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

        const {
            data: { user },
            error,
        } = await this.supabase.auth.getUser(token);

        if (error || !user) {
            throw new UnauthorizedException('Token inválido o expirado');
        }

        request.user = user;
        return true;
    }
}
