'use client'

import { useEffect, useState } from 'react'
import { ventasApi, cajaApi, reservasApi, prendasApi, type ResumenHoy, type Caja } from '@/lib/api'

export default function DashboardPage() {
    const [resumen, setResumen] = useState<ResumenHoy | null>(null)
    const [caja, setCaja] = useState<Caja | null>(null)
    const [reservasCount, setReservasCount] = useState(0)
    const [stats, setStats] = useState<{ disponibles: number; reservadas: number; sinFoto: number } | null>(null)
    const [huerfanasCount, setHuerfanasCount] = useState(0)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function cargar() {
            const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
            const [res, caj, reservas, st, huerfanas] = await Promise.allSettled([
                ventasApi.resumenHoy(),
                cajaApi.hoy(),
                reservasApi.activas(),
                prendasApi.stats(),
                ventasApi.huerfanas(),
            ])
            if (res.status === 'fulfilled') setResumen(res.value)
            if (caj.status === 'fulfilled') setCaja(caj.value)
            if (reservas.status === 'fulfilled') setReservasCount(reservas.value.length)
            if (st.status === 'fulfilled') setStats(st.value)
            if (huerfanas.status === 'fulfilled') {
                const pasadas = huerfanas.value.items.filter((v: any) => new Date(v.fechaVenta) < hoy)
                setHuerfanasCount(pasadas.length)
            }
            setLoading(false)
        }
        cargar()
    }, [])

    const hoy = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

    return (
        <div className="space-y-6">
            <div className="border-b border-white/5 pb-4">
                <p className="text-zinc-500 text-xs uppercase tracking-widest mb-0.5">Bienvenida</p>
                <h1 className="text-2xl font-black text-white uppercase capitalize">{hoy}</h1>
                <p className="text-orange-500 text-xs uppercase tracking-widest font-bold mt-0.5">★ Street & Stylo American</p>
            </div>

            {/* Alerta ventas sin caja */}
            {huerfanasCount > 0 && (
                <a href="/caja" className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 hover:bg-amber-500/15 transition-colors">
                    <span className="text-amber-400 text-lg shrink-0">⚠</span>
                    <p className="text-amber-400 text-sm font-bold">
                        {huerfanasCount} venta{huerfanasCount !== 1 ? 's' : ''} de días anteriores sin caja asignada
                    </p>
                    <span className="ml-auto text-amber-400/60 text-xs">Ver →</span>
                </a>
            )}

            {/* KPIs ventas */}
            <div className="grid grid-cols-2 gap-4">
                <KpiCard
                    label="Vendido hoy"
                    value={resumen ? `$${Number(resumen.totalVendido).toLocaleString('es-AR')}` : '—'}
                    sub={`${resumen?.cantidadVentas ?? 0} venta${(resumen?.cantidadVentas ?? 0) !== 1 ? 's' : ''}`}
                    accent loading={loading} icon="💸"
                />
                <KpiCard
                    label="Ganancia estimada"
                    value={resumen ? `$${Number(resumen.gananciaEstimada).toLocaleString('es-AR')}` : '—'}
                    sub="precio − costo"
                    loading={loading} icon="📈"
                />
                <KpiCard
                    label="Reservas activas"
                    value={String(reservasCount)}
                    sub="esperando pago"
                    loading={loading} icon="🔒"
                    accent={reservasCount > 0}
                />
                <KpiCard
                    label="Caja"
                    value={caja ? (caja.estado === 'ABIERTA' ? '✓ Abierta' : 'Cerrada') : 'Sin abrir'}
                    sub={caja ? `$${Number(caja.montoApertura).toLocaleString('es-AR')} de apertura` : '—'}
                    loading={loading} icon="💰"
                    accent={caja?.estado === 'ABIERTA'}
                />
            </div>

            {/* KPIs stock */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 text-center">
                    <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-1">Disponibles</p>
                    {loading ? (
                        <div className="h-7 w-12 bg-zinc-800 rounded animate-pulse mx-auto" />
                    ) : (
                        <p className="text-emerald-400 text-2xl font-black">{stats?.disponibles ?? '—'}</p>
                    )}
                    <p className="text-zinc-600 text-xs mt-0.5">para vender</p>
                </div>
                <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 text-center">
                    <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-1">Reservadas</p>
                    {loading ? (
                        <div className="h-7 w-12 bg-zinc-800 rounded animate-pulse mx-auto" />
                    ) : (
                        <p className="text-amber-400 text-2xl font-black">{stats?.reservadas ?? '—'}</p>
                    )}
                    <p className="text-zinc-600 text-xs mt-0.5">en espera</p>
                </div>
                <div className={`border rounded-2xl p-4 text-center ${(stats?.sinFoto ?? 0) > 0 ? 'bg-red-500/5 border-red-500/20' : 'bg-zinc-900 border-white/5'}`}>
                    <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-1">Sin foto</p>
                    {loading ? (
                        <div className="h-7 w-12 bg-zinc-800 rounded animate-pulse mx-auto" />
                    ) : (
                        <p className={`text-2xl font-black ${(stats?.sinFoto ?? 0) > 0 ? 'text-red-400' : 'text-zinc-600'}`}>{stats?.sinFoto ?? '—'}</p>
                    )}
                    <p className="text-zinc-600 text-xs mt-0.5">disponibles</p>
                </div>
            </div>

            {/* Por método de pago */}
            {resumen && resumen.porMetodoPago.length > 0 && (
                <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
                    <h2 className="text-white font-black uppercase tracking-wide text-sm mb-4">Por método de pago</h2>
                    <div className="grid grid-cols-3 gap-3">
                        {(['EFECTIVO', 'MERCADOPAGO', 'TRANSFERENCIA'] as const).map(m => {
                            const dato = resumen.porMetodoPago.find(p => p.metodoPago === m)
                            const total = Number(dato?._sum?.precioFinal ?? 0)
                            const icon = m === 'EFECTIVO' ? '💵' : m === 'MERCADOPAGO' ? '📱' : '🏦'
                            const label = m === 'EFECTIVO' ? 'Efectivo' : m === 'MERCADOPAGO' ? 'MercadoPago' : 'Transfer.'
                            return (
                                <div key={m} className="bg-zinc-800 rounded-xl p-3 text-center">
                                    <p className="text-lg mb-1">{icon}</p>
                                    <p className={`font-black text-base ${total > 0 ? 'text-white' : 'text-zinc-700'}`}>
                                        ${total.toLocaleString('es-AR')}
                                    </p>
                                    <p className="text-zinc-500 text-[10px] uppercase tracking-wide mt-0.5">{label}</p>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Accesos rápidos */}
            <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
                <h2 className="text-white font-black uppercase tracking-wide text-sm mb-4">Accesos rápidos</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                        { href: '/pos', icon: '🛒', label: 'Nueva venta', desc: 'POS rápido' },
                        { href: '/prendas', icon: '👕', label: 'Ver prendas', desc: 'Stock disponible' },
                        { href: '/reservas', icon: '🔒', label: 'Reservas', desc: 'Gestionar activas' },
                        { href: '/fardos', icon: '📦', label: 'Fardos', desc: 'Abrir / registrar' },
                        { href: '/caja', icon: '💰', label: 'Caja del día', desc: 'Ventas y control' },
                        { href: '/catalogo', icon: '🌐', label: 'Catálogo', desc: 'Ver como cliente' },
                    ].map(item => (
                        <a key={item.href} href={item.href} className="flex items-start gap-3 p-4 rounded-xl bg-zinc-800 hover:bg-orange-500/10 hover:border-orange-500/30 border border-transparent transition-all group">
                            <span className="text-2xl">{item.icon}</span>
                            <div>
                                <p className="text-white text-sm font-bold uppercase tracking-wide group-hover:text-orange-400 transition-colors">{item.label}</p>
                                <p className="text-zinc-600 text-xs">{item.desc}</p>
                            </div>
                        </a>
                    ))}
                </div>
            </div>
        </div>
    )
}

function KpiCard({ label, value, sub, loading, icon, accent }: {
    label: string; value: string; sub: string; loading: boolean; icon: string; accent?: boolean
}) {
    return (
        <div className={`rounded-2xl p-5 border ${accent ? 'bg-orange-500/10 border-orange-500/20' : 'bg-zinc-900 border-white/5'}`}>
            <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{icon}</span>
            </div>
            <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-1">{label}</p>
            {loading ? (
                <div className="h-7 w-24 bg-zinc-800 rounded animate-pulse" />
            ) : (
                <p className={`text-2xl font-black ${accent ? 'text-orange-400' : 'text-white'}`}>{value}</p>
            )}
            <p className="text-zinc-600 text-xs mt-1">{sub}</p>
        </div>
    )
}
