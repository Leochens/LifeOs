// Hero UI Tabs 封装
import { Tabs as HeroTabs, TabsProps } from "@heroui/react";
import { forwardRef } from "react";

export const Tabs = forwardRef<HTMLDivElement, TabsProps>((props, ref) => {
  return (
    <HeroTabs
      ref={ref}
      classNames={{
        tabList: "bg-panel border border-border rounded-[var(--radius-sm)] gap-1 p-1",
        tab: "data-[selected=true]:bg-accent data-[selected=true]:text-white text-text-dim h-8 px-4",
        cursor: "bg-accent rounded-[var(--radius-sm)]",
      }}
      {...props}
    />
  );
});

Tabs.displayName = "Tabs";
