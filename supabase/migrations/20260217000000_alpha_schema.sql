-- Lucid α Schema
-- Pages + Wallets + Transactions

-- ============================================================
-- Pages: ページ型キャンバスの永続化
-- ============================================================
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  content_snapshot bytea,  -- Yjs binary snapshot
  owner_id uuid not null references auth.users(id) on delete cascade,
  prev_page_id uuid references public.pages(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_pages_owner on public.pages(owner_id);
create index idx_pages_prev on public.pages(prev_page_id);

alter table public.pages enable row level security;

create policy "Users can read own pages"
  on public.pages for select
  using (auth.uid() = owner_id);

create policy "Users can insert own pages"
  on public.pages for insert
  with check (auth.uid() = owner_id);

create policy "Users can update own pages"
  on public.pages for update
  using (auth.uid() = owner_id);

-- ============================================================
-- Wallets: エンティティごとの残高管理
-- ============================================================
create type public.entity_type as enum ('user', 'agent');

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null,
  entity_type public.entity_type not null,
  balance decimal(12,2) not null default 0,
  daily_spent decimal(12,2) not null default 0,
  daily_limit decimal(12,2) not null default 1000,
  updated_at timestamptz not null default now(),
  unique(entity_id, entity_type)
);

alter table public.wallets enable row level security;

create policy "Users can read own wallet"
  on public.wallets for select
  using (auth.uid() = entity_id and entity_type = 'user');

create policy "Users can update own wallet"
  on public.wallets for update
  using (auth.uid() = entity_id and entity_type = 'user');

-- ============================================================
-- Transactions: 取引履歴
-- ============================================================
create type public.transaction_type as enum ('top_up', 'usage', 'transfer', 'refund');
create type public.transaction_status as enum ('pending', 'completed', 'failed');

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  type public.transaction_type not null,
  from_wallet_id uuid references public.wallets(id),
  to_wallet_id uuid references public.wallets(id),
  amount decimal(12,2) not null,
  description text not null default '',
  metadata jsonb default '{}',
  status public.transaction_status not null default 'pending',
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index idx_transactions_from on public.transactions(from_wallet_id);
create index idx_transactions_to on public.transactions(to_wallet_id);

alter table public.transactions enable row level security;

create policy "Users can read own transactions"
  on public.transactions for select
  using (
    from_wallet_id in (select id from public.wallets where entity_id = auth.uid())
    or to_wallet_id in (select id from public.wallets where entity_id = auth.uid())
  );

-- ============================================================
-- Auto-create wallet on user signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.wallets (entity_id, entity_type, balance, daily_limit)
  values (new.id, 'user', 0, 100000);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Auto-update updated_at
-- ============================================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger pages_updated_at
  before update on public.pages
  for each row execute function public.update_updated_at();

create trigger wallets_updated_at
  before update on public.wallets
  for each row execute function public.update_updated_at();
