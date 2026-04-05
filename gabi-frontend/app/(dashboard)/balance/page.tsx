'use client'

import { useEffect, useState, useCallback } from 'react'
import { ventasApi, type BalanceResult } from '@/lib/api'

const METODO_ICON: Record<string, string> = { EFECTIVO: '💵', MERCADOPAGO: '📱', TRANSFERENCIA: '🏦' }
const METODO_LABEL: Record<string, string> = { EFECTIVO: 'Efectivo', MERCADOPAGO: 'MercadoPago', TRANSFERENCIA: 'Transfer.' }

type Periodo = 'hoy' | 'ayer' | 'semana' | 'semana_ant' | 'mes' | 'mes_ant' | 'custom'

function fechasParaPeriodo(p: Periodo): { desde: string; hasta: string } {
    const hoy = new Date()
    const fmt = (d: Date) => d.toISOString().split('T')[0]

    if (p === 'hoy') return { desde: fmt(hoy), hasta: fmt(hoy) }

    if (p === 'ayer') {
        const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1)
        return { desde: fmt(ayer), hasta: fmt(ayer) }
    }
    if (p === 'semana') {
        const lunes = new Date(hoy)
        lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))
        return { desde: fmt(lunes), hasta: fmt(hoy) }
    }
    if (p === 'semana_ant') {
        const lunes = new Date(hoy)
        lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7) - 7)
        const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6)
        return { desde: fmt(lunes), hasta: fmt(domingo) }
    }
    if (p === 'mes') {
        const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
        return { desde: fmt(inicio), hasta: fmt(hoy) }
    }
    if (p === 'mes_ant') {
        const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
        const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
        return { desde: fmt(inicio), hasta: fmt(fin) }
    }
    return { desde: fmt(hoy), hasta: fmt(hoy) }
}

function periodoAnteriorEquivalente(desde: string, hasta: string) {
    const d = new Date(desde), h = new Date(hasta)
    const dias = Math.round((h.getTime() - d.getTime()) / 86400000) + 1
    const dAnt = new Date(d); dAnt.setDate(d.getDate() - dias)
    const hAnt = new Date(h); hAnt.setDate(h.getDate() - dias)
    const fmt = (x: Date) => x.toISOString().split('T')[0]
    return { desde: fmt(dAnt), hasta: fmt(hAnt) }
}

function exportarCSV(balance: BalanceResult, label: string) {
    const rows = [
        ['Fecha', 'Categoría', 'Talle', 'Cliente', 'Método', 'Precio', 'Costo'],
        ...balance.ventas.map(v => [
            new Date(v.fechaVenta).toLocaleDateString('es-AR'),
            v.prenda?.categoria?.nombre ?? '',
            v.prenda?.talle?.nombre ?? '',
            v.cliente?.nombre ?? '',
            v.metodoPago,
            Number(v.precioFinal).toFixed(2),
            '',
        ])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `balance-${label}.csv`; a.click()
    URL.revokeObjectURL(url)
}

export default function BalancePage() {
    const [periodo, setPeriodo] = useState<Periodo>('semana')
    const [customDesde, setCustomDesde] = useState('')
    const [customHasta, setCustomHasta] = useState('')
    const [balance, setBalance] = useState<BalanceResult | null>(null)
    const [comparacion, setComparacion] = useState<BalanceResult | null>(null)
    const [loading, setLoading] = useState(true)
    const [verVentas, setVerVentas] = useState(false)

    const { desde, hasta } = periodo === 'custom'
        ? { desde: customDesde, hasta: customHasta }
        : fechasParaPeriodo(periodo)

    const cargar = useCallback(async () => {
        if (!desde || !hasta) return
        setLoading(true)
        setBalance(null); setComparacion(null)
        const ant = periodoAnteriorEquivalente(desde, hasta)
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

    const labelPeriodo = {
        hoy: 'Hoy', ayer: 'Ayer', semana: 'Esta semana',
        semana_ant: 'Semana anterior', mes: 'Este mes', mes_ant: 'Mes anterior', custom: 'Personalizado'
    }[periodo]

    function delta(actual: number, anterior: number) {
        if (!anterior) return null
        const pct = ((actual - anterior) / anterior) * 100
        return { pct: Math.abs(pct).toFixed(0), positivo: pct >= 0 }
    }

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
                        <button
                            key={p}
                            onClick={() => setPeriodo(p)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase border transition-all ${periodo === p ? 'bg-orange-500 border-orange-500 text-black' : 'border-white/10 text-zinc-400 hover:border-white/20'}`}
                        >
                            {labelPeriodo && p === periodo ? labelPeriodo : ({ hoy: 'Hoy', ayer: 'Ayer', semana: 'Esta semana', semana_ant: 'Sem. ant.', mes: 'Este mes', mes_ant: 'Mes ant.' } as Record<string, string>)[p]}
                        </button>
                    ))}
                    <button
                        onClick={() => setPeriodo('custom')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase border transition-all ${periodo === 'custom' ? 'bg-orange-500 border-orange-500 text-black' : 'border-white/10 text-zinc-400 hover:border-white/20'}`}
                    >
                        Custom
                    </button>
                </div>

                {periodo === 'custom' && (
                    <div className="flex gap-2 items-center">
                        <input type="date" value={customDesde} onChange={e => setCustomDesde(e.target.value)} className="input flex-1 text-sm" />
                        <span className="text-zinc-600">→</span>
                        <input type="date" value={customHasta} onChange={e => setCustomHasta(e.target.value)} className="input flex-1 text-sm" />
                        <button onClick={cargar} disabled={!customDesde || !customHasta} className="px-4 py-2.5 bg-orange-500 text-black text-xs font-black uppercase rounded-xl hover:bg-orange-400 disabled:opacity-40">
                            Ver
                        </button>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-zinc-900 rounded-2xl animate-pulse" />)}
                </div>
            ) : !balance ? null : (
                <>
                    {/* KPIs principales */}
                    <div className="grid grid-cols-2 gap-3">
                        <KpiBalance
                            label="Total vendido"
                            valor={balance.totalVendido}
                            comparacion={comparacion ? delta(balance.totalVendido, comparacion.totalVendido) : null}
                            accent
                        />
                        <KpiBalance
                            label="Ganancia estimada"
                            valor={balance.gananciaEstimada}
                            comparacion={comparacion ? delta(balance.gananciaEstimada, comparacion.gananciaEstimada) : null}
                        />
                        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4">
                            <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-1">Ventas</p>
                            <p className="text-white text-2xl font-black">{balance.cantidadVentas}</p>
                            {comparacion && (
                                <p className="text-zinc-600 text-xs mt-1">ant: {comparacion.cantidadVentas}</p>
                            )}
                        </div>
                        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4">
                            <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-1">Ticket promedio</p>
                            <p className="text-white text-2xl font-black">
                                {balance.cantidadVentas > 0
                                    ? `$${Math.round(balance.totalVendido / balance.cantidadVentas).toLocaleString('es-AR')}`
                                    : '—'}
                            </p>
                            {comparacion && comparacion.cantidadVentas > 0 && (
                                <p className="text-zinc-600 text-xs mt-1">
                                    ant: ${Math.round(comparacion.totalVendido / comparacion.cantidadVentas).toLocaleString('es-AR')}
                                </p>
                            )}
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
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-zinc-400 text-sm">{METODO_ICON[m]} {METODO_LABEL[m]}</span>
                                            <div className="flex items-center gap-3">
                                                {comparacion && (
                                                    <span className="text-zinc-600 text-xs">ant: ${totalAnt.toLocaleString('es-AR')}</span>
                                                )}
                                                <span className={`font-black text-sm ${total > 0 ? 'text-white' : 'text-zinc-700'}`}>
                                                    ${total.toLocaleString('es-AR')}
                                                </span>
                                                <span className="text-zinc-600 text-xs w-8 text-right">{pct.toFixed(0)}%</span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-zinc-800 rounded-full h-1.5">
                                            <div
                                                className={`h-1.5 rounded-full transition-all ${m === 'EFECTIVO' ? 'bg-emerald-500' : m === 'MERCADOPAGO' ? 'bg-blue-500' : 'bg-purple-500'}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Comparación resumen */}
                    {comparacion && comparacion.cantidadVentas > 0 && (
                        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
                            <p className="text-zinc-500 text-xs uppercase tracking-widest font-black mb-3">vs período anterior</p>
                            <div className="grid grid-cols-3 gap-3 text-center">
                                {[
                                    { label: 'Vendido', actual: balance.totalVendido, anterior: comparacion.totalVendido, currency: true },
                                    { label: 'Ganancia', actual: balance.gananciaEstimada, anterior: comparacion.gananciaEstimada, currency: true },
                                    { label: 'Ventas', actual: balance.cantidadVentas, anterior: comparacion.cantidadVentas, currency: false },
                                ].map(({ label, actual, anterior, currency }) => {
                                    const d = delta(actual, anterior)
                                    return (
                                        <div key={label} className="bg-zinc-800 rounded-xl p-3">
                                            <p className="text-zinc-500 text-[10px] uppercase tracking-wide mb-1">{label}</p>
                                            {d && (
                                                <p className={`text-base font-black ${d.positivo ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {d.positivo ? '+' : '-'}{d.pct}%
                                                </p>
                                            )}
                                            <p className="text-zinc-500 text-[10px] mt-0.5">
                                                {currency ? `$${Number(anterior).toLocaleString('es-AR')}` : anterior}
                                            </p>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Lista de ventas + exportar */}
                    {balance.ventas.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <button
                                    onClick={() => setVerVentas(v => !v)}
                                    className="text-zinc-500 text-xs uppercase tracking-widest font-black hover:text-white transition-colors"
                                >
                                    {verVentas ? '▲' : '▼'} Detalle de ventas ({balance.ventas.length})
                                </button>
                                <button
                                    onClick={() => exportarCSV(balance, `${desde}-${hasta}`)}
                                    className="px-4 py-2 border border-white/10 text-zinc-400 text-xs font-black uppercase rounded-xl hover:border-orange-500/30 hover:text-orange-400 transition-colors"
                                >
                                    ↓ Exportar CSV
                                </button>
                            </div>

                            {verVentas && (
                                <VentasList ventas={balance.ventas} metodoIcon={METODO_ICON} />
                            )}
                        </div>
                    )}

                    {balance.cantidadVentas === 0 && (
                        <div className="text-center py-16 space-y-3">
                            <div className="text-4xl">📭</div>
                            <p className="text-white font-bold">Sin ventas en este período</p>
                            <p className="text-zinc-600 text-sm">Seleccioná otro rango de fechas o registrá ventas desde el POS</p>
                            <a href="/pos" className="inline-block mt-1 px-5 py-2.5 bg-orange-500 text-black font-black text-sm uppercase rounded-xl hover:bg-orange-400 transition-colors">
                                Ir al POS →
                            </a>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

function VentasList({ ventas, metodoIcon }: { ventas: any[]; metodoIcon: Record<string, string> }) {
    const LIMITE = 30
    const [verTodas, setVerTodas] = useState(false)
    const visibles = verTodas ? ventas : ventas.slice(0, LIMITE)

    return (
        <div className="space-y-2">
            {visibles.map((v: any) => (
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
                            {metodoIcon[v.metodoPago]} {new Date(v.fechaVenta).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                        </p>
                    </div>
                </div>
            ))}
            {ventas.length > LIMITE && (
                <button
                    onClick={() => setVerTodas(t => !t)}
                    className="w-full text-center text-zinc-600 text-xs font-bold uppercase py-2 hover:text-zinc-400 transition-colors"
                >
                    {verTodas ? '▲ Mostrar menos' : `▼ Ver todas (${ventas.length - LIMITE} más)`}
                </button>
            )}
        </div>
    )
}

function KpiBalance({ label, valor, comparacion, accent }: {
    label: string
    valor: number
    comparacion: { pct: string; positivo: boolean } | null
    accent?: boolean
}) {
    return (
        <div className={`rounded-2xl p-4 border ${accent ? 'bg-orange-500/10 border-orange-500/20' : 'bg-zinc-900 border-white/5'}`}>
            <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-1">{label}</p>
            <p className={`text-2xl font-black ${accent ? 'text-orange-400' : 'text-white'}`}>
                ${Number(valor).toLocaleString('es-AR')}
            </p>
            {comparacion && (
                <p className={`text-xs font-bold mt-1 ${comparacion.positivo ? 'text-emerald-400' : 'text-red-400'}`}>
                    {comparacion.positivo ? '↑' : '↓'} {comparacion.pct}% vs anterior
                </p>
            )}
        </div>
    )
}
