export function windowStartMs(nowMs: number, windowSeconds: number) {
  const size = Math.max(1, Math.floor(windowSeconds)) * 1000;
  return Math.floor(nowMs / size) * size;
}

export function retryAfterSeconds(nowMs: number, windowSeconds: number) {
  const size = Math.max(1, Math.floor(windowSeconds)) * 1000;
  const end = windowStartMs(nowMs, windowSeconds) + size;
  return Math.max(1, Math.ceil((end - nowMs) / 1000));
}
