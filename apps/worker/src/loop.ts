import type { Logger } from "@pawpost/core";

/**
 * Runs `task` every `intervalMs` until `signal` aborts. Iterations never overlap,
 * and a failing iteration is logged without stopping the loop.
 * Resolves once the in-flight iteration (if any) has finished.
 */
export async function runLoop(
  name: string,
  intervalMs: number,
  task: () => Promise<void>,
  logger: Logger,
  signal: AbortSignal,
): Promise<void> {
  const log = logger.child({ loop: name });
  log.info("loop started", { intervalMs });

  while (!signal.aborted) {
    const started = Date.now();
    try {
      await task();
    } catch (error) {
      log.error("iteration failed", { error });
    }
    const wait = Math.max(intervalMs - (Date.now() - started), 0);
    await sleep(wait, signal);
  }
  log.info("loop stopped");
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });
}
