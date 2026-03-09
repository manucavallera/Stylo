'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const router = useRouter()
    const supabase = createClient()

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError('')
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
            setError('Email o contraseña incorrectos')
            setLoading(false)
            return
        }
        router.push('/')
        router.refresh()
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#080808]">

            {/* ── Fondo: grid diagonal ── */}
            <div
                className="absolute inset-0 opacity-[0.07]"
                style={{
                    backgroundImage: `
            linear-gradient(45deg, #fff 1px, transparent 1px),
            linear-gradient(-45deg, #fff 1px, transparent 1px)
          `,
                    backgroundSize: '40px 40px',
                }}
            />

            {/* ── Glow naranja superior derecho ── */}
            <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-orange-500/20 blur-[100px] pointer-events-none" />
            {/* ── Glow naranja inferior izquierdo ── */}
            <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full bg-orange-600/10 blur-[80px] pointer-events-none" />

            {/* ── Líneas decorativas ── */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-60" />
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-30" />

            {/* ── Texto decorativo de fondo ── */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                <span className="text-[20vw] font-black text-white/[0.025] uppercase select-none tracking-tighter leading-none">
                    SSA
                </span>
            </div>

            {/* ── Contenido ── */}
            <div className="relative w-full max-w-md z-10">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-block mb-2">
                        <div className="text-5xl font-black tracking-tight text-white uppercase leading-none drop-shadow-[0_0_30px_rgba(249,115,22,0.4)]">
                            STREET <span className="text-orange-500">&</span> STYLO
                        </div>
                        <div className="text-2xl font-black tracking-widest text-orange-500 uppercase">
                            AMERICAN
                            <span className="ml-2 inline-block rotate-12 text-orange-400">★</span>
                        </div>
                    </div>
                    <p className="text-zinc-600 text-xs uppercase tracking-[0.3em] mt-2">Panel de Gestión</p>
                </div>

                {/* Card */}
                <div
                    className="rounded-2xl p-8 border border-white/10"
                    style={{ background: 'rgba(15,15,15,0.85)', backdropFilter: 'blur(20px)' }}
                >
                    <h2 className="text-white font-black text-base mb-6 uppercase tracking-widest">
                        Iniciar sesión
                    </h2>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-[10px] text-zinc-500 mb-1.5 uppercase tracking-[0.2em]">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition text-sm"
                                placeholder="gabi@streetstylo.com"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] text-zinc-500 mb-1.5 uppercase tracking-[0.2em]">Contraseña</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition text-sm"
                                placeholder="••••••••"
                            />
                        </div>

                        {error && (
                            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black uppercase tracking-[0.2em] transition-all duration-200 text-sm shadow-[0_0_30px_rgba(249,115,22,0.3)] hover:shadow-[0_0_40px_rgba(249,115,22,0.5)] active:scale-[0.98]"
                        >
                            {loading ? 'Ingresando...' : '★  Ingresar'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
