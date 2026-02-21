import { useState, useEffect, useRef, useCallback } from "react";
import { useStore } from "@/stores/app";
import { readFile, writeFile } from "@/services/fs";
import type { StickyNote, StickyColor } from "@/types";
import { Plus, LayoutGrid, Maximize } from "lucide-react";

const COLORS: StickyColor[] = ["yellow", "pink", "blue", "green", "orange"];
const COLOR_HEX: Record<StickyColor, string> = {
  yellow: "#fef08a",
  pink: "#fbcfe8",
  blue: "#bae6fd",
  green: "#bbf7d0",
  orange: "#fed7aa",
};

export default function StickyNotesView() {
  const { stickyNotes, setStickyNotes, upsertStickyNote, deleteStickyNote, vaultPath } = useStore();
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [selectedColor, setSelectedColor] = useState<StickyColor>("yellow");
  const [draggingCanvas, setDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingNote, setDraggingNote] = useState<string | null>(null);
  const [noteOffset, setNoteOffset] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load notes from file
  useEffect(() => {
    if (!vaultPath) { setLoaded(true); return; }
    const load = async () => {
      try {
        const content = await readFile(`${vaultPath}/stickynotes/board.json`);
        const parsed = JSON.parse(content) as StickyNote[];
        setStickyNotes(parsed);
      } catch {
        // file doesn't exist yet
      }
      setLoaded(true);
    };
    load();
  }, [vaultPath, setStickyNotes]);

  // Save notes to file (debounced)
  useEffect(() => {
    if (!vaultPath || !loaded) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      writeFile(`${vaultPath}/stickynotes/board.json`, JSON.stringify(stickyNotes, null, 2)).catch(() => {});
    }, 500);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [stickyNotes, vaultPath, loaded]);

  // Canvas pan: mouse down
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start panning if clicking on the canvas itself (not on a note)
    if ((e.target as HTMLElement).closest(".sticky-note")) return;
    setDraggingCanvas(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setPanStart({ x: panX, y: panY });
  }, [panX, panY]);

  // Mouse move: canvas pan or note drag
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingCanvas) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setPanX(panStart.x + dx);
      setPanY(panStart.y + dy);
    }
    if (draggingNote) {
      const note = stickyNotes.find((n) => n.id === draggingNote);
      if (!note) return;
      const newX = (e.clientX - noteOffset.x - panX) / zoom;
      const newY = (e.clientY - noteOffset.y - panY) / zoom;
      upsertStickyNote({ ...note, x: Math.max(0, newX), y: Math.max(0, newY) });
    }
  }, [draggingCanvas, draggingNote, dragStart, panStart, noteOffset, panX, panY, zoom, stickyNotes, upsertStickyNote]);

  // Mouse up
  const handleMouseUp = useCallback(() => {
    setDraggingCanvas(false);
    setDraggingNote(null);
  }, []);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(3, Math.max(0.3, zoom * delta));
    // Zoom toward mouse position
    const newPanX = mouseX - (mouseX - panX) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - panY) * (newZoom / zoom);
    setZoom(newZoom);
    setPanX(newPanX);
    setPanY(newPanY);
  }, [zoom, panX, panY]);

  // Note drag start
  const handleNoteDragStart = useCallback((e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    const note = stickyNotes.find((n) => n.id === noteId);
    if (!note) return;
    setDraggingNote(noteId);
    setNoteOffset({
      x: e.clientX - panX - note.x * zoom,
      y: e.clientY - panY - note.y * zoom,
    });
  }, [stickyNotes, panX, panY, zoom]);

  // Double click to create note
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".sticky-note")) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - panX) / zoom;
    const y = (e.clientY - rect.top - panY) / zoom;
    const newNote: StickyNote = {
      id: `note-${Date.now()}`,
      x, y,
      width: 200,
      height: 160,
      content: "",
      color: selectedColor,
      rotation: (Math.random() - 0.5) * 8,
      created: new Date().toISOString(),
    };
    upsertStickyNote(newNote);
  }, [panX, panY, zoom, selectedColor, upsertStickyNote]);

  // Create note from toolbar
  const createNote = useCallback(() => {
    const x = (-panX + 200) / zoom;
    const y = (-panY + 200) / zoom;
    const newNote: StickyNote = {
      id: `note-${Date.now()}`,
      x, y,
      width: 200,
      height: 160,
      content: "",
      color: selectedColor,
      rotation: (Math.random() - 0.5) * 8,
      created: new Date().toISOString(),
    };
    upsertStickyNote(newNote);
  }, [panX, panY, zoom, selectedColor, upsertStickyNote]);

  // Auto-layout: grid arrangement
  const autoLayout = useCallback(() => {
    const perRow = 4;
    const gap = 30;
    const startX = 100;
    const startY = 100;
    stickyNotes.forEach((note, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const targetX = startX + col * (200 + gap);
      const targetY = startY + row * (160 + gap);
      setTimeout(() => {
        upsertStickyNote({ ...note, x: targetX, y: targetY });
      }, i * 50);
    });
  }, [stickyNotes, upsertStickyNote]);

  // Reset view
  const resetView = useCallback(() => {
    setPanX(0);
    setPanY(0);
    setZoom(1);
  }, []);

  // Handle note content change
  const handleNoteBlur = useCallback((noteId: string, content: string) => {
    const note = stickyNotes.find((n) => n.id === noteId);
    if (note) upsertStickyNote({ ...note, content });
  }, [stickyNotes, upsertStickyNote]);

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button className="btn btn-primary px-3.5 py-1.5" onClick={createNote}>
          <Plus size={14} /> 新建
        </button>

        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setSelectedColor(c)}
            className="w-7 h-7 rounded-full cursor-pointer transition-colors duration-150 flex-shrink-0"
            style={{
              border: selectedColor === c ? "2px solid var(--text)" : "2px solid transparent",
              background: COLOR_HEX[c],
            }}
          />
        ))}

        <div className="flex-1" />

        <button className="btn btn-ghost px-3 py-1.5" onClick={autoLayout}>
          <LayoutGrid size={14} /> 一键排版
        </button>
        <button className="btn btn-ghost px-3 py-1.5" onClick={resetView}>
          <Maximize size={14} /> 重置视图
        </button>

        <span className="text-xs text-text-dim ml-1">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="canvas-wrap"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      >
        <div
          className="canvas-inner"
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          }}
        >
          {stickyNotes.map((note) => (
            <div
              key={note.id}
              className={`sticky-note ${note.color}`}
              style={{
                left: note.x,
                top: note.y,
                width: note.width,
                minHeight: note.height,
                transform: `rotate(${note.rotation}deg)`,
                transition: draggingNote === note.id ? "none" : "left 0.3s, top 0.3s",
              }}
              onMouseDown={(e) => handleNoteDragStart(e, note.id)}
            >
              <div className="sticky-pin" />
              {/* Delete button */}
              <button
                onClick={(e) => { e.stopPropagation(); deleteStickyNote(note.id); }}
                className="absolute top-1 right-1 w-5 h-5 rounded-full border-none bg-black/15 text-inherit cursor-pointer text-xs flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity duration-150"
              >
                x
              </button>
              <textarea
                className="sticky-textarea"
                defaultValue={note.content}
                onBlur={(e) => handleNoteBlur(note.id, e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="写点什么..."
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
