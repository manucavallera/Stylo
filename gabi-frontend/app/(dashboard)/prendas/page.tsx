'use client'

import { useEffect, useState, Suspense, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { prendasApi, fardosApi, categoriasApi, tallesApi, type Prenda, type Fardo } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'

const ESTADOS = ['', 'DISPONIBLE', 'RESERVADO', 'VENDIDO', 'FALLA']
const ESTADO_LABELS: Record<string, string> = { '': 'Todas' }
const ESTADO_COLORS: Record<string, string> = {
    DISPONIBLE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    RESERVADO: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    VENDIDO: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    FALLA: 'bg-red-500/10 text-red-400 border-red-500/20',
}

export default function PrendasPage() {
    return <Suspense fallback={<div className="space-y-4">{[...Array(8)].map((_, i) => <div key={i} className="h-16 bg-zinc-900 rounded-2xl animate-pulse" />)}</div>}><PrendasInner /></Suspense>
}

const TAKE = 40

function PrendasInner() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const fardoIdUrl = searchParams.get('fardoId') ?? undefined
    const estadoUrl = searchParams.get('estado')

    const [prendas, setPrendas] = useState<Prenda[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingMas, setLoadingMas] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const [filtroEstado, setFiltroEstado] = useState(estadoUrl ?? 'DISPONIBLE')
    const [filtroSinFoto, setFiltroSinFoto] = useState(false)
    const [filtroTexto, setFiltroTexto] = useState('')
    const [filtroCategoria, setFiltroCategoria] = useState('')
    const [filtroTalle, setFiltroTalle] = useState('')
    const [filtroFardo, setFiltroFardo] = useState(fardoIdUrl ?? '')
    const [categorias, setCategorias] = useState<{ id: string; nombre: string }[]>([])
    const [talles, setTalles] = useState<{ id: string; nombre: string }[]>([])
    const [fardos, setFardos] = useState<Fardo[]>([])
    const [editando, setEditando] = useState<Prenda | null>(null)
    const skipRef = useRef(0)
    const textoRef = useRef('')

    useEffect(() => {
        categoriasApi.listar().then(setCategorias).catch(() => null)
        tallesApi.listar().then(setTalles).catch(() => null)
        fardosApi.listar().then(setFardos).catch(() => null)
    }, [])

    async function cargar(reset = true) {
        const currentSkip = reset ? 0 : skipRef.current
        if (reset) setLoading(true)
        else setLoadingMas(true)

        const params: Record<string, string> = { take: String(TAKE), skip: String(currentSkip) }
        if (filtroEstado) params.estado = filtroEstado
        if (filtroFardo) params.fardoId = filtroFardo
        if (filtroCategoria) params.categoriaId = filtroCategoria
        if (filtroTalle) params.talleId = filtroTalle
        if (filtroSinFoto) { params.sinFoto = 'true'; params.estado = 'DISPONIBLE' }
        if (textoRef.current) params.search = textoRef.current

        try {
            const result = await prendasApi.listar(params)
            if (reset) setPrendas(result)
            else setPrendas(p => [...p, ...result])
            skipRef.current = currentSkip + result.length
            setHasMore(result.length === TAKE)
        } finally {
            setLoading(false)
            setLoadingMas(false)
        }
    }

    function cambiarEstado(e: string) {
        setFiltroEstado(e)
        setFiltroSinFoto(false)
        skipRef.current = 0
    }

    function toggleSinFoto() {
        setFiltroSinFoto(v => !v)
        skipRef.current = 0
    }

    useEffect(() => {
        textoRef.current = filtroTexto
        skipRef.current = 0
        const t = setTimeout(() => cargar(true), 300)
        return () => clearTimeout(t)
    }, [filtroTexto])

    useEffect(() => { skipRef.current = 0; cargar(true) }, [filtroEstado, filtroSinFoto, filtroCategoria, filtroTalle, filtroFardo])

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
                        {prendas.length} encontradas
                    </p>
                </div>
            </div>

            {/* Búsqueda por texto */}
            <input
                type="search"
                placeholder="Buscar por categoría, talle o nota..."
                value={filtroTexto}
                onChange={e => setFiltroTexto(e.target.value)}
                className="input w-full"
            />

            {/* Filtros por categoría, talle y fardo */}
            <div className="grid grid-cols-3 gap-2">
                <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} className="input text-sm">
                    <option value="">Todas las categorías</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <select value={filtroTalle} onChange={e => setFiltroTalle(e.target.value)} className="input text-sm">
                    <option value="">Todos los talles</option>
                    {talles.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
                <select value={filtroFardo} onChange={e => setFiltroFardo(e.target.value)} className="input text-sm">
                    <option value="">Todos los fardos</option>
                    {fardos.map(f => <option key={f.id} value={f.id}>{f.nombre ?? f.proveedor?.nombre ?? 'Fardo'}</option>)}
                </select>
            </div>

            {/* Filtros de estado */}
            <div className="flex gap-2 flex-wrap">
                {ESTADOS.map(e => (
                    <button
                        key={e}
                        onClick={() => cambiarEstado(e)}
                        className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-all ${!filtroSinFoto && filtroEstado === e
                            ? (ESTADO_COLORS[e] || 'bg-white/10 text-white border-white/20')
                            : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-white'
                        }`}
                    >
                        {ESTADO_LABELS[e] || e}
                    </button>
                ))}
                <button
                    onClick={toggleSinFoto}
                    className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-all ${filtroSinFoto
                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-white'
                    }`}
                >
                    Sin foto
                </button>
            </div>

            {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="aspect-square bg-zinc-900 rounded-2xl animate-pulse" />
                    ))}
                </div>
            ) : prendas.length === 0 ? (
                <div className="text-center py-20 space-y-2">
                    <p className="text-4xl">👕</p>
                    <p className="text-zinc-400 font-bold">Sin prendas{filtroEstado ? ` en estado ${filtroEstado.toLowerCase()}` : ''}</p>
                    <p className="text-zinc-600 text-sm">Abrí un fardo para agregar stock</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {prendas.map(prenda => (
                            <PrendaCard
                                key={prenda.id}
                                prenda={prenda}
                                onEditar={() => setEditando(prenda)}
                                onEliminar={() => handleEliminar(prenda.id)}
                                onFotoAgregada={(id, url) => setPrendas(ps => ps.map(p => p.id === id ? { ...p, fotos: [{ url } as any] } : p))}
                            />
                        ))}
                    </div>
                    {hasMore && (
                        <div className="text-center pt-2">
                            <button
                                onClick={() => cargar(false)}
                                disabled={loadingMas}
                                className="px-6 py-2.5 border border-white/10 text-zinc-400 text-sm font-bold uppercase rounded-xl hover:border-white/20 hover:text-white transition-all disabled:opacity-50"
                            >
                                {loadingMas ? 'Cargando...' : `Cargar más (${prendas.length} mostradas)`}
                            </button>
                        </div>
                    )}
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

function ModalQR({ prenda, onClose }: { prenda: Prenda; onClose: () => void }) {
    const precio = prenda.precioPromocional ?? prenda.precioVenta
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 print:bg-white print:p-0 print:inset-auto print:static" onClick={onClose}>
            <div className="bg-white rounded-2xl p-6 w-64 text-center" onClick={e => e.stopPropagation()}>
                <p className="text-black font-black text-sm uppercase tracking-widest mb-1">STREET & STYLO</p>
                <p className="text-zinc-500 text-xs uppercase mb-3">AMERICAN ★</p>
                {prenda.qrCode && (
                    <img src={prenda.qrCode} alt="QR" className="w-40 h-40 mx-auto" />
                )}
                <p className="text-black font-black text-lg mt-3">{prenda.categoria?.nombre}</p>
                <p className="text-zinc-500 text-sm">Talle {prenda.talle?.nombre}</p>
                <p className="text-black font-black text-xl mt-1">${Number(precio).toLocaleString('es-AR')}</p>
                {prenda.precioPromocional && (
                    <p className="text-zinc-400 text-xs line-through">${Number(prenda.precioVenta).toLocaleString('es-AR')}</p>
                )}
                <div className="flex gap-2 mt-4 print:hidden">
                    <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-zinc-200 text-zinc-500 text-xs font-bold uppercase">Cerrar</button>
                    <button onClick={() => window.print()} className="flex-1 py-2 rounded-xl bg-black text-white text-xs font-black uppercase">Imprimir</button>
                </div>
            </div>
        </div>
    )
}

function PrendaCard({ prenda, onEditar, onEliminar, onFotoAgregada }: { prenda: Prenda; onEditar: () => void; onEliminar: () => void; onFotoAgregada?: (prendaId: string, url: string) => void }) {
    const precio = prenda.precioPromocional ?? prenda.precioVenta
    const [verQR, setVerQR] = useState(false)
    const [publicando, setPublicando] = useState(false)
    const [subiendoFoto, setSubiendoFoto] = useState(false)
    const inputFotoRef = useRef<HTMLInputElement>(null)
    const supabase = createClient()

    async function republicar() {
        if (publicando) return
        setPublicando(true)
        try {
            await fardosApi.publicarPrendaAlGrupo(prenda.id)
        } catch (e: any) {
            alert(e.message)
        } finally {
            setPublicando(false)
        }
    }

    async function handleFotoRapida(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        setSubiendoFoto(true)
        try {
            const ext = file.name.split('.').pop()
            const path = `prendas/${prenda.id}/${Date.now()}.${ext}`
            const { error: uploadError } = await supabase.storage.from('prendas').upload(path, file, { upsert: false })
            if (uploadError) throw new Error(uploadError.message)
            const { data: { publicUrl } } = supabase.storage.from('prendas').getPublicUrl(path)
            await prendasApi.addFoto(prenda.id, publicUrl, 0)
            onFotoAgregada?.(prenda.id, publicUrl)
        } catch (e: any) {
            alert(e.message || 'Error al subir foto')
        } finally {
            setSubiendoFoto(false)
            if (inputFotoRef.current) inputFotoRef.current.value = ''
        }
    }

    return (
        <>
        {verQR && <ModalQR prenda={prenda} onClose={() => setVerQR(false)} />}
        <input ref={inputFotoRef} type="file" accept="image/*" className="hidden" onChange={handleFotoRapida} />
        <div className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden hover:border-orange-500/20 transition-all">
            <div className="aspect-square bg-zinc-800 relative overflow-hidden">
                {prenda.fotos?.[0] ? (
                    <img src={prenda.fotos[0].url} alt="" className="w-full h-full object-cover" />
                ) : (
                    <button
                        type="button"
                        onClick={() => inputFotoRef.current?.click()}
                        disabled={subiendoFoto}
                        className="w-full h-full flex flex-col items-center justify-center gap-2 text-zinc-600 hover:text-orange-400 hover:bg-orange-500/5 transition-all disabled:opacity-40"
                    >
                        {subiendoFoto ? (
                            <span className="text-xs uppercase tracking-widest">Subiendo...</span>
                        ) : (
                            <>
                                <span className="text-3xl">📷</span>
                                <span className="text-[10px] uppercase tracking-widest">Agregar foto</span>
                            </>
                        )}
                    </button>
                )}
                <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full border text-xs font-bold ${ESTADO_COLORS[prenda.estado]}`}>
                    {prenda.estado}
                </div>
            </div>

            <div className="p-3 space-y-2">
                <div>
                    <p className="text-white text-sm font-bold">{prenda.categoria?.nombre}</p>
                    <p className="text-zinc-400 text-xs">Talle {prenda.talle?.nombre}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-orange-400 font-black">${Number(precio).toLocaleString('es-AR')}</span>
                        {prenda.precioPromocional && (
                            <span className="text-zinc-600 text-xs line-through">${Number(prenda.precioVenta).toLocaleString('es-AR')}</span>
                        )}
                    </div>
                    {prenda.nota && (
                        <p className="text-zinc-500 text-xs mt-0.5 truncate italic">{prenda.nota}</p>
                    )}
                    {prenda.fardo && (
                        <p className="text-zinc-600 text-xs mt-0.5 truncate">
                            {prenda.fardo.nombre ?? 'Fardo'}{prenda.fardo.proveedor?.nombre ? ` · ${prenda.fardo.proveedor.nombre}` : ''}
                        </p>
                    )}
                </div>

                {/* Acciones — siempre visibles */}
                <div className="flex gap-1 flex-wrap pt-1 border-t border-white/5">
                    {prenda.estado === 'DISPONIBLE' && (
                        <a
                            href={`/pos?prendaId=${prenda.id}`}
                            className="flex-1 py-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 text-xs font-black uppercase rounded-lg hover:bg-emerald-500/25 text-center transition-colors"
                        >
                            Vender
                        </a>
                    )}
                    <button
                        onClick={onEditar}
                        className="flex-1 py-1.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs font-black uppercase rounded-lg hover:bg-orange-500/20 transition-colors"
                    >
                        Editar
                    </button>
                    <button
                        onClick={() => setVerQR(true)}
                        className="py-1.5 px-2.5 border border-white/10 text-zinc-500 text-xs font-black uppercase rounded-lg hover:border-white/20 hover:text-zinc-300 transition-colors"
                    >
                        QR
                    </button>
                    {prenda.estado === 'DISPONIBLE' && prenda.fotos?.[0] && (
                        <button
                            onClick={republicar}
                            disabled={publicando}
                            className="py-1.5 px-2.5 border border-sky-500/20 text-sky-400 text-xs font-black uppercase rounded-lg hover:bg-sky-500/10 disabled:opacity-40 transition-colors"
                        >
                            {publicando ? '...' : 'WA'}
                        </button>
                    )}
                    <button
                        onClick={onEliminar}
                        className="py-1.5 px-2.5 border border-white/5 text-zinc-700 text-xs font-black uppercase rounded-lg hover:border-red-500/30 hover:text-red-400 transition-colors"
                    >
                        ✕
                    </button>
                </div>
            </div>
        </div>
        </>
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
        nota: prenda.nota ?? '',
        categoriaId: (prenda.categoria as any)?.id ?? '',
        talleId: (prenda.talle as any)?.id ?? '',
    })
    const [categorias, setCategorias] = useState<{ id: string; nombre: string }[]>([])
    const [talles, setTalles] = useState<{ id: string; nombre: string }[]>([])

    useEffect(() => {
        categoriasApi.listar().then(setCategorias).catch(() => null)
        tallesApi.listar().then(setTalles).catch(() => null)
    }, [])
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
                nota: form.nota || null,
            }
            if (form.precioPromocional) data.precioPromocional = Number(form.precioPromocional)
            else data.precioPromocional = null
            if (form.categoriaId) data.categoriaId = form.categoriaId
            if (form.talleId) data.talleId = form.talleId
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
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="label">Categoría</label>
                            <select className="input" value={form.categoriaId} onChange={e => setForm(p => ({ ...p, categoriaId: e.target.value }))}>
                                <option value="">Sin cambiar</option>
                                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label">Talle</label>
                            <select className="input" value={form.talleId} onChange={e => setForm(p => ({ ...p, talleId: e.target.value }))}>
                                <option value="">Sin cambiar</option>
                                {talles.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                            </select>
                        </div>
                    </div>
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
                    <div>
                        <label className="label">Nota <span className="text-zinc-600 normal-case font-normal">opcional — se muestra en el mensaje de WA</span></label>
                        <input
                            className="input"
                            type="text"
                            maxLength={80}
                            placeholder="Ej: Nike, talle real, como nueva"
                            value={form.nota}
                            onChange={e => setForm(p => ({ ...p, nota: e.target.value }))}
                        />
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
