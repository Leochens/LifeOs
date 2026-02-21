// Hero UI Progress 封装
import { Progress as HeroProgress, ProgressProps } from "@heroui/react";
import { forwardRef } from "react";

export const Progress = forwardRef<HTMLDivElement, ProgressProps>((props, ref) => {
  return (
    <HeroProgress
      ref={ref}
      classNames={{
        indicator: "bg-gradient-to-r from-accent to-accent2 shadow-[0_0_10px_var(--accent),0_0_20px_var(--accent)]",
        track: "bg-[rgba(255,255,255,0.06)]",
      }}
      {...props}
    />
  );
});

Progress.displayName = "Progress";
