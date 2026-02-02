import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  CalendarX2,
  ClipboardList,
  Package,
  Users,
  Snowflake,
  Cylinder,
  Search,
  FileX,
  Inbox,
  Bell,
  type LucideIcon,
} from "lucide-react";

type EmptyStateVariant =
  | "calendar"
  | "tasks"
  | "orders"
  | "customers"
  | "dryice"
  | "gascylinder"
  | "search"
  | "notifications"
  | "generic";

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  size?: "sm" | "md" | "lg";
}

const variantConfig: Record<
  EmptyStateVariant,
  { icon: LucideIcon; defaultTitle: string; defaultDescription: string; colors: string }
> = {
  calendar: {
    icon: CalendarX2,
    defaultTitle: "Geen items gepland",
    defaultDescription: "Er zijn geen verlofaanvragen of taken voor deze periode.",
    colors: "from-primary/20 to-primary/5 text-primary",
  },
  tasks: {
    icon: ClipboardList,
    defaultTitle: "Geen taken",
    defaultDescription: "Er zijn nog geen taken toegewezen.",
    colors: "from-blue-500/20 to-blue-500/5 text-blue-500",
  },
  orders: {
    icon: Package,
    defaultTitle: "Geen orders",
    defaultDescription: "Er zijn geen orders voor deze periode.",
    colors: "from-amber-500/20 to-amber-500/5 text-amber-500",
  },
  customers: {
    icon: Users,
    defaultTitle: "Geen klanten",
    defaultDescription: "Er zijn nog geen klanten toegevoegd.",
    colors: "from-emerald-500/20 to-emerald-500/5 text-emerald-500",
  },
  dryice: {
    icon: Snowflake,
    defaultTitle: "Geen droogijs orders",
    defaultDescription: "Er zijn geen droogijs orders voor deze datum.",
    colors: "from-cyan-500/20 to-cyan-500/5 text-cyan-500",
  },
  gascylinder: {
    icon: Cylinder,
    defaultTitle: "Geen gascilinder orders",
    defaultDescription: "Er zijn geen gascilinder orders voor deze datum.",
    colors: "from-indigo-500/20 to-indigo-500/5 text-indigo-500",
  },
  search: {
    icon: Search,
    defaultTitle: "Geen resultaten",
    defaultDescription: "Probeer andere zoektermen of filters.",
    colors: "from-slate-500/20 to-slate-500/5 text-slate-500",
  },
  notifications: {
    icon: Bell,
    defaultTitle: "Geen notificaties",
    defaultDescription: "Je bent helemaal bij!",
    colors: "from-violet-500/20 to-violet-500/5 text-violet-500",
  },
  generic: {
    icon: Inbox,
    defaultTitle: "Geen gegevens",
    defaultDescription: "Er zijn nog geen gegevens beschikbaar.",
    colors: "from-muted-foreground/20 to-muted-foreground/5 text-muted-foreground",
  },
};

const sizeConfig = {
  sm: {
    container: "py-6",
    iconContainer: "w-12 h-12",
    icon: "w-6 h-6",
    title: "text-sm",
    description: "text-xs",
  },
  md: {
    container: "py-10",
    iconContainer: "w-16 h-16",
    icon: "w-8 h-8",
    title: "text-base",
    description: "text-sm",
  },
  lg: {
    container: "py-16",
    iconContainer: "w-20 h-20",
    icon: "w-10 h-10",
    title: "text-lg",
    description: "text-base",
  },
};

const EmptyState = React.memo(function EmptyState({
  variant = "generic",
  title,
  description,
  action,
  className,
  size = "md",
}: EmptyStateProps) {
  const config = variantConfig[variant];
  const sizes = sizeConfig[size];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "flex flex-col items-center justify-center text-center",
        sizes.container,
        className
      )}
    >
      {/* Illustrated icon with background */}
      <div className="relative mb-4">
        {/* Background glow */}
        <div
          className={cn(
            "absolute inset-0 rounded-full bg-gradient-to-br blur-xl opacity-50",
            config.colors
          )}
        />
        
        {/* Decorative rings */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="absolute inset-0 rounded-full border-2 border-current opacity-10 scale-150"
        />
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="absolute inset-0 rounded-full border border-current opacity-5 scale-[2]"
        />
        
        {/* Icon container */}
        <motion.div
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ 
            type: "spring",
            stiffness: 200,
            damping: 15,
            delay: 0.1
          }}
          className={cn(
            "relative rounded-full bg-gradient-to-br flex items-center justify-center",
            config.colors,
            sizes.iconContainer
          )}
        >
          <Icon className={cn(sizes.icon, "opacity-80")} />
        </motion.div>
      </div>

      {/* Title */}
      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className={cn(
          "font-semibold text-foreground mb-1",
          sizes.title
        )}
      >
        {title || config.defaultTitle}
      </motion.h3>

      {/* Description */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className={cn(
          "text-muted-foreground max-w-[280px]",
          sizes.description
        )}
      >
        {description || config.defaultDescription}
      </motion.p>

      {/* Action button */}
      {action && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-4"
        >
          <Button
            onClick={action.onClick}
            size={size === "sm" ? "sm" : "default"}
            className="gap-2"
          >
            {action.label}
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
});

EmptyState.displayName = "EmptyState";

export { EmptyState, type EmptyStateVariant };
