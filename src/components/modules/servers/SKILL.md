---
name: 服务器管理
description: 用于管理 SSH 服务器连接信息的斜杠命令技能。当用户使用 /服务器 命令或提及 SSH、服务器连接时触发此技能。
---

# 服务器管理技能

此技能用于通过 AI 辅助管理 LifeOS 中的 SSH 服务器连接信息。

## 触发条件

- 用户输入 `/服务器` 或 `/server`
- 用户提及 "SSH"、"服务器"、"连接服务器"
- 用户要求查看或管理服务器信息

## 可用命令

### 添加服务器

```
/服务器 添加 [名称]
```

示例：
```
/服务器 添加 生产服务器
```

AI 会引导用户输入：
- 主机地址 (Host)
- 端口 (Port，默认 22)
- 用户名 (Username)
- 认证方式（密钥/密码/两者）
- 密钥路径或密码
- 标签（可选）
- 备注（可选）

### 查看服务器列表

```
/服务器 列表
/服务器 查看所有服务器
```

### 搜索服务器

```
/服务器 搜索 [关键词]
/服务器 查找标签为 [标签名] 的服务器
```

### 生成 SSH 连接命令

```
/服务器 连接 [服务器名称]
```

AI 会生成对应的 SSH 连接命令供用户复制使用。

### 删除服务器

```
/服务器 删除 [服务器名称]
```

### 更新服务器信息

```
/服务器 编辑 [服务器名称]
```

## 数据存储

### 服务器文件路径

```
{vault}/.lifeos/servers/{server-slug}.md
```

### Frontmatter 格式

```yaml
---
id: srv-1234567890
name: 生产服务器
host: 192.168.1.100
port: 22
username: root
authType: key
privateKeyPath: ~/.ssh/id_rsa
publicKeyPath: ~/.ssh/id_rsa.pub
password: optional_password
tags: 生产,Web,数据库
notes: 这是一个重要服务器
created: 2025-01-15
updated: 2025-01-20
---
```

### 认证类型

1. **key** - 仅使用 SSH 密钥认证
2. **password** - 仅使用密码认证
3. **both** - 同时支持密钥和密码

## AI 操作指南

### 读取服务器列表

使用 `listNotes("{vault}/.lifeos/servers", false)` 读取所有服务器文件，解析 frontmatter 获取服务器信息。

### 搜索服务器

根据名称或标签筛选服务器列表，匹配关键词。

### 创建/更新服务器

使用 `writeNote` 写入或更新服务器文件，路径为 `{vault}/.lifeos/servers/{slug}.md`，其中 slug 是服务器名称的小写连字符形式。

### 删除服务器

使用 `deleteFile` 删除对应的服务器文件。

### 生成 SSH 连接命令

根据服务器的认证方式生成正确的 SSH 命令：

**密钥认证：**
```bash
ssh -i ~/.ssh/id_rsa -p 22 user@host
```

**密码认证：**
```bash
ssh -p 22 user@host
```

## 注意事项

1. 服务器信息包含敏感信息（密码、密钥路径），AI 操作时应谨慎处理
2. 文件名使用服务器名称的小写连字符形式（slug）
3. 标签使用逗号分隔存储，使用时需 split 处理
4. 每次更新服务器信息会自动更新 `updated` 字段
5. 生成 SSH 连接命令时，默认不显示密码，由用户在终端输入
