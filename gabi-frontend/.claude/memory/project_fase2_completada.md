---
name: Fase 2 completada — mejoras UI/UX pendientes de probar
description: Estado al finalizar la sesión de mejoras post-deploy (marzo 2026)
type: project
---

Todo deployado en commit 38df4ea (feat) + bc5d5c7 (fix número) + c59c027 (fix workflow). Pendiente probar el sistema completo.

**Why:** Se implementaron todas las mejoras acordadas en sesión, quedó pendiente la prueba end-to-end.

**How to apply:** En la próxima sesión arrancar directamente con el paso a paso de pruebas.

## Mejoras implementadas (listas para probar)

1. **Botón 📷 Fotos** en fardos ABIERTOS → modal sesión continua de fotos
2. **Foto compartida por ítem** — tras subir, ofrece aplicar la misma foto a prendas de misma categoría+talle
3. **Vista previa antes de publicar** — thumbnails + conteo con/sin foto en modal publicar grupo
4. **Toggle "Incluir sin foto"** — publica prendas sin foto como texto-only al grupo WA
5. **Nota en prendas** — campo opcional, aparece en mensaje WA como 📝, se ve en cursiva en la card
6. **GET /ventas/resumen-diario** — endpoint público para n8n
7. **Workflow 4 n8n** — resumen diario a las 21hs por WA (ya configurado manualmente en n8n)

## Plan de prueba end-to-end

1. Registrar fardo nuevo → abrir con ítems (Remera M x2, Remera L x1)
2. 📷 Fotos → subir fotos, verificar sugerencia de foto compartida para las 2 Remera M
3. 🏷 Etiquetas → imprimir, escanear QR → verificar que abre /p/{id}
4. Publicar grupo → verificar preview → publicar → verificar mensajes en WA con nota
5. Reenviar foto al número tienda → bot reserva → responder SI → verificar en /reservas
6. POS → escanear QR → venta en efectivo → verificar en /caja
7. /reservas → confirmar reserva → verificar caja + prenda VENDIDO
8. n8n → Test workflow resumen diario → verificar WA con datos del día
