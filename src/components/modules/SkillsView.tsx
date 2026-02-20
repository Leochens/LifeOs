import { useEffect, useState } from "react";
import { useStore } from "@/stores/app";
import {
  getSkillPaths,
  listSkillFiles,
  writeFile,
  openInFinder,
} from "@/services/tauri";
import type { Skill, SkillPath } from "@/types";

const IDE_COLORS: Record<string, string> = {
  "Claude Code": "var(--accent)",
  "Cursor": "var(--accent2)",
  "VS Code": "#0078d4",
};

function ideColor(ide: string) {
  return IDE_COLORS[ide] ?? "var(--text-dim)";
}

function ideGroup(ide: string) {
  if (ide.toLowerCase().includes("claude")) return "Claude Code";
  if (ide.toLowerCase().includes("cursor")) return "Cursor";
  if (ide.toLowerCase().includes("code")) return "VS Code";
  return "Other";
}

function formatSize(bytes: number) {
  return (bytes / 1024).toFixed(1) + " KB";
}

const DEFAULT_TEMPLATE = `---
description: Describe what this skill does
---

# Skill Name

Your instructions here.
`;

export default function SkillsView() {
  const skills = useStore((s) => s.skills);
  const setSkills = useStore((s) => s.setSkills);

  const [skillPaths, setSkillPaths] = useState<SkillPath[]>([]);
  const [activeSkill, setActiveSkill] = useState<Skill | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDir, setNewDir] = useState("");

  async function load() {
    try {
      const paths = await getSkillPaths();
      setSkillPaths(paths);
      const files = await listSkillFiles(paths.map((p) => p.path));
      setSkills(files);
    } catch (e: unknown) {
      setError(String(e));
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (activeSkill) {
      setEditedContent(activeSkill.content);
    }
  }, [activeSkill]);

  // Group skills by IDE
  const grouped: Record<string, Skill[]> = {};
  for (const s of skills) {
    const g = ideGroup(s.ide);
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(s);
  }
  const groupOrder = ["Claude Code", "Cursor", "VS Code", "Other"];

  async function handleSave() {
    if (!activeSkill) return;
    setSaving(true);
    setError("");
    try {
      await writeFile(activeSkill.path, editedContent);
      setActiveSkill({ ...activeSkill, content: editedContent });
      await load();
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleOpenFinder() {
    if (!activeSkill) return;
    const dir = activeSkill.path.replace(/\/[^/]+$/, "");
    await openInFinder(dir);
  }

  async function handleCreate() {
    if (!newName || !newDir) return;
    const filename = newName.endsWith(".md") ? newName : newName + ".md";
    const fullPath = newDir.replace(/\/$/, "") + "/" + filename;
    setError("");
    try {
      await writeFile(fullPath, DEFAULT_TEMPLATE);
      setShowNew(false);
      setNewName("");
      setNewDir("");
      await load();
    } catch (e: unknown) {
      setError(String(e));
    }
  }

  return (
    <div style={{ display: "flex", gap: 16, height: "calc(100vh - 120px)" }}>
      {/* Left panel - file list */}
      <div
        className="panel"
        style={{
          width: 260,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 16px 12px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            gap: 8,
          }}
        >
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={load}>
            刷新
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={() => {
              setShowNew(true);
              if (skillPaths.length > 0) setNewDir(skillPaths[0].path);
            }}
          >
            新建 Skill
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {groupOrder.map((group) => {
            const items = grouped[group];
            if (!items || items.length === 0) return null;
            return (
              <div key={group} style={{ marginBottom: 8 }}>
                <div
                  className="label"
                  style={{
                    padding: "8px 16px 4px",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: ideColor(group),
                      boxShadow: `0 0 6px ${ideColor(group)}`,
                      flexShrink: 0,
                    }}
                  />
                  {group}
                </div>
                {items.map((s) => (
                  <div
                    key={s.path}
                    onClick={() => setActiveSkill(s)}
                    style={{
                      padding: "8px 16px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background:
                        activeSkill?.path === s.path
                          ? "rgba(0,200,255,0.08)"
                          : "transparent",
                      borderLeft:
                        activeSkill?.path === s.path
                          ? `2px solid ${ideColor(group)}`
                          : "2px solid transparent",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      if (activeSkill?.path !== s.path)
                        (e.currentTarget as HTMLElement).style.background =
                          "rgba(0,200,255,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      if (activeSkill?.path !== s.path)
                        (e.currentTarget as HTMLElement).style.background =
                          "transparent";
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.name}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--text-dim)",
                        flexShrink: 0,
                        marginLeft: 8,
                      }}
                    >
                      {formatSize(s.size)}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
          {skills.length === 0 && (
            <div
              style={{
                padding: 20,
                color: "var(--text-dim)",
                fontSize: 13,
                textAlign: "center",
              }}
            >
              没有发现 Skill 文件
            </div>
          )}
        </div>
      </div>

      {/* Right panel - editor */}
      <div
        className="panel"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {activeSkill ? (
          <>
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontSize: 16, fontWeight: 600 }}>
                    {activeSkill.name}
                  </span>
                  <span
                    className="tag"
                    style={{
                      background: `${ideColor(ideGroup(activeSkill.ide))}18`,
                      color: ideColor(ideGroup(activeSkill.ide)),
                    }}
                  >
                    {ideGroup(activeSkill.ide)}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-dim)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {activeSkill.path}
                </div>
              </div>
              <button
                className="btn btn-ghost"
                onClick={handleOpenFinder}
              >
                在 Finder 中打开
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
            <textarea
              className="input"
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              style={{
                flex: 1,
                margin: 12,
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                lineHeight: 1.8,
                resize: "none",
                borderRadius: "var(--radius-sm)",
              }}
            />
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-dim)",
              fontSize: 14,
            }}
          >
            从左侧选择一个 Skill 文件查看和编辑
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            background: "rgba(255,107,107,0.15)",
            border: "1px solid var(--accent4)",
            color: "var(--accent4)",
            padding: "10px 16px",
            borderRadius: "var(--radius-sm)",
            fontSize: 13,
            zIndex: 200,
            maxWidth: 400,
          }}
        >
          {error}
          <button
            style={{
              marginLeft: 12,
              background: "none",
              border: "none",
              color: "var(--accent4)",
              cursor: "pointer",
              fontSize: 13,
            }}
            onClick={() => setError("")}
          >
            x
          </button>
        </div>
      )}

      {/* New Skill Modal */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ minWidth: 420 }}
          >
            <div
              style={{
                fontFamily: "var(--font-disp)",
                fontSize: 22,
                letterSpacing: 2,
                color: "var(--accent)",
                marginBottom: 20,
              }}
            >
              新建 SKILL
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div>
                <div className="label" style={{ marginBottom: 6 }}>
                  文件名
                </div>
                <input
                  className="input"
                  placeholder="my-skill.md"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div>
                <div className="label" style={{ marginBottom: 6 }}>
                  保存目录
                </div>
                <select
                  className="input"
                  value={newDir}
                  onChange={(e) => setNewDir(e.target.value)}
                  style={{ cursor: "pointer" }}
                >
                  {skillPaths.map((sp) => (
                    <option key={sp.path} value={sp.path}>
                      {sp.ide} - {sp.path}
                    </option>
                  ))}
                </select>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "flex-end",
                  marginTop: 8,
                }}
              >
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowNew(false)}
                >
                  取消
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleCreate}
                  disabled={!newName}
                >
                  创建
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
