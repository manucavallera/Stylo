'use client'

import { useEffect, useState } from 'react'
import { categoriasApi, tallesApi, proveedoresApi, type CategoriaOTalle, type Proveedor } from '@/lib/api'

type Tab = 'categorias' | 'talles' | 'proveedores'

export default function ConfiguracionPage() {
    const [tab, setTab] = useState<Tab>('categorias')

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="border-b border-white/5 pb-4">
                <h1 className="text-2xl font-black text-white uppercase">Configuración</h1>
                <p className="text-zinc-500 text-xs uppercase tracking-widest mt-0.5">Categorías · Talles · Proveedores</p>
            </div>

            <div className="flex gap-2">
                {(['categorias', 'talles', 'proveedores'] as Tab[]).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-black uppercase border transition-all ${tab === t ? 'bg-orange-500 text-black border-orange-500' : 'border-white/10 text-zinc-400 hover:border-white/20'}`}
                    >
                        {t === 'categorias' ? '🏷️ Categorías' : t === 'talles' ? '📐 Talles' : '🏭 Proveedores'}
                    </button>
                ))}
            </div>

            {tab === 'categorias' && <SeccionSimple titulo="Categorías" apiKey="categorias" api={categoriasApi} />}
            {tab === 'talles' && <SeccionSimple titulo="Talles" apiKey="talles" api={tallesApi} />}
            {tab === 'proveedores' && <SeccionProveedores />}
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
            <div className="grid grid-cols-2 gap-3">
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
