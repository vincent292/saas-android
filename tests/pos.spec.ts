import { test, expect, type Page } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { cashTotals, parseAmount, tableFromQr } from '../src/lib/domain';

const restaurantId = '11111111-1111-4111-8111-111111111111';
const productId = '22222222-2222-4222-8222-222222222222';
const table = { id: '33333333-3333-4333-8333-333333333333', name: 'Mesa 4', code: 'M4', capacity: 4, status: 'available' };
async function setup(page: Page, waiter = false, initialShiftActive = true, kitchenEnabled = true, withRider = false) {
  const calls: Record<string, unknown>[] = [];
  const profile = { id: '44444444-4444-4444-8444-444444444444', full_name: 'Ana Perez' };
  const restaurant = { id: restaurantId, name: 'Restaurante de prueba', slug: 'prueba', role: waiter ? 'waiter' : 'cashier', canManage: !waiter };
  let accepted = false;
  let paid = false;
  let shiftActive = initialShiftActive;
  const snapshot = () => ({
    restaurant, products: [{ id: productId, name: 'Hamburguesa clasica', description: 'Con papas', price: 30, image_url: null, category_id: 'food' }],
    categories: [{ id: 'food', name: 'Comidas' }], variants: [], groups: [], options: [], tables: [table],
    cashOpen: true, cashSession: waiter ? null : { id: '55555555-5555-4555-8555-555555555555', opening_amount: 100, opened_at: new Date().toISOString() },
    movements: [], settings: { currency: 'BOB', qr_payment_url: null, table_orders_enabled: true, kitchen_enabled: kitchenEnabled },
    waiterShift: waiter ? { active: shiftActive, openedAt: shiftActive ? new Date().toISOString() : null } : null,
    orders: [{ id: '66666666-6666-4666-8666-666666666666', table_id: withRider ? null : table.id, order_number: 'M-PRUEBA', order_type: withRider ? 'delivery' : 'table', status: withRider ? 'ready' : accepted || paid ? (kitchenEnabled ? 'accepted' : 'ready') : 'pending', payment_status: paid ? 'paid' : 'pending', payment_method: 'cash', customer_name: 'Cliente prueba', total: 30, notes: 'Mesa 4 | Mesero: Ana Perez', created_at: new Date().toISOString(), payment_receipt_url: null, payment_receipt_reference: null, eta_adjustment_minutes: 0, order_items: [{ id: 'line', product_name: 'Hamburguesa clasica', quantity: 1, subtotal: 30, prep_minutes: 10, notes: '' }] }],
    deliveryAssignments: withRider ? [{ order_id: '66666666-6666-4666-8666-666666666666', restaurant_rider_id: null, delivery_name: 'Moto prueba', delivery_phone: '70000000', status: 'active', pickup_confirmation_code: '4821', pickup_code_verified_at: null, assigned_at: new Date().toISOString() }] : [],
  });
  const user = { id: profile.id, aud: 'authenticated', role: 'authenticated', email: 'prueba@example.test', user_metadata: {}, app_metadata: { provider: 'email' }, created_at: new Date().toISOString() };
  const token = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: profile.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.test';
  await page.route('**/auth/v1/**', async (route) => {
    const body = route.request().url().includes('/token') ? { access_token: token, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, user } : user;
    await route.fulfill({ json: body });
  });
  await page.routeWebSocket('**/realtime/**', (socket) => socket.close());
  await page.route('**/api/mobile/pos**', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
    if (route.request().method() === 'POST') {
      const contentType = route.request().headers()['content-type'] || '';
      const form = contentType.includes('multipart/form-data')
        ? await new Request('http://test', { method: 'POST', headers: { 'content-type': contentType }, body: new Uint8Array(route.request().postDataBuffer() || []) }).formData()
        : null;
      const body = form ? JSON.parse(String(form.get('payload'))) : route.request().postDataJSON();
      if (form?.get('receipt')) body.receiptAttached = true;
      calls.push(body);
      if (body.action === 'accept') accepted = true;
      if (body.action === 'charge') { accepted = true; paid = true; }
      if (body.action === 'open-waiter-shift') shiftActive = true;
      if (body.action === 'close-waiter-shift') shiftActive = false;
      return route.fulfill({ json: { id: 'created', order_number: 'M-ENVIADO' } });
    }
    return route.fulfill({ json: route.request().url().includes('restaurantId=') ? snapshot() : { profile, restaurants: [restaurant] } });
  });
  await page.goto('/');
  await page.getByLabel('Correo electronico').fill('prueba@example.test');
  await page.getByLabel('Contrasena', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Iniciar sesion' }).click();
  await expect(page.getByText('Restaurante de prueba', { exact: true })).toBeVisible();
  return calls;
}

test('QR and cash calculations reject wrong tables and malformed amounts', () => {
  expect(tableFromQr('https://yopido.test/prueba/mesa/M4', 'prueba', [table]).id).toBe(table.id);
  expect(() => tableFromQr('https://yopido.test/otra/mesa/M4', 'prueba', [table])).toThrow();
  expect(() => tableFromQr('M5', 'prueba', [table])).toThrow();
  expect(parseAmount('12,50')).toBe(12.5);
  expect(() => parseAmount('12abc')).toThrow();
  expect(() => parseAmount('-1')).toThrow();
  expect(cashTotals(100, [
    { id: '1', type: 'opening', payment_method: 'cash', amount: 100, description: '', created_at: '' },
    { id: '2', type: 'sale', payment_method: 'cash', amount: 50, description: '', created_at: '' },
    { id: '3', type: 'sale', payment_method: 'qr', amount: 30, description: '', created_at: '' },
    { id: '4', type: 'expense', payment_method: 'cash', amount: 10, description: '', created_at: '' },
  ])).toEqual({ expected: 140, sales: 80, digital: 30 });
});
test('login fits mobile and tablet and shows the real brand', async ({ page }, info) => {
  for (const viewport of [{ width: 360, height: 740 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Iniciar sesion' })).toBeVisible();
    await expect(page.locator('img').first()).toHaveJSProperty('complete', true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.screenshot({ path: info.outputPath('login-' + viewport.width + '.png'), fullPage: true, animations: 'disabled' });
  }
});
test('waiter scans table code, places order and has no cash controls', async ({ page }, info) => {
  const calls = await setup(page, true);
  await expect(page.getByRole('tab', { name: 'Caja', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Escanear mesa' }).click();
  await page.getByLabel('Codigo de mesa').fill('M4');
  await page.getByRole('button', { name: 'Buscar mesa' }).click();
  await expect(page.getByText('Mesa 4 · M4')).toBeVisible();
  await page.getByRole('button', { name: 'Agregar Hamburguesa clasica' }).click();
  await page.getByRole('button', { name: 'Agregar al pedido' }).click();
  await page.getByRole('button', { name: /Ver pedido/ }).click();
  await page.getByLabel('Nombre del cliente (opcional)').fill('Cliente');
  await page.screenshot({ path: info.outputPath('mesero-pedido.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Enviar pedido a caja' }).click();
  await expect(page.getByText('Pedido M-ENVIADO enviado.')).toBeVisible();
  expect(calls[0].action).toBe('table-order');
  expect(calls[0].tableCode).toBe('M4');
  expect(calls[0].items).toEqual([expect.objectContaining({ productId, quantity: 1 })]);
  await page.reload();
  await expect(page.getByText('Restaurante de prueba', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Iniciar sesion' })).toHaveCount(0);
});
test('waiter opens a shift before accessing table orders', async ({ page }) => {
  const calls = await setup(page, true, false);
  await expect(page.getByText('Turno cerrado')).toBeVisible();
  await page.getByRole('button', { name: 'Abrir turno' }).click();
  await expect(page.getByRole('button', { name: 'Escanear mesa' })).toBeVisible();
  expect(calls[0].action).toBe('open-waiter-shift');
});
test('cashier accepts an order and reviews close without auto-submission', async ({ page }, info) => {
  const calls = await setup(page);
  await page.getByRole('tab', { name: /Pedidos/ }).click();
  await page.getByRole('button', { name: 'Aceptar', exact: true }).click();
  await expect(page.getByText('M-PRUEBA actualizado.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'A cocina' })).toBeVisible();
  expect(calls[0].action).toBe('accept');
  await page.getByRole('tab', { name: 'Caja', exact: true }).click();
  await page.screenshot({ path: info.outputPath('caja-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Cerrar caja', exact: true }).click();
  await page.getByLabel('Efectivo contado').fill('100');
  await page.getByRole('button', { name: 'Revisar monto' }).click();
  expect(calls.filter((c) => c.action === 'close-cash')).toHaveLength(0);
  await page.getByRole('button', { name: 'Confirmar cierre' }).click();
  await expect(page.getByText(/Caja cerrada. Diferencia/)).toBeVisible();
  expect(calls[1].action).toBe('close-cash');
});

test('cashier approval goes directly to ready when kitchen flow is disabled', async ({ page }) => {
  const calls = await setup(page, false, true, false);
  await page.getByRole('tab', { name: /Pedidos/ }).click();
  await page.getByRole('button', { name: 'Aceptar', exact: true }).click();
  await expect(page.getByText('Listo', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'A cocina' })).toHaveCount(0);
  expect(calls[0].action).toBe('accept');
});

test('cashier can reveal the rider pickup code from the simplified order card', async ({ page }) => {
  await setup(page, false, true, true, true);
  await page.getByRole('tab', { name: /Pedidos/ }).click();
  await page.getByRole('button', { name: 'Ver código' }).click();
  await expect(page.getByText('Código de retiro', { exact: true })).toBeVisible();
  await expect(page.getByText('4821', { exact: true })).toBeVisible();
});

test('cashier sees the active table account and settles it as one visit', async ({ page }, info) => {
  const calls = await setup(page);
  await page.getByRole('button', { name: 'Mesa', exact: true }).click();
  await page.getByRole('button', { name: 'Escanear mesa' }).click();
  await page.getByLabel('Codigo de mesa').fill('M4');
  await page.getByRole('button', { name: 'Buscar mesa' }).click();
  await expect(page.getByText('Consumo activo de Mesa 4')).toBeVisible();
  await expect(page.getByText('1 comanda')).toBeVisible();
  await page.getByRole('button', { name: 'Cobrar cuenta completa' }).click();
  await page.screenshot({ path: info.outputPath('cobrar-mesa.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Cobrar todo y liberar mesa' }).click();
  await expect(page.getByText('Mesa 4 cobrada y liberada.')).toBeVisible();
  expect(calls[0]).toMatchObject({ action: 'settle-table', tableId: table.id, paymentMethod: 'cash' });
});

test('cashier cancellation requires a reason and stays auditable', async ({ page }) => {
  const calls = await setup(page);
  await page.getByRole('tab', { name: /Pedidos/ }).click();
  await page.getByRole('button', { name: 'Ver pedido M-PRUEBA' }).click();
  const cancel = page.getByRole('button', { name: 'Anular comanda' });
  await expect(cancel).toBeDisabled();
  await page.getByLabel('Motivo de anulacion o correccion').fill('Producto comandado por error');
  await cancel.click();
  await expect(page.getByText('Pedido actualizado.')).toBeVisible();
  expect(calls[0]).toMatchObject({ action: 'cancel-order', reason: 'Producto comandado por error' });
});

test('tablet POS validates QR payment and submits a sale with a receipt', async ({ page }, info) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  const calls = await setup(page);
  await expect(page.getByRole('button', { name: 'Agregar Hamburguesa clasica' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: info.outputPath('pos-tablet.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Agregar Hamburguesa clasica' }).click();
  await page.getByRole('button', { name: 'Agregar al pedido' }).click();
  await page.getByRole('button', { name: /Ver pedido/ }).click();
  await page.getByRole('radio', { name: 'QR', exact: true }).click();
  await page.getByRole('button', { name: 'Cobrar y enviar' }).click();
  await expect(page.getByText('Adjunta el comprobante o ingresa la referencia.')).toBeVisible();
  expect(calls).toHaveLength(0);
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Galeria', exact: true }).click();
  await (await chooserPromise).setFiles({ name: 'comprobante.png', mimeType: 'image/png', buffer: readFileSync('assets/images/icon.png') });
  await expect(page.getByRole('button', { name: 'Quitar comprobante' })).toBeVisible();
  await page.getByRole('button', { name: 'Cobrar y enviar' }).click();
  await expect(page.getByText('Pedido M-ENVIADO enviado.')).toBeVisible();
  expect(calls[0].action).toBe('sale');
  expect(calls[0].paymentMethod).toBe('qr');
  expect(calls[0].receiptAttached).toBe(true);
});
