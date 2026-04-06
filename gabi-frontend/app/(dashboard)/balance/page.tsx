'use client'

import { useEffect, useState, useCallback } from 'react'
import { ventasApi, type BalanceResult, type Venta } from '@/lib/api'

const METODO_ICON: Record<string, string> = { EFECTIVO: '💵', MERCADOPAGO: '📱', TRANSFERENCIA: '🏦' }
const METODO_LABEL: Record<string, string> = { EFECTIVO: 'Efectivo', MERCADOPAGO: 'MercadoPago', TRANSFERENCIA: 'Transferencia' }
const METODO_COLOR: Record<string, string> = { EFECTIVO: 'bg-emerald-500', MERCADOPAGO: 'bg-blue-500', TRANSFERENCIA: 'bg-purple-500' }

type Periodo = 'hoy' | 'ayer' | 'semana' | 'semana_ant' | 'mes' | 'mes_ant' | 'custom'

const PERIODO_LABEL: Record<Periodo, string> = {
    hoy: 'Hoy', ayer: 'Ayer', semana: 'Esta semana',
    semana_ant: 'Sem. anterior', mes: 'Este mes', mes_ant: 'Mes anterior', custom: 'Personalizado'
}

function fechasParaPeriodo(p: Periodo): { desde: string; hasta: string } {
    const hoy = new Date()
    const fmt = (d: Date) => d.toISOString().split('T')[0]
    if (p === 'hoy') return { desde: fmt(hoy), hasta: fmt(hoy) }
    if (p === 'ayer') {
        const d = new Date(hoy); d.setDate(hoy.getDate() - 1)
        return { desde: fmt(d), hasta: fmt(d) }
    }
    if (p === 'semana') {
        const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))
        return { desde: fmt(lunes), hasta: fmt(hoy) }
    }
    if (p === 'semana_ant') {
        const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7) - 7)
        const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6)
        return { desde: fmt(lunes), hasta: fmt(domingo) }
    }
    if (p === 'mes') {
        return { desde: fmt(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: fmt(hoy) }
    }
    if (p === 'mes_ant') {
        const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
        const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
        return { desde: fmt(inicio), hasta: fmt(fin) }
    }
    return { desde: fmt(hoy), hasta: fmt(hoy) }
}

function periodoAnterior(desde: string, hasta: string) {
    const d = new Date(desde), h = new Date(hasta)
    const dias = Math.round((h.getTime() - d.getTime()) / 86400000) + 1
    const dAnt = new Date(d); dAnt.setDate(d.getDate() - dias)
    const hAnt = new Date(h); hAnt.setDate(h.getDate() - dias)
    const fmt = (x: Date) => x.toISOString().split('T')[0]
    return { desde: fmt(dAnt), hasta: fmt(hAnt) }
}

function fmtFecha(iso: string) {
    return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function delta(actual: number, anterior: number) {
    if (!anterior) return null
    const pct = ((actual - anterior) / anterior) * 100
    return { pct: Math.abs(pct).toFixed(0), positivo: pct >= 0 }
}

function exportarCSV(ventas: Venta[], label: string) {
    const rows = [
        ['Fecha', 'Categoría', 'Talle', 'Cliente', 'Método', 'Precio'],
        ...ventas.map(v => [
            new Date(v.fechaVenta).toLocaleDateString('es-AR'),
            v.prenda?.categoria?.nombre ?? '',
            v.prenda?.talle?.nombre ?? '',
            v.cliente?.nombre ?? '',
            v.metodoPago,
            Number(v.precioFinal).toFixed(2),
        ])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `ventas-${label}.csv`; a.click()
    URL.revokeObjectURL(url)
}

export default function BalancePage() {
    const [periodo, setPeriodo] = useState<Periodo>('semana')
    const [customDesde, setCustomDesde] = useState('')
    const [customHasta, setCustomHasta] = useState('')
    const [balance, setBalance] = useState<BalanceResult | null>(null)
    const [comparacion, setComparacion] = useState<BalanceResult | null>(null)
    const [loading, setLoading] = useState(true)

    // Detalle de ventas — lazy
    const [detalle, setDetalle] = useState<Venta[]>([])
    const [detalleTotal, setDetalleTotal] = useState(0)
    const [detalleSkip, setDetalleSkip] = useState(0)
    const [loadingDetalle, setLoadingDetalle] = useState(false)
    const [detalleAbierto, setDetalleAbierto] = useState(false)

    const { desde, hasta } = periodo === 'custom'
        ? { desde: customDesde, hasta: customHasta }
        : fechasParaPeriodo(periodo)

    const cargar = useCallback(async () => {
        if (!desde || !hasta) return
        setLoading(true)
        setBalance(null); setComparacion(null)
        setDetalle([]); setDetalleSkip(0); setDetalleAbierto(false)
        const ant = periodoAnterior(desde, hasta)
        const [bal, comp] = await Promise.allSettled([
            ventasApi.balance(desde, hasta),
            ventasApi.balance(ant.desde, ant.hasta),
        ])
        if (bal.status === 'fulfilled') setBalance(bal.value)
        if (comp.status === 'fulfilled') setComparacion(comp.value)
        setLoading(false)
    }, [desde, hasta])

    useEffect(() => {
        if (periodo !== 'custom') cargar()
    }, [periodo])

    async function abrirDetalle() {
        if (detalleAbierto) { setDetalleAbierto(false); return }
        setDetalleAbierto(true)
        if (detalle.length > 0) return
        setLoadingDetalle(true)
        const res = await ventasApi.balanceDetalle(desde, hasta, 0, 50)
        setDetalle(res.items)
        setDetalleTotal(res.total)
        setDetalleSkip(0)
        setLoadingDetalle(false)
    }

    async function cargarMasDetalle() {
        const nuevoSkip = detalleSkip + 50
        setLoadingDetalle(true)
        const res = await ventasApi.balanceDetalle(desde, hasta, nuevoSkip, 50)
        setDetalle(prev => [...prev, ...res.items])
        setDetalleSkip(nuevoSkip)
        setLoadingDetalle(false)
    }

    async function handleExportar() {
        // Para CSV descargamos todo
        setLoadingDetalle(true)
        const res = await ventasApi.balanceDetalle(desde, hasta, 0, 9999)
        exportarCSV(res.items, `${desde}-${hasta}`)
        setLoadingDetalle(false)
    }

    const rangoLabel = desde && hasta
        ? desde === hasta
            ? fmtFecha(desde)
            : `${fmtFecha(desde)} → ${fmtFecha(hasta)}`
        : ''

    return (
        <div className="space-y-6">
            <div className="border-b border-white/5 pb-4">
                <h1 className="text-2xl font-black text-white uppercase">Balance</h1>
                <p className="text-zinc-500 text-xs uppercase tracking-widest mt-0.5">Resumen financiero del negocio</p>
            </div>

            {/* Selector de período */}
            <div className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                    {(['hoy', 'ayer', 'semana', 'semana_ant', 'mes', 'mes_ant'] as Periodo[]).map(p => (
                        <button key={p} onClick={() => setPeriodo(p)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase border transition-all ${periodo === p ? 'bg-orange-500 border-orange-500 text-black' : 'border-white/10 text-zinc-400 hover:border-white/20'}`}>
                            {PERIODO_LABEL[p]}
                        </button>
                    ))}
                    <button onClick={() => setPeriodo('custom')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase border transition-all ${periodo === 'custom' ? 'bg-orange-500 border-orange-500 text-black' : 'border-white/10 text-zinc-400 hover:border-white/20'}`}>
                        Personalizado
                    </button>
                </div>

                {periodo === 'custom' ? (
                    <div className="flex gap-2 items-center">
                        <input type="date" value={customDesde} onChange={e => setCustomDesde(e.target.value)} className="input flex-1 text-sm" />
                        <span className="text-zinc-600">→</span>
                        <input type="date" value={customHasta} onChange={e => setCustomHasta(e.target.value)} className="input flex-1 text-sm" />
                        <button onClick={cargar} disabled={!customDesde || !customHasta}
                            className="px-4 py-2.5 bg-orange-500 text-black text-xs font-black uppercase rounded-xl hover:bg-orange-400 disabled:opacity-40">
                            Ver
                        </button>
                    </div>
                ) : rangoLabel ? (
                    <p className="text-zinc-600 text-xs">{rangoLabel}</p>
                ) : null}
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-zinc-900 rounded-2xl animate-pulse" />)}
                </div>
            ) : !balance ? null : balance.cantidadVentas === 0 ? (
                <div className="text-center py-16 space-y-3">
                    <div className="text-4xl">📭</div>
                    <p className="text-white font-bold">Sin ventas en este período</p>
                    <p className="text-zinc-600 text-sm">{rangoLabel}</p>
                    <a href="/pos" className="inline-block mt-1 px-5 py-2.5 bg-orange-500 text-black font-black text-sm uppercase rounded-xl hover:bg-orange-400 transition-colors">
                        Ir al POS →
                    </a>
                </div>
            ) : (
                <>
                    {/* KPIs principales */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* Total vendido */}
                        <div className="col-span-2 bg-orange-500/10 border border-orange-500/20 rounded-2xl p-5 flex items-center justify-between">
                            <div>
                                <p className="text-zinc-400 text-xs uppercase tracking-widest mb-1">Total vendido</p>
                                <p className="text-orange-400 text-3xl font-black">${balance.totalVendido.toLocaleString('es-AR')}</p>
                                {comparacion && comparacion.totalVendido > 0 && (() => {
                                    const d = delta(balance.totalVendido, comparacion.totalVendido)
                                    return d ? (
                                        <p className={`text-xs font-bold mt-1 ${d.positivo ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {d.positivo ? '↑' : '↓'} {d.pct}% vs período anterior
                                        </p>
                                    ) : null
                                })()}
                            </div>
                            <div className="text-right">
                                <p className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Ventas</p>
                                <p className="text-white text-3xl font-black">{balance.cantidadVentas}</p>
                                {comparacion && comparacion.cantidadVentas > 0 && (
                                    <p className="text-zinc-600 text-xs mt-1">ant: {comparacion.cantidadVentas}</p>
                                )}
                            </div>
                        </div>

                        {/* Ticket promedio */}
                        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4">
                            <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-1">Ticket promedio</p>
                            <p className="text-white text-xl font-black">
                                ${Math.round(balance.totalVendido / balance.cantidadVentas).toLocaleString('es-AR')}
                            </p>
                            {comparacion && comparacion.cantidadVentas > 0 && (
                                <p className="text-zinc-600 text-xs mt-1">
                                    ant: ${Math.round(comparacion.totalVendido / comparacion.cantidadVentas).toLocaleString('es-AR')}
                                </p>
                            )}
                        </div>

                        {/* Efectivo cobrado */}
                        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4">
                            <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-1">💵 Efectivo cobrado</p>
                            <p className="text-white text-xl font-black">
                                ${Number(balance.porMetodoPago.find(p => p.metodoPago === 'EFECTIVO')?._sum?.precioFinal ?? 0).toLocaleString('es-AR')}
                            </p>
                            <p className="text-zinc-600 text-xs mt-1">
                                {balance.porMetodoPago.find(p => p.metodoPago === 'EFECTIVO')?._count ?? 0} ventas
                            </p>
                        </div>
                    </div>

                    {/* Por método de pago */}
                    <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
                        <p className="text-zinc-500 text-xs uppercase tracking-widest font-black mb-4">Por método de pago</p>
                        <div className="space-y-3">
                            {(['EFECTIVO', 'MERCADOPAGO', 'TRANSFERENCIA'] as const).map(m => {
                                const dato = balance.porMetodoPago.find(p => p.metodoPago === m)
                                const total = Number(dato?._sum?.precioFinal ?? 0)
                                const pct = balance.totalVendido > 0 ? (total / balance.totalVendido) * 100 : 0
                                const datAnt = comparacion?.porMetodoPago.find(p => p.metodoPago === m)
                                const totalAnt = Number(datAnt?._sum?.precioFinal ?? 0)
                                return (
                                    <div key={m}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-zinc-400 text-sm">{METODO_ICON[m]} {METODO_LABEL[m]}</span>
                                            <div className="flex items-center gap-3">
                                                {comparacion && totalAnt > 0 && (
                                                    <span className="text-zinc-600 text-xs">ant: ${totalAnt.toLocaleString('es-AR')}</span>
                                                )}
                                                <span className={`font-black text-sm ${total > 0 ? 'text-white' : 'text-zinc-700'}`}>
                                                    ${total.toLocaleString('es-AR')}
                                                </span>
                                                <span className="text-zinc-600 text-xs w-8 text-right">{pct.toFixed(0)}%</span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-zinc-800 rounded-full h-1.5">
                                            <div className={`h-1.5 rounded-full transition-all ${METODO_COLOR[m]}`} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Por categoría */}
                    {balance.porCategoria.length > 0 && (
                        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
                            <p className="text-zinc-500 text-xs uppercase tracking-widest font-black mb-4">Por categoría</p>
                            <div className="space-y-2">
                                {balance.porCategoria.slice(0, 8).map(cat => {
                                    const pct = balance.totalVendido > 0 ? (cat.total / balance.totalVendido) * 100 : 0
                                    return (
                                        <div key={cat.nombre}>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-zinc-300 text-sm font-bold">{cat.nombre}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-zinc-600 text-xs">{cat.cantidad} u.</span>
                                                    <span className="text-white font-black text-sm">${cat.total.toLocaleString('es-AR')}</span>
                                                    <span className="text-zinc-600 text-xs w-8 text-right">{pct.toFixed(0)}%</span>
                                                </div>
                                            </div>
                                            <div className="w-full bg-zinc-800 rounded-full h-1">
                                                <div className="h-1 rounded-full bg-orange-500/60 transition-all" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    )
                                })}
                                {balance.porCategoria.length > 8 && (
                                    <p className="text-zinc-600 text-xs pt-1">+{balance.porCategoria.length - 8} categorías más</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Salidas (gastos + retiros) */}
                    {(balance.totalGastos > 0 || balance.totalRetiros > 0) && (
                        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5 space-y-3">
                            <p className="text-zinc-500 text-xs uppercase tracking-widest font-black">Salidas del período</p>
                            {balance.totalGastos > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-400 text-sm">Gastos</span>
                                    <span className="text-red-400 font-black">−${balance.totalGastos.toLocaleString('es-AR')}</span>
                                </div>
                            )}
                            {balance.totalRetiros > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-400 text-sm">Retiros</span>
                                    <span className="text-amber-400 font-black">−${balance.totalRetiros.toLocaleString('es-AR')}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center pt-2 border-t border-white/5">
                                <span className="text-zinc-300 text-sm font-bold">Neto estimado</span>
                                <span className={`font-black text-lg ${balance.totalVendido - balance.totalGastos - balance.totalRetiros >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    ${(balance.totalVendido - balance.totalGastos - balance.totalRetiros).toLocaleString('es-AR')}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Detalle de ventas — lazy */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <button onClick={abrirDetalle}
                                className="text-zinc-500 text-xs uppercase tracking-widest font-black hover:text-white transition-colors">
                                {detalleAbierto ? '▲' : '▼'} Detalle de ventas ({balance.cantidadVentas})
                            </button>
                            <button onClick={handleExportar} disabled={loadingDetalle}
                                className="px-4 py-2 border border-white/10 text-zinc-400 text-xs font-black uppercase rounded-xl hover:border-orange-500/30 hover:text-orange-400 transition-colors disabled:opacity-40">
                                {loadingDetalle ? '...' : '↓ Exportar CSV'}
                            </button>
                        </div>

                        {detalleAbierto && (
                            <div className="space-y-2">
                                {loadingDetalle && detalle.length === 0 ? (
                                    <div className="space-y-2">
                                        {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-zinc-900 rounded-xl animate-pulse" />)}
                                    </div>
                                ) : (
                                    <>
                                        {detalle.map(v => (
                                            <div key={v.id} className="flex items-center gap-3 bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5">
                                                {v.prenda?.fotos?.[0] ? (
                                                    <img src={v.prenda.fotos[0].url} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                                                ) : (
                                                    <span className="text-lg w-9 text-center shrink-0">👕</span>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-white text-sm font-bold truncate">{v.prenda?.categoria?.nombre}</p>
                                                    <p className="text-zinc-500 text-xs">
                                                        Talle {v.prenda?.talle?.nombre}
                                                        {v.cliente && <span> · {v.cliente.nombre}</span>}
                                                    </p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-white font-black text-sm">${Number(v.precioFinal).toLocaleString('es-AR')}</p>
                                                    <p className="text-zinc-500 text-xs">
                                                        {METODO_ICON[v.metodoPago]} {new Date(v.fechaVenta).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                        {detalle.length < detalleTotal && (
                                            <button onClick={cargarMasDetalle} disabled={loadingDetalle}
                                                className="w-full py-3 border border-white/10 text-zinc-400 text-sm font-bold uppercase rounded-xl hover:border-white/20 disabled:opacity-50">
                                                {loadingDetalle ? 'Cargando...' : `Ver más (${detalleTotal - detalle.length} restantes)`}
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
