/**
 * InlineSuggestion TipTap Extension
 * 環境エージェントの予測テキストをグレーのインラインテキストとして表示
 * Tab で受け入れ、Esc / 継続入力で消去
 */
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export const pluginKey = new PluginKey('inlineSuggestion')

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InlineSuggestionOptions {
  // サーバーPush方式のため、オプション不要
}

export const InlineSuggestion = Extension.create<InlineSuggestionOptions>({
  name: 'inlineSuggestion',

  addOptions() {
    return {}
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,
        state: {
          init() {
            return { suggestion: '', pos: 0, decorations: DecorationSet.empty }
          },
          apply(tr, value, _oldState, newState) {
            // メタデータでsuggest/clearを管理
            const meta = tr.getMeta(pluginKey)
            if (meta?.clear) {
              return { suggestion: '', pos: 0, decorations: DecorationSet.empty }
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
                // タップ/クリックで承認（ウィジェット作成時のposを使用）
                span.addEventListener('click', (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (!view) return
                  const { tr } = view.state
                  const insertTr = tr.insertText(suggestionText, pos)
                  insertTr.setMeta(pluginKey, { clear: true })
                  view.dispatch(insertTr)
                })
                return span
              }, { side: 1 })
              return {
                suggestion: meta.suggestion,
                pos,
                decorations: DecorationSet.create(newState.doc, [widget]),
              }
            }
            // doc変更時はクリア
            if (tr.docChanged) {
              return { suggestion: '', pos: 0, decorations: DecorationSet.empty }
            }
            // デコレーションをmapして返す
            return {
              suggestion: value.suggestion,
              pos: tr.mapping.map(value.pos),
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

            // Tab → 提案を受け入れ（ウィジェット位置に挿入）
            if (event.key === 'Tab') {
              event.preventDefault()
              const { tr } = view.state
              const clearTr = tr.insertText(state.suggestion, state.pos)
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
        // サーバーPush方式: view()のポーリング不要
        // 提案はTipTapEditor.tsxの provider.on('stateless') → tr.setMeta(pluginKey, { suggestion }) で注入
      }),
    ]
  },
})
