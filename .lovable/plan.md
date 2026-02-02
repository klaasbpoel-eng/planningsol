

# Plan: Button Color Consistency

## Problem Analysis

After reviewing the codebase, I've identified several inconsistencies in button colors across the application:

### Current Issues

1. **Primary Action Buttons Use Hardcoded Colors Instead of Design System**
   - Gas Cylinder buttons use `bg-orange-500 hover:bg-orange-600` (Tailwind orange)
   - Dry Ice buttons use `bg-cyan-500 hover:bg-cyan-600` (Tailwind cyan)  
   - Tasks use `bg-blue-500` (Tailwind blue)
   - These don't leverage the design system's `accent` color (orange: `32 95% 52%`)

2. **Missing Button Variants**
   - The current button component only has: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`
   - No semantic variants for domain-specific actions (gas cylinders, dry ice, tasks)

3. **Inconsistent Hover States on Outline Buttons**
   - Calendar item creation buttons have custom hover colors: `hover:bg-blue-50`, `hover:bg-cyan-50`
   - This breaks consistency with the standard `outline` variant behavior

### Recommended Approach

Based on the SOL corporate color palette (blue primary, orange accent) and current usage patterns, I recommend:

**Option A - Use Design System Variants (Recommended)**
- Add new button variants that use the design system colors
- Map domain concepts to existing design system colors:
  - **Primary actions** (main CTAs): `default` variant (blue - primary color)
  - **Gas Cylinder actions**: `accent` variant (orange - accent color) 
  - **Dry Ice actions**: New `info` variant (cyan)
  - **Tasks**: Use `default` or new `info` variant

**Option B - Standardize on Primary + Accent Only**
- Use `default` (blue) for all primary actions
- Use new `accent` variant (orange) for emphasized/special actions
- Remove domain-specific color coding from buttons (keep it in icons/badges only)

---

## Proposed Solution: Option A with New Variants

### Step 1: Add New Button Variants to Design System

Update `src/components/ui/button.tsx` to add:

```typescript
const buttonVariants = cva(
  "...",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // NEW VARIANTS:
        accent: "bg-accent text-accent-foreground hover:bg-accent/90",
        success: "bg-success text-success-foreground hover:bg-success/90",
        warning: "bg-warning text-warning-foreground hover:bg-warning/90",
      },
      ...
    }
  }
);
```

### Step 2: Add Domain-Specific Color Variables

Update `src/index.css` to add semantic colors for domain concepts:

```css
:root {
  /* Existing colors... */
  
  /* Domain-specific semantic colors */
  --cylinder: 32 95% 52%;         /* Orange - matches accent */
  --cylinder-foreground: 0 0% 100%;
  --dry-ice: 189 94% 43%;         /* Cyan */
  --dry-ice-foreground: 0 0% 100%;
}
```

### Step 3: Update Components to Use Consistent Variants

| Component | Current | Proposed |
|-----------|---------|----------|
| DryIcePlanning "Nieuwe productieorder" | `bg-cyan-500 hover:bg-cyan-600` | New CSS class or keep as exception |
| GasCylinderPlanning "Nieuwe vulorder" | `bg-orange-500 hover:bg-orange-600` | `variant="accent"` |
| CreateGasCylinderOrderDialog submit | `bg-orange-500 hover:bg-orange-600` | `variant="accent"` |
| CreateDryIceOrderDialog submit | `bg-cyan-500 hover:bg-cyan-600` | Keep cyan or new variant |
| DryIceExcelImportDialog import | `bg-cyan-500 hover:bg-cyan-600` | Keep cyan or new variant |
| CalendarOverview item creation | Custom hover colors | Standardize to `outline` |

### Step 4: Files to Update

1. **src/components/ui/button.tsx** - Add `accent`, `success`, `warning` variants
2. **src/index.css** - Add `--cylinder` and `--dry-ice` CSS variables (optional)
3. **tailwind.config.ts** - Register new color tokens
4. **Component updates** (replacing hardcoded colors):
   - `src/components/production/GasCylinderPlanning.tsx`
   - `src/components/production/CreateGasCylinderOrderDialog.tsx`
   - `src/components/production/DryIcePlanning.tsx`
   - `src/components/production/CreateDryIceOrderDialog.tsx`
   - `src/components/production/DryIceExcelImportDialog.tsx`
   - `src/components/calendar/CalendarOverview.tsx`
   - `src/components/calendar/CreateDryIceOrderCalendarDialog.tsx`
   - `src/components/production/ReportExportButtons.tsx` (dropdown icon colors)

---

## Technical Details

### New Button Variants

```typescript
// In button.tsx
accent: "bg-accent text-accent-foreground hover:bg-accent/90",
success: "bg-success text-success-foreground hover:bg-success/90",  
warning: "bg-warning text-warning-foreground hover:bg-warning/90",
```

### Domain Color Mapping

| Domain | Tailwind Color | Design System Token | Notes |
|--------|---------------|---------------------|-------|
| Gas Cylinders | `orange-500` | `accent` | Already matches! |
| Dry Ice | `cyan-500` | New `--dry-ice` or keep inline | Cyan is not in design system |
| Tasks | `blue-500` | `primary` | Already matches primary |
| Destructive | `red-500` | `destructive` | Already exists |

### Decision: Cyan for Dry Ice

Since cyan is used extensively for dry ice throughout the app, we have two options:

**A) Add cyan to design system** - More consistent, allows variant usage
**B) Keep inline classes** - Simpler, less changes, but less consistent

I recommend **Option A** for true consistency.

---

## Summary of Changes

1. Add 3 new button variants: `accent`, `success`, `warning`
2. Optionally add `--dry-ice` color variable for cyan
3. Replace ~15 instances of hardcoded `bg-orange-500` with `variant="accent"`
4. Replace ~10 instances of hardcoded `bg-cyan-500` with new variant or consistent class
5. Standardize calendar item creation button hover states

This will make the button colors consistent while maintaining the domain-specific visual language (orange for gas cylinders, cyan for dry ice).

