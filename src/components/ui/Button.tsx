// Hero UI Button 封装
import { Button as HeroButton, ButtonProps } from "@heroui/react";
import { forwardRef } from "react";

export interface AppButtonProps extends Omit<ButtonProps, "variant"> {
  variant?: "primary" | "ghost" | "icon" | "solid" | "bordered" | "light" | "flat" | "faded";
}

export const Button = forwardRef<HTMLButtonElement, AppButtonProps>(
  ({ variant = "primary", className = "", ...props }, ref) => {
    const getVariant = (): "solid" | "bordered" | "light" | "flat" | "faded" => {
      switch (variant) {
        case "primary":
          return "solid";
        case "ghost":
          return "bordered";
        case "icon":
          return "light";
        case "solid":
          return "solid";
        case "bordered":
          return "bordered";
        case "light":
          return "light";
        case "flat":
          return "flat";
        case "faded":
          return "faded";
        default:
          return "solid";
      }
    };

    return (
      <HeroButton
        ref={ref}
        variant={getVariant()}
        className={variant === "icon" ? `min-w-8 w-8 h-8 ${className}` : className}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
