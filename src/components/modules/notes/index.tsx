import { useState, useEffect, useMemo } from "react";
import { getAppleNotes, createAppleNote, updateAppleNote, type AppleNote, type AppleNotesResult } from "@/services/fs";
import { RefreshCw, Folder, FileText, X, Search, ChevronDown, Plus, Save } from "lucide-react";

const PAGE_SIZE = 20;

export default function NotesView() {
  const [allNotes, setAllNotes] = useState<AppleNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<AppleNote | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNewNote, setShowNewNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteBody, setNewNoteBody] = useState("");
  const [newNoteFolder, setNewNoteFolder] = useState("Notes");
  const [cachedNotes, setCachedNotes] = useState<AppleNote[] | null>(null);

  // 加载备忘录
  const loadNotes = async (query: string = "", offset: number = 0, append: boolean = false) => {
    // Use cache for non-search, initial loads
    if (!query && offset === 0 && !append && cachedNotes) {
      setAllNotes(cachedNotes);
      setTotal(cachedNotes.length);
      setHasMore(false);
      setLoading(false);
      return;
    }

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const result: AppleNotesResult = await getAppleNotes(query || undefined, offset, PAGE_SIZE);
      if (append) {
        setAllNotes(prev => [...prev, ...result.notes]);
      } else {
        setAllNotes(result.notes);
        // Cache the first load results
        if (!query && offset === 0) {
          setCachedNotes(result.notes);
        }
      }
      setTotal(result.total);
      setHasMore(result.has_more);
    } catch (e) {
      console.error("Failed to load notes:", e);
      const errMsg = e instanceof Error ? e.message : String(e);
      setError(`加载失败: ${errMsg}`);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // 首次加载
  useEffect(() => {
    loadNotes();
  }, []);

  // 搜索处理（防抖）
  useEffect(() => {
    const timer = setTimeout(() => {
      loadNotes(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 加载更多
  const loadMore = () => {
    if (!loadingMore && hasMore) {
      loadNotes(searchQuery, allNotes.length, true);
    }
  };

  // Save edited note
  const handleSaveNote = async () => {
    if (!selectedNote) return;
    setSaving(true);
    try {
      await updateAppleNote(selectedNote.id, editContent);
      // Update local state
      const updated = { ...selectedNote, content: editContent };
      setSelectedNote(updated);
      setAllNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
      setCachedNotes(null); // Invalidate cache
      setIsEditing(false);
    } catch (e) {
      alert("保存失败: " + e);
    } finally {
      setSaving(false);
    }
  };

  // Create new note
  const handleCreateNote = async () => {
    if (!newNoteTitle.trim()) return;
    setSaving(true);
    try {
      await createAppleNote(newNoteFolder, newNoteTitle, newNoteBody);
      setShowNewNote(false);
      setNewNoteTitle("");
      setNewNoteBody("");
      setCachedNotes(null); // Invalidate cache
      loadNotes(); // Reload
    } catch (e) {
      alert("创建失败: " + e);
    } finally {
      setSaving(false);
    }
  };

  // 按文件夹分组
  const notesByFolder = useMemo(() => {
    const groups: Record<string, AppleNote[]> = {};
    for (const note of allNotes) {
      const folder = note.folder || "默认";
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push(note);
    }
    return groups;
  }, [allNotes]);

  const folders = Object.keys(notesByFolder).sort();

  const displayNotes = selectedFolder
    ? notesByFolder[selectedFolder] || []
    : allNotes;

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="font-[var(--font-disp)] text-[28px] tracking-[3px] text-accent">
            备忘录
          </div>
          <span className="text-xs text-text-dim font-[var(--font-mono)]">
            {total} 条备忘录
          </span>
        </div>
        <button
          className="btn btn-primary text-xs px-3.5 py-1.5 flex items-center gap-1"
          onClick={() => setShowNewNote(true)}
        >
          <Plus size={14} /> 新建备忘录
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-[400px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            placeholder="搜索备忘录..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9 w-full"
          />
        </div>
        {searchQuery && (
          <span className="text-xs text-text-dim">
            搜索: "{searchQuery}"
          </span>
        )}
      </div>

      {/* Loading / Error states */}
      {loading && (
        <div className="flex items-center justify-center p-10">
          <RefreshCw size={24} className="animate-spin text-accent" />
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-[var(--radius)] text-red-500 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && allNotes.length === 0 && (
        <div className="flex flex-col items-center justify-center p-16 text-text-dim">
          <FileText size={48} className="mb-4 opacity-50" />
          <div>{searchQuery ? "没有找到匹配的备忘录" : "暂无备忘录"}</div>
        </div>
      )}

      {/* Main content */}
      {!loading && !error && allNotes.length > 0 && (
        <div className="flex gap-5 flex-1 overflow-hidden">
          {/* Folder sidebar */}
          <div className="w-[180px] shrink-0 flex flex-col gap-1">
            <div className="text-xs text-text-dim font-medium tracking-wider uppercase px-2.5 py-2">
              文件夹
            </div>
            <button
              onClick={() => setSelectedFolder(null)}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-[var(--radius-sm)] border-none cursor-pointer text-sm text-left w-full transition-all duration-200 ${
                selectedFolder === null ? "bg-cyan-500/10 text-accent" : "text-text-dim hover:bg-white/5 hover:translate-x-0.5"
              }`}
            >
              <Folder size={14} />
              <span className="flex-1">全部</span>
              <span className="text-xs opacity-60">{total}</span>
            </button>
            {folders.map((folder) => (
              <button
                key={folder}
                onClick={() => setSelectedFolder(folder)}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-[var(--radius-sm)] border-none cursor-pointer text-sm text-left w-full transition-all duration-200 ${
                  selectedFolder === folder ? "bg-cyan-500/10 text-accent" : "text-text-dim hover:bg-white/5 hover:translate-x-0.5"
                }`}
              >
                <Folder size={14} />
                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                  {folder}
                </span>
                <span className="text-xs opacity-60">
                  {notesByFolder[folder].length}
                </span>
              </button>
            ))}
          </div>

          {/* Notes grid */}
          <div className="flex-1 overflow-auto grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3 content-start pr-1">
            {displayNotes.map((note) => (
              <div
                key={note.id}
                onClick={() => setSelectedNote(note)}
                className="bg-panel2 border border-border rounded-[var(--radius)] p-3.5 cursor-pointer transition-all duration-200 hover:border-accent hover:-translate-y-1 hover:shadow-lg hover:shadow-accent/5 flex flex-col gap-2 group"
              >
                <div className="text-sm font-semibold text-text overflow-hidden text-ellipsis whitespace-nowrap">
                  {note.name}
                </div>
                <div className="text-xs text-text-dim overflow-hidden text-ellipsis line-clamp-3 leading-relaxed">
                  {note.content.slice(0, 150)}
                </div>
                <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
                  <span className="text-[10px] text-text-dim font-[var(--font-mono)]">
                    {note.folder}
                  </span>
                </div>
              </div>
            ))}

            {/* Load more button */}
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="col-span-full p-4 bg-transparent border border-dashed border-border rounded-[var(--radius)] text-sm flex items-center justify-center gap-2 transition-all duration-200 hover:border-accent hover:bg-accent/5 cursor-pointer disabled:cursor-wait"
              >
                {loadingMore ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    加载中...
                  </>
                ) : (
                  <>
                    加载更多 ({total - allNotes.length} 条剩余)
                    <ChevronDown size={16} />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Note detail modal */}
      {selectedNote && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-10"
          onClick={(e) => e.target === e.currentTarget && setSelectedNote(null)}
        >
          <div className="bg-panel border border-border rounded-[var(--radius)] w-full max-w-[700px] max-h-[80vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <FileText size={20} className="text-accent" />
                <div>
                  <div className="text-base font-semibold">{selectedNote.name}</div>
                  <div className="text-xs text-text-dim mt-0.5">
                    {selectedNote.folder}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedNote(null)}
                className="flex items-center justify-center w-8 h-8 bg-transparent border-none rounded-[var(--radius-sm)] text-text-dim cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-5">
              {isEditing ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-full min-h-[300px] bg-panel2 border border-border rounded-[var(--radius-sm)] p-3 text-sm leading-relaxed text-text resize-y font-inherit"
                />
              ) : (
                <div className="text-sm leading-relaxed whitespace-pre-wrap text-text">
                  {selectedNote.content || "（空备忘录）"}
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
              {isEditing ? (
                <>
                  <button
                    className="btn btn-ghost text-xs"
                    onClick={() => setIsEditing(false)}
                  >
                    取消
                  </button>
                  <button
                    className="btn btn-primary text-xs flex items-center gap-1"
                    onClick={handleSaveNote}
                    disabled={saving}
                  >
                    <Save size={14} />
                    {saving ? "保存中..." : "保存"}
                  </button>
                </>
              ) : (
                <button
                  className="btn btn-primary text-xs"
                  onClick={() => { setEditContent(selectedNote.content); setIsEditing(true); }}
                >
                  编辑
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New note modal */}
      {showNewNote && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-10"
          onClick={(e) => e.target === e.currentTarget && setShowNewNote(false)}
        >
          <div
            className="panel w-[500px] max-h-[70vh] flex flex-col overflow-hidden rounded-[var(--radius)]"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <span className="text-base font-semibold">新建备忘录</span>
              <button
                onClick={() => setShowNewNote(false)}
                className="bg-transparent border-none text-text-dim cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-3">
              <div>
                <label className="text-xs text-text-mid block mb-1">文件夹</label>
                <select
                  className="input w-full"
                  value={newNoteFolder}
                  onChange={(e) => setNewNoteFolder(e.target.value)}
                >
                  {folders.length > 0 ? folders.map(f => (
                    <option key={f} value={f}>{f}</option>
                  )) : <option value="Notes">Notes</option>}
                </select>
              </div>
              <div>
                <label className="text-xs text-text-mid block mb-1">标题</label>
                <input
                  className="input w-full"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  placeholder="备忘录标题"
                />
              </div>
              <div>
                <label className="text-xs text-text-mid block mb-1">内容</label>
                <textarea
                  className="input w-full resize-y"
                  value={newNoteBody}
                  onChange={(e) => setNewNoteBody(e.target.value)}
                  placeholder="备忘录内容..."
                  rows={8}
                />
              </div>
              <div className="flex gap-2 mt-1">
                <button
                  className="btn btn-primary flex-1"
                  onClick={handleCreateNote}
                  disabled={saving || !newNoteTitle.trim()}
                >
                  {saving ? "创建中..." : "创建"}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowNewNote(false)}>取消</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
