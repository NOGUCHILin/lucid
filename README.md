# Lucid

**AIの中で暮らすOS** — チャットではなく、共在する。

## セットアップ

```bash
# 依存インストール
pnpm install

# Supabase起動（初回: supabase init）
supabase start

# .env.local 作成（apps/web/.env.example を参照）
cp apps/web/.env.example apps/web/.env.local
# → NEXT_PUBLIC_SUPABASE_ANON_KEY を supabase status の出力で埋める

# 全サービス一括起動
pnpm dev
```

## 起動されるサービス

| サービス | URL | 説明 |
|---------|-----|------|
| Next.js | http://localhost:3000 | Webアプリ |
| Hocuspocus | ws://localhost:1234 | リアルタイム同期 |
| Supabase | http://localhost:54321 | DB・認証 |

## プロジェクト構成

```
apps/web/          Next.js 15 フロントエンド
packages/database/ Supabaseクライアント
server/hocuspocus/ リアルタイム同期サーバー
supabase/          マイグレーション
docs/spec/         仕様書
```

## 技術スタック

- **エディタ**: TipTap (ProseMirror) + Yjs (CRDT)
- **同期**: Hocuspocus WebSocket
- **DB/認証**: Supabase (PostgreSQL + Auth)
- **フロント**: Next.js 15 + Tailwind CSS + shadcn/ui
