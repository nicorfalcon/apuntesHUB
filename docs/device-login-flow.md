# Flujo de límite de dispositivos

## Variables

- `DEVICE_COOKIE_SECRET`: ya existente, firma la cookie HttpOnly `ah_device`.
- `LOGIN_INTENT_SECRET`: secreto de 32+ caracteres para firmar y cifrar intents de login. Si no está definido, el código usa `DEVICE_COOKIE_SECRET` como fallback.
- `MAX_DEVICES_PER_USER`: opcional. Define el límite de dispositivos activos. Por defecto: `2`.

## Base de datos

Aplicar la migration:

```bash
supabase db push
```

O copiar el SQL de `supabase/migrations/0011_login_intents.sql` en el SQL Editor de Supabase.

La migration crea:

- `public.login_intents`, para intents efímeros de login bloqueado.
- `public.consume_login_intent_and_revoke_device(...)`, RPC server-only que consume el intent y revoca el dispositivo elegido en una operación.

## Flujo local

1. Levantar la app:

```bash
npm run dev
```

2. Iniciar sesión normalmente desde un primer navegador.
3. Iniciar sesión desde un segundo navegador o perfil.
4. Intentar iniciar sesión desde un tercero.
5. La app debe mostrar `/login/devices` con los dispositivos activos y marcar como recomendado el más inactivo.
6. Al elegir una sesión, el endpoint `/api/auth/login/finalize` revoca ese dispositivo, registra el actual y redirige al destino original.

## Notas

- Las credenciales no se guardan en estado del cliente entre pantallas.
- El token de intent vive sólo en memoria React y expira a los 5 minutos.
- La sesión Supabase pendiente se guarda cifrada en `login_intents` y se entrega al navegador sólo si el usuario revoca un dispositivo válido.
- Revocar desde Perfil > Seguridad sigue usando el flujo existente.
