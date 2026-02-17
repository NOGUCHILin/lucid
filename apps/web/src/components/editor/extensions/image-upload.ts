import Image from '@tiptap/extension-image'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

async function uploadFile(file: File): Promise<string | null> {
  const formData = new FormData()
  formData.append('file', file)
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    if (!res.ok) return null
    const { url } = await res.json()
    return url
  } catch {
    return null
  }
}

export const ImageUpload = Image.extend({
  addProseMirrorPlugins() {
    const parentPlugins = this.parent?.() ?? []
    return [
      ...parentPlugins,
      new Plugin({
        key: new PluginKey('imageUpload'),
        props: {
          handleDrop: (view: EditorView, event: DragEvent) => {
            const files = event.dataTransfer?.files
            if (!files?.length) return false
            const images = Array.from(files).filter((f: File) => f.type.startsWith('image/'))
            if (!images.length) return false
            event.preventDefault()
            for (const file of images) {
              uploadFile(file).then((url) => {
                if (!url) return
                const { tr } = view.state
                const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? tr.selection.from
                const node = view.state.schema.nodes.image.create({ src: url, alt: file.name })
                view.dispatch(tr.insert(pos, node))
              })
            }
            return true
          },
          handlePaste: (view: EditorView, event: ClipboardEvent) => {
            const items = event.clipboardData?.items
            if (!items) return false
            const images = Array.from(items).filter((i: DataTransferItem) => i.type.startsWith('image/'))
            if (!images.length) return false
            event.preventDefault()
            for (const item of images) {
              const file = item.getAsFile()
              if (!file) continue
              uploadFile(file).then((url) => {
                if (!url) return
                const { tr } = view.state
                const node = view.state.schema.nodes.image.create({ src: url, alt: 'Pasted image' })
                view.dispatch(tr.replaceSelectionWith(node))
              })
            }
            return true
          },
        },
      }),
    ]
  },
})
