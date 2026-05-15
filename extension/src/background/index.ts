/**
 * Background Service Worker
 *
 * Relays messages between the content script and the backend API.
 * Handles API calls so the content script doesn't need external permissions.
 */

const DEFAULT_BACKEND_URL = "http://localhost:3001";

/**
 * Get the backend URL from storage, falling back to default.
 */
async function getBackendUrl(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["backendUrl"], (result) => {
      resolve(result.backendUrl || DEFAULT_BACKEND_URL);
    });
  });
}

/**
 * Get or generate a persistent user ID.
 */
async function getUserId(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["userId"], (result) => {
      if (result.userId) {
        resolve(result.userId);
      } else {
        const userId = `user_${crypto.randomUUID()}`;
        chrome.storage.local.set({ userId });
        resolve(userId);
      }
    });
  });
}

/**
 * Handle messages from content script and popup.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "ANALYZE_EMAIL") {
    handleAnalyze(message.subject, message.body)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true; // Keep the message channel open for async response
  }

  if (message.type === "MARK_SENT") {
    handleMarkSent(message.analysisId).catch(console.error);
    return false;
  }

  if (message.type === "GET_HISTORY") {
    handleGetHistory()
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === "GET_SETTINGS") {
    handleGetSettings()
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === "SAVE_SETTINGS") {
    handleSaveSettings(message.settings)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  return false;
});

/**
 * Call the backend to analyze an email.
 */
async function handleAnalyze(
  subject: string,
  body: string
): Promise<{
  verdict: string;
  reason: string;
  flags: string[];
  analysisId: string | null;
  error?: string;
}> {
  const backendUrl = await getBackendUrl();
  const userId = await getUserId();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${backendUrl}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body, userId }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.error || `Backend returned ${response.status}`
      );
    }

    return await response.json();
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err.name === "AbortError") {
      throw new Error("Backend took too long to respond");
    }
    throw err;
  }
}

/**
 * Mark an analysis as "sent anyway".
 */
async function handleMarkSent(analysisId: string): Promise<void> {
  const backendUrl = await getBackendUrl();

  try {
    await fetch(`${backendUrl}/analyze/${analysisId}/sent`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[Before You Send] Failed to mark as sent:", err);
  }
}

/**
 * Get analysis history for the current user.
 */
async function handleGetHistory(): Promise<any> {
  const backendUrl = await getBackendUrl();
  const userId = await getUserId();

  const response = await fetch(`${backendUrl}/analyze/history/${userId}`);
  if (!response.ok) throw new Error("Failed to fetch history");
  return await response.json();
}

/**
 * Get current settings.
 */
async function handleGetSettings(): Promise<any> {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ["enabled", "backendUrl", "userId"],
      (result) => {
        resolve({
          enabled: result.enabled !== false,
          backendUrl: result.backendUrl || DEFAULT_BACKEND_URL,
          userId: result.userId || null,
        });
      }
    );
  });
}

/**
 * Save settings.
 */
async function handleSaveSettings(
  settings: Record<string, any>
): Promise<{ success: boolean }> {
  return new Promise((resolve) => {
    chrome.storage.local.set(settings, () => {
      resolve({ success: true });
    });
  });
}

console.log("[Before You Send] Background service worker loaded");
