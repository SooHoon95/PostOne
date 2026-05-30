import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary",
        secondary: "bg-muted text-muted-foreground",
        success: "bg-success/10 text-success",
        destructive: "bg-destructive/10 text-destructive",
        outline: "border-border text-muted-foreground",
        "channel-linkedin": "bg-channel-linkedin/10 text-channel-linkedin",
        "channel-threads": "bg-channel-threads/10 text-channel-threads",
        "channel-instagram": "bg-channel-instagram/10 text-channel-instagram",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const dotVariants = cva("size-1.5 shrink-0 rounded-full", {
  variants: {
    variant: {
      default: "bg-primary",
      secondary: "bg-muted-foreground",
      success: "bg-success",
      destructive: "bg-destructive",
      outline: "bg-muted-foreground",
      "channel-linkedin": "bg-channel-linkedin",
      "channel-threads": "bg-channel-threads",
      "channel-instagram": "bg-channel-instagram",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Render a leading status dot tinted to match the variant. */
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className={cn(dotVariants({ variant }))} aria-hidden="true" />}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
