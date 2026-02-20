---
name: 订阅
description: 用于管理 LifeOS 软件订阅模块的斜杠命令技能。当用户使用 /订阅 命令或提及订阅管理、订阅支出时触发此技能。
---

# 订阅技能

此技能用于通过 AI 辅助管理 LifeOS 软件订阅。

## 触发条件

- 用户输入 `/订阅`
- 用户提及 "添加订阅"、"删除订阅"、"查看订阅"
- 用户要求分析订阅支出

## 可用命令

### 添加新订阅

```
/订阅 添加 [订阅名称] [月费] [货币]
```

示例：
```
/订阅 添加 "ChatGPT Plus" 20 USD
```

### 删除订阅

```
/订阅 删除 [订阅名称]
```

### 查看订阅列表

```
/订阅 查看所有
/订阅 查看已启用
```

### 查看支出统计

```
/订阅 月度支出
/订阅 年度支出
/订阅 按类型统计
```

### 启用/禁用订阅

```
/订阅 启用 [订阅名称]
/订阅 禁用 [订阅名称]
```

## 数据存储

### 订阅文件路径

```
{vault}/subscriptions/{app-slug}.md
```

### Frontmatter 格式

```yaml
---
id: chatgpt-plus
name: ChatGPT Plus
amount: 20
currency: USD
cycle: monthly
startDate: 2024-01-01
renewalDate: 2025-03-01
paymentMethod: 信用卡
appType: saas
tags: AI, 工具
enabled: true
---
```

### Markdown 内容格式

```markdown
# ChatGPT Plus

## 备注
OpenAI 的 AI 助手订阅服务
```

## AI 操作指南

### 读取订阅列表

通过 `listNotes` 读取 `{vault}/subscriptions/` 目录下的所有 `.md` 文件，解析 frontmatter 获取订阅信息。

### 创建新订阅

1. 生成 slug：将名称转为小写，空格替换为连字符
2. 构建 frontmatter 对象
3. 使用 `writeNote` 写入文件

### 计算累计支出

```typescript
function calcTotalSpent(startDate: string, amount: number, cycle: string): number {
  const start = new Date(startDate);
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (cycle === "monthly") return months * amount;
  if (cycle === "yearly") return Math.floor(months / 12) * amount;
  if (cycle === "weekly") return Math.floor((now.getTime() - start.getTime()) / (7 * 86400000)) * amount;
  return 0;
}
```

## 注意事项

1. 订阅文件使用 Markdown + YAML frontmatter 格式
2. 金额字段为数字类型，货币单独存储
3. cycle 支持 monthly / yearly / weekly 三种周期
4. appType 分为 mobile / desktop / saas 三类
5. tags 使用逗号分隔的字符串
6. enabled 字段控制是否计入统计
