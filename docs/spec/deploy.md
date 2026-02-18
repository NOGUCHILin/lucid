# デプロイ・運用ガイド

## インフラ構成

| サービス | デプロイ先 | Production URL |
|---------|-----------|----------------|
| Next.js (Web) | Vercel | `lucid-web-noguchilins-projects.vercel.app` |
| Hocuspocus (WS) | Railway | `lucidhocuspocus-production.up.railway.app` |
| DB + Auth | Supabase Cloud | `fjjmwehrsnwbqdmndvdw.supabase.co` |

## ブランチ戦略（GitHub Flow）

| Branch | 用途 | デプロイ先 | 保護 |
|--------|------|-----------|------|
| `main` | 本番 | Vercel Production + Railway | PR必須 |
| `dev` | 開発 | Vercel Preview | なし |
| `feature/*` | 機能開発 | PR時Vercel Preview | なし |

### ワークフロー

```
feature/* → PR → dev → PR → main
                 ↓         ↓
           Vercel Preview  Vercel Prod + Railway
```

## CI/CD

- **Vercel**: GitHub連携、push時自動デプロイ（Production Branch: `main`）
- **Railway**: GitHub連携、`main`ブランチ監視、Watch Path: `/server/hocuspocus/**`
- **Supabase**: 手動（`supabase db push --linked`）

## 環境変数

### Vercel (`apps/web`)
| 変数 | 用途 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名キー |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase サービスロールキー |
| `NEXT_PUBLIC_HOCUSPOCUS_URL` | Hocuspocus WebSocket URL |
| `NEXT_PUBLIC_APP_URL` | アプリケーション URL |

### Railway (`server/hocuspocus`)
| 変数 | 用途 |
|------|------|
| `NODE_ENV` | `production` |
| `SUPABASE_URL` | Supabase API URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase サービスロールキー |

## マイグレーション手順

```bash
# 新しいマイグレーション作成
supabase migration new <name>

# ローカル確認
supabase db reset

# 本番適用（手動）
supabase db push --linked
```

## 注意事項

- Vercel環境変数を設定する際、`<<<`(here-string)は末尾に改行が混入するため `printf 'value' | vercel env add` を使用
- Hocuspocusはビルド不要（tsx runtime）、Railwayのbuildは`pnpm install --frozen-lockfile`のみ
- `NEXT_PUBLIC_*`はビルド時にバンドルされるため、変更後は再デプロイが必要
