import { randomUUID } from 'crypto'
import type { CliKind } from './types'

interface SessionEntry {
  claude?: string
  codex?: string
  opencode?: string
}

const sessions = new Map<string, SessionEntry>()

export function getOrCreateCliSessionId(hostSessionId: string, cli: CliKind): { id: string; isNew: boolean } {
  let entry = sessions.get(hostSessionId)
  if (!entry) {
    entry = {}
    sessions.set(hostSessionId, entry)
  }
  const existing = entry[cli]
  if (existing) return { id: existing, isNew: false }
  const id = randomUUID()
  entry[cli] = id
  return { id, isNew: true }
}

export function setCliSessionId(hostSessionId: string, cli: CliKind, cliSessionId: string): void {
  let entry = sessions.get(hostSessionId)
  if (!entry) {
    entry = {}
    sessions.set(hostSessionId, entry)
  }
  entry[cli] = cliSessionId
}

export function clearAll(): void {
  sessions.clear()
}
