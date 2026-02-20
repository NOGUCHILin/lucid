/**
 * InlineSuggestion TipTap Extension
 * 環境エージェントの予測テキストをグレーのインラインテキストとして表示
 * Tab で受け入れ、Esc / 継続入力で消去
 */
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const pluginKey = new PluginKey('inlineSuggestion')

export interface InlineSuggestionOptions {
  /** 提案テキスト取得関数 */
  fetchSuggestion: () => Promise<string>
  /** 入力停止から提案表示までの遅延(ms) */
  delay: number
}

export const InlineSuggestion = Extension.create<InlineSuggestionOptions>({
  name: 'inlineSuggestion',

  addOptions() {
    return {
      fetchSuggestion: async () => '',
      delay: 2000,
    }
  },

  addProseMirrorPlugins() {
    const { fetchSuggestion, delay } = this.options

    return [
      new Plugin({
        key: pluginKey,
        state: {
          init() {
            return { suggestion: '', decorations: DecorationSet.empty }
          },
          apply(tr, value, _oldState, newState) {
            // メタデータでsuggest/clearを管理
            const meta = tr.getMeta(pluginKey)
            if (meta?.clear) {
              return { suggestion: '', decorations: DecorationSet.empty }
            }
            if (meta?.suggestion) {
              const pos = newState.selection.$head.pos
              const suggestionText = meta.suggestion
              const widget = Decoration.widget(pos, (view) => {
                const span = document.createElement('span')
                span.textContent = suggestionText
                span.style.color = '#9ca3af'
                span.style.cursor = 'pointer'
                span.setAttribute('data-suggestion', 'true')
                // タップ/クリックで承認
                span.addEventListener('click', (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (!view) return
                  const { tr } = view.state
                  const insertPos = view.state.selection.$head.pos
                  const insertTr = tr.insertText(suggestionText, insertPos)
                  insertTr.setMeta(pluginKey, { clear: true })
                  view.dispatch(insertTr)
                })
                return span
              }, { side: 1 })
              return {
                suggestion: meta.suggestion,
                decorations: DecorationSet.create(newState.doc, [widget]),
              }
            }
            // doc変更時はクリア
            if (tr.docChanged) {
              return { suggestion: '', decorations: DecorationSet.empty }
            }
            // デコレーションをmapして返す
            return {
              suggestion: value.suggestion,
              decorations: value.decorations.map(tr.mapping, tr.doc),
            }
          },
        },
        props: {
          decorations(state) {
            return pluginKey.getState(state)?.decorations ?? DecorationSet.empty
          },
          handleKeyDown(view, event) {
            const state = pluginKey.getState(view.state)
            if (!state?.suggestion) return false

            // Tab → 提案を受け入れ
            if (event.key === 'Tab') {
              event.preventDefault()
              const { tr } = view.state
              const pos = view.state.selection.$head.pos
              const clearTr = tr.insertText(state.suggestion, pos)
              clearTr.setMeta(pluginKey, { clear: true })
              view.dispatch(clearTr)
              return true
            }

            // Esc → 提案をクリア
            if (event.key === 'Escape') {
              event.preventDefault()
              const { tr } = view.state
              tr.setMeta(pluginKey, { clear: true })
              view.dispatch(tr)
              return true
            }

            return false
          },
        },
        view() {
          let debounceTimer: ReturnType<typeof setTimeout> | null = null
          let retryTimer: ReturnType<typeof setTimeout> | null = null

          const tryFetch = async (view: import('@tiptap/pm/view').EditorView, attempt: number) => {
            try {
              const suggestion = await fetchSuggestion()
              if (suggestion && view.dom.isConnected) {
                const { tr } = view.state
                tr.setMeta(pluginKey, { suggestion })
                view.dispatch(tr)
              } else if (!suggestion && attempt < 2 && view.dom.isConnected) {
                // サーバーが提案生成中の可能性 → 3秒後にリトライ
                retryTimer = setTimeout(() => tryFetch(view, attempt + 1), 3000)
              }
            } catch {
              // 提案取得失敗は無視
            }
          }

          return {
            update(view, lastState) {
              // doc が変わっていない場合はスキップ（メタのみのtransaction）
              if (lastState && view.state.doc.eq(lastState.doc)) return

              // タイマーリセット
              if (debounceTimer) clearTimeout(debounceTimer)
              if (retryTimer) clearTimeout(retryTimer)

              // delay後に提案を取得（リトライ付き）
              debounceTimer = setTimeout(() => tryFetch(view, 0), delay)
            },
            destroy() {
              if (debounceTimer) clearTimeout(debounceTimer)
              if (retryTimer) clearTimeout(retryTimer)
            },
          }
        },
      }),
    ]
  },
})
