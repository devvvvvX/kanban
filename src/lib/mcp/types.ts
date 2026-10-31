/**
 * Model Context Protocol (MCP) JSON-RPC 2.0 and Tool Schema Definitions
 * Conforms to the official Model Context Protocol specifications (2024-11-05).
 */

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, any>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: any;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

export const MCP_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  UNAUTHORIZED: -32001,
} as const;

export interface ToolPropertySchema {
  type: string | string[];
  description?: string;
  enum?: readonly string[];
  items?: {
    type: string;
    description?: string;
  };
  default?: any;
}

export interface ToolInputSchema {
  type: "object";
  properties?: Record<string, ToolPropertySchema>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
}

export interface McpContentItem {
  type: "text";
  text: string;
}

export interface McpToolCallResult {
  content: McpContentItem[];
  isError?: boolean;
}

export interface McpServerInfo {
  name: string;
  version: string;
}

export interface McpInitializeResult {
  protocolVersion: string;
  capabilities: {
    tools?: {
      listChanged?: boolean;
    };
    resources?: Record<string, unknown>;
    prompts?: Record<string, unknown>;
  };
  serverInfo: McpServerInfo;
}
