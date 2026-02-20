import { useEffect } from "react";
import { useStore } from "@/stores/app";
import Sidebar from "./Sidebar";
import Dashboard from "@/components/modules/Dashboard";
import DailyView from "@/components/modules/DailyView";
import KanbanView from "@/components/modules/KanbanView";
import PlanningView from "@/components/modules/PlanningView";
import DiaryView from "@/components/modules/DiaryView";
import DecisionsView from "@/components/modules/DecisionsView";
import ConnectorsView from "@/components/modules/ConnectorsView";
import StickyNotesView from "@/components/modules/StickyNotesView";
import SkillsView from "@/components/modules/SkillsView";
import GitScannerView from "@/components/modules/GitScannerView";
import SchedulerView from "@/components/modules/SchedulerView";
import SettingsView from "@/components/modules/SettingsView";

const VIEWS = {
  dashboard:   Dashboard,
  daily:       DailyView,
  kanban:      KanbanView,
  planning:    PlanningView,
  diary:       DiaryView,
  decisions:   DecisionsView,
  connectors:  ConnectorsView,
  stickynotes: StickyNotesView,
  skills:      SkillsView,
  gitscanner:  GitScannerView,
  scheduler:   SchedulerView,
  settings:    SettingsView,
};

export default function Shell() {
  const currentView = useStore((s) => s.currentView);
  const setCmdPalette = useStore((s) => s.setCmdPalette);
  const theme = useStore((s) => s.theme);

  // Apply theme on mount
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdPalette(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const ViewComponent = VIEWS[currentView];

  return (
    <div style={{
      position: "relative", zIndex: 1,
      display: "flex", flexDirection: "column",
      height: "100vh", overflow: "hidden",
    }}>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Sidebar />
        <main style={{
          flex: 1, overflow: "auto",
          padding: "20px 24px",
        }}>
          <div className="fade-up" key={currentView}>
            <ViewComponent />
          </div>
        </main>
      </div>
    </div>
  );
}
