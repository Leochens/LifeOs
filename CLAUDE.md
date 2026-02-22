# Life OS - 项目备忘

## 架构概要
- Tauri v2 + React + Zustand 桌面应用
- 视图切换通过 Zustand store (`currentView` / `setView`)，不使用 URL 路由
- 插件系统：`menuConfig` 定义分组和插件，侧边栏动态渲染
- 图标统一从 `src/components/icons/index.ts` 导出（lucide-react）

## 多窗口支持
- 已实现侧边栏右键菜单 → "在新窗口打开"功能
- 使用 `@tauri-apps/api/webviewWindow` 的 `WebviewWindow` 创建新窗口
- 新窗口通过 URL 查询参数传递视图信息：`?view={viewId}&standalone=true`
- `App.tsx` 启动时读取查询参数，自动设置视图和 standalone 模式
- standalone 模式下 Shell 不渲染 Sidebar，内容区占满窗口
- 窗口 label 格式为 `plugin-{viewId}`，重复打开同一插件会聚焦已有窗口
- Tauri capabilities 中 windows 配置为 `["main", "plugin-*"]`

## 设计决策
- 做侧边栏右键打开新窗口的原因：用户需要同时查看多个插件页面，避免频繁切换视图
