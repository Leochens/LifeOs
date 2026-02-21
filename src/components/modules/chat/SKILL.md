---
name: AI聊天
description: 用于管理 LifeOS AI 聊天模块的斜杠命令技能。当用户使用 /聊天、/chat 命令或提及 AI 助手、Claude 时触发此技能。
---

# AI聊天技能

此技能用于通过 AI 辅助与 Claude Code 进行对话交互。

## 触发条件

- 用户输入 `/聊天` 或 `/chat`
- 用户提及 "AI"、"Claude"、"助手"、"聊天"
- 用户需要问答或建议

## 可用命令

### 开始对话

```
/聊天 [问题]
/chat [问题]
```

示例：
```
/聊天 今天天气怎么样？
/聊天 帮我总结一下这段文字
/聊天 给我一些建议
```

### 清空对话

```
/聊天 清空
/聊天 清空对话
```

## 使用方式

### 对话模式

AI 聊天模块通过调用本地 Claude Code CLI 来响应用户输入。支持：

- 多轮对话上下文
- 实时流式响应
- 代码辅助和调试
- 通用问答和建议

### 快捷键

- `Enter` - 发送消息
- `Shift+Enter` - 换行

## 技术实现

### Claude Code 调用

聊天模块通过 Tauri shell 命令调用 Claude Code：

```
claude -p "{prompt}"
```

### 消息格式

```typescript
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}
```

## 注意事项

1. 需要在设置中启用 Claude Code 并配置路径
2. 不支持在嵌套会话中运行
3. 对话历史保存在内存中，刷新后清空
4. 首次使用需要安装 Claude Code CLI：`npm install -g @anthropic-ai/claude-code`
