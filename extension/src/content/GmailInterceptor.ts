/**
 * GmailInterceptor — Detects and intercepts Gmail's Send button.
 *
 * Uses MutationObserver to watch for compose windows and their Send buttons.
 * On click, prevents sending and triggers the analysis overlay.
 */

export type InterceptCallback = (data: {
  subject: string;
  body: string;
  composeEl: HTMLElement;
  sendButton: HTMLElement;
}) => void;

const SEND_SELECTORS = [
  'div[aria-label="Send"]',
  '[data-tooltip="Send (⌘Enter)"]',
  '[data-tooltip="Send (Ctrl-Enter)"]',
  'div[data-tooltip^="Send"]',
];

const BODY_SELECTOR = ".Am.Al.editable[contenteditable='true'], div[aria-label='Message Body'][contenteditable='true'], div.editable[contenteditable='true']";
const SUBJECT_SELECTOR = "input[name='subjectbox']";
const COMPOSE_SELECTOR = "div.M9";

export class GmailInterceptor {
  private observer: MutationObserver | null = null;
  private onIntercept: InterceptCallback;
  private attachedButtons = new WeakSet<HTMLElement>();

  constructor(onIntercept: InterceptCallback) {
    this.onIntercept = onIntercept;
  }

  /**
   * Start watching the Gmail DOM for Send buttons.
   */
  start(): void {
    // Watch for dynamically added compose windows
    this.observer = new MutationObserver(() => {
      this.scanForSendButtons();
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Initial scan
    this.scanForSendButtons();
    console.log("[Before You Send] Gmail interceptor active");
  }

  /**
   * Stop watching for Send buttons.
   */
  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  /**
   * Scan the DOM for Send buttons and attach click interceptors.
   */
  private scanForSendButtons(): void {
    for (const selector of SEND_SELECTORS) {
      const buttons = document.querySelectorAll<HTMLElement>(selector);
      buttons.forEach((button) => {
        if (this.attachedButtons.has(button)) return;
        this.attachedButtons.add(button);
        this.attachListener(button);
      });
    }
  }

  /**
   * Attach a click listener to a Send button that intercepts the send.
   */
  private attachListener(button: HTMLElement): void {
    button.addEventListener(
      "click",
      (event: MouseEvent) => {
        // Check for bypass flag — if present, let the send go through
        if (button.dataset.bypassCheck === "true") {
          button.dataset.bypassCheck = "false";
          return; // Let it through
        }

        // Intercept!
        event.stopImmediatePropagation();
        event.preventDefault();

        // Find the compose window containing this button
        const composeEl = button.closest(COMPOSE_SELECTOR) as HTMLElement;
        if (!composeEl) {
          // If we can't find the compose window, search more broadly
          const compose = button.closest("div[role='dialog']") as HTMLElement ||
            button.closest("table.IZ") as HTMLElement ||
            document.querySelector(COMPOSE_SELECTOR) as HTMLElement;

          if (compose) {
            this.extractAndCallback(compose, button);
          } else {
            console.warn("[Before You Send] Could not find compose window");
            // Fail open — let the send through
            button.dataset.bypassCheck = "true";
            button.click();
          }
          return;
        }

        this.extractAndCallback(composeEl, button);
      },
      true // Use capture phase to run before Gmail's handler
    );
  }

  /**
   * Extract email data from the compose window and trigger the callback.
   */
  private extractAndCallback(
    composeEl: HTMLElement,
    sendButton: HTMLElement
  ): void {
    // Extract subject
    const subjectInput = composeEl.querySelector(
      SUBJECT_SELECTOR
    ) as HTMLInputElement | null;
    const subject = subjectInput?.value || "";

    // Extract body
    const bodyEl = composeEl.querySelector(BODY_SELECTOR) as HTMLElement | null;
    const body = bodyEl?.innerText || bodyEl?.textContent || "";

    if (!body.trim()) {
      // Empty email — let it through (Gmail will prompt anyway)
      sendButton.dataset.bypassCheck = "true";
      sendButton.click();
      return;
    }

    this.onIntercept({
      subject,
      body,
      composeEl,
      sendButton,
    });
  }
}

/**
 * Trigger the actual send by clicking the button with the bypass flag.
 */
export function triggerSend(sendButton: HTMLElement): void {
  sendButton.dataset.bypassCheck = "true";
  sendButton.click();
}
