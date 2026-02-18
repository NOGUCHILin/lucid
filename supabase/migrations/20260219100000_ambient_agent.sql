-- Lucid: 環境型エージェント（Ambient Agent）
-- 新規ユーザーにデフォルトで環境エージェント＋自分会話を自動作成

-- ============================================================
-- user_context_summaries: 会話ごとのコンテキスト要約
-- ============================================================
create table if not exists public.user_context_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  summary text not null,
  token_count integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_ctx_summary_user_conv
  on public.user_context_summaries(user_id, conversation_id);

do $$ begin
  alter table public.user_context_summaries enable row level security;
exception when others then null;
end $$;

-- RLSポリシー（既存時はスキップ）
do $$ begin
  create policy "Users can read own summaries"
    on public.user_context_summaries for select
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

-- ============================================================
-- handle_new_user() 拡張: wallet + profile + 環境エージェント + 自分会話
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_agent_id uuid;
  v_conv_id uuid;
begin
  -- ウォレット作成
  insert into public.wallets (entity_id, entity_type, balance, daily_limit)
  values (new.id, 'user', 0, 100000);

  -- プロフィール作成
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));

  -- 環境エージェント作成
  insert into public.agents (owner_id, name, trust_score, status, config)
  values (new.id, 'Ambient', 50, 'active', '{"type":"ambient"}')
  returning id into v_agent_id;

  -- エージェント用ウォレット
  insert into public.wallets (entity_id, entity_type, balance, daily_limit)
  values (v_agent_id, 'agent', 0, 10000);

  -- 自分会話（agent型）
  insert into public.conversations (type, agent_id)
  values ('agent', v_agent_id)
  returning id into v_conv_id;

  -- メンバー追加（ピン留め）
  insert into public.conversation_members (conversation_id, user_id, pinned)
  values (v_conv_id, new.id, true);

  -- 最初のページ
  insert into public.pages (title, owner_id, conversation_id, agent_id)
  values ('', new.id, v_conv_id, v_agent_id);

  return new;
end;
$$ language plpgsql security definer;

-- ============================================================
-- 既存ユーザーマイグレーション: self-conversation → agent型 + 環境エージェント
-- ============================================================
do $$
declare
  v_user record;
  v_agent_id uuid;
  v_conv record;
begin
  for v_user in (
    select distinct cm.user_id
    from public.conversation_members cm
    join public.conversations c on c.id = cm.conversation_id
    where c.type = 'human'
      and c.agent_id is null
      -- self-conversation = メンバーが1人だけ
      and (select count(*) from public.conversation_members cm2 where cm2.conversation_id = c.id) = 1
  ) loop
    -- 環境エージェント作成
    insert into public.agents (owner_id, name, trust_score, status, config)
    values (v_user.user_id, 'Ambient', 50, 'active', '{"type":"ambient"}')
    returning id into v_agent_id;

    -- エージェント用ウォレット（重複時はスキップ）
    insert into public.wallets (entity_id, entity_type, balance, daily_limit)
    values (v_agent_id, 'agent', 0, 10000)
    on conflict (entity_id, entity_type) do nothing;

    -- self-conversationを特定してagent型に変換
    for v_conv in (
      select c.id
      from public.conversations c
      join public.conversation_members cm on cm.conversation_id = c.id
      where cm.user_id = v_user.user_id
        and c.type = 'human'
        and c.agent_id is null
        and (select count(*) from public.conversation_members cm2 where cm2.conversation_id = c.id) = 1
      limit 1
    ) loop
      update public.conversations
      set type = 'agent', agent_id = v_agent_id
      where id = v_conv.id;

      -- 会話内の全ページにagent_idを設定
      update public.pages
      set agent_id = v_agent_id
      where conversation_id = v_conv.id;
    end loop;
  end loop;
end $$;
