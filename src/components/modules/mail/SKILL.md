---
name: 邮箱
description: 用于管理 LifeOS 多邮箱账户的斜杠命令技能。当用户使用 /邮箱 命令或提及邮件、收发邮件时触发此技能。
---

# 邮箱技能

此技能用于通过 AI 辅助管理 LifeOS 多邮箱账户，支持 IMAP/POP3 协议同步和邮件收发。

## 触发条件

- 用户输入 `/邮箱`
- 用户提及 "邮件"、"收邮件"、"发邮件"、"同步邮件"
- 用户要求查看或管理邮箱账户

## 可用命令

### 添加邮箱账户

```
/邮箱 添加账户 [账户名称] [邮箱地址]
```

示例：
```
/邮箱 添加账户 "工作邮箱" "work@example.com"
/邮箱 添加账户 "QQ邮箱" "my@qq.com"
```

### 同步邮件

```
/邮箱 同步 [账户名称]
/邮箱 同步 [账户名称] [文件夹]
```

示例：
```
/邮箱 同步 "工作邮箱"
/邮箱 同步 "QQ邮箱" "INBOX"
/邮箱 同步全部
```

### 查看邮件

```
/邮箱 查看邮件
/邮箱 查看 [账户名称] 的邮件
/邮箱 查看 [账户名称] [文件夹]
```

### 发送邮件

```
/邮箱 发送邮件 [收件人] [主题] [内容]
```

示例：
```
/邮箱 发送邮件 "recipient@example.com" "项目进度" "本周已完成..."
```

### 搜索邮件

```
/邮箱 搜索 [关键词]
/邮箱 在 [账户名称] 中搜索 [关键词]
```

### 管理账户

```
/邮箱 禁用账户 [账户名称]
/邮箱 启用账户 [账户名称]
/邮箱 删除账户 [账户名称]
```

## 数据存储

### 账户文件路径

```
{vault}/emails/{account-slug}.md
```

### Frontmatter 格式（账户）

```yaml
---
id: email-1234567890
name: 工作邮箱
email: work@example.com
protocol: imap
imapHost: imap.example.com
imapPort: "993"
smtpHost: smtp.example.com
smtpPort: "587"
username: work@example.com
password: encrypted_password
authType: password
folders: INBOX,Sent,Draft,Trash,Archive
enabled: "true"
lastSync: 2025-01-15T10:30:00
---
```

### 邮件缓存路径

```
{vault}/emails/cache/{folder}/{message-id}.json
```

## 常见邮箱配置

### 163 邮箱
- IMAP: `imap.163.com:993`
- SMTP: `smtp.163.com:465`
- 需要开启 IMAP/SMTP 服务并使用授权密码

### QQ 邮箱
- IMAP: `imap.qq.com:993`
- SMTP: `smtp.qq.com:465`
- 需要开启 IMAP/SMTP 服务并生成授权码

### Gmail
- IMAP: `imap.gmail.com:993`
- SMTP: `smtp.gmail.com:587`
- 需要开启两步验证并使用应用专用密码

### Outlook/Hotmail
- IMAP: `outlook.office365.com:993`
- SMTP: `smtp.office365.com:587`

## 支持的协议

### IMAP (推荐)
- 实时同步
- 支持文件夹管理
- 双向状态同步

### POP3
- 仅收件箱同步
- 适合简单场景

## AI 操作指南

### 读取账户列表

使用 `listNotes("{vault}/emails", false)` 读取所有账户文件，解析 frontmatter 获取账户信息。

### 同步邮件

使用 `imapSync()` 发起 IMAP/POP3 同步请求，同步完成后使用 `getCachedEmails()` 读取缓存的邮件。

### 发送邮件

使用 `sendEmail()` 发送邮件，需要配置 SMTP 服务器信息。

### 创建/更新账户

使用 `writeNote()` 写入账户配置文件，路径为 `{vault}/emails/{account-slug}.md`。

## 注意事项

1. 账户文件使用 Markdown + frontmatter 格式
2. 密码存储在 frontmatter 中，实际应用中应考虑加密
3. 同步操作可能需要较长时间，建议显示加载状态
4. 不同邮箱服务商的配置要求不同，需要引导用户正确配置
5. 发件前必须配置 SMTP 服务器信息
