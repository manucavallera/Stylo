/**
 * Script de testing E2E para Gabi Backend
 * Cubre todos los casos del CHECKLIST_ENTREGA.md (sin WA ni workflows externos)
 *
 * Uso: npx ts-node scripts/test-e2e.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BASE = process.env.BASE_URL ?? 'http://localhost:3001/api/v1';
let AUTH_TOKEN = '';

// ─── helpers ────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function ok(label: string) {
  console.log(`  ✅ ${label}`);
  passed++;
}

function fail(label: string, detail?: string) {
  const msg = detail ? `${label} → ${detail}` : label;
  console.log(`  ❌ ${msg}`);
  failed++;
  failures.push(msg);
}

async function req(
  method: string,
  path: string,
  body?: object,
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (AUTH_TOKEN) headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data };
}

async function getAuthToken(): Promise<string> {
  // Usa el Supabase Admin API para listar usuarios y crear una sesión de prueba
  // Sin necesidad de password: creamos un link mágico o usamos service role
  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Listar usuarios existentes
  const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1`, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
  });
  const listData = await listRes.json() as any;
  const users = listData?.users ?? listData;

  if (!Array.isArray(users) || users.length === 0) {
    throw new Error('No hay usuarios en Supabase — creá uno en el panel de Supabase');
  }

  const userId = users[0].id;
  const userEmail = users[0].email;

  // Crear sesión con service role (admin)
  const sessionRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}/generate_link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ type: 'magiclink' }),
  });

  // Si generate_link no funciona, usamos sign-in bypass
  // Alternativa: usar el endpoint de token directo
  const tokenRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_ANON_KEY!,
    },
    body: JSON.stringify({
      email: userEmail,
      password: process.env.TEST_USER_PASSWORD ?? 'test1234',
    }),
  });

  if (tokenRes.ok) {
    const tokenData = await tokenRes.json() as any;
    if (tokenData.access_token) {
      console.log(`  🔑 Auth: login como ${userEmail}`);
      return tokenData.access_token;
    }
  }

  // Si no tiene password conocida, crear usuario de prueba nuevo
  const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      email: 'test-e2e@gabi.local',
      password: 'testE2E1234!',
      email_confirm: true,
    }),
  });
  const createData = await createRes.json() as any;

  // Login con el nuevo usuario
  const loginRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_ANON_KEY!,
    },
    body: JSON.stringify({
      email: 'test-e2e@gabi.local',
      password: 'testE2E1234!',
    }),
  });
  const loginData = await loginRes.json() as any;

  if (loginData.access_token) {
    console.log('  🔑 Auth: usuario test-e2e@gabi.local');
    return loginData.access_token;
  }

  throw new Error(`No se pudo obtener token: ${JSON.stringify(loginData)}`);
}

function section(title: string) {
  console.log(`\n${'─'.repeat(55)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(55));
}

// ─── tests ──────────────────────────────────────────────────────────────────

async function testHealth() {
  section('0. Health');
  const { status, data } = await req('GET', '/health');
  if (status === 200 && data?.status === 'ok') {
    ok('Backend responde y DB conectada');
    if (data.checks?.evolution?.status === 'ok') ok('Evolution API ok');
    else fail('Evolution API no disponible', data.checks?.evolution?.error);
    if (data.checks?.n8n?.status === 'ok') ok('n8n ok');
    else fail('n8n no disponible', data.checks?.n8n?.error);
  } else {
    fail('Health check', `status ${status}`);
  }
}

async function testFardosYPrendas() {
  section('1. Fardos y prendas');

  // Listar fardos existentes
  const { status: ls, data: fardos } = await req('GET', '/fardos');
  if (ls === 200 && Array.isArray(fardos)) ok('GET /fardos — lista OK');
  else return fail('GET /fardos', `status ${ls}`);

  // Crear proveedor de prueba o reusar existente
  const { data: proveedores } = await req('GET', '/proveedores');
  let proveedorId: string;
  if (Array.isArray(proveedores) && proveedores.length > 0) {
    proveedorId = proveedores[0].id;
    ok(`Proveedor existente: ${proveedores[0].nombre}`);
  } else {
    const { status: cp, data: prov } = await req('POST', '/proveedores', {
      nombre: 'Proveedor Test E2E',
      telefono: '1122334455',
    });
    if (cp === 201 && prov?.id) {
      proveedorId = prov.id;
      ok('Crear proveedor test');
    } else {
      fail('Crear proveedor', `status ${cp} — ${JSON.stringify(prov)}`);
      proveedorId = '';
    }
  }

  if (!proveedorId) return;

  // Crear fardo
  const { status: cf, data: fardo } = await req('POST', '/fardos', {
    proveedorId,
    fechaCompra: new Date().toISOString(),
    costoTotal: 5000,
    moneda: 'ARS',
    notas: 'Fardo test E2E',
  });
  if (cf === 201 && fardo?.id) ok('Crear fardo nuevo');
  else return fail('Crear fardo', `status ${cf} — ${JSON.stringify(fardo)}`);

  const fardoId = fardo.id;

  // Listar categorías y talles
  const { data: cats } = await req('GET', '/categorias');
  const { data: talles } = await req('GET', '/talles');
  if (!Array.isArray(cats) || cats.length === 0) return fail('Sin categorías en DB');
  if (!Array.isArray(talles) || talles.length === 0) return fail('Sin talles en DB');

  ok('Categorías y talles disponibles');

  // Abrir fardo con ítems
  const { status: af, data: abierto } = await req('POST', `/fardos/${fardoId}/abrir`, {
    items: [
      {
        categoriaId: cats[0].id,
        talleId: talles[0].id,
        precioVenta: 2500,
        cantidad: 2,
      },
      {
        categoriaId: cats[0].id,
        talleId: talles[1]?.id ?? talles[0].id,
        precioVenta: 3000,
        cantidad: 1,
      },
    ],
  });
  if (af === 200 || af === 201) ok('Abrir fardo con ítems');
  else return fail('Abrir fardo', `status ${af} — ${JSON.stringify(abierto)}`);

  // Verificar que las prendas existen
  const { status: lp, data: prendas } = await req('GET', '/prendas?take=5');
  if (lp === 200 && (Array.isArray(prendas) || prendas?.items)) ok('GET /prendas — lista OK');
  else fail('GET /prendas', `status ${lp}`);

  // Stats de prendas
  const { status: st, data: stats } = await req('GET', '/prendas/stats');
  if (st === 200 && stats?.disponibles !== undefined) {
    ok(`Stats prendas — disponibles: ${stats.disponibles}, reservadas: ${stats.reservadas}`);
  } else fail('GET /prendas/stats', `status ${st}`);

  return fardoId;
}

async function testCaja() {
  section('2 & 3. Caja');

  // Ver si hay caja abierta
  const { status: ch, data: cajaHoy } = await req('GET', '/caja/hoy');
  let cajaId: string | null = null;

  if (ch === 200 && cajaHoy?.id && cajaHoy?.estado === 'ABIERTA') {
    cajaId = cajaHoy.id;
    ok(`Caja ya abierta: ${cajaId}`);
  } else {
    // Abrir caja nueva
    const { status: ab, data: caja } = await req('POST', '/caja/abrir', {
      montoApertura: 1000,
    });
    if (ab === 201 && caja?.id) {
      cajaId = caja.id;
      ok('Abrir caja con monto de apertura');
    } else {
      fail('Abrir caja', `status ${ab} — ${JSON.stringify(caja)}`);
      return null;
    }
  }

  // Registrar gasto
  const { status: gst, data: gasto } = await req('POST', `/caja/${cajaId}/gasto`, {
    concepto: 'Gasto test E2E',
    monto: 200,
    tipo: 'GASTO',
  });
  if (gst === 201) ok('Registrar gasto en caja');
  else fail('Registrar gasto', `status ${gst} — ${JSON.stringify(gasto)}`);

  // Registrar retiro
  const { status: ret, data: retiro } = await req('POST', `/caja/${cajaId}/gasto`, {
    concepto: 'Retiro test E2E',
    monto: 100,
    tipo: 'RETIRO',
  });
  if (ret === 201) ok('Registrar retiro en caja');
  else fail('Registrar retiro', `status ${ret} — ${JSON.stringify(retiro)}`);

  // Ver gastos
  const { status: vg, data: gastos } = await req('GET', `/caja/${cajaId}/gastos`);
  if (vg === 200 && Array.isArray(gastos)) ok(`Ver gastos/retiros de caja — ${gastos.length} registros`);
  else fail('Ver gastos caja', `status ${vg}`);

  // Listar cajas
  const { status: lc, data: cajas } = await req('GET', '/caja');
  if (lc === 200 && Array.isArray(cajas)) ok(`Listar cajas — ${cajas.length} cajas`);
  else fail('Listar cajas', `status ${lc}`);

  return cajaId;
}

async function testPOS(cajaAbierta: boolean) {
  section('2 & 3. POS — ventas');

  // Buscar una prenda disponible
  const { status: lp, data: prendas } = await req('GET', '/prendas?estado=DISPONIBLE&take=3');
  const lista = Array.isArray(prendas) ? prendas : prendas?.items;

  if (!lista || lista.length === 0) {
    fail('No hay prendas DISPONIBLES para hacer venta test');
    return null;
  }
  ok(`Prendas disponibles encontradas: ${lista.length}`);

  const prenda = lista[0];

  // Registrar venta (efectivo)
  const { status: vf, data: venta } = await req('POST', '/ventas', {
    prendaId: prenda.id,
    precioFinal: parseFloat(String(prenda.precioVenta ?? prenda.precio ?? 1000)),
    metodoPago: 'EFECTIVO',
    canalVenta: 'LOCAL',
  });
  if (vf === 201 && venta?.id) {
    ok(`Registrar venta POS efectivo — ventaId: ${venta.id}`);
  } else {
    fail('Registrar venta POS', `status ${vf} — ${JSON.stringify(venta)}`);
    return null;
  }

  const ventaId = venta.id;

  // Verificar prenda pasó a VENDIDO
  const { data: prendaPost } = await req('GET', `/prendas/${prenda.id}`);
  if (prendaPost?.estado === 'VENDIDO') ok('Prenda pasó a VENDIDO después de venta');
  else fail('Estado prenda post-venta', `estado: ${prendaPost?.estado}`);

  // Ventas de hoy
  const { status: vh, data: ventasHoy } = await req('GET', '/ventas/hoy');
  if (vh === 200 && Array.isArray(ventasHoy)) {
    const found = ventasHoy.find((v: any) => v.id === ventaId);
    if (found) ok('Venta aparece en /ventas/hoy');
    else fail('Venta no encontrada en /ventas/hoy');
  } else fail('GET /ventas/hoy', `status ${vh}`);

  // Resumen de ventas
  const { status: rs, data: resumen } = await req('GET', '/ventas/resumen');
  if (rs === 200 && resumen?.totalVendido !== undefined) ok(`Resumen ventas — totalVendido: $${resumen.totalVendido}`);
  else fail('GET /ventas/resumen', `status ${rs} — ${JSON.stringify(resumen)?.slice(0, 100)}`);

  // Venta MercadoPago (no debe sumar a caja efectivo)
  const { data: prendas2 } = await req('GET', '/prendas?estado=DISPONIBLE&take=3');
  const lista2 = Array.isArray(prendas2) ? prendas2 : prendas2?.items;
  if (lista2 && lista2.length > 0) {
    const prenda2 = lista2[0];
    const { status: vmp } = await req('POST', '/ventas', {
      prendaId: prenda2.id,
      precioFinal: parseFloat(String(prenda2.precio)),
      metodoPago: 'MERCADOPAGO',
      canalVenta: 'LOCAL',
    });
    if (vmp === 201) ok('Venta MercadoPago registrada');
    else fail('Venta MercadoPago', `status ${vmp}`);
  }

  return ventaId;
}

async function testReservas() {
  section('4. Reservas desde el panel');

  // Buscar prenda disponible
  const { data: prendas } = await req('GET', '/prendas?estado=DISPONIBLE&take=5');
  const lista = Array.isArray(prendas) ? prendas : prendas?.items;
  if (!lista || lista.length === 0) {
    fail('Sin prendas disponibles para reserva');
    return;
  }

  const prenda = lista[0];

  // Crear cliente para la reserva
  const { status: crc, data: clienteReserva } = await req('POST', '/clientes', {
    nombre: 'Test Reserva E2E',
    telefonoWhatsapp: '5493400000000',
  });
  if (crc !== 201 || !clienteReserva?.id) {
    fail('Crear cliente para reserva', `status ${crc}`);
    return;
  }
  const clienteId = clienteReserva.id;

  // Crear reserva
  const { status: cr, data: reserva } = await req('POST', '/reservas', {
    prendaId: prenda.id,
    clienteId,
    minutosExpiracion: 60,
  });
  if (cr === 201 && reserva?.id) ok(`Crear reserva manual — reservaId: ${reserva.id}`);
  else return fail('Crear reserva', `status ${cr} — ${JSON.stringify(reserva)}`);

  const reservaId = reserva.id;

  // Verificar prenda RESERVADO
  const { data: prendaR } = await req('GET', `/prendas/${prenda.id}`);
  if (prendaR?.estado === 'RESERVADO') ok('Prenda pasó a RESERVADO');
  else fail('Estado prenda post-reserva', `estado: ${prendaR?.estado}`);

  // Listar reservas activas
  const { status: la, data: activas } = await req('GET', '/reservas/activas');
  if (la === 200 && Array.isArray(activas)) {
    const found = activas.find((r: any) => r.id === reservaId);
    if (found) ok('Reserva aparece en /reservas/activas');
    else fail('Reserva no encontrada en activas');
  } else fail('GET /reservas/activas', `status ${la}`);

  // Cancelar reserva
  const { status: ca, data: cancelada } = await req('POST', `/reservas/${reservaId}/cancelar`, {});
  if (ca === 200 || ca === 201) ok('Cancelar reserva');
  else fail('Cancelar reserva', `status ${ca} — ${JSON.stringify(cancelada)}`);

  // Verificar prenda volvió a DISPONIBLE
  const { data: prendaC } = await req('GET', `/prendas/${prenda.id}`);
  if (prendaC?.estado === 'DISPONIBLE') ok('Prenda volvió a DISPONIBLE tras cancelar');
  else fail('Prenda no volvió a DISPONIBLE', `estado: ${prendaC?.estado}`);

  // Crear reserva para confirmar
  if (lista.length > 1) {
    const prenda2 = lista[1];
    const { status: cr2, data: reserva2 } = await req('POST', '/reservas', {
      prendaId: prenda2.id,
      clienteId,
      minutosExpiracion: 60,
    });
    if (cr2 === 201 && reserva2?.id) {
      ok('Crear segunda reserva para confirmar');
      // Confirmar reserva
      const { status: conf, data: confirmada } = await req('POST', `/reservas/${reserva2.id}/confirmar`, {});
      if (conf === 200 || conf === 201) ok('Confirmar reserva → prenda VENDIDO');
      else fail('Confirmar reserva', `status ${conf} — ${JSON.stringify(confirmada)}`);
    }
  }
}

async function testConfirmarMultiple() {
  section('6. Confirmar múltiple');

  const { data: prendas } = await req('GET', '/prendas?estado=DISPONIBLE&take=5');
  const lista = Array.isArray(prendas) ? prendas : prendas?.items;
  if (!lista || lista.length < 2) {
    fail('Necesito al menos 2 prendas disponibles para test confirmar múltiple');
    return;
  }

  const tel = '5493411111111';
  const reservas: string[] = [];

  // Crear cliente para confirmar múltiple
  const { data: clienteMult } = await req('POST', '/clientes', {
    nombre: 'Test Confirmar Multiple',
    telefonoWhatsapp: tel,
  });
  const clienteMultId = clienteMult?.id;
  if (!clienteMultId) {
    fail('Crear cliente para confirmar múltiple');
    return;
  }

  for (let i = 0; i < 2; i++) {
    const { status, data } = await req('POST', '/reservas', {
      prendaId: lista[i].id,
      clienteId: clienteMultId,
      minutosExpiracion: 60,
    });
    if (status === 201 && data?.id) reservas.push(data.id);
    else fail(`Crear reserva ${i + 1} para confirmar múltiple`, `status ${status}`);
  }

  if (reservas.length < 2) return;
  ok(`Creadas ${reservas.length} reservas para mismo cliente`);

  const { status: cm, data: resultado } = await req('POST', '/reservas/confirmar-multiple', {
    ids: reservas,
  });
  if (cm === 200 || cm === 201) ok('Confirmar múltiple — todas vendidas en una sola acción');
  else fail('Confirmar múltiple', `status ${cm} — ${JSON.stringify(resultado)}`);
}

async function testClientes() {
  section('9. Clientes');

  // Crear cliente
  const { status: cc, data: cliente } = await req('POST', '/clientes', {
    nombre: 'Cliente Test E2E Final',
    telefonoWhatsapp: '5493499999999',
  });
  if (cc === 201 && cliente?.id) ok(`Crear cliente — id: ${cliente.id}`);
  else return fail('Crear cliente', `status ${cc} — ${JSON.stringify(cliente)}`);

  const clienteId = cliente.id;

  // Listar
  const { status: lc, data: clientes } = await req('GET', '/clientes');
  if (lc === 200 && Array.isArray(clientes)) ok(`Listar clientes — ${clientes.length} clientes`);
  else fail('Listar clientes', `status ${lc}`);

  // Ver por id
  const { status: vc, data: clienteDetalle } = await req('GET', `/clientes/${clienteId}`);
  if (vc === 200 && clienteDetalle?.id) ok('Ver cliente por id');
  else fail('Ver cliente por id', `status ${vc}`);

  // Editar
  const { status: ec, data: editado } = await req('PUT', `/clientes/${clienteId}`, {
    nombre: 'Cliente Test E2E Editado',
    telefonoWhatsapp: '5493499999999',
  });
  if (ec === 200 && editado?.nombre === 'Cliente Test E2E Editado') ok('Editar cliente');
  else fail('Editar cliente', `status ${ec} — ${JSON.stringify(editado)?.slice(0, 200)}`);
}

async function testVentasBalance() {
  section('8. Balance y ventas');

  // Balance sin params (default hoy)
  const { status: bal, data: balance } = await req('GET', '/ventas/balance');
  if (bal === 200 && balance !== null) ok('GET /ventas/balance — OK');
  else fail('GET /ventas/balance', `status ${bal}`);

  // Balance semana
  const hoy = new Date();
  const hace7 = new Date(hoy);
  hace7.setDate(hoy.getDate() - 7);
  const { status: bsem } = await req(
    'GET',
    `/ventas/balance?desde=${hace7.toISOString().slice(0, 10)}&hasta=${hoy.toISOString().slice(0, 10)}`,
  );
  if (bsem === 200) ok('Balance período personalizado (7 días)');
  else fail('Balance período custom', `status ${bsem}`);

  // Resumen diario (para workflow 4)
  const { status: rd } = await req('GET', '/ventas/resumen-diario');
  if (rd === 200) ok('GET /ventas/resumen-diario — OK');
  else fail('GET /ventas/resumen-diario', `status ${rd}`);

  // Ventas huérfanas (sin caja)
  const { status: hu } = await req('GET', '/ventas/huerfanas');
  if (hu === 200) ok('GET /ventas/huerfanas — OK');
  else fail('GET /ventas/huerfanas', `status ${hu}`);
}

async function testBusqueda() {
  section('10. Búsqueda global');

  // La búsqueda full-text está en GET /prendas?buscar=...
  const { status: bs, data: res } = await req('GET', '/prendas?buscar=remera');
  if (bs === 200) ok('Búsqueda de prendas por texto (/prendas?buscar=remera)');
  else fail('Búsqueda prendas', `status ${bs}`);

  // Búsqueda clientes por nombre
  const { status: bc, data: clientes } = await req('GET', '/clientes?buscar=test');
  if (bc === 200) ok('Búsqueda clientes por nombre');
  else fail('Búsqueda clientes', `status ${bc} — ${JSON.stringify(clientes)?.slice(0, 100)}`);
}

async function testCerrarCaja(cajaId: string) {
  section('7. Cerrar caja');

  const { status, data } = await req('POST', `/caja/${cajaId}/cerrar`, {
    montoReal: 1500,
  });
  if (status === 200 || status === 201) {
    ok(`Cerrar caja — diferencia: ${data?.diferencia ?? '?'}`);
  } else {
    fail('Cerrar caja', `status ${status} — ${JSON.stringify(data)}`);
  }
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  Gabi Backend — Test E2E completo');
  console.log(`  ${new Date().toLocaleString('es-AR')}`);
  console.log('══════════════════════════════════════════════════════');

  section('Auth');
  try {
    AUTH_TOKEN = await getAuthToken();
    ok('Token obtenido');
  } catch (e: any) {
    fail('Obtener token', e.message);
    process.exit(1);
  }

  await testHealth();
  await testFardosYPrendas();
  const cajaId = await testCaja();
  const cajaAbierta = !!cajaId;
  await testConfirmarMultiple();
  await testReservas();
  await testPOS(cajaAbierta);
  await testClientes();
  await testVentasBalance();
  await testBusqueda();
  if (cajaId) await testCerrarCaja(cajaId);

  // ─── resumen ─────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════');
  console.log(`  RESULTADO: ${passed} ✅  ${failed} ❌`);
  if (failures.length > 0) {
    console.log('\n  Fallos:');
    failures.forEach((f) => console.log(`    ❌ ${f}`));
  } else {
    console.log('  Todo OK — listo para entregar a Gabi 🎉');
  }
  console.log('══════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Error inesperado:', e);
  process.exit(1);
});
