// SPDX-License-Identifier: AGPL-3.0-or-later
// Claude Firefox MCP - Native Messaging Host (Deno)
// Bridges Claude Code CLI (stdio MCP) <-> Firefox Extension (native messaging)

const EXTENSION_ID = "claude-mcp@hyperpolymath.org";

// MCP Tool definitions
const MCP_TOOLS = [
  {
    name: "screenshot",
    description: "Take a screenshot of the current browser tab",
    inputSchema: {
      type: "object",
      properties: {
        tabId: { type: "number", description: "Tab ID (optional, uses active tab)" }
      }
    }
  },
  {
    name: "navigate",
    description: "Navigate to a URL or go back/forward in history",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to navigate to, or 'back'/'forward'" },
        tabId: { type: "number", description: "Tab ID (optional)" }
      },
      required: ["url"]
    }
  },
  {
    name: "read_page",
    description: "Get the accessibility tree representation of the page",
    inputSchema: {
      type: "object",
      properties: {
        tabId: { type: "number", description: "Tab ID (optional)" },
        depth: { type: "number", description: "Max depth (default: 15)" },
        filter: { type: "string", enum: ["all", "interactive"], description: "Filter elements" }
      }
    }
  },
  {
    name: "click",
    description: "Click at coordinates or on an element",
    inputSchema: {
      type: "object",
      properties: {
        coordinate: { type: "array", items: { type: "number" }, description: "[x, y] coordinates" },
        ref: { type: "string", description: "Element reference from read_page" },
        button: { type: "string", enum: ["left", "right"], description: "Mouse button" },
        tabId: { type: "number" }
      }
    }
  },
  {
    name: "type",
    description: "Type text into the focused element or at coordinates",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to type" },
        coordinate: { type: "array", items: { type: "number" }, description: "[x, y] to click first" },
        tabId: { type: "number" }
      },
      required: ["text"]
    }
  },
  {
    name: "scroll",
    description: "Scroll the page or an element",
    inputSchema: {
      type: "object",
      properties: {
        direction: { type: "string", enum: ["up", "down", "left", "right"] },
        amount: { type: "number", description: "Pixels to scroll (default: 300)" },
        coordinate: { type: "array", items: { type: "number" }, description: "Scroll at position" },
        tabId: { type: "number" }
      },
      required: ["direction"]
    }
  },
  {
    name: "execute_js",
    description: "Execute JavaScript code in the page context",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "JavaScript code to execute" },
        tabId: { type: "number" }
      },
      required: ["code"]
    }
  },
  {
    name: "find",
    description: "Find elements by text content or CSS selector",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text or selector to search for" },
        tabId: { type: "number" }
      },
      required: ["query"]
    }
  },
  {
    name: "form_input",
    description: "Set a form field value",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector for the input" },
        value: { description: "Value to set (string, number, or boolean)" },
        tabId: { type: "number" }
      },
      required: ["selector", "value"]
    }
  },
  {
    name: "tabs_list",
    description: "List all open tabs in the current window",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "tabs_create",
    description: "Create a new tab",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to open (optional)" }
      }
    }
  },
  {
    name: "tabs_close",
    description: "Close a tab",
    inputSchema: {
      type: "object",
      properties: {
        tabId: { type: "number", description: "Tab ID to close (optional, uses active)" }
      }
    }
  },
  {
    name: "get_page_text",
    description: "Get the text content of the page",
    inputSchema: {
      type: "object",
      properties: {
        tabId: { type: "number" }
      }
    }
  }
];

// Native messaging protocol: length-prefixed JSON
async function readNativeMessage(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<unknown | null> {
  // Read 4-byte length prefix (little-endian)
  const lengthBuf = new Uint8Array(4);
  let offset = 0;

  while (offset < 4) {
    const { done, value } = await reader.read();
    if (done) return null;
    lengthBuf.set(value.subarray(0, Math.min(4 - offset, value.length)), offset);
    offset += value.length;
  }

  const length = new DataView(lengthBuf.buffer).getUint32(0, true);
  if (length === 0 || length > 1024 * 1024) return null; // Max 1MB

  // Read message
  const msgBuf = new Uint8Array(length);
  offset = 0;

  while (offset < length) {
    const { done, value } = await reader.read();
    if (done) return null;
    msgBuf.set(value.subarray(0, Math.min(length - offset, value.length)), offset);
    offset += value.length;
  }

  return JSON.parse(new TextDecoder().decode(msgBuf));
}

function writeNativeMessage(writer: WritableStreamDefaultWriter<Uint8Array>, message: unknown): Promise<void> {
  const json = JSON.stringify(message);
  const msgBytes = new TextEncoder().encode(json);
  const lengthBuf = new Uint8Array(4);
  new DataView(lengthBuf.buffer).setUint32(0, msgBytes.length, true);

  return writer.write(new Uint8Array([...lengthBuf, ...msgBytes]));
}

// Stdio MCP protocol: newline-delimited JSON
async function readStdioLine(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string | null> {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) return null;

    buffer += decoder.decode(value, { stream: true });
    const newlineIdx = buffer.indexOf("\n");

    if (newlineIdx !== -1) {
      const line = buffer.slice(0, newlineIdx);
      // Keep remainder for next read (simplified - would need proper buffering)
      return line;
    }
  }
}

function writeStdio(message: unknown): void {
  const json = JSON.stringify(message);
  const encoder = new TextEncoder();
  Deno.stdout.writeSync(encoder.encode(json + "\n"));
}

// MCP Server state
let initialized = false;
let requestId = 0;
const pendingExtensionRequests = new Map<number, {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}>();

// Send tool call to extension and wait for response
async function callExtension(
  extensionWriter: WritableStreamDefaultWriter<Uint8Array>,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const id = ++requestId;

  const promise = new Promise((resolve, reject) => {
    pendingExtensionRequests.set(id, { resolve, reject });
    setTimeout(() => {
      if (pendingExtensionRequests.has(id)) {
        pendingExtensionRequests.delete(id);
        reject(new Error("Extension request timed out"));
      }
    }, 30000);
  });

  await writeNativeMessage(extensionWriter, {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name: toolName, arguments: args }
  });

  return promise;
}

// Handle MCP request from Claude Code
async function handleMcpRequest(
  request: { id?: number; method: string; params?: unknown },
  extensionWriter: WritableStreamDefaultWriter<Uint8Array>
): Promise<{ id?: number; result?: unknown; error?: { code: number; message: string } }> {
  const { id, method, params } = request;

  try {
    switch (method) {
      case "initialize":
        initialized = true;
        return {
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: {
              name: "claude-firefox-mcp",
              version: "1.0.0"
            }
          }
        };

      case "notifications/initialized":
        return { id }; // Acknowledgment

      case "tools/list":
        return {
          id,
          result: { tools: MCP_TOOLS }
        };

      case "tools/call": {
        const { name, arguments: args } = params as { name: string; arguments: Record<string, unknown> };
        const result = await callExtension(extensionWriter, name, args || {});
        return { id, result };
      }

      default:
        return {
          id,
          error: { code: -32601, message: `Method not found: ${method}` }
        };
    }
  } catch (error) {
    return {
      id,
      error: { code: -32000, message: error instanceof Error ? error.message : String(error) }
    };
  }
}

// Main entry point
async function main() {
  console.error("[MCP Host] Starting Claude Firefox MCP native host");

  // For native messaging, stdin/stdout are the extension connection
  // For stdio MCP, we'd read from stdin and write to stdout
  //
  // This host serves BOTH:
  // 1. As native messaging host for Firefox (when called by Firefox)
  // 2. As MCP server for Claude Code (when called directly)

  const mode = Deno.args[0] || "mcp";

  if (mode === "native") {
    // Native messaging mode - Firefox calls us
    console.error("[MCP Host] Running in native messaging mode");
    await runNativeMode();
  } else {
    // MCP server mode - Claude Code calls us
    console.error("[MCP Host] Running in MCP server mode");
    await runMcpMode();
  }
}

// MCP server mode - Claude Code <-> this host <-> Firefox extension
async function runMcpMode() {
  // Connect to Firefox via native messaging
  // This requires Firefox to be running with the extension loaded
  // The extension will connect to us via a WebSocket or we spawn a helper

  // For simplicity, we'll use a localhost WebSocket to communicate with the extension
  // The extension runs a WebSocket server, we connect to it

  const WS_PORT = 9876;
  let ws: WebSocket | null = null;

  const connectToExtension = () => {
    return new Promise<WebSocket>((resolve, reject) => {
      const socket = new WebSocket(`ws://localhost:${WS_PORT}`);
      socket.onopen = () => {
        console.error("[MCP Host] Connected to Firefox extension");
        resolve(socket);
      };
      socket.onerror = (e) => {
        console.error("[MCP Host] WebSocket error:", e);
        reject(new Error("Failed to connect to Firefox extension"));
      };
    });
  };

  // Try to connect to extension
  try {
    ws = await connectToExtension();
  } catch {
    console.error("[MCP Host] Extension not available, running in standalone mode");
    console.error("[MCP Host] Start Firefox with the extension loaded, then restart this server");
  }

  // Handle messages from extension
  if (ws) {
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id && pendingExtensionRequests.has(msg.id)) {
          const { resolve, reject } = pendingExtensionRequests.get(msg.id)!;
          pendingExtensionRequests.delete(msg.id);

          if (msg.error) {
            reject(new Error(msg.error.message));
          } else {
            resolve(msg.result);
          }
        }
      } catch (e) {
        console.error("[MCP Host] Failed to parse extension message:", e);
      }
    };
  }

  // Read MCP requests from stdin
  const stdinReader = Deno.stdin.readable.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await stdinReader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete lines
    let newlineIdx;
    while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIdx).trim();
      buffer = buffer.slice(newlineIdx + 1);

      if (!line) continue;

      try {
        const request = JSON.parse(line);
        console.error("[MCP Host] Received:", request.method);

        // Create a mock writer for extension communication
        const mockWriter = {
          write: async (msg: Uint8Array) => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(new TextDecoder().decode(msg));
            }
          }
        } as WritableStreamDefaultWriter<Uint8Array>;

        const response = await handleMcpRequest(request, mockWriter);
        writeStdio(response);
      } catch (e) {
        console.error("[MCP Host] Error processing request:", e);
        writeStdio({
          error: { code: -32700, message: "Parse error" }
        });
      }
    }
  }
}

// Native messaging mode - Firefox extension calls us directly
async function runNativeMode() {
  const stdinReader = Deno.stdin.readable.getReader();
  const stdoutWriter = Deno.stdout.writable.getWriter();

  while (true) {
    const message = await readNativeMessage(stdinReader);
    if (message === null) break;

    console.error("[MCP Host] Native message:", message);

    // Echo back for now - the extension handles the actual commands
    await writeNativeMessage(stdoutWriter, {
      received: true,
      echo: message
    });
  }
}

main().catch((e) => {
  console.error("[MCP Host] Fatal error:", e);
  Deno.exit(1);
});
