

## Fix: Disable Floating/Sticky Footer in Gas Cylinder Order Dialog

### Problem
The "Order aanmaken" and "Annuleren" buttons in the Gas Cylinder Order dialog appear as a floating sticky footer on mobile. This is because `ResponsiveDialogFooter` applies `sticky bottom-0` styling on mobile via the Drawer component.

### Solution
Replace `ResponsiveDialogFooter` with a regular `div` (or a non-sticky footer) so the buttons scroll naturally with the form content instead of floating at the bottom.

### Changes

**File: `src/components/production/CreateGasCylinderOrderDialog.tsx`**
- Replace `<ResponsiveDialogFooter>` with a plain `<div>` styled with appropriate flex layout and spacing, removing the sticky/floating behavior
- Remove `ResponsiveDialogFooter` from the imports if no longer used

This is a minimal change -- only the footer wrapper element changes; the buttons themselves remain identical.

