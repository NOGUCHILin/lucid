-- Lucid: Messaging UI Schema
-- profiles, conversations, conversation_members, friendships + pages拡張

-- ============================================================
-- Profiles: ユーザー公開プロフィール
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Anyone can read profiles"
  on public.profiles for select using (true);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

-- handle_new_user() を拡張: walletに加えてprofileも作成
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.wallets (entity_id, entity_type, balance, daily_limit)
  values (new.id, 'user', 0, 100000);

  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));

  return new;
end;
$$ language plpgsql security definer;

-- 既存ユーザーのprofileを作成
insert into public.profiles (id, display_name)
select id, coalesce(raw_user_meta_data->>'name', split_part(email, '@', 1))
from auth.users
where id not in (select id from public.profiles)
on conflict (id) do nothing;

-- ============================================================
-- Conversations: 会話（human同士 or user-agent）
-- ============================================================
create type public.conversation_type as enum ('human', 'agent');

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  type public.conversation_type not null,
  agent_id uuid references public.agents(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.conversations enable row level security;

create trigger conversations_updated_at
  before update on public.conversations
  for each row execute function public.update_updated_at();

-- ============================================================
-- Conversation Members: 会話参加者
-- ============================================================
create table public.conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  pinned boolean not null default false,
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(conversation_id, user_id)
);

create index idx_conv_members_user on public.conversation_members(user_id);
create index idx_conv_members_conv on public.conversation_members(conversation_id);

alter table public.conversation_members enable row level security;

create policy "Users can read own memberships"
  on public.conversation_members for select
  using (auth.uid() = user_id);
create policy "Users can update own memberships"
  on public.conversation_members for update
  using (auth.uid() = user_id);
create policy "Users can insert memberships"
  on public.conversation_members for insert
  with check (auth.uid() = user_id);

-- Conversations RLS: メンバーのみ閲覧可
create policy "Members can read conversations"
  on public.conversations for select
  using (
    id in (select conversation_id from public.conversation_members where user_id = auth.uid())
  );
create policy "Authenticated users can create conversations"
  on public.conversations for insert
  with check (auth.uid() is not null);
create policy "Members can update conversations"
  on public.conversations for update
  using (
    id in (select conversation_id from public.conversation_members where user_id = auth.uid())
  );

-- ============================================================
-- Friendships: フレンドリクエスト
-- ============================================================
create type public.friendship_status as enum ('pending', 'accepted', 'rejected');

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(requester_id, addressee_id),
  check (requester_id != addressee_id)
);

create index idx_friendships_requester on public.friendships(requester_id);
create index idx_friendships_addressee on public.friendships(addressee_id);

alter table public.friendships enable row level security;

create policy "Users can read own friendships"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "Users can insert friendships as requester"
  on public.friendships for insert
  with check (auth.uid() = requester_id);
create policy "Users can update friendships as addressee"
  on public.friendships for update
  using (auth.uid() = addressee_id);

create trigger friendships_updated_at
  before update on public.friendships
  for each row execute function public.update_updated_at();

-- ============================================================
-- Pages: conversation_id カラム追加
-- ============================================================
alter table public.pages add column conversation_id uuid references public.conversations(id) on delete set null;
create index idx_pages_conversation on public.pages(conversation_id);

-- Pages RLSを拡張: 自分のページ OR 会話メンバーとしてアクセス可
drop policy if exists "Users can read own pages" on public.pages;
create policy "Users can read accessible pages"
  on public.pages for select
  using (
    auth.uid() = owner_id
    or conversation_id in (
      select conversation_id from public.conversation_members where user_id = auth.uid()
    )
  );

-- ============================================================
-- Notifications: type拡張（friend_request, friend_accepted追加）
-- ============================================================
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('mention', 'approval_request', 'agent_paused', 'fund_low', 'friend_request', 'friend_accepted'));

-- ============================================================
-- Realtime有効化
-- ============================================================
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.conversation_members;

-- ============================================================
-- 既存データマイグレーション: 孤立ページを「マイノート」会話に紐付け
-- ============================================================
do $$
declare
  v_user record;
  v_conv_id uuid;
begin
  for v_user in (select distinct owner_id from public.pages where conversation_id is null) loop
    insert into public.conversations (type)
    values ('human')
    returning id into v_conv_id;

    insert into public.conversation_members (conversation_id, user_id, pinned)
    values (v_conv_id, v_user.owner_id, true);

    update public.pages
    set conversation_id = v_conv_id
    where owner_id = v_user.owner_id and conversation_id is null;
  end loop;
end $$;
