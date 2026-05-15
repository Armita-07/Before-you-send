/**
 * Content Script Entry Point
 *
 * Injects the Before You Send overlay into Gmail's DOM via Shadow DOM.
 * Sets up the GmailInterceptor to watch for Send button clicks.
 */
import React from "react";
import { createRoot, Root } from "react-dom/client";
import { Overlay, OverlayState, AnalysisResult } from "./Overlay";
import { GmailInterceptor, triggerSend } from "./GmailInterceptor";

// Track overlay instances per compose window
const overlayInstances = new Map<
  HTMLElement,
  {
    container: HTMLElement;
    root: Root;
    sendButton: HTMLElement;
  }
>();

let isEnabled = true;

// Check if extension is enabled
chrome.storage.local.get(["enabled"], (result) => {
  isEnabled = result.enabled !== false; // Default to enabled
});

// Listen for enable/disable changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled) {
    isEnabled = changes.enabled.newValue !== false;
  }
});

/**
 * Create or reuse a Shadow DOM overlay container for a compose window.
 */
function getOrCreateOverlay(composeEl: HTMLElement, sendButton: HTMLElement) {
  // Check if we already have an overlay for this compose window
  const existing = overlayInstances.get(composeEl);
  if (existing) {
    return existing;
  }

  // Create container
  const container = document.createElement("div");
  container.id = "bys-overlay-container";
  container.style.cssText =
    "all: initial; display: block; position: relative; z-index: 9999;";

  // Create Shadow DOM to isolate from Gmail's CSS
  const shadow = container.attachShadow({ mode: "open" });

  // Create React mount point inside shadow
  const mountPoint = document.createElement("div");
  mountPoint.id = "bys-root";
  shadow.appendChild(mountPoint);

  // Insert overlay at the top of the compose window
  // Look for the compose header to insert after it
  const header =
    composeEl.querySelector(".Ha") || // Compose header area
    composeEl.querySelector(".aoP") || // Alternative header
    composeEl.firstElementChild;

  if (header && header.parentNode) {
    header.parentNode.insertBefore(container, header.nextSibling);
  } else {
    composeEl.prepend(container);
  }

  const root = createRoot(mountPoint);

  const instance = { container, root, sendButton };
  overlayInstances.set(composeEl, instance);

  return instance;
}

/**
 * Remove the overlay for a compose window.
 */
function removeOverlay(composeEl: HTMLElement): void {
  const instance = overlayInstances.get(composeEl);
  if (instance) {
    instance.root.unmount();
    instance.container.remove();
    overlayInstances.delete(composeEl);
  }
}

/**
 * Render the overlay with a given state.
 */
function renderOverlay(
  composeEl: HTMLElement,
  sendButton: HTMLElement,
  state: OverlayState
): void {
  const { root } = getOrCreateOverlay(composeEl, sendButton);

  const handleSendAnyway = () => {
    removeOverlay(composeEl);

    // Mark the analysis as "sent anyway" if we have an ID
    if (state.type === "result" && state.data.analysisId) {
      chrome.runtime.sendMessage({
        type: "MARK_SENT",
        analysisId: state.data.analysisId,
      });
    }

    // Trigger the actual send
    triggerSend(sendButton);
  };

  const handleEditFirst = () => {
    removeOverlay(composeEl);

    // Focus the compose body for editing
    const bodyEl = composeEl.querySelector<HTMLElement>(
      ".Am.Al.editable[contenteditable='true'], div[aria-label='Message Body'], div.editable[contenteditable='true']"
    );
    if (bodyEl) {
      bodyEl.focus();
    }
  };

  const handleDismiss = () => {
    removeOverlay(composeEl);
  };

  root.render(
    React.createElement(Overlay, {
      state,
      onSendAnyway: handleSendAnyway,
      onEditFirst: handleEditFirst,
      onDismiss: handleDismiss,
    })
  );
}

/**
 * Handle Send button interception.
 */
async function handleIntercept({
  subject,
  body,
  composeEl,
  sendButton,
}: {
  subject: string;
  body: string;
  composeEl: HTMLElement;
  sendButton: HTMLElement;
}): Promise<void> {
  if (!isEnabled) {
    // Extension disabled — let send go through
    triggerSend(sendButton);
    return;
  }

  // Show loading state immediately
  renderOverlay(composeEl, sendButton, { type: "loading" });

  try {
    // Send analysis request to background script
    const response = await new Promise<AnalysisResult>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Analysis timed out"));
      }, 5000); // 5-second timeout

      chrome.runtime.sendMessage(
        {
          type: "ANALYZE_EMAIL",
          subject,
          body,
        },
        (result) => {
          clearTimeout(timeoutId);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (result?.error) {
            reject(new Error(result.error));
          } else {
            resolve(result);
          }
        }
      );
    });

    // Show result
    renderOverlay(composeEl, sendButton, {
      type: "result",
      data: response,
    });
  } catch (err) {
    console.error("[Before You Send] Analysis failed:", err);
    // Fail open — show error with auto-send countdown
    renderOverlay(composeEl, sendButton, {
      type: "error",
      message: "Couldn't check — sending in 3s",
    });
  }
}

// Initialize the interceptor
const interceptor = new GmailInterceptor(handleIntercept);

// Wait for Gmail to fully load before starting
function waitForGmail(): void {
  // Check if Gmail's main content area is loaded
  const gmailLoaded =
    document.querySelector('div[role="main"]') ||
    document.querySelector(".AO") ||
    document.querySelector(".nH");

  if (gmailLoaded) {
    interceptor.start();
  } else {
    // Retry after a short delay
    setTimeout(waitForGmail, 500);
  }
}

// Start when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", waitForGmail);
} else {
  waitForGmail();
}

console.log("[Before You Send] Content script loaded");
