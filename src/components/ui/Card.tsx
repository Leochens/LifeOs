// Hero UI Card 封装
import { Card as HeroCard, CardProps, CardBody } from "@heroui/react";
import { forwardRef, ReactNode } from "react";

export interface AppCardProps extends CardProps {
  variant?: "default" | "inner";
  children?: ReactNode;
}

export const Card = forwardRef<HTMLDivElement, AppCardProps>(
  ({ variant = "default", className = "", children, ...props }, ref) => {
    return (
      <HeroCard
        ref={ref}
        className={`
          bg-panel border border-border rounded-[var(--radius)] relative overflow-hidden
          before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-[1px]
          before:bg-gradient-to-r before:from-transparent before:via-accent before:to-transparent before:opacity-30
          ${className}
        `}
        {...props}
      >
        {children && <CardBody>{children}</CardBody>}
      </HeroCard>
    );
  }
);

Card.displayName = "Card";
