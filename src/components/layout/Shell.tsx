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
      <div className="relative z-10 flex flex-col h-screen overflow-hidden">
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto p-5">
            <div className="flex flex-col items-center justify-center h-full text-text-dim">
              <div className="text-5xl mb-4">⚙️</div>
              <div className="text-base">插件未启用或不存在</div>
              <div className="text-xs mt-2">
                当前视图: {currentView}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 flex flex-col h-screen overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto p-5">
          <div className="fade-up" key={currentView}>
            <ViewComponent />
          </div>
        </main>
      </div>
    </div>
  );
}
