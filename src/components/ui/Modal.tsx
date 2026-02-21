// Hero UI Modal 封装
import { Modal as HeroModal, ModalProps } from "@heroui/react";
import { forwardRef } from "react";

export const Modal = forwardRef<HTMLDivElement, ModalProps>((props, ref) => {
  return (
    <HeroModal
      ref={ref}
      classNames={{
        base: "bg-panel border border-border2 rounded-[var(--radius)] shadow-[var(--shadow-float)]",
        header: "border-b border-border",
        body: "py-6",
        footer: "border-t border-border",
        closeButton: "text-text-dim hover:text-accent",
      }}
      backdrop="blur"
      {...props}
    />
  );
});

Modal.displayName = "Modal";
