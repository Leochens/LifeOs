import { useState, useEffect, useMemo } from "react";
import { useStore } from "@/stores/app";
import { writeNote, listNotes, createDirAll } from "@/services/tauri";
import { format } from "date-fns";
import type { FinancePerson, FinanceRecord } from "@/types";
import {
  Wallet,
  Users,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  Plus,
  ChevronRight,
  ChevronLeft,
  Check,
  User,
  GitBranch,
  ArrowLeft,
} from "lucide-react";

const FINANCE_DIR = "finance";
const RECORDS_DIR = "finance/records";

type ViewMode = "overview" | "record" | "history" | "add-record";

const STEP_LABELS = [
  { key: "liquid" as const, label: "流动资金", desc: "银行存款、现金、余额宝等" },
  { key: "fixed" as const, label: "固定资产", desc: "房产、车辆等" },
  { key: "investment" as const, label: "投资理财", desc: "股票、基金、理财产品等" },
  { key: "receivable" as const, label: "应收款", desc: "借出的钱、待收款项" },
  { key: "debt" as const, label: "负债", desc: "房贷、车贷、信用卡欠款等" },
];

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^\w\u4e00-\u9fff-]/g, "");
}

function formatMoney(value: number): string {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}万`;
  }
  return value.toLocaleString();
}

export default function FinanceView() {
  const vaultPath = useStore((s) => s.vaultPath);
  const financePersons = useStore((s) => s.financePersons);
  const setFinancePersons = useStore((s) => s.setFinancePersons);
  const financeRecords = useStore((s) => s.financeRecords);
  const setFinanceRecords = useStore((s) => s.setFinanceRecords);

  const [selectedPerson, setSelectedPerson] = useState<FinancePerson | null>(null);
  const [view, setView] = useState<ViewMode>("overview");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);

  // Add person form
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonRole, setNewPersonRole] = useState("family");

  // Record form values
  const [recordValues, setRecordValues] = useState({
    liquid: 0,
    fixed: 0,
    investment: 0,
    receivable: 0,
    debt: 0,
  });

  // History month navigation
  const [historyMonth, setHistoryMonth] = useState(() => format(new Date(), "yyyy-MM"));

  // ── Load data ──────────────────────────────────────────────────
  const loadPersons = async () => {
    if (!vaultPath) return;
    try {
      const dir = `${vaultPath}/${FINANCE_DIR}`;
      await createDirAll(dir);
      const notes = await listNotes(dir, false);
      const persons: FinancePerson[] = [];
      for (const n of notes) {
        if (n.frontmatter.id) {
          persons.push({
            id: n.frontmatter.id,
            name: n.frontmatter.name || "",
            role: n.frontmatter.role || "family",
            created: n.frontmatter.created || "",
            updated: n.frontmatter.updated || "",
            path: n.path,
          });
        }
      }
      setFinancePersons(persons);
      if (persons.length > 0 && !selectedPerson) {
        setSelectedPerson(persons[0]);
      }
    } catch (e) {
      console.error("Failed to load finance persons:", e);
    }
  };

  const loadRecords = async () => {
    if (!vaultPath) return;
    try {
      const dir = `${vaultPath}/${RECORDS_DIR}`;
      await createDirAll(dir);
      const allRecords: FinanceRecord[] = [];
      for (const person of financePersons) {
        const slug = slugify(person.name);
        const personDir = `${dir}/${slug}`;
        try {
          await createDirAll(personDir);
          const notes = await listNotes(personDir, false);
          for (const n of notes) {
            allRecords.push({
              person: n.frontmatter.person || person.name,
              date: n.frontmatter.date || "",
              liquid: parseFloat(n.frontmatter.liquid) || 0,
              fixed: parseFloat(n.frontmatter.fixed) || 0,
              investment: parseFloat(n.frontmatter.investment) || 0,
              receivable: parseFloat(n.frontmatter.receivable) || 0,
              debt: parseFloat(n.frontmatter.debt) || 0,
              path: n.path,
            });
          }
        } catch {
          // person dir might not exist yet
        }
      }
      setFinanceRecords(allRecords);
    } catch (e) {
      console.error("Failed to load finance records:", e);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadPersons().finally(() => setLoading(false));
  }, [vaultPath]);

  useEffect(() => {
    if (financePersons.length > 0) {
      loadRecords();
    }
  }, [financePersons]);

  // ── Derived data ───────────────────────────────────────────────
  const personRecords = useMemo(() => {
    if (!selectedPerson) return [];
    return financeRecords
      .filter((r) => r.person === selectedPerson.name)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [financeRecords, selectedPerson]);

  const latestRecord = personRecords[0] || null;
  const previousRecord = personRecords[1] || null;

  const totalAssets = latestRecord
    ? latestRecord.liquid + latestRecord.fixed + latestRecord.investment + latestRecord.receivable
    : 0;
  const netAssets = totalAssets - (latestRecord?.debt || 0);
  const debtRatio = totalAssets > 0 ? ((latestRecord?.debt || 0) / totalAssets) * 100 : 0;

  const prevTotalAssets = previousRecord
    ? previousRecord.liquid + previousRecord.fixed + previousRecord.investment + previousRecord.receivable
    : 0;
  const prevNetAssets = prevTotalAssets - (previousRecord?.debt || 0);

  // ── Actions ────────────────────────────────────────────────────
  const handleAddPerson = async () => {
    if (!vaultPath || !newPersonName.trim()) return;
    const slug = slugify(newPersonName);
    const now = format(new Date(), "yyyy-MM-dd");
    const path = `${vaultPath}/${FINANCE_DIR}/${slug}.md`;

    await writeNote(path, {
      id: slug,
      name: newPersonName,
      role: newPersonRole,
      created: now,
      updated: now,
    }, "");

    setNewPersonName("");
    setNewPersonRole("family");
    setShowAddPerson(false);
    await loadPersons();
  };

  const handleStartRecord = () => {
    setStep(1);
    setRecordValues({ liquid: 0, fixed: 0, investment: 0, receivable: 0, debt: 0 });
    // Pre-fill from latest record if exists
    if (latestRecord) {
      setRecordValues({
        liquid: latestRecord.liquid,
        fixed: latestRecord.fixed,
        investment: latestRecord.investment,
        receivable: latestRecord.receivable,
        debt: latestRecord.debt,
      });
    }
    setView("add-record");
  };

  const handleSaveRecord = async () => {
    if (!vaultPath || !selectedPerson) return;
    const slug = slugify(selectedPerson.name);
    const now = format(new Date(), "yyyy-MM-dd");
    const recordDir = `${vaultPath}/${RECORDS_DIR}/${slug}`;
    await createDirAll(recordDir);

    const path = `${recordDir}/${now}.md`;
    await writeNote(path, {
      person: selectedPerson.name,
      date: now,
      liquid: recordValues.liquid,
      fixed: recordValues.fixed,
      investment: recordValues.investment,
      receivable: recordValues.receivable,
      debt: recordValues.debt,
    }, "");

    // Update person's updated date
    await writeNote(selectedPerson.path, {
      id: selectedPerson.id,
      name: selectedPerson.name,
      role: selectedPerson.role,
      created: selectedPerson.created,
      updated: now,
    }, "");

    setView("overview");
    await loadPersons();
    await loadRecords();
  };

  // ── History month records ──────────────────────────────────────
  const historyRecords = useMemo(() => {
    return personRecords.filter((r) => r.date.startsWith(historyMonth));
  }, [personRecords, historyMonth]);

  const calendarDays = useMemo(() => {
    const [y, m] = historyMonth.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const firstDow = new Date(y, m - 1, 1).getDay(); // 0=Sun
    const recordDates = new Set(historyRecords.map((r) => r.date));
    return { daysInMonth, firstDow, recordDates, year: y, month: m };
  }, [historyMonth, historyRecords]);

  // ── Bar chart data ─────────────────────────────────────────────
  const barData = useMemo(() => {
    if (!latestRecord) return [];
    const items = STEP_LABELS.map((s) => ({
      label: s.label,
      value: latestRecord[s.key],
      prev: previousRecord ? previousRecord[s.key] : null,
    }));
    return items;
  }, [latestRecord, previousRecord]);

  const barMaxValue = useMemo(() => {
    return Math.max(...barData.map((d) => d.value), 1);
  }, [barData]);

  // ── Render helpers ─────────────────────────────────────────────

  const renderStatCard = (
    label: string,
    value: string,
    icon: React.ReactNode,
    change?: number | null,
  ) => (
    <div
      style={{
        background: "var(--panel)",
        borderRadius: 12,
        padding: "18px 20px",
        border: "1px solid var(--border)",
        flex: 1,
        minWidth: 160,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {icon}
        <span style={{ color: "var(--text-dim)", fontSize: 13 }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
      {change !== undefined && change !== null && (
        <div
          style={{
            fontSize: 12,
            marginTop: 4,
            color: change >= 0 ? "#22c55e" : "#ef4444",
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {change >= 0 ? "+" : ""}
          {formatMoney(change)}
        </div>
      )}
    </div>
  );

  const renderStepIndicator = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 32 }}>
      {STEP_LABELS.map((s, i) => {
        const stepNum = i + 1;
        const isActive = step === stepNum;
        const isDone = step > stepNum;
        return (
          <div key={s.key} style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 600,
                background: isDone
                  ? "var(--accent)"
                  : isActive
                    ? "var(--accent)"
                    : "var(--panel)",
                color: isDone || isActive ? "#fff" : "var(--text-dim)",
                border: isDone || isActive ? "none" : "1px solid var(--border)",
                transition: "all 0.2s",
              }}
            >
              {isDone ? <Check size={14} /> : stepNum}
            </div>
            <span
              style={{
                fontSize: 12,
                marginLeft: 6,
                color: isActive ? "var(--accent)" : "var(--text-dim)",
                fontWeight: isActive ? 600 : 400,
                whiteSpace: "nowrap",
              }}
            >
              {s.label}
            </span>
            {i < STEP_LABELS.length - 1 && (
              <div
                style={{
                  width: 32,
                  height: 2,
                  background: isDone ? "var(--accent)" : "var(--border)",
                  margin: "0 8px",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  const renderBarChart = () => {
    if (barData.length === 0) return null;
    return (
      <div style={{ marginTop: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          <BarChart3 size={16} />
          资产对比
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 24, height: 240, padding: "0 12px" }}>
          {barData.map((d) => {
            const h = (d.value / barMaxValue) * 200;
            const diff = d.prev !== null ? d.value - d.prev : null;
            return (
              <div key={d.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                {diff !== null && (
                  <div
                    style={{
                      fontSize: 11,
                      marginBottom: 4,
                      color: diff >= 0 ? "#22c55e" : "#ef4444",
                      fontWeight: 500,
                    }}
                  >
                    {diff >= 0 ? "↑" : "↓"}
                    {formatMoney(Math.abs(diff))}
                  </div>
                )}
                <div
                  style={{
                    height: Math.max(h, 4),
                    width: 40,
                    background: d.label === "负债"
                      ? "linear-gradient(to top, #ef4444, #f87171)"
                      : "linear-gradient(to top, var(--accent), var(--accent2-5, #60a5fa))",
                    borderRadius: "6px 6px 0 0",
                    transition: "height 0.3s",
                  }}
                />
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6, textAlign: "center" }}>
                  {d.label}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>
                  {formatMoney(d.value)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTreeChart = () => {
    if (!latestRecord) return null;
    const treeData = [
      {
        label: "总资产",
        value: totalAssets,
        color: "var(--accent)",
        children: [
          { label: "流动资金", value: latestRecord.liquid },
          { label: "固定资产", value: latestRecord.fixed },
          { label: "投资理财", value: latestRecord.investment },
          { label: "应收款", value: latestRecord.receivable },
        ],
      },
      {
        label: "总负债",
        value: latestRecord.debt,
        color: "#ef4444",
        children: [],
      },
    ];

    return (
      <div style={{ marginTop: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          <GitBranch size={16} />
          资产构成
        </div>
        <div style={{ padding: "0 8px" }}>
          {treeData.map((node) => (
            <div key={node.label} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: node.color }} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>{node.label}</span>
                <span style={{ color: "var(--text-dim)", fontSize: 13, marginLeft: "auto" }}>
                  {formatMoney(node.value)}
                </span>
              </div>
              {node.children.map((child, ci) => (
                <div
                  key={child.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginLeft: 24,
                    padding: "4px 0",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: -16,
                      top: 0,
                      bottom: ci === node.children.length - 1 ? "50%" : 0,
                      width: 1,
                      background: "var(--border)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: -16,
                      top: "50%",
                      width: 12,
                      height: 1,
                      background: "var(--border)",
                    }}
                  />
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--text-dim)",
                    }}
                  />
                  <span style={{ fontSize: 13 }}>{child.label}</span>
                  <span style={{ color: "var(--text-dim)", fontSize: 12, marginLeft: "auto" }}>
                    {formatMoney(child.value)}
                  </span>
                  {totalAssets > 0 && (
                    <div
                      style={{
                        width: 60,
                        height: 4,
                        borderRadius: 2,
                        background: "var(--border)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${(child.value / totalAssets) * 100}%`,
                          height: "100%",
                          background: "var(--accent)",
                          borderRadius: 2,
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCalendar = () => {
    const { daysInMonth, firstDow, recordDates, year, month } = calendarDays;
    const weeks: (number | null)[][] = [];
    let week: (number | null)[] = new Array(firstDow).fill(null);

    for (let d = 1; d <= daysInMonth; d++) {
      week.push(d);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }

    const dayNames = ["日", "一", "二", "三", "四", "五", "六"];

    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <button
            onClick={() => {
              const [y, m] = historyMonth.split("-").map(Number);
              const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
              setHistoryMonth(prev);
            }}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "4px 8px",
              cursor: "pointer",
              color: "inherit",
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontWeight: 600, fontSize: 15 }}>
            {year}年{month}月
          </span>
          <button
            onClick={() => {
              const [y, m] = historyMonth.split("-").map(Number);
              const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
              setHistoryMonth(next);
            }}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "4px 8px",
              cursor: "pointer",
              color: "inherit",
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {dayNames.map((d) => (
            <div
              key={d}
              style={{
                textAlign: "center",
                fontSize: 12,
                color: "var(--text-dim)",
                padding: "4px 0",
                fontWeight: 500,
              }}
            >
              {d}
            </div>
          ))}
          {weeks.flat().map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} />;
            const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const hasRecord = recordDates.has(dateStr);
            return (
              <div
                key={dateStr}
                style={{
                  textAlign: "center",
                  padding: "8px 4px",
                  borderRadius: 8,
                  fontSize: 13,
                  background: hasRecord ? "var(--accent)" : "transparent",
                  color: hasRecord ? "#fff" : "inherit",
                  fontWeight: hasRecord ? 600 : 400,
                  cursor: hasRecord ? "pointer" : "default",
                }}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Main render ────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-dim)" }}>
        加载中...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Left sidebar - Person list */}
      <div
        style={{
          width: 240,
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 15 }}>
            <Users size={16} />
            家庭成员
          </div>
          <button
            onClick={() => setShowAddPerson(!showAddPerson)}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 6,
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "inherit",
            }}
          >
            <Plus size={14} />
          </button>
        </div>

        {showAddPerson && (
          <div style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>
            <input
              value={newPersonName}
              onChange={(e) => setNewPersonName(e.target.value)}
              placeholder="成员名称"
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--panel)",
                color: "inherit",
                fontSize: 13,
                marginBottom: 8,
                boxSizing: "border-box",
              }}
            />
            <select
              value={newPersonRole}
              onChange={(e) => setNewPersonRole(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--panel)",
                color: "inherit",
                fontSize: 13,
                marginBottom: 8,
                boxSizing: "border-box",
              }}
            >
              <option value="family">家庭</option>
              <option value="personal">个人</option>
            </select>
            <button
              onClick={handleAddPerson}
              disabled={!newPersonName.trim()}
              style={{
                width: "100%",
                padding: "6px 0",
                borderRadius: 6,
                border: "none",
                background: newPersonName.trim() ? "var(--accent)" : "var(--border)",
                color: newPersonName.trim() ? "#fff" : "var(--text-dim)",
                fontSize: 13,
                fontWeight: 600,
                cursor: newPersonName.trim() ? "pointer" : "not-allowed",
              }}
            >
              添加
            </button>
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          {financePersons.length === 0 ? (
            <div
              style={{
                padding: 20,
                textAlign: "center",
                color: "var(--text-dim)",
                fontSize: 13,
              }}
            >
              暂无成员，点击 + 添加
            </div>
          ) : (
            financePersons.map((person) => (
              <div
                key={person.id}
                onClick={() => {
                  setSelectedPerson(person);
                  setView("overview");
                }}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: selectedPerson?.id === person.id ? "var(--accent)" : "transparent",
                  color: selectedPerson?.id === person.id ? "#fff" : "inherit",
                  marginBottom: 4,
                  transition: "background 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <User size={14} />
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{person.name}</span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    marginTop: 4,
                    opacity: 0.7,
                  }}
                >
                  更新: {person.updated || "暂无记录"}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: "auto", padding: "24px 28px" }}>
        {!selectedPerson ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--text-dim)",
              gap: 12,
            }}
          >
            <Wallet size={48} strokeWidth={1} />
            <div style={{ fontSize: 15 }}>请先选择或添加一个家庭成员</div>
          </div>
        ) : view === "overview" ? (
          // ── Overview mode ──
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {selectedPerson.name} - 资产总览
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleStartRecord}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: "var(--accent)",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Plus size={14} />
                  更新资产
                </button>
                <button
                  onClick={() => setView("history")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--panel)",
                    color: "inherit",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <Calendar size={14} />
                  历史记录
                </button>
              </div>
            </div>

            {!latestRecord ? (
              <div
                style={{
                  textAlign: "center",
                  padding: 60,
                  color: "var(--text-dim)",
                }}
              >
                <Wallet size={40} strokeWidth={1} style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 15, marginBottom: 8 }}>暂无资产记录</div>
                <div style={{ fontSize: 13 }}>点击"更新资产"开始录入第一笔记录</div>
              </div>
            ) : (
              <>
                {/* Stat cards */}
                <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
                  {renderStatCard(
                    "总资产",
                    formatMoney(totalAssets),
                    <Wallet size={16} style={{ color: "var(--accent)" }} />,
                    previousRecord ? totalAssets - prevTotalAssets : null,
                  )}
                  {renderStatCard(
                    "净资产",
                    formatMoney(netAssets),
                    <TrendingUp size={16} style={{ color: "#22c55e" }} />,
                    previousRecord ? netAssets - prevNetAssets : null,
                  )}
                  {renderStatCard(
                    "负债率",
                    `${debtRatio.toFixed(1)}%`,
                    <TrendingDown size={16} style={{ color: "#ef4444" }} />,
                  )}
                  {renderStatCard(
                    "更新日期",
                    latestRecord.date,
                    <Calendar size={16} style={{ color: "var(--text-dim)" }} />,
                  )}
                </div>

                {/* Bar chart */}
                {renderBarChart()}

                {/* Tree chart */}
                {renderTreeChart()}
              </>
            )}
          </div>
        ) : view === "add-record" ? (
          // ── Add record (step wizard) ──
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <button
                onClick={() => setView("overview")}
                style={{
                  background: "none",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "4px 8px",
                  cursor: "pointer",
                  color: "inherit",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <ArrowLeft size={16} />
              </button>
              <span style={{ fontSize: 18, fontWeight: 700 }}>更新资产 - {selectedPerson.name}</span>
            </div>

            {renderStepIndicator()}

            <div
              style={{
                background: "var(--panel)",
                borderRadius: 12,
                padding: 24,
                border: "1px solid var(--border)",
                maxWidth: 480,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                {STEP_LABELS[step - 1].label}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 20 }}>
                {STEP_LABELS[step - 1].desc}
              </div>

              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-dim)",
                    fontSize: 14,
                  }}
                >
                  ¥
                </span>
                <input
                  type="number"
                  value={recordValues[STEP_LABELS[step - 1].key] || ""}
                  onChange={(e) =>
                    setRecordValues({
                      ...recordValues,
                      [STEP_LABELS[step - 1].key]: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0"
                  style={{
                    width: "100%",
                    padding: "12px 12px 12px 28px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "inherit",
                    fontSize: 20,
                    fontWeight: 600,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                {step > 1 && (
                  <button
                    onClick={() => setStep(step - 1)}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--panel)",
                      color: "inherit",
                      fontSize: 14,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <ChevronLeft size={16} />
                    上一步
                  </button>
                )}
                {step < 5 ? (
                  <button
                    onClick={() => setStep(step + 1)}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      borderRadius: 8,
                      border: "none",
                      background: "var(--accent)",
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    下一步
                    <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    onClick={handleSaveRecord}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      borderRadius: 8,
                      border: "none",
                      background: "var(--accent)",
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <Check size={16} />
                    保存记录
                  </button>
                )}
              </div>
            </div>

            {/* Preview summary */}
            <div
              style={{
                marginTop: 20,
                padding: 16,
                borderRadius: 10,
                border: "1px solid var(--border)",
                maxWidth: 480,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text-dim)" }}>
                当前录入摘要
              </div>
              {STEP_LABELS.map((s, i) => (
                <div
                  key={s.key}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 0",
                    fontSize: 13,
                    color: i + 1 <= step ? "inherit" : "var(--text-dim)",
                    opacity: i + 1 <= step ? 1 : 0.5,
                  }}
                >
                  <span>{s.label}</span>
                  <span style={{ fontWeight: 500 }}>
                    ¥{recordValues[s.key].toLocaleString()}
                  </span>
                </div>
              ))}
              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  marginTop: 8,
                  paddingTop: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                <span>净资产</span>
                <span>
                  ¥
                  {(
                    recordValues.liquid +
                    recordValues.fixed +
                    recordValues.investment +
                    recordValues.receivable -
                    recordValues.debt
                  ).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        ) : view === "history" ? (
          // ── History mode ──
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <button
                onClick={() => setView("overview")}
                style={{
                  background: "none",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "4px 8px",
                  cursor: "pointer",
                  color: "inherit",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <ArrowLeft size={16} />
              </button>
              <span style={{ fontSize: 18, fontWeight: 700 }}>
                历史记录 - {selectedPerson.name}
              </span>
            </div>

            <div style={{ display: "flex", gap: 24 }}>
              {/* Calendar */}
              <div
                style={{
                  background: "var(--panel)",
                  borderRadius: 12,
                  padding: 20,
                  border: "1px solid var(--border)",
                  width: 320,
                }}
              >
                {renderCalendar()}
              </div>

              {/* Records list */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--text-dim)" }}>
                  {historyMonth} 记录 ({historyRecords.length})
                </div>
                {historyRecords.length === 0 ? (
                  <div style={{ color: "var(--text-dim)", fontSize: 13, padding: 20, textAlign: "center" }}>
                    该月暂无记录
                  </div>
                ) : (
                  historyRecords.map((record) => {
                    const recTotal = record.liquid + record.fixed + record.investment + record.receivable;
                    const recNet = recTotal - record.debt;
                    return (
                      <div
                        key={record.date}
                        style={{
                          background: "var(--panel)",
                          borderRadius: 10,
                          padding: 16,
                          border: "1px solid var(--border)",
                          marginBottom: 10,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 10,
                          }}
                        >
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{record.date}</span>
                          <span style={{ fontSize: 13, color: "var(--text-dim)" }}>
                            净资产: ¥{recNet.toLocaleString()}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, 1fr)",
                            gap: 8,
                            fontSize: 12,
                          }}
                        >
                          {STEP_LABELS.map((s) => (
                            <div key={s.key}>
                              <div style={{ color: "var(--text-dim)" }}>{s.label}</div>
                              <div style={{ fontWeight: 500, marginTop: 2 }}>
                                ¥{record[s.key].toLocaleString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
