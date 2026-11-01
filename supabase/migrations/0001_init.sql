-- Грош: схема данных. Запускается один раз: SQL Editor → New query → вставить → Run.
-- Каждая таблица защищена RLS: пользователь видит и меняет только свои строки.
-- Удаление «мягкое» (deleted_at), чтобы удаление доходило до всех устройств при синхронизации.

-- обновляем updated_at, если клиент его не прислал (на случай ручных правок в базе)
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  if new.updated_at is null or new.updated_at = old.updated_at then new.updated_at := now(); end if;
  return new;
end $$;

-- профиль, настройки и мета (награды, витрина) — одна строка на пользователя
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users on delete cascade default auth.uid(),
  name       text,
  color      text,
  showcase   text[] not null default '{}',
  settings   jsonb not null default '{}',
  meta       jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  user_id    uuid not null references auth.users on delete cascade default auth.uid(),
  id         text not null,
  type       text not null check (type in ('expense', 'income', 'transfer')),
  name       text not null,
  icon       text not null,
  color      text not null,
  sort       int  not null default 0,
  archived   boolean not null default false,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table if not exists public.transactions (
  id             uuid primary key,
  user_id        uuid not null references auth.users on delete cascade default auth.uid(),
  type           text not null check (type in ('expense', 'income', 'transfer')),
  cat            text not null,
  amount         bigint not null,              -- тенге, без копеек; у перевода с депозита может быть отрицательной
  date           date not null,
  note           text not null default '',
  installment_id uuid,                          -- платёж по рассрочке
  installment_k  int,
  deposit_id     uuid,                          -- перевод на депозит или с него
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create table if not exists public.challenges (
  id           uuid primary key,
  user_id      uuid not null references auth.users on delete cascade default auth.uid(),
  cat          text not null,
  limit_amount bigint not null check (limit_amount > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create table if not exists public.installments (
  id          uuid primary key,
  user_id     uuid not null references auth.users on delete cascade default auth.uid(),
  name        text not null,
  total       bigint not null check (total > 0),
  months      int not null check (months between 1 and 120),
  first_date  date not null,
  paid_before int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table if not exists public.deposits (
  id         uuid primary key,
  user_id    uuid not null references auth.users on delete cascade default auth.uid(),
  name       text not null,
  rate       numeric(6, 3) not null check (rate >= 0 and rate < 100), -- номинальная ставка, % годовых
  term       int not null check (term between 1 and 120),            -- месяцев
  cap        boolean not null default true,                           -- ежемесячная капитализация
  start_date date not null,
  closed_at  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- синхронизация читает «всё, что изменилось после…»
create index if not exists transactions_user_updated on public.transactions (user_id, updated_at);
create index if not exists categories_user_updated   on public.categories (user_id, updated_at);
create index if not exists challenges_user_updated   on public.challenges (user_id, updated_at);
create index if not exists installments_user_updated on public.installments (user_id, updated_at);
create index if not exists deposits_user_updated     on public.deposits (user_id, updated_at);
create index if not exists transactions_user_date    on public.transactions (user_id, date) where deleted_at is null;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'categories', 'transactions', 'challenges', 'installments', 'deposits'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('drop trigger if exists touch on public.%I', t);
    execute format('create trigger touch before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- права для вошедших пользователей (в новых проектах Supabase они не выдаются автоматически);
-- строки всё равно ограничены правилами RLS выше
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.categories, public.transactions,
  public.challenges, public.installments, public.deposits to authenticated;

-- обновить кеш схемы, чтобы таблицы сразу появились в API
notify pgrst, 'reload schema';
