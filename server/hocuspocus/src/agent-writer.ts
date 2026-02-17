import * as Y from 'yjs'
import type { Hocuspocus } from '@hocuspocus/server'

let hocuspocusInstance: Hocuspocus | null = null

/** index.ts の server.listen() 後に呼ぶ */
export function setHocuspocusInstance(instance: Hocuspocus) {
  hocuspocusInstance = instance
}

function getHocuspocus(): Hocuspocus {
  if (!hocuspocusInstance) throw new Error('Hocuspocus not initialized. Call setHocuspocusInstance first.')
  return hocuspocusInstance
}

/**
 * openDirectConnection でページの Y.Doc に直接書き込む
 * Hocuspocus の内部 CRDT を操作し、接続中の全クライアントに同期される
 */
export async function writeToPage(pageId: string, text: string) {
  const connection = await getHocuspocus().openDirectConnection(pageId, {
    agentWrite: true,
  })

  try {
    await connection.transact((doc: Y.Doc) => {
      const fragment = doc.getXmlFragment('default')
      const paragraph = new Y.XmlElement('paragraph')
      const textNode = new Y.XmlText()
      textNode.insert(0, text)
      paragraph.insert(0, [textNode])
      fragment.insert(fragment.length, [paragraph])
    })
  } finally {
    await connection.disconnect()
  }
}

/**
 * ページの現在のテキスト内容を取得
 */
export async function readPage(pageId: string): Promise<string> {
  const connection = await getHocuspocus().openDirectConnection(pageId, {
    agentRead: true,
  })

  let text = ''
  try {
    await connection.transact((doc: Y.Doc) => {
      const fragment = doc.getXmlFragment('default')
      text = fragment.toString()
    })
  } finally {
    await connection.disconnect()
  }

  return text
}
