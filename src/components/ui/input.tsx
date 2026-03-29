import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-[5px] border border-[#D1D5DB] bg-white px-3 py-[7px] text-[13px] text-[#111827] ring-offset-background placeholder:text-[#9CA3AF] focus-visible:outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          type === "number" && "font-mono text-right bg-[#F9FAFB]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
