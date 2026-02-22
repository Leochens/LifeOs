import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './app'

describe('app store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useStore.setState({
      vaultPath: null,
      currentView: 'dashboard',
      theme: 'dark',
      projects: [],
      goals: [],
      decisions: [],
      stickyNotes: [],
      skills: [],
      gitRepos: [],
      scheduledTasks: [],
      emailAccounts: [],
      emails: [],
      financePersons: [],
      financeRecords: [],
      subscriptions: [],
      isLoading: false,
      cmdPaletteOpen: false,
    })
  })

  describe('navigation', () => {
    it('should set current view', () => {
      const { setView } = useStore.getState()
      setView('daily')
      expect(useStore.getState().currentView).toBe('daily')
    })

    it('should set vault path', () => {
      const { setVaultPath } = useStore.getState()
      setVaultPath('/test/vault')
      expect(useStore.getState().vaultPath).toBe('/test/vault')
    })
  })

  describe('projects', () => {
    it('should set projects', () => {
      const projects = [
        { path: '/test/project1.md', title: 'Project 1', status: 'active' as const, priority: 'high' as const, tags: [], progress: 0, content: '' }
      ]
      useStore.getState().setProjects(projects)
      expect(useStore.getState().projects).toHaveLength(1)
    })

    it('should upsert project', () => {
      const project = { path: '/test/project1.md', title: 'Project 1', status: 'active' as const, priority: 'high' as const, tags: [], progress: 0, content: '' }
      useStore.getState().upsertProject(project)
      expect(useStore.getState().projects).toHaveLength(1)

      // Upsert again should update
      const updated = { ...project, title: 'Updated Project' }
      useStore.getState().upsertProject(updated)
      expect(useStore.getState().projects).toHaveLength(1)
      expect(useStore.getState().projects[0].title).toBe('Updated Project')
    })
  })

  describe('sticky notes', () => {
    it('should set sticky notes', () => {
      const notes = [
        { id: '1', content: 'Note 1', color: 'yellow', x: 0, y: 0 }
      ]
      useStore.getState().setStickyNotes(notes)
      expect(useStore.getState().stickyNotes).toHaveLength(1)
    })

    it('should upsert sticky note', () => {
      const note = { id: '1', content: 'New Note', color: 'yellow', x: 0, y: 0 }
      useStore.getState().upsertStickyNote(note)
      expect(useStore.getState().stickyNotes).toHaveLength(1)

      // Upsert with same id should update
      const updated = { ...note, content: 'Updated Note' }
      useStore.getState().upsertStickyNote(updated)
      expect(useStore.getState().stickyNotes).toHaveLength(1)
      expect(useStore.getState().stickyNotes[0].content).toBe('Updated Note')
    })

    it('should delete sticky note', () => {
      const note = { id: '1', content: 'Note', color: 'yellow', x: 0, y: 0 }
      useStore.getState().upsertStickyNote(note)
      expect(useStore.getState().stickyNotes).toHaveLength(1)

      useStore.getState().deleteStickyNote('1')
      expect(useStore.getState().stickyNotes).toHaveLength(0)
    })
  })

  describe('UI state', () => {
    it('should toggle loading state', () => {
      useStore.getState().setLoading(true)
      expect(useStore.getState().isLoading).toBe(true)
    })

    it('should toggle command palette', () => {
      useStore.getState().setCmdPalette(true)
      expect(useStore.getState().cmdPaletteOpen).toBe(true)
    })
  })
})
