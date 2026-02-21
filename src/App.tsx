import { useEffect } from "react";
import { useStore } from "@/stores/app";
import { getVaultPath } from "@/services/fs";
import { useVaultLoader } from "@/hooks/useVaultLoader";
import SetupScreen from "@/components/layout/SetupScreen";
import Shell from "@/components/layout/Shell";
import { isTauri } from "@/services/env";
import { loadDirectoryHandle } from "@/services/web-fs-store";
import { setDirectoryHandle } from "@/services/web-fs";

export default function App() {
  const { vaultPath, setVaultPath } = useStore();
  const { loadAll } = useVaultLoader();

  // On mount: check if vault is already configured
  useEffect(() => {
    if (isTauri()) {
      // Tauri: 从后端获取已保存的路径
      getVaultPath().then((p) => {
        if (p) setVaultPath(p);
      });
    } else {
      // Web: 从 IndexedDB 恢复目录句柄
      loadDirectoryHandle().then((handle) => {
        if (handle) {
          setDirectoryHandle(handle);
          setVaultPath(handle.name);
        }
      });
    }
  }, []);

  // When vault is set, load everything
  useEffect(() => {
    if (vaultPath) loadAll();
  }, [vaultPath]);

  return (
    <>
      <div className="grid-bg" />
      <div className="radial-bg" />
      {vaultPath ? <Shell /> : <SetupScreen />}
    </>
  );
}
