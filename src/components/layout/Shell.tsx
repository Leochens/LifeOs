import { useEffect, useMemo } from "react";
import { useStore } from "@/stores/app";
import Sidebar from "./Sidebar";
import { getPluginComponent } from "@/plugins/registry";

export default function Shell() {
  const currentView = useStore((s) => s.currentView);
  const setCmdPalette = useStore((s) => s.setCmdPalette);
  const theme = useStore((s) => s.theme);

  // 动态获取当前视图的组件
  const ViewComponent = useMemo(() => {
    return getPluginComponent(currentView);
  }, [currentView]);

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

  // 如果组件不存在，显示占位符
  if (!ViewComponent) {
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
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--text-dim)",
            }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⚙️</div>
              <div style={{ fontSize: 16 }}>插件未启用或不存在</div>
              <div style={{ fontSize: 12, marginTop: 8 }}>
                当前视图: {currentView}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

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
