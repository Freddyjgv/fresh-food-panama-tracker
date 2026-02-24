-- Fresh Food Panamá Tracker - Schema

create extension if not exists "uuid-ossp";

-- Clients (empresas)
create table if not exists public.clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  contact_name text,
  contact_email text not null unique,
  created_at timestamptz not null default now()
);

-- Profiles (roles de usuarios)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','client')),
  client_id uuid references public.clients(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Shipments (embarques)
create table if not exists public.shipments (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  code text not null unique,
  destination text not null,
  status text not null check (status in ('CREATED','PACKED','DOCS_READY','ARRIVED_PTY','DEPARTED')),
  boxes integer,
  pallets integer,
  weight_kg numeric,
  flight_number text,
  awb text,
  created_at timestamptz not null default now()
);

-- Milestones (hitos)
create table if not exists public.milestones (
  id uuid primary key default uuid_generate_v4(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  type text not null check (type in ('PACKED','DOCS_READY','ARRIVED_PTY','DEPARTED')),
  at timestamptz not null default now(),
  note text,
  actor_email text,
  created_at timestamptz not null default now(),
  unique (shipment_id, type)
);

-- Files (docs/fotos)
create table if not exists public.shipment_files (
  id uuid primary key default uuid_generate_v4(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  kind text not null check (kind in ('doc','photo')),
  doc_type text,
  filename text not null,
  bucket text not null,
  storage_path text not null,
  uploaded_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_shipments_client_created on public.shipments (client_id, created_at desc);
create index if not exists idx_shipments_client_destination_created on public.shipments (client_id, destination, created_at desc);
create unique index if not exists idx_shipments_code on public.shipments (code);
create index if not exists idx_milestones_shipment_at on public.milestones (shipment_id, at desc);
create index if not exists idx_files_shipment_created on public.shipment_files (shipment_id, created_at desc);
