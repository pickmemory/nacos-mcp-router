#!/usr/bin/env node
// sync-mcp-config：把 ~/.nacos-mcp-router/config.json 编码后填充到 .mcp.json 的
// X-MCP-Env-Config header。LLM 不读取 config.json 内容（本脚本 stdout 只报状态）。
//
// 用法：
//   node sync-mcp-config.js                     # 默认配置：~/.nacos-mcp-router/config.json → D:/code/.mcp.json
//   node sync-mcp-config.js --config <路径>      # 指定配置源文件
//   node sync-mcp-config.js --mcp <路径>         # 指定目标 .mcp.json
//   node sync-mcp-config.js --watch              # 监听配置变化自动同步（配合代理重启生效）
//
// 约定：
//   - config.json 结构：{ "<mcp名称>": { "<KEY>": "<value>", ... }, ... }（按被路由的 mcp 名分块）
//   - 编码方式：encodeURIComponent(JSON.stringify(整份配置))，下游整体解码
//   - 只更新 nacos-mcp-router 节点的 headers["X-MCP-Env-Config"]，其余配置不动

import { readFileSync, writeFileSync, existsSync, watch } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const DEFAULT_CONFIG = join(homedir(), ".nacos-mcp-router", "config.json");
const DEFAULT_MCP = "D:/code/.mcp.json";
const SERVER_NAME = "nacos-mcp-router";
const HEADER_NAME = "X-MCP-Env-Config";

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

function sync(configPath, mcpPath) {
  if (!existsSync(configPath)) {
    console.error(`✗ 配置不存在: ${configPath}`);
    return false;
  }
  // 1. 读取配置（明文 JSON，按 mcp 名分块）
  const cfg = JSON.parse(readFileSync(configPath, "utf-8"));
  const names = Object.keys(cfg);

  // 2. 编码（整体 URL 编码，下游统一解码）
  const encoded = encodeURIComponent(JSON.stringify(cfg));

  // 3. 更新 .mcp.json 中 nacos-mcp-router 的 headers
  const mcp = JSON.parse(readFileSync(mcpPath, "utf-8"));
  const server = mcp.mcpServers?.[SERVER_NAME];
  if (!server) {
    console.error(`✗ ${mcpPath} 中没有 ${SERVER_NAME} 节点`);
    return false;
  }
  server.headers = server.headers ?? {};
  server.headers[HEADER_NAME] = encoded;
  writeFileSync(mcpPath, JSON.stringify(mcp, null, 2), "utf-8");

  console.log(`✓ 已同步 ${names.length} 个 mcp 配置到 ${mcpPath}`);
  return true;
}

const configPath = resolve(arg("--config") ?? DEFAULT_CONFIG);
const mcpPath = resolve(arg("--mcp") ?? DEFAULT_MCP);

if (process.argv.includes("--watch")) {
  console.log(`监听 ${configPath} 变更（Ctrl+C 退出）...`);
  watch(configPath, () => {
    try { sync(configPath, mcpPath); } catch (e) { console.error(`✗ 同步失败: ${e.message}`); }
  });
} else {
  try {
    if (sync(configPath, mcpPath)) process.exit(0);
    process.exit(1);
  } catch (e) {
    console.error(`✗ 同步失败: ${e.message}`);
    process.exit(1);
  }
}
