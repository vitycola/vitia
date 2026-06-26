> Adapted from native spec for web PWA architecture (Vite + React + Tailwind CSS). Original: sdd/design-system/spec

# Design-System Specification

## Purpose

Establish a single semantic token layer for all visual values in the Vitia app. Every color, radius, shadow, and macro palette value MUST originate from one source of truth consumed by both Tailwind class names and inline style/SVG color values.

---

## Token Inventory

| Token name | Semantic meaning | Hex value | Tailwind alias |
|---|---|---|---|
| surface | App / screen background | #F2F2F7 | bg-surface |
| card | Card surface (white) | #FFFFFF | bg-card |
| accent | Brand primary / CTA | #F5A623 | bg-accent, text-accent |
| text-primary | Body / heading text | #1C1C1E | text-primary |
| text-secondary | Supporting / meta text | #8E8E93 | text-secondary |
| text-disabled | Placeholder / disabled text | #C7C7CC | text-disabled |
| border | Hairline / card border | #E5E5EA | border-default |
| destructive | Error / delete action | #FF3B30 | text-destructive, bg-destructive |
| macro-amber | Macro bar default state (all three macros) | #F5A623 | bg-macro-amber, text-macro-amber |
| macro-ontarget-green | Macro bar on-target state (80–110% of goal) | #16a34a | bg-macro-ontarget-green, text-macro-ontarget-green |

> **Removed tokens**: `macro-protein`, `macro-carbs`, `macro-fat` (distinct per-macro colors) are GONE. They are replaced by the two state tokens above. Do NOT reintroduce per-macro distinct colors.

Radius and shadow are NOT color tokens; they are structural. Card radius stays `rounded-2xl` (16 px). Accent radius stays `rounded-xl` (12 px). Shadow stays `shadow-sm`.

---

## Macro Bar Color State Logic (CRITICAL)

All three macro progress bars (protein, carbs, fat) follow identical color state logic. The color is determined per-macro independently.

**Rule:**
- DEFAULT color (any state): `macro-amber` = `#F5A623`
- ON-TARGET color: `macro-ontarget-green` = `#16a34a`

**On-target condition** (per macro, independently calculated):
```
consumed / goal >= 0.80 AND consumed / goal <= 1.10
```

**Outside that band** (below 80% OR above 110%) → amber `#F5A623`.

### Acceptance Criteria — Macro Bar Color

| consumed / goal | Expected bar color | Token |
|---|---|---|
| 0% (no intake) | Amber | macro-amber |
| 79% | Amber | macro-amber |
| 80% | Green | macro-ontarget-green |
| 100% | Green | macro-ontarget-green |
| 110% | Green | macro-ontarget-green |
| 111% | Amber | macro-amber |
| 150% | Amber | macro-amber |

**Explicit scenario (required for implementation acceptance):**
- GIVEN a macro at 79% of goal → bar MUST render amber `#F5A623`
- GIVEN a macro at 80% of goal → bar MUST render green `#16a34a`
- GIVEN a macro at 110% of goal → bar MUST render green `#16a34a`
- GIVEN a macro at 111% of goal → bar MUST render amber `#F5A623`

The logic MUST be implemented as a pure helper (e.g. `getMacroBarColor(consumed: number, goal: number): string`) that returns `Colors.macroOntargetGreen` or `Colors.macroAmber`. It MUST NOT contain hardcoded hex strings — only token references.

---

## Cross-Reference Note: Meal Card Layout

Meal card title and macro-summary line are STACKED (title on top, macro summary directly below). This layout is enforced in the `home-screen-redesign` change, not this design-system change. Recorded here as a cross-reference only. The design-system spec owns only the color tokens; it does not own meal card layout structure.

---

## Migration Rules

### Green classes that MUST become accent
| Before | After |
|---|---|
| `bg-green-600` (brand) | `bg-accent` |
| `text-green-600` | `text-accent` |
| `text-green-700` | `text-accent` |
| `border-green-*` (brand) | `border-default` or `border-accent` per context |
| Hardcoded `#16a34a` in brand/CTA inline styles or SVG fills | `Colors.accent` from tokens.ts |

### Macro bar classes
| Before | After |
|---|---|
| `bg-green-600` / `text-green-600` on macro protein | `bg-macro-ontarget-green` (only when 80–110%) or `bg-macro-amber` |
| `bg-amber-*` / hardcoded amber on macro bars | `bg-macro-amber` |
| `bg-rose-*` / `#fb7185` on macro fat bar | `bg-macro-amber` (fat bar is amber by default, same as others) |
| Per-macro distinct color tokens | REMOVED — use state tokens only |

### Other surface / text / border renames
| Before | After |
|---|---|
| `bg-gray-50` | `bg-surface` |
| `text-gray-900` | `text-primary` |
| `text-gray-500` | `text-secondary` |
| `border-gray-200` | `border-default` |
| `#ef4444` (destructive inline style/SVG) | `Colors.destructive` |

---

## Requirements

### Requirement: Token Source of Truth (tokens.ts)

`lib/tokens.ts` MUST export all semantic values as typed JS/TS constants. It MUST NOT import from Tailwind or any CSS file.

The file MUST export:
- Individual named constants: `surface`, `card`, `accent`, `textPrimary`, `textSecondary`, `textDisabled`, `border`, `destructive`, `macroAmber`, `macroOntargetGreen`.
- A `Colors` object that groups all of the above under the same keys for ergonomic destructuring.
- The file MUST be typed: each constant is `string` (hex literal), and `Colors` is `Readonly<Record<keyof typeof Colors, string>>` or equivalent.
- The file MUST be ESM-only (no `module.exports`). No CJS mirror is required.

**Note**: `macroAmber` has the same hex as `accent` (`#F5A623`) but is a distinct semantic token. They MUST be separate named exports — do NOT collapse them into one.

#### Scenario: Token file exports are complete

- GIVEN `lib/tokens.ts` has been created
- WHEN a component imports `{ Colors }` from `lib/tokens.ts`
- THEN `Colors.macroAmber`, `Colors.macroOntargetGreen`, and all base tokens are accessible
- AND `Colors.macroAmber === '#F5A623'` and `Colors.macroOntargetGreen === '#16a34a'`

#### Scenario: No import from Tailwind or CSS

- GIVEN `lib/tokens.ts`
- WHEN the file is statically analyzed for imports
- THEN it MUST NOT import from `tailwind.config.ts`, any CSS file, or any CSS-in-JS runtime

---

### Requirement: Tailwind Semantic Aliases (tailwind.config.ts)

`tailwind.config.ts` MUST import from `lib/tokens.ts` and extend `theme.colors` with all semantic aliases listed in the Token Inventory table.

The following class names MUST be generatable by Tailwind:
`bg-surface`, `bg-card`, `bg-accent`, `text-primary`, `text-secondary`, `text-disabled`, `text-accent`, `border-default`, `bg-destructive`, `text-destructive`, `bg-macro-amber`, `text-macro-amber`, `bg-macro-ontarget-green`, `text-macro-ontarget-green`.

No CSS custom properties (`var()`) MUST appear in the generated output for these tokens. Tailwind CSS 3.4 resolves tokens at build time to static hex values.

#### Scenario: Semantic class resolves to correct hex

- GIVEN `tailwind.config.ts` has imported tokens and mapped semantic aliases
- WHEN Tailwind processes `className="bg-accent"`
- THEN the generated CSS resolves to `background-color: #F5A623` with no `var()` reference

#### Scenario: Macro state token classes resolve correctly

- GIVEN the Tailwind config
- WHEN `className="bg-macro-ontarget-green"` is used
- THEN it resolves to `background-color: #16a34a`
- WHEN `className="bg-macro-amber"` is used
- THEN it resolves to `background-color: #F5A623`

---

### Requirement: Macro Bar Color Helper

A pure helper function MUST exist (suggested: `lib/macroColor.ts` or co-located in `lib/tokens.ts`) that encapsulates the 80–110% band logic.

```ts
// Signature (implementation detail — exact location may vary per design phase)
function getMacroBarColor(consumed: number, goal: number): string
```

- Returns `Colors.macroOntargetGreen` when `goal > 0` and `consumed / goal >= 0.80` and `consumed / goal <= 1.10`.
- Returns `Colors.macroAmber` in all other cases (including `goal === 0`).
- MUST NOT contain hardcoded hex strings.
- MUST be unit-tested with at least the four boundary cases: 79%, 80%, 110%, 111%.

#### Scenario: Helper boundary correctness

- GIVEN `getMacroBarColor(79, 100)` → returns `Colors.macroAmber` (`#F5A623`)
- GIVEN `getMacroBarColor(80, 100)` → returns `Colors.macroOntargetGreen` (`#16a34a`)
- GIVEN `getMacroBarColor(110, 100)` → returns `Colors.macroOntargetGreen` (`#16a34a`)
- GIVEN `getMacroBarColor(111, 100)` → returns `Colors.macroAmber` (`#F5A623`)
- GIVEN `getMacroBarColor(0, 0)` (no goal set) → returns `Colors.macroAmber`

---

### Requirement: Inline Style Color Values Use Token Imports

Any JSX element using inline `style={{ color: X }}`, `style={{ backgroundColor: X }}`, or SVG attributes (`fill`, `stroke`) MUST reference `Colors.<key>` imported from `lib/tokens.ts`.

Hardcoded hex strings in these positions MUST NOT remain for any value that has a corresponding token.

#### Scenario: No orphaned hex in inline styles or SVG props

- GIVEN the full component tree after migration
- WHEN all files under `src/components/` and `src/routes/` are searched for hex literals in inline style position or SVG attribute position
- THEN zero matches for `#16a34a`, `#F5A623`, `#fb7185`, `#FF3B30`, `#F2F2F7`, `#1C1C1E`, `#8E8E93`, `#C7C7CC`, `#E5E5EA`, `#FFFFFF` outside of `lib/tokens.ts` itself

---

### Requirement: No Hardcoded Hex in className Props

After migration, `className` props across the codebase MUST NOT contain raw hex color values.

#### Scenario: className props contain no hex literals

- GIVEN all component files after migration
- WHEN all `className` attribute values are inspected
- THEN no value contains a substring matching `/#[0-9a-fA-F]{3,6}/`

---

### Requirement: No Orphaned Unsemantic Green or Rose Classes

After migration:
- Any `green-*` Tailwind class MUST map to `macro-ontarget-green` (only when 80–110% condition is met) or `accent` (brand context). No other green classes permitted.
- Any `rose-*` or `pink-*` class previously used for fat macro bar MUST be replaced with `macro-amber`.
- Any `amber-*` class on macro bars MUST be replaced with `macro-amber`.

#### Scenario: Brand green classes are replaced

- GIVEN a component that previously used `bg-green-600` for a CTA/button/badge
- WHEN the migration is applied
- THEN the class is `bg-accent` and the element renders with `#F5A623`

#### Scenario: Fat macro bar no longer uses rose

- GIVEN a macro bar for fat that previously used `text-rose-400` or `#fb7185`
- WHEN the migration is applied
- THEN the bar uses `getMacroBarColor()` result and renders amber or green per state

---

### Requirement: src/index.css Contains Only Tailwind Directives

`src/index.css` MUST contain only the standard Tailwind directives (`@tailwind base`, `@tailwind components`, `@tailwind utilities` — or the equivalent Tailwind CSS 4 `@import "tailwindcss"` directive). It MUST NOT define CSS custom properties (`--color-*`, `var()`) for design token values.

#### Scenario: src/index.css has no CSS custom properties for tokens

- GIVEN `src/index.css` after migration
- WHEN the file is inspected
- THEN it contains no lines defining `--` CSS custom properties for color tokens or containing `var(--` references to color tokens

---

## Out of Scope

- Component layout or visual redesign (Button, Input, Card shape changes)
- New screens or navigation changes
- Typography / custom font loading
- Dark mode or CSS variable theming
- Spacing scale changes
- Meal card stacking layout (owned by home-screen-redesign change)

---

## Implementation Warning

The first implementation of this design-system was REJECTED because it used per-macro distinct colors (green for protein, amber for carbs, rose for fat) instead of the state-based amber/green model described here. Any implementation that assigns a fixed color per macro type is NON-COMPLIANT. The color is determined by consumption state, not macro type.
