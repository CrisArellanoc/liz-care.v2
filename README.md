# Liz Care — Plataforma y sistema gestor de pacientes

Aplicación web para Liz Care, desarrollada por Summit AI SA de CV: panel de administración y portal de pacientes.
Con `VITE_SUPABASE_ACTIVO=true` usa Supabase (PostgreSQL con RLS, Auth y Storage privado); sin esa bandera corre con datos
de demostración en memoria.

Proyecto de la materia Desarrollo de Aplicaciones y Servicios Virtuales, Universidad Iberoamericana León.
Equipo: Cristóbal Arellano Carranza y Adrei Blanco Márquez.

## Cómo correrlo

```bash
npm install
npm run dev
```

Abre http://localhost:5173

## Supabase local y despliegue

```bash
supabase start                 # base, Auth y Storage locales (Docker)
supabase functions serve       # funciones del servidor (cuentas y correo)
SUPA_URL=http://127.0.0.1:54321 SUPA_ANON=<publishable> SUPA_SERVICE=<service_role> node tools/prueba-rls.mjs
```

Variables de entorno de la app: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_ACTIVO` (ver `.env.example`).
Despliegue en Vercel con `vercel.json`; en Supabase → Authentication → URL Configuration, el *Site URL* y los *Redirect URLs* deben ser el dominio publicado.

## Pruebas

```bash
npm test
```

146 casos automatizados definidos, con cobertura de los grupos PT, un recorrido integrado y ocho regresiones adicionales de lógica. La trazabilidad completa
RF → módulo → código → prueba está en [`docs/TRAZABILIDAD.md`](docs/TRAZABILIDAD.md).
La auditoría responsiva (PT11), compatible con Windows, macOS y Linux, se corre con `node tools/auditoria-responsiva.mjs http://127.0.0.1:5173 <carpeta>` con la app en marcha. Si Chrome no está en una ubicación estándar, define `CHROME_PATH`. El recorrido actual incluye el historial inicial: 15 pantallas en tres anchos (45 revisiones); el informe existente de 42 revisiones corresponde a la ejecución anterior.

## Módulos implementados (`src/modules/`)

| Módulo | Requerimiento | Código | Pruebas |
| --- | --- | --- | --- |
| M01 Identidad y permisos | RF-04, RNF-02 | `identidad/` | `tests/identidad.test.ts` |
| M02 Pacientes | RF-01 | `pacientes/` | `tests/pacientes.test.ts` |
| M03 Historial inicial | RF-10 | `historial-inicial/` | `tests/historial.test.ts` |
| M04 Citas y consultas | RF-02, RF-05 | `citas/` | `tests/citas.test.ts` |
| M05 Tratamientos | RF-08, RF-09 | `tratamientos/` | `tests/tratamientos.test.ts` |
| M06 Recetas y archivos | RF-07 | `recetas/` | `tests/recetas.test.ts` |
| M07 Expedientes | RF-03, RF-06 | `expedientes/` | `tests/expedientes.test.ts` |
| M10 Protección de datos | RNF-03 | `privacidad/` | `tests/privacidad.test.ts` |
| M11 Especialistas | RF-11 | `especialistas/` | `tests/especialistas.test.ts` |

M08 (portal) y M09 (interfaz adaptable) son transversales de la interfaz (`src/pages/portal/`, `src/components/`).
Cada módulo es TypeScript puro: recibe la sesión y una función `guardar`, así la persistencia (memoria hoy, Supabase después) se cambia sin tocar las reglas.

Regla de duplicados (M02): un correo ya registrado (sin distinguir mayúsculas ni espacios) bloquea el alta; mismo nombre y
fecha de nacimiento solo muestra una advertencia que la administradora puede confirmar.

## Supabase (en pausa)

Por ahora la app corre con datos en memoria (se reinician al recargar). Para activar Supabase: copia `.env.example` a `.env.local`,
llena la URL y la llave, y pon `VITE_SUPABASE_ACTIVO=true`. Con la bandera activa, el acceso de administración y el alta de pacientes usan la base.
El aviso de privacidad del prototipo está en `/privacidad`.

Los pacientes nuevos quedan `invitado` o `sin acceso`. Este prototipo no envía correo ni activa cuentas: el alta no acredita acceso al portal. El recorrido integrado comprueba ese rechazo antes de continuar con una fixture explícita de cuentas ya activadas.

## Cuentas de demostración

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Administradora | liz@lizcare.mx | admin123 |
| Administradora | daniela@lizcare.mx | admin123 |
| Paciente con historial y tratamiento | emily@demo.com | demo123 |
| Paciente nuevo (historial pendiente) | hans@demo.com | demo123 |

## Pantallas

**Pública:** página de inicio (`/`) e inicio de sesión (`/login`).

**Administradora (`/admin`):** panel del día, pacientes, registro de paciente con detección de duplicados (RF-01),
expediente del paciente con historial y consultas cronológicas (RF-03), registro de consulta, tratamiento y foto de receta
(RF-02, RF-07, RF-08), agenda semanal y directorio de especialistas.

**Paciente (`/portal`, español/inglés):** inicio, próximas citas (RF-05), tratamiento de la última consulta con receta (RF-09),
expediente (RF-06) y formulario de historial médico inicial con alergias obligatorias (RF-10, CA-08).

## Stack

React 19 · TypeScript · Vite · Tailwind CSS 4 · React Router · Lucide icons.
Fotografías de [Unsplash](https://unsplash.com) (licencia Unsplash). Los nombres de médicos y pacientes son ficticios.

