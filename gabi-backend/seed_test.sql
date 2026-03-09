-- ============================================================
-- DATOS DE PRUEBA — Sistema de Gestión Gabi
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Categorías
INSERT INTO categorias (id, nombre, created_at) VALUES
  ('cat-remera',   'Remera',   NOW()),
  ('cat-pantalon', 'Pantalón', NOW()),
  ('cat-campera',  'Campera',  NOW()),
  ('cat-vestido',  'Vestido',  NOW()),
  ('cat-short',    'Short',    NOW()),
  ('cat-buzo',     'Buzo',     NOW())
ON CONFLICT (nombre) DO NOTHING;

-- Talles
INSERT INTO talles (id, nombre, created_at) VALUES
  ('tal-xs',  'XS',  NOW()),
  ('tal-s',   'S',   NOW()),
  ('tal-m',   'M',   NOW()),
  ('tal-l',   'L',   NOW()),
  ('tal-xl',  'XL',  NOW()),
  ('tal-xxl', 'XXL', NOW())
ON CONFLICT (nombre) DO NOTHING;

-- Proveedor
INSERT INTO proveedores (id, nombre, telefono, notas, created_at, updated_at) VALUES
  ('prov-001', 'Distribuidora Americana', '1156789012', 'Proveedor principal de fardos importados', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Cliente de prueba
INSERT INTO clientes (id, nombre, telefono_whatsapp, notas, created_at, updated_at) VALUES
  ('cli-001', 'María González', '1145678901', 'Cliente frecuente', NOW(), NOW()),
  ('cli-002', 'Laura Martínez', '1167890123', NULL, NOW(), NOW())
ON CONFLICT DO NOTHING;
