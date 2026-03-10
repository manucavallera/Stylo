'use client'

import { useEffect, useState } from 'react'
import { categoriasApi, tallesApi, proveedoresApi, type CategoriaOTalle, type Proveedor } from '@/lib/api'

type Tab = 'categorias' | 'talles' | 'proveedores' | 'guia'

const TAB_LABELS: Record<Tab, string> = {
    categorias: 'Categorías',
    talles: 'Talles',
    proveedores: 'Proveedores',
    guia: '📖 Guía',
}

export default function ConfiguracionPage() {
    const [tab, setTab] = useState<Tab>('categorias')

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="border-b border-white/5 pb-4">
                <h1 className="text-2xl font-black text-white uppercase">Configuración</h1>
                <p className="text-zinc-500 text-xs uppercase tracking-widest mt-0.5">Categorías · Talles · Proveedores · Guía</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`py-2.5 rounded-xl text-sm font-black uppercase border transition-all ${tab === t ? 'bg-orange-500 text-black border-orange-500' : 'border-white/10 text-zinc-400 hover:border-white/20'}`}
                    >
                        {TAB_LABELS[t]}
                    </button>
                ))}
            </div>

            {tab === 'categorias' && <SeccionSimple titulo="Categorías" apiKey="categorias" api={categoriasApi} />}
            {tab === 'talles' && <SeccionSimple titulo="Talles" apiKey="talles" api={tallesApi} />}
            {tab === 'proveedores' && <SeccionProveedores />}
            {tab === 'guia' && <SeccionGuia />}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

// ── Guía de uso + Roadmap ─────────────────────────────────────────

function SeccionGuia() {
    const [seccion, setSeccion] = useState<'uso' | 'fases'>('uso')

    return (
        <div className="space-y-6">
            <div className="flex gap-2">
                <button
                    onClick={() => setSeccion('uso')}
                    className={`flex-1 py-2 rounded-xl text-xs font-black uppercase border transition-all ${seccion === 'uso' ? 'bg-white/10 text-white border-white/20' : 'border-white/5 text-zinc-500 hover:border-white/10'}`}
                >
                    Cómo usar la app
                </button>
                <button
                    onClick={() => setSeccion('fases')}
                    className={`flex-1 py-2 rounded-xl text-xs font-black uppercase border transition-all ${seccion === 'fases' ? 'bg-white/10 text-white border-white/20' : 'border-white/5 text-zinc-500 hover:border-white/10'}`}
                >
                    Fases del proyecto
                </button>
            </div>

            {seccion === 'uso' && <GuiaUso />}
            {seccion === 'fases' && <GuiaFases />}
        </div>
    )
}

function GuiaUso() {
    const pasos = [
        {
            titulo: '1. Configurar lo básico',
            icono: '⚙️',
            pasos: [
                'Ir a Configuración → Categorías y crear las categorías de ropa (ej: Remeras, Pantalones, Vestidos)',
                'Ir a Talles y cargar los talles que manejás (XS, S, M, L, XL, etc.)',
                'Ir a Proveedores y agregar los mayoristas de donde comprás los fardos',
            ],
        },
        {
            titulo: '2. Cargar un fardo',
            icono: '📦',
            pasos: [
                'Ir a Fardos → Nueva compra',
                'Seleccionar el proveedor, ingresar el costo total y la moneda (ARS o USD)',
                'Indicar el peso y la cantidad aproximada de prendas',
                'Cuando lo abrís físicamente, ir a "Abrir fardo" para que el sistema calcule el costo unitario por prenda',
                'Agregar cada prenda con su categoría, talle y precio de venta',
            ],
        },
        {
            titulo: '3. Gestionar prendas',
            icono: '👗',
            pasos: [
                'Cada prenda tiene un código QR único generado automáticamente',
                'Podés filtrar por estado (disponible, reservado, vendido), categoría o talle',
                'Desde el listado podés editar el precio, marcar fallas o retirar prendas',
            ],
        },
        {
            titulo: '4. Hacer una venta (POS)',
            icono: '🛒',
            pasos: [
                'Ir a POS para ventas en el local',
                'Escanear el QR de la prenda o buscarla por nombre/categoría',
                'Seleccionar método de pago (efectivo, MercadoPago o transferencia)',
                'Confirmar la venta — la prenda pasa automáticamente a "vendido"',
            ],
        },
        {
            titulo: '5. Reservas online',
            icono: '🔒',
            pasos: [
                'Cuando una clienta pide reservar por WhatsApp, ir a Reservas → Nueva reserva',
                'Buscar la prenda, cargar los datos de la cliente y establecer el vencimiento',
                'La prenda queda en estado "reservado" y no puede venderse a otra persona',
                'Al confirmar el pago, convertir la reserva en venta desde el mismo panel',
            ],
        },
        {
            titulo: '6. Caja diaria',
            icono: '💰',
            pasos: [
                'Al abrir el local, ir a Caja → Abrir caja e ingresar el monto inicial en efectivo',
                'Durante el día todas las ventas en efectivo se acumulan automáticamente',
                'Al cerrar, contar el efectivo real e ingresarlo para ver si hay diferencia',
            ],
        },
        {
            titulo: '7. Catálogo público',
            icono: '🌐',
            pasos: [
                'El catálogo en /catalogo es público — podés compartir el link con clientes',
                'Muestra todas las prendas disponibles con fotos, precio y categoría',
                'Las prendas vendidas o reservadas no aparecen',
            ],
        },
    ]

    return (
        <div className="space-y-4">
            {pasos.map((bloque, i) => (
                <div key={i} className="bg-zinc-900 border border-white/5 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">{bloque.icono}</span>
                        <h3 className="text-white font-black text-sm uppercase tracking-wide">{bloque.titulo}</h3>
                    </div>
                    <ul className="space-y-1.5 pl-2">
                        {bloque.pasos.map((p, j) => (
                            <li key={j} className="flex gap-2 text-zinc-400 text-xs leading-relaxed">
                                <span className="text-orange-500 mt-0.5 shrink-0">›</span>
                                {p}
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    )
}

function GuiaFases() {
    const fases = [
        {
            numero: '01',
            nombre: 'Core del negocio',
            estado: 'completada',
            items: [
                'Carga de fardos con cálculo de costo unitario automático',
                'Gestión de prendas con código QR único por prenda',
                'Upload de fotos a Supabase Storage',
                'Sistema de reservas con expiración configurable',
                'POS local con soporte de múltiples métodos de pago',
                'Caja diaria (apertura, cierre y reconciliación)',
                'Catálogo público con filtros',
                'Autenticación con Supabase Auth',
                'Deploy en EasyPanel (backend NestJS + frontend Next.js)',
            ],
        },
        {
            numero: '02',
            nombre: 'Comprobantes y reportes',
            estado: 'proxima',
            items: [
                'Generación de comprobante PDF por venta',
                'Numeración correlativa automática (0001, 0002…)',
                'Dashboard de reportes: ventas por día, semana y mes',
                'ROI por fardo (cuánto ganaste vs lo que costó)',
                'Ranking de categorías y talles más vendidos',
                'Exportar reportes a CSV/Excel',
                'Historial de ventas por cliente',
            ],
        },
        {
            numero: '03',
            nombre: 'WhatsApp y automatizaciones',
            estado: 'futura',
            items: [
                'Notificación automática por WhatsApp al crear una reserva',
                'Recordatorio automático antes de que expire una reserva',
                'Mensaje de confirmación de venta al cliente',
                'Expiración automática de reservas vencidas (n8n)',
                'Alerta cuando el stock de una categoría es bajo',
            ],
        },
        {
            numero: '04',
            nombre: 'AFIP y facturación',
            estado: 'futura',
            items: [
                'Integración con AFIP para emisión de facturas electrónicas',
                'CAE automático por cada venta',
                'Numeración oficial AFIP (ej: 0005-00000123)',
                'Anulación de comprobantes',
                'Libro de IVA exportable',
            ],
        },
    ]

    const colores: Record<string, string> = {
        completada: 'border-emerald-500/30 bg-emerald-500/5',
        proxima: 'border-orange-500/30 bg-orange-500/5',
        futura: 'border-white/10 bg-white/[0.02]',
    }
    const badges: Record<string, string> = {
        completada: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
        proxima: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
        futura: 'bg-zinc-800 text-zinc-500 border border-white/10',
    }
    const labels: Record<string, string> = {
        completada: '✓ Completada',
        proxima: '→ Próxima',
        futura: '○ Futura',
    }

    return (
        <div className="space-y-4">
            {fases.map((fase) => (
                <div key={fase.numero} className={`border rounded-xl p-4 space-y-3 ${colores[fase.estado]}`}>
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl font-black text-white/10 leading-none">{fase.numero}</span>
                            <h3 className="text-white font-black text-sm uppercase tracking-wide">{fase.nombre}</h3>
                        </div>
                        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full whitespace-nowrap ${badges[fase.estado]}`}>
                            {labels[fase.estado]}
                        </span>
                    </div>
                    <ul className="space-y-1.5 pl-2">
                        {fase.items.map((item, j) => (
                            <li key={j} className="flex gap-2 text-zinc-400 text-xs leading-relaxed">
                                <span className={`mt-0.5 shrink-0 ${fase.estado === 'completada' ? 'text-emerald-500' : 'text-orange-500/60'}`}>›</span>
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    )
}
