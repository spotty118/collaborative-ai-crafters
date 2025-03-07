
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { memo } from "react"

// Memoize individual toast to prevent unnecessary re-renders
const MemoizedToast = memo(function MemoizedToast({ 
  id, 
  title, 
  description, 
  action, 
  ...props 
}: { 
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  [key: string]: any;
}) {
  return (
    <Toast key={id} {...props}>
      <div className="grid gap-1">
        {title && <ToastTitle>{title}</ToastTitle>}
        {description && (
          <ToastDescription>{description}</ToastDescription>
        )}
      </div>
      {action}
      <ToastClose />
    </Toast>
  );
});

export function Toaster() {
  const { toasts } = useToast()

  // Limit visible toasts to improve performance
  const visibleToasts = toasts.slice(0, 3);

  return (
    <ToastProvider>
      {visibleToasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <MemoizedToast 
            key={id}
            id={id}
            title={title}
            description={description}
            action={action}
            {...props}
          />
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
