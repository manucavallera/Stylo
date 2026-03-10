'use client'

import { useEffect, useState } from 'react'
import { cajaApi, type Caja, type GastoCaja } from '@/lib/api'

export default function CajaPage() {
    const [caja, setCaja] = useState<Caja | null>(null)
    const [loading, setLoading] = useState(true)
    const [sinCaja, setSinCaja] = useState(false)
    const [modalAbrir, setModalAbrir] = useState(false)
    const [modalCerrar, setModalCerrar] = useState(false)
    const [modalGasto, setModalGasto] = useState(false)
    const [historial, setHistorial] = useState<Caja[]>([])

    async function cargar() {
        setLoading(true)
        setSinCaja(false)
        try {
            const data = await cajaApi.hoy()
            setCaja(data)
        } catch (e: any) {
            if (e.message?.includes('No hay caja')) setSinCaja(true)
            else setSinCaja(true)
        } finally {
            setLoading(false)
        }
    }

    async function cargarHistorial() {
        try {
            const data = await cajaApi.historial()
            setHistorial(data.filter((c: Caja) => c.estado === 'CERRADA'))
        } catch {}
    }

    useEffect(() => { cargar(); cargarHistorial() }, [])

    if (loading) return (
        <div className="space-y-4">
            <div className="h-8 w-48 bg-zinc-900 rounded animate-pulse" />
            <div className="h-48 bg-zinc-900 rounded-2xl animate-pulse" />
        </div>
    )

    return (
        <div className="space-y-6">
            <div className="border-b border-white/5 pb-4">
                <h1 className="text-2xl font-black text-white uppercase">Caja del Día</h1>
                <p className="text-zinc-500 text-xs uppercase tracking-widest mt-0.5">
                    {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
            </div>

            {sinCaja ? (
                <div className="bg-zinc-900 border border-white/5 rounded-2xl p-6 sm:p-10 text-center space-y-4">
                    <p className="text-4xl">💰</p>
                    <p className="text-white font-bold text-lg">No hay caja abierta para hoy</p>
                    <p className="text-zinc-500 text-sm">Abrí la caja para empezar a registrar ventas en efectivo</p>
                    <button
                        onClick={() => setModalAbrir(true)}
                        className="px-8 py-3 bg-orange-500 text-black font-black text-sm uppercase rounded-xl hover:bg-orange-400 transition-colors"
                    >
                        Abrir Caja
                    </button>
                </div>
            ) : caja ? (
                <div className="space-y-4">
                    {/* Estado */}
                    <div className={`p-4 sm:p-5 rounded-2xl border ${caja.estado === 'ABIERTA' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-zinc-900 border-white/5'}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="flex-1">
                                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase border ${caja.estado === 'ABIERTA' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-zinc-700 text-zinc-400 border-zinc-600'}`}>
                                    {caja.estado}
                                </span>
                                <p className="text-white font-black text-2xl mt-3">${Number(caja.montoApertura).toLocaleString('es-AR')}</p>
                                <p className="text-zinc-500 text-xs uppercase tracking-wide">Monto de apertura</p>
                            </div>
                            {caja.estado === 'ABIERTA' && (
                                <div className="flex sm:flex-col gap-2">
                                    <button
                                        onClick={() => setModalGasto(true)}
                                        className="flex-1 sm:flex-none px-5 py-2.5 bg-zinc-800 border border-white/10 text-zinc-300 font-black text-xs uppercase rounded-xl hover:border-orange-500/30 hover:text-orange-400 transition-colors"
                                    >
                                        + Gasto
                                    </button>
                                    <button
                                        onClick={() => setModalCerrar(true)}
                                        className="flex-1 sm:flex-none px-5 py-2.5 border border-white/10 text-zinc-300 font-black text-xs uppercase rounded-xl hover:border-red-500/30 hover:text-red-400 transition-colors"
                                    >
                                        Cerrar Caja
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Resumen */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
                            <p className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Esperado en caja</p>
                            <p className="text-white text-2xl font-black">${Number(caja.montoEsperado).toLocaleString('es-AR')}</p>
                            <p className="text-zinc-600 text-xs mt-1">Apertura + efectivo − gastos</p>
                        </div>
                        {caja.estado === 'CERRADA' && (
                            <>
                                <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
                                    <p className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Real contado</p>
                                    <p className="text-white text-2xl font-black">${Number(caja.montoReal ?? 0).toLocaleString('es-AR')}</p>
                                </div>
                                <div className={`col-span-2 border rounded-2xl p-5 ${Number(caja.diferencia) >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                                    <p className="text-zinc-400 text-xs uppercase tracking-widest mb-1">Diferencia</p>
                                    <p className={`text-2xl font-black ${Number(caja.diferencia) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {Number(caja.diferencia) >= 0 ? '+' : ''}${Number(caja.diferencia).toLocaleString('es-AR')}
                                    </p>
                                    <p className="text-zinc-500 text-xs mt-1">
                                        {Number(caja.diferencia) === 0 ? 'Cuadra perfectamente' : Number(caja.diferencia) > 0 ? 'Sobrante' : 'Faltante'}
                                    </p>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Gastos del día */}
                    {caja.gastos && caja.gastos.length > 0 && (
                        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
                            <p className="text-zinc-500 text-xs uppercase tracking-widest mb-3">Gastos del día</p>
                            <div className="space-y-2">
                                {caja.gastos.map((g) => (
                                    <div key={g.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                                        <span className="text-zinc-300 text-sm">{g.concepto}</span>
                                        <span className="text-red-400 font-bold text-sm">−${Number(g.monto).toLocaleString('es-AR')}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center justify-between pt-3 mt-1">
                                <span className="text-zinc-500 text-xs uppercase">Total gastos</span>
                                <span className="text-red-400 font-black">−${caja.gastos.reduce((acc, g) => acc + Number(g.monto), 0).toLocaleString('es-AR')}</span>
                            </div>
                        </div>
                    )}
                </div>
            ) : null}

            {modalAbrir && (
                <ModalAbrirCaja
                    onClose={() => setModalAbrir(false)}
                    onAbierta={() => { setModalAbrir(false); cargar() }}
                />
            )}

            {modalCerrar && caja && (
                <ModalCerrarCaja
                    caja={caja}
                    onClose={() => setModalCerrar(false)}
                    onCerrada={() => { setModalCerrar(false); cargar() }}
                />
            )}

            {modalGasto && caja && (
                <ModalGasto
                    cajaId={caja.id}
                    onClose={() => setModalGasto(false)}
                    onGuardado={() => { setModalGasto(false); cargar() }}
                />
            )}

            {/* Historial */}
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
                                    {c.diferencia !== undefined && c.diferencia !== null && (
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
    const [concepto, setConcepto] = useState('')
    const [monto, setMonto] = useState('')
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState('')

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setGuardando(true)
        setError('')
        try {
            await cajaApi.registrarGasto(cajaId, { concepto, monto: Number(monto) })
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
                    <h2 className="text-white font-black uppercase text-sm">Registrar Gasto</h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl leading-none">✕</button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="label">Concepto</label>
                        <input className="input" type="text" placeholder="Ej: cambio, limpieza, insumos..." value={concepto} onChange={e => setConcepto(e.target.value)} required autoFocus />
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
