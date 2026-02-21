---
name: 连接器
description: 用于管理 LifeOS 外部服务连接器的斜杠命令技能。当用户使用 /连接器、/connector 命令或提及 GitHub、小红书、即刻等外部服务时触发此技能。
---

# 连接器技能

此技能用于将外部服务的数据同步到 LifeOS Vault 中。

## 触发条件

- 用户输入 `/连接器` 或 `/connector`
- 用户提及 "GitHub"、"小红书"、"即刻"、"同步"
- 用户需要配置外部服务连接

## 可用命令

### GitHub 连接

```
/连接器 GitHub [token]
/连接器 设置 GitHub token
```

示例：
```
/连接器 同步 GitHub
/连接器 查看我的仓库
/连接器 断开 GitHub
```

### 同步数据

```
/连接器 同步 [服务名]
```

示例：
```
/连接器 同步 GitHub
/连接器 同步 小红书
```

### 查看连接状态

```
/连接器 状态
/连接器 列表
```

## 支持的服务

### 已集成

| 服务 | 功能 | 状态 |
|------|------|------|
| GitHub | 仓库列表、通知、用户信息 | 已支持 |
| 小红书 | 搜索笔记、查看详情、评论、发布 | MCP |
| 即刻 | 浏览动态、发布内容、评论、搜索 | Skill |

### 即将支持

- Gmail - 未读邮件计数
- Google Calendar - 日程同步
- Slack - 未读消息和提醒
- Notion - 双向同步数据库
- Twitter/X - 发布日志和思考
- 微信读书 - 阅读进度和划线同步

## 数据存储

### 配置文件路径

```
{vault}/.life-os/connectors.yaml
```

### 配置格式

```yaml
github_token: "ghp_xxxxxxxxxxxx"
```

### GitHub 数据存储

```
{vault}/connectors/github/
  ├── user.json      # 用户信息
  └── repos.json     # 仓库列表
```

### MCP 配置

MCP 连接器配置在 `~/.claude/settings.json` 中：

```json
{
  "mcpServers": {
    "xiaohongshu": {
      "command": "rednote-mcp",
      "args": ["serve"]
    }
  }
}
```

## AI 操作指南

### 读取连接器配置

使用 `readFile("{vault}/.life-os/connectors.yaml")` 读取当前配置。

### 同步 GitHub 数据

1. 获取 GitHub Token
2. 调用 GitHub API 获取数据
3. 将数据保存到 `{vault}/connectors/github/` 目录

### 安装 MCP 连接器

```bash
# 小红书
npm install -g rednote-mcp
rednote-mcp init

# 即刻（作为 Claude Code Skill）
pip install jike-skill[qr]
```

## 权限说明

### GitHub Token 权限

- `repo` - 读取仓库信息
- `notifications` - 读取未读通知

获取方式：GitHub Settings → Developer settings → Personal access tokens

## 注意事项

1. GitHub Token 明文存储在本地 Vault 中
2. MCP 连接器需要单独安装和配置
3. 数据同步后存储在本地，可离线访问
4. 定期同步可获取最新数据
