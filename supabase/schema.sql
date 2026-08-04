-- ============================================================
--  Rastreador de Hábitos — Esquema de base de datos (Supabase)
-- ============================================================
--  Pega TODO este archivo en:  Supabase Dashboard -> SQL Editor -> New query -> Run
--  Crea las tablas, los índices y las políticas de seguridad por fila (RLS).
--  El RLS es OBLIGATORIO: garantiza que cada usuario solo acceda a SUS datos.
-- ============================================================

-- ----------------------------------------------------------------
-- Tabla de hábitos
-- ----------------------------------------------------------------
create table if not exists public.habits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  color       text not null default '#5b5bd6',
  position    int  not null default 0,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- Registros de cumplimiento: un registro por hábito y por día.
-- La restricción UNIQUE permite usar UPSERT al marcar/desmarcar.
-- ----------------------------------------------------------------
create table if not exists public.habit_logs (
  id          uuid primary key default gen_random_uuid(),
  habit_id    uuid not null references public.habits (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  log_date    date not null,
  completed   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (habit_id, log_date)
);

-- Índice para consultar rápido los registros de un usuario por rango de fechas.
create index if not exists habit_logs_user_date_idx
  on public.habit_logs (user_id, log_date);

-- ----------------------------------------------------------------
-- Seguridad por fila (Row Level Security)
-- ----------------------------------------------------------------
alter table public.habits     enable row level security;
alter table public.habit_logs enable row level security;

-- Cada usuario gestiona únicamente sus propios hábitos.
drop policy if exists "habits: solo el dueño" on public.habits;
create policy "habits: solo el dueño"
  on public.habits
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Cada usuario gestiona únicamente sus propios registros.
drop policy if exists "habit_logs: solo el dueño" on public.habit_logs;
create policy "habit_logs: solo el dueño"
  on public.habit_logs
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- Metas (corto / mediano / largo plazo)
-- ----------------------------------------------------------------
create table if not exists public.goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null,
  description  text,
  term         text not null check (term in ('short', 'medium', 'long')),
  start_date   date,
  end_date     date,
  completed    boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Migración desde una versión anterior de este esquema que solo tenía
-- `target_date`: agrega `start_date` y renombra `target_date` -> `end_date`.
-- Es seguro volver a correr este bloque las veces que quieras.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'goals' and column_name = 'start_date'
  ) then
    alter table public.goals add column start_date date;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'goals' and column_name = 'target_date'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'goals' and column_name = 'end_date'
  ) then
    alter table public.goals rename column target_date to end_date;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'goals' and column_name = 'end_date'
  ) then
    alter table public.goals add column end_date date;
  end if;
end $$;

create index if not exists goals_user_term_idx
  on public.goals (user_id, term);

alter table public.goals enable row level security;

drop policy if exists "goals: solo el dueño" on public.goals;
create policy "goals: solo el dueño"
  on public.goals
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- Eliminar mi cuenta
-- ----------------------------------------------------------------
-- Un usuario autenticado no tiene permiso para borrar filas de auth.users
-- directamente (con razón: eso lo maneja Supabase Auth). Esta función corre
-- con los privilegios de quien la crea (security definer), así que SÍ puede
-- borrar auth.users, pero SOLO la fila del propio usuario que la invoca
-- (auth.uid(), tomado de su sesión — no se puede falsificar ni recibe un id
-- como parámetro). Al borrar auth.users, los "on delete cascade" de habits,
-- habit_logs y goals se encargan de borrar todo lo demás automáticamente.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- ----------------------------------------------------------------
-- Códigos de activación (tirilla de producto físico KROTON)
-- ----------------------------------------------------------------
-- Antes de ver el tablero, cada cuenta debe canjear un código de 6 dígitos
-- (pegado en la tirilla de la prenda). Un código solo se puede canjear una
-- vez, y una cuenta solo puede tener un código canjeado.
create table if not exists public.access_codes (
  code        text primary key,
  user_id     uuid references auth.users (id) on delete set null,
  redeemed_at timestamptz
);

-- Una cuenta no puede tener más de un código canjeado.
create unique index if not exists access_codes_user_id_unique
  on public.access_codes (user_id)
  where user_id is not null;

alter table public.access_codes enable row level security;

-- Cada usuario solo puede ver el código que él mismo canjeó (si tiene uno).
-- A propósito NO hay política de insert/update/delete para el usuario: el
-- canje pasa únicamente por redeem_access_code, así la tabla completa de
-- códigos nunca queda expuesta ni editable directamente desde el cliente
-- (evita listar o adivinar códigos por prueba y error).
drop policy if exists "access_codes: ver mi propio código" on public.access_codes;
create policy "access_codes: ver mi propio código"
  on public.access_codes
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Registro de intentos fallidos de canje, para poder limitar cuántos puede
-- hacer una cuenta seguidos. Sin esto, alguien autenticado podría escribir
-- un script que pruebe códigos al azar hasta acertar uno (hay 1000 códigos
-- válidos de 1.000.000 posibles: ~1 de cada 1000 intentos acertaría) y así
-- "robarle" a un comprador real el acceso que le corresponde a su tirilla.
create table if not exists public.access_code_attempts (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index if not exists access_code_attempts_user_time_idx
  on public.access_code_attempts (user_id, attempted_at);

alter table public.access_code_attempts enable row level security;
-- A propósito, sin políticas para el usuario: solo se lee/escribe desde
-- dentro de redeem_access_code (security definer), nunca directo desde el
-- cliente.

-- Canjea un código para la cuenta que invoca la función. Falla si el código
-- no existe, ya fue usado, si la cuenta ya tiene un código canjeado, o si
-- superó el límite de intentos fallidos recientes. El UPDATE con
-- "where user_id is null" es atómico: si dos personas intentan canjear el
-- mismo código al mismo tiempo, solo una lo consigue.
create or replace function public.redeem_access_code(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int;
  v_recent_attempts int;
begin
  if auth.uid() is null then
    raise exception 'No autenticado.';
  end if;

  if exists (select 1 from public.access_codes where user_id = auth.uid()) then
    raise exception 'Esta cuenta ya tiene un código registrado.';
  end if;

  select count(*) into v_recent_attempts
    from public.access_code_attempts
    where user_id = auth.uid() and attempted_at > now() - interval '10 minutes';

  if v_recent_attempts >= 5 then
    raise exception 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.';
  end if;

  update public.access_codes
    set user_id = auth.uid(), redeemed_at = now()
    where code = p_code and user_id is null;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    insert into public.access_code_attempts (user_id) values (auth.uid());
    raise exception 'Código inválido o ya utilizado.';
  end if;
end;
$$;

revoke all on function public.redeem_access_code(text) from public;
grant execute on function public.redeem_access_code(text) to authenticated;

-- Genera los 1000 códigos de 6 dígitos únicos (solo la primera vez que se
-- corre este archivo: si la tabla ya tiene códigos, no hace nada, así que
-- es seguro volver a pegar y correr todo el schema.sql las veces que quieras).
do $$
begin
  if (select count(*) from public.access_codes) = 0 then
    insert into public.access_codes (code)
    select lpad(n::text, 6, '0')
    from (
      select n
      from generate_series(0, 999999) as n
      order by random()
      limit 1000
    ) sub;
  end if;
end $$;

-- ----------------------------------------------------------------
-- Blindar hábitos, registros y metas al código de activación
-- ----------------------------------------------------------------
-- Hasta acá, el "candado" del código de 6 dígitos solo vivía en la interfaz:
-- cualquier cuenta autenticada podía crear o leer sus propios hábitos/metas
-- llamando directo a la API de Supabase con su propio token, sin pasar
-- nunca por la pantalla de "activa tu cuenta". Estas políticas reemplazan
-- a las de arriba para exigir también un código ya canjeado, así la regla
-- de negocio (solo compradores reales) se cumple de verdad en la base de
-- datos y no solo en la app. Es seguro volver a correr este bloque las
-- veces que quieras.
drop policy if exists "habits: solo el dueño" on public.habits;
drop policy if exists "habits: solo el dueño con código activo" on public.habits;
create policy "habits: solo el dueño con código activo"
  on public.habits
  for all
  to authenticated
  using (
    auth.uid() = user_id
    and exists (select 1 from public.access_codes ac where ac.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.access_codes ac where ac.user_id = auth.uid())
  );

drop policy if exists "habit_logs: solo el dueño" on public.habit_logs;
drop policy if exists "habit_logs: solo el dueño con código activo" on public.habit_logs;
create policy "habit_logs: solo el dueño con código activo"
  on public.habit_logs
  for all
  to authenticated
  using (
    auth.uid() = user_id
    and exists (select 1 from public.access_codes ac where ac.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.access_codes ac where ac.user_id = auth.uid())
  );

drop policy if exists "goals: solo el dueño" on public.goals;
drop policy if exists "goals: solo el dueño con código activo" on public.goals;
create policy "goals: solo el dueño con código activo"
  on public.goals
  for all
  to authenticated
  using (
    auth.uid() = user_id
    and exists (select 1 from public.access_codes ac where ac.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.access_codes ac where ac.user_id = auth.uid())
  );
