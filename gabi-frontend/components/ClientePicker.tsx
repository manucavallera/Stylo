'use client'

import { useState, useRef, useEffect } from 'react'
import { type Cliente } from '@/lib/api'
import { ModalCrearCliente } from './ModalCrearCliente'

export function ClientePicker({
    clientes,
    value,
    onChange,
    placeholder = 'Buscar cliente...',
}: {
    clientes: Cliente[]
    value: Cliente | null
    onChange: (c: Cliente | null) => void
    placeholder?: string
}) {
    const [busqueda, setBusqueda] = useState('')
    const [abierto, setAbierto] = useState(false)
    const [modalCrear, setModalCrear] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const filtrados = busqueda
        ? clientes.filter(c => c.nombre.toLowerCase().includes(busqueda.toLowerCase()))
        : clientes

    if (value) {
        return (
            <div className="flex items-center gap-2 bg-zinc-800 border border-white/10 rounded-xl px-4 py-2.5">
                <span className="text-white text-sm font-bold flex-1">{value.nombre}</span>
                {value.telefonoWhatsapp && <span className="text-zinc-500 text-xs">{value.telefonoWhatsapp}</span>}
                <button
                    type="button"
                    onClick={() => onChange(null)}
                    className="text-zinc-500 hover:text-zinc-300 text-sm ml-2"
                >
                    ✕
                </button>
            </div>
        )
    }

    return (
        <div ref={ref} className="relative">
            <div className="flex gap-2">
                <input
                    value={busqueda}
                    onChange={e => { setBusqueda(e.target.value); setAbierto(true) }}
                    onFocus={() => setAbierto(true)}
                    placeholder={placeholder}
                    className="input flex-1"
                />
                <button
                    type="button"
                    onClick={() => setModalCrear(true)}
                    className="px-4 py-2.5 rounded-xl bg-zinc-800 border border-white/10 text-zinc-300 text-sm font-black hover:border-white/20 whitespace-nowrap"
                >
                    + Nuevo
                </button>
            </div>

            {abierto && (
                <div className="absolute z-10 mt-1 w-full bg-zinc-900 border border-white/10 rounded-xl overflow-hidden shadow-xl max-h-48 overflow-y-auto">
                    {filtrados.length === 0 ? (
                        <p className="px-4 py-3 text-zinc-500 text-sm">Sin resultados — usá "+ Nuevo"</p>
                    ) : (
                        filtrados.map(c => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => { onChange(c); setBusqueda(''); setAbierto(false) }}
                                className="w-full text-left px-4 py-2.5 hover:bg-zinc-800 transition-colors border-b border-white/5 last:border-0"
                            >
                                <p className="text-white text-sm font-bold">{c.nombre}</p>
                                {c.telefonoWhatsapp && <p className="text-zinc-500 text-xs">{c.telefonoWhatsapp}</p>}
                            </button>
                        ))
                    )}
                </div>
            )}

            {modalCrear && (
                <ModalCrearCliente
                    onClose={() => setModalCrear(false)}
                    onCreado={c => {
                        onChange(c)
                        setModalCrear(false)
                        setBusqueda('')
                        setAbierto(false)
                    }}
                />
            )}
        </div>
    )
}
