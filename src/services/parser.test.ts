import { describe, it, expect } from 'vitest'
import { parseTasks, serializeTasks, parseDayNote, serializeDayNote } from './parser'

describe('parser', () => {
  describe('parseTasks', () => {
    it('should parse completed task', () => {
      const content = '- [x] 完成项目'
      const tasks = parseTasks(content)
      expect(tasks).toHaveLength(1)
      expect(tasks[0].done).toBe(true)
      expect(tasks[0].text).toBe('完成项目')
    })

    it('should parse incomplete task', () => {
      const content = '- [ ] 待办事项'
      const tasks = parseTasks(content)
      expect(tasks).toHaveLength(1)
      expect(tasks[0].done).toBe(false)
      expect(tasks[0].text).toBe('待办事项')
    })

    it('should parse task with tags', () => {
      const content = '- [ ] 任务 #work #important'
      const tasks = parseTasks(content)
      expect(tasks[0].tags).toContain('work')
      expect(tasks[0].tags).toContain('important')
    })

    it('should parse task with time', () => {
      const content = '- [ ] 会议 ⏰14:00'
      const tasks = parseTasks(content)
      expect(tasks[0].time).toBe('14:00')
    })

    it('should return empty array for no tasks', () => {
      const content = '这是一段普通文本'
      const tasks = parseTasks(content)
      expect(tasks).toHaveLength(0)
    })
  })

  describe('serializeTasks', () => {
    it('should update task status', () => {
      const tasks = [
        { id: 'task-0', text: '任务1', done: true, tags: [], time: undefined },
        { id: 'task-1', text: '任务2', done: false, tags: [], time: undefined }
      ]
      const existing = '- [ ] 任务1\n- [ ] 任务2'
      const result = serializeTasks(tasks, existing)
      expect(result).toContain('- [x] 任务1')
      expect(result).toContain('- [ ] 任务2')
    })

    it('should preserve tags and time', () => {
      const tasks = [
        { id: 'task-0', text: '会议', done: true, tags: ['工作'], time: '14:00' }
      ]
      const existing = '- [ ] 会议'
      const result = serializeTasks(tasks, existing)
      expect(result).toContain('#工作')
      expect(result).toContain('⏰14:00')
    })
  })

  describe('parseDayNote', () => {
    it('should parse day note with tasks', () => {
      const path = '/vault/daily/2024-01-15.md'
      const frontmatter = { date: '2024-01-15', energy: 'high', mood: '😊' }
      // Test content with tasks only (no section headers)
      const content = '- [ ] 完成任务1\n- [x] 完成任务2'
      const note = parseDayNote(path, frontmatter, content)
      expect(note.date).toBe('2024-01-15')
      expect(note.energy).toBe('high')
      expect(note.mood).toBe('😊')
      expect(note.tasks).toHaveLength(2)
    })

    it('should handle missing frontmatter', () => {
      const path = '/vault/daily/tasks/2024-01-15.md'
      const frontmatter = {}
      const content = '- [ ] 任务'
      const note = parseDayNote(path, frontmatter, content)
      expect(note.energy).toBe('high')
      expect(note.mood).toBe('😊')
    })
  })

  describe('serializeDayNote', () => {
    it('should serialize day note correctly', () => {
      const note = {
        date: '2024-01-15',
        energy: 'medium',
        mood: '😐',
        tasks: [
          { id: 'task-0', text: '任务1', done: false, tags: [], time: undefined }
        ],
        notes: '一些笔记',
        path: '/vault/daily/2024-01-15.md'
      }
      const result = serializeDayNote(note)
      expect(result.frontmatter.date).toBe('2024-01-15')
      expect(result.content).toContain('- [ ] 任务1')
      expect(result.content).toContain('## 今日任务')
      expect(result.content).toContain('## 今日笔记')
    })
  })
})
