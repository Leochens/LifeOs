// Hero UI Input 封装
import { Input as HeroInput, InputProps, Textarea as HeroTextarea } from "@heroui/react";
import type { TextAreaProps } from "@heroui/react";
import { forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  return (
    <HeroInput
      ref={ref}
      variant="bordered"
      classNames={{
        input: "bg-transparent",
        inputWrapper: "border-border bg-panel hover:border-border2 group-data-[focused=true]:border-accent",
      }}
      {...props}
    />
  );
});

Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextAreaProps>((props, ref) => {
  return (
    <HeroTextarea
      ref={ref}
      variant="bordered"
      classNames={{
        input: "bg-transparent",
        inputWrapper: "border-border bg-panel hover:border-border2 group-data-[focused=true]:border-accent",
      }}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";
