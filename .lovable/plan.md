

# Fix: Tooltip popover cut off in Customer Segmentation

## Problem
The customer detail tooltip in "Klant Segmentatie" uses `side="right"`, but the card is already positioned on the right side of the page. This causes the tooltip to overflow outside the viewport and be partially hidden.

## Solution
Change the tooltip to use `side="left"` so it appears on the left side of the customer row, where there is more available space. Additionally, add `collisionPadding` to ensure Radix automatically repositions the tooltip if it would still overflow.

## Changes

### File: `src/components/production/CustomerSegmentation.tsx`
- **Line 325**: Change `<TooltipContent side="right" className="max-w-xs">` to `<TooltipContent side="left" collisionPadding={16} className="max-w-xs">`

This is a single-line change. The `collisionPadding` prop ensures a 16px buffer from the viewport edge, and Radix will automatically flip the tooltip to another side if there still isn't enough room.

