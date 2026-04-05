/**
 * Cliente HTTP para comunicarse con el backend NestJS.
 * Adjunta automáticamente el JWT de Supabase como Bearer token.
 */
import { createClient } from '@/lib/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

async function getAuthHeaders(): Promise<Record<string, string>> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    return {
        'Content-Type': 'application/json',
        ...(session?.access_token && {
            Authorization: `Bearer ${session.access_token}`,
        }),
    }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_URL}${path}`, { ...options, headers })

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Error del servidor' }))
        throw new Error(error.message || `Error ${res.status}`)
    }

    if (res.status === 204) return undefined as T
    return res.json()
}

// ── Shortcut methods ─────────────────────────────────────────────
export const api = {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body: unknown) =>
        request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
    put: <T>(path: string, body: unknown) =>
        request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
    delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

// ── Endpoints tipados ────────────────────────────────────────────
export const ventasApi = {
    resumenHoy: () => api.get<ResumenHoy>('/ventas/resumen'),
    hoy: () => api.get<Venta[]>('/ventas/hoy'),
    huerfanas: () => api.get<Venta[]>('/ventas/huerfanas'),
    registrar: (data: NuevaVenta) => api.post<Venta>('/ventas', data),
    anular: (id: string) => api.delete<{ ok: boolean }>(`/ventas/${id}`),
}

export const prendasApi = {
    stats: () => api.get<{ disponibles: number; reservadas: number; sinFoto: number }>('/prendas/stats'),
    uno: (id: string) => api.get<Prenda>(`/prendas/${id}`),
    listar: (params?: Record<string, string>) => {
        const qs = params ? '?' + new URLSearchParams(params).toString() : ''
        return api.get<Prenda[]>(`/prendas${qs}`)
    },
    porQr: (qrCode: string) => api.get<Prenda>(`/prendas/qr/${qrCode}`),
    clavos: (dias = 30) => api.get<Prenda[]>(`/prendas/clavos?dias=${dias}`),
    actualizar: (id: string, data: Partial<Prenda>) => api.put<Prenda>(`/prendas/${id}`, data),
    eliminar: (id: string) => api.delete(`/prendas/${id}`),
    addFoto: (id: string, url: string, orden: number) =>
        api.post<{ id: string; url: string; orden: number }>(`/prendas/${id}/fotos`, { url, orden }),
    removeFoto: (id: string, fotoId: string) => api.delete(`/prendas/${id}/fotos/${fotoId}`),
}

export const fardosApi = {
    listar: () => api.get<Fardo[]>('/fardos'),
    uno: (id: string) => api.get<Fardo>(`/fardos/${id}`),
    crear: (data: NuevoFardo) => api.post<Fardo>('/fardos', data),
    abrir: (id: string, data: AbrirFardo) => api.post(`/fardos/${id}/abrir`, data),
    publicarAlGrupo: (id: string, body?: { sinFoto?: boolean }) => api.post<{ enviadas: number; sinFoto: number; errores: string[] }>(`/fardos/${id}/publicar-grupo`, body ?? {}),
    publicarPrendaAlGrupo: (id: string) => api.post(`/prendas/${id}/publicar-grupo`, {}),
    roi: (id: string) => api.get<RoiFardo>(`/fardos/${id}/roi`),
    historial: () => api.get<Fardo[]>('/fardos/historial'),
    cerrar: (id: string) => api.post(`/fardos/${id}/cerrar`, {}),
    eliminar: (id: string) => api.delete(`/fardos/${id}`),
}

export const reservasApi = {
    activas: () => api.get<Reserva[]>('/reservas/activas'),
    historial: () => api.get<Reserva[]>('/reservas/historial'),
    crear: (data: NuevaReserva) => api.post<Reserva>('/reservas', data),
    confirmar: (id: string, data?: { comprobanteUrl?: string }) =>
        api.post(`/reservas/${id}/confirmar`, data ?? {}),
    confirmarMultiple: (ids: string[], comprobanteUrl?: string) =>
        api.post(`/reservas/confirmar-multiple`, { ids, comprobanteUrl }),
    cancelar: (id: string) => api.post(`/reservas/${id}/cancelar`, {}),
}

export const cajaApi = {
    hoy: () => api.get<Caja>('/caja/hoy'),
    abrir: (montoApertura: number) => api.post<Caja>('/caja/abrir', { montoApertura }),
    cerrar: (id: string, montoReal: number) =>
        api.post<Caja>(`/caja/${id}/cerrar`, { montoReal }),
    historial: () => api.get<Caja[]>('/caja'),
    registrarGasto: (cajaId: string, data: { concepto: string; monto: number }) =>
        api.post<GastoCaja>(`/caja/${cajaId}/gasto`, data),
}

export const clientesApi = {
    listar: () => api.get<Cliente[]>('/clientes'),
    crear: (data: { nombre: string; telefonoWhatsapp?: string; notas?: string }) =>
        api.post<Cliente>('/clientes', data),
}

export const gruposWaApi = {
    listar: () => api.get<GrupoWhatsapp[]>('/grupos-whatsapp'),
    crear: (data: { nombre: string; groupId: string }) => api.post<GrupoWhatsapp>('/grupos-whatsapp', data),
    actualizar: (id: string, data: { nombre?: string; groupId?: string; activo?: boolean }) => api.put<GrupoWhatsapp>(`/grupos-whatsapp/${id}`, data),
    eliminar: (id: string) => api.delete(`/grupos-whatsapp/${id}`),
}

export const proveedoresApi = {
    listar: () => api.get<Proveedor[]>('/proveedores'),
    crear: (data: { nombre: string; telefono?: string; notas?: string }) => api.post<Proveedor>('/proveedores', data),
    actualizar: (id: string, data: { nombre: string; telefono?: string; notas?: string }) => api.put<Proveedor>(`/proveedores/${id}`, data),
    eliminar: (id: string) => api.delete(`/proveedores/${id}`),
}

export const categoriasApi = {
    listar: () => api.get<CategoriaOTalle[]>('/categorias'),
    crear: (nombre: string) => api.post<CategoriaOTalle>('/categorias', { nombre }),
    actualizar: (id: string, nombre: string) => api.put<CategoriaOTalle>(`/categorias/${id}`, { nombre }),
    eliminar: (id: string) => api.delete(`/categorias/${id}`),
}

export const tallesApi = {
    listar: () => api.get<CategoriaOTalle[]>('/talles'),
    crear: (nombre: string) => api.post<CategoriaOTalle>('/talles', { nombre }),
    actualizar: (id: string, nombre: string) => api.put<CategoriaOTalle>(`/talles/${id}`, { nombre }),
    eliminar: (id: string) => api.delete(`/talles/${id}`),
}

// ── Tipos básicos ────────────────────────────────────────────────
export interface ResumenHoy {
    cantidadVentas: number
    totalVendido: number
    totalCosto: number
    gananciaEstimada: number
    porMetodoPago: { metodoPago: string; _sum: { precioFinal: number }; _count: number }[]
}
export interface Prenda { id: string; qrCode: string; estado: string; precioVenta: number; precioPromocional?: number; nota?: string; categoria: { nombre: string }; talle: { nombre: string }; fotos: { url: string }[]; fardo?: { id: string; nombre?: string; fechaCompra: string; proveedor?: { nombre: string } } }
export interface Fardo { id: string; nombre?: string; costoTotal: number; moneda: string; tipoCambio?: number; totalPrendas: number; estado: string; fechaCompra: string; proveedor: { nombre: string } }
export interface Venta { id: string; precioFinal: number; metodoPago: string; canalVenta: string; fechaVenta: string; prenda: Prenda; cliente?: { id: string; nombre: string } | null }
export interface Reserva { id: string; estado: string; fechaExpiracion: string; createdAt: string; prenda: Prenda; cliente: { id: string; nombre: string; telefonoWhatsapp?: string } | null }
export interface GastoCaja { id: string; concepto: string; monto: number; createdAt: string }
export interface Caja { id: string; fecha: string; montoApertura: number; montoEsperado: number; montoReal?: number; diferencia?: number; estado: string; gastos?: GastoCaja[] }
export interface Cliente { id: string; nombre: string; telefonoWhatsapp?: string }
export interface NuevaVenta { prendaId: string; metodoPago: string; canalVenta: string; precioFinal: number; cajaId?: string; clienteId?: string; reservaId?: string }
export interface NuevoFardo { nombre?: string; proveedorId: string; fechaCompra: string; costoTotal: number; moneda: string; tipoCambio?: number; pesoKg?: number }
export interface AbrirFardo { items: { categoriaId: string; talleId: string; cantidad: number; precioVenta: number; tieneFalla?: boolean }[] }
export interface NuevaReserva { prendaId: string; clienteId: string; minutosExpiracion?: number }
export interface RoiFardo { costoFardo: number; totalVendido: number; ganancia: number; roi: number; prendasVendidas: number; totalPrendas: number }
export interface Proveedor { id: string; nombre: string; telefono?: string; notas?: string }
export interface CategoriaOTalle { id: string; nombre: string }
export interface GrupoWhatsapp { id: string; nombre: string; groupId: string; activo: boolean }
export interface ConfiguracionTienda { minutosReserva: number }

export const configuracionApi = {
    get: () => api.get<ConfiguracionTienda>('/configuracion'),
    update: (data: Partial<ConfiguracionTienda>) => api.put<ConfiguracionTienda>('/configuracion', data),
}
