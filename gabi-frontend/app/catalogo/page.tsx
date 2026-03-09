async function getCatalogo() {
    try {
        const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/prendas?estado=DISPONIBLE`,
            { next: { revalidate: 60 } }
        )
        if (!res.ok) return []
        return res.json()
    } catch {
        return []
    }
}

export const metadata = {
    title: 'Catálogo — Street & Stylo American',
    description: 'Ropa americana importada directamente de USA. Street style, calidad premium.',
}

export default async function CatalogoPage() {
    const prendas = await getCatalogo()

    return (
        <div className="min-h-screen bg-black">
            {/* Header */}
            <header className="border-b border-white/10 bg-zinc-950 sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div>
                        <div className="text-lg font-black tracking-tight text-white uppercase leading-none">
                            STREET <span className="text-orange-500">&</span> STYLO
                        </div>
                        <div className="text-[10px] font-black tracking-widest text-orange-500 uppercase">
                            AMERICAN ★
                        </div>
                    </div>
                    <a
                        href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-green-600 hover:bg-green-500 text-white text-sm font-black uppercase tracking-wide transition-all shadow-lg shadow-green-500/20"
                    >
                        💬 Escribinos
                    </a>
                </div>
            </header>

            {/* Hero Banner */}
            <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 py-8">
                <div className="max-w-6xl mx-auto px-4">
                    <p className="text-black text-xs font-black uppercase tracking-widest mb-1">★ Directo desde EE.UU.</p>
                    <h1 className="text-3xl sm:text-4xl font-black text-black uppercase leading-none">
                        PRENDAS IMPORTADAS
                    </h1>
                    <p className="text-black/70 font-bold uppercase text-sm mt-2">Vestimenta única · Calidad premium · Street style</p>
                </div>
            </div>

            {/* Contenido */}
            <main className="max-w-6xl mx-auto px-4 py-8">
                <div className="flex items-center justify-between mb-6">
                    <p className="text-zinc-400 text-sm uppercase tracking-wide font-bold">
                        {prendas.length > 0 ? `${prendas.length} prendas disponibles` : 'Cargando...'}
                    </p>
                </div>

                {prendas.length === 0 ? (
                    <div className="text-center py-20">
                        <p className="text-5xl mb-4">👗</p>
                        <p className="text-zinc-500 text-lg font-bold uppercase">No hay prendas disponibles.</p>
                        <p className="text-zinc-700 text-sm mt-2">Volvé pronto o escribinos por WhatsApp.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {prendas.map((prenda: any) => (
                            <PrendaCard key={prenda.id} prenda={prenda} />
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}

function PrendaCard({ prenda }: { prenda: any }) {
    const precio = prenda.precioPromocional ?? prenda.precioVenta
    const enPromo = !!prenda.precioPromocional

    const waMessage = encodeURIComponent(
        `Hola! Quiero reservar esta prenda 👇\n• ${prenda.categoria?.nombre} talle ${prenda.talle?.nombre}\n• Precio: $${Number(precio).toLocaleString('es-AR')}\n• ID: ${prenda.id.slice(0, 8).toUpperCase()}`
    )
    const waUrl = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP}?text=${waMessage}`

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-orange-500/40 transition-all group">
            <div className="aspect-square bg-zinc-800 relative overflow-hidden">
                {prenda.fotos?.[0] ? (
                    <img src={prenda.fotos[0].url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl text-zinc-700">👗</div>
                )}
                {enPromo && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-sm bg-orange-500 text-black text-xs font-black uppercase">PROMO</div>
                )}
            </div>
            <div className="p-3">
                <p className="text-white text-sm font-bold uppercase">{prenda.categoria?.nombre}</p>
                <p className="text-zinc-500 text-xs uppercase tracking-wide">Talle {prenda.talle?.nombre}</p>
                <div className="flex items-center gap-2 mt-2">
                    <span className="text-orange-400 font-black text-lg">${Number(precio).toLocaleString('es-AR')}</span>
                    {enPromo && <span className="text-zinc-600 text-xs line-through">${Number(prenda.precioVenta).toLocaleString('es-AR')}</span>}
                </div>
                <a href={waUrl} target="_blank" rel="noopener noreferrer"
                    className="mt-3 flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-black uppercase tracking-wide transition-all">
                    💬 Pedir por WhatsApp
                </a>
            </div>
        </div>
    )
}
