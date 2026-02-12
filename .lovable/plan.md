
# Fix: Bottom content hidden in mobile cylinder order form

## Problem
On mobile, the gas cylinder order form uses a `Drawer` (via `ResponsiveDialog`). The form content is long, and the bottom elements (the "Reeds uitgevoerd" toggle and the "Order aanmaken" / "Annuleren" buttons) are cut off and not reachable by scrolling.

## Root Cause
In `src/components/ui/responsive-dialog.tsx`, the mobile `DrawerContent` wrapper uses `pb-safe` for bottom padding, but this only accounts for the device safe area inset -- not the actual space needed for the content to fully scroll into view. The drawer's handle/chrome also consumes space.

## Solution
Update the `ResponsiveDialogContent` component to add sufficient bottom padding on mobile so all content (including the footer) is fully scrollable.

## Changes

### File: `src/components/ui/responsive-dialog.tsx`
- **Line 111**: Change the inner scrollable div class from `"overflow-y-auto pb-safe"` to `"overflow-y-auto pb-safe pb-8"` (or use a larger value like `pb-10`) to add extra bottom padding that ensures the footer buttons are always reachable when scrolling.
- Alternatively, a more robust approach: make the footer **sticky at the bottom** of the drawer so it's always visible, and only the form content scrolls. This would involve:
  - Splitting children into "scrollable body" and "fixed footer"
  - Restructuring the layout with `flex flex-col` and `overflow-y-auto` on the body only

**Recommended approach**: Add `pb-8` to the scrollable container. It's simple and non-breaking.

### Technical Details

```text
Current structure (mobile):
+---------------------------+
| DrawerContent (max-h-90vh)|
|  +----------------------+ |
|  | overflow-y-auto      | |
|  |  Header              | |
|  |  Form fields...      | |
|  |  Toggle              | |  <-- hidden
|  |  Footer buttons      | |  <-- hidden
|  +----------------------+ |
+---------------------------+

Fix: add pb-8 so content can scroll far enough
```

Single line change in `responsive-dialog.tsx` line 111:
- From: `className="overflow-y-auto pb-safe"`
- To: `className="overflow-y-auto pb-safe pb-8"`
