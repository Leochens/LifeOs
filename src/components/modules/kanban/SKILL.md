---
name: 看板
description: 用于管理 LifeOS 项目看板模块的斜杠命令技能。当用户使用 /看板 命令或提及项目、看板、任务管理时触发此技能。
---

# 看板技能

此技能用于通过 AI 辅助管理 LifeOS 项目看板。

## 触发条件

- 用户输入 `/看板`
- 用户提及 "创建项目"、"删除项目"、"查看任务"
- 用户要求分析项目进度

## 可用命令

### 创建新项目

```
/看板 创建项目 [项目名称]
```

示例：
```
/看板 创建项目 "个人博客重构"
```

### 删除项目

```
/看板 删除项目 [项目名称]
```

### 查看项目状态

```
/看板 查看所有项目
/看板 查看 [项目名称] 的任务
```

### 创建任务

```
/看板 在 [项目名称] 创建任务 [任务内容]
```

### 完成/取消任务

```
/看板 完成 [项目名称] 的任务 [任务内容]
```

### 查看进度

```
/看板 查看 [项目名称] 进度
/看板 项目统计
```

## 数据存储

### 项目文件路径

```
{vault}/projects/{status}/{project-slug}.md
```

状态目录：
- `backlog` - 待规划
- `todo` - 计划中
- `active` - 进行中
- `paused` - 暂停
- `done` - 已完成

### Frontmatter 格式

```yaml
---
title: 项目标题
status: backlog | todo | active | paused | done
priority: low | medium | high | urgent
created: 2025-01-01
updated: 2025-01-15
progress: 0-100
tags: 标签1, 标签2
due: 2025-12-31
---
```

### Markdown 任务格式

```markdown
## 任务

- [ ] 任务1
- [x] 任务2
- [ ] 任务3
```

## AI 操作指南

### 读取项目列表

```python
import os
from pathlib import Path
import yaml

vault_path = "/path/to/vault"
projects_dir = f"{vault_path}/projects"

projects = []
for status in ["backlog", "todo", "active", "paused", "done"]:
    status_dir = Path(f"{projects_dir}/{status}")
    if status_dir.exists():
        for md_file in status_dir.glob("*.md"):
            with open(md_file) as f:
                content = f.read()
                # 解析 frontmatter
                # ...
                projects.append({"title": ..., "status": status, ...})
```

### 创建新项目

```python
def create_project(vault_path, title, priority="medium", tags=""):
    slug = title.lower().replace(" ", "-")
    status = "backlog"
    path = f"{vault_path}/projects/{status}/{slug}.md"

    content = f"""---
title: {title}
status: {status}
priority: {priority}
created: {today}
updated: {today}
progress: 0
tags: {tags}
---

## 目标

{title}

## 任务

- [ ]

## 笔记

"""
    with open(path, "w") as f:
        f.write(content)
```

### 更新任务状态

```python
def toggle_task(project_path, task_text):
    with open(project_path) as f:
        content = f.read()

    # 查找并切换任务状态
    if f"- [ ] {task_text}" in content:
        content = content.replace(f"- [ ] {task_text}", f"- [x] {task_text}")
    elif f"- [x] {task_text}" in content:
        content = content.replace(f"- [x] {task_text}", f"- [ ] {task_text}")

    with open(project_path, "w") as f:
        f.write(content)
```

## 注意事项

1. 项目文件使用 Markdown 格式
2. 任务使用 `- [ ]` 和 `- [x]` 标记未完成/已完成
3. 移动项目需要同时更新文件路径和 frontmatter 中的 status 字段
4. 看板配置存储在 `.lifeos/board.yaml`
