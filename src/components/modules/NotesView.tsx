import { useState, useEffect, useMemo } from "react";
import { getAppleNotes, type AppleNote, type AppleNotesResult } from "@/services/tauri";
import { RefreshCw, Folder, FileText, X, Search, ChevronDown } from "lucide-react";

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

  // 加载备忘录
  const loadNotes = async (query: string = "", offset: number = 0, append: boolean = false) => {
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
    <div style={{ display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontFamily: "var(--font-disp)", fontSize: 28, letterSpacing: 3, color: "var(--accent)" }}>
            备忘录
          </div>
          <span style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            {total} 条备忘录
          </span>
        </div>
      </div>

      {/* Search */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 400 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }} />
          <input
            type="text"
            placeholder="搜索备忘录..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input"
            style={{ paddingLeft: 36, width: "100%" }}
          />
        </div>
        {searchQuery && (
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
            搜索: "{searchQuery}"
          </span>
        )}
      </div>

      {/* Loading / Error states */}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
          <RefreshCw size={24} style={{ animation: "spin 1s linear infinite", color: "var(--accent)" }} />
        </div>
      )}

      {error && (
        <div style={{
          padding: 16,
          background: "rgba(255,80,80,0.1)",
          border: "1px solid rgba(255,80,80,0.3)",
          borderRadius: "var(--radius)",
          color: "#ff5050",
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {!loading && !error && allNotes.length === 0 && (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 60,
          color: "var(--text-dim)",
        }}>
          <FileText size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
          <div>{searchQuery ? "没有找到匹配的备忘录" : "暂无备忘录"}</div>
        </div>
      )}

      {/* Main content */}
      {!loading && !error && allNotes.length > 0 && (
        <div style={{ display: "flex", gap: 20, flex: 1, overflow: "hidden" }}>
          {/* Folder sidebar */}
          <div style={{
            width: 180,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}>
            <div style={{
              fontSize: 11,
              color: "var(--text-dim)",
              fontWeight: 500,
              letterSpacing: 1,
              padding: "8px 10px",
              textTransform: "uppercase",
            }}>
              文件夹
            </div>
            <button
              onClick={() => setSelectedFolder(null)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                background: selectedFolder === null ? "rgba(0,200,255,0.1)" : "transparent",
                border: "none",
                borderRadius: "var(--radius-sm)",
                color: selectedFolder === null ? "var(--accent)" : "var(--text-dim)",
                cursor: "pointer",
                fontSize: 13,
                textAlign: "left",
                width: "100%",
              }}
            >
              <Folder size={14} />
              <span style={{ flex: 1 }}>全部</span>
              <span style={{ fontSize: 11, opacity: 0.6 }}>{total}</span>
            </button>
            {folders.map((folder) => (
              <button
                key={folder}
                onClick={() => setSelectedFolder(folder)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  background: selectedFolder === folder ? "rgba(0,200,255,0.1)" : "transparent",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  color: selectedFolder === folder ? "var(--accent)" : "var(--text-dim)",
                  cursor: "pointer",
                  fontSize: 13,
                  textAlign: "left",
                  width: "100%",
                  transition: "all 0.15s",
                }}
              >
                <Folder size={14} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {folder}
                </span>
                <span style={{ fontSize: 11, opacity: 0.6 }}>
                  {notesByFolder[folder].length}
                </span>
              </button>
            ))}
          </div>

          {/* Notes grid */}
          <div style={{
            flex: 1,
            overflow: "auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 12,
            alignContent: "start",
            paddingRight: 4,
          }}>
            {displayNotes.map((note) => (
              <div
                key={note.id}
                onClick={() => setSelectedNote(note)}
                style={{
                  background: "var(--panel2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: 14,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {note.name}
                </div>
                <div style={{
                  fontSize: 12,
                  color: "var(--text-dim)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  lineHeight: 1.5,
                }}>
                  {note.content.slice(0, 150)}
                </div>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: "auto",
                  paddingTop: 8,
                  borderTop: "1px solid var(--border)",
                }}>
                  <span style={{
                    fontSize: 10,
                    color: "var(--text-dim)",
                    fontFamily: "var(--font-mono)",
                  }}>
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
                style={{
                  gridColumn: "1 / -1",
                  padding: 16,
                  background: "transparent",
                  border: "1px dashed var(--border)",
                  borderRadius: "var(--radius)",
                  color: loadingMore ? "var(--accent)" : "var(--text-dim)",
                  cursor: loadingMore ? "wait" : "pointer",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "all 0.15s",
                }}
              >
                {loadingMore ? (
                  <>
                    <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />
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
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 40,
          }}
          onClick={(e) => e.target === e.currentTarget && setSelectedNote(null)}
        >
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              width: "100%",
              maxWidth: 700,
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <FileText size={20} color="var(--accent)" />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{selectedNote.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                    {selectedNote.folder}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedNote(null)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  background: "transparent",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text-dim)",
                  cursor: "pointer",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div style={{
              flex: 1,
              overflow: "auto",
              padding: 20,
              fontSize: 14,
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              color: "var(--text)",
            }}>
              {selectedNote.content || "（空备忘录）"}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
