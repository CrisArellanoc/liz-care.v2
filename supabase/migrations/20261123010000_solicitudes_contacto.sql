-- Solicitudes del sitio público. Un visitante sin sesión solo puede ENVIAR una; no puede leer ninguna.
-- Una solicitud para ser paciente trae los mismos datos obligatorios que el alta, así «aceptar» crea un paciente completo y válido.
-- La administración las acepta (se crea el paciente) o las rechaza (no se integra).
create table public.solicitud_contacto (
  id                    uuid primary key default gen_random_uuid(),
  creada_el             timestamptz not null default now(),
  tipo                  text not null check (tipo in ('cita', 'informes')),
  nombres               text not null check (char_length(btrim(nombres)) between 1 and 80),
  primer_apellido       text not null check (char_length(btrim(primer_apellido)) between 1 and 80),
  segundo_apellido      text check (char_length(segundo_apellido) <= 80),
  telefono              text not null check (char_length(btrim(telefono)) between 5 and 40),
  correo                text not null check (char_length(correo) <= 160 and correo ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  especialidad          text check (char_length(especialidad) <= 80),
  idioma                text check (char_length(idioma) <= 40),
  mensaje               text check (char_length(mensaje) <= 1000),
  nacimiento            date check (nacimiento <= current_date),
  sexo                  text check (sexo in ('F', 'M', 'X')),
  nacionalidad          text check (char_length(nacionalidad) <= 60),
  pais                  text check (pais ~ '^[A-Z]{2}$'),
  emergencia_nombre     text check (char_length(emergencia_nombre) <= 120),
  emergencia_parentesco text check (char_length(emergencia_parentesco) <= 40),
  emergencia_telefono   text check (char_length(emergencia_telefono) <= 40),
  estado                text not null default 'nueva' check (estado in ('nueva', 'aceptada', 'rechazada')),
  paciente_id           uuid references public.paciente (id) on delete set null,
  resuelta_el           timestamptz,
  -- Quien quiere ser paciente debe dar todos los datos del alta.
  check (tipo <> 'cita' or (
    nacimiento is not null and sexo is not null and nacionalidad is not null and pais is not null and idioma is not null
    and emergencia_nombre is not null and btrim(emergencia_nombre) <> ''
    and emergencia_parentesco is not null and btrim(emergencia_parentesco) <> ''
    and emergencia_telefono is not null and btrim(emergencia_telefono) <> ''
    and mensaje is not null and btrim(mensaje) <> ''))
);
create index solicitud_estado_idx on public.solicitud_contacto (estado, creada_el desc);

alter table public.solicitud_contacto enable row level security;
revoke all on public.solicitud_contacto from anon;
grant insert (tipo, nombres, primer_apellido, segundo_apellido, telefono, correo, especialidad, idioma, mensaje,
              nacimiento, sexo, nacionalidad, pais, emergencia_nombre, emergencia_parentesco, emergencia_telefono)
  on public.solicitud_contacto to anon;

-- Sin sesión: solo insertar, siempre como «nueva» y sin paciente vinculado.
create policy solicitud_publica_envio on public.solicitud_contacto for insert to anon
  with check (estado = 'nueva' and paciente_id is null);
create policy solicitud_admin_lectura on public.solicitud_contacto for select to authenticated using ((select public.es_admin()));
create policy solicitud_admin_edicion on public.solicitud_contacto for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

-- ✓ Aceptar: crea el paciente con los datos de la solicitud y la marca aceptada, todo en una sola operación.
-- Devuelve el id del paciente (nulo en una solicitud de informes). Si el correo ya pertenece a un paciente, falla (23505) y la solicitud queda sin cambios.
create function public.aceptar_solicitud(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.solicitud_contacto;
  nuevo uuid;
begin
  if not public.es_admin() then
    raise exception 'solo-administracion' using errcode = '42501';
  end if;
  select * into s from public.solicitud_contacto where id = p_id for update;
  if not found then raise exception 'no-existe' using errcode = 'P0002'; end if;
  if s.estado <> 'nueva' then raise exception 'ya-resuelta' using errcode = 'P0001'; end if;
  -- Una solicitud de informes no crea paciente: aceptarla solo la marca como atendida.
  if s.tipo <> 'cita' then
    update public.solicitud_contacto set estado = 'aceptada', resuelta_el = now() where id = p_id;
    return null;
  end if;

  insert into public.paciente (nombres, primer_apellido, segundo_apellido, nacimiento, sexo, nacionalidad, pais, idioma, telefono, correo,
                               emergencia_nombre, emergencia_parentesco, emergencia_telefono, padecimiento_principal)
  values (btrim(s.nombres), btrim(s.primer_apellido), nullif(btrim(coalesce(s.segundo_apellido, '')), ''), s.nacimiento, s.sexo, s.nacionalidad, s.pais, s.idioma,
          btrim(s.telefono), lower(btrim(s.correo)), btrim(s.emergencia_nombre), btrim(s.emergencia_parentesco), btrim(s.emergencia_telefono), btrim(s.mensaje))
  returning id into nuevo;

  update public.solicitud_contacto set estado = 'aceptada', paciente_id = nuevo, resuelta_el = now() where id = p_id;
  return nuevo;
end;
$$;
revoke all on function public.aceptar_solicitud(uuid) from public, anon;
grant execute on function public.aceptar_solicitud(uuid) to authenticated;

-- ✗ Rechazar: no se integra como paciente.
create function public.rechazar_solicitud(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'solo-administracion' using errcode = '42501';
  end if;
  update public.solicitud_contacto set estado = 'rechazada', resuelta_el = now() where id = p_id and estado = 'nueva';
  if not found then raise exception 'ya-resuelta' using errcode = 'P0001'; end if;
end;
$$;
revoke all on function public.rechazar_solicitud(uuid) from public, anon;
grant execute on function public.rechazar_solicitud(uuid) to authenticated;
