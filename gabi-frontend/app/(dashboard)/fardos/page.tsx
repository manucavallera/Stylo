'use client'

import { useEffect, useState, useRef } from 'react'
import { fardosApi, prendasApi, proveedoresApi, categoriasApi, tallesApi, type Fardo, type Prenda, type Proveedor, type CategoriaOTalle } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'

const ESTADO_COLORS: Record<string, string> = {
    PENDIENTE_APERTURA: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    ABIERTO: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    CERRADO: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
}

export default function FardosPage() {
    const [fardos, setFardos] = useState<Fardo[]>([])
    const [historial, setHistorial] = useState<Fardo[]>([])
    const [loading, setLoading] = useState(true)
    const [modalNuevo, setModalNuevo] = useState(false)
    const [fardoAbriendo, setFardoAbriendo] = useState<Fardo | null>(null)
    const [fardoAgregando, setFardoAgregando] = useState<Fardo | null>(null)
    const [fardoPublicando, setFardoPublicando] = useState<Fardo | null>(null)
    const [fardoSesionFotos, setFardoSesionFotos] = useState<Fardo | null>(null)

    async function cargar() {
        setLoading(true)
        Promise.all([fardosApi.listar(), fardosApi.historial()])
            .then(([activos, cerrados]) => { setFardos(activos); setHistorial(cerrados) })
            .finally(() => setLoading(false))
    }

    async function handleCerrar(fardo: Fardo) {
        if (!confirm(`¿Cerrar el fardo "${fardo.nombre ?? fardo.proveedor?.nombre}"? Las prendas disponibles quedarán como retiradas.`)) return
        try {
            await fardosApi.cerrar(fardo.id)
            cargar()
        } catch (e: any) { alert(e.message) }
    }

    async function handleEliminar(fardo: Fardo) {
        if (!confirm(`¿Eliminar el fardo "${fardo.nombre ?? fardo.proveedor?.nombre}"?`)) return
        try {
            await fardosApi.eliminar(fardo.id)
            cargar()
        } catch (e: any) { alert(e.message) }
    }

    useEffect(() => { cargar() }, [])

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div>
                    <h1 className="text-2xl font-black text-white uppercase">Fardos</h1>
                    <p className="text-zinc-500 text-xs uppercase tracking-widest mt-0.5">{fardos.length} fardos activos</p>
                </div>
                <button
                    onClick={() => setModalNuevo(true)}
                    className="px-5 py-2.5 bg-orange-500 text-black font-black text-sm uppercase rounded-xl hover:bg-orange-400 transition-colors"
                >
                    + Nuevo Fardo
                </button>
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-zinc-900 rounded-2xl animate-pulse" />)}
                </div>
            ) : fardos.length === 0 ? (
                <div className="text-center py-20 text-zinc-500">No hay fardos activos</div>
            ) : (
                <div className="space-y-3">
                    {fardos.map(f => (
                        <FardoRow
                            key={f.id}
                            fardo={f}
                            onAbrir={() => setFardoAbriendo(f)}
                            onAgregarPrendas={() => setFardoAgregando(f)}
                            onPublicarGrupo={() => setFardoPublicando(f)}
                            onSesionFotos={() => setFardoSesionFotos(f)}
                            onCerrar={() => handleCerrar(f)}
                            onEliminar={() => handleEliminar(f)}
                        />
                    ))}
                </div>
            )}

            {historial.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-zinc-500 text-xs uppercase tracking-widest font-black">Historial de fardos cerrados</h2>
                    <div className="space-y-2">
                        {historial.map(f => (
                            <div key={f.id} className="bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-zinc-400 text-sm font-bold">{f.nombre ?? f.proveedor?.nombre ?? '—'}</p>
                                    <p className="text-zinc-600 text-xs">{new Date(f.fechaCompra).toLocaleDateString('es-AR')} · {f.totalPrendas} prendas · ${Number(f.costoTotal).toLocaleString('es-AR')} {f.moneda}</p>
                                </div>
                                <span className="px-2.5 py-0.5 rounded-full border text-xs font-bold uppercase bg-zinc-500/10 text-zinc-400 border-zinc-500/20">CERRADO</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {modalNuevo && (
                <ModalNuevoFardo
                    onClose={() => setModalNuevo(false)}
                    onCreado={() => { setModalNuevo(false); cargar() }}
                />
            )}

            {fardoAbriendo && (
                <ModalAbrirFardo
                    fardo={fardoAbriendo}
                    onClose={() => setFardoAbriendo(null)}
                    onAbierto={() => { setFardoAbriendo(null); cargar() }}
                />
            )}

            {fardoAgregando && (
                <ModalAbrirFardo
                    fardo={fardoAgregando}
                    titulo={`Agregar prendas — ${fardoAgregando.proveedor?.nombre}`}
                    onClose={() => setFardoAgregando(null)}
                    onAbierto={() => { setFardoAgregando(null); cargar() }}
                />
            )}

            {fardoPublicando && (
                <ModalPublicarGrupo
                    fardo={fardoPublicando}
                    onClose={() => setFardoPublicando(null)}
                />
            )}

            {fardoSesionFotos && (
                <ModalSesionFotos
                    fardo={fardoSesionFotos}
                    onClose={() => setFardoSesionFotos(null)}
                />
            )}
        </div>
    )
}

function FardoRow({ fardo, onAbrir, onAgregarPrendas, onPublicarGrupo, onSesionFotos, onCerrar, onEliminar }: { fardo: Fardo; onAbrir: () => void; onAgregarPrendas: () => void; onPublicarGrupo: () => void; onSesionFotos: () => void; onCerrar: () => void; onEliminar: () => void }) {
    return (
        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                    <span className={`px-2.5 py-0.5 rounded-full border text-xs font-bold uppercase ${ESTADO_COLORS[fardo.estado]}`}>
                        {fardo.estado.replace('_', ' ')}
                    </span>
                    <span className="text-zinc-500 text-xs">{new Date(fardo.fechaCompra).toLocaleDateString('es-AR')}</span>
                </div>
                <p className="text-white font-bold">{fardo.nombre ?? fardo.proveedor?.nombre ?? '—'}</p>
                <p className="text-zinc-400 text-sm">
                    {fardo.nombre && <span className="text-zinc-500">{fardo.proveedor?.nombre} · </span>}
                    ${Number(fardo.costoTotal).toLocaleString('es-AR')} {fardo.moneda}
                    {fardo.totalPrendas > 0 && ` · ${fardo.totalPrendas} prendas`}
                </p>
            </div>
            <div className="flex gap-2 flex-wrap">
                {fardo.estado === 'PENDIENTE_APERTURA' && (
                    <>
                        <button onClick={onAbrir} className="px-4 py-2 bg-orange-500 text-black font-black text-xs uppercase rounded-xl hover:bg-orange-400 transition-colors whitespace-nowrap">
                            Abrir Fardo
                        </button>
                        <button onClick={onEliminar} className="px-4 py-2 border border-red-500/30 text-red-400 font-black text-xs uppercase rounded-xl hover:bg-red-500/10 transition-colors whitespace-nowrap">
                            Eliminar
                        </button>
                    </>
                )}
                {fardo.estado === 'ABIERTO' && (
                    <>
                        <a href={`/prendas?fardoId=${fardo.id}`} className="px-4 py-2 border border-white/10 text-zinc-400 font-black text-xs uppercase rounded-xl hover:border-white/20 transition-colors whitespace-nowrap">
                            Ver ({fardo.totalPrendas})
                        </a>
                        <a href={`/fardos/${fardo.id}/etiquetas`} className="px-4 py-2 border border-violet-500/30 text-violet-400 font-black text-xs uppercase rounded-xl hover:bg-violet-500/10 transition-colors whitespace-nowrap">
                            🏷 Etiquetas
                        </a>
                        <button onClick={onSesionFotos} className="px-4 py-2 border border-amber-500/30 text-amber-400 font-black text-xs uppercase rounded-xl hover:bg-amber-500/10 transition-colors whitespace-nowrap">
                            📷 Fotos
                        </button>
                        <button onClick={onAgregarPrendas} className="px-4 py-2 border border-emerald-500/30 text-emerald-400 font-black text-xs uppercase rounded-xl hover:bg-emerald-500/10 transition-colors whitespace-nowrap">
                            + Agregar
                        </button>
                        <button onClick={onPublicarGrupo} className="px-4 py-2 border border-sky-500/30 text-sky-400 font-black text-xs uppercase rounded-xl hover:bg-sky-500/10 transition-colors whitespace-nowrap">
                            Publicar grupo
                        </button>
                        <button onClick={onCerrar} className="px-4 py-2 border border-zinc-500/30 text-zinc-400 font-black text-xs uppercase rounded-xl hover:bg-zinc-500/10 transition-colors whitespace-nowrap">
                            Cerrar
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}

function ModalNuevoFardo({ onClose, onCreado }: { onClose: () => void; onCreado: () => void }) {
    const [proveedores, setProveedores] = useState<Proveedor[]>([])
    const [form, setForm] = useState({ nombre: '', proveedorId: '', fechaCompra: new Date().toISOString().split('T')[0], costoTotal: '', moneda: 'ARS', tipoCambio: '', pesoKg: '', notas: '' })
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => { proveedoresApi.listar().then(setProveedores) }, [])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!form.proveedorId) { setError('Seleccioná un proveedor'); return }
        setGuardando(true)
        setError('')
        try {
            await fardosApi.crear({
                nombre: form.nombre || undefined,
                proveedorId: form.proveedorId,
                fechaCompra: form.fechaCompra,
                costoTotal: Number(form.costoTotal),
                moneda: form.moneda as 'ARS' | 'USD',
                tipoCambio: form.tipoCambio ? Number(form.tipoCambio) : undefined,
                pesoKg: form.pesoKg ? Number(form.pesoKg) : undefined,
            })
            onCreado()
        } catch (e: any) {
            setError(e.message)
        } finally {
            setGuardando(false)
        }
    }

    return (
        <Modal title="Nuevo Fardo" onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="label">Nombre <span className="text-zinc-600">opcional</span></label>
                    <input className="input" type="text" placeholder="Ej: Fardo verano #3, Liquidación invierno..." value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
                </div>
                <div>
                    <label className="label">Proveedor</label>
                    <select className="input" value={form.proveedorId} onChange={e => setForm(p => ({ ...p, proveedorId: e.target.value }))} required>
                        <option value="">Seleccioná...</option>
                        {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="label">Fecha de compra</label>
                        <input className="input" type="date" value={form.fechaCompra} onChange={e => setForm(p => ({ ...p, fechaCompra: e.target.value }))} required />
                    </div>
                    <div>
                        <label className="label">Moneda</label>
                        <select className="input" value={form.moneda} onChange={e => setForm(p => ({ ...p, moneda: e.target.value }))}>
                            <option value="ARS">ARS</option>
                            <option value="USD">USD</option>
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="label">Costo total ({form.moneda})</label>
                        <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={form.costoTotal} onChange={e => setForm(p => ({ ...p, costoTotal: e.target.value }))} required />
                    </div>
                    <div>
                        <label className="label">Peso (kg) <span className="text-zinc-600">opcional</span></label>
                        <input className="input" type="number" min="0" step="0.1" placeholder="—" value={form.pesoKg} onChange={e => setForm(p => ({ ...p, pesoKg: e.target.value }))} />
                    </div>
                </div>
                {form.moneda === 'USD' && (
                    <div>
                        <label className="label">Tipo de cambio (ARS por USD)</label>
                        <input className="input" type="number" min="0" step="1" placeholder="ej: 1200" value={form.tipoCambio} onChange={e => setForm(p => ({ ...p, tipoCambio: e.target.value }))} required />
                        {form.costoTotal && form.tipoCambio && (
                            <p className="text-xs text-orange-400 mt-1">
                                = ${(Number(form.costoTotal) * Number(form.tipoCambio)).toLocaleString('es-AR')} ARS
                            </p>
                        )}
                    </div>
                )}
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="flex gap-3 pt-2">
                    <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-bold uppercase hover:border-white/20 transition-colors">Cancelar</button>
                    <button type="submit" disabled={guardando} className="flex-1 py-2.5 rounded-xl bg-orange-500 text-black text-sm font-black uppercase hover:bg-orange-400 disabled:opacity-50 transition-colors">
                        {guardando ? 'Guardando...' : 'Registrar'}
                    </button>
                </div>
            </form>
        </Modal>
    )
}

function ModalAbrirFardo({ fardo, titulo, onClose, onAbierto }: { fardo: Fardo; titulo?: string; onClose: () => void; onAbierto: () => void }) {
    const [categorias, setCategorias] = useState<CategoriaOTalle[]>([])
    const [talles, setTalles] = useState<CategoriaOTalle[]>([])
    const [items, setItems] = useState([{ categoriaId: '', talleId: '', cantidad: 1, precioVenta: '', tieneFalla: false }])
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        Promise.all([categoriasApi.listar(), tallesApi.listar()]).then(([cats, tals]) => {
            setCategorias(cats)
            setTalles(tals)
        })
    }, [])

    const totalPrendas = items.reduce((s, i) => s + Number(i.cantidad || 0), 0)
    const costoBaseArs = fardo.moneda === 'USD' && fardo.tipoCambio
        ? Number(fardo.costoTotal) * Number(fardo.tipoCambio)
        : Number(fardo.costoTotal)
    const costoUnitario = totalPrendas > 0 ? costoBaseArs / totalPrendas : 0
    const precioSugerido = Math.round(costoUnitario * 3)

    function addItem() {
        setItems(p => [...p, { categoriaId: '', talleId: '', cantidad: 1, precioVenta: precioSugerido > 0 ? String(precioSugerido) : '', tieneFalla: false }])
    }

    function removeItem(idx: number) {
        setItems(p => p.filter((_, i) => i !== idx))
    }

    function updateItem(idx: number, field: string, value: any) {
        setItems(p => p.map((item, i) => {
            if (i !== idx) return item
            const updated = { ...item, [field]: value }
            // Si marca falla, aplicar -40% automático al precio
            if (field === 'tieneFalla' && value === true && updated.precioVenta) {
                updated.precioVenta = String(Math.round(Number(updated.precioVenta) * 0.6))
            }
            return updated
        }))
    }

    // Cuando cambia totalPrendas y hay costo, sugerir precio en ítems sin precio
    useEffect(() => {
        if (precioSugerido > 0) {
            setItems(p => p.map(item => ({
                ...item,
                precioVenta: item.precioVenta === '' ? String(precioSugerido) : item.precioVenta
            })))
        }
    }, [precioSugerido])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (items.some(i => !i.categoriaId || !i.talleId || !i.precioVenta)) {
            setError('Completá categoría, talle y precio en todos los ítems')
            return
        }
        setGuardando(true)
        setError('')
        try {
            await fardosApi.abrir(fardo.id, {
                items: items.map(i => ({
                    categoriaId: i.categoriaId,
                    talleId: i.talleId,
                    cantidad: Number(i.cantidad),
                    precioVenta: Number(i.precioVenta),
                    tieneFalla: i.tieneFalla,
                })),
            })
            onAbierto()
        } catch (e: any) {
            setError(e.message)
        } finally {
            setGuardando(false)
        }
    }

    return (
        <Modal title={titulo ?? `Abrir Fardo — ${fardo.proveedor?.nombre}`} onClose={onClose}>
            {/* Resumen del fardo */}
            <div className="mb-4 p-3 bg-zinc-800 rounded-xl text-sm grid grid-cols-3 gap-3 text-center">
                <div>
                    <p className="text-zinc-500 text-xs uppercase">Costo total</p>
                    <p className="text-white font-bold">{fardo.moneda === 'USD' ? 'U$D' : '$'}{Number(fardo.costoTotal).toLocaleString('es-AR')}</p>
                    {fardo.moneda === 'USD' && fardo.tipoCambio && (
                        <p className="text-zinc-500 text-xs">${costoBaseArs.toLocaleString('es-AR')} ARS</p>
                    )}
                </div>
                <div>
                    <p className="text-zinc-500 text-xs uppercase">Prendas</p>
                    <p className="text-white font-bold">{totalPrendas}</p>
                </div>
                <div>
                    <p className="text-zinc-500 text-xs uppercase">Costo c/u</p>
                    <p className="text-orange-400 font-bold">${costoUnitario > 0 ? costoUnitario.toLocaleString('es-AR', { maximumFractionDigits: 0 }) : '—'}</p>
                </div>
            </div>

            {precioSugerido > 0 && (
                <p className="text-xs text-zinc-500 mb-3">
                    💡 Precio sugerido (costo × 3): <span className="text-orange-400 font-bold">${precioSugerido.toLocaleString('es-AR')}</span> — podés editarlo por ítem
                </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
                {items.map((item, idx) => {
                    const ganancia = item.precioVenta && costoUnitario > 0
                        ? Number(item.precioVenta) - costoUnitario
                        : null
                    return (
                        <div key={idx} className={`rounded-xl p-3 space-y-2 ${item.tieneFalla ? 'bg-red-500/5 border border-red-500/20' : 'bg-zinc-800'}`}>
                            <div className="flex items-center justify-between">
                                <span className="text-zinc-400 text-xs uppercase font-bold">
                                    Ítem {idx + 1} {item.tieneFalla && <span className="text-red-400">— FALLA (-40%)</span>}
                                </span>
                                {items.length > 1 && (
                                    <button type="button" onClick={() => removeItem(idx)} className="text-red-400 text-xs hover:text-red-300">✕</button>
                                )}
                            </div>

                            {/* Fila principal */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <select className="input" value={item.categoriaId} onChange={e => updateItem(idx, 'categoriaId', e.target.value)} required>
                                    <option value="">Categoría</option>
                                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                                <select className="input" value={item.talleId} onChange={e => updateItem(idx, 'talleId', e.target.value)} required>
                                    <option value="">Talle</option>
                                    {talles.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                                </select>
                                <input className="input" type="number" min="1" value={item.cantidad} onChange={e => updateItem(idx, 'cantidad', e.target.value)} placeholder="Cant." required />
                                <input className="input" type="number" min="0" step="0.01" value={item.precioVenta} onChange={e => updateItem(idx, 'precioVenta', e.target.value)} placeholder="$Precio" required />
                            </div>

                            {/* Fila secundaria */}
                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 text-zinc-400 text-xs cursor-pointer">
                                    <input type="checkbox" checked={item.tieneFalla} onChange={e => updateItem(idx, 'tieneFalla', e.target.checked)} className="accent-red-500" />
                                    Tiene falla (precio −40% automático)
                                </label>
                                {ganancia !== null && (
                                    <span className={`text-xs font-bold ${ganancia > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {ganancia > 0 ? '+' : ''}${ganancia.toLocaleString('es-AR', { maximumFractionDigits: 0 })} c/u
                                    </span>
                                )}
                            </div>
                        </div>
                    )
                })}

                <button type="button" onClick={addItem} className="w-full py-2 rounded-xl border border-dashed border-white/10 text-zinc-500 text-sm hover:border-orange-500/30 hover:text-orange-400 transition-colors">
                    + Agregar ítem
                </button>

                {error && <p className="text-red-400 text-sm">{error}</p>}

                <div className="flex gap-3 pt-2">
                    <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-bold uppercase">Cancelar</button>
                    <button type="submit" disabled={guardando || totalPrendas === 0} className="flex-1 py-2.5 rounded-xl bg-orange-500 text-black text-sm font-black uppercase hover:bg-orange-400 disabled:opacity-50">
                        {guardando ? 'Abriendo...' : `Abrir (${totalPrendas} prendas)`}
                    </button>
                </div>
            </form>
        </Modal>
    )
}

function ModalPublicarGrupo({ fardo, onClose }: { fardo: Fardo; onClose: () => void }) {
    const [estado, setEstado] = useState<'confirm' | 'loading' | 'done'>('confirm')
    const [resultado, setResultado] = useState<{ enviadas: number; sinFoto: number; errores: string[] } | null>(null)
    const [error, setError] = useState('')
    const [prendas, setPrendas] = useState<Prenda[] | null>(null)
    const [incluirSinFoto, setIncluirSinFoto] = useState(false)

    useEffect(() => {
        prendasApi.listar({ fardoId: fardo.id, estado: 'DISPONIBLE' }).then(setPrendas)
    }, [fardo.id])

    const conFoto = prendas?.filter(p => p.fotos?.length > 0) ?? []
    const sinFotoCount = (prendas?.length ?? 0) - conFoto.length

    async function publicar() {
        setEstado('loading')
        setError('')
        try {
            const res = await fardosApi.publicarAlGrupo(fardo.id, incluirSinFoto ? { sinFoto: true } : undefined)
            setResultado(res)
            setEstado('done')
        } catch (e: any) {
            setError(e.message)
            setEstado('confirm')
        }
    }

    return (
        <Modal title="Publicar al grupo de WhatsApp" onClose={onClose}>
            {estado === 'confirm' && (
                <div className="space-y-4">
                    {/* Preview de prendas */}
                    {prendas === null ? (
                        <div className="h-16 bg-zinc-800 rounded-xl animate-pulse" />
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                                    <p className="text-2xl font-black text-emerald-400">{conFoto.length}</p>
                                    <p className="text-emerald-400/70 text-xs uppercase">se van a enviar</p>
                                </div>
                                <div className={`p-3 rounded-xl text-center border ${sinFotoCount > 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-zinc-800 border-white/5'}`}>
                                    <p className={`text-2xl font-black ${sinFotoCount > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>{sinFotoCount}</p>
                                    <p className={`text-xs uppercase ${sinFotoCount > 0 ? 'text-amber-400/70' : 'text-zinc-600'}`}>sin foto — se omiten</p>
                                </div>
                            </div>
                            {/* Thumbnails preview */}
                            {conFoto.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                    {conFoto.slice(0, 6).map(p => (
                                        <div key={p.id} className="flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-zinc-800">
                                            <img src={p.fotos[0].url} alt="" className="w-full h-full object-cover" />
                                        </div>
                                    ))}
                                    {conFoto.length > 6 && (
                                        <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-500 text-xs font-bold">
                                            +{conFoto.length - 6}
                                        </div>
                                    )}
                                </div>
                            )}
                            {conFoto.length === 0 && (
                                <p className="text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                                    No hay prendas con foto para publicar. Usá 📷 Fotos para agregar.
                                </p>
                            )}
                        </>
                    )}
                    {sinFotoCount > 0 && (
                        <label className="flex items-center gap-3 p-3 bg-zinc-800 rounded-xl cursor-pointer">
                            <input
                                type="checkbox"
                                checked={incluirSinFoto}
                                onChange={e => setIncluirSinFoto(e.target.checked)}
                                className="accent-sky-500 w-4 h-4"
                            />
                            <div>
                                <p className="text-zinc-300 text-sm font-bold">Incluir {sinFotoCount} sin foto</p>
                                <p className="text-zinc-500 text-xs">Se publican como texto sin imagen (sin bot de reservas)</p>
                            </div>
                        </label>
                    )}
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-bold uppercase">Cancelar</button>
                        <button
                            type="button"
                            onClick={publicar}
                            disabled={conFoto.length === 0 && !incluirSinFoto}
                            className="flex-1 py-2.5 rounded-xl bg-sky-500 text-black text-sm font-black uppercase hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Publicar {(conFoto.length + (incluirSinFoto ? sinFotoCount : 0)) > 0 ? `(${conFoto.length + (incluirSinFoto ? sinFotoCount : 0)})` : ''}
                        </button>
                    </div>
                </div>
            )}
            {estado === 'loading' && (
                <div className="py-8 text-center space-y-3">
                    <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-zinc-400 text-sm">Enviando prendas al grupo...</p>
                </div>
            )}
            {estado === 'done' && resultado && (
                <div className="space-y-4">
                    <div className="p-4 bg-zinc-800 rounded-xl text-center space-y-1">
                        <p className="text-3xl font-black text-sky-400">{resultado.enviadas}</p>
                        <p className="text-zinc-400 text-sm uppercase tracking-widest">prendas publicadas</p>
                    </div>
                    {resultado.sinFoto > 0 && (
                        <p className="text-zinc-500 text-sm text-center">{resultado.sinFoto} prenda{resultado.sinFoto !== 1 ? 's' : ''} sin foto — no se enviaron</p>
                    )}
                    {resultado.errores.length > 0 && (
                        <div className="p-3 bg-red-500/10 rounded-xl">
                            <p className="text-red-400 text-xs font-bold mb-1">{resultado.errores.length} errores:</p>
                            {resultado.errores.map((e, i) => <p key={i} className="text-red-400 text-xs">{e}</p>)}
                        </div>
                    )}
                    <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-zinc-800 text-white text-sm font-black uppercase hover:bg-zinc-700">
                        Cerrar
                    </button>
                </div>
            )}
        </Modal>
    )
}

function ModalSesionFotos({ fardo, onClose }: { fardo: Fardo; onClose: () => void }) {
    const [prendas, setPrendas] = useState<Prenda[] | null>(null)
    const [sinFoto, setSinFoto] = useState<Prenda[]>([])
    const [indice, setIndice] = useState(0)
    const [subiendoFoto, setSubiendoFoto] = useState(false)
    const [completadas, setCompletadas] = useState(0)
    const [error, setError] = useState('')
    const [similaresPendientes, setSimilaresPendientes] = useState<Prenda[]>([])
    const [urlUltima, setUrlUltima] = useState('')
    const [aplicandoSimilares, setAplicandoSimilares] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const supabase = createClient()

    useEffect(() => {
        prendasApi.listar({ fardoId: fardo.id }).then(todas => {
            setPrendas(todas)
            setSinFoto(todas.filter(p => !p.fotos?.length))
        })
    }, [fardo.id])

    const prenda = sinFoto[indice]
    const total = sinFoto.length

    async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file || !prenda) return
        setSubiendoFoto(true)
        setError('')
        try {
            const ext = file.name.split('.').pop()
            const path = `prendas/${prenda.id}/${Date.now()}.${ext}`
            const { error: uploadError } = await supabase.storage.from('prendas').upload(path, file, { upsert: false })
            if (uploadError) throw new Error(uploadError.message)
            const { data: { publicUrl } } = supabase.storage.from('prendas').getPublicUrl(path)
            await prendasApi.addFoto(prenda.id, publicUrl, 0)
            setCompletadas(c => c + 1)

            // Buscar prendas similares (misma categoría + talle) entre las restantes sin foto
            const restantes = sinFoto.slice(indice + 1)
            const similares = restantes.filter(p =>
                p.categoria?.nombre === prenda.categoria?.nombre &&
                p.talle?.nombre === prenda.talle?.nombre
            )

            if (similares.length > 0) {
                setUrlUltima(publicUrl)
                setSimilaresPendientes(similares)
            } else {
                setIndice(i => i + 1)
            }
        } catch (e: any) {
            setError(e.message || 'Error al subir foto')
        } finally {
            setSubiendoFoto(false)
            if (inputRef.current) inputRef.current.value = ''
        }
    }

    async function aplicarFotoSimilares() {
        setAplicandoSimilares(true)
        try {
            await Promise.all(similaresPendientes.map(p => prendasApi.addFoto(p.id, urlUltima, 0)))
            setCompletadas(c => c + similaresPendientes.length)
            // Sacar similares del array sinFoto para no mostrarlas
            const idsAplicadas = new Set(similaresPendientes.map(p => p.id))
            setSinFoto(prev => {
                const nuevo = prev.filter(p => !idsAplicadas.has(p.id))
                return nuevo
            })
        } catch (e: any) {
            setError(e.message || 'Error al aplicar fotos')
        } finally {
            setSimilaresPendientes([])
            setUrlUltima('')
            setAplicandoSimilares(false)
            setIndice(i => i + 1)
        }
    }

    function rechazarSimilares() {
        setSimilaresPendientes([])
        setUrlUltima('')
        setIndice(i => i + 1)
    }

    function saltar() {
        setIndice(i => i + 1)
    }

    return (
        <Modal title={`Fotos — ${fardo.proveedor?.nombre}`} onClose={onClose}>
            {prendas === null ? (
                <div className="py-8 text-center space-y-3">
                    <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-zinc-400 text-sm">Cargando prendas...</p>
                </div>
            ) : total === 0 ? (
                <div className="py-8 text-center space-y-3">
                    <p className="text-4xl">✅</p>
                    <p className="text-white font-black">Todas las prendas tienen foto</p>
                    <p className="text-zinc-500 text-sm">{prendas.length} prendas en este fardo</p>
                    <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-zinc-800 text-white text-sm font-black uppercase hover:bg-zinc-700">Cerrar</button>
                </div>
            ) : similaresPendientes.length > 0 ? (
                <div className="space-y-4">
                    <div className="p-4 bg-zinc-800 rounded-xl space-y-2">
                        <p className="text-white font-black text-center">
                            Hay {similaresPendientes.length} prenda{similaresPendientes.length !== 1 ? 's' : ''} más de{' '}
                            <span className="text-amber-400">{prenda?.categoria?.nombre} {prenda?.talle?.nombre}</span> sin foto
                        </p>
                        <p className="text-zinc-500 text-sm text-center">¿Aplicar la misma foto a todas?</p>
                        <div className="flex gap-2 justify-center">
                            {similaresPendientes.slice(0, 4).map(p => (
                                <div key={p.id} className="w-14 h-14 rounded-xl bg-zinc-700 flex items-center justify-center text-2xl">👕</div>
                            ))}
                            {similaresPendientes.length > 4 && (
                                <div className="w-14 h-14 rounded-xl bg-zinc-700 flex items-center justify-center text-zinc-500 text-xs font-bold">
                                    +{similaresPendientes.length - 4}
                                </div>
                            )}
                        </div>
                    </div>
                    {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}
                    <button
                        onClick={aplicarFotoSimilares}
                        disabled={aplicandoSimilares}
                        className="w-full py-3 rounded-xl bg-amber-500 text-black font-black text-sm uppercase hover:bg-amber-400 disabled:opacity-50"
                    >
                        {aplicandoSimilares ? 'Aplicando...' : `Sí, aplicar a las ${similaresPendientes.length}`}
                    </button>
                    <button
                        onClick={rechazarSimilares}
                        disabled={aplicandoSimilares}
                        className="w-full py-2.5 rounded-xl border border-white/10 text-zinc-500 text-sm font-bold uppercase hover:border-white/20 hover:text-zinc-400"
                    >
                        No, seguir una por una
                    </button>
                </div>
            ) : indice >= total ? (
                <div className="py-8 text-center space-y-3">
                    <p className="text-4xl">🎉</p>
                    <p className="text-white font-black">{completadas > 0 ? `${completadas} foto${completadas !== 1 ? 's' : ''} cargada${completadas !== 1 ? 's' : ''}` : 'Sesión terminada'}</p>
                    {total - completadas > 0 && (
                        <p className="text-zinc-500 text-sm">{total - completadas} prenda{total - completadas !== 1 ? 's' : ''} sin foto todavía</p>
                    )}
                    <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-zinc-800 text-white text-sm font-black uppercase hover:bg-zinc-700">Cerrar</button>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Progreso */}
                    <div className="flex items-center justify-between text-xs text-zinc-500 uppercase">
                        <span>Prenda {indice + 1} de {total} sin foto</span>
                        <span className="text-emerald-400 font-bold">{completadas} listas ✓</span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-1.5">
                        <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${((indice) / total) * 100}%` }} />
                    </div>

                    {/* Info prenda */}
                    <div className="p-4 bg-zinc-800 rounded-xl text-center space-y-1">
                        <p className="text-white font-black text-lg">{prenda.categoria?.nombre}</p>
                        <p className="text-zinc-400 text-sm">Talle {prenda.talle?.nombre}</p>
                        <p className="text-orange-400 font-black">${Number(prenda.precioVenta).toLocaleString('es-AR')}</p>
                    </div>

                    {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}

                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handleFoto}
                    />

                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={subiendoFoto}
                        className="w-full py-4 rounded-xl bg-amber-500 text-black font-black text-sm uppercase hover:bg-amber-400 disabled:opacity-50 transition-colors"
                    >
                        {subiendoFoto ? 'Subiendo...' : '📷 Sacar foto'}
                    </button>

                    <button
                        type="button"
                        onClick={saltar}
                        disabled={subiendoFoto}
                        className="w-full py-2.5 rounded-xl border border-white/10 text-zinc-500 text-sm font-bold uppercase hover:border-white/20 hover:text-zinc-400 transition-colors"
                    >
                        Saltar →
                    </button>
                </div>
            )}
        </Modal>
    )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70" onClick={onClose}>
            <div className="bg-zinc-900 border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/5 sticky top-0 bg-zinc-900 z-10">
                    <h2 className="text-white font-black uppercase text-sm tracking-wide">{title}</h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors text-xl leading-none">✕</button>
                </div>
                <div className="p-4 sm:p-5">{children}</div>
            </div>
        </div>
    )
}
