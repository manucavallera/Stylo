'use client'

import { useEffect, useState } from 'react'
import { ventasApi, cajaApi, reservasApi, type ResumenHoy, type Caja } from '@/lib/api'

export default function DashboardPage() {
    const [resumen, setResumen] = useState<ResumenHoy | null>(null)
    const [caja, setCaja] = useState<Caja | null>(null)
    const [reservasCount, setReservasCount] = useState(0)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function cargar() {
            try {
                const [res, caj, res2] = await Promise.allSettled([
                    ventasApi.resumenHoy(),
                    cajaApi.hoy(),
                    reservasApi.activas(),
                ])
                if (res.status === 'fulfilled') setResumen(res.value)
                if (caj.status === 'fulfilled') setCaja(caj.value)
                if (res2.status === 'fulfilled') setReservasCount(res2.value.length)
            } finally {
                setLoading(false)
            }
        }
        cargar()
    }, [])

    const hoy = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="border-b border-white/5 pb-4">
                <p className="text-zinc-500 text-xs uppercase tracking-widest mb-0.5">Bienvenida</p>
                <h1 className="text-2xl font-black text-white uppercase capitalize">{hoy}</h1>
                <p className="text-orange-500 text-xs uppercase tracking-widest font-bold mt-0.5">★ Street & Stylo American</p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Vendido hoy" value={resumen ? `$${resumen.totalVendido.toLocaleString('es-AR')}` : '—'} sub={`${resumen?.cantidadVentas ?? 0} ventas`} accent loading={loading} icon="💸" />
                <KpiCard label="Ganancia estimada" value={resumen ? `$${resumen.gananciaEstimada.toLocaleString('es-AR')}` : '—'} sub="precio − costo" loading={loading} icon="📈" />
                <KpiCard label="Reservas activas" value={String(reservasCount)} sub="esperando pago" loading={loading} icon="🔒" />
                <KpiCard
                    label="Caja"
                    value={caja ? (caja.estado === 'ABIERTA' ? '✓ Abierta' : 'Cerrada') : 'Sin abrir'}
                    sub={caja ? `$${Number(caja.montoApertura).toLocaleString('es-AR')} de apertura` : '—'}
                    loading={loading}
                    icon="💰"
                    accent={caja?.estado === 'ABIERTA'}
                />
            </div>

            {/* Por método de pago */}
            {resumen && resumen.porMetodoPago.length > 0 && (
                <div className="bg-zinc-900 border border-white/5 rounded-2xl p-6">
                    <h2 className="text-white font-black uppercase tracking-wide text-sm mb-4">Ventas por método de pago</h2>
                    <div className="grid grid-cols-3 gap-4">
                        {resumen.porMetodoPago.map(m => (
                            <div key={m.metodoPago} className="bg-zinc-800 rounded-xl p-4">
                                <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">{m.metodoPago}</p>
                                <p className="text-white text-xl font-black">${Number(m._sum.precioFinal).toLocaleString('es-AR')}</p>
                                <p className="text-zinc-600 text-xs mt-0.5">{m._count} ventas</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Accesos rápidos */}
            <div className="bg-zinc-900 border border-white/5 rounded-2xl p-6">
                <h2 className="text-white font-black uppercase tracking-wide text-sm mb-4">Accesos rápidos</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                        { href: '/pos', icon: '🛒', label: 'Nueva venta', desc: 'POS rápido' },
                        { href: '/prendas', icon: '👕', label: 'Ver prendas', desc: 'Stock disponible' },
                        { href: '/reservas', icon: '🔒', label: 'Reservas', desc: 'Gestionar activas' },
                        { href: '/fardos', icon: '📦', label: 'Fardos', desc: 'Abrir / registrar' },
                        { href: '/caja', icon: '💰', label: 'Caja del día', desc: 'Abrir / cerrar' },
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
