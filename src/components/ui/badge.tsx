import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded border px-[7px] py-0.5 text-[10px] font-mono font-normal uppercase tracking-[0.1em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-[#99D6D2] bg-[#F0FAFA] text-[#009A8E]",
        secondary: "border-[#E5E7EB] bg-[#F3F4F6] text-[#4B5563]",
        destructive: "border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]",
        outline: "text-[#4B5563] border-[#E5E7EB]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />;
  }
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
