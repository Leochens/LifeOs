// Hero UI Badge 封装
import { Badge as HeroBadge, BadgeProps } from "@heroui/react";
import { forwardRef } from "react";

export interface AppBadgeProps extends Omit<BadgeProps, "color"> {
  color?: "default" | "purple" | "green" | "red" | "orange" | "primary" | "secondary" | "success" | "warning" | "danger";
}

export const Badge = forwardRef<HTMLSpanElement, AppBadgeProps>(
  ({ color = "default", ...props }, ref) => {
    const getColor = (): "primary" | "secondary" | "success" | "warning" | "danger" | "default" => {
      switch (color) {
        case "purple":
          return "secondary";
        case "green":
          return "success";
        case "red":
          return "danger";
        case "orange":
          return "warning";
        default:
          return color === "default" ? "default" : "primary";
      }
    };

    return (
      <HeroBadge
        ref={ref}
        color={getColor()}
        variant="flat"
        className="text-[10px] px-2 py-0.5 rounded-full"
        {...props}
      />
    );
  }
);

Badge.displayName = "Badge";
