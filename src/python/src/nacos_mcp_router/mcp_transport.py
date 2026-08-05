from typing import Any
from mcp.types import Tool
from mcp.types import CallToolResult
from mcp.types import InitializeResult
from mcp.types import ListToolsResult

class McpTransport:
    def __init__(self, url: str, headers: dict[str, str]):
        self.url = url
        self.headers = headers
    
    async def handle_tool_call(self, args: dict[str, Any], client_headers: dict[str, str], name: str) -> Any:
        pass

    async def handle_list_tools(self, client_headers: dict[str, str]) -> Any:
        pass

    async def handle_initialize(self, client_headers: dict[str, str]) -> Any:
        pass

    def clean_headers(self, client_headers: dict[str, str]) -> dict[str, str]:
        return {k: v for k, v in client_headers.items() if k != 'Content-Length' and k != 'content-length' and k != 'host' and k != 'Host'}

    def merged_headers(self, client_headers: dict[str, str]) -> dict[str, str]:
        """合并注册配置 headers（self.headers）与客户端请求头。
        - X-MCP-Env-Config（配置块）以注册配置为准，避免客户端全量覆盖按 mcp 名隔离的配置块；
        - 其余 header 客户端优先（透传）。
        - 去重时大小写不敏感：客户端 header 名可能是小写，若只按原 key 覆盖会产生
          两个同名（不同大小写）header 同时发送，下游解析会失败。"""
        merged = self.clean_headers(client_headers)
        for k, v in self.headers.items():
            lk = k.lower()
            # 删除已存在的同名 header（忽略大小写），避免重复发送
            for mk in [mk for mk in merged if mk.lower() == lk]:
                del merged[mk]
            merged[k] = v
        return merged