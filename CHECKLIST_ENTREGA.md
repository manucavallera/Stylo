# Checklist de entrega — Street & Stylo
Correr antes de cada entrega o deploy importante.
Marcar ✅ cuando pasa, ❌ si falla (anotar qué pasó).

---

## 1. Fardos y prendas

- [ ] Crear fardo nuevo con proveedor y fecha → aparece en /fardos
- [ ] Abrir fardo → cargar ítems (categoría, talle, precio, cantidad) → prendas aparecen en /prendas
- [ ] Publicar fardo al grupo WA → llegan mensajes con fotos al grupo
- [ ] Publicar prenda individual al grupo (botón WA en card) → llega mensaje

---

## 2. POS — ventas manuales

- [ ] Abrir /caja → abrir caja con monto de apertura
- [ ] Ir a /pos → aparece banner verde "Caja abierta"
- [ ] Buscar prenda por texto → filtra resultados
- [ ] Seleccionar prenda → precio se pre-carga
- [ ] Cambiar precio y método de pago → confirmar venta
- [ ] Venta aparece en lista "Ventas de hoy" en /caja
- [ ] Monto esperado en caja aumentó solo por ventas EFECTIVO (no MercadoPago/Transferencia)
- [ ] Ticket de venta se puede imprimir

---

## 3. POS — sin caja abierta

- [ ] Sin caja abierta, ir a /pos → aparece banner amarillo con link a /caja
- [ ] Registrar venta igual → aparece en "Ventas sin caja" en /caja (en amarillo)
- [ ] Dashboard muestra alerta de ventas sin caja con el número correcto

---

## 4. Reservas desde el panel

- [ ] Crear reserva manual desde /reservas → prenda pasa a RESERVADO
- [ ] Cliente recibe WA de confirmación de reserva
- [ ] Confirmar reserva → prenda pasa a VENDIDO, suma a caja
- [ ] Cliente recibe WA de confirmación de venta
- [ ] Cancelar reserva → prenda vuelve a DISPONIBLE
- [ ] Cliente recibe WA de cancelación
- [ ] Reserva expirada → prenda vuelve automáticamente a DISPONIBLE (Workflow 2)
- [ ] Cliente recibe WA de expiración

---

## 5. Bot WhatsApp — carrito

- [ ] Cliente reenvía foto de prenda DISPONIBLE → bot responde con precio y cantidad en carrito
- [ ] Cliente reenvía segunda foto → bot acumula y responde con total parcial
- [ ] Cliente reenvía foto de prenda RESERVADA → bot informa hora de expiración
- [ ] Cliente reenvía foto de prenda VENDIDA → bot dice que ya fue vendida
- [ ] Cliente escribe LISTO → bot reserva todo, responde con lista + precios + total + hora límite
- [ ] Gabi recibe WA con lista de prendas, precios y total
- [ ] Las reservas aparecen agrupadas en /reservas con botón "Confirmar todas"
- [ ] Cliente manda foto como comprobante → Gabi recibe la imagen

---

## 6. Confirmar múltiple

- [ ] En /reservas, grupo del mismo cliente tiene botón "Confirmar todas"
- [ ] Click → todas las reservas pasan a VENDIDO en una sola acción
- [ ] Cliente recibe UN SOLO WA con lista completa y total
- [ ] Caja suma correctamente todas las ventas

---

## 7. Caja

- [ ] Abrir caja con monto de apertura → estado ABIERTA
- [ ] Registrar gasto (tipo GASTO) → aparece en lista, resta del monto esperado
- [ ] Registrar retiro (tipo RETIRO) → aparece separado de gastos, resta del monto esperado
- [ ] Cerrar caja con monto real → muestra diferencia correcta
- [ ] Historial de cajas cerradas visible

---

## 8. Balance

- [ ] /balance → KPIs muestran totales del período seleccionado
- [ ] Cambiar período (hoy / semana / mes / custom) → números cambian correctamente
- [ ] Comparación con período anterior muestra % de cambio
- [ ] Desglose por método de pago coincide con ventas reales
- [ ] Exportar CSV → archivo descarga con todas las ventas del período

---

## 9. Clientes

- [ ] /clientes → lista ordenada por total gastado
- [ ] Expandir cliente → ver historial de compras y reservas
- [ ] Crear cliente nuevo → aparece en lista
- [ ] Editar datos → cambios se guardan
- [ ] Buscar cliente por nombre → filtra en tiempo real

---

## 10. Búsqueda global

- [ ] Cmd+K (o click en barra) → abre búsqueda
- [ ] Buscar nombre de categoría → aparecen prendas
- [ ] Buscar nombre de cliente → aparece cliente con link
- [ ] Buscar prenda DISPONIBLE → link va directo al POS pre-cargado
- [ ] ESC → cierra búsqueda

---

## 11. Dashboard

- [ ] Muestra total vendido hoy y cantidad de ventas
- [ ] Stock disponible / reservadas / sin foto con números correctos
- [ ] Si hay ventas sin caja → muestra alerta clickeable que lleva a /caja
- [ ] Métodos de pago muestran los 3 aunque alguno sea $0

---

## 12. Workflow 4 — resumen diario

- [ ] A las 21hs Gabi recibe WA con resumen del día (ventas, métodos, total)

---

## Notas
- Si algo falla, anotar el error exacto y la URL donde ocurrió
- Los toasts de feedback deben aparecer en TODAS las acciones (venta, reserva, caja, etc.)
- En mobile: probar POS, reservas y búsqueda desde el cel de Gabi
