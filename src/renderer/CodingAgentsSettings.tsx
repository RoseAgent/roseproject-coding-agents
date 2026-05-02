import { useState, useEffect, useCallback } from 'react'

interface CliStatus {
  cli: 'claude' | 'codex' | 'opencode'
  binary: string
  toolName: string
  detected: boolean
  version?: string
  error?: string
}

const s: Record<string, React.CSSProperties> = {
  section: { marginBottom: 24 },
  title: { fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' as const, color: 'var(--color-text-muted)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 },
  card: { display: 'flex', flexDirection: 'column' as const, gap: 10, padding: '14px 16px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md, 6px)', background: 'var(--color-bg-secondary)' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--color-border)' },
  rowLast: { borderBottom: 'none' },
  rowLeft: { display: 'flex', flexDirection: 'column' as const, gap: 2, minWidth: 0, flex: 1 },
  toolName: { fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' },
  binary: { fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-family-mono)' },
  status: { fontSize: 11, fontFamily: 'var(--font-family-mono)', whiteSpace: 'nowrap' as const, flexShrink: 0 },
  statusDot: { display: 'inline-block', width: 8, height: 8, borderRadius: '50%', marginRight: 6 },
  desc: { fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 },
  btn: { padding: '6px 14px', background: 'var(--color-button-bg, var(--color-bg-secondary))', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm, 4px)', color: 'var(--color-text-primary)', fontSize: 11, letterSpacing: '1px', fontFamily: 'var(--font-family-mono)', cursor: 'pointer' },
}

const TOOL_INFO: Record<CliStatus['cli'], { displayName: string; toolName: string; binary: string; install: string }> = {
  claude:   { displayName: 'Claude Code',  toolName: 'claude_code', binary: 'claude',   install: 'npm install -g @anthropic-ai/claude-code' },
  codex:    { displayName: 'Codex',        toolName: 'codex',       binary: 'codex',    install: 'npm install -g @openai/codex' },
  opencode: { displayName: 'OpenCode',     toolName: 'opencode',    binary: 'opencode', install: 'See https://opencode.ai' }
}

export function CodingAgentsSettings(): JSX.Element {
  const [statuses, setStatuses] = useState<CliStatus[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const result = await window.api.invoke('rose-coding-agents:checkAll') as { ok: boolean; statuses?: CliStatus[]; error?: string }
      if (result.ok && result.statuses) setStatuses(result.statuses)
      else setError(result.error ?? 'Failed to check installations')
    } catch (err) {
      setError((err as Error).message ?? 'Extension not loaded')
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return (
    <div>
      <div style={s.section}>
        <div style={s.title}>
          About
        </div>
        <div style={s.card}>
          <div style={s.desc}>
            Exposes three agent tools — <strong>claude_code</strong>, <strong>codex</strong>, and <strong>opencode</strong> — that delegate prompts to each CLI in headless mode.
            Sub-agent sessions are scoped to the current ProjectRose chat: a new chat starts a fresh CLI session, and follow-up tool calls in the same chat resume the same sub-agent so it keeps prior context.
          </div>
          <div style={s.desc}>
            Authentication is inherited from your shell environment (e.g. <code>OPENAI_API_KEY</code>). The extension does not store secrets.
          </div>
          <div style={s.desc}>
            <strong>Claude Code:</strong> <code>ANTHROPIC_API_KEY</code> is intentionally stripped before invoking <code>claude</code> so your Pro/Max OAuth login is used (subscription quota) instead of API console credit. Run <code>claude /login</code> once in a terminal to set up OAuth.
          </div>
        </div>
      </div>

      <div style={s.section}>
        <div style={s.title}>
          Installation Status
          <button style={s.btn} onClick={refresh} disabled={refreshing}>
            {refreshing ? 'CHECKING…' : 'REFRESH'}
          </button>
        </div>

        {error && (
          <div style={{ ...s.desc, color: 'var(--color-danger, #dc2626)', marginBottom: 8 }}>{error}</div>
        )}

        <div style={s.card}>
          {statuses.length === 0 && !refreshing && !error && (
            <div style={s.desc}>No data yet — click Refresh.</div>
          )}
          {statuses.map((st, i) => {
            const info = TOOL_INFO[st.cli]
            const isLast = i === statuses.length - 1
            return (
              <div key={st.cli} style={{ ...s.row, ...(isLast ? s.rowLast : {}) }}>
                <div style={s.rowLeft}>
                  <div style={s.toolName}>{info.displayName} <span style={s.binary}>({info.binary})</span></div>
                  {!st.detected && <div style={{ ...s.binary, marginTop: 4 }}>Install: <code>{info.install}</code></div>}
                  {st.detected && st.version && <div style={s.binary}>{st.version}</div>}
                  {!st.detected && st.error && <div style={{ ...s.binary, color: 'var(--color-danger, #dc2626)' }}>{st.error}</div>}
                </div>
                <div style={s.status}>
                  <span style={{ ...s.statusDot, background: st.detected ? 'var(--color-success, #3a3)' : 'var(--color-text-muted)' }} />
                  {st.detected ? 'DETECTED' : 'NOT FOUND'}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
