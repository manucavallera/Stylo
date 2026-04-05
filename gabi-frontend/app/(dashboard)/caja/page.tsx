'use client'

import { useEffect, useState, useCallback } from 'react'
import { cajaApi, ventasApi, type Caja, type GastoCaja, type Venta, type ResumenHoy } from '@/lib/api'
import { toast } from '@/components/Toast'

const METODO_LABEL: Record<string, string> = {
    EFECTIVO: 'Efectivo',
    MERCADOPAGO: 'MercadoPago',
    TRANSFERENCIA: 'Transferencia',
}
const METODO_ICON: Record<string, string> = {
    EFECTIVO: '💵',
    MERCADOPAGO: '📱',
    TRANSFERENCIA: '🏦',
}

export default function CajaPage() {
    const [resumen, setResumen] = useState<ResumenHoy | null>(null)
    const [ventas, setVentas] = useState<Venta[]>([])
    const [huerfanas, setHuerfanas] = useState<Venta[]>([])
    const [caja, setCaja] = useState<Caja | null>(null)
    const [sinCaja, setSinCaja] = useState(false)
    const [historial, setHistorial] = useState<Caja[]>([])
    const [loading, setLoading] = useState(true)
    const [anulando, setAnulando] = useState<string | null>(null)
    const [confirmAnular, setConfirmAnular] = useState<string | null>(null)
    const [modalAbrir, setModalAbrir] = useState(false)
    const [modalCerrar, setModalCerrar] = useState(false)
    const [modalGasto, setModalGasto] = useState(false)

    const cargar = useCallback(async () => {
        setLoading(true)
        const [resumenData, ventasData, huerfanasData] = await Promise.allSettled([
            ventasApi.resumenHoy(),
            ventasApi.hoy(),
            ventasApi.huerfanas(),
        ])
        if (resumenData.status === 'fulfilled') setResumen(resumenData.value)
        if (ventasData.status === 'fulfilled') setVentas(ventasData.value)
        if (huerfanasData.status === 'fulfilled') {
            // Solo las de días anteriores (hoy ya está en ventas)
            const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
            const pasadas = huerfanasData.value.filter(v => new Date(v.fechaVenta) < hoy)
            setHuerfanas(pasadas)
        }

        setSinCaja(false)
        try {
            const cajaData = await cajaApi.hoy()
            setCaja(cajaData)
        } catch {
            setSinCaja(true)
            setCaja(null)
        }

        try {
            const hist = await cajaApi.historial()
            setHistorial(hist.filter((c: Caja) => c.estado === 'CERRADA'))
        } catch {}

        setLoading(false)
    }, [])

    useEffect(() => { cargar() }, [cargar])

    async function handleAnular(id: string) {
        setAnulando(id)
        try {
            await ventasApi.anular(id)
            setConfirmAnular(null)
            toast('Venta anulada', 'warning')
            cargar()
        } catch (e: any) {
            toast(e.message || 'Error al anular', 'error')
        } finally {
            setAnulando(null)
        }
    }

    const hoy = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

    if (loading) return (
        <div className="space-y-4">
            <div className="h-8 w-48 bg-zinc-900 rounded animate-pulse" />
            <div className="h-32 bg-zinc-900 rounded-2xl animate-pulse" />
            <div className="h-48 bg-zinc-900 rounded-2xl animate-pulse" />
        </div>
    )

    return (
        <div className="space-y-6">
            <div className="border-b border-white/5 pb-4">
                <h1 className="text-2xl font-black text-white uppercase">Caja del Día</h1>
                <p className="text-zinc-500 text-xs uppercase tracking-widest mt-0.5 capitalize">{hoy}</p>
            </div>

            {/* ── Resumen del día — siempre visible ── */}
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 bg-zinc-900 border border-white/5 rounded-2xl p-5 flex items-center justify-between">
                        <div>
                            <p className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Total vendido hoy</p>
                            <p className="text-white text-3xl font-black">${Number(resumen?.totalVendido ?? 0).toLocaleString('es-AR')}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Ventas</p>
                            <p className="text-white text-3xl font-black">{resumen?.cantidadVentas ?? 0}</p>
                        </div>
                    </div>
                    {(['EFECTIVO', 'MERCADOPAGO', 'TRANSFERENCIA'] as const).map(m => {
                        const dato = resumen?.porMetodoPago.find(p => p.metodoPago === m)
                        const total = Number(dato?._sum?.precioFinal ?? 0)
                        return (
                            <div key={m} className="bg-zinc-900 border border-white/5 rounded-xl p-4">
                                <p className="text-zinc-500 text-xs uppercase tracking-widest mb-1">
                                    {METODO_ICON[m]} {METODO_LABEL[m]}
                                </p>
                                <p className={`text-lg font-black ${total > 0 ? 'text-white' : 'text-zinc-700'}`}>
                                    ${total.toLocaleString('es-AR')}
                                </p>
                                {dato && <p className="text-zinc-600 text-xs mt-0.5">{dato._count} venta{dato._count !== 1 ? 's' : ''}</p>}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* ── Lista de ventas de hoy ── */}
            <div className="space-y-3">
                <h2 className="text-zinc-500 text-xs uppercase tracking-widest font-black">Ventas de hoy</h2>
                {ventas.length === 0 ? (
                    <div className="bg-zinc-900 border border-white/5 rounded-2xl p-8 text-center">
                        <p className="text-zinc-600 text-sm">Sin ventas registradas hoy</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {ventas.map(v => (
                            <div key={v.id} className="bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 flex items-center gap-3">
                                {v.prenda.fotos?.[0] ? (
                                    <img src={v.prenda.fotos[0].url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                                ) : (
                                    <span className="text-xl w-10 text-center shrink-0">👕</span>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-white text-sm font-bold truncate">{v.prenda.categoria?.nombre}</p>
                                    <p className="text-zinc-500 text-xs">
                                        Talle {v.prenda.talle?.nombre}
                                        {v.cliente && <span> · {v.cliente.nombre}</span>}
                                    </p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-white font-black text-sm">${Number(v.precioFinal).toLocaleString('es-AR')}</p>
                                    <p className="text-zinc-500 text-xs">
                                        {METODO_ICON[v.metodoPago]} {new Date(v.fechaVenta).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                <div className="shrink-0">
                                    {confirmAnular === v.id ? (
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => handleAnular(v.id)}
                                                disabled={anulando === v.id}
                                                className="px-2 py-1 rounded-lg bg-red-500/20 text-red-400 text-xs font-black border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50"
                                            >
                                                {anulando === v.id ? '...' : 'Sí'}
                                            </button>
                                            <button
                                                onClick={() => setConfirmAnular(null)}
                                                className="px-2 py-1 rounded-lg border border-white/10 text-zinc-500 text-xs hover:border-white/20"
                                            >
                                                No
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setConfirmAnular(v.id)}
                                            className="px-2 py-1 rounded-lg border border-white/10 text-zinc-600 text-xs hover:border-red-500/30 hover:text-red-400 transition-colors"
                                        >
                                            Anular
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Ventas sin caja de días anteriores ── */}
            {huerfanas.length > 0 && (
                <VentasHuerfanas huerfanas={huerfanas} metodoLabel={METODO_LABEL} />
            )}

            {/* ── Control de efectivo ── */}
            <div className="space-y-3">
                <h2 className="text-zinc-500 text-xs uppercase tracking-widest font-black">Control de efectivo</h2>
                {sinCaja ? (
                    <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5 flex items-center justify-between gap-4">
                        <div>
                            <p className="text-zinc-400 text-sm font-bold">Sin caja abierta</p>
                            <p className="text-zinc-600 text-xs mt-0.5">Abrí la caja para controlar el efectivo y registrar gastos</p>
                        </div>
                        <button
                            onClick={() => setModalAbrir(true)}
                            className="shrink-0 px-5 py-2.5 bg-orange-500 text-black font-black text-xs uppercase rounded-xl hover:bg-orange-400 transition-colors"
                        >
                            Abrir caja
                        </button>
                    </div>
                ) : caja ? (
                    <div className={`rounded-2xl border p-5 space-y-4 ${caja.estado === 'ABIERTA' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-zinc-900 border-white/5'}`}>
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase border ${caja.estado === 'ABIERTA' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-zinc-700 text-zinc-400 border-zinc-600'}`}>
                                    {caja.estado}
                                </span>
                                <div className="mt-3 flex gap-6">
                                    <div>
                                        <p className="text-zinc-500 text-xs uppercase tracking-widest">Apertura</p>
                                        <p className="text-white font-black">${Number(caja.montoApertura).toLocaleString('es-AR')}</p>
                                    </div>
                                    <div>
                                        <p className="text-zinc-500 text-xs uppercase tracking-widest">Esperado</p>
                                        <p className="text-white font-black">${Number(caja.montoEsperado).toLocaleString('es-AR')}</p>
                                    </div>
                                    {caja.estado === 'CERRADA' && caja.montoReal != null && (
                                        <div>
                                            <p className="text-zinc-500 text-xs uppercase tracking-widest">Real</p>
                                            <p className="text-white font-black">${Number(caja.montoReal).toLocaleString('es-AR')}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {caja.estado === 'ABIERTA' ? (
                                <div className="flex flex-col gap-2">
                                    <button onClick={() => setModalGasto(true)} className="px-4 py-2 bg-zinc-800 border border-white/10 text-zinc-300 font-black text-xs uppercase rounded-xl hover:border-orange-500/30 hover:text-orange-400 transition-colors">
                                        + Gasto
                                    </button>
                                    <button onClick={() => setModalCerrar(true)} className="px-4 py-2 border border-white/10 text-zinc-300 font-black text-xs uppercase rounded-xl hover:border-red-500/30 hover:text-red-400 transition-colors">
                                        Cerrar
                                    </button>
                                </div>
                            ) : (
                                <button onClick={() => setModalAbrir(true)} className="px-4 py-2 bg-zinc-800 border border-white/10 text-zinc-300 font-black text-xs uppercase rounded-xl hover:border-emerald-500/30 hover:text-emerald-400 transition-colors">
                                    Reabrir
                                </button>
                            )}
                        </div>

                        {caja.estado === 'CERRADA' && caja.diferencia != null && (
                            <div className={`rounded-xl p-3 border text-sm ${Number(caja.diferencia) >= 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                Diferencia: {Number(caja.diferencia) >= 0 ? '+' : ''}${Number(caja.diferencia).toLocaleString('es-AR')} {Number(caja.diferencia) === 0 ? '✓ Cuadra' : Number(caja.diferencia) > 0 ? '(sobrante)' : '(faltante)'}
                            </div>
                        )}

                        {caja.gastos && caja.gastos.length > 0 && (
                            <div className="border-t border-white/5 pt-3 space-y-2">
                                {caja.gastos.filter(g => g.tipo !== 'RETIRO').length > 0 && (
                                    <>
                                        <p className="text-zinc-500 text-xs uppercase tracking-widest">Gastos</p>
                                        {caja.gastos.filter(g => g.tipo !== 'RETIRO').map(g => (
                                            <div key={g.id} className="flex justify-between text-sm">
                                                <span className="text-zinc-400">{g.concepto}</span>
                                                <span className="text-red-400 font-bold">−${Number(g.monto).toLocaleString('es-AR')}</span>
                                            </div>
                                        ))}
                                    </>
                                )}
                                {caja.gastos.filter(g => g.tipo === 'RETIRO').length > 0 && (
                                    <>
                                        <p className="text-zinc-500 text-xs uppercase tracking-widest mt-2">Retiros</p>
                                        {caja.gastos.filter(g => g.tipo === 'RETIRO').map(g => (
                                            <div key={g.id} className="flex justify-between text-sm">
                                                <span className="text-zinc-400">{g.concepto}</span>
                                                <span className="text-amber-400 font-bold">−${Number(g.monto).toLocaleString('es-AR')}</span>
                                            </div>
                                        ))}
                                    </>
                                )}
                                <div className="flex justify-between text-xs pt-1 border-t border-white/5">
                                    <span className="text-zinc-500 uppercase">Total salidas</span>
                                    <span className="text-red-400 font-black">−${caja.gastos.reduce((a, g) => a + Number(g.monto), 0).toLocaleString('es-AR')}</span>
                                </div>
                            </div>
                        )}
                    </div>
                ) : null}
            </div>

            {/* ── Historial ── */}
            {historial.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-zinc-500 text-xs uppercase tracking-widest font-black">Historial de cajas</h2>
                    <div className="space-y-2">
                        {historial.map(c => (
                            <div key={c.id} className="bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-white text-sm font-bold">
                                        {new Date(c.fecha).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                                    </p>
                                    <p className="text-zinc-500 text-xs">Apertura: ${Number(c.montoApertura).toLocaleString('es-AR')}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-white font-black">${Number(c.montoReal ?? 0).toLocaleString('es-AR')}</p>
                                    {c.diferencia != null && (
                                        <p className={`text-xs font-bold ${Number(c.diferencia) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {Number(c.diferencia) >= 0 ? '+' : ''}${Number(c.diferencia).toLocaleString('es-AR')}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {modalAbrir && (
                <ModalAbrirCaja onClose={() => setModalAbrir(false)} onAbierta={() => { setModalAbrir(false); toast('Caja abierta'); cargar() }} />
            )}
            {modalCerrar && caja && (
                <ModalCerrarCaja caja={caja} onClose={() => setModalCerrar(false)} onCerrada={() => { setModalCerrar(false); toast('Caja cerrada correctamente'); cargar() }} />
            )}
            {modalGasto && caja && (
                <ModalGasto cajaId={caja.id} onClose={() => setModalGasto(false)} onGuardado={() => { setModalGasto(false); toast('Salida registrada'); cargar() }} />
            )}
        </div>
    )
}

function VentasHuerfanas({ huerfanas, metodoLabel }: { huerfanas: Venta[]; metodoLabel: Record<string, string> }) {
    const [expandido, setExpandido] = useState(false)
    const LIMITE = 20
    const visibles = expandido ? huerfanas : huerfanas.slice(0, LIMITE)
    const total = huerfanas.reduce((s, v) => s + Number(v.precioFinal), 0)

    return (
        <div className="space-y-3">
            <h2 className="text-amber-400 text-xs uppercase tracking-widest font-black">
                ⚠ Ventas sin caja — días anteriores
            </h2>
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 space-y-2">
                <p className="text-amber-400/80 text-xs mb-3">
                    {huerfanas.length} venta{huerfanas.length !== 1 ? 's' : ''} registrada{huerfanas.length !== 1 ? 's' : ''} sin caja abierta. No afectan la caja actual.
                </p>
                {visibles.map(v => (
                    <div key={v.id} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base shrink-0">👕</span>
                            <div className="min-w-0">
                                <p className="text-zinc-300 text-sm font-bold truncate">{v.prenda.categoria?.nombre}</p>
                                <p className="text-zinc-500 text-xs">
                                    {new Date(v.fechaVenta).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} · {metodoLabel[v.metodoPago]}
                                </p>
                            </div>
                        </div>
                        <p className="text-amber-400 font-black text-sm shrink-0">${Number(v.precioFinal).toLocaleString('es-AR')}</p>
                    </div>
                ))}
                {huerfanas.length > LIMITE && (
                    <button
                        onClick={() => setExpandido(e => !e)}
                        className="w-full text-center text-amber-500/60 text-xs font-bold uppercase py-1 hover:text-amber-400 transition-colors"
                    >
                        {expandido ? '▲ Mostrar menos' : `▼ Ver todas (${huerfanas.length - LIMITE} más)`}
                    </button>
                )}
                <div className="pt-2 border-t border-amber-500/20 flex justify-between">
                    <span className="text-amber-400/60 text-xs uppercase tracking-wide">Total</span>
                    <span className="text-amber-400 font-black text-sm">${total.toLocaleString('es-AR')}</span>
                </div>
            </div>
        </div>
    )
}

function ModalAbrirCaja({ onClose, onAbierta }: { onClose: () => void; onAbierta: () => void }) {
    const [monto, setMonto] = useState('')
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState('')

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setGuardando(true)
        setError('')
        try {
            await cajaApi.abrir(Number(monto))
            onAbierta()
        } catch (e: any) {
            setError(e.message)
        } finally {
            setGuardando(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
            <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-white/5">
                    <h2 className="text-white font-black uppercase text-sm">Abrir Caja</h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl leading-none">✕</button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="label">Efectivo inicial en caja</label>
                        <input className="input text-xl font-bold" type="number" min="0" step="0.01" placeholder="0.00" value={monto} onChange={e => setMonto(e.target.value)} required autoFocus />
                    </div>
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-bold uppercase">Cancelar</button>
                        <button type="submit" disabled={guardando} className="flex-1 py-2.5 rounded-xl bg-orange-500 text-black text-sm font-black uppercase hover:bg-orange-400 disabled:opacity-50">
                            {guardando ? 'Abriendo...' : 'Abrir'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function ModalCerrarCaja({ caja, onClose, onCerrada }: { caja: Caja; onClose: () => void; onCerrada: () => void }) {
    const [monto, setMonto] = useState('')
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState('')

    const diferencia = monto ? Number(monto) - Number(caja.montoEsperado) : null

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setGuardando(true)
        setError('')
        try {
            await cajaApi.cerrar(caja.id, Number(monto))
            onCerrada()
        } catch (e: any) {
            setError(e.message)
        } finally {
            setGuardando(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
            <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-white/5">
                    <h2 className="text-white font-black uppercase text-sm">Cerrar Caja</h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl leading-none">✕</button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div className="p-3 bg-zinc-800 rounded-xl text-sm">
                        <p className="text-zinc-400">Monto esperado: <span className="text-white font-bold">${Number(caja.montoEsperado).toLocaleString('es-AR')}</span></p>
                    </div>
                    <div>
                        <label className="label">Efectivo real contado</label>
                        <input className="input text-xl font-bold" type="number" min="0" step="0.01" placeholder="0.00" value={monto} onChange={e => setMonto(e.target.value)} required autoFocus />
                    </div>
                    {diferencia !== null && (
                        <div className={`p-3 rounded-xl text-sm border ${diferencia >= 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                            Diferencia: {diferencia >= 0 ? '+' : ''}${diferencia.toLocaleString('es-AR')} {diferencia === 0 ? '✓ Cuadra' : diferencia > 0 ? '(sobrante)' : '(faltante)'}
                        </div>
                    )}
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-bold uppercase">Cancelar</button>
                        <button type="submit" disabled={guardando} className="flex-1 py-2.5 rounded-xl bg-orange-500 text-black text-sm font-black uppercase hover:bg-orange-400 disabled:opacity-50">
                            {guardando ? 'Cerrando...' : 'Cerrar caja'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function ModalGasto({ cajaId, onClose, onGuardado }: { cajaId: string; onClose: () => void; onGuardado: () => void }) {
    const [tipo, setTipo] = useState<'GASTO' | 'RETIRO'>('GASTO')
    const [concepto, setConcepto] = useState('')
    const [monto, setMonto] = useState('')
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState('')

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setGuardando(true)
        setError('')
        try {
            await cajaApi.registrarGasto(cajaId, { concepto, monto: Number(monto), tipo })
            onGuardado()
        } catch (e: any) {
            setError(e.message)
        } finally {
            setGuardando(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
            <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-white/5">
                    <h2 className="text-white font-black uppercase text-sm">Salida de caja</h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl leading-none">✕</button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setTipo('GASTO')}
                            className={`py-2.5 rounded-xl text-sm font-black uppercase border transition-all ${tipo === 'GASTO' ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'border-white/10 text-zinc-500 hover:border-white/20'}`}>
                            Gasto
                        </button>
                        <button type="button" onClick={() => setTipo('RETIRO')}
                            className={`py-2.5 rounded-xl text-sm font-black uppercase border transition-all ${tipo === 'RETIRO' ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'border-white/10 text-zinc-500 hover:border-white/20'}`}>
                            Retiro
                        </button>
                    </div>
                    <p className="text-zinc-600 text-xs">
                        {tipo === 'GASTO' ? 'Gasto del negocio (limpieza, insumos, etc.)' : 'Retiro de Gabi — no es gasto del negocio'}
                    </p>
                    <div>
                        <label className="label">Concepto</label>
                        <input className="input" type="text"
                            placeholder={tipo === 'GASTO' ? 'Ej: limpieza, bolsas...' : 'Ej: retiro personal'}
                            value={concepto} onChange={e => setConcepto(e.target.value)} required autoFocus />
                    </div>
                    <div>
                        <label className="label">Monto</label>
                        <input className="input text-xl font-bold" type="number" min="0.01" step="0.01" placeholder="0.00" value={monto} onChange={e => setMonto(e.target.value)} required />
                    </div>
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-bold uppercase">Cancelar</button>
                        <button type="submit" disabled={guardando} className="flex-1 py-2.5 rounded-xl bg-orange-500 text-black text-sm font-black uppercase hover:bg-orange-400 disabled:opacity-50">
                            {guardando ? 'Guardando...' : 'Registrar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
