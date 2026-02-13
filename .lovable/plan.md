

## Fix: Remove Excess Whitespace in Mobile Cylinder Order Dialog

### Problem
The `ResponsiveDialogContent` component on mobile uses `max-h-[90vh] flex flex-col` on the DrawerContent and `flex-1` on the inner scrollable div. This forces the drawer to always take up 90% of the viewport height, even when the form content is shorter -- resulting in a large empty white area below the last field.

### Solution
Update the `ResponsiveDialogContent` in `src/components/ui/responsive-dialog.tsx` to use `h-auto` sizing instead of forcing the drawer to stretch. Remove `flex-1` from the inner div so the drawer naturally fits its content.

### Changes

**File: `src/components/ui/responsive-dialog.tsx`**

In the `ResponsiveDialogContent` function, change the mobile branch:

Before:
```tsx
<DrawerContent className={cn("max-h-[90vh] flex flex-col", className)}>
  <div className="overflow-y-auto flex-1 pb-safe pb-8">
    {children}
  </div>
</DrawerContent>
```

After:
```tsx
<DrawerContent className={cn("max-h-[90vh]", className)}>
  <div className="overflow-y-auto pb-safe pb-8">
    {children}
  </div>
</DrawerContent>
```

This removes `flex flex-col` from the outer container and `flex-1` from the inner div, so the drawer height is determined by content size (up to the 90vh max). The form will no longer have empty whitespace below it.
