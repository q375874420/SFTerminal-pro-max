# 旗鱼终端

> AI 驱动的跨平台终端，助力运维提效

## 功能特性

- 🖥️ **跨平台支持**：Windows、macOS、Linux
- 🤖 **AI 助手**：命令解释、错误诊断、自然语言生成命令
- 🔐 **SSH 管理**：支持密码和私钥认证，会话分组管理
- 🎨 **丰富主题**：内置多款精美配色方案
- ⚡ **高性能**：基于 xterm.js，流畅的终端体验
- 🏢 **内网友好**：支持配置内网 AI API 和代理

## 技术栈

- **框架**：Electron 33 + Vue 3 + TypeScript
- **终端**：xterm.js 5.x
- **构建**：Vite + electron-builder

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 pnpm

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建应用

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

## AI 配置

旗鱼终端支持 OpenAI 兼容 API，可以连接：

- 公有云服务：OpenAI、通义千问、DeepSeek 等
- 私有化部署：vLLM、FastChat、Ollama 等

### 配置示例

在设置中添加 AI 配置：

```json
{
  "name": "公司内网模型",
  "apiUrl": "http://10.0.1.100:8080/v1/chat/completions",
  "apiKey": "sk-xxx",
  "model": "qwen-72b",
  "proxy": null
}
```

## 项目结构

```
├── electron/                # Electron 主进程
│   ├── main.ts             # 入口
│   ├── preload.ts          # 预加载脚本
│   └── services/           # 服务层
│       ├── pty.service.ts  # 本地终端
│       ├── ssh.service.ts  # SSH 连接
│       ├── ai.service.ts   # AI API
│       └── config.service.ts
├── src/                    # Vue 渲染进程
│   ├── components/         # 组件
│   ├── stores/            # Pinia 状态
│   └── themes/            # 主题配色
├── resources/             # 应用图标
└── electron-builder.yml   # 打包配置
```

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl+Shift+T | 新建标签页 |
| Ctrl+W | 关闭当前标签 |
| Ctrl+Tab | 切换标签页 |
| Ctrl+Shift+C | 复制 |
| Ctrl+Shift+V | 粘贴 |
| Ctrl+F | 搜索 |

## 许可证

MIT License

## 致谢

- [Electron](https://www.electronjs.org/)
- [xterm.js](https://xtermjs.org/)
- [Vue.js](https://vuejs.org/)
- [node-pty](https://github.com/microsoft/node-pty)
- [ssh2](https://github.com/mscdex/ssh2)

