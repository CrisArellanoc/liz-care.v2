# Despliegue de Liz Care — guía de entrega

Para quien (persona o IA) publique la app. **Todo el backend ya está hecho y probado**; falta publicar el frontend,
configurar las URLs de Auth, conectar el correo y validar el entorno real.

## 1. Qué ya está listo (no rehacer)

**Proyecto Supabase `liz-care`** — ref `vkjitspfkiwjfiuvoatd` · `https://vkjitspfkiwjfiuvoatd.supabase.co` · región us-east-1.
- Migraciones aplicadas (en orden, carpeta `supabase/migrations/`): `20261105000000_perfil_paciente`, `20261123000000_persistencia_completa`, `20261123010000_solicitudes_contacto`.
- 9 tablas con RLS: `perfil`, `paciente`, `especialista`, `atencion`, `atencion_nota_interna` (solo administración), `medicamento_prescrito`, `archivo_receta`, `historial_medico`, `solicitud_contacto`.
- Bucket privado `recetas` (no público; JPG/PNG/HEIC, 10 MB exigidos en el servidor).
- Funciones del servidor desplegadas: `crear-cuenta-paciente`, `cambiar-correo-paciente` (solo administración; la llave `service_role` vive solo allí).
- Cuenta de administradora creada: `cristobal.ac01@gmail.com`. **La contraseña temporal se la entrega Adrei por un canal privado** (no está en el repo). Cambiarla en el primer acceso («¿Olvidaste tu contraseña?» o Supabase → Authentication → Users).

**Código** (rama `main`): todo implementado; `npm test` → 158 pruebas; `npm run build` compila. `vercel.json` ya trae la reescritura para abrir directo `/portal`, `/admin`, `/nueva-contrasena`, `/recuperar` y las cabeceras de seguridad.

## 2. Pasos pendientes

### 2.1 Publicar en Vercel
1. Importar el repo `AdreiBlanco-IA/liz-care` (privado) en Vercel, framework **Vite** (se detecta; `vercel.json` ya define build y salida `dist`). Alternativa por CLI: `npx vercel login` → `npx vercel link` → `npx vercel --prod`.
2. Variables de entorno (Production **y** Preview). Son de *build*: si se cambian hay que volver a desplegar.
   | Variable | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://vkjitspfkiwjfiuvoatd.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | la llave `sb_publishable_…` (Supabase → Project Settings → API Keys; ya está en el `.env.local` de Adrei) |
   | `VITE_SUPABASE_ACTIVO` | `true` |
   Nunca poner `service_role` / `sb_secret_…` en Vercel ni en el repo.
3. Dominio: HTTPS lo da Vercel automáticamente. Si se usa dominio propio, agregarlo en Vercel → Domains.
4. Quitar *Deployment Protection* en Production si el sitio debe ser público (Vercel → Settings → Deployment Protection).

### 2.2 Configurar Auth en Supabase (obligatorio, si no los enlaces de correo no funcionan)
Supabase → Authentication → URL Configuration:
- **Site URL:** `https://<dominio-publicado>`
- **Redirect URLs:** `https://<dominio-publicado>/**` (y, si se usan previews, `https://*-<equipo>.vercel.app/**`).
Por API (alternativa): `PATCH https://api.supabase.com/v1/projects/vkjitspfkiwjfiuvoatd/config/auth` con `{"site_url": "...", "uri_allow_list": "..."}` y un token personal de Supabase.

### 2.3 Correo (importante)
El SMTP integrado de Supabase **solo entrega a miembros de la organización y tiene un límite muy bajo por hora**. Con él, las
invitaciones y la recuperación de contraseña **no llegarán a pacientes reales**. Antes de usar en producción: Supabase →
Authentication → SMTP Settings → conectar un proveedor (p. ej. Resend con dominio verificado). Mientras tanto, la opción
**«Contraseña temporal»** al crear el acceso de un paciente funciona sin correo.

### 2.4 Validación del entorno real (punto 6 de la lista de Adrei)
Con el sitio publicado, recorrer a mano o con navegador automatizado:
1. **Sin sesión:** `/admin` y `/portal` redirigen a `/login`; recargar `/portal`, `/admin`, `/nueva-contrasena` directo da la app (no 404).
2. **Formulario público:** enviar una solicitud «Quiero ser paciente» → aparece en `/admin/solicitudes` con contador → ✓ crea el paciente / ✗ no lo crea.
3. **Administradora:** crear paciente → «Crear acceso al portal» (contraseña temporal) → registrar una consulta con medicamentos, **nota interna** y foto de receta → editar un paciente (cambiar correo).
4. **Paciente A:** inicia sesión; ve solo lo suyo; ve su receta; **no** ve la nota interna; llena su historial inicial (una sola vez); recargar conserva sesión y datos.
5. **Paciente B** (otro): no ve nada de A; pedir a mano `/rest/v1/paciente?id=eq.<id de A>` con su token devuelve vacío; `/admin` lo devuelve a `/portal`.
6. **Receta privada:** la URL pública `…/storage/v1/object/public/recetas/<ruta>` debe dar error.
7. **Responsivo:** `node tools/auditoria-responsiva.mjs https://<dominio> docs/evidencias/pt11-responsivo` (requiere Chrome; con sesión no cubre el portal, ver el script) y revisar visualmente 360/390 px.
8. Guardar capturas/informe en `docs/evidencias/` y marcar los RF como «aceptados» en `docs/TRAZABILIDAD.md` (tabla y sección «Pendiente»).

Pruebas automáticas contra un Supabase **local** (no tocar producción con ellas): `supabase start && supabase functions serve`, luego
`SUPA_URL=… SUPA_ANON=… SUPA_SERVICE=… node tools/prueba-rls.mjs` (también `prueba-cuentas.mjs`, `prueba-correo.mjs`).
Si se cambia el esquema: nueva migración en `supabase/migrations/`, probarla con `supabase db reset` local y aplicarla al proyecto real
(`supabase link --project-ref vkjitspfkiwjfiuvoatd` + `supabase db push`, o el SQL Editor). Funciones: `supabase functions deploy <nombre> --project-ref vkjitspfkiwjfiuvoatd`.

## 3. Higiene de seguridad (hacer al terminar)
- **Revocar el token personal de Supabase** `liz-care-claude` (Account → Access Tokens): se usó durante el desarrollo y se pegó en un chat.
- Cambiar la contraseña temporal de la administradora.
- `.env.local` está en `.gitignore`: no subirlo. El archivo `~/.liz-supabase-token` del equipo de Adrei debe borrarse.
- Dar a la administradora real (Liz) su propia cuenta: crear usuario en Supabase → Authentication → Users e insertar su fila en `public.perfil` con `rol = 'administrador'` (o repetir el procedimiento de `cristobal.ac01@gmail.com`).

## 4. Límites conocidos
- Los enlaces de receta se generan al mostrarla (10 min) y se renuevan solos; la foto queda guardada sin límite de tiempo.
- El formulario público es abierto: trae campo trampa y límites de largo en el servidor, pero no captcha. Si hay spam, agregar Cloudflare Turnstile o similar.
- Decisiones abiertas de la especificación v4 (corrección del historial por la administradora, fin del servicio): ver `docs/TRAZABILIDAD.md`.

## 5. Reglas del equipo
Un commit por cambio, con push. No inventar datos ni afirmar pruebas que no se corrieron; registrar en la bitácora el uso de IA.
Datos de prueba siempre ficticios.
