import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Redirigir //p/:id → /p/:id (QRs generados con FRONTEND_URL con trailing slash)
    if (pathname.startsWith('//p/')) {
        const corrected = pathname.replace(/^\/\//, '/')
        return NextResponse.redirect(new URL(corrected, request.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
