-- =====================================================
-- MJ ADMIN V12 - ESTRUTURA INICIAL POSTGRESQL / SUPABASE
-- Fase 1: tabelas equivalentes ao Google Sheets atual.
-- IDs permanecem TEXT para permitir importar os IDs atuais sem conversão.
-- =====================================================

create table if not exists public.products (
  id text primary key,
  code text,
  name text not null,
  category text,
  description text,
  unit text,
  cost numeric(14,2) default 0,
  price numeric(14,2),
  stock numeric(14,3) default 0,
  min_stock numeric(14,3) default 0,
  supplier text,
  status text default 'Ativo',
  variable_price boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  data jsonb not null default '{}'::jsonb
);

create table if not exists public.clients (
  id text primary key,
  type text,
  document text,
  name text not null,
  fantasy_name text,
  phone text,
  whatsapp text,
  email text,
  cep text,
  address text,
  city text,
  state text,
  notes text,
  status text default 'Ativo',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  data jsonb not null default '{}'::jsonb
);

create table if not exists public.suppliers (
  id text primary key,
  name text not null,
  document text,
  phone text,
  whatsapp text,
  email text,
  contact text,
  notes text,
  status text default 'Ativo',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  data jsonb not null default '{}'::jsonb
);

create table if not exists public.quotes (
  id text primary key,
  num text,
  date date,
  client_id text,
  client_name text,
  subtotal numeric(14,2) default 0,
  discount numeric(14,2) default 0,
  total numeric(14,2) default 0,
  validity text,
  status text,
  payment_terms text,
  obs text,
  converted_at timestamptz,
  sale_id text,
  updated_at timestamptz default now(),
  data jsonb not null default '{}'::jsonb
);

create table if not exists public.quote_items (
  id text primary key,
  quote_id text not null references public.quotes(id) on delete cascade,
  product_id text,
  code text,
  name text,
  qty numeric(14,3) default 0,
  unit_price numeric(14,2) default 0,
  data jsonb not null default '{}'::jsonb
);
create index if not exists idx_quote_items_quote_id on public.quote_items(quote_id);

create table if not exists public.sales (
  id text primary key,
  num text,
  date date,
  client_id text,
  client_name text,
  seller text,
  subtotal numeric(14,2) default 0,
  discount numeric(14,2) default 0,
  total numeric(14,2) default 0,
  payment text,
  status text,
  source_quote_id text,
  obs text,
  installments integer default 1,
  first_due_date date,
  receipt_file_id text,
  receipt_file_name text,
  receipt_url text,
  receipt_uploaded_at timestamptz,
  created_at timestamptz default now(),
  cancelled_at timestamptz,
  updated_at timestamptz default now(),
  data jsonb not null default '{}'::jsonb
);

create table if not exists public.sale_items (
  id text primary key,
  sale_id text not null references public.sales(id) on delete cascade,
  product_id text,
  code text,
  name text,
  qty numeric(14,3) default 0,
  unit_price numeric(14,2) default 0,
  data jsonb not null default '{}'::jsonb
);
create index if not exists idx_sale_items_sale_id on public.sale_items(sale_id);

create table if not exists public.stock_movements (
  id text primary key,
  date timestamptz,
  product_id text,
  type text,
  qty numeric(14,3) default 0,
  source text,
  source_id text,
  notes text,
  created_at timestamptz default now(),
  data jsonb not null default '{}'::jsonb
);
create index if not exists idx_stock_movements_product_id on public.stock_movements(product_id);
create index if not exists idx_stock_movements_created_at on public.stock_movements(created_at desc);

create table if not exists public.financial (
  id text primary key,
  type text,
  source text,
  source_id text,
  description text,
  category text,
  date date,
  due_date date,
  value numeric(14,2) default 0,
  payment text,
  status text,
  notes text,
  installment_number integer,
  installment_total integer,
  installment_group_id text,
  created_at timestamptz default now(),
  paid_at timestamptz,
  updated_at timestamptz default now(),
  data jsonb not null default '{}'::jsonb
);
create index if not exists idx_financial_due_date on public.financial(due_date);
create index if not exists idx_financial_status on public.financial(status);

create table if not exists public.expenses (
  id text primary key,
  date date,
  due_date date,
  status text,
  value numeric(14,2) default 0,
  description text,
  category text,
  payment text,
  supplier text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  data jsonb not null default '{}'::jsonb
);

create table if not exists public.purchases (
  id text primary key,
  num text,
  date date,
  supplier_id text,
  supplier_name text,
  subtotal numeric(14,2) default 0,
  discount numeric(14,2) default 0,
  freight numeric(14,2) default 0,
  total numeric(14,2) default 0,
  payment text,
  finance_status text,
  generate_finance boolean default false,
  update_cost boolean default false,
  due_date date,
  notes text,
  status text,
  installments integer default 1,
  receipt_file_id text,
  receipt_file_name text,
  receipt_url text,
  receipt_uploaded_at timestamptz,
  created_at timestamptz default now(),
  cancelled_at timestamptz,
  updated_at timestamptz default now(),
  data jsonb not null default '{}'::jsonb
);

create table if not exists public.purchase_items (
  id text primary key,
  purchase_id text not null references public.purchases(id) on delete cascade,
  product_id text,
  code text,
  name text,
  qty numeric(14,3) default 0,
  unit_cost numeric(14,2) default 0,
  previous_cost numeric(14,2) default 0,
  data jsonb not null default '{}'::jsonb
);
create index if not exists idx_purchase_items_purchase_id on public.purchase_items(purchase_id);

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists public.infinitepay_transactions (
  id text primary key,
  sale_id text,
  order_nsu text,
  transaction_nsu text,
  slug text,
  value numeric(14,2) default 0,
  method text,
  status text,
  created_at timestamptz default now(),
  paid_at timestamptz,
  receipt_url text,
  updated_at timestamptz default now(),
  data jsonb not null default '{}'::jsonb
);

-- O usuário de login ficará vinculado ao auth.users do Supabase na Fase 2.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  legacy_id text,
  name text not null,
  email text,
  role text default 'Vendedor',
  status text default 'Ativo',
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_login_at timestamptz,
  data jsonb not null default '{}'::jsonb
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  event_at timestamptz not null default now(),
  action text,
  key text,
  details text,
  user_id uuid,
  user_name text,
  user_email text,
  module text,
  record_id text,
  record_label text,
  type text,
  data jsonb not null default '{}'::jsonb
);
create index if not exists idx_audit_logs_event_at on public.audit_logs(event_at desc);
create index if not exists idx_audit_logs_module on public.audit_logs(module);
create index if not exists idx_audit_logs_user_id on public.audit_logs(user_id);
create index if not exists idx_audit_logs_record_id on public.audit_logs(record_id);

-- Segurança: as tabelas ficam fechadas até criarmos as políticas da Fase 2.
alter table public.products enable row level security;
alter table public.clients enable row level security;
alter table public.suppliers enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.financial enable row level security;
alter table public.expenses enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.app_config enable row level security;
alter table public.infinitepay_transactions enable row level security;
alter table public.profiles enable row level security;
alter table public.audit_logs enable row level security;

-- Não criamos políticas abertas nesta etapa de propósito.
-- A Fase 2 criará policies para usuários autenticados e permissões por perfil.
