'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { GlobalSearch } from '@/components/GlobalSearch'
import { ToastProvider } from '@/components/Toast'

const navItems = [
    { href: '/dashboard', icon: '📊', label: 'Dashboard' },
    { href: '/fardos', icon: '📦', label: 'Fardos' },
    { href: '/prendas', icon: '👕', label: 'Prendas' },
    { href: '/reservas', icon: '🔒', label: 'Reservas' },
    { href: '/pos', icon: '🛒', label: 'POS', desc: 'Registrar venta' },
    { href: '/caja', icon: '💰', label: 'Caja', desc: 'Efectivo del día' },
    { href: '/balance', icon: '📈', label: 'Balance', desc: 'Resultados por período' },
    { href: '/clientes', icon: '👤', label: 'Clientes' },
    { href: '/configuracion', icon: '⚙️', label: 'Config' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [botStatus, setBotStatus] = useState<'ok' | 'error' | 'unknown'>('unknown')
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'
        fetch(`${API_URL}/health`)
            .then(r => r.json())
            .then(d => setBotStatus(d?.checks?.evolution?.status === 'ok' ? 'ok' : 'error'))
            .catch(() => setBotStatus('error'))
    }, [])

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) router.replace('/login')
        })
    }, []);

    async function handleLogout() {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    return (
    <ToastProvider>
        <div className="min-h-screen bg-black">
            {/* Header mobile */}
            <header className="md:hidden fixed top-0 left-0 right-0 z-20 bg-zinc-950 border-b border-white/5 flex items-center justify-between px-4 h-14">
                <button
                    onClick={() => setSidebarOpen(true)}
                    className="text-zinc-400 hover:text-white text-2xl leading-none"
                >
                    ☰
                </button>
                <span className="text-sm font-black text-white uppercase tracking-tight">
                    STREET <span className="text-orange-500">&</span> STYLO
                </span>
                <div className="w-8" />
            </header>

            {/* Overlay mobile */}
            {sidebarOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-black/70 z-30"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                w-64 bg-zinc-950 border-r border-white/5 flex flex-col fixed h-full z-40
                transition-transform duration-200 ease-in-out
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                md:translate-x-0
            `}>
                {/* Logo */}
                <div className="p-5 border-b border-white/5 flex items-start justify-between">
                    <div>
                        <div className="text-xl font-black tracking-tight text-white uppercase leading-none">
                            STREET <span className="text-orange-500">&</span> STYLO
                        </div>
                        <div className="text-xs font-black tracking-widest text-orange-500 uppercase">
                            AMERICAN ★
                        </div>
                        <p className="text-zinc-600 text-[10px] uppercase tracking-widest mt-0.5">Panel de Gestión</p>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="md:hidden text-zinc-500 hover:text-white text-xl leading-none mt-1"
                    >
                        ✕
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
                    {navItems.map(item => {
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 uppercase tracking-wide ${isActive
                                    ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/20'
                                    : 'text-zinc-500 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                <span className="text-base shrink-0">{item.icon}</span>
                                <div className="min-w-0">
                                    <div>{item.label}</div>
                                    {(item as any).desc && (
                                        <div className={`text-[10px] font-normal normal-case tracking-normal leading-none mt-0.5 ${isActive ? 'text-black/60' : 'text-zinc-600'}`}>
                                            {(item as any).desc}
                                        </div>
                                    )}
                                </div>
                            </Link>
                        )
                    })}
                </nav>

                {/* Estado bot WhatsApp */}
                <div className="px-4 pb-2">
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${botStatus === 'ok' ? 'bg-emerald-500/5 border border-emerald-500/15' : botStatus === 'error' ? 'bg-red-500/5 border border-red-500/15' : 'bg-zinc-900 border border-white/5'}`}>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${botStatus === 'ok' ? 'bg-emerald-400' : botStatus === 'error' ? 'bg-red-400 animate-pulse' : 'bg-zinc-600'}`} />
                        <span className={`font-semibold uppercase tracking-wide ${botStatus === 'ok' ? 'text-emerald-400' : botStatus === 'error' ? 'text-red-400' : 'text-zinc-600'}`}>
                            {botStatus === 'ok' ? 'Bot conectado' : botStatus === 'error' ? 'Bot desconectado' : 'Verificando bot...'}
                        </span>
                    </div>
                </div>

                {/* Catálogo + Logout */}
                <div className="p-4 border-t border-white/5 space-y-0.5">
                    <Link
                        href="/catalogo"
                        target="_blank"
                        onClick={() => setSidebarOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-500 hover:text-white hover:bg-white/5 transition-all uppercase tracking-wide font-semibold"
                    >
                        <span>🌐</span> Ver Catálogo
                    </Link>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-500 hover:text-red-400 hover:bg-red-500/5 transition-all uppercase tracking-wide font-semibold"
                    >
                        <span>🚪</span> Salir
                    </button>
                </div>
            </aside>

            {/* Contenido principal */}
            <main className="md:ml-64 pt-14 md:pt-0 p-4 md:p-8 min-h-screen">
                <GlobalSearch />
                {children}
            </main>
        </div>
    </ToastProvider>
    )
}
