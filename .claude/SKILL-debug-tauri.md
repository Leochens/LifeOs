---
name: 调试 Tauri
description: 用于调试 Tauri 桌面应用的技能。当遇到 Tauri 应用启动失败、打包错误、IPC 通信问题、权限问题时触发。
---

# 调试 Tauri 技能

此技能指导 AI 如何诊断和解决 Tauri 应用的各类问题。

## 触发条件

- 用户输入 `/调试` 或 `/debug`
- 用户提及 "Tauri 报错"、"打包失败"、"启动失败"
- 用户遇到白屏、IPC 通信失败、权限问题
- 用户要求诊断 Tauri 应用问题

## 快速诊断

### 1. 检查环境信息

```bash
npx tauri info
```

输出包含：
- Rust 版本
- Node.js 版本
- 操作系统信息
- Tauri CLI 版本
- 依赖状态

### 2. 开发模式详细日志

```bash
# 启用 Rust backtrace
RUST_BACKTRACE=1 npm run tauri dev

# 更详细的日志
RUST_BACKTRACE=full RUST_LOG=debug npm run tauri dev
```

### 3. 检查 TypeScript 编译

```bash
npx tsc --noEmit
```

## 常见问题排查

### 问题 1: 启动失败 / 白屏

**诊断步骤**：

```bash
# 1. 检查前端是否能单独运行
npm run dev

# 2. 检查端口是否被占用
lsof -i :1420

# 3. 检查 Vite 配置
cat vite.config.ts
```

**常见原因**：
- 端口 1420 被占用 → 杀掉占用进程或修改端口
- Vite 配置不兼容 Tauri → 检查 vite.config.ts
- 前端编译错误 → 检查 TypeScript 错误

**解决方案**：

```bash
# 杀掉占用端口的进程
kill -9 $(lsof -t -i :1420)

# 清理并重新安装
rm -rf node_modules
npm install
```

### 问题 2: Rust 编译错误

**诊断步骤**：

```bash
# 单独编译 Rust
cd src-tauri
cargo build

# 检查 Cargo.toml 依赖
cargo check
```

**常见错误**：

| 错误 | 原因 | 解决方案 |
|-----|------|---------|
| `linker 'cc' not found` | 缺少 C 编译器 | 安装 Xcode CLI: `xcode-select --install` |
| `failed to run custom build command` | 依赖编译失败 | 检查缺失的系统库 |
| `use of undeclared crate or module` | Rust 代码错误 | 检查 import 和模块路径 |

### 问题 3: IPC 通信失败

**诊断步骤**：

```typescript
// 前端：检查 invoke 是否正确导入
import { invoke } from '@tauri-apps/api/core';

// 添加错误捕获
try {
  const result = await invoke('my_command', { arg: 'value' });
  console.log('Result:', result);
} catch (error) {
  console.error('IPC Error:', error);
}
```

```rust
// Rust 后端：添加日志
#[tauri::command]
fn my_command(arg: &str) -> Result<String, String> {
    println!("Received: {}", arg);  // 调试日志
    Ok(format!("Processed: {}", arg))
}
```

**检查清单**：
- [ ] 命令是否在 `tauri::generate_handler![]` 中注册
- [ ] 命令参数类型是否匹配
- [ ] 是否有权限限制（capabilities）

### 问题 4: 权限 / Capabilities 问题

**诊断步骤**：

```bash
# 查看 capabilities 配置
cat src-tauri/capabilities/*.json
```

**常见权限问题**：

| 功能 | 需要的权限 |
|-----|-----------|
| 文件系统操作 | `fs:allow-read`, `fs:allow-write` |
| Shell 命令 | `shell:allow-execute` |
| 窗口操作 | `window:allow-*` |
| HTTP 请求 | `http:allow-fetch` |

**解决方案**：

```json
// src-tauri/capabilities/default.json
{
  "identifier": "default",
  "description": "Default capabilities",
  "permissions": [
    "core:default",
    "fs:allow-read",
    "fs:allow-write",
    "shell:allow-execute"
  ]
}
```

### 问题 5: 打包失败

**诊断步骤**：

```bash
# 详细构建日志
RUST_BACKTRACE=1 npm run tauri build -- --verbose

# 检查签名配置（macOS）
cat src-tauri/tauri.conf.json | grep -A 10 "bundle"
```

**macOS 特定问题**：

```bash
# 检查签名证书
security find-identity -v -p codesigning

# 公证状态
xcrun notarytool history --apple-id "your@email.com"
```

**常见错误**：

| 错误 | 解决方案 |
|-----|---------|
| `Code signing failed` | 检查证书配置 |
| `Notarization failed` | 检查 Apple 开发者账号 |
| `DMG creation failed` | 安装 create-dmg: `brew install create-dmg` |

## 前端调试

### Chrome DevTools

开发模式下按 `F12` 或 `Cmd+Option+I` 打开开发者工具。

### React DevTools

1. 安装 React DevTools 浏览器扩展
2. 在 Tauri 窗口中使用

### 日志调试

```typescript
// 使用 console.log
console.log('Debug info:', data);

// 使用 Tauri 的日志 API
import { info, error } from '@tauri-apps/plugin-log';

await info('This is an info message');
await error('This is an error message');
```

## Rust 后端调试

### 日志输出

```rust
// 在 Cargo.toml 添加
[dependencies]
log = "0.4"
env_logger = "0.10"

// 在代码中使用
log::debug!("Debug message: {:?}", data);
log::error!("Error occurred: {}", err);
```

### 断点调试 (VS Code)

1. 安装 `rust-analyzer` 和 `CodeLLDB` 扩展
2. 创建 `.vscode/launch.json`：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "lldb",
      "request": "launch",
      "name": "Tauri Development Debug",
      "cargo": {
        "args": ["build", "--manifest-path=./src-tauri/Cargo.toml"],
        "filter": {
          "name": "life-os",
          "kind": "bin"
        }
      },
      "preLaunchTask": "ui:dev"
    }
  ]
}
```

### 使用 lldb 命令行

```bash
# 编译 debug 版本
cd src-tauri
cargo build

# 启动调试
lldb ./target/debug/life-os
```

## 网络请求调试

### 检查 HTTP 请求

```typescript
// 前端拦截器
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  console.log('Fetch:', args);
  const response = await originalFetch(...args);
  console.log('Response:', response);
  return response;
};
```

### Tauri HTTP 插件调试

```rust
// Rust 端日志
use tauri_plugin_http::Http;

// 检查请求配置
println!("HTTP Config: {:?}", config);
```

## 性能问题调试

### 内存泄漏

```bash
# macOS 使用 Instruments
instruments -t "Allocations" ./src-tauri/target/debug/life-os
```

### 启动时间分析

```rust
// 在 main.rs 添加计时
let start = std::time::Instant::now();
// ... 初始化代码
println!("Startup time: {:?}", start.elapsed());
```

## 常用诊断命令

```bash
# 完整环境检查
npx tauri info

# 清理构建缓存
rm -rf src-tauri/target
rm -rf node_modules/.vite

# 重新构建
npm run tauri build

# 检查依赖更新
cargo outdated --manifest-path src-tauri/Cargo.toml
npm outdated

# 运行测试
cargo test --manifest-path src-tauri/Cargo.toml
npm test
```

## 项目特定配置

### LifeOS 的 Tauri 配置位置

```
src-tauri/
├── tauri.conf.json      # 主配置文件
├── Cargo.toml           # Rust 依赖
├── capabilities/        # 权限配置
│   └── default.json
└── src/
    └── main.rs          # Rust 入口
```

### 常用权限 (capabilities)

```json
{
  "identifier": "default",
  "permissions": [
    "core:default",
    "fs:default",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    "fs:allow-exists",
    "fs:allow-mkdir",
    "shell:allow-execute",
    "shell:allow-open",
    "dialog:default",
    "http:default"
  ]
}
```

## 错误信息速查

| 错误关键词 | 可能原因 | 优先检查 |
|-----------|---------|---------|
| `failed to resolve` | 依赖缺失 | `npm install` |
| `cannot find module` | 路径错误 | 检查 import 路径 |
| `permission denied` | 权限不足 | 检查 capabilities |
| `port already in use` | 端口占用 | `lsof -i :1420` |
| `segmentation fault` | Rust 内存错误 | 检查 unsafe 代码 |
| `timeout` | 请求超时 | 检查网络/IPC |

## AI 操作建议

1. **先收集信息**：运行 `npx tauri info` 获取环境信息
2. **查看错误日志**：使用 `RUST_BACKTRACE=1` 获取详细日志
3. **隔离问题**：分别测试前端和 Rust 后端
4. **检查配置**：对比官方模板配置
5. **搜索已知问题**：Tauri GitHub Issues

## 参考资源

- [Tauri 官方文档](https://tauri.app/v2/guides/)
- [Tauri GitHub Issues](https://github.com/tauri-apps/tauri/issues)
- [Tauri Discord](https://discord.gg/tauri)
