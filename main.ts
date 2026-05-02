import { CODING_AGENT_TOOLS } from './src/main/tools'
import { killAllInFlight } from './src/main/runner'
import { clearAll as clearSessionMap } from './src/main/sessionMap'
import type { ExtensionMainContext } from './src/main/types'

export function register(ctx: ExtensionMainContext): () => void {
  ctx.registerTools(CODING_AGENT_TOOLS)
  return () => {
    killAllInFlight()
    clearSessionMap()
  }
}
