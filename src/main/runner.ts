import { spawn, type ChildProcess } from 'child_process'

export interface RunResult {
  stdout: string
  stderr: string
  code: number
  binaryMissing: boolean
}

const inFlight = new Set<ChildProcess>()

export function run(
  cmd: string,
  args: string[],
  opts: { cwd: string; timeoutMs?: number; env?: NodeJS.ProcessEnv } = { cwd: process.cwd() }
): Promise<RunResult> {
  const timeoutMs = opts.timeoutMs ?? 10 * 60_000
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let done = false
    let proc: ChildProcess
    try {
      proc = spawn(cmd, args, {
        cwd: opts.cwd,
        env: opts.env ?? process.env,
        shell: false,
        windowsHide: true,
        // Close stdin immediately. Claude Code (and others) wait ~3s for stdin
        // in headless mode otherwise and emit a warning before proceeding.
        stdio: ['ignore', 'pipe', 'pipe']
      })
    } catch (err) {
      const msg = String(err)
      const missing = /ENOENT/i.test(msg)
      resolve({ stdout: '', stderr: msg, code: -1, binaryMissing: missing })
      return
    }
    inFlight.add(proc)
    const timer = setTimeout(() => {
      if (done) return
      done = true
      try { proc.kill() } catch {}
      inFlight.delete(proc)
      resolve({ stdout, stderr: stderr + '\n[timeout]', code: -1, binaryMissing: false })
    }, timeoutMs)
    proc.stdout?.on('data', (d) => { stdout += d.toString() })
    proc.stderr?.on('data', (d) => { stderr += d.toString() })
    proc.on('error', (err) => {
      if (done) return
      done = true
      clearTimeout(timer)
      inFlight.delete(proc)
      const msg = String(err)
      const missing = /ENOENT/i.test(msg) || (err as NodeJS.ErrnoException).code === 'ENOENT'
      resolve({ stdout, stderr: stderr + msg, code: -1, binaryMissing: missing })
    })
    proc.on('close', (code) => {
      if (done) return
      done = true
      clearTimeout(timer)
      inFlight.delete(proc)
      resolve({ stdout, stderr, code: code ?? -1, binaryMissing: false })
    })
  })
}

export function killAllInFlight(): void {
  for (const proc of inFlight) {
    try { proc.kill() } catch {}
  }
  inFlight.clear()
}
