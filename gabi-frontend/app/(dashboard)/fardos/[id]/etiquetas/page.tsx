'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { fardosApi } from '@/lib/api'

const FRONTEND_URL = (process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://americano-stylo.gygo4l.easypanel.host').replace(/\/$/, '')

export default function EtiquetasPage() {
    const params = useParams()
    const id = params.id as string
    const [fardo, setFardo] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fardosApi.uno(id).then((f: any) => {
            setFardo(f)
            setLoading(false)
        })
    }, [id])

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
    )

    if (!fardo) return <div className="p-8 text-center text-zinc-400">Fardo no encontrado</div>

    const prendas = fardo.prendas ?? []

    return (
        <div>
            {/* Barra de acción — se oculta al imprimir */}
            <div className="no-print flex items-center justify-between p-4 border-b border-white/5 bg-zinc-950 sticky top-0 z-10">
                <div>
                    <h1 className="text-white font-black uppercase text-sm">Etiquetas — {fardo.proveedor?.nombre}</h1>
                    <p className="text-zinc-500 text-xs">{prendas.length} prendas</p>
                </div>
                <div className="flex gap-3">
                    <a href="/fardos" className="px-4 py-2 border border-white/10 text-zinc-400 text-xs font-bold uppercase rounded-xl hover:border-white/20 transition-colors">
                        Volver
                    </a>
                    <button
                        onClick={() => window.print()}
                        className="px-5 py-2 bg-orange-500 text-black font-black text-xs uppercase rounded-xl hover:bg-orange-400 transition-colors"
                    >
                        Imprimir
                    </button>
                </div>
            </div>

            {/* Grilla de etiquetas */}
            <div className="etiquetas-grid p-4">
                {prendas.map((prenda: any) => (
                    <Etiqueta key={prenda.id} prenda={prenda} />
                ))}
            </div>

            <style>{`
                .etiquetas-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 8px;
                }

                .etiqueta {
                    border: 1px solid #333;
                    border-radius: 8px;
                    padding: 8px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                    background: #18181b;
                    page-break-inside: avoid;
                    break-inside: avoid;
                }

                .etiqueta-texto {
                    text-align: center;
                    width: 100%;
                }

                @media print {
                    @page {
                        margin: 10mm;
                        size: A4;
                    }

                    body {
                        background: white !important;
                    }

                    .no-print {
                        display: none !important;
                    }

                    .etiquetas-grid {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 6px;
                        padding: 0;
                    }

                    .etiqueta {
                        border: 1px solid #ccc;
                        border-radius: 4px;
                        padding: 6px;
                        background: white !important;
                        color: black !important;
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }

                    .etiqueta-nombre { color: black !important; font-weight: 900; font-size: 11px; }
                    .etiqueta-talle  { color: #555 !important; font-size: 10px; }
                    .etiqueta-precio { color: black !important; font-weight: 900; font-size: 13px; }
                    .etiqueta-id     { color: #999 !important; font-size: 8px; }
                }
            `}</style>
        </div>
    )
}

function Etiqueta({ prenda }: { prenda: any }) {
    const url = `${FRONTEND_URL}/p/${prenda.id}`
    const precio = prenda.precioPromocional ?? prenda.precioVenta
    const nombre = prenda.categoria?.nombre ?? 'Prenda'
    const talle = prenda.talle?.nombre ?? ''

    return (
        <div className="etiqueta">
            <QRCodeSVG value={url} size={90} bgColor="transparent" fgColor="currentColor" />
            <div className="etiqueta-texto">
                <p className="etiqueta-nombre text-white text-xs font-black">{nombre}</p>
                {talle && <p className="etiqueta-talle text-zinc-400 text-xs">Talle {talle}</p>}
                <p className="etiqueta-precio text-orange-400 text-sm font-black">${Number(precio).toLocaleString('es-AR')}</p>
                <p className="etiqueta-id text-zinc-600" style={{ fontSize: '9px' }}>{prenda.id.slice(0, 8)}</p>
            </div>
        </div>
    )
}
