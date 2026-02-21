// Hero UI Switch 封装
import { Switch as HeroSwitch, SwitchProps } from "@heroui/react";
import { forwardRef } from "react";

export const Switch = forwardRef<HTMLInputElement, SwitchProps>((props, ref) => {
  return (
    <HeroSwitch
      ref={ref}
      classNames={{
        wrapper: "group-data-[selected=true]:bg-accent",
        thumb: "bg-white",
      }}
      {...props}
    />
  );
});

Switch.displayName = "Switch";
