
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const Stepper = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: number }
>(({ className, value, children, ...props }, ref) => {
  const childrenArray = React.Children.toArray(children);

  return (
    <div
      ref={ref}
      className={cn("space-y-4", className)}
      {...props}
    >
      <div className="flex items-center">
        {childrenArray.map((child, index) => (
          <React.Fragment key={index}>
            {index > 0 && (
              <div
                className={cn(
                  "h-1 flex-1 mx-2",
                  index <= value - 1
                    ? "bg-primary"
                    : "bg-gray-200"
                )}
              />
            )}
            {React.isValidElement(child) &&
              React.cloneElement(child as React.ReactElement<any>, {
                index: index + 1,
                active: index + 1 === value,
                completed: index + 1 < value
              })}
          </React.Fragment>
        ))}
      </div>
      <div>{children}</div>
    </div>
  );
});
Stepper.displayName = "Stepper";

const Step = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    index?: number;
    active?: boolean;
    completed?: boolean;
  }
>(({ className, index, active, completed, children, value, ...props }, ref) => {
  // Remove value prop before passing to div
  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : completed
          ? "bg-primary text-primary-foreground"
          : "bg-gray-200 text-gray-700",
        className
      )}
      {...props}
    >
      {index}
    </div>
  );
});
Step.displayName = "Step";

const StepTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={cn("text-sm font-medium", className)}
      {...props}
    />
  );
});
StepTitle.displayName = "StepTitle";

const StepDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={cn("text-xs text-gray-500", className)}
      {...props}
    />
  );
});
StepDescription.displayName = "StepDescription";

export { Stepper, Step, StepTitle, StepDescription };
