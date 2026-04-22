'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { prendasApi, ventasApi, cajaApi, clientesApi, categoriasApi, tallesApi, fardosApi, type Prenda, type Caja, type Cliente, type Fardo } from '@/lib/api'
import { ClientePicker } from '@/components/ClientePicker'
import { toast } from '@/components/Toast'

const METODOS_PAGO = ['EFECTIVO', 'MERCADOPAGO', 'TRANSFERENCIA']

type VentaTicket = {
    prenda: Prenda
    precioFinal: number
    metodoPago: string
    cliente: Cliente | null
    fecha: Date
}

export default function PosPage() {
    return (
        <Suspense fallback={<div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-zinc-900 rounded-2xl animate-pulse" />)}</div>}>
            <PosInner />
        </Suspense>
    )
}

function PosInner() {
    const searchParams = useSearchParams()
    const prendaIdParam = searchParams.get('prendaId')

    const [modo, setModo] = useState<'buscar' | 'qr'>('buscar')
    const [busqueda, setBusqueda] = useState('')
    const [filtroCategoria, setFiltroCategoria] = useState('')
    const [filtroTalle, setFiltroTalle] = useState('')
    const [filtroFardo, setFiltroFardo] = useState('')
    const [categorias, setCategorias] = useState<{ id: string; nombre: string }[]>([])
    const [talles, setTalles] = useState<{ id: string; nombre: string }[]>([])
    const [fardos, setFardos] = useState<Fardo[]>([])
    const [prendas, setPrendas] = useState<Prenda[]>([])
    const [loadingPrendas, setLoadingPrendas] = useState(false)
    const [qrInput, setQrInput] = useState('')
    const [prenda, setPrenda] = useState<Prenda | null>(null)
    const [caja, setCaja] = useState<Caja | null>(null)
    const [metodoPago, setMetodoPago] = useState('EFECTIVO')
    const [precioFinal, setPrecioFinal] = useState('')
    const [clientes, setClientes] = useState<Cliente[]>([])
    const [cliente, setCliente] = useState<Cliente | null>(null)
    const [loading, setLoading] = useState(false)
    const [ventaTicket, setVentaTicket] = useState<VentaTicket | null>(null)
    const [error, setError] = useState('')

    useEffect(() => {
        cajaApi.hoy().then(setCaja).catch(() => null)
        clientesApi.listar({ take: 500 }).then(res => setClientes(res.items)).catch(() => null)
        categoriasApi.listar().then(setCategorias).catch(() => null)
        tallesApi.listar().then(setTalles).catch(() => null)
        fardosApi.listar().then(setFardos).catch(() => null)
    }, [])

    // Pre-cargar prenda si viene de /prendas
    useEffect(() => {
        if (!prendaIdParam) return
        prendasApi.uno(prendaIdParam)
            .then(p => seleccionarPrenda(p))
            .catch(() => setError('No se pudo cargar la prenda'))
    }, [prendaIdParam])

    useEffect(() => {
        if (modo !== 'buscar') return
        setLoadingPrendas(true)
        const params: Record<string, string> = { estado: 'DISPONIBLE' }
        if (busqueda) params.search = busqueda
        if (filtroCategoria) params.categoriaId = filtroCategoria
        if (filtroTalle) params.talleId = filtroTalle
        if (filtroFardo) params.fardoId = filtroFardo
        prendasApi.listar(params)
            .then(setPrendas)
            .finally(() => setLoadingPrendas(false))
    }, [busqueda, filtroCategoria, filtroTalle, filtroFardo, modo])

    function seleccionarPrenda(p: Prenda) {
        setPrenda(p)
        setPrecioFinal(String(p.precioPromocional ?? p.precioVenta))
        setError('')
    }

    async function buscarPorQr(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setPrenda(null)
        try {
            const p = await prendasApi.porQr(qrInput.trim())
            if (p.estado === 'VENDIDO') {
                setError('Esta prenda ya fue vendida')
                return
            }
            if (p.estado === 'RETIRADO') {
                setError('Esta prenda fue retirada del stock')
                return
            }
            if (p.estado === 'RESERVADO') {
                setError('⚠ Esta prenda tiene una reserva activa — confirmá la reserva desde /reservas o vendela igual')
            }
            seleccionarPrenda(p)
        } catch {
            setError('QR no encontrado')
        }
    }

    async function registrarVenta(e: React.FormEvent) {
        e.preventDefault()
        if (!prenda) return
        setLoading(true)
        setError('')
        try {
            await ventasApi.registrar({
                prendaId: prenda.id,
                metodoPago,
                canalVenta: 'LOCAL',
                precioFinal: Number(precioFinal),
                cajaId: caja?.estado === 'ABIERTA' ? caja.id : undefined,
                clienteId: cliente?.id,
            })
            toast(`Venta registrada — $${Number(precioFinal).toLocaleString('es-AR')}`)
            setVentaTicket({ prenda, precioFinal: Number(precioFinal), metodoPago, cliente, fecha: new Date() })
            setPrenda(null)
            setQrInput('')
            setPrecioFinal('')
            setCliente(null)
            prendasApi.listar({ estado: 'DISPONIBLE' }).then(setPrendas)
        } catch (err: any) {
            setError(err.message || 'Error al registrar la venta')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto space-y-5">
            <div className="border-b border-white/5 pb-4">
                <h1 className="text-2xl font-black text-white uppercase">Punto de Venta</h1>
                {caja?.estado === 'ABIERTA'
                    ? <p className="text-emerald-400 text-xs uppercase tracking-widest mt-0.5">✓ Caja abierta</p>
                    : <p className="text-zinc-600 text-xs uppercase tracking-widest mt-0.5">Sin caja abierta</p>
                }
            </div>

            {caja?.estado !== 'ABIERTA' && (
                <a href="/caja" className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3.5 hover:bg-amber-500/15 transition-colors group">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl shrink-0">⚠️</span>
                        <div>
                            <p className="text-amber-300 text-sm font-bold">No hay caja abierta hoy</p>
                            <p className="text-amber-600 text-xs mt-0.5">Las ventas van a quedar sin asignar a una caja</p>
                        </div>
                    </div>
                    <span className="text-amber-400 text-xs font-black uppercase shrink-0 group-hover:translate-x-0.5 transition-transform">Abrir →</span>
                </a>
            )}

            {/* Tabs modo — solo si no hay prenda pre-cargada desde prendas */}
            {!prendaIdParam && (
                <div className="flex gap-2">
                    <button
                        onClick={() => { setModo('buscar'); setPrenda(null); setError('') }}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-black uppercase border transition-all ${modo === 'buscar' ? 'bg-orange-500 text-black border-orange-500' : 'border-white/10 text-zinc-400 hover:border-white/20'}`}
                    >
                        🔍 Buscar prenda
                    </button>
                    <button
                        onClick={() => { setModo('qr'); setPrenda(null); setError('') }}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-black uppercase border transition-all ${modo === 'qr' ? 'bg-orange-500 text-black border-orange-500' : 'border-white/10 text-zinc-400 hover:border-white/20'}`}
                    >
                        📷 Lector QR
                    </button>
                </div>
            )}

            {/* Modo búsqueda */}
            {modo === 'buscar' && !prenda && (
                <div className="space-y-3">
                    <input
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        placeholder="Buscar por categoría, talle o nota..."
                        className="input"
                        autoFocus
                    />
                    <div className="grid grid-cols-3 gap-2">
                        <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} className="input text-sm">
                            <option value="">Categoría</option>
                            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                        <select value={filtroTalle} onChange={e => setFiltroTalle(e.target.value)} className="input text-sm">
                            <option value="">Talle</option>
                            {talles.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                        </select>
                        <select value={filtroFardo} onChange={e => setFiltroFardo(e.target.value)} className="input text-sm">
                            <option value="">Fardo</option>
                            {fardos.map(f => <option key={f.id} value={f.id}>{f.nombre ?? f.proveedor?.nombre ?? 'Fardo'}</option>)}
                        </select>
                    </div>
                    {loadingPrendas ? (
                        <div className="space-y-2">
                            {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-zinc-900 rounded-xl animate-pulse" />)}
                        </div>
                    ) : prendas.length === 0 ? (
                        <div className="text-center py-8 space-y-1">
                            <p className="text-3xl">👕</p>
                            <p className="text-zinc-400 text-sm font-bold">Sin prendas disponibles</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {prendas.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => seleccionarPrenda(p)}
                                    className="w-full flex items-center justify-between bg-zinc-900 border border-white/5 hover:border-orange-500/30 rounded-xl px-4 py-3 transition-all"
                                >
                                    <div className="flex items-center gap-3">
                                        {p.fotos?.[0] ? (
                                            <img src={p.fotos[0].url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                                        ) : (
                                            <span className="text-2xl w-10 text-center">👕</span>
                                        )}
                                        <div className="text-left">
                                            <p className="text-white text-sm font-bold">{p.categoria?.nombre}</p>
                                            <p className="text-zinc-500 text-xs">Talle {p.talle?.nombre}</p>
                                        </div>
                                    </div>
                                    <p className="text-orange-400 font-black">${Number(p.precioPromocional ?? p.precioVenta).toLocaleString('es-AR')}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Modo QR */}
            {modo === 'qr' && !prenda && (
                <form onSubmit={buscarPorQr} className="space-y-3">
                    <div className="flex gap-2">
                        <input
                            value={qrInput}
                            onChange={e => setQrInput(e.target.value)}
                            placeholder="Escaneá el QR con el lector..."
                            className="input flex-1"
                            autoFocus
                        />
                        <button type="submit" className="px-5 py-2.5 rounded-xl bg-orange-500 text-black font-black text-sm uppercase hover:bg-orange-400">
                            Buscar
                        </button>
                    </div>
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                </form>
            )}

            {/* Prenda seleccionada + form de venta */}
            {prenda && (
                <form onSubmit={registrarVenta} className="bg-zinc-900 border border-orange-500/20 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {prenda.fotos?.[0] ? (
                                <img src={prenda.fotos[0].url} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                            ) : (
                                <span className="text-3xl">👕</span>
                            )}
                            <div>
                                <p className="text-white font-black uppercase">{prenda.categoria?.nombre}</p>
                                <p className="text-zinc-400 text-sm">Talle {prenda.talle?.nombre}</p>
                                {prenda.fardo && (
                                    <p className="text-zinc-500 text-xs mt-0.5">
                                        {prenda.fardo.nombre ?? prenda.fardo.proveedor?.nombre ?? 'Fardo sin nombre'}
                                    </p>
                                )}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setPrenda(null)
                                if (prendaIdParam) window.history.back()
                            }}
                            className="text-zinc-600 hover:text-zinc-400 text-sm"
                        >
                            ✕ Cambiar
                        </button>
                    </div>

                    <div>
                        <label className="label">Precio final</label>
                        <input
                            type="number"
                            value={precioFinal}
                            onChange={e => setPrecioFinal(e.target.value)}
                            required min={1}
                            className="input text-xl font-black"
                        />
                    </div>

                    <div>
                        <label className="label">Método de pago</label>
                        <div className="grid grid-cols-3 gap-2">
                            {METODOS_PAGO.map(m => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => setMetodoPago(m)}
                                    className={`py-3 rounded-xl text-sm font-black uppercase border transition-all ${metodoPago === m ? 'bg-orange-500 border-orange-500 text-black' : 'border-white/10 text-zinc-400 hover:border-white/20'}`}
                                >
                                    {m === 'EFECTIVO' ? '💵' : m === 'MERCADOPAGO' ? '📱' : '🏦'}<br />
                                    <span className="text-xs">{m === 'EFECTIVO' ? 'Efectivo' : m === 'MERCADOPAGO' ? 'MercadoPago' : 'Transferencia'}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="label">Cliente <span className="text-zinc-600 normal-case font-normal">(opcional)</span></label>
                        <ClientePicker clientes={clientes} value={cliente} onChange={setCliente} />
                    </div>

                    {error && <p className="text-red-400 text-sm">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-black text-lg uppercase transition-all"
                    >
                        {loading ? 'Registrando...' : `✓ Vender — $${Number(precioFinal || 0).toLocaleString('es-AR')}`}
                    </button>
                </form>
            )}

            {ventaTicket && (
                <ModalTicket
                    venta={ventaTicket}
                    onClose={() => setVentaTicket(null)}
                />
            )}
        </div>
    )
}

function ModalTicket({ venta, onClose }: { venta: VentaTicket; onClose: () => void }) {
    const fecha = venta.fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const hora = venta.fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    const metodoLabel: Record<string, string> = { EFECTIVO: 'Efectivo', MERCADOPAGO: 'MercadoPago', TRANSFERENCIA: 'Transferencia' }

    return (
        <>
            <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    #ticket-print, #ticket-print * { visibility: visible !important; }
                    #ticket-print {
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 100% !important;
                        padding: 24px !important;
                    }
                }
            `}</style>

            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
                <div className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-xs">
                    <div className="flex items-center justify-between p-4 border-b border-white/5">
                        <span className="text-white font-black uppercase text-sm">Ticket de venta</span>
                        <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl leading-none">✕</button>
                    </div>

                    <div id="ticket-print" className="p-6 font-mono">
                        <div className="text-center border-b border-dashed border-white/20 pb-4 mb-4">
                            <p className="text-white font-black text-lg uppercase tracking-wider">STREET & STYLO</p>
                            <p className="text-orange-400 text-xs uppercase tracking-widest">AMERICAN ★</p>
                            <p className="text-zinc-500 text-xs mt-2">{fecha} — {hora}</p>
                        </div>

                        <div className="border-b border-dashed border-white/20 pb-4 mb-4 space-y-1">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-white font-bold text-sm">{venta.prenda.categoria?.nombre}</p>
                                    <p className="text-zinc-400 text-xs">Talle {venta.prenda.talle?.nombre}</p>
                                    {venta.cliente && <p className="text-zinc-400 text-xs mt-1">Cliente: {venta.cliente.nombre}</p>}
                                </div>
                                <p className="text-white font-black">${venta.precioFinal.toLocaleString('es-AR')}</p>
                            </div>
                        </div>

                        <div className="space-y-1 mb-4">
                            <div className="flex justify-between text-xs text-zinc-400">
                                <span>Forma de pago</span>
                                <span>{metodoLabel[venta.metodoPago] ?? venta.metodoPago}</span>
                            </div>
                            <div className="flex justify-between text-white font-black text-base">
                                <span>TOTAL</span>
                                <span>${venta.precioFinal.toLocaleString('es-AR')}</span>
                            </div>
                        </div>

                        <div className="text-center border-t border-dashed border-white/20 pt-4">
                            <p className="text-zinc-400 text-xs">¡Gracias por tu compra!</p>
                            <p className="text-zinc-600 text-[10px] mt-1">Conservá este comprobante</p>
                        </div>
                    </div>

                    <div className="flex gap-2 p-4 border-t border-white/5">
                        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-bold uppercase hover:border-white/20">
                            Cerrar
                        </button>
                        <button onClick={() => window.print()} className="flex-1 py-2.5 rounded-xl bg-orange-500 text-black text-sm font-black uppercase hover:bg-orange-400">
                            🖨️ Imprimir
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}
