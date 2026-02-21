---
name: 技能管理
description: 用于管理 AI 代码助手技能文件的斜杠命令技能。当用户使用 /技能 命令或提及 Skills、Claude Code、Cursor 时触发此技能。
---

# 技能管理技能

此技能用于通过 AI 辅助管理 LifeOS 中的 AI 代码助手技能文件，支持 Claude Code、Cursor、VS Code 等工具。

## 触发条件

- 用户输入 `/技能` 或 `/skills`
- 用户提及 "Skill"、"技能文件"、"AI 助手"
- 用户要求创建或编辑 AI 技能

## 可用命令

### 列出技能

```
/技能 列表
/技能 查看所有技能
/技能 按工具列出技能
```

### 创建技能

```
/技能 创建 [技能名称]
/技能 新建 Skill [名称] 用于 [工具]
```

支持的工具：
- Claude Code
- Cursor
- VS Code

### 编辑技能

```
/技能 编辑 [技能名称]
/技能 修改 [技能名称] 的描述
```

### 搜索技能

```
/技能 搜索 [关键词]
/技能 查找包含 [描述] 的技能
```

### 查看技能详情

```
/技能 查看 [技能名称]
/技能 显示 [技能名称] 的内容
```

### 在 Finder 中打开

```
/技能 打开 [技能名称] 所在目录
```

## 数据存储

### 技能文件路径

技能文件存储在用户配置的各个 IDE 技能目录中：

**Claude Code:**
```
~/.claude/custom_skills/
```

**Cursor:**
```
~/.cursor/rules/
```

**VS Code:**
```
~/.vscode/rules/
```

### 技能文件格式

```markdown
---
description: Describe what this skill does
---

# Skill Name

Your instructions here.
```

## AI 操作指南

### 获取技能路径

使用 `getSkillPaths()` 获取所有配置的技能路径列表。

### 列出技能文件

使用 `listSkillFiles(paths)` 从多个路径读取所有技能文件。

### 创建新技能

1. 使用 `writeFile(path, content)` 创建新文件
2. 默认模板包含 frontmatter 和基础结构
3. 文件名应以 `.md` 结尾

### 编辑技能

1. 读取现有技能文件内容
2. 修改内容后使用 `writeFile` 保存
3. 保存后会自动刷新技能列表

### 按工具分组

技能按以下分组显示：
- Claude Code
- Cursor
- VS Code
- Other（其他工具）

## 技能文件最佳实践

1. **清晰的描述** - frontmatter 中的 description 应简洁说明技能用途
2. **具体的指令** - 技能内容应包含具体的操作步骤
3. **示例代码** - 包含代码示例以便 AI 更好理解
4. **错误处理** - 描述可能遇到的问题及解决方案

## 默认技能模板

```markdown
---
description: [技能的简短描述]
---

# [技能名称]

## 用途
[描述这个技能用来做什么]

## 使用场景
- [场景 1]
- [场景 2]

## 操作步骤
1. [第一步]
2. [第二步]

## 示例
\`\`\`
[示例代码或命令]
\`\`\`
```

## 注意事项

1. 技能文件使用 Markdown 格式
2. Frontmatter 是必需的，至少包含 description
3. 文件名建议使用 kebab-case（如 `my-skill.md`）
4. 修改技能后会立即在对应的 AI 工具中生效
5. 某些 AI 工具可能需要重启或刷新才能识别新技能
