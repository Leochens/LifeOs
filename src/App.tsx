import { useEffect } from "react";
import { useStore } from "@/stores/app";
import { getVaultPath } from "@/services/tauri";
import { useVaultLoader } from "@/hooks/useVaultLoader";
import SetupScreen from "@/components/layout/SetupScreen";
import Shell from "@/components/layout/Shell";

export default function App() {
  const { vaultPath, setVaultPath } = useStore();
  const { loadAll } = useVaultLoader();

  // On mount: check if vault is already configured
  useEffect(() => {
    getVaultPath().then((p) => {
      if (p) setVaultPath(p);
    });
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
