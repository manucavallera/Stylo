'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { GlobalSearch } from '@/components/GlobalSearch'

const navItems = [
    { href: '/dashboard', icon: '📊', label: 'Dashboard' },
    { href: '/fardos', icon: '📦', label: 'Fardos' },
    { href: '/prendas', icon: '👕', label: 'Prendas' },
    { href: '/reservas', icon: '🔒', label: 'Reservas' },
    { href: '/pos', icon: '🛒', label: 'POS' },
    { href: '/caja', icon: '💰', label: 'Caja' },
    { href: '/clientes', icon: '👤', label: 'Clientes' },
    { href: '/configuracion', icon: '⚙️', label: 'Config' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()

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
                                <span className="text-base">{item.icon}</span>
                                {item.label}
                            </Link>
                        )
                    })}
                </nav>

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
    )
}
