# ServerPanel 模块开发 SDK

ServerPanel 模块系统允许开发者创建扩展，为面板添加自定义功能。

---

## 目录结构

每个模块是一个放置在 `server/plugins/<模块名称>/` 目录下的文件夹：

```
server/plugins/
  your-plugin/
    plugin.json        # 模块清单（必需）
    index.html         # 模块前端页面（必需）
    style.css          # 可选样式
    app.js             # 可选前端脚本
    server.py          # 可选 Python 后端
    main.py            # 可选 Python 后端（备选）
    config.json        # 模块配置（由模块自己管理）
    assets/            # 静态资源（图片等）
```

---

## plugin.json 清单

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 模块唯一标识名，必须与文件夹名一致 |
| `version` | string | 是 | 版本号，如 `1.0.0` |
| `title` | string | 是 | 模块显示名称 |
| `description` | string | 否 | 简短描述 |
| `author` | string | 否 | 作者名 |
| `icon` | string | 否 | Font Awesome 图标类，如 `"fa-solid fa-globe"` |
| `entry` | string | 否 | 前端入口文件，默认 `index.html` |
| `scripts` | string[] | 否 | Python 脚本文件名列表，如 `["server.py"]` |
| `permissions` | string[] | 否 | 所需权限，当前预留字段 |

示例：

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "title": "我的模块",
  "description": "实现自定义功能",
  "author": "开发者",
  "icon": "fa-solid fa-star",
  "entry": "index.html",
  "scripts": ["server.py"],
  "permissions": []
}
```

---

## 前端开发

模块前端是一个完整的 HTML 页面（`index.html`），在"模块页面"中通过 iframe 加载。

### 可用 API

模块前端可通过 `window.parent.apiRequest()` 调用面板 API：

```javascript
const api = window.parent.apiRequest;

// 示例：获取系统信息
const sysInfo = await api('GET', '/system');

// 示例：读取文件列表
const files = await api('GET', '/files?path=/');
```

如果不确定 `parent.apiRequest` 是否可用，可使用回退方案：

```javascript
const api = (window.parent && window.parent.apiRequest)
  ? window.parent.apiRequest
  : async (method, path, body) => {
      const opts = { method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin' };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch('/api' + path, opts);
      return res.json();
    };
```

### 特别模块 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/plugins` | 获取所有模块列表 |
| GET | `/api/plugins/:name` | 获取模块详细信息 |
| GET | `/api/plugins/:name/config` | 读取模块配置 (config.json) |
| PUT | `/api/plugins/:name/config` | 保存模块配置 |
| POST | `/api/plugins/:name/execute` | 调用 Python 后端 |

#### 配置读写

```javascript
// 读取配置
const res = await api('GET', '/plugins/my-plugin/config');
const config = res.config || {};

// 保存配置
await api('PUT', '/plugins/my-plugin/config', {
  config: { key: 'value' }
});
```

#### 调用 Python 后端

```javascript
const res = await api('POST', '/plugins/my-plugin/execute', {
  args: { action: 'greet', name: 'World' }
});
if (res.success) {
  console.log(res.result);
}
```

---

## Python 后端开发

Python 后端通过 `server.py`（或 `main.py`）实现，接收 JSON 输入并返回 JSON 输出。

### 通信协议

- **stdin**：接收 JSON 格式的调用参数
- **stdout**：输出 JSON 格式的返回结果
- **stderr**：输出错误信息
- **环境变量**：`PLUGIN_DIR` 指向模块目录

### 基本模板

```python
#!/usr/bin/env python3
import sys
import json
import os

def handle_request(args):
    action = args.get("action")

    if action == "ping":
        return {"success": True, "message": "pong"}

    # 处理其他操作
    return {"success": False, "error": f"未知操作: {action}"}

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
```

### Python 返回值规范

```json
// 成功
{"success": true, "result": {"message": "操作成功", "data": ...}}

// 失败
{"success": false, "error": "错误描述信息"}
```

---

## 完整开发示例

以下是一个完整的最小模块：

### plugin.json

```json
{
  "name": "demo",
  "version": "1.0.0",
  "title": "演示模块",
  "description": "演示模块开发流程",
  "author": "开发者",
  "icon": "fa-solid fa-flask",
  "entry": "index.html",
  "scripts": ["server.py"]
}
```

### index.html

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>演示模块</title>
<style>
body {
  font-family: system-ui, sans-serif;
  background: transparent;
  padding: 20px;
  color: #1C1B1F;
}
h1 { font-weight: 500; }
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border: none;
  border-radius: 50px;
  font-size: 14px;
  cursor: pointer;
  background: #6750A4;
  color: white;
}
</style>
</head>
<body>
<h1>演示模块</h1>
<p>这是我的第一个模块！</p>
<button class="btn" onclick="ping()">测试后端</button>
<pre id="out" style="margin-top:12px"></pre>
<script>
const api = window.parent.apiRequest;
async function ping() {
  document.getElementById('out').textContent = '请求中...';
  const res = await api('POST', '/plugins/demo/execute', { args: { action: 'ping' } });
  document.getElementById('out').textContent = JSON.stringify(res, null, 2);
}
</script>
</body>
</html>
```

### server.py

```python
#!/usr/bin/env python3
import sys, json

def handle(args):
    action = args.get("action")
    if action == "ping":
        return {"success": True, "message": "pong"}
    return {"success": False, "error": "unknown action"}

def main():
    raw = sys.stdin.read().strip()
    args = json.loads(raw) if raw else {}
    print(json.dumps(handle(args), ensure_ascii=False))

if __name__ == "__main__":
    main()
```

将以上文件放入 `server/plugins/demo/` 目录，重启面板或刷新页面即可在"模块页面"中看到它。

---

## 安装方式

1. **手动放置**：将模块文件夹放入 `server/plugins/` 目录，确保包含 `plugin.json`
2. **ZIP 安装**：在"管理模块"页面点击"安装模块"，上传 ZIP 压缩包

### ZIP 规范

- ZIP 根目录需包含 `plugin.json`
- 文件名即为模块名称
- 支持嵌套目录，系统会自动识别

```
my-plugin.zip
  ├── plugin.json
  ├── index.html
  ├── style.css
  ├── server.py
  └── assets/
      └── logo.png
```

---

## 注意事项

1. **安全性**：模块在 iframe 中运行，无法直接访问面板 DOM
2. **通信**：通过 `parent.apiRequest` 与面板通信
3. **Python**：Python 后端有 30 秒执行超时限制
4. **静态资源**：模块内的任何文件可通过 `/plugins/<name>/<file>` 访问
5. **配置持久化**：使用配置文件 API，数据保存在模块目录的 `config.json`
6. **响应式**：建议前端页面适配移动端（模块页面支持 iframe 全屏显示）
