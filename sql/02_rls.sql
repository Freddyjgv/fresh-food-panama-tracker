-- Fresh Food Panamá Tracker - RLS Policies

alter table public.clients enable row level security;
alter table public.profiles enable row level security;
alter table public.shipments enable row level security;
alter table public.milestones enable row level security;
alter table public.shipment_files enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  );
$$;

-- PROFILES: cada quien ve su perfil; admin ve todo
create policy "profiles_select_own_or_admin" on public.profiles
for select
using (user_id = auth.uid() or public.is_admin());

create policy "profiles_insert_admin_only" on public.profiles
for insert
with check (public.is_admin());

create policy "profiles_update_admin_only" on public.profiles
for update
using (public.is_admin())
with check (public.is_admin());

-- CLIENTS: cliente ve su empresa; admin ve todo
create policy "clients_select_own_or_admin" on public.clients
for select
using (
  public.is_admin()
  or id = (select client_id from public.profiles where user_id = auth.uid())
);

create policy "clients_write_admin_only" on public.clients
for all
using (public.is_admin())
with check (public.is_admin());

-- SHIPMENTS: cliente ve los suyos; admin ve todo
create policy "shipments_select_own_or_admin" on public.shipments
for select
using (
  public.is_admin()
  or client_id = (select client_id from public.profiles where user_id = auth.uid())
);

create policy "shipments_write_admin_only" on public.shipments
for all
using (public.is_admin())
with check (public.is_admin());

-- MILESTONES: depende del shipment
create policy "milestones_select_own_or_admin" on public.milestones
for select
using (
  public.is_admin()
  or shipment_id in (
    select id from public.shipments
    where client_id = (select client_id from public.profiles where user_id = auth.uid())
  )
);

create policy "milestones_write_admin_only" on public.milestones
for all
using (public.is_admin())
with check (public.is_admin());

-- FILES: depende del shipment
create policy "files_select_own_or_admin" on public.shipment_files
for select
using (
  public.is_admin()
  or shipment_id in (
    select id from public.shipments
    where client_id = (select client_id from public.profiles where user_id = auth.uid())
  )
);

create policy "files_write_admin_only" on public.shipment_files
for all
using (public.is_admin())
with check (public.is_admin());
