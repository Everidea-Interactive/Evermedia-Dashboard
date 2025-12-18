let isPageUnloading = false;

if (typeof window !== 'undefined') {
  const markUnloading = () => {
    isPageUnloading = true;
  };
  const resetUnloading = () => {
    isPageUnloading = false;
  };
  window.addEventListener('beforeunload', markUnloading);
  window.addEventListener('pagehide', markUnloading);
  window.addEventListener('pageshow', resetUnloading);
}

export function shouldIgnoreRequestError(error: unknown): boolean {
  if (!isPageUnloading) return false;
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }
  if (error instanceof TypeError) {
    return /NetworkError|Failed to fetch/i.test(error.message);
  }
  if (error instanceof Error) {
    return /NetworkError|Failed to fetch/i.test(error.message);
  }
  return false;
}
