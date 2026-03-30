'use client'

import { use, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://manu-stylobackend.gygo4l.easypanel.host/api/v1'

export default function PrendaPublicaPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [prenda, setPrenda] = useState<any>(null)
    const [error, setError] = useState('')
    const [subiendoFoto, setSubiendoFoto] = useState(false)
    const [fotos, setFotos] = useState<string[]>([])
    const [exito, setExito] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const supabase = createClient()

    useEffect(() => {
        fetch(`${API}/prendas/${id}`)
            .then(r => r.ok ? r.json() : Promise.reject('Prenda no encontrada'))
            .then(data => {
                setPrenda(data)
                setFotos((data.fotos ?? []).map((f: any) => f.url))
            })
            .catch(() => setError('Prenda no encontrada'))
    }, [id])

    async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? [])
        if (!files.length) return
        setSubiendoFoto(true)
        setError('')
        try {
            for (const file of files) {
                const ext = file.name.split('.').pop() || 'jpg'
                const path = `prendas/${id}/${Date.now()}.${ext}`
                const { error: uploadError } = await supabase.storage
                    .from('prendas')
                    .upload(path, file, { upsert: false })
                if (uploadError) throw new Error(uploadError.message)

                const { data: { publicUrl } } = supabase.storage.from('prendas').getPublicUrl(path)

                await fetch(`${API}/prendas/${id}/fotos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: publicUrl, orden: fotos.length }),
                })
                setFotos(f => [...f, publicUrl])
            }
            setExito(true)
            setTimeout(() => setExito(false), 3000)
        } catch (e: any) {
            setError(e.message || 'Error al subir foto')
        } finally {
            setSubiendoFoto(false)
            if (inputRef.current) inputRef.current.value = ''
        }
    }

    if (error) return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6">
            <div className="text-center">
                <p className="text-4xl mb-4">👕</p>
                <p className="text-white font-bold">{error}</p>
            </div>
        </div>
    )

    if (!prenda) return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
    )

    const precio = prenda.precioPromocional ?? prenda.precioVenta

    return (
        <div className="min-h-screen bg-black text-white">
            <div className="max-w-sm mx-auto p-5 space-y-5">
                {/* Header */}
                <div className="text-center pt-4">
                    <p className="text-xs font-black tracking-widest text-orange-500 uppercase">STREET & STYLO AMERICAN ★</p>
                </div>

                {/* Foto principal */}
                <div className="aspect-square bg-zinc-900 rounded-2xl overflow-hidden">
                    {fotos.length > 0 ? (
                        <img src={fotos[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-6xl text-zinc-700">👕</div>
                    )}
                </div>

                {/* Info */}
                <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4">
                    <p className="text-white font-black text-xl">{prenda.categoria?.nombre}</p>
                    <p className="text-zinc-400">Talle {prenda.talle?.nombre}</p>
                    <div className="flex items-center gap-2 mt-2">
                        <p className="text-orange-400 font-black text-2xl">${Number(precio).toLocaleString('es-AR')}</p>
                        {prenda.precioPromocional && (
                            <p className="text-zinc-600 line-through">${Number(prenda.precioVenta).toLocaleString('es-AR')}</p>
                        )}
                    </div>
                    <span className={`mt-2 inline-block px-3 py-0.5 rounded-full text-xs font-bold border ${prenda.estado === 'DISPONIBLE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                        {prenda.estado}
                    </span>
                </div>

                {/* Subir fotos */}
                <div className="space-y-3">
                    <p className="text-zinc-400 text-xs uppercase font-bold tracking-widest">Fotos ({fotos.length})</p>
                    {fotos.length > 1 && (
                        <div className="grid grid-cols-3 gap-2">
                            {fotos.slice(1).map((url, i) => (
                                <div key={i} className="aspect-square rounded-xl overflow-hidden bg-zinc-900">
                                    <img src={url} alt="" className="w-full h-full object-cover" />
                                </div>
                            ))}
                        </div>
                    )}
                    <button
                        onClick={() => inputRef.current?.click()}
                        disabled={subiendoFoto}
                        className="w-full py-4 rounded-2xl border-2 border-dashed border-orange-500/40 text-orange-500 font-black uppercase text-sm hover:bg-orange-500/5 transition-all disabled:opacity-50"
                    >
                        {subiendoFoto ? 'Subiendo...' : '+ Agregar foto'}
                    </button>
                    <input ref={inputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handleFoto} />
                </div>

                {exito && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3 text-emerald-400 text-sm font-bold text-center">
                        ✓ Foto guardada correctamente
                    </div>
                )}

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3 text-red-400 text-sm text-center">
                        {error}
                    </div>
                )}
            </div>
        </div>
    )
}
