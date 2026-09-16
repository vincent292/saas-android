# Yopido POS

App React Native + Expo 57 para cajeros, administradores y meseros del SaaS.

## Probar

La configuracion publica se encuentra en .env.local, ignorado por Git:

- EXPO_PUBLIC_API_URL: servidor SaaS con /api/mobile/pos.
- EXPO_PUBLIC_SUPABASE_URL: mismo proyecto Supabase del SaaS.
- EXPO_PUBLIC_SUPABASE_ANON_KEY: clave publica/anon.

No se incluye service-role ni credenciales de base de datos.
Ejecutar npm start y abrir el QR en Expo Go compatible con SDK 57.
El telefono y la computadora deben estar en la misma red.
La URL local inicial es http://192.168.1.49:3000; cambiarla si cambia la IP.
El SaaS debe escuchar en 0.0.0.0.

## Flujos

- Sesion persistente en SecureStore en Android y renovacion al volver a primer plano.
- Inicio con correo o Google y cambio obligatorio de la contrasena provisional.
- Seleccion de restaurante segun membresias activas.
- Administrador/cajero: POS, pedidos, comprobantes, cobros, anulaciones auditadas y apertura/cierre.
- Mesero: abrir/cerrar turno, escanear QR o introducir codigo de mesa, ver su consumo activo, configurar productos y enviar.
- Cualquier mesero autorizado puede pedir para la misma mesa.
- Caja cobra todas las comandas activas y libera la mesa; los pedidos cerrados no se mezclan con la visita siguiente.
- Variantes, opciones obligatorias, cantidades y notas.
- Foto o galeria para comprobantes; aprobacion del pago solo por caja.
- Actualizaciones Realtime, al volver a la app y comprobacion periodica.
- Reintentos conservan el identificador mientras el pedido permanezca en la app.

## Google

El proveedor Google debe estar habilitado en Supabase Auth con las mismas credenciales usadas por el SaaS.
Agregar `yopidoposmobile://auth/callback` a la lista de Redirect URLs de Supabase para Android.
Para probar en web, agregar tambien el origen local exacto, por ejemplo `http://localhost:8082`.
Las cuentas creadas por el dueno conservan `must_change_password`; incluso si usan Google, completan primero el cambio obligatorio cuando corresponda.

## Backend

La ruta nueva vive en src/app/api/mobile/pos/ del repositorio saas-food.
Debe publicarse antes de apuntar la app al dominio de produccion.
Cada operacion valida token, restaurante y rol.
Pedidos de mesa: funcion transaccional existente, tipo table y origen table_qr.
El nombre del mesero proviene de su perfil autenticado y se guarda en las notas.
El ID del usuario, sus turnos y sus pedidos se registran en la auditoria existente.
No se agregan tablas, columnas ni migraciones.
Cobros y caja usan las RPC existentes para conservar inventario y movimientos.
Las anulaciones reutilizan `order_cancellation_reviews` para que el dueno las apruebe u observe sin borrar el historial.
Los cambios de estado conservan notificaciones y oferta automatica a repartidores.

## Verificacion

- npm run typecheck
- npx expo export --platform android
- npx playwright install chromium
- npm test (con Expo web activo en http://localhost:8082)

Las pruebas usan datos simulados y no generan ventas reales.
Pruebas API: saas-food/tests/mobile-pos.test.mjs.

## Distribucion y pendientes

eas.json incluye el perfil preview para APK interno tras configurar EAS.
Antes de distribuir, usar la URL HTTPS publicada y probar con telefono y cuenta real.
Camara, QR fisico y reconexion Android requieren verificacion en dispositivo.
Impresion Bluetooth pendiente: depende del modelo de impresora y su libreria nativa.
No hay envio offline. El carrito, el modo y la mesa seleccionada se conservan localmente por restaurante hasta enviar o vaciar el pedido. Si una venta queda sin respuesta, revisar los pedidos antes de repetirla.
