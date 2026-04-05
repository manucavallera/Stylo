'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { searchApi, type SearchResult } from '@/lib/api'

const ESTADO_COLORS: Record<string, string> = {
    DISPONIBLE: 'text-emerald-400',
    RESERVADO: 'text-amber-400',
    VENDIDO: 'text-zinc-500',
    FALLA: 'text-red-400',
}

function useDebounce(value: string, delay: number) {
    const [debounced, setDebounced] = useState(value)
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay)
        return () => clearTimeout(t)
    }, [value, delay])
    return debounced
}

export function GlobalSearch() {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<SearchResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const router = useRouter()
    const debouncedQuery = useDebounce(query, 280)

    // Buscar cuando cambia el query debounced
    useEffect(() => {
        if (debouncedQuery.length < 2) {
            setResults(null)
            setLoading(false)
            return
        }
        setLoading(true)
        searchApi.buscar(debouncedQuery)
            .then(r => { setResults(r); setOpen(true) })
            .catch(() => setResults(null))
            .finally(() => setLoading(false))
    }, [debouncedQuery])

    // Cerrar al hacer click afuera
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    // Cmd/Ctrl+K para enfocar
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                inputRef.current?.focus()
                setOpen(true)
            }
            if (e.key === 'Escape') {
                setOpen(false)
                inputRef.current?.blur()
            }
        }
        document.addEventListener('keydown', handleKey)
        return () => document.removeEventListener('keydown', handleKey)
    }, [])

    function navigate(path: string) {
        setOpen(false)
        setQuery('')
        setResults(null)
        router.push(path)
    }

    const total = results
        ? results.prendas.length + results.clientes.length + results.reservas.length
        : 0

    return (
        <div ref={containerRef} className="relative mb-5">
            <div className={`flex items-center gap-2.5 bg-zinc-900 border rounded-xl px-3.5 py-2.5 transition-colors ${open && query.length >= 2 ? 'border-orange-500/40' : 'border-white/8 hover:border-white/15'}`}>
                {loading ? (
                    <span className="text-zinc-500 text-sm animate-spin">⟳</span>
                ) : (
                    <span className="text-zinc-500 text-sm">🔍</span>
                )}
                <input
                    ref={inputRef}
                    value={query}
                    onChange={e => { setQuery(e.target.value); if (e.target.value.length >= 2) setOpen(true) }}
                    onFocus={() => { if (results) setOpen(true) }}
                    placeholder="Buscar prendas, clientes, reservas…"
                    className="flex-1 bg-transparent text-white text-sm placeholder:text-zinc-600 outline-none"
                />
                {query && (
                    <button onClick={() => { setQuery(''); setResults(null); setOpen(false) }} className="text-zinc-600 hover:text-zinc-400 text-sm leading-none">✕</button>
                )}
                <kbd className="hidden sm:block text-[10px] text-zinc-700 border border-zinc-800 rounded px-1.5 py-0.5 font-mono">⌘K</kbd>
            </div>

            {/* Dropdown resultados */}
            {open && query.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-[70vh] overflow-y-auto">
                    {!results || total === 0 ? (
                        <div className="px-4 py-6 text-center text-zinc-500 text-sm">
                            {loading ? 'Buscando…' : `Sin resultados para "${query}"`}
                        </div>
                    ) : (
                        <div className="py-2">
                            {/* Prendas */}
                            {results.prendas.length > 0 && (
                                <section>
                                    <p className="px-4 py-2 text-[10px] text-zinc-600 uppercase tracking-widest font-black">Prendas</p>
                                    {results.prendas.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => navigate(p.estado === 'DISPONIBLE' ? `/pos?prendaId=${p.id}` : `/prendas`)}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                                        >
                                            {p.fotos?.[0] ? (
                                                <img src={p.fotos[0].url} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                                            ) : (
                                                <span className="text-lg w-9 text-center shrink-0">👕</span>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white text-sm font-bold truncate">{p.categoria?.nombre}</p>
                                                <p className="text-zinc-500 text-xs">Talle {p.talle?.nombre}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-orange-400 font-black text-sm">${Number(p.precioPromocional ?? p.precioVenta).toLocaleString('es-AR')}</p>
                                                <p className={`text-xs font-bold ${ESTADO_COLORS[p.estado] ?? 'text-zinc-500'}`}>{p.estado}</p>
                                            </div>
                                        </button>
                                    ))}
                                </section>
                            )}

                            {/* Clientes */}
                            {results.clientes.length > 0 && (
                                <section className={results.prendas.length > 0 ? 'border-t border-white/5 mt-1 pt-1' : ''}>
                                    <p className="px-4 py-2 text-[10px] text-zinc-600 uppercase tracking-widest font-black">Clientes</p>
                                    {results.clientes.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => navigate('/clientes')}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                                        >
                                            <div className="w-9 h-9 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-sm font-black text-zinc-400 shrink-0">
                                                {c.nombre[0].toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white text-sm font-bold">{c.nombre}</p>
                                                {c.telefonoWhatsapp && <p className="text-zinc-500 text-xs">{c.telefonoWhatsapp}</p>}
                                            </div>
                                            <span className="text-zinc-600 text-xs">→ Clientes</span>
                                        </button>
                                    ))}
                                </section>
                            )}

                            {/* Reservas */}
                            {results.reservas.length > 0 && (
                                <section className={(results.prendas.length > 0 || results.clientes.length > 0) ? 'border-t border-white/5 mt-1 pt-1' : ''}>
                                    <p className="px-4 py-2 text-[10px] text-zinc-600 uppercase tracking-widest font-black">Reservas activas</p>
                                    {results.reservas.map(r => (
                                        <button
                                            key={r.id}
                                            onClick={() => navigate('/reservas')}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                                        >
                                            <span className="text-lg w-9 text-center shrink-0">🔒</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white text-sm font-bold truncate">{r.cliente?.nombre ?? 'Sin cliente'}</p>
                                                <p className="text-zinc-500 text-xs">{r.prenda?.categoria?.nombre} · Talle {r.prenda?.talle?.nombre}</p>
                                            </div>
                                            <span className="text-zinc-600 text-xs">→ Reservas</span>
                                        </button>
                                    ))}
                                </section>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
