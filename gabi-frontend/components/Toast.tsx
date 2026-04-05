'use client'
import { useState, useCallback, useRef } from 'react'

type ToastType = 'success' | 'error' | 'warning'
type ToastItem = { id: number; message: string; type: ToastType }

// Referencia global — funciona porque solo hay un ToastProvider montado
let _addToast: ((msg: string, type?: ToastType) => void) | null = null

export function toast(message: string, type: ToastType = 'success') {
    _addToast?.(message, type)
}

const styles: Record<ToastType, string> = {
    success: 'bg-zinc-900 border-emerald-500/40 text-emerald-300',
    error:   'bg-zinc-900 border-red-500/40 text-red-300',
    warning: 'bg-zinc-900 border-amber-500/40 text-amber-300',
}
const icons: Record<ToastType, string> = { success: '✓', error: '✕', warning: '⚠' }

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([])
    const counter = useRef(0)

    const addToast = useCallback((message: string, type: ToastType = 'success') => {
        const id = ++counter.current
        setToasts(t => [...t, { id, message, type }])
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
    }, [])

    _addToast = addToast

    return (
        <>
            {children}
            <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: '320px', width: 'calc(100vw - 32px)' }}>
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold shadow-2xl ${styles[t.type]}`}
                        style={{ animation: 'toast-in 0.2s ease-out' }}
                    >
                        <span className="font-black text-base shrink-0">{icons[t.type]}</span>
                        <span className="leading-snug">{t.message}</span>
                    </div>
                ))}
            </div>
        </>
    )
}
