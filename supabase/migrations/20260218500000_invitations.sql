-- Lucid: 招待制（紹介制）システム
-- 招待コードによるクローズド登録を実現

-- ============================================================
-- Invitations: 招待コード管理
-- ============================================================
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create index idx_invitations_code on public.invitations(code);
create index idx_invitations_created_by on public.invitations(created_by);

alter table public.invitations enable row level security;

-- 自分が作成した招待のみ閲覧可
create policy "Users can read own invitations"
  on public.invitations for select
  using (auth.uid() = created_by);

-- 自分の招待コードのみ作成可
create policy "Users can create invitations"
  on public.invitations for insert
  with check (auth.uid() = created_by);

-- ============================================================
-- verify_invitation: 招待コードの有効性チェック
-- ============================================================
create or replace function public.verify_invitation(p_code text)
returns jsonb as $$
declare
  v_invitation record;
begin
  select * into v_invitation
  from public.invitations
  where code = p_code;

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;

  if v_invitation.used_by is not null then
    return jsonb_build_object('valid', false, 'reason', 'already_used');
  end if;

  if v_invitation.expires_at < now() then
    return jsonb_build_object('valid', false, 'reason', 'expired');
  end if;

  return jsonb_build_object('valid', true, 'code', p_code);
end;
$$ language plpgsql security definer;

-- ============================================================
-- use_invitation: 招待コード使用をマーク
-- ============================================================
create or replace function public.use_invitation(p_code text, p_user_id uuid)
returns jsonb as $$
declare
  v_invitation record;
begin
  select * into v_invitation
  from public.invitations
  where code = p_code
  for update;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'not_found');
  end if;

  if v_invitation.used_by is not null then
    return jsonb_build_object('success', false, 'reason', 'already_used');
  end if;

  if v_invitation.expires_at < now() then
    return jsonb_build_object('success', false, 'reason', 'expired');
  end if;

  update public.invitations
  set used_by = p_user_id, used_at = now()
  where id = v_invitation.id;

  return jsonb_build_object('success', true);
end;
$$ language plpgsql security definer;
