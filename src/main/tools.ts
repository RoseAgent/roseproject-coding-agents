import { isAbsolute, resolve } from 'path'
import { run } from './runner'
import { getOrCreateCliSessionId, setCliSessionId } from './sessionMap'
import type { CliKind, ExtensionToolCtx, ExtensionToolEntry } from './types'

// Headless-mode invocation for each supported CLI.
//
// These flag conventions are based on each CLI's public docs. If a CLI's flags
// drift, update buildArgs() — that is the single source of truth.
//
//   claude (Claude Code):
//     first call: claude --session-id <uuid> -p "<prompt>"
//     resume:     claude --resume <uuid> -p "<prompt>"
//
//   codex (OpenAI Codex CLI):
//     first call: codex exec "<prompt>"
//     resume:     codex exec resume <session-id> "<prompt>"
//     Codex generates its own session id; we parse it out of stdout/stderr
//     and store it for the next call (see captureCodexSessionId).
//
//   opencode:
//     first call: opencode run --session <uuid> "<prompt>"
//     resume:     opencode run --session <uuid> "<prompt>"  (same flag — server
//                 maintains continuity for that session id)

interface BuildArgsResult {
  argv: string[]
  knownSessionId?: string  // set when we supplied the id ourselves
}

function buildArgs(cli: CliKind, prompt: string, sessionId: string, isNew: boolean): BuildArgsResult {
  switch (cli) {
    case 'claude':
      return isNew
        ? { argv: ['--session-id', sessionId, '-p', prompt], knownSessionId: sessionId }
        : { argv: ['--resume', sessionId, '-p', prompt], knownSessionId: sessionId }
    case 'opencode':
      return { argv: ['run', '--session', sessionId, prompt], knownSessionId: sessionId }
    case 'codex':
      // Codex generates its own id on first call; on resume we pass the id we
      // captured previously. The placeholder in sessionMap (a uuid) is only
      // used as a map key when codex hasn't yet given us its real id.
      return isNew
        ? { argv: ['exec', prompt] }
        : { argv: ['exec', 'resume', sessionId, prompt] }
  }
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

function captureCodexSessionId(stdout: string, stderr: string): string | undefined {
  // Codex prints the session id to stderr on `exec` (e.g. "session: <uuid>").
  // Match the first uuid-shaped token in stderr, then stdout.
  const fromErr = stderr.match(UUID_RE)
  if (fromErr) return fromErr[0]
  const fromOut = stdout.match(UUID_RE)
  if (fromOut) return fromOut[0]
  return undefined
}

function resolveCwd(projectRoot: string, requested: string | undefined): string {
  if (!requested) return projectRoot
  const candidate = isAbsolute(requested) ? requested : resolve(projectRoot, requested)
  // Constrain cwd to within the project root to avoid sub-agents wandering off.
  if (!candidate.startsWith(projectRoot)) return projectRoot
  return candidate
}

function formatResult(stdout: string, stderr: string, code: number): string {
  const out = stdout.trim()
  const err = stderr.trim()
  if (code === 0) return out || '(empty output)'
  const parts = [`ERROR: exit code ${code}`]
  if (err) parts.push(`stderr:\n${err}`)
  if (out) parts.push(`stdout:\n${out}`)
  return parts.join('\n\n')
}

async function runCli(
  cli: CliKind,
  binary: string,
  input: Record<string, unknown>,
  projectRoot: string,
  toolCtx: ExtensionToolCtx
): Promise<string> {
  const prompt = String(input.prompt ?? '').trim()
  if (!prompt) return 'ERROR: prompt is required.'

  const cwd = resolveCwd(projectRoot, input.working_directory ? String(input.working_directory) : undefined)
  const { id: sessionId, isNew } = getOrCreateCliSessionId(toolCtx.sessionId, cli)
  const { argv } = buildArgs(cli, prompt, sessionId, isNew)

  const result = await run(binary, argv, { cwd })

  if (result.binaryMissing) {
    return `ERROR: ${binary} not found on PATH. Install the ${cli} CLI and ensure the binary is on PATH, then try again.`
  }

  // Codex generates its own session id; on first call, capture it for resume.
  if (cli === 'codex' && isNew) {
    const captured = captureCodexSessionId(result.stdout, result.stderr)
    if (captured) setCliSessionId(toolCtx.sessionId, 'codex', captured)
  }

  return formatResult(result.stdout, result.stderr, result.code)
}

export const CODING_AGENT_TOOLS: ExtensionToolEntry[] = [
  {
    name: 'claude_code',
    description:
      'Delegate a coding task to Claude Code (Anthropic) running in headless mode. ' +
      'Sessions are scoped to the current ProjectRose chat: the first call in a chat starts a fresh Claude Code session, ' +
      'and subsequent calls in the same chat resume that session so the sub-agent retains context. ' +
      'Returns the sub-agent\'s final text output.',
    schema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The task / question to hand to Claude Code.' },
        working_directory: { type: 'string', description: 'Optional working directory (relative to project root, or absolute within it). Defaults to project root.' }
      },
      required: ['prompt']
    },
    execute: (input, projectRoot, toolCtx) => runCli('claude', 'claude', input, projectRoot, toolCtx)
  },
  {
    name: 'codex',
    description:
      'Delegate a coding task to the OpenAI Codex CLI in headless (exec) mode. ' +
      'Sessions are scoped to the current ProjectRose chat: the first call starts a fresh Codex session and subsequent calls resume it. ' +
      'Returns the sub-agent\'s final text output.',
    schema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The task / question to hand to Codex.' },
        working_directory: { type: 'string', description: 'Optional working directory (relative to project root, or absolute within it). Defaults to project root.' }
      },
      required: ['prompt']
    },
    execute: (input, projectRoot, toolCtx) => runCli('codex', 'codex', input, projectRoot, toolCtx)
  },
  {
    name: 'opencode',
    description:
      'Delegate a coding task to OpenCode running in headless (run) mode. ' +
      'Sessions are scoped to the current ProjectRose chat: the first call starts a fresh OpenCode session and subsequent calls reuse the same session id. ' +
      'Returns the sub-agent\'s final text output.',
    schema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The task / question to hand to OpenCode.' },
        working_directory: { type: 'string', description: 'Optional working directory (relative to project root, or absolute within it). Defaults to project root.' }
      },
      required: ['prompt']
    },
    execute: (input, projectRoot, toolCtx) => runCli('opencode', 'opencode', input, projectRoot, toolCtx)
  }
]
