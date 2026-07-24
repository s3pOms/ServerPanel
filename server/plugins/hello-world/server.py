#!/usr/bin/env python3
"""
Hello World 模块 - Python 后端示例

ServerPanel 模块 ADK
====================
- stdin 接收 JSON 格式的调用参数
- stdout 输出 JSON 格式的返回结果
- 出现错误时输出到 stderr

可用环境变量:
  PLUGIN_DIR - 模块所在目录的路径

示例:
  echo '{"name":"World","action":"greet"}' | python server.py
"""
import sys
import json
import os

def handle_request(args):
    action = args.get("action", "ping")
    name = args.get("name", "World")

    if action == "greet":
        return {
            "success": True,
            "message": f"你好，{name}！这是来自 Python 后端回复。",
            "server_time": __import__("datetime").datetime.now().isoformat(),
            "plugin_dir": os.environ.get("PLUGIN_DIR", "unknown")
        }
    elif action == "echo":
        return {
            "success": True,
            "message": f"你发送了: {json.dumps(args, ensure_ascii=False)}"
        }
    elif action == "ping":
        return {
            "success": True,
            "message": "pong",
            "version": "1.0.0"
        }
    else:
        return {
            "success": False,
            "error": f"未知操作: {action}"
        }

def main():
    try:
        raw = sys.stdin.read().strip()
        args = json.loads(raw) if raw else {}
        result = handle_request(args)
        print(json.dumps(result, ensure_ascii=False))
    except json.JSONDecodeError as e:
        print(json.dumps({"success": False, "error": f"JSON 解析错误: {str(e)}"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
