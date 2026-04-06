'use client'

import { useEffect, useState, useRef } from 'react'
import { clientesApi, type ClienteConStats, type ClienteDetalle } from '@/lib/api'

const METODO_ICON: Record<string, string> = {
    EFECTIVO: '💵',
    MERCADOPAGO: '📱',
    TRANSFERENCIA: '🏦',
}

const TAKE = 50

export default function ClientesPage() {
    const [clientes, setClientes] = useState<ClienteConStats[]>([])
    const [total, setTotal] = useState(0)
    const [skip, setSkip] = useState(0)
    const [loading, setLoading] = useState(true)
    const [loadingMas, setLoadingMas] = useState(false)
    const [busqueda, setBusqueda] = useState('')
    const [detalle, setDetalle] = useState<ClienteDetalle | null>(null)
    const [loadingDetalle, setLoadingDetalle] = useState(false)
    const [modalNuevo, setModalNuevo] = useState(false)
    const [editando, setEditando] = useState<ClienteConStats | null>(null)
    const busquedaTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    async function cargar(nuevaBusqueda?: string) {
        setLoading(true)
        setSkip(0)
        const res = await clientesApi.listar({ skip: 0, take: TAKE, buscar: nuevaBusqueda ?? busqueda }).finally(() => setLoading(false))
        setClientes(res.items)
        setTotal(res.total)
    }

    async function cargarMas() {
        const nuevoSkip = skip + TAKE
        setLoadingMas(true)
        const res = await clientesApi.listar({ skip: nuevoSkip, take: TAKE, buscar: busqueda }).finally(() => setLoadingMas(false))
        setClientes(prev => [...prev, ...res.items])
        setSkip(nuevoSkip)
    }

    useEffect(() => { cargar() }, [])

    function handleBusqueda(valor: string) {
        setBusqueda(valor)
        if (busquedaTimer.current) clearTimeout(busquedaTimer.current)
        busquedaTimer.current = setTimeout(() => cargar(valor), 300)
    }

    async function abrirDetalle(id: string) {
        setLoadingDetalle(true)
        setDetalle(null)
        clientesApi.uno(id).then(setDetalle).finally(() => setLoadingDetalle(false))
    }

    async function handleEliminar(id: string) {
        if (!confirm('¿Eliminar este cliente?')) return
        try {
            await clientesApi.eliminar(id)
            cargar()
            if (detalle?.id === id) setDetalle(null)
        } catch (e: any) {
            alert(e.message)
        }
    }

    const hayMas = clientes.length < total

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div>
                    <h1 className="text-2xl font-black text-white uppercase">Clientes</h1>
                    <p className="text-zinc-500 text-xs uppercase tracking-widest mt-0.5">{total} registrados</p>
                </div>
                <button
                    onClick={() => setModalNuevo(true)}
                    className="px-5 py-2.5 bg-orange-500 text-black font-black text-sm uppercase rounded-xl hover:bg-orange-400 transition-colors"
                >
                    + Nuevo
                </button>
            </div>

            <input
                value={busqueda}
                onChange={e => handleBusqueda(e.target.value)}
                placeholder="Buscar por nombre o teléfono..."
                className="input"
            />

            {loading ? (
                <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-zinc-900 rounded-2xl animate-pulse" />)}
                </div>
            ) : clientes.length === 0 ? (
                <div className="text-center py-20 text-zinc-500">No hay clientes</div>
            ) : (
                <div className="space-y-2">
                    {clientes.map(c => {
                        const total = c.ventas.reduce((s, v) => s + Number(v.precioFinal), 0)
                        const ultima = c.ventas[0]?.fechaVenta
                        const isOpen = detalle?.id === c.id

                        return (
                            <div key={c.id} className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden">
                                {/* Fila cliente */}
                                <button
                                    onClick={() => isOpen ? setDetalle(null) : abrirDetalle(c.id)}
                                    className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-white/3 transition-colors text-left"
                                >
                                    <div className="w-9 h-9 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-sm font-black text-zinc-400 shrink-0">
                                        {c.nombre[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-bold text-sm">{c.nombre}</p>
                                        <p className="text-zinc-500 text-xs">
                                            {c.telefonoWhatsapp
                                                ? <a href={`https://wa.me/${c.telefonoWhatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="hover:text-emerald-400 transition-colors">{c.telefonoWhatsapp}</a>
                                                : 'Sin teléfono'
                                            }
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className={`font-black text-sm ${total > 0 ? 'text-white' : 'text-zinc-600'}`}>
                                            {total > 0 ? `$${total.toLocaleString('es-AR')}` : '—'}
                                        </p>
                                        <p className="text-zinc-600 text-xs">
                                            {c._count.ventas} compra{c._count.ventas !== 1 ? 's' : ''}
                                            {ultima && ` · ${new Date(ultima).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}`}
                                        </p>
                                    </div>
                                    <span className={`text-zinc-600 text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                                </button>

                                {/* Detalle expandido */}
                                {isOpen && (
                                    <div className="border-t border-white/5 px-4 pb-4 pt-3 space-y-4">
                                        {loadingDetalle ? (
                                            <div className="space-y-2">
                                                {[...Array(2)].map((_, i) => <div key={i} className="h-12 bg-zinc-800 rounded-xl animate-pulse" />)}
                                            </div>
                                        ) : detalle ? (
                                            <>
                                                {/* Notas */}
                                                {detalle.notas && (
                                                    <p className="text-zinc-400 text-sm italic">{detalle.notas}</p>
                                                )}

                                                {/* Historial de compras */}
                                                {detalle.ventas.length > 0 ? (
                                                    <div className="space-y-2">
                                                        <p className="text-zinc-500 text-xs uppercase tracking-widest font-black">Compras</p>
                                                        {detalle.ventas.map(v => (
                                                            <div key={v.id} className="flex items-center gap-3 bg-zinc-800 rounded-xl px-3 py-2.5">
                                                                {v.prenda?.fotos?.[0] ? (
                                                                    <img src={v.prenda.fotos[0].url} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                                                                ) : (
                                                                    <span className="text-xl w-9 text-center shrink-0">👕</span>
                                                                )}
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-white text-sm font-bold truncate">{v.prenda?.categoria?.nombre}</p>
                                                                    <p className="text-zinc-500 text-xs">Talle {v.prenda?.talle?.nombre}</p>
                                                                </div>
                                                                <div className="text-right shrink-0">
                                                                    <p className="text-white font-black text-sm">${Number(v.precioFinal).toLocaleString('es-AR')}</p>
                                                                    <p className="text-zinc-500 text-xs">
                                                                        {METODO_ICON[v.metodoPago]} {new Date(v.fechaVenta).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        <div className="flex justify-between px-3 pt-1 border-t border-white/5">
                                                            <span className="text-zinc-500 text-xs uppercase tracking-wide">Total gastado</span>
                                                            <span className="text-orange-400 font-black text-sm">
                                                                ${detalle.ventas.reduce((s, v) => s + Number(v.precioFinal), 0).toLocaleString('es-AR')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-zinc-600 text-sm">Sin compras registradas</p>
                                                )}

                                                {/* Acciones */}
                                                <div className="flex gap-2 pt-1">
                                                    <button
                                                        onClick={() => setEditando(c)}
                                                        className="flex-1 py-2 rounded-xl border border-white/10 text-zinc-400 text-xs font-black uppercase hover:border-orange-500/30 hover:text-orange-400 transition-colors"
                                                    >
                                                        Editar
                                                    </button>
                                                    {c._count.ventas === 0 && (
                                                        <button
                                                            onClick={() => handleEliminar(c.id)}
                                                            className="py-2 px-4 rounded-xl border border-white/5 text-zinc-700 text-xs font-black uppercase hover:border-red-500/30 hover:text-red-400 transition-colors"
                                                        >
                                                            ✕
                                                        </button>
                                                    )}
                                                </div>
                                            </>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                    {hayMas && (
                        <button
                            onClick={cargarMas}
                            disabled={loadingMas}
                            className="w-full py-3 border border-white/10 text-zinc-400 text-sm font-bold uppercase rounded-2xl hover:border-white/20 transition-colors disabled:opacity-50"
                        >
                            {loadingMas ? 'Cargando...' : `Ver más (${total - clientes.length} restantes)`}
                        </button>
                    )}
                </div>
            )}

            {modalNuevo && (
                <ModalCliente
                    onClose={() => setModalNuevo(false)}
                    onGuardado={() => { setModalNuevo(false); cargar() }}
                />
            )}
            {editando && (
                <ModalCliente
                    cliente={editando}
                    onClose={() => setEditando(null)}
                    onGuardado={() => { setEditando(null); cargar() }}
                />
            )}
        </div>
    )
}

function ModalCliente({
    cliente,
    onClose,
    onGuardado,
}: {
    cliente?: ClienteConStats
    onClose: () => void
    onGuardado: () => void
}) {
    const [nombre, setNombre] = useState(cliente?.nombre ?? '')
    const [telefono, setTelefono] = useState(cliente?.telefonoWhatsapp ?? '')
    const [notas, setNotas] = useState((cliente as any)?.notas ?? '')
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState('')

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setGuardando(true)
        setError('')
        try {
            if (cliente) {
                await clientesApi.actualizar(cliente.id, { nombre, telefonoWhatsapp: telefono || undefined, notas: notas || undefined })
            } else {
                await clientesApi.crear({ nombre, telefonoWhatsapp: telefono || undefined, notas: notas || undefined })
            }
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
                    <h2 className="text-white font-black uppercase text-sm">{cliente ? 'Editar cliente' : 'Nuevo cliente'}</h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl leading-none">✕</button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="label">Nombre</label>
                        <input className="input" type="text" value={nombre} onChange={e => setNombre(e.target.value)} required autoFocus placeholder="Nombre del cliente" />
                    </div>
                    <div>
                        <label className="label">WhatsApp <span className="text-zinc-600 normal-case font-normal">opcional</span></label>
                        <input className="input" type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="5493434807989" />
                    </div>
                    <div>
                        <label className="label">Notas <span className="text-zinc-600 normal-case font-normal">opcional</span></label>
                        <input className="input" type="text" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ej: cliente frecuente, talle M" />
                    </div>
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-bold uppercase">Cancelar</button>
                        <button type="submit" disabled={guardando} className="flex-1 py-2.5 rounded-xl bg-orange-500 text-black text-sm font-black uppercase hover:bg-orange-400 disabled:opacity-50">
                            {guardando ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
