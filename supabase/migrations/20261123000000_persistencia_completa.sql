-- Liz Care · Persistencia completa y permisos en el servidor
-- Tablas: especialista, atencion, atencion_nota_interna, medicamento_prescrito, archivo_receta, historial_medico.
-- Storage privado «recetas». RNF-02 / CA-09, CA-13: cada cuenta solo accede a lo que le corresponde por rol.
-- Las notas internas viven en su propia tabla: RLS filtra filas, no columnas, y así nunca llegan al navegador del paciente.

-- ¿Qué paciente es la sesión actual? (nulo si no es paciente). security definer evita recursión de RLS.
create function public.paciente_id_actual()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.paciente where usuario_id = (select auth.uid());
$$;

revoke all on function public.paciente_id_actual() from public, anon;
grant execute on function public.paciente_id_actual() to authenticated;

-- ── especialista (RF-11) ────────────────────────────────────────────────────────────────────
create table public.especialista (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null check (btrim(nombre) <> ''),
  especialidad text not null check (btrim(especialidad) <> ''),
  foto         text,
  institucion  text not null check (btrim(institucion) <> ''),
  sector       text not null check (sector in ('Público', 'Privado')),
  direccion    text not null default '',
  telefono     text not null check (btrim(telefono) <> ''),
  idiomas      text[] not null check (cardinality(idiomas) > 0)
);

-- ── atencion (cita programada o consulta realizada) ─────────────────────────────────────────
create table public.atencion (
  id                    uuid primary key default gen_random_uuid(),
  paciente_id           uuid not null references public.paciente (id),
  especialista_id       uuid not null references public.especialista (id),
  fecha                 timestamptz not null,
  motivo                text not null check (btrim(motivo) <> ''),
  overview              text not null default '',
  nota_visible          text,
  estado                text not null check (estado in ('programada', 'completada')),
  acompanamiento        boolean not null default false,
  traduccion            boolean not null default false,
  indicaciones_generales text not null default '',
  sin_medicamentos      boolean not null default false,
  creada_el             timestamptz not null default now(),
  -- Una consulta realizada siempre tiene resumen (CA-02).
  check (estado = 'programada' or btrim(overview) <> '')
);
create index atencion_paciente_idx on public.atencion (paciente_id, fecha desc);

-- Notas internas: solo administración las lee o escribe.
create table public.atencion_nota_interna (
  atencion_id uuid primary key references public.atencion (id) on delete cascade,
  nota        text not null check (btrim(nota) <> '')
);

create table public.medicamento_prescrito (
  id           uuid primary key default gen_random_uuid(),
  atencion_id  uuid not null references public.atencion (id) on delete cascade,
  orden        int not null default 0,
  nombre       text not null check (btrim(nombre) <> ''),
  dosis        text not null default '',
  frecuencia   text not null default '',
  duracion     text not null default '',
  indicaciones text not null default '',
  horarios     text[] not null default '{}' check (horarios <@ array['mañana', 'tarde', 'noche'])
);
create index medicamento_atencion_idx on public.medicamento_prescrito (atencion_id, orden);

-- Metadatos de la foto de receta; el archivo está en el bucket privado «recetas» (ruta = storage object name).
create table public.archivo_receta (
  id              uuid primary key default gen_random_uuid(),
  atencion_id     uuid not null unique references public.atencion (id) on delete cascade,
  ruta            text not null unique,
  nombre_original text not null,
  tipo_mime       text not null check (tipo_mime in ('image/jpeg', 'image/png', 'image/heic')),
  tamano_bytes    bigint not null check (tamano_bytes > 0 and tamano_bytes <= 10485760)
);

-- ── historial_medico inicial (RF-10): un solo envío por paciente (la llave primaria lo garantiza) ─
create table public.historial_medico (
  paciente_id        uuid primary key references public.paciente (id),
  completado_el      timestamptz not null default now(),
  padecimientos      text[] not null default '{}',
  sin_padecimientos  boolean not null default false,
  alergias           text[] not null default '{}',
  sin_alergias       boolean not null default false,
  tratamientos       text[] not null default '{}',
  sin_tratamientos   boolean not null default false,
  cirugias           text,
  notas              text,
  -- CA-08: cada apartado trae elementos o un «no tengo» explícito, nunca ambos ni ninguno.
  check ((cardinality(padecimientos) > 0) <> sin_padecimientos),
  check ((cardinality(alergias) > 0) <> sin_alergias),
  check ((cardinality(tratamientos) > 0) <> sin_tratamientos)
);

-- ── RLS ─────────────────────────────────────────────────────────────────────────────────────
alter table public.especialista enable row level security;
alter table public.atencion enable row level security;
alter table public.atencion_nota_interna enable row level security;
alter table public.medicamento_prescrito enable row level security;
alter table public.archivo_receta enable row level security;
alter table public.historial_medico enable row level security;

revoke all on public.especialista, public.atencion, public.atencion_nota_interna,
  public.medicamento_prescrito, public.archivo_receta, public.historial_medico from anon;

-- especialista: la administración gestiona; cualquier cuenta con sesión consulta el catálogo.
create policy especialista_lectura on public.especialista for select to authenticated using (true);
create policy especialista_admin_alta on public.especialista for insert to authenticated with check ((select public.es_admin()));
create policy especialista_admin_edicion on public.especialista for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

-- atencion: administración todo (sin borrar); el paciente solo lee las suyas.
create policy atencion_admin_lectura on public.atencion for select to authenticated using ((select public.es_admin()));
create policy atencion_admin_alta on public.atencion for insert to authenticated with check ((select public.es_admin()));
create policy atencion_admin_edicion on public.atencion for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));
create policy atencion_propia_lectura on public.atencion for select to authenticated
  using (paciente_id = (select public.paciente_id_actual()));

-- notas internas: solo administración.
create policy nota_interna_admin on public.atencion_nota_interna for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

-- medicamentos y archivo de receta: administración gestiona; el paciente lee los de sus atenciones.
create policy medicamento_admin_lectura on public.medicamento_prescrito for select to authenticated using ((select public.es_admin()));
create policy medicamento_admin_alta on public.medicamento_prescrito for insert to authenticated with check ((select public.es_admin()));
create policy medicamento_admin_edicion on public.medicamento_prescrito for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));
create policy medicamento_admin_baja on public.medicamento_prescrito for delete to authenticated using ((select public.es_admin()));
create policy medicamento_propio_lectura on public.medicamento_prescrito for select to authenticated
  using (exists (select 1 from public.atencion a where a.id = atencion_id and a.paciente_id = (select public.paciente_id_actual())));

create policy receta_admin_lectura on public.archivo_receta for select to authenticated using ((select public.es_admin()));
create policy receta_admin_alta on public.archivo_receta for insert to authenticated with check ((select public.es_admin()));
create policy receta_admin_edicion on public.archivo_receta for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));
create policy receta_propia_lectura on public.archivo_receta for select to authenticated
  using (exists (select 1 from public.atencion a where a.id = atencion_id and a.paciente_id = (select public.paciente_id_actual())));

-- historial: el paciente lo envía una sola vez (su propio id) y lo lee; la administración lo lee.
create policy historial_admin_lectura on public.historial_medico for select to authenticated using ((select public.es_admin()));
create policy historial_propio_lectura on public.historial_medico for select to authenticated
  using (paciente_id = (select public.paciente_id_actual()));
create policy historial_propio_envio on public.historial_medico for insert to authenticated
  with check (paciente_id = (select public.paciente_id_actual()));

-- ── Activación del portal: el paciente marca su cuenta como activa tras crear su contraseña ──
create function public.activar_portal()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.paciente set portal = 'activo'
  where usuario_id = (select auth.uid()) and portal <> 'activo';
$$;
revoke all on function public.activar_portal() from public, anon;
grant execute on function public.activar_portal() to authenticated;

-- ── Storage privado para recetas (RF-07, CA-09) ─────────────────────────────────────────────
-- Bucket no público: solo se entra con enlaces firmados temporales. Límite y tipos exigidos en el servidor.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recetas', 'recetas', false, 10485760, array['image/jpeg', 'image/png', 'image/heic'])
on conflict (id) do update
  set public = false, file_size_limit = 10485760, allowed_mime_types = array['image/jpeg', 'image/png', 'image/heic'];

-- Solo administración sube o cambia archivos. Las rutas son «<paciente_id>/<atencion_id>/<archivo>».
create policy recetas_admin_subida on storage.objects for insert to authenticated
  with check (bucket_id = 'recetas' and (select public.es_admin()));
create policy recetas_admin_lectura on storage.objects for select to authenticated
  using (bucket_id = 'recetas' and (select public.es_admin()));
-- El paciente solo firma/lee archivos de su carpeta.
create policy recetas_propia_lectura on storage.objects for select to authenticated
  using (bucket_id = 'recetas' and (storage.foldername(name))[1] = (select public.paciente_id_actual())::text);
