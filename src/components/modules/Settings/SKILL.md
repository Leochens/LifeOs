---
name: 设置
description: 用于管理 LifeOS 系统设置的斜杠命令技能。当用户使用 /设置 命令或要求修改系统配置时触发此技能。
---

# 设置技能

此技能用于通过 AI 辅助管理 LifeOS 的系统设置，包括 Vault 路径、主题定制、菜单管理等。

## 触发条件

- 用户输入 `/设置` 或 `/settings`
- 用户提及 "修改设置"、"更改主题"、"管理菜单"
- 用户要求配置系统或应用选项

## 可用命令

### Vault 路径管理

```
/设置 查看 Vault 路径
/设置 修改 Vault 路径
/设置 在 Finder 中打开 Vault
```

### 主题定制

```
/设置 更改主题 [主题名称]
/设置 修改主色调
/设置 调整字体大小
/设置 重置主题
```

### 菜单管理

```
/设置 添加菜单项 [名称]
/设置 删除菜单项 [名称]
/设置 调整菜单顺序
/设置 查看当前菜单
```

### AI Skills 管理

```
/设置 重新生成 Skills
/设置 刷新 AI 命令
```

### Claude Code 配置

```
/设置 启用 Claude Code
/设置 禁用 Claude Code
/设置 设置 Claude Code 路径 [路径]
```

## 数据存储

### 设置文件路径

```
{vault}/.lifeos/settings/
```

### 主题配置文件

```yaml
---
theme: dark
primaryColor: "#00c8ff"
fontSize: medium
borderRadius: 4
---
```

### 菜单配置文件

```yaml
---
items:
  - id: kanban
    name: 看板
    icon: LayoutGrid
    order: 1
  - id: diary
    name: 日记
    icon: Book
    order: 2
---
```

## AI 操作指南

### 读取当前设置

使用 `readFile` 读取设置目录下的配置文件。

### 更新设置

使用 `writeFile` 更新对应的配置文件。

### 重新生成 Skills

调用 `regenerateSkills(vaultPath)` 重新生成 AI 斜杠命令技能文档。

### 切换 Vault 路径

1. 调用 `pickVaultFolder()` 让用户选择新路径
2. 调用 `initVault(path)` 初始化新 Vault（迁移数据）
3. 调用 `saveVaultPath(path)` 保存新路径
4. 更新 store 中的 `vaultPath`

## 可用主题

- **dark** - 深色主题（默认）
- **light** - 浅色主题
- **midnight** - 午夜主题

## 主色调选项

- `#00c8ff` - 青色（默认）
- `#a78bfa` - 紫色
- `#34d399` - 绿色
- `#f472b6` - 粉色
- `#fbbf24` - 橙色

## 字体大小

- `small` - 小
- `medium` - 中（默认）
- `large` - 大
- `xlarge` - 特大

## 注意事项

1. 修改 Vault 路径前需确认用户是否需要迁移数据
2. 主题更改会立即生效，无需重启应用
3. 菜单顺序使用 `order` 字段控制，数字越小越靠前
4. 重新生成 Skills 会覆盖现有的技能文档
5. Claude Code 路径默认为 `claude`，如安装在不同位置需手动配置
