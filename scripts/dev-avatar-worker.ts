import { processNextAvatarJob } from '../src/avatar/worker.ts'

const parsedInterval = Number(process.env.AVATAR_WORKER_POLL_MS ?? 5000)
const pollIntervalMs = Number.isFinite(parsedInterval) && parsedInterval >= 1000 ? parsedInterval : 5000
let stopping = false
let processing = false

function requestStop(signal: string): void {
  if (stopping) return
  stopping = true
  console.info(`[avatar-worker] ${signal} received; stopping after the current iteration.`)
}

process.once('SIGINT', () => requestStop('SIGINT'))
process.once('SIGTERM', () => requestStop('SIGTERM'))

const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

console.info(`[avatar-worker] Local worker started; polling every ${pollIntervalMs}ms.`)
while (!stopping) {
  if (processing) {
    await wait(pollIntervalMs)
    continue
  }
  processing = true
  try {
    const result = await processNextAvatarJob()
    if (result.processed) console.info(`[avatar-worker] Job ${result.jobId} finished with status ${result.status}.`)
  } catch (error) {
    const name = error instanceof Error ? error.name : 'UnknownError'
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[avatar-worker] Poll failed: ${name}: ${message}`)
  } finally {
    processing = false
  }
  if (!stopping) await wait(pollIntervalMs)
}
console.info('[avatar-worker] Local worker stopped.')
