'use client'

import { useEffect, useState, Suspense, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { prendasApi, type Prenda } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'

const ESTADOS = ['DISPONIBLE', 'RESERVADO', 'VENDIDO', 'FALLA']
const ESTADO_COLORS: Record<string, string> = {
    DISPONIBLE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    RESERVADO: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    VENDIDO: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    FALLA: 'bg-red-500/10 text-red-400 border-red-500/20',
}

export default function PrendasPage() {
    return <Suspense fallback={<div className="space-y-4">{[...Array(8)].map((_, i) => <div key={i} className="h-16 bg-zinc-900 rounded-2xl animate-pulse" />)}</div>}><PrendasInner /></Suspense>
}

function PrendasInner() {
    const searchParams = useSearchParams()
    const fardoId = searchParams.get('fardoId') ?? undefined

    const [prendas, setPrendas] = useState<Prenda[]>([])
    const [loading, setLoading] = useState(true)
    const [filtroEstado, setFiltroEstado] = useState('DISPONIBLE')
    const [editando, setEditando] = useState<Prenda | null>(null)

    async function cargar() {
        setLoading(true)
        const params: Record<string, string> = { estado: filtroEstado }
        if (fardoId) params.fardoId = fardoId
        prendasApi.listar(params).then(setPrendas).finally(() => setLoading(false))
    }

    useEffect(() => { cargar() }, [filtroEstado, fardoId])

    async function handleEliminar(id: string) {
        if (!confirm('¿Eliminar esta prenda? Esta acción no se puede deshacer.')) return
        try {
            await prendasApi.eliminar(id)
            setPrendas(p => p.filter(x => x.id !== id))
        } catch (e: any) {
            alert(e.message || 'Error al eliminar')
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white uppercase">Prendas</h1>
                    <p className="text-zinc-500 text-xs uppercase tracking-widest mt-0.5">
                        {prendas.length} encontradas{fardoId && ' · filtradas por fardo'}
                    </p>
                </div>
                {fardoId && (
                    <a href="/fardos" className="px-4 py-2 border border-white/10 text-zinc-400 text-xs font-bold uppercase rounded-xl hover:border-white/20 transition-colors">
                        ← Volver a fardos
                    </a>
                )}
            </div>

            <div className="flex gap-2 flex-wrap">
                {ESTADOS.map(e => (
                    <button
                        key={e}
                        onClick={() => setFiltroEstado(e)}
                        className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-all ${filtroEstado === e
                            ? ESTADO_COLORS[e]
                            : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-white'
                        }`}
                    >
                        {e}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="aspect-square bg-zinc-900 rounded-2xl animate-pulse" />
                    ))}
                </div>
            ) : prendas.length === 0 ? (
                <div className="text-center py-20 text-zinc-500">
                    No hay prendas en estado {filtroEstado}
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {prendas.map(prenda => (
                        <PrendaCard
                            key={prenda.id}
                            prenda={prenda}
                            onEditar={() => setEditando(prenda)}
                            onEliminar={() => handleEliminar(prenda.id)}
                        />
                    ))}
                </div>
            )}

            {editando && (
                <ModalEditarPrenda
                    prenda={editando}
                    onClose={() => setEditando(null)}
                    onGuardado={(actualizada) => {
                        setPrendas(p => p.map(x => x.id === actualizada.id ? actualizada : x))
                        setEditando(null)
                    }}
                />
            )}
        </div>
    )
}

function PrendaCard({ prenda, onEditar, onEliminar }: { prenda: Prenda; onEditar: () => void; onEliminar: () => void }) {
    const precio = prenda.precioPromocional ?? prenda.precioVenta

    return (
        <div className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden hover:border-orange-500/20 transition-all group">
            <div className="aspect-square bg-zinc-800 relative overflow-hidden">
                {prenda.fotos?.[0] ? (
                    <img src={prenda.fotos[0].url} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl text-zinc-700">👗</div>
                )}
                <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full border text-xs font-bold ${ESTADO_COLORS[prenda.estado]}`}>
                    {prenda.estado}
                </div>
                {/* Botones hover */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                        onClick={onEditar}
                        className="px-3 py-1.5 bg-orange-500 text-black text-xs font-black uppercase rounded-lg hover:bg-orange-400"
                    >
                        Editar
                    </button>
                    <button
                        onClick={onEliminar}
                        className="px-3 py-1.5 bg-red-500/80 text-white text-xs font-black uppercase rounded-lg hover:bg-red-500"
                    >
                        Borrar
                    </button>
                </div>
            </div>

            <div className="p-3">
                <p className="text-white text-sm font-bold">{prenda.categoria?.nombre}</p>
                <p className="text-zinc-400 text-xs">Talle {prenda.talle?.nombre}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-orange-400 font-black">${Number(precio).toLocaleString('es-AR')}</span>
                    {prenda.precioPromocional && (
                        <span className="text-zinc-600 text-xs line-through">${Number(prenda.precioVenta).toLocaleString('es-AR')}</span>
                    )}
                </div>
                {prenda.fardo && (
                    <p className="text-zinc-600 text-xs mt-0.5 truncate">
                        {prenda.fardo.proveedor?.nombre ?? 'Fardo'} · {new Date(prenda.fardo.fechaCompra).toLocaleDateString('es-AR')}
                    </p>
                )}
            </div>
        </div>
    )
}

function ModalEditarPrenda({ prenda, onClose, onGuardado }: {
    prenda: Prenda
    onClose: () => void
    onGuardado: (p: Prenda) => void
}) {
    const [form, setForm] = useState({
        precioVenta: String(prenda.precioVenta),
        precioPromocional: String(prenda.precioPromocional ?? ''),
        estado: prenda.estado,
    })
    const [fotos, setFotos] = useState<{ id: string; url: string; orden: number }[]>(
        (prenda.fotos ?? []).map((f, i) => ({ id: (f as any).id ?? String(i), url: f.url, orden: i }))
    )
    const [guardando, setGuardando] = useState(false)
    const [subiendoFoto, setSubiendoFoto] = useState(false)
    const [error, setError] = useState('')
    const inputFotoRef = useRef<HTMLInputElement>(null)
    const supabase = createClient()

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setGuardando(true)
        setError('')
        try {
            const data: Record<string, any> = {
                precioVenta: Number(form.precioVenta),
                estado: form.estado,
            }
            if (form.precioPromocional) data.precioPromocional = Number(form.precioPromocional)
            else data.precioPromocional = null
            const actualizada = await prendasApi.actualizar(prenda.id, data)
            onGuardado({ ...actualizada, fotos })
        } catch (e: any) {
            setError(e.message || 'Error al guardar')
        } finally {
            setGuardando(false)
        }
    }

    async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? [])
        if (!files.length) return
        setSubiendoFoto(true)
        setError('')
        try {
            for (const file of files) {
                const ext = file.name.split('.').pop()
                const path = `prendas/${prenda.id}/${Date.now()}.${ext}`
                const { error: uploadError } = await supabase.storage
                    .from('prendas')
                    .upload(path, file, { upsert: false })
                if (uploadError) throw new Error(uploadError.message)

                const { data: { publicUrl } } = supabase.storage.from('prendas').getPublicUrl(path)
                const orden = fotos.length
                const nueva = await prendasApi.addFoto(prenda.id, publicUrl, orden)
                setFotos(f => [...f, { id: nueva.id, url: publicUrl, orden }])
            }
        } catch (e: any) {
            setError(e.message || 'Error al subir foto')
        } finally {
            setSubiendoFoto(false)
            if (inputFotoRef.current) inputFotoRef.current.value = ''
        }
    }

    async function handleEliminarFoto(fotoId: string, fotoUrl: string) {
        try {
            await prendasApi.removeFoto(prenda.id, fotoId)
            // Eliminar del Storage también
            const urlObj = new URL(fotoUrl)
            const storagePath = urlObj.pathname.split('/object/public/prendas/')[1]
            if (storagePath) await supabase.storage.from('prendas').remove([storagePath])
            setFotos(f => f.filter(x => x.id !== fotoId))
        } catch (e: any) {
            setError(e.message || 'Error al eliminar foto')
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
            <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-zinc-900 z-10">
                    <div>
                        <h2 className="text-white font-black uppercase text-sm tracking-wide">Editar prenda</h2>
                        <p className="text-zinc-500 text-xs mt-0.5">{prenda.categoria?.nombre} · Talle {prenda.talle?.nombre}</p>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl leading-none">✕</button>
                </div>

                {/* Fotos */}
                <div className="p-5 border-b border-white/5 space-y-3">
                    <label className="label">Fotos</label>
                    <div className="grid grid-cols-3 gap-2">
                        {fotos.map(foto => (
                            <div key={foto.id} className="relative aspect-square rounded-xl overflow-hidden group">
                                <img src={foto.url} alt="" className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => handleEliminarFoto(foto.id, foto.url)}
                                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() => inputFotoRef.current?.click()}
                            disabled={subiendoFoto}
                            className="aspect-square rounded-xl border-2 border-dashed border-white/10 hover:border-orange-500/40 flex flex-col items-center justify-center gap-1 text-zinc-600 hover:text-orange-500 transition-all disabled:opacity-40"
                        >
                            {subiendoFoto ? (
                                <span className="text-xs">Subiendo...</span>
                            ) : (
                                <>
                                    <span className="text-2xl">+</span>
                                    <span className="text-[10px] uppercase">Foto</span>
                                </>
                            )}
                        </button>
                    </div>
                    <input
                        ref={inputFotoRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleFotoChange}
                    />
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="label">Precio de venta</label>
                        <input
                            className="input text-lg font-black"
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.precioVenta}
                            onChange={e => setForm(p => ({ ...p, precioVenta: e.target.value }))}
                            required
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="label">Precio promocional <span className="text-zinc-600 normal-case font-normal">opcional</span></label>
                        <input
                            className="input"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Dejar vacío para quitar promo"
                            value={form.precioPromocional}
                            onChange={e => setForm(p => ({ ...p, precioPromocional: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="label">Estado</label>
                        <select
                            className="input"
                            value={form.estado}
                            onChange={e => setForm(p => ({ ...p, estado: e.target.value }))}
                        >
                            {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                            <option value="RETIRADO">RETIRADO</option>
                        </select>
                    </div>
                    {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}
                    <div className="flex gap-3 pt-1">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-bold uppercase hover:border-white/20 transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" disabled={guardando || subiendoFoto} className="flex-1 py-2.5 rounded-xl bg-orange-500 text-black text-sm font-black uppercase hover:bg-orange-400 disabled:opacity-50 transition-colors">
                            {guardando ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
