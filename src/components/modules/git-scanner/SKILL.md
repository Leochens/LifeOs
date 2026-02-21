---
name: Git仓库扫描器
description: 用于扫描和管理本地 Git 仓库的斜杠命令技能。当用户使用 /git 命令或提及仓库扫描时触发此技能。
---

# Git 仓库扫描器技能

此技能用于扫描本地目录发现所有 Git 仓库，并追踪其状态，帮助管理多个项目。

## 触发条件

- 用户输入 `/git` 或 `/扫描`
- 用户提及 "git 仓库"、"扫描仓库"、"未提交改动"
- 用户想要查找所有本地 Git 仓库

## 可用命令

### 扫描仓库

```
/git 扫描 [路径] [深度]
```

示例：
```
/git 扫描 /Users/username/projects 5
/git 扫描 ~/code 3
```

### 查看仓库状态

```
/git 状态
/git 有改动的仓库
/git 干净的仓库
```

### 打开仓库

```
/git 打开 [仓库名]
/git 在Finder中打开 [路径]
```

### 仓库统计

```
/git 统计
/git 按分支分组
/git 按状态分组
```

## 仓库信息

扫描后会获取以下信息：

| 字段 | 描述 |
|------|------|
| name | 仓库名称 |
| path | 本地路径 |
| branch | 当前分支 |
| has_uncommitted | 是否有未提交改动 |
| last_commit | 最后一次提交信息 |
| remote_url | 远程仓库地址 |

## 数据格式

### 仓库对象

```typescript
{
  name: string;
  path: string;
  branch: string;
  has_uncommitted: boolean;
  last_commit?: string;
  remote_url?: string;
}
```

## AI 操作指南

### 执行扫描

使用 `scanGitRepos(rootPath, maxDepth)` 扫描指定路径：

```typescript
const repos = await scanGitRepos("/Users/username/projects", 5);
```

### 选择文件夹

使用 `pickVaultFolder()` 打开文件夹选择对话框：

```typescript
const folder = await pickVaultFolder();
if (folder) {
  // 使用用户选择的路径进行扫描
}
```

### 打开仓库

使用 `openInFinder(repoPath)` 在系统文件管理器中打开仓库。

## 过滤选项

- **all** - 显示所有仓库
- **clean** - 仅显示无改动的仓库
- **dirty** - 仅显示有未提交改动的仓库

## 扫描深度

扫描深度控制遍历子目录的层级：

- **深度 3** - 适合扁平结构的项目目录
- **深度 5** - 默认深度，适合大多数情况
- **深度 8** - 深度嵌套的项目结构

## 仓库健康度建议

### 干净仓库
- 状态：无未提交改动
- 建议：保持良好的提交习惯

### 有改动仓库
- 状态：存在未提交改动
- 建议：及时提交或创建暂存分支

### 分支管理
- main/master 分支应保持稳定
- 使用清晰的分支命名规范（feature/xxx, bugfix/xxx）

### 提交频率
- 活跃项目：最近 7 天内有提交
- 注意项目：最近 30 天内有提交
- 长期未动：超过 90 天无提交

## 注意事项

1. 扫描可能需要一些时间，取决于目录大小
2. 深度过大会增加扫描时间
3. 仓库路径信息可用于复制粘贴到终端
4. 无远程配置的仓库需要注意本地备份
