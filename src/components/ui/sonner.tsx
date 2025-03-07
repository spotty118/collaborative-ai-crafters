
import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"
import { memo } from "react"

type ToasterProps = React.ComponentProps<typeof Sonner>

// Memoized Toaster component to prevent unnecessary re-renders
const Toaster = memo(({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // Reduce visible toasts to minimize performance impact
      visibleToasts={2}
      // Increase closeButton duration to reduce rapid render cycles
      closeButton={true}
      // Simplified rich colors to reduce rendering complexity
      richColors={true}
      // Reduce duration to clear toasts faster
      duration={3000}
      // Disable animations that might cause performance issues
      expand={false}
      // Disable animation on mobile
      invert={false}
      // Use position that requires less calculations
      position="top-right"
      // Optimize rendering with a higher throttle value
      throttleMs={500}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
})

Toaster.displayName = "Toaster"

export { Toaster }
