export interface ReviewResult {
  approved: boolean;
  accessRequestScope?: string;
}

export interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
}

export async function openPopupReview(
  reviewUrl: string,
  pollFn: () => Promise<ReviewResult | null>,
  options?: PollOptions
): Promise<ReviewResult> {
  const intervalMs = options?.intervalMs ?? 2000;
  const timeoutMs = options?.timeoutMs ?? 300_000;

  const popup = window.open(reviewUrl, '_bodhi_review', 'width=600,height=700');
  if (!popup) {
    throw new Error('Failed to open review popup - popup may be blocked');
  }

  return new Promise<ReviewResult>((resolve, reject) => {
    const startTime = Date.now();
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (pollTimer) clearTimeout(pollTimer);
    };

    const checkTimeout = () => {
      if (Date.now() - startTime >= timeoutMs) {
        cleanup();
        popup?.close();
        reject(new Error('Access request review timed out'));
        return true;
      }
      return false;
    };

    const doPoll = async () => {
      if (checkTimeout()) return;

      try {
        const result = await pollFn();
        if (result !== null) {
          cleanup();
          if (!popup.closed) popup.close();
          resolve(result);
          return;
        }
      } catch (_e) {
        // poll errors are non-fatal, keep polling
      }

      // Check if popup was closed
      if (popup.closed) {
        // One final poll
        try {
          const finalResult = await pollFn();
          if (finalResult !== null) {
            cleanup();
            resolve(finalResult);
            return;
          }
        } catch (_e) {
          // ignore
        }
        cleanup();
        reject(new Error('Review popup was closed before approval'));
        return;
      }

      pollTimer = setTimeout(doPoll, intervalMs);
    };

    doPoll();
  });
}
