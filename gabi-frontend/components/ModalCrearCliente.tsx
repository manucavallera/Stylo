'use client'

import { useState } from 'react'
import { clientesApi, type Cliente } from '@/lib/api'

export function ModalCrearCliente({
    onClose,
    onCreado,
}: {
    onClose: () => void
    onCreado: (cliente: Cliente) => void
}) {
    const [nombre, setNombre] = useState('')
    const [telefono, setTelefono] = useState('')
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState('')

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setGuardando(true)
        setError('')
        try {
            const cliente = await clientesApi.crear({
                nombre,
                telefonoWhatsapp: telefono || undefined,
            })
            onCreado(cliente)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setGuardando(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
            <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-white/5">
                    <h2 className="text-white font-black uppercase text-sm">Nuevo Cliente</h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl leading-none">✕</button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="label">Nombre</label>
                        <input className="input" type="text" placeholder="Nombre completo" value={nombre} onChange={e => setNombre(e.target.value)} required autoFocus />
                    </div>
                    <div>
                        <label className="label">WhatsApp (opcional)</label>
                        <input className="input" type="tel" placeholder="Ej: 2215551234" value={telefono} onChange={e => setTelefono(e.target.value)} />
                    </div>
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-bold uppercase">Cancelar</button>
                        <button type="submit" disabled={guardando} className="flex-1 py-2.5 rounded-xl bg-orange-500 text-black text-sm font-black uppercase hover:bg-orange-400 disabled:opacity-50">
                            {guardando ? 'Guardando...' : 'Crear'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
