/**
 * Holds the AbortController of the in-flight video processing job.
 * ImportPanel registers it when processing starts; the App-level
 * processing screen calls abortProcessing() from its Cancel button.
 */
let aborter: AbortController | null = null;

export function setProcessingAborter(a: AbortController | null): void {
  aborter = a;
}

export function abortProcessing(): void {
  aborter?.abort();
  aborter = null;
}
