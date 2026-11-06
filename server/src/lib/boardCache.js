// Short-lived cache for the public leaderboard, which every student's dashboard polls every few seconds.
// Without it each poll sorts and hashes every student; with it that work happens at most once per TTL, however many clients ask.
// Call invalidateBoard() whenever scores, students or flags change so nobody sees stale data longer than a request.
let cached = null // { at, data }
let inflight = null // a build in progress, shared by concurrent requests (no stampede)
let version = 0 // bumped on invalidate; a build that started before the bump is not cached

export async function board(build, ttlMs = 3000) {
  if (cached && Date.now() - cached.at < ttlMs) return cached.data
  if (!inflight) {
    const v = version
    inflight = build()
      .then((data) => { if (v === version) cached = { at: Date.now(), data }; return data })
      .finally(() => { inflight = null })
  }
  return inflight
}

export function invalidateBoard() {
  version++
  cached = null
}
