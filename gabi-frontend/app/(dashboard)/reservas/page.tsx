'use client'

import { useEffect, useState } from 'react'
import { reservasApi, prendasApi, clientesApi, type Reserva, type Prenda, type Cliente } from '@/lib/api'
import { ClientePicker } from '@/components/ClientePicker'

function useTiempoRestante(fechaExpiracion: string) {
    const [texto, setTexto] = useState('')
    const [urgente, setUrgente] = useState(false)

    useEffect(() => {
        function calcular() {
            const diff = new Date(fechaExpiracion).getTime() - Date.now()
            if (diff <= 0) { setTexto('Vencida'); setUrgente(false); return }
            const min = Math.floor(diff / 60000)
            const hs = Math.floor(min / 60)
            setUrgente(min < 30)
            setTexto(hs > 0 ? `${hs}h ${min % 60}m` : `${min}m`)
        }
        calcular()
        const id = setInterval(calcular, 30000)
        return () => clearInterval(id)
    }, [fechaExpiracion])

    return { texto, urgente }
}

export default function ReservasPage() {
    const [reservas, setReservas] = useState<Reserva[]>([])
    const [loading, setLoading] = useState(true)
    const [accionando, setAccionando] = useState<string | null>(null)
    const [error, setError] = useState('')
    const [mostrarModal, setMostrarModal] = useState(false)
    const [clientes, setClientes] = useState<Cliente[]>([])
    // Cuando se crea un cliente nuevo en el modal, lo agregamos al listado local
    function agregarCliente(c: Cliente) {
        setClientes(prev => prev.find(x => x.id === c.id) ? prev : [...prev, c])
    }

    async function cargar() {
        setLoading(true)
        reservasApi.activas().then(setReservas).finally(() => setLoading(false))
    }

    useEffect(() => {
        cargar()
        clientesApi.listar().then(setClientes).catch(() => null)
    }, [])

    async function confirmar(id: string) {
        setAccionando(id)
        setError('')
        try {
            await reservasApi.confirmar(id)
            await cargar()
        } catch (e: any) {
            setError(e.message)
        } finally {
            setAccionando(null)
        }
    }

    async function cancelar(id: string) {
        if (!confirm('¿Cancelar esta reserva?')) return
        setAccionando(id)
        setError('')
        try {
            await reservasApi.cancelar(id)
            await cargar()
        } catch (e: any) {
            setError(e.message)
        } finally {
            setAccionando(null)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div>
                    <h1 className="text-2xl font-black text-white uppercase">Reservas</h1>
                    <p className="text-zinc-500 text-xs uppercase tracking-widest mt-0.5">{reservas.length} activas</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={cargar}
                        className="px-4 py-2 border border-white/10 text-zinc-400 text-xs font-bold uppercase rounded-xl hover:border-white/20 transition-colors"
                    >
                        Actualizar
                    </button>
                    <button
                        onClick={() => setMostrarModal(true)}
                        className="px-4 py-2 bg-orange-500 text-black text-xs font-black uppercase rounded-xl hover:bg-orange-400 transition-colors"
                    >
                        + Nueva
                    </button>
                </div>
            </div>

            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}

            {loading ? (
                <div className="space-y-3">
                    {[...Array(3)].map((_, i) => <div key={i} className="h-28 bg-zinc-900 rounded-2xl animate-pulse" />)}
                </div>
            ) : reservas.length === 0 ? (
                <div className="text-center py-20 text-zinc-500">No hay reservas activas</div>
            ) : (
                <div className="space-y-3">
                    {reservas.map(r => <ReservaRow key={r.id} reserva={r} accionando={accionando} onConfirmar={confirmar} onCancelar={cancelar} />)}
                </div>
            )}

            {mostrarModal && (
                <ModalNuevaReserva
                    clientes={clientes}
                    onNuevoCliente={agregarCliente}
                    onClose={() => setMostrarModal(false)}
                    onGuardada={() => { setMostrarModal(false); cargar() }}
                />
            )}
        </div>
    )
}

function ModalNuevaReserva({
    clientes,
    onNuevoCliente,
    onClose,
    onGuardada,
}: {
    clientes: Cliente[]
    onNuevoCliente: (c: Cliente) => void
    onClose: () => void
    onGuardada: () => void
}) {
    const [prendas, setPrendas] = useState<Prenda[]>([])
    const [loadingPrendas, setLoadingPrendas] = useState(true)
    const [busqueda, setBusqueda] = useState('')
    const [prenda, setPrenda] = useState<Prenda | null>(null)
    const [cliente, setCliente] = useState<Cliente | null>(null)
    const [minutos, setMinutos] = useState('60')
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        prendasApi.listar({ estado: 'DISPONIBLE' })
            .then(setPrendas)
            .finally(() => setLoadingPrendas(false))
    }, [])

    const prendasFiltradas = busqueda
        ? prendas.filter(p =>
            p.categoria?.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
            p.talle?.nombre.toLowerCase().includes(busqueda.toLowerCase())
        )
        : prendas

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!prenda || !cliente) return
        setGuardando(true)
        setError('')
        try {
            await reservasApi.crear({
                prendaId: prenda.id,
                clienteId: cliente.id,
                minutosExpiracion: Number(minutos) || 60,
            })
            onGuardada()
        } catch (e: any) {
            setError(e.message || 'Error al crear la reserva')
            setGuardando(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
            <div className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-zinc-950">
                    <h2 className="text-white font-black uppercase text-sm">Nueva Reserva</h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl leading-none">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-5">
                    {/* Prenda */}
                    <div className="space-y-2">
                        <label className="label">Prenda</label>
                        {prenda ? (
                            <div className="flex items-center gap-3 bg-zinc-800 border border-white/10 rounded-xl px-4 py-3">
                                <span className="text-2xl">👗</span>
                                <div className="flex-1">
                                    <p className="text-white text-sm font-bold">{prenda.categoria?.nombre}</p>
                                    <p className="text-zinc-500 text-xs">Talle {prenda.talle?.nombre} · ${Number(prenda.precioPromocional ?? prenda.precioVenta).toLocaleString('es-AR')}</p>
                                </div>
                                <button type="button" onClick={() => setPrenda(null)} className="text-zinc-500 hover:text-zinc-300 text-sm">✕</button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <input
                                    value={busqueda}
                                    onChange={e => setBusqueda(e.target.value)}
                                    placeholder="Filtrar por categoría o talle..."
                                    className="input"
                                />
                                {loadingPrendas ? (
                                    <div className="space-y-1.5">
                                        {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-zinc-900 rounded-xl animate-pulse" />)}
                                    </div>
                                ) : prendasFiltradas.length === 0 ? (
                                    <p className="text-zinc-500 text-sm text-center py-4">No hay prendas disponibles</p>
                                ) : (
                                    <div className="space-y-1 max-h-48 overflow-y-auto">
                                        {prendasFiltradas.map(p => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => setPrenda(p)}
                                                className="w-full flex items-center justify-between bg-zinc-900 border border-white/5 hover:border-orange-500/30 rounded-xl px-4 py-2.5 transition-all text-left"
                                            >
                                                <div>
                                                    <p className="text-white text-sm font-bold">{p.categoria?.nombre}</p>
                                                    <p className="text-zinc-500 text-xs">Talle {p.talle?.nombre}</p>
                                                </div>
                                                <p className="text-orange-400 font-black text-sm">${Number(p.precioPromocional ?? p.precioVenta).toLocaleString('es-AR')}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Cliente */}
                    <div className="space-y-2">
                        <label className="label">Cliente</label>
                        <ClientePicker
                            clientes={clientes}
                            value={cliente}
                            onChange={c => {
                                setCliente(c)
                                if (c && !clientes.find(x => x.id === c.id)) onNuevoCliente(c)
                            }}
                            placeholder="Buscar cliente..."
                        />
                    </div>

                    {/* Minutos */}
                    <div className="space-y-2">
                        <label className="label">Duración <span className="text-zinc-600 normal-case font-normal">(minutos)</span></label>
                        <div className="flex gap-2">
                            {['30', '60', '120', '240'].map(m => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => setMinutos(m)}
                                    className={`flex-1 py-2 rounded-xl text-xs font-black uppercase border transition-all ${minutos === m ? 'bg-orange-500 border-orange-500 text-black' : 'border-white/10 text-zinc-400 hover:border-white/20'}`}
                                >
                                    {m === '60' ? '1h' : m === '120' ? '2h' : m === '240' ? '4h' : '30m'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && <p className="text-red-400 text-sm">{error}</p>}

                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-bold uppercase"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={!prenda || !cliente || guardando}
                            className="flex-1 py-2.5 rounded-xl bg-orange-500 text-black text-sm font-black uppercase hover:bg-orange-400 disabled:opacity-40 transition-all"
                        >
                            {guardando ? 'Guardando...' : 'Reservar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function ReservaRow({ reserva: r, accionando, onConfirmar, onCancelar }: {
    reserva: any; accionando: string | null; onConfirmar: (id: string) => void; onCancelar: (id: string) => void
}) {
    const { texto, urgente } = useTiempoRestante(r.fechaExpiracion)
    const vencida = new Date(r.fechaExpiracion) < new Date()

    return (
        <div key={r.id} className={`bg-zinc-900 border rounded-2xl p-4 sm:p-5 ${vencida ? 'border-red-500/20' : urgente ? 'border-amber-500/30' : 'border-white/5'}`}>
            <div className="flex items-center gap-2 mb-2">
                <span className={`px-2.5 py-0.5 rounded-full border text-xs font-bold uppercase ${vencida ? 'bg-red-500/10 text-red-400 border-red-500/20' : urgente ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse' : 'bg-zinc-700 text-zinc-300 border-zinc-600'}`}>
                    ⏱ {texto}
                </span>
            </div>
            <p className="text-white font-bold">{r.cliente?.nombre ?? 'Cliente desconocido'}</p>
            {r.cliente?.telefonoWhatsapp && (
                <a
                    href={`https://wa.me/${r.cliente.telefonoWhatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 text-xs hover:underline"
                >
                    WhatsApp: {r.cliente.telefonoWhatsapp}
                </a>
            )}
            <p className="text-zinc-400 text-sm mt-1">
                {r.prenda?.categoria?.nombre} · Talle {r.prenda?.talle?.nombre}
            </p>
            <p className="text-orange-400 font-bold mb-3">
                ${Number(r.prenda?.precioVenta).toLocaleString('es-AR')}
            </p>
            <div className="flex gap-2 flex-wrap">
                {urgente && r.cliente?.telefonoWhatsapp && (
                    <a
                        href={`https://wa.me/${r.cliente.telefonoWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${r.cliente.nombre}! Tu reserva vence en menos de 30 minutos. ¿Confirmás el pago?`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-4 py-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-black uppercase rounded-xl hover:bg-amber-500/20 transition-colors text-center animate-pulse"
                    >
                        ⚡ Avisar
                    </a>
                )}
                <button
                    onClick={() => onConfirmar(r.id)}
                    disabled={accionando === r.id}
                    className="flex-1 px-4 py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-black uppercase rounded-xl hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                >
                    ✓ Confirmar
                </button>
                <button
                    onClick={() => onCancelar(r.id)}
                    disabled={accionando === r.id}
                    className="flex-1 px-4 py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-black uppercase rounded-xl hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                >
                    ✕ Cancelar
                </button>
            </div>
        </div>
    )
}
