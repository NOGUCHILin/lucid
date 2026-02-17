# Lucid - アーキテクチャ設計

## アーキテクチャスタイル: モジュラーモノリス

単一デプロイメントの中に、明確なドメイン境界を持つモジュールを配置する。
ソロ開発の速度を維持しつつ、将来のスケールアウトに備える。

```
         ┌─ 今は1つのデプロイ ──────────────────────────┐
         │                                              │
         │  Page Module   ←→ Agent Module（OpenClaw）    │
         │       ↕              ↕                       │
         │  Trust Module  ←→ Economy Module             │
         │                                              │
         └──────────────────────────────────────────────┘
                     ↕ Event Bus（内部）
```

### なぜモジュラーモノリスか

| 選択肢 | 評価 |
|--------|------|
| 純粋モノリス | ✗ ドメイン境界が曖昧になりやすい |
| マイクロサービス | ✗ ソロ開発にはオーバーヘッド過大 |
| **モジュラーモノリス** | ◎ 速度と将来性のバランス |

---

## レイヤーアーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                    Client Layer                          │
│  Next.js 15 App Router + TipTap + Yjs Client            │
│  ページ型キャンバスUI / 行動トラッカー / システムUI        │
├─────────────────────────────────────────────────────────┤
│                     Sync Layer                           │
│  Hocuspocus Server（Yjs + ProseMirror CRDT同期）          │
│  リアルタイムリッチテキスト同期 / プレゼンス管理           │
├─────────────────────────────────────────────────────────┤
│                  Application Layer                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │   Page   │ │  Agent   │ │  Trust   │ │ Economy  │   │
│  │  Module  │ │  Module  │ │  Module  │ │  Module  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                   Event Bus（内部）                       │
├─────────────────────────────────────────────────────────┤
│                Infrastructure Layer                      │
│  Supabase (PostgreSQL + Auth + Storage + Realtime)       │
│  Stripe (Checkout + Connect)                             │
│  OpenClaw (Hetzner) / LLM APIs                           │
└─────────────────────────────────────────────────────────┘
```

---

## ドメインモジュール設計

### Page Module（ページ型キャンバス）

A4サイズのリッチテキスト編集ページの管理。

| 責務 | 実装 |
|------|------|
| ページ作成・削除 | Supabase（メタデータ） |
| リッチテキスト同期 | TipTap + y-prosemirror（CRDT） |
| ページ遷移 | 文字量監視 → 閾値超えでアイコン出現 → 次ページ生成 |
| ページ一覧・検索 | Supabase（全文検索） |
| スナップショット永続化 | Hocuspocus → Supabase（定期保存） |
| システムブロック | TipTapカスタムノード（承認カード・ウォレット等） |

**データの流れ**:
```
User入力 → TipTap → ProseMirror Doc → y-prosemirror → Hocuspocus → 他クライアント
                                                          ↓
                                                   定期スナップショット → Supabase
```

**ページ遷移ロジック**:
```
文字数/ブロック数を監視
  ↓ 閾値（A4相当 ≒ 約2,000文字）超過
次ページアイコン出現（ページ下部）
  ↓ クリック or 自動遷移
新ページ生成 → 前ページへのリンク保持
```

### Agent Module（OpenClaw統合）

OpenClawエージェントをLucidのページ参加者として統合する。

| 責務 | 実装 |
|------|------|
| OpenClaw接続 | Hetzner上のOpenClawインスタンスとAPI通信 |
| ページ参加 | エージェントがHocuspocus経由でページに書き込み |
| 行動ログ収集 | クライアント → API Route → Supabase |
| 意図推論 | OpenClawのLLM呼び出し（行動ログを入力） |
| 信頼度チェック | Trust Moduleに権限確認後にアクション実行 |
| コスト管理 | Economy Moduleでトークン消費を記録 |

**OpenClawの実行モデル**:
```
                    ┌─────────────────────────────────┐
                    │   OpenClaw（Hetzner）              │
Behavior Events →   │                                 │
                    │  1. 行動ログ受信                 │
Page Content  →     │  2. 意図推論（LLM）              │  → Hocuspocus経由で
                    │  3. アクション生成               │     ページに書き込み
Trust Score   →     │  4. 信頼度チェック               │
Wallet Balance →    │  5. コスト計算・決済             │
                    └─────────────────────────────────┘
```

**エージェントのページ参加方式**:
- OpenClawはHocuspocusのクライアントとして接続
- 人間と同じCRDTプロトコルでページに書き込む
- エージェントの書き込みは視覚的に区別（アイコン・背景色）
- 信頼度に応じて書き込み権限が変化

### Trust Module（信頼制御）

信頼度の計算・管理・権限制御。

| 責務 | 実装 |
|------|------|
| 信頼度スコア管理 | Supabase（権威データ） |
| アクセス制御判定 | ルールエンジン（v1はif/else、v2以降ML） |
| 信頼度自動調整 | フィードバック + 行動履歴の分析 |
| 権限チェックAPI | 他モジュールから呼ばれる関数 |

**信頼度はDB（Supabase）が権威**。CRDTには入れない。
理由: 信頼度の変更は「コンフリクト解決」ではなく「検証」が必要なため。

### Economy Module（経済）

ウォレット・トランザクション・Stripe統合。

| 責務 | 実装 |
|------|------|
| ウォレット管理 | Supabase（残高・上限） |
| トランザクション記録 | Supabase（取引履歴） |
| 承認フロー | Trust Module連携 → ページ上に承認カード表示 |
| Stripe入金 | Webhook → 残高加算 |
| コスト計算 | OpenClawのLLMトークン数 × 単価 |

**経済データもDB（Supabase）が権威**。CRDTには入れない。
理由: 金額の整合性にはトランザクション保証が必須なため。

---

## データ境界: CRDT vs DB

Lucidでは2つのデータストアが共存する。それぞれの役割を明確に分離する。

| データ | ストア | 理由 |
|--------|--------|------|
| ページコンテンツ（テキスト） | **Yjs CRDT** | リアルタイム性、コンフリクトフリー |
| カーソル位置・プレゼンス | **Yjs Awareness** | 一時的、永続化不要 |
| ユーザー情報・認証 | **Supabase** | 権威データ、Auth統合 |
| 信頼度スコア | **Supabase** | 検証が必要、権威データ |
| ウォレット・取引 | **Supabase** | トランザクション保証が必須 |
| 行動ログ | **Supabase** | 分析用の永続データ |
| エージェント設定 | **Supabase** | メタデータ、永続化必要 |
| ページスナップショット | **Supabase** | バックアップ・履歴・検索用 |

### 同期フロー

```
          CRDT層（リアルタイム）              DB層（永続・権威）
          ──────────────────              ─────────────────
User A ←→ ProseMirror Doc ←→ Hocuspocus → スナップショット → Supabase
User B ←→ ProseMirror Doc ↗                                  ↕
OpenClaw ←→ ProseMirror Doc ↗            Trust/Economy APIs ←→ Supabase
```

---

## 技術スタック詳細

### エディタ: TipTap + ProseMirror

| 比較項目 | TipTap | tldraw | Excalidraw |
|---------|--------|--------|------------|
| テキスト編集 | ◎ ネイティブ | ✗ テキストボックスのみ | ✗ テキストボックスのみ |
| ブロック型UI | ◎ Notion風ブロック | ✗ | ✗ |
| Yjs統合 | ◎ y-prosemirror公式 | ○ y-tldraw | ○ コミュニティ |
| カスタムノード | ◎ 拡張API充実 | ○ Shape API | △ 限定的 |
| ページ概念 | ◎ ドキュメント単位 | △ 無限キャンバス | △ 無限キャンバス |
| **Lucid適性** | ◎ ページ型UIに最適 | △ ホワイトボード向き | △ 図形描画向き |

**決定: TipTap（ProseMirror）**

TipTapのカスタムノード（Extension）で以下を実装:
- 承認カードブロック（承認/却下ボタン付き）
- ウォレットウィジェットブロック（残高・プログレスバー）
- エージェント書き込みブロック（アイコン + 背景色で区別）
- ページ遷移アイコン（次ページへのリンク）

### リアルタイム同期: Hocuspocus

```
Client (TipTap + y-prosemirror) ←→ Hocuspocus Server ←→ Client
                                          ↓
                                   Supabase (snapshots)
```

- **Hocuspocus**: TipTap公式のYjsサーバー
- **y-prosemirror**: ProseMirrorのステートをYjs Docにバインド
- スナップショットは変更時 + 5分間隔でSupabaseへ保存
- Hocuspocusは**Vercel以外**にデプロイ（WebSocket常時接続が必要）

### エージェント: OpenClaw（Hetzner）

```
┌──────────────────┐     ┌─────────────────────┐
│  Lucid App       │     │  Hetzner CX21       │
│  (Vercel)        │ API │  (€4.5/mo ≒ ¥900)   │
│                  │←───→│                     │
│  Hocuspocus      │ WSS │  OpenClaw Instance   │
│  (Railway/Fly)   │←───→│  4GB RAM, Docker    │
└──────────────────┘     └─────────────────────┘
```

- OpenClawはHetzner CX21（2vCPU/4GB RAM）でDockerデプロイ
- LucidのAPI Routes経由で行動ログ・ページコンテンツを送信
- OpenClawはHocuspocusに接続してページに書き込み
- LLMバックエンドはOpenClaw内で設定（Claude/GPT/DeepSeek）

---

## モジュール間通信: 内部イベントバス

モジュール間の結合を疎に保つため、内部イベントバスを使用する。

```typescript
type LucidEvent =
  | { type: 'page.content.updated'; pageId: string; userId: string }
  | { type: 'page.threshold.reached'; pageId: string }
  | { type: 'agent.action.requested'; agentId: string; action: AgentAction }
  | { type: 'trust.score.changed'; entityId: string; newScore: number }
  | { type: 'economy.transaction.completed'; transactionId: string }
  | { type: 'economy.balance.depleted'; walletId: string }
  | { type: 'user.behavior.recorded'; userId: string; event: BehaviorEvent }
```

**v1実装**: Node.js EventEmitter（プロセス内）
**将来**: Redis Streams / NATS（マイクロサービス分割時）

---

## ディレクトリ構造（案）

```
repo/
├── apps/
│   └── web/                    # Next.js 15 App Router
│       ├── app/
│       │   ├── (page)/         # ページ型キャンバスUI
│       │   ├── (auth)/         # 認証ページ
│       │   └── api/            # API Routes
│       │       ├── agent/      # OpenClaw連携endpoints
│       │       ├── economy/    # Economy endpoints
│       │       └── webhooks/   # Stripe webhooks
│       └── components/
│           ├── editor/         # TipTapラッパー・カスタムノード
│           ├── system-ui/      # ウォレット・承認カード等
│           └── shared/         # 共通UIコンポーネント
├── packages/
│   ├── page/                   # Page Module
│   │   ├── editor/             # TipTap拡張・カスタムノード
│   │   ├── sync/               # Hocuspocus同期ロジック
│   │   ├── pagination/         # ページ遷移ロジック
│   │   └── snapshot/           # スナップショット永続化
│   ├── agent/                  # Agent Module
│   │   ├── openclaw/           # OpenClawクライアント
│   │   ├── tracker/            # 行動トラッキング
│   │   └── inference/          # 意図推論ブリッジ
│   ├── trust/                  # Trust Module
│   │   ├── score/              # 信頼度計算
│   │   ├── access/             # アクセス制御
│   │   └── rules/              # ルールエンジン
│   ├── economy/                # Economy Module
│   │   ├── wallet/             # ウォレット管理
│   │   ├── transaction/        # トランザクション処理
│   │   └── stripe/             # Stripe統合
│   ├── events/                 # 内部イベントバス
│   └── database/               # Supabase クライアント・スキーマ
├── docker/
│   └── openclaw/               # OpenClawデプロイ設定
├── supabase/
│   └── migrations/             # DBマイグレーション
├── docs/
│   └── spec/                   # 仕様書群
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

---

## デプロイアーキテクチャ

```
┌────────────────────────┐     ┌─────────────────────┐
│   Vercel               │     │   Railway / Fly.io   │
│   Next.js App          │     │   Hocuspocus Server   │
│   (App Router +        │←WSS→│   (TipTap Yjs同期)    │
│    API Routes)         │     │                       │
└────────┬───────────────┘     └───────────────────────┘
         │ HTTPS                         ↑ WSS
         ↓                               │
┌────────────────────────┐     ┌─────────┴───────────┐
│       Supabase         │     │   Hetzner CX21      │
│  PostgreSQL | Auth     │     │   OpenClaw Instance  │
│  Storage | Realtime    │     │   Docker (4GB RAM)   │
└────────────────────────┘     │   ~¥900/月           │
         ↑ Webhook             └─────────────────────┘
┌────────┴──────────────┐
│       Stripe          │
│   Checkout + Connect  │
└───────────────────────┘
```

- **Vercel**: Next.jsアプリ（SSR + API Routes）
- **Railway/Fly.io**: Hocuspocusサーバー（WebSocket常時接続）
- **Hetzner CX21**: OpenClawインスタンス（~¥900/月）
- **Supabase**: DB・認証・ストレージ
- **Stripe**: 決済インフラ

---

## セキュリティアーキテクチャ

### 認証・認可フロー

```
Client → Supabase Auth（JWT取得）→ API Routes（JWT検証）
                                       ↓
                              Trust Module（権限チェック）
                                       ↓
                              Page/Agent/Economy（実行）
```

### CRDT層のセキュリティ

- Hocuspocus接続時にSupabase JWTで認証
- ページごとのアクセス制御（参加者リスト）
- OpenClawの書き込みはサーバーサイド経由（信頼度チェック後）

---

## 設計判断記録（ADR）

### ADR-001: CRDTとDBの分離

**決定**: ページコンテンツはCRDT、信頼度・経済データはDB

**理由**:
- CRDTはコンフリクトを「自動マージ」するが、金額や信頼度は「検証」が必要
- 経済データは厳密なトランザクション保証が必要（二重支払い防止）

### ADR-002: TipTap（ProseMirror）選定

**決定**: tldrawではなくTipTap（ProseMirror）を採用

**理由**:
- Lucidのコア体験は「テキストベースのページ」であり、ホワイトボードではない
- TipTapはリッチテキスト編集のネイティブサポート、ブロック型UI、Yjs統合が充実
- カスタムノードAPIで承認カード等のシステムUIをインラインに実装可能
- Hocuspocus（TipTap公式Yjsサーバー）との統合がシームレス

### ADR-003: OpenClaw採用

**決定**: カスタムエージェントエンジンではなくOpenClawを採用

**理由**:
- OSSで145k+ GitHub stars、活発な開発コミュニティ
- 自律エージェント機能が充実（Web操作、ファイル管理、API呼び出し等）
- LLMバックエンドの切替が柔軟（Claude/GPT/DeepSeek）
- Hetznerでのセルフホスティングが安価（~¥900/月）
- エージェントエンジンを自作するより、UIとインテグレーションに注力できる

### ADR-004: Hetznerホスティング

**決定**: OpenClawのホスティング先にHetznerを採用

**理由**:
- CX21（2vCPU/4GB RAM）が€4.5/月（~¥900）でコスパ最強
- Docker対応、安定稼働
- Oracle Cloud Free Tierは無料だが在庫確保が困難
- Railway/DigitalOceanはRAM課金で3-4倍高い
