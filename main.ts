import { CODING_AGENT_TOOLS } from './src/main/tools'
import { registerHandlers } from './src/main/handlers'
import { killAllInFlight } from './src/main/runner'
import { clearAll as clearSessionMap } from './src/main/sessionMap'
import type { ExtensionMainContext } from './src/main/types'

export function register(ctx: ExtensionMainContext): () => void {
  ctx.registerTools(CODING_AGENT_TOOLS)
  const cleanupHandlers = registerHandlers(ctx)
  return () => {
    cleanupHandlers()
    killAllInFlight()
    clearSessionMap()
  }
}
