---
name: 定时任务
description: 用于管理 macOS launchd 定时任务的斜杠命令技能。当用户使用 /定时 或 /任务 命令时触发此技能。
---

# 定时任务技能

此技能用于通过 AI 辅助管理 macOS launchd 定时任务，支持创建、删除和管理定时执行的脚本和程序。

## 触发条件

- 用户输入 `/定时` 或 `/任务`
- 用户提及 "定时任务"、"计划任务"、"自动执行"
- 用户要求设置周期性执行的命令

## 可用命令

### 创建定时任务

```
/任务 创建 [任务名称] [执行命令] [间隔]
/定时 新建 [任务名称] 每小时/每天/每周 [命令]
```

示例：
```
/任务 创建 "每日备份" "cp -r ~/vault ~/vault_backup" 每天
/定时 新建 "提醒喝水" 每小时 "display notification '该喝水了'"
/任务 创建 "同步邮件" 每分钟 "python3 ~/scripts/sync_mail.py"
```

### 查看任务列表

```
/任务 列表
/定时 查看所有
/任务 查看已启用
```

### 删除任务

```
/任务 删除 [任务名称]
/定时 移除 [任务ID]
```

### 快速创建预设任务

```
/任务 预设 备份
/任务 预设 提醒
```

## 数据存储

### Launchd Plist 文件路径

```
~/Library/LaunchAgents/com.lifeos.{task-label}.plist
```

### 任务配置格式

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.lifeos.task-name</string>
    <key>ProgramArguments</key>
    <array>
        <string>/path/to/program</string>
        <string>arg1</string>
        <string>arg2</string>
    </array>
    <key>StartInterval</key>
    <integer>3600</integer>
    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>
```

## 任务属性

### 任务数据结构

```typescript
interface ScheduledTask {
  id: string;              // 任务唯一标识 (com.lifeos.xxx)
  label: string;           // 任务显示名称
  program: string;         // 执行程序路径
  args: string[];          // 命令参数
  interval_seconds: number; // 执行间隔（秒）
  enabled: boolean;        // 是否启用
}
```

## 间隔时间说明

### 秒级间隔
- 适合高频任务
- 最小值：1 秒
- 示例：每 60 秒

### 分钟级间隔
- 常用场景
- 示例：每 5 分钟、每 30 分钟

### 小时间隔
- 日常任务
- 示例：每小时、每 6 小时

### 天级间隔
- 每天 86400 秒
- 适合每日备份、日报

## 常见任务类型

### 备份任务
- 频率：每天到每小时
- 优先级：高
- 示例：备份 Vault、数据库备份

### 提醒任务
- 频率：每小时
- 优先级：中
- 示例：休息提醒、喝水提醒

### 同步任务
- 频率：每分钟到每小时
- 优先级：中
- 示例：邮件同步、数据同步

### 维护任务
- 频率：每周到每月
- 优先级：低
- 示例：清理缓存、日志归档

## API 操作

### 创建任务

```typescript
await createLaunchdTask(task);
```

### 列出任务

```typescript
const tasks = await listLaunchdTasks();
```

### 删除任务

```typescript
await deleteLaunchdTask(taskId);
```

## 预设模板

### 每日备份 Vault
```bash
/bin/sh -c "cp -r ~/vault ~/vault_backup"
```
间隔：86400 秒（1 天）

### 每小时提醒
```bash
/usr/bin/osascript -e 'display notification "该休息了" with title "Life OS"'
```
间隔：3600 秒（1 小时）

## AI 操作指南

### 生成任务 ID

使用以下格式生成唯一的任务 ID：
```
com.lifeos.{slug}.{timestamp}
```

### 验证命令

在创建任务前，验证以下内容：
1. 程序路径是否存在
2. 参数格式是否正确
3. 间隔时间是否合理

### 间隔时间转换

```
小时 × 3600 = 秒
分钟 × 60 = 秒
```

## 注意事项

1. **仅支持 macOS**: 定时任务使用 launchd，仅适用于 macOS 系统
2. **权限要求**: 某些任务可能需要管理员权限
3. **路径问题**: 建议使用绝对路径
4. **任务持久化**: 任务会被写入系统 launchd，重启后自动执行
5. **调试建议**: 创建任务前建议先手动测试命令
6. **删除确认**: 删除任务会停止定时执行，需要确认
7. **资源占用**: 避免创建过于频繁的任务以免影响系统性能
