// SPDX-License-Identifier: AGPL-3.0-or-later
// Claude Firefox MCP - Native Host Server (Deno)
// Bridges: Claude Code (stdio MCP) <-> WebSocket <-> Firefox Extension

const WS_PORT = 9876;

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
    description: "Click at coordinates",
    inputSchema: {
      type: "object",
      properties: {
        coordinate: { type: "array", items: { type: "number" }, description: "[x, y] coordinates" },
        button: { type: "string", enum: ["left", "right"], description: "Mouse button" },
        tabId: { type: "number" }
      },
      required: ["coordinate"]
    }
  },
  {
    name: "type",
    description: "Type text into the focused element",
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
    description: "Scroll the page",
    inputSchema: {
      type: "object",
      properties: {
        direction: { type: "string", enum: ["up", "down", "left", "right"] },
        amount: { type: "number", description: "Pixels (default: 300)" },
        coordinate: { type: "array", items: { type: "number" } },
        tabId: { type: "number" }
      },
      required: ["direction"]
    }
  },
  {
    name: "execute_js",
    description: "Execute JavaScript in the page",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "JavaScript code" },
        tabId: { type: "number" }
      },
      required: ["code"]
    }
  },
  {
    name: "find",
    description: "Find elements by text or CSS selector",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text or selector" },
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
        selector: { type: "string", description: "CSS selector" },
        value: { description: "Value to set" },
        tabId: { type: "number" }
      },
      required: ["selector", "value"]
    }
  },
  {
    name: "tabs_list",
    description: "List open tabs",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "tabs_create",
    description: "Create a new tab",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string" } }
    }
  },
  {
    name: "tabs_close",
    description: "Close a tab",
    inputSchema: {
      type: "object",
      properties: { tabId: { type: "number" } }
    }
  },
  {
    name: "get_page_text",
    description: "Get page text content",
    inputSchema: {
      type: "object",
      properties: { tabId: { type: "number" } }
    }
  }
];

// State
let extensionSocket: WebSocket | null = null;
let requestId = 0;
const pendingRequests = new Map<number, {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}>();

// Write to stdout (MCP responses to Claude Code)
function writeStdout(message: unknown): void {
  const json = JSON.stringify(message);
  const bytes = new TextEncoder().encode(json + "\n");
  Deno.stdout.writeSync(bytes);
}

// Log to stderr (doesn't interfere with MCP protocol)
function log(...args: unknown[]): void {
  console.error("[MCP Server]", ...args);
}

// Send tool call to Firefox extension
async function callExtension(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  if (!extensionSocket || extensionSocket.readyState !== WebSocket.OPEN) {
    throw new Error("Firefox extension not connected. Start Firefox with the extension loaded.");
  }

  const id = ++requestId;

  const promise = new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error("Extension request timed out"));
      }
    }, 30000);
  });

  extensionSocket.send(JSON.stringify({
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name: toolName, arguments: args }
  }));

  return promise;
}

// Handle MCP request from Claude Code
async function handleMcpRequest(request: { id?: number; method: string; params?: Record<string, unknown> }): Promise<void> {
  const { id, method, params } = request;

  try {
    let result: unknown;

    switch (method) {
      case "initialize":
        result = {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: {
            name: "claude-firefox-mcp",
            version: "1.0.0"
          }
        };
        break;

      case "notifications/initialized":
        log("MCP initialized");
        return; // No response needed

      case "tools/list":
        result = { tools: MCP_TOOLS };
        break;

      case "tools/call": {
        const { name, arguments: args } = params as { name: string; arguments: Record<string, unknown> };
        log(`Tool call: ${name}`);
        result = await callExtension(name, args || {});
        break;
      }

      default:
        writeStdout({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${method}` }
        });
        return;
    }

    writeStdout({ jsonrpc: "2.0", id, result });
  } catch (error) {
    log("Error:", error);
    writeStdout({
      jsonrpc: "2.0",
      id,
      error: {
        code: -32000,
        message: error instanceof Error ? error.message : String(error)
      }
    });
  }
}

// Handle message from Firefox extension
function handleExtensionMessage(data: string): void {
  try {
    const message = JSON.parse(data);

    if (message.id && pendingRequests.has(message.id)) {
      const { resolve, reject } = pendingRequests.get(message.id)!;
      pendingRequests.delete(message.id);

      if (message.error) {
        reject(new Error(message.error.message || "Extension error"));
      } else {
        resolve(message.result);
      }
    }
  } catch (e) {
    log("Failed to parse extension message:", e);
  }
}

// Start WebSocket server for Firefox extension
async function startWebSocketServer(): Promise<void> {
  log(`Starting WebSocket server on port ${WS_PORT}`);

  const server = Deno.serve({ port: WS_PORT }, (req) => {
    if (req.headers.get("upgrade") !== "websocket") {
      return new Response("WebSocket required", { status: 400 });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onopen = () => {
      log("Firefox extension connected");
      extensionSocket = socket;
    };

    socket.onmessage = (event) => {
      handleExtensionMessage(event.data);
    };

    socket.onclose = () => {
      log("Firefox extension disconnected");
      if (extensionSocket === socket) {
        extensionSocket = null;
      }
    };

    socket.onerror = (e) => {
      log("WebSocket error:", e);
    };

    return response;
  });

  log("WebSocket server started");
}

// Read MCP requests from stdin
async function readStdin(): Promise<void> {
  const decoder = new TextDecoder();
  const reader = Deno.stdin.readable.getReader();
  let buffer = "";

  log("Reading from stdin...");

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      log("Stdin closed");
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    // Process complete lines
    let newlineIdx;
    while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIdx).trim();
      buffer = buffer.slice(newlineIdx + 1);

      if (!line) continue;

      try {
        const request = JSON.parse(line);
        log("Received:", request.method || "unknown");
        await handleMcpRequest(request);
      } catch (e) {
        log("Parse error:", e);
        writeStdout({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" }
        });
      }
    }
  }
}

// Main
async function main(): Promise<void> {
  log("Claude Firefox MCP Server starting...");

  // Start WebSocket server in background
  startWebSocketServer();

  // Read MCP from stdin
  await readStdin();
}

main().catch((e) => {
  log("Fatal error:", e);
  Deno.exit(1);
});
