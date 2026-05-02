import { ipcMain } from 'electron'
import { run } from './runner'
import type { CliKind, ExtensionMainContext } from './types'

export interface CliStatus {
  cli: CliKind
  binary: string
  toolName: string
  detected: boolean
  version?: string
  error?: string
}

const TARGETS: Array<{ cli: CliKind; binary: string; toolName: string; versionArgs: string[] }> = [
  { cli: 'claude',   binary: 'claude',   toolName: 'claude_code', versionArgs: ['--version'] },
  { cli: 'codex',    binary: 'codex',    toolName: 'codex',       versionArgs: ['--version'] },
  { cli: 'opencode', binary: 'opencode', toolName: 'opencode',    versionArgs: ['--version'] }
]

async function checkOne(target: typeof TARGETS[number], cwd: string): Promise<CliStatus> {
  const result = await run(target.binary, target.versionArgs, { cwd, timeoutMs: 10_000 })
  if (result.binaryMissing) {
    return { cli: target.cli, binary: target.binary, toolName: target.toolName, detected: false, error: `${target.binary} not found on PATH` }
  }
  if (result.code !== 0) {
    return { cli: target.cli, binary: target.binary, toolName: target.toolName, detected: false, error: result.stderr.trim() || `exit ${result.code}` }
  }
  const version = (result.stdout.trim() || result.stderr.trim()).split('\n')[0]
  return { cli: target.cli, binary: target.binary, toolName: target.toolName, detected: true, version }
}

export function registerHandlers(ctx: ExtensionMainContext): () => void {
  ipcMain.handle('rose-coding-agents:checkAll', async () => {
    const statuses = await Promise.all(TARGETS.map((t) => checkOne(t, ctx.rootPath)))
    return { ok: true, statuses }
  })

  return () => {
    ipcMain.removeHandler('rose-coding-agents:checkAll')
  }
}
