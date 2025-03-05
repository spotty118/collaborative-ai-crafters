
import * as React from "react";
import { cn } from "@/lib/utils";

interface StepperProps {
  value: number;
  children: React.ReactNode;
  className?: string;
}

const Stepper = React.forwardRef<
  HTMLDivElement,
  StepperProps
>(({ value, children, className, ...props }, ref) => {
  const steps = React.Children.toArray(children).filter(
    (child) => React.isValidElement(child) && child.type === Step
  ) as React.ReactElement[];
  
  return (
    <div
      ref={ref}
      className={cn("flex w-full items-center", className)}
      {...props}
    >
      {steps.map((step, index) => {
        const stepValue = step.props.value;
        const isActive = stepValue === value;
        const isCompleted = stepValue < value;
        const isLast = index === steps.length - 1;
        
        return (
          <React.Fragment key={index}>
            {React.cloneElement(step, {
              isActive,
              isCompleted,
            })}
            
            {!isLast && (
              <div
                className={cn(
                  "h-1 flex-1 mx-2",
                  isCompleted ? "bg-primary" : "bg-gray-200"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
});

Stepper.displayName = "Stepper";

interface StepProps {
  value: number;
  isActive?: boolean;
  isCompleted?: boolean;
  children: React.ReactNode;
}

const Step = React.forwardRef<
  HTMLDivElement,
  StepProps
>(({ isActive, isCompleted, children, ...props }, ref) => {
  return (
    <div ref={ref} className="flex flex-col items-center" {...props}>
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border",
          isActive
            ? "border-primary bg-primary text-white"
            : isCompleted
            ? "border-primary bg-primary text-white"
            : "border-gray-300 bg-white text-gray-500"
        )}
      >
        {isCompleted ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          props.value
        )}
      </div>
      <div className="mt-2 text-center">{children}</div>
    </div>
  );
});

Step.displayName = "Step";

interface StepTitleProps {
  children: React.ReactNode;
  className?: string;
}

const StepTitle = React.forwardRef<
  HTMLParagraphElement,
  StepTitleProps
>(({ children, className, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={cn("text-sm font-medium", className)}
      {...props}
    >
      {children}
    </p>
  );
});

StepTitle.displayName = "StepTitle";

interface StepDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

const StepDescription = React.forwardRef<
  HTMLParagraphElement,
  StepDescriptionProps
>(({ children, className, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={cn("text-xs text-gray-500", className)}
      {...props}
    >
      {children}
    </p>
  );
});

StepDescription.displayName = "StepDescription";

export { Stepper, Step, StepTitle, StepDescription };
