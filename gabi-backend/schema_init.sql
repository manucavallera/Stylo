-- CreateEnum
CREATE TYPE "Moneda" AS ENUM ('ARS', 'USD');

-- CreateEnum
CREATE TYPE "EstadoFardo" AS ENUM ('PENDIENTE_APERTURA', 'ABIERTO', 'CERRADO');

-- CreateEnum
CREATE TYPE "EstadoPrenda" AS ENUM ('DISPONIBLE', 'RESERVADO', 'VENDIDO', 'RETIRADO', 'FALLA');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('ACTIVA', 'EXPIRADA', 'CONFIRMADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'MERCADOPAGO', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "CanalVenta" AS ENUM ('LOCAL', 'ONLINE');

-- CreateEnum
CREATE TYPE "EstadoCaja" AS ENUM ('ABIERTA', 'CERRADA');

-- CreateEnum
CREATE TYPE "EstadoComprobante" AS ENUM ('EMITIDO', 'ANULADO');

-- CreateTable
CREATE TABLE "proveedores" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fardos" (
    "id" TEXT NOT NULL,
    "proveedor_id" TEXT NOT NULL,
    "fecha_compra" TIMESTAMP(3) NOT NULL,
    "costo_total" DECIMAL(12,2) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "peso_kg" DECIMAL(8,2),
    "total_prendas" INTEGER NOT NULL DEFAULT 0,
    "estado" "EstadoFardo" NOT NULL DEFAULT 'PENDIENTE_APERTURA',
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fardos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talles" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prendas" (
    "id" TEXT NOT NULL,
    "fardo_id" TEXT NOT NULL,
    "categoria_id" TEXT NOT NULL,
    "talle_id" TEXT NOT NULL,
    "costo_unitario" DECIMAL(12,2) NOT NULL,
    "precio_venta" DECIMAL(12,2) NOT NULL,
    "precio_promocional" DECIMAL(12,2),
    "estado" "EstadoPrenda" NOT NULL DEFAULT 'DISPONIBLE',
    "tiene_falla" BOOLEAN NOT NULL DEFAULT false,
    "descripcion_falla" TEXT,
    "qr_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prendas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fotos_prenda" (
    "id" TEXT NOT NULL,
    "prenda_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fotos_prenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono_whatsapp" TEXT,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas" (
    "id" TEXT NOT NULL,
    "prenda_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "fecha_expiracion" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'ACTIVA',
    "comprobante_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caja_diaria" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "monto_apertura" DECIMAL(12,2) NOT NULL,
    "monto_esperado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monto_real" DECIMAL(12,2),
    "diferencia" DECIMAL(12,2),
    "estado" "EstadoCaja" NOT NULL DEFAULT 'ABIERTA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "caja_diaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventas" (
    "id" TEXT NOT NULL,
    "prenda_id" TEXT NOT NULL,
    "reserva_id" TEXT,
    "cliente_id" TEXT,
    "caja_id" TEXT,
    "fecha_venta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "precio_final" DECIMAL(12,2) NOT NULL,
    "costo_historico_ars" DECIMAL(12,2) NOT NULL,
    "metodo_pago" "MetodoPago" NOT NULL,
    "canal_venta" "CanalVenta" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprobantes" (
    "id" TEXT NOT NULL,
    "venta_id" TEXT NOT NULL,
    "numero_correlativo" SERIAL NOT NULL,
    "fecha_emision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoComprobante" NOT NULL DEFAULT 'EMITIDO',
    "pdf_url" TEXT,
    "cae" TEXT,
    "vencimiento_cae" DATE,
    "numero_oficial" TEXT,

    CONSTRAINT "comprobantes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categorias_nombre_key" ON "categorias"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "talles_nombre_key" ON "talles"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "prendas_qr_code_key" ON "prendas"("qr_code");

-- CreateIndex
CREATE INDEX "prendas_estado_idx" ON "prendas"("estado");

-- CreateIndex
CREATE INDEX "prendas_fardo_id_idx" ON "prendas"("fardo_id");

-- CreateIndex
CREATE INDEX "reservas_prenda_id_estado_idx" ON "reservas"("prenda_id", "estado");

-- CreateIndex
CREATE INDEX "reservas_estado_fecha_expiracion_idx" ON "reservas"("estado", "fecha_expiracion");

-- CreateIndex
CREATE UNIQUE INDEX "caja_diaria_fecha_key" ON "caja_diaria"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "ventas_prenda_id_key" ON "ventas"("prenda_id");

-- CreateIndex
CREATE UNIQUE INDEX "ventas_reserva_id_key" ON "ventas"("reserva_id");

-- CreateIndex
CREATE INDEX "ventas_fecha_venta_idx" ON "ventas"("fecha_venta");

-- CreateIndex
CREATE INDEX "ventas_cliente_id_idx" ON "ventas"("cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "comprobantes_venta_id_key" ON "comprobantes"("venta_id");

-- CreateIndex
CREATE UNIQUE INDEX "comprobantes_numero_correlativo_key" ON "comprobantes"("numero_correlativo");

-- AddForeignKey
ALTER TABLE "fardos" ADD CONSTRAINT "fardos_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prendas" ADD CONSTRAINT "prendas_fardo_id_fkey" FOREIGN KEY ("fardo_id") REFERENCES "fardos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prendas" ADD CONSTRAINT "prendas_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prendas" ADD CONSTRAINT "prendas_talle_id_fkey" FOREIGN KEY ("talle_id") REFERENCES "talles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos_prenda" ADD CONSTRAINT "fotos_prenda_prenda_id_fkey" FOREIGN KEY ("prenda_id") REFERENCES "prendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_prenda_id_fkey" FOREIGN KEY ("prenda_id") REFERENCES "prendas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_prenda_id_fkey" FOREIGN KEY ("prenda_id") REFERENCES "prendas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reservas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_caja_id_fkey" FOREIGN KEY ("caja_id") REFERENCES "caja_diaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

