'use client'

import { useEffect, useState } from 'react'
import { categoriasApi, tallesApi, proveedoresApi, gruposWaApi, configuracionApi, type CategoriaOTalle, type Proveedor, type GrupoWhatsapp, type ConfiguracionTienda } from '@/lib/api'

type Tab = 'general' | 'categorias' | 'talles' | 'proveedores' | 'gruposWa' | 'guia'

const TAB_LABELS: Record<Tab, string> = {
    general: '⚙️ General',
    categorias: 'Categorías',
    talles: 'Talles',
    proveedores: 'Proveedores',
    gruposWa: '📲 Grupos WA',
    guia: '📖 Guía',
}

export default function ConfiguracionPage() {
    const [tab, setTab] = useState<Tab>('general')

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="border-b border-white/5 pb-4">
                <h1 className="text-2xl font-black text-white uppercase">Configuración</h1>
                <p className="text-zinc-500 text-xs uppercase tracking-widest mt-0.5">Categorías · Talles · Proveedores · Guía</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`py-2.5 rounded-xl text-sm font-black uppercase border transition-all ${tab === t ? 'bg-orange-500 text-black border-orange-500' : 'border-white/10 text-zinc-400 hover:border-white/20'}`}
                    >
                        {TAB_LABELS[t]}
                    </button>
                ))}
            </div>

            {tab === 'general' && <SeccionGeneral />}
            {tab === 'categorias' && <SeccionSimple titulo="Categorías" apiKey="categorias" api={categoriasApi} />}
            {tab === 'talles' && <SeccionSimple titulo="Talles" apiKey="talles" api={tallesApi} />}
            {tab === 'proveedores' && <SeccionProveedores />}
            {tab === 'gruposWa' && <SeccionGruposWa />}
            {tab === 'guia' && <SeccionGuia />}
        </div>
    )
}

// ── Sección General ──────────────────────────────────────────────
function SeccionGeneral() {
    const [config, setConfig] = useState<ConfiguracionTienda | null>(null)
    const [minutos, setMinutos] = useState('')
    const [alias, setAlias] = useState('')
    const [cvu, setCvu] = useState('')
    const [guardando, setGuardando] = useState(false)
    const [ok, setOk] = useState(false)

    useEffect(() => {
        configuracionApi.get().then(c => {
            setConfig(c)
            setMinutos(String(c.minutosReserva))
            setAlias(c.aliasCobro ?? '')
            setCvu(c.cvuCobro ?? '')
        })
    }, [])

    async function handleGuardar(e: React.FormEvent) {
        e.preventDefault()
        setGuardando(true)
        setOk(false)
        try {
            await configuracionApi.update({
                minutosReserva: Number(minutos),
                aliasCobro: alias || undefined,
                cvuCobro: cvu || undefined,
            })
            setOk(true)
        } finally {
            setGuardando(false)
        }
    }

    if (!config) return <div className="h-24 bg-zinc-900 rounded-2xl animate-pulse" />

    return (
        <div className="space-y-4">
            <h2 className="text-zinc-400 text-xs uppercase tracking-widest font-black">Configuración general</h2>
            <form onSubmit={handleGuardar} className="bg-zinc-900 border border-white/5 rounded-2xl p-5 space-y-4">
                <div>
                    <label className="label">Tiempo de reserva (minutos)</label>
                    <p className="text-zinc-500 text-xs mb-2">Cuánto tiempo tiene el cliente para enviar el comprobante antes que se cancele la reserva automáticamente.</p>
                    <input
                        className="input w-32"
                        type="number"
                        min="1"
                        max="120"
                        value={minutos}
                        onChange={e => setMinutos(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label className="label">Alias de cobro</label>
                    <p className="text-zinc-500 text-xs mb-2">Alias de Mercado Pago o banco al que deben transferir. Se usa para validar comprobantes automáticamente.</p>
                    <input
                        className="input"
                        type="text"
                        placeholder="ej: stylo.ropa.mp"
                        value={alias}
                        onChange={e => setAlias(e.target.value)}
                    />
                </div>
                <div>
                    <label className="label">CVU de cobro <span className="text-zinc-600 normal-case font-normal">(opcional)</span></label>
                    <p className="text-zinc-500 text-xs mb-2">Si usás CBU/CVU además del alias.</p>
                    <input
                        className="input"
                        type="text"
                        placeholder="ej: 0000003100...22"
                        value={cvu}
                        onChange={e => setCvu(e.target.value)}
                    />
                </div>
                {ok && <p className="text-emerald-400 text-sm">✓ Guardado</p>}
                <button type="submit" disabled={guardando} className="px-6 py-2.5 bg-orange-500 text-black font-black text-sm uppercase rounded-xl hover:bg-orange-400 disabled:opacity-50">
                    {guardando ? 'Guardando...' : 'Guardar'}
                </button>
            </form>
        </div>
    )
}

// ── Sección genérica para Categorías y Talles ────────────────────

function SeccionSimple({ titulo, api }: {
    titulo: string
    apiKey: string
    api: typeof categoriasApi | typeof tallesApi
}) {
    const [items, setItems] = useState<CategoriaOTalle[]>([])
    const [loading, setLoading] = useState(true)
    const [nuevo, setNuevo] = useState('')
    const [guardando, setGuardando] = useState(false)
    const [editandoId, setEditandoId] = useState<string | null>(null)
    const [editNombre, setEditNombre] = useState('')
    const [error, setError] = useState('')

    async function cargar() {
        setLoading(true)
        api.listar().then(setItems).finally(() => setLoading(false))
    }

    useEffect(() => { cargar() }, [])

    async function agregar(e: React.FormEvent) {
        e.preventDefault()
        if (!nuevo.trim()) return
        setGuardando(true)
        setError('')
        try {
            await api.crear(nuevo.trim())
            setNuevo('')
            await cargar()
        } catch (e: any) {
            setError(e.message)
        } finally {
            setGuardando(false)
        }
    }

    function iniciarEdicion(item: CategoriaOTalle) {
        setEditandoId(item.id)
        setEditNombre(item.nombre)
        setError('')
    }

    async function guardarEdicion(id: string) {
        if (!editNombre.trim()) return
        setError('')
        try {
            await api.actualizar(id, editNombre.trim())
            setEditandoId(null)
            await cargar()
        } catch (e: any) {
            setError(e.message)
        }
    }

    async function eliminar(id: string, nombre: string) {
        if (!confirm(`¿Eliminar "${nombre}"? Si está en uso no se puede borrar.`)) return
        setError('')
        try {
            await api.eliminar(id)
            await cargar()
        } catch (e: any) {
            setError(e.message)
        }
    }

    return (
        <div className="space-y-4">
            {/* Agregar */}
            <form onSubmit={agregar} className="flex gap-2">
                <input
                    value={nuevo}
                    onChange={e => setNuevo(e.target.value)}
                    placeholder={`Nuevo ${titulo.toLowerCase().slice(0, -1)}...`}
                    className="input flex-1"
                />
                <button
                    type="submit"
                    disabled={guardando || !nuevo.trim()}
                    className="px-5 py-2.5 rounded-xl bg-orange-500 text-black font-black text-sm uppercase hover:bg-orange-400 disabled:opacity-40 transition-all"
                >
                    {guardando ? '...' : '+ Agregar'}
                </button>
            </form>

            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}

            {/* Lista */}
            {loading ? (
                <div className="space-y-2">
                    {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-zinc-900 rounded-xl animate-pulse" />)}
                </div>
            ) : items.length === 0 ? (
                <p className="text-center py-10 text-zinc-500">No hay {titulo.toLowerCase()} todavía</p>
            ) : (
                <div className="space-y-2">
                    {items.map(item => (
                        <div key={item.id} className="flex items-center gap-2 bg-zinc-900 border border-white/5 rounded-xl px-4 py-3">
                            {editandoId === item.id ? (
                                <>
                                    <input
                                        value={editNombre}
                                        onChange={e => setEditNombre(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') guardarEdicion(item.id); if (e.key === 'Escape') setEditandoId(null) }}
                                        className="input flex-1 py-1.5 text-sm"
                                        autoFocus
                                    />
                                    <button onClick={() => guardarEdicion(item.id)} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-black uppercase hover:bg-emerald-500/20">
                                        ✓
                                    </button>
                                    <button onClick={() => setEditandoId(null)} className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 border border-white/10 text-xs font-black hover:border-white/20">
                                        ✕
                                    </button>
                                </>
                            ) : (
                                <>
                                    <span className="text-white text-sm font-bold flex-1">{item.nombre}</span>
                                    <button onClick={() => iniciarEdicion(item)} className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 border border-white/10 text-xs font-bold hover:border-white/20 transition-colors">
                                        ✏️
                                    </button>
                                    <button onClick={() => eliminar(item.id, item.nombre)} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold hover:bg-red-500/20 transition-colors">
                                        🗑
                                    </button>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Sección Proveedores (más campos) ─────────────────────────────

function SeccionProveedores() {
    const [proveedores, setProveedores] = useState<Proveedor[]>([])
    const [loading, setLoading] = useState(true)
    const [mostrarForm, setMostrarForm] = useState(false)
    const [editandoId, setEditandoId] = useState<string | null>(null)
    const [error, setError] = useState('')

    async function cargar() {
        setLoading(true)
        proveedoresApi.listar().then(setProveedores).finally(() => setLoading(false))
    }

    useEffect(() => { cargar() }, [])

    async function eliminar(id: string, nombre: string) {
        if (!confirm(`¿Eliminar proveedor "${nombre}"?`)) return
        setError('')
        try {
            await proveedoresApi.eliminar(id)
            await cargar()
        } catch (e: any) {
            setError(e.message)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button
                    onClick={() => { setMostrarForm(true); setEditandoId(null) }}
                    className="px-5 py-2.5 rounded-xl bg-orange-500 text-black font-black text-sm uppercase hover:bg-orange-400 transition-all"
                >
                    + Agregar
                </button>
            </div>

            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}

            {(mostrarForm && !editandoId) && (
                <FormProveedor
                    onGuardado={() => { setMostrarForm(false); cargar() }}
                    onCancelar={() => setMostrarForm(false)}
                />
            )}

            {loading ? (
                <div className="space-y-2">
                    {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-zinc-900 rounded-xl animate-pulse" />)}
                </div>
            ) : proveedores.length === 0 ? (
                <p className="text-center py-10 text-zinc-500">No hay proveedores todavía</p>
            ) : (
                <div className="space-y-2">
                    {proveedores.map(p => (
                        <div key={p.id}>
                            {editandoId === p.id ? (
                                <FormProveedor
                                    inicial={p}
                                    onGuardado={() => { setEditandoId(null); cargar() }}
                                    onCancelar={() => setEditandoId(null)}
                                />
                            ) : (
                                <div className="flex items-center gap-3 bg-zinc-900 border border-white/5 rounded-xl px-4 py-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white text-sm font-bold">{p.nombre}</p>
                                        {p.telefono && <p className="text-zinc-500 text-xs">{p.telefono}</p>}
                                        {p.notas && <p className="text-zinc-600 text-xs truncate">{p.notas}</p>}
                                    </div>
                                    <button onClick={() => { setEditandoId(p.id); setMostrarForm(false) }} className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 border border-white/10 text-xs font-bold hover:border-white/20 transition-colors">
                                        ✏️
                                    </button>
                                    <button onClick={() => eliminar(p.id, p.nombre)} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold hover:bg-red-500/20 transition-colors">
                                        🗑
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function FormProveedor({
    inicial,
    onGuardado,
    onCancelar,
}: {
    inicial?: Proveedor
    onGuardado: () => void
    onCancelar: () => void
}) {
    const [nombre, setNombre] = useState(inicial?.nombre ?? '')
    const [telefono, setTelefono] = useState(inicial?.telefono ?? '')
    const [notas, setNotas] = useState(inicial?.notas ?? '')
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState('')

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!nombre.trim()) return
        setGuardando(true)
        setError('')
        try {
            const data = { nombre: nombre.trim(), telefono: telefono.trim() || undefined, notas: notas.trim() || undefined }
            if (inicial) {
                await proveedoresApi.actualizar(inicial.id, data)
            } else {
                await proveedoresApi.crear(data)
            }
            onGuardado()
        } catch (e: any) {
            setError(e.message)
            setGuardando(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-orange-500/20 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className="label">Nombre</label>
                    <input value={nombre} onChange={e => setNombre(e.target.value)} className="input" placeholder="Nombre" required autoFocus />
                </div>
                <div>
                    <label className="label">Teléfono <span className="text-zinc-600 font-normal normal-case">(opcional)</span></label>
                    <input value={telefono} onChange={e => setTelefono(e.target.value)} className="input" placeholder="Ej: 2215551234" />
                </div>
            </div>
            <div>
                <label className="label">Notas <span className="text-zinc-600 font-normal normal-case">(opcional)</span></label>
                <input value={notas} onChange={e => setNotas(e.target.value)} className="input" placeholder="Notas sobre el proveedor..." />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-2 justify-end">
                <button type="button" onClick={onCancelar} className="px-4 py-2 rounded-xl border border-white/10 text-zinc-400 text-sm font-bold uppercase">Cancelar</button>
                <button type="submit" disabled={guardando || !nombre.trim()} className="px-4 py-2 rounded-xl bg-orange-500 text-black text-sm font-black uppercase hover:bg-orange-400 disabled:opacity-40 transition-all">
                    {guardando ? 'Guardando...' : inicial ? 'Guardar' : 'Crear'}
                </button>
            </div>
        </form>
    )
}

// ── Sección Grupos WhatsApp ───────────────────────────────────────

function SeccionGruposWa() {
    const [grupos, setGrupos] = useState<GrupoWhatsapp[]>([])
    const [loading, setLoading] = useState(true)
    const [mostrarForm, setMostrarForm] = useState(false)
    const [editandoId, setEditandoId] = useState<string | null>(null)
    const [error, setError] = useState('')

    async function cargar() {
        setLoading(true)
        gruposWaApi.listar().then(setGrupos).finally(() => setLoading(false))
    }

    useEffect(() => { cargar() }, [])

    async function toggleActivo(g: GrupoWhatsapp) {
        try {
            await gruposWaApi.actualizar(g.id, { activo: !g.activo })
            await cargar()
        } catch (e: any) { setError(e.message) }
    }

    async function eliminar(id: string, nombre: string) {
        if (!confirm(`¿Eliminar grupo "${nombre}"?`)) return
        setError('')
        try {
            await gruposWaApi.eliminar(id)
            await cargar()
        } catch (e: any) { setError(e.message) }
    }

    return (
        <div className="space-y-4">
            <div className="bg-zinc-900 border border-white/5 rounded-xl p-4 text-xs text-zinc-500 leading-relaxed">
                Configurá los grupos de WhatsApp donde se publican las prendas.<br />
                <span className="text-zinc-400">Para obtener el ID de un grupo: en n8n, usá el nodo de Evolution API <em>fetchAllGroups</em>, o buscá el valor <code className="bg-zinc-800 px-1 rounded">remoteJid</code> que llega en un mensaje del grupo.</span>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={() => { setMostrarForm(true); setEditandoId(null) }}
                    className="px-5 py-2.5 rounded-xl bg-orange-500 text-black font-black text-sm uppercase hover:bg-orange-400 transition-all"
                >
                    + Agregar grupo
                </button>
            </div>

            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}

            {(mostrarForm && !editandoId) && (
                <FormGrupoWa
                    onGuardado={() => { setMostrarForm(false); cargar() }}
                    onCancelar={() => setMostrarForm(false)}
                />
            )}

            {loading ? (
                <div className="space-y-2">
                    {[...Array(2)].map((_, i) => <div key={i} className="h-16 bg-zinc-900 rounded-xl animate-pulse" />)}
                </div>
            ) : grupos.length === 0 ? (
                <p className="text-center py-10 text-zinc-500">No hay grupos configurados todavía</p>
            ) : (
                <div className="space-y-2">
                    {grupos.map(g => (
                        <div key={g.id}>
                            {editandoId === g.id ? (
                                <FormGrupoWa
                                    inicial={g}
                                    onGuardado={() => { setEditandoId(null); cargar() }}
                                    onCancelar={() => setEditandoId(null)}
                                />
                            ) : (
                                <div className="flex items-center gap-3 bg-zinc-900 border border-white/5 rounded-xl px-4 py-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-white text-sm font-bold">{g.nombre}</p>
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${g.activo ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-800 text-zinc-500 border-white/10'}`}>
                                                {g.activo ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </div>
                                        <p className="text-zinc-500 text-xs font-mono truncate">{g.groupId}</p>
                                    </div>
                                    <button
                                        onClick={() => toggleActivo(g)}
                                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${g.activo ? 'bg-zinc-800 text-zinc-400 border-white/10 hover:border-white/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'}`}
                                    >
                                        {g.activo ? 'Desactivar' : 'Activar'}
                                    </button>
                                    <button onClick={() => { setEditandoId(g.id); setMostrarForm(false) }} className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 border border-white/10 text-xs font-bold hover:border-white/20 transition-colors">
                                        ✏️
                                    </button>
                                    <button onClick={() => eliminar(g.id, g.nombre)} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold hover:bg-red-500/20 transition-colors">
                                        🗑
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function FormGrupoWa({
    inicial,
    onGuardado,
    onCancelar,
}: {
    inicial?: GrupoWhatsapp
    onGuardado: () => void
    onCancelar: () => void
}) {
    const [nombre, setNombre] = useState(inicial?.nombre ?? '')
    const [groupId, setGroupId] = useState(inicial?.groupId ?? '')
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState('')

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!nombre.trim() || !groupId.trim()) return
        setGuardando(true)
        setError('')
        try {
            if (inicial) {
                await gruposWaApi.actualizar(inicial.id, { nombre: nombre.trim(), groupId: groupId.trim() })
            } else {
                await gruposWaApi.crear({ nombre: nombre.trim(), groupId: groupId.trim() })
            }
            onGuardado()
        } catch (e: any) {
            setError(e.message)
            setGuardando(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-orange-500/20 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className="label">Nombre del grupo</label>
                    <input value={nombre} onChange={e => setNombre(e.target.value)} className="input" placeholder="Ej: Ropa Stylo" required autoFocus />
                </div>
                <div>
                    <label className="label">ID del grupo</label>
                    <input value={groupId} onChange={e => setGroupId(e.target.value)} className="input font-mono text-sm" placeholder="Ej: 120363409335446559@g.us" required />
                </div>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-2 justify-end">
                <button type="button" onClick={onCancelar} className="px-4 py-2 rounded-xl border border-white/10 text-zinc-400 text-sm font-bold uppercase">Cancelar</button>
                <button type="submit" disabled={guardando || !nombre.trim() || !groupId.trim()} className="px-4 py-2 rounded-xl bg-orange-500 text-black text-sm font-black uppercase hover:bg-orange-400 disabled:opacity-40 transition-all">
                    {guardando ? 'Guardando...' : inicial ? 'Guardar' : 'Crear'}
                </button>
            </div>
        </form>
    )
}

// ── Guía de uso + Roadmap ─────────────────────────────────────────

function SeccionGuia() {
    const [seccion, setSeccion] = useState<'uso' | 'fases'>('uso')

    return (
        <div className="space-y-6">
            <div className="flex gap-2">
                <button
                    onClick={() => setSeccion('uso')}
                    className={`flex-1 py-2 rounded-xl text-xs font-black uppercase border transition-all ${seccion === 'uso' ? 'bg-white/10 text-white border-white/20' : 'border-white/5 text-zinc-500 hover:border-white/10'}`}
                >
                    Cómo usar la app
                </button>
                <button
                    onClick={() => setSeccion('fases')}
                    className={`flex-1 py-2 rounded-xl text-xs font-black uppercase border transition-all ${seccion === 'fases' ? 'bg-white/10 text-white border-white/20' : 'border-white/5 text-zinc-500 hover:border-white/10'}`}
                >
                    Fases del proyecto
                </button>
            </div>

            {seccion === 'uso' && <GuiaUso />}
            {seccion === 'fases' && <GuiaFases />}
        </div>
    )
}

function GuiaUso() {
    const pasos = [
        {
            titulo: '1. Configurar lo básico',
            icono: '⚙️',
            pasos: [
                'Ir a Configuración → General: ajustar el tiempo de reserva (minutos que tiene el cliente para pagar)',
                'Ir a Categorías y crear las categorías de ropa (ej: Remeras, Pantalones, Vestidos)',
                'Ir a Talles y cargar los talles que manejás (XS, S, M, L, XL, etc.)',
                'Ir a Proveedores y agregar los mayoristas de donde comprás los fardos',
                'Ir a Grupos WA y agregar el ID del grupo de WhatsApp donde publicás las prendas',
            ],
        },
        {
            titulo: '2. Cargar un fardo',
            icono: '📦',
            pasos: [
                'Ir a Fardos → + Nuevo Fardo',
                'Opcionalmente ponerle un nombre al fardo (ej: "Verano #3", "Liquidación invierno")',
                'Seleccionar el proveedor, ingresar el costo total y la moneda (ARS o USD)',
                'Cuando lo abrís físicamente, hacer clic en "Abrir Fardo" — el sistema calcula el costo unitario automáticamente',
                'Agregar cada ítem con categoría, talle, cantidad y precio de venta',
                'Cuando ya no quedan prendas activas, usar "Cerrar" para archivarlo — queda en el historial',
            ],
        },
        {
            titulo: '3. Sacar fotos a las prendas',
            icono: '📷',
            pasos: [
                'Opción 1 — Escaneo individual: escanear el QR de la etiqueta con el celular → abre la página de la prenda → subir foto desde cámara o galería',
                'Opción 2 — Sesión de fotos: desde Fardos → botón 📷 Fotos → sube fotos por categoría/talle sin escanear QR uno por uno',
                'Las fotos se guardan automáticamente en el servidor y quedan asociadas a la prenda',
            ],
        },
        {
            titulo: '4. Imprimir etiquetas',
            icono: '🏷️',
            pasos: [
                'Desde Fardos → botón 🏷 Etiquetas en el fardo abierto',
                'Muestra una grilla con los QRs de todas las prendas, con categoría, talle y precio',
                'Podés imprimir en formato A4 (3 columnas) o térmica',
                'El QR lleva directo a la página pública de la prenda para subir fotos o ver el producto',
            ],
        },
        {
            titulo: '5. Publicar al grupo de WhatsApp',
            icono: '📲',
            pasos: [
                'Desde Fardos → botón "Publicar grupo" en un fardo abierto',
                'Muestra una vista previa con thumbnails y conteo de prendas con/sin foto',
                'Toggle "Incluir sin foto" para publicar prendas sin foto como texto-only',
                'Las fotos se publican con el precio, categoría y un código invisible para el bot de reservas',
                'También podés republicar una sola prenda con el botón WA en la card individual',
            ],
        },
        {
            titulo: '6. Bot de reservas por WhatsApp',
            icono: '🤖',
            pasos: [
                'La clienta reenvía la foto del grupo al número de la tienda',
                'El bot detecta el código invisible en la foto y pregunta "¿Querés reservar? Respondé SI"',
                'Al responder SI, se crea la reserva automáticamente y el bot confirma con foto + hora límite',
                'Si la clienta manda una foto de comprobante, el bot la registra y avisa que Gabi lo está revisando',
                'Gabi confirma el pago manualmente desde la pantalla de Reservas → la prenda pasa a VENDIDO',
                'Si el tiempo vence sin pago, la prenda vuelve automáticamente a disponible',
            ],
        },
        {
            titulo: '7. Hacer una venta (POS)',
            icono: '🛒',
            pasos: [
                'Ir a POS para ventas en el local',
                'Modo "Buscar prenda": filtrar por categoría o talle y seleccionar',
                'Modo "Lector QR": escanear el QR de la etiqueta con un lector físico o cámara',
                'El POS muestra a qué fardo pertenece la prenda',
                'Seleccionar método de pago (Efectivo, MercadoPago o Transferencia) y confirmar',
                'Se genera un ticket imprimible automáticamente',
            ],
        },
        {
            titulo: '8. Caja diaria',
            icono: '💰',
            pasos: [
                'Al abrir el local, ir a Caja → Abrir caja e ingresar el monto inicial en efectivo',
                'Si se hicieron ventas antes de abrir la caja, al abrirla se suman automáticamente',
                'Si cerraste la caja por error, podés reabrirla con el botón "Reabrir Caja"',
                'Durante el día todas las ventas se acumulan — el "Esperado en caja" muestra cuánto debería haber',
                'Al cerrar, contar el efectivo real e ingresarlo para ver si hay diferencia (sobrante o faltante)',
            ],
        },
    ]

    return (
        <div className="space-y-4">
            {pasos.map((bloque, i) => (
                <div key={i} className="bg-zinc-900 border border-white/5 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">{bloque.icono}</span>
                        <h3 className="text-white font-black text-sm uppercase tracking-wide">{bloque.titulo}</h3>
                    </div>
                    <ul className="space-y-1.5 pl-2">
                        {bloque.pasos.map((p, j) => (
                            <li key={j} className="flex gap-2 text-zinc-400 text-xs leading-relaxed">
                                <span className="text-orange-500 mt-0.5 shrink-0">›</span>
                                {p}
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    )
}

function GuiaFases() {
    const fases = [
        {
            numero: '01',
            nombre: 'Core del Negocio',
            estado: 'completada',
            items: [
                'Carga de fardos: Wizard inteligente con cálculo de costo unitario automático',
                'Gestión de stock: Inventario real con filtros por categoría y talle',
                'Upload de fotos: Integración directa con Supabase Storage',
                'POS Local: Punto de venta con soporte de múltiples métodos de pago',
                'Caja Diaria: Apertura, cierre y reconciliación de efectivo y digital',
                'Catálogo Público: Link autogestionado para que los clientes vean el stock 24/7',
            ],
        },
        {
            numero: '02',
            nombre: 'Automatización y Gestión de Reservas',
            estado: 'completada',
            subtitulo: 'Bot de WhatsApp + n8n',
            items: [
                'Bot de reservas: la clienta reenvía la foto del grupo y el bot reserva automáticamente',
                'Timer configurable: el tiempo de reserva se ajusta desde Configuración → General',
                'Visualización de tiempo restante en pantalla de Reservas con alerta cuando está por vencer',
                'Recordatorio automático por WA 15 minutos antes de que venza la reserva',
                'Confirmación de pago: Gabi confirma manualmente → WA automático al cliente',
                'Expiración automática: n8n libera la prenda al catálogo si el tiempo se agota',
                'Publicación a grupos WA: botón para publicar fardo completo o prenda individual',
                'Código invisible en fotos (zero-width encoding) para que el bot identifique la prenda',
                'Resumen diario automático a las 21hs por WhatsApp a Gabi',
                'Página pública /p/[id]: subir foto desde cámara o galería escaneando el QR',
            ],
        },
        {
            numero: '03',
            nombre: 'Escalabilidad e Inteligencia',
            estado: 'proxima',
            subtitulo: 'Lo que viene',
            items: [
                '✓ ROI por fardo: rentabilidad — cuánto se ganó vs. lo que costó cada bulto (ya implementado)',
                '✓ Reporte de "Clavos": prendas con más de 30 días sin venderse (ya implementado)',
                'Liquidación de fardos: reporte de prendas estancadas + botón "Liquidar" con descuento automático y publicación al grupo',
                'Notificar a Gabi: alerta en tiempo real cuando llega una reserva nueva o comprobante',
                'Modo Offline POS: ventas sin internet con sync automático al volver online',
                'Perfiles: Dueño (costos + reportes) vs Vendedor (solo ventas y caja)',
                'Reporte contable: exportación CSV/Excel lista para el contador',
                'Factura electrónica: comprobantes con CAE automático desde la app',
            ],
        },
    ]

    const colores: Record<string, string> = {
        completada: 'border-emerald-500/30 bg-emerald-500/5',
        proxima: 'border-orange-500/30 bg-orange-500/5',
        futura: 'border-white/10 bg-white/[0.02]',
    }
    const badges: Record<string, string> = {
        completada: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
        proxima: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
        futura: 'bg-zinc-800 text-zinc-500 border border-white/10',
    }
    const labels: Record<string, string> = {
        completada: '✓ Completada',
        proxima: '→ Próxima',
        futura: '○ Futura',
    }

    return (
        <div className="space-y-4">
            {fases.map((fase) => (
                <div key={fase.numero} className={`border rounded-xl p-4 space-y-3 ${colores[fase.estado]}`}>
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl font-black text-white/10 leading-none">{fase.numero}</span>
                            <div>
                                <h3 className="text-white font-black text-sm uppercase tracking-wide">{fase.nombre}</h3>
                                {(fase as any).subtitulo && (
                                    <p className="text-zinc-500 text-[10px] uppercase tracking-widest">{(fase as any).subtitulo}</p>
                                )}
                            </div>
                        </div>
                        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full whitespace-nowrap ${badges[fase.estado]}`}>
                            {labels[fase.estado]}
                        </span>
                    </div>
                    <ul className="space-y-1.5 pl-2">
                        {fase.items.map((item, j) => (
                            <li key={j} className="flex gap-2 text-zinc-400 text-xs leading-relaxed">
                                <span className={`mt-0.5 shrink-0 ${fase.estado === 'completada' ? 'text-emerald-500' : 'text-orange-500/60'}`}>›</span>
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    )
}
