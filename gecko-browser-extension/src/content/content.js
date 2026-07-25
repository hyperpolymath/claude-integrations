// SPDX-License-Identifier: MPL-2.0
// Copyright (c) Jonathan D.A. Jewell <j.d.a.jewell@open.ac.uk>
// Claude for Gecko - Content Script

/**
 * Creates and shows a response overlay
 * @param {string} text - Response text to display
 * @param {boolean} isError - Whether this is an error message
 */
function showResponseOverlay(text, isError = false) {
  // Remove any existing overlay
  removeOverlay();

  const overlay = document.createElement("div");
  overlay.id = "claude-gecko-overlay";
  
  // Create overlay structure safely without innerHTML
  const responseDiv = document.createElement("div");
  responseDiv.className = `claude-gecko-response ${isError ? 'error' : ''}`;
  
  const headerDiv = document.createElement("div");
  headerDiv.className = "claude-gecko-header";
  
  const titleSpan = document.createElement("span");
  titleSpan.className = "claude-gecko-title";
  titleSpan.textContent = "Claude";
  headerDiv.appendChild(titleSpan);
  
  const closeBtn = document.createElement("button");
  closeBtn.className = "claude-gecko-close";
  closeBtn.title = "Close";
  closeBtn.textContent = "×";
  headerDiv.appendChild(closeBtn);
  
  const contentDiv = document.createElement("div");
  contentDiv.className = "claude-gecko-content";
  contentDiv.textContent = text;
  
  const actionsDiv = document.createElement("div");
  actionsDiv.className = "claude-gecko-actions";
  
  const copyBtn = document.createElement("button");
  copyBtn.className = "claude-gecko-copy";
  copyBtn.title = "Copy to clipboard";
  copyBtn.textContent = "Copy";
  actionsDiv.appendChild(copyBtn);
  
  responseDiv.appendChild(headerDiv);
  responseDiv.appendChild(contentDiv);
  responseDiv.appendChild(actionsDiv);
  overlay.appendChild(responseDiv);

  // Set content safely

  // Close button handler
  overlay.querySelector(".claude-gecko-close").addEventListener("click", removeOverlay);

  // Copy button handler
  overlay.querySelector(".claude-gecko-copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text);
      const copyBtn = overlay.querySelector(".claude-gecko-copy");
      copyBtn.textContent = "Copied!";
      setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  });

  // Click outside to close
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      removeOverlay();
    }
  });

  // Escape key to close
  document.addEventListener("keydown", handleEscape);

  document.body.appendChild(overlay);
}

/**
 * Handles escape key press
 */
function handleEscape(event) {
  if (event.key === "Escape") {
    removeOverlay();
  }
}

/**
 * Removes the response overlay
 */
function removeOverlay() {
  const overlay = document.getElementById("claude-gecko-overlay");
  if (overlay) {
    overlay.remove();
    document.removeEventListener("keydown", handleEscape);
  }
}

/**
 * Listen for messages from background script
 */
browser.runtime.onMessage.addListener((message) => {
  if (message.type === "CLAUDE_RESPONSE") {
    showResponseOverlay(message.text);
  } else if (message.type === "CLAUDE_ERROR") {
    showResponseOverlay(message.error, true);
  }
});
