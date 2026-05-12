import { CODING_AGENT_TOOLS } from './src/main/tools'
import { registerHandlers } from './src/main/handlers'
import { killAllInFlight } from './src/main/runner'
import { clearAll as clearSessionMap } from './src/main/sessionMap'
// First-party extensions in the monorepo type-only-import the host contract
// via a relative path. The import is erased by esbuild, so the path only
// needs to resolve at type-check time inside the worktree.
import type { ExtensionMainContext } from '../../ProjectRose/src/shared/extension-contract'

export function register(ctx: ExtensionMainContext): () => void {
  ctx.registerTools(CODING_AGENT_TOOLS)
  const cleanupHandlers = registerHandlers(ctx)
  return () => {
    cleanupHandlers()
    killAllInFlight()
    clearSessionMap()
  }
}
