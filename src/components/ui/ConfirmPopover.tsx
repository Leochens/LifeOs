import { useState, useRef, useEffect, type ReactNode } from "react";

export interface ConfirmPopoverProps {
  /** 触发确认气泡的按钮 */
  trigger: ReactNode;
  /** 确认按钮的文本 */
  confirmText?: string;
  /** 取消按钮的文本 */
  cancelText?: string;
  /** 确认后的回调 */
  onConfirm: () => void;
  /** 取消后的回调（可选） */
  onCancel?: () => void;
  /** 确认按钮的颜色，默认 red */
  confirmColor?: "red" | "accent" | "primary";
  /** 弹窗提示文字 */
  message?: string;
  /** 相对于触发器的位置 */
  placement?: "top" | "bottom" | "left" | "right";
}

export function ConfirmPopover({
  trigger,
  confirmText = "确认",
  cancelText = "取消",
  onConfirm,
  onCancel,
  confirmColor = "red",
  message = "确定要执行此操作吗？",
  placement = "top",
}: ConfirmPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleConfirm = () => {
    onConfirm();
    setIsOpen(false);
  };

  const handleCancel = () => {
    onCancel?.();
    setIsOpen(false);
  };

  const colorMap = {
    red: {
      bg: "bg-red-500/80 hover:bg-red-500",
      text: "text-red-500",
      border: "border-red-500/30",
    },
    accent: {
      bg: "bg-accent/80 hover:bg-accent",
      text: "text-accent",
      border: "border-accent/30",
    },
    primary: {
      bg: "bg-[var(--panel2)]/80 hover:bg-[var(--panel2)]",
      text: "text-[var(--text)]",
      border: "border-[var(--border)]",
    },
  };

  const colors = colorMap[confirmColor];

  const placementStyles: Record<string, React.CSSProperties> = {
    top: { bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: "8px" },
    bottom: { top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: "8px" },
    left: { right: "100%", top: "50%", transform: "translateY(-50%)", marginRight: "8px" },
    right: { left: "100%", top: "50%", transform: "translateY(-50%)", marginLeft: "8px" },
  };

  return (
    <div className="relative inline-flex">
      <div ref={triggerRef} onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute z-[200] min-w-[180px] py-2 px-3 bg-[var(--panel)] border border-border rounded-[var(--radius)] shadow-[0_4px_20px_rgba(0,0,0,0.4)] animate-in fade-in zoom-in-95 duration-150"
          style={placementStyles[placement]}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[12px] text-[var(--text-dim)] mb-3 leading-relaxed">
            {message}
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-[11px] rounded-[var(--radius-sm)] bg-transparent border border-[var(--border)] text-[var(--text-dim)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors cursor-pointer"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              className={`px-3 py-1.5 text-[11px] rounded-[var(--radius-sm)] text-white transition-colors cursor-pointer ${colors.bg}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
