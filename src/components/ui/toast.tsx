"use client";
import { Toast as Primitive } from "radix-ui";
import { X } from "lucide-react";
export const ToastProvider = Primitive.Provider;
export function Toast({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <Primitive.Root
        open={open}
        onOpenChange={onOpenChange}
        className="flex items-center gap-6 rounded-xl bg-midnight p-4 text-white shadow-lg"
      >
        <Primitive.Description>{children}</Primitive.Description>
        <Primitive.Close aria-label="Dismiss notification" className="p-1">
          <X size={18} />
        </Primitive.Close>
      </Primitive.Root>
      <Primitive.Viewport className="fixed right-4 bottom-4 z-50 max-w-[90vw]" />
    </>
  );
}
