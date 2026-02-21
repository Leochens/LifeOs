---
name: 备忘录
description: 用于管理 Apple Notes 备忘录的斜杠命令技能。当用户使用 /备忘录 命令或提及笔记、备忘时触发此技能。
---

# 备忘录技能

此技能用于通过 AI 辅助管理 Apple Notes 备忘录，支持查看、编辑和创建备忘录。

## 触发条件

- 用户输入 `/备忘录`
- 用户提及 "备忘录"、"笔记"、"Apple Notes"
- 用户要求记录、查看或编辑备忘内容

## 可用命令

### 查看备忘录

```
/备忘录 列表
/备忘录 查看 [文件夹]
/备忘录 搜索 [关键词]
```

示例：
```
/备忘录 列表
/备忘录 查看 "工作"
/备忘录 搜索 "会议记录"
```

### 创建备忘录

```
/备忘录 创建 [标题] [内容]
/备忘录 新建 [文件夹] [标题] [内容]
```

示例：
```
/备忘录 创建 "购物清单" "牛奶、鸡蛋、面包"
/备忘录 新建 "工作" "会议记录" "今天讨论了..."
```

### 编辑备忘录

```
/备忘录 编辑 [备忘录ID] [新内容]
/备忘录 追加 [备忘录ID] [内容]
```

### 按文件夹浏览

```
/备忘录 文件夹
/备忘录 文件夹列表
```

## 数据存储

### 备忘录数据来源

- 使用 macOS Apple Notes 框架读取系统备忘录
- 数据来源于用户本地 Apple Notes 数据库
- 支持缓存以提升加载速度

### 备忘录属性

```typescript
interface AppleNote {
  id: string;           // 备忘录唯一标识
  name: string;         // 备忘录标题
  folder: string;       // 所属文件夹
  content: string;      // 备忘录内容
  modifiedAt: string;   // 修改时间
}
```

## API 操作

### 读取备忘录列表

```typescript
const result = await getAppleNotes(query?, offset, limit);
// 返回: { notes: AppleNote[], total: number, has_more: boolean }
```

### 创建备忘录

```typescript
await createAppleNote(folder, title, body);
```

### 更新备忘录

```typescript
await updateAppleNote(noteId, content);
```

## 使用场景

### 快速记录
- 购物清单
- 待办事项
- 临时笔记
- 灵感记录

### 知识管理
- 工作笔记
- 学习笔记
- 项目文档
- 会议记录

### 生活管理
- 日记记录
- 旅行计划
- 书单/影单
- 健康记录

## AI 操作指南

### 搜索备忘录

使用 `getAppleNotes()` 方法传入搜索关键词，支持标题和内容全文搜索。

### 分页加载

使用 `offset` 和 `limit` 参数实现分页加载，建议每页 20 条。

### 缓存策略

- 首次加载后缓存结果
- 搜索时禁用缓存
- 创建/更新后清除缓存

## 注意事项

1. 备忘录数据来源于 Apple Notes，需要 macOS 系统权限
2. 首次加载可能较慢，建议显示加载动画
3. 搜索支持中文和英文关键词
4. 备忘录内容可能很长，显示时建议截取预览
5. 文件夹名称由系统决定，支持动态获取
6. 创建备忘录需要指定文件夹
