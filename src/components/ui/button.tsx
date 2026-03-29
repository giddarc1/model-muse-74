import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[5px] text-[13px] font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:bg-[#D1D5DB] disabled:text-[#9CA3AF] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-[#009A8E] active:bg-[#008578]",
        destructive: "bg-white border border-[#FECACA] text-[#DC2626] hover:bg-[#FEF2F2]",
        outline: "bg-white border border-[#D1D5DB] text-[#374151] hover:bg-[#F9FAFB] hover:border-[#9CA3AF] active:bg-[#F3F4F6]",
        secondary: "bg-white border border-[#D1D5DB] text-[#374151] hover:bg-[#F9FAFB] hover:border-[#9CA3AF] active:bg-[#F3F4F6]",
        ghost: "bg-transparent text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] active:bg-[#E5E7EB]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-[18px] py-[7px]",
        sm: "h-8 rounded-[5px] px-3 text-xs",
        lg: "h-10 rounded-[5px] px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
