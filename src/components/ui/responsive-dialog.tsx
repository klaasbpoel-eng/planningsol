import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface ResponsiveDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  handleOnly?: boolean;
}

interface ResponsiveDialogContentProps {
  children: React.ReactNode;
  className?: string;
}

interface ResponsiveDialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface ResponsiveDialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

interface ResponsiveDialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

interface ResponsiveDialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

// Context to share mobile state and handleOnly
const ResponsiveDialogContext = React.createContext<{ isMobile: boolean; handleOnly: boolean }>({
  isMobile: false,
  handleOnly: false,
});

export function ResponsiveDialog({ 
  open, 
  onOpenChange, 
  children,
  handleOnly = false,
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <ResponsiveDialogContext.Provider value={{ isMobile: true, handleOnly }}>
        <Drawer open={open} onOpenChange={onOpenChange} handleOnly={handleOnly}>
          {children}
        </Drawer>
      </ResponsiveDialogContext.Provider>
    );
  }

  return (
    <ResponsiveDialogContext.Provider value={{ isMobile: false, handleOnly: false }}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {children}
      </Dialog>
    </ResponsiveDialogContext.Provider>
  );
}

export function ResponsiveDialogTrigger({ 
  children, 
  asChild 
}: { 
  children: React.ReactNode; 
  asChild?: boolean;
}) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);
  
  if (isMobile) {
    return <DrawerTrigger asChild={asChild}>{children}</DrawerTrigger>;
  }
  return <DialogTrigger asChild={asChild}>{children}</DialogTrigger>;
}

export function ResponsiveDialogContent({ 
  children, 
  className 
}: ResponsiveDialogContentProps) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);

  if (isMobile) {
    return (
      <DrawerContent className={cn("max-h-[90vh]", className)}>
        <div className="overflow-y-auto pb-safe pb-8">
          {children}
        </div>
      </DrawerContent>
    );
  }

  return (
    <DialogContent className={cn("sm:max-w-[500px] max-h-[90vh] overflow-y-auto", className)}>
      {children}
    </DialogContent>
  );
}

export function ResponsiveDialogHeader({ 
  children, 
  className 
}: ResponsiveDialogHeaderProps) {
  const { isMobile, handleOnly } = React.useContext(ResponsiveDialogContext);

  if (isMobile) {
    return (
      <DrawerHeader className={cn("text-left", className)}>
        {children}
      </DrawerHeader>
    );
  }

  return <DialogHeader className={className}>{children}</DialogHeader>;
}

export function ResponsiveDialogFooter({ 
  children, 
  className 
}: ResponsiveDialogFooterProps) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);

  if (isMobile) {
    return (
      <DrawerFooter className={cn("flex-col-reverse gap-2 pt-3 pb-4 pb-safe border-t bg-background sticky bottom-0 z-10 mt-auto", className)}>
        {children}
      </DrawerFooter>
    );
  }

  return <DialogFooter className={className}>{children}</DialogFooter>;
}

export function ResponsiveDialogTitle({ 
  children, 
  className 
}: ResponsiveDialogTitleProps) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);

  if (isMobile) {
    return <DrawerTitle className={className}>{children}</DrawerTitle>;
  }

  return <DialogTitle className={className}>{children}</DialogTitle>;
}

export function ResponsiveDialogDescription({ 
  children, 
  className 
}: ResponsiveDialogDescriptionProps) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);

  if (isMobile) {
    return <DrawerDescription className={className}>{children}</DrawerDescription>;
  }

  return <DialogDescription className={className}>{children}</DialogDescription>;
}

export function ResponsiveDialogClose({ 
  children,
  asChild
}: { 
  children: React.ReactNode;
  asChild?: boolean;
}) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);

  if (isMobile) {
    return <DrawerClose asChild={asChild}>{children}</DrawerClose>;
  }

  return <DialogClose asChild={asChild}>{children}</DialogClose>;
}
