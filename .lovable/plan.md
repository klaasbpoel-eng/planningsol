

# Mobile Optimization for Cylinder Order Form

## Problem
The gas cylinder order form has a lot of fields that create a very long scrollable form on mobile. Key issues:
- Many 2-column grids that don't stack on mobile (they do use `grid-cols-1 sm:grid-cols-2` which is good)
- The calendar date picker popover can be hard to use on small screens
- The notes textarea takes up unnecessary space on mobile
- The form is very long, making it hard to reach the submit button

## Changes

### 1. Reduce notes textarea height on mobile
Shrink the minimum height of the notes field on mobile to save vertical space.

### 2. Compact date picker for mobile
Use a native HTML date input on mobile instead of the popover calendar, which is easier to use and takes less space.

### 3. Reduce vertical spacing on mobile
Tighten the `space-y-4` gap between form fields on mobile to `space-y-3` to fit more content without scrolling.

### 4. Make footer buttons sticky on mobile
Move the footer outside the scrollable area on mobile so the action buttons are always visible -- no more scrolling to find "Order aanmaken".

---

## Technical Details

### File: `src/components/ui/responsive-dialog.tsx`
- Restructure the mobile `DrawerContent` to split content into a scrollable body area and a sticky footer area
- The `ResponsiveDialogFooter` on mobile will render with a sticky bottom position with a subtle top border

### File: `src/components/production/CreateGasCylinderOrderDialog.tsx`
- Change `space-y-4` to `space-y-3 sm:space-y-4` on the form container (line 321)
- Reduce notes textarea `min-h-[80px]` to `min-h-[60px] sm:min-h-[80px]` and rows from 3 to 2 on mobile
- Add a mobile-friendly native date input alternative using `type="date"` on small screens, keeping the popover calendar on desktop

### Summary of files changed
1. `src/components/ui/responsive-dialog.tsx` -- sticky footer on mobile drawer
2. `src/components/production/CreateGasCylinderOrderDialog.tsx` -- compact spacing, smaller textarea, mobile date input

