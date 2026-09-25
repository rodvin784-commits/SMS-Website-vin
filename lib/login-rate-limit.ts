// Rate limit sederhana client-side: 5 gagal dalam 15 menit → block
// Key per email + path (admin vs guru) di localStorage. Anti brute force P0.
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

type Record = { fails: number[] } // timestamps

function keyFor(email: string, scope: string) {
  return `login_rl_${scope}_${email.trim().toLowerCase()}`
}

export function getRateLimitState(email: string, scope: 'admin' | 'guru'): { blocked: boolean; remainingMs: number; fails: number } {
  try {
    const raw = localStorage.getItem(keyFor(email, scope))
    if (!raw) return { blocked: false, remainingMs: 0, fails: 0 }
    const rec: Record = JSON.parse(raw)
    const now = Date.now()
    const recent = rec.fails.filter(t => now - t < WINDOW_MS)
    if (recent.length >= MAX_ATTEMPTS) {
      const oldestInWindow = Math.min(...recent.slice(-MAX_ATTEMPTS))
      const remaining = WINDOW_MS - (now - oldestInWindow)
      return { blocked: remaining > 0, remainingMs: Math.max(0, remaining), fails: recent.length }
    }
    return { blocked: false, remainingMs: 0, fails: recent.length }
  } catch { return { blocked: false, remainingMs: 0, fails: 0 } }
}

export function recordFail(email: string, scope: 'admin' | 'guru') {
  try {
    const k = keyFor(email, scope)
    const raw = localStorage.getItem(k)
    const rec: Record = raw ? JSON.parse(raw) : { fails: [] }
    rec.fails.push(Date.now())
    // keep only window
    rec.fails = rec.fails.filter(t => Date.now() - t < WINDOW_MS)
    localStorage.setItem(k, JSON.stringify(rec))
  } catch {}
}

export function clearRateLimit(email: string, scope: 'admin' | 'guru') {
  try { localStorage.removeItem(keyFor(email, scope)) } catch {}
}

export function formatRemaining(ms: number): string {
  const m = Math.ceil(ms / 60000)
  return `${m} menit`
}
