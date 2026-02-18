import 'dotenv/config'
import { Server } from '@hocuspocus/server'
import { authExtension } from './extensions/auth'
import { persistenceExtension } from './extensions/persistence'
import { agentBridgeExtension } from './extensions/agent-bridge'
import { setHocuspocusInstance } from './agent-writer'
import { setHocuspocusRef } from './agent-actions'
import { setAgentLoopHocuspocus } from './agent-loop'
import { startContextSummarizer } from './context-summarizer'

// Auth is always required — refuse to start without service role key in production
const isProduction = process.env.NODE_ENV === 'production'
if (isProduction && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('FATAL: SUPABASE_SERVICE_ROLE_KEY is required in production')
  process.exit(1)
}

const port = Number(process.env.PORT) || 1234

export const server = new Server({
  port,
  name: 'lucid-hocuspocus',
  extensions: [
    authExtension,
    persistenceExtension,
    agentBridgeExtension,
  ],
})

server.listen().then(() => {
  const hocuspocus = (server as any).hocuspocus
  setHocuspocusInstance(hocuspocus)
  setHocuspocusRef(hocuspocus)
  setAgentLoopHocuspocus(hocuspocus)
  startContextSummarizer()
  console.log(`Hocuspocus running on port ${port}`)
})
