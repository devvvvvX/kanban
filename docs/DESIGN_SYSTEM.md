# Kanban Design System: Linear Precision Slate

> **Design Tokens, Typography Invariants, Eye-Comfort Gradients, and Component Specifications.**

---

## 1. Overview & Creative North Star

**Creative North Star: "Linear Precision Slate"**

A high-craft, native-feeling macOS personal engineering productivity environment designed for sustained flow, deep focus, and high signal-to-noise ratio. The aesthetic draws directly from modern macOS professional tools (Linear, Raycast, Things 3), combining dark obsidian and graphite canvas tones with crisp 1px translucent borders, disciplined 60/30/10 contrast hierarchy, and instant keyboard-first workflows.

Chrome recedes so engineering tasks, whiteboard concepts, and Kanban boards take center stage. Arbitrary decorations and flashy glow effects are strictly rejected in favor of razor-sharp alignment, subtle status pips, and sub-100ms UI responsiveness.

---

## 2. Color Palette & The 60/30/10 Rule

The interface strictly follows the 60/30/10 distribution rule:
- **60% Dominant Canvas**: Calm obsidian or subtle light ground.
- **30% Structural Layers**: Sidebar, card surfaces, and popover panels.
- **10% Purposeful Accent**: Electric Blue interactive highlights.

### Dark Mode Tokens (Default)
| Token | Value | Semantic Role |
|---|---|---|
| `--color-bg-primary` | `#0D0F12` | 60% Dominant application canvas |
| `--color-bg-secondary` | `#15181E` | Sidebar, header bar, and drawer panels |
| `--color-bg-card` | `#1C2028` | Elevated Kanban cards, modals, and dropdowns |
| `--color-bg-inset` | `#232834` | Search inputs, tag chips, and hover states |
| `--color-border-subtle` | `rgba(255, 255, 255, 0.08)` | Hairline dividers and column borders |
| `--color-border-default` | `rgba(255, 255, 255, 0.14)` | Card outlines, active borders, and focus rings |
| `--color-accent` | `#3B82F6` | Electric Blue primary focal points and key buttons |

### Light Mode Tokens
| Token | Value | Semantic Role |
|---|---|---|
| `--color-bg-primary` | `#F8F9FA` | Light canvas ground |
| `--color-bg-secondary` | `#FFFFFF` | Crisp white sidebar and elevated headers |
| `--color-bg-card` | `#FFFFFF` | Clean white cards with subtle shadow |
| `--color-border-subtle` | `rgba(0, 0, 0, 0.08)` | Hairline dividers |
| `--color-border-default` | `rgba(0, 0, 0, 0.14)` | Card and input borders |
| `--color-accent` | `#2563EB` | Deep sapphire blue interactive accent |

### Semantic Status Tokens
- **Success Emerald** (`#10B981`): Completed workflow states and passing tests.
- **Warning Amber** (`#F59E0B`): In-progress tasks and WIP limit warning badges.
- **Danger Crimson** (`#EF4444`): Destructive actions, urgent priorities, and blocked dependencies.

---

## 3. Typography Scale & The 12px Floor Rule

### Font Families
- **Display**: `-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`
- **Body & Controls**: `-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`
- **Monospace**: `"SF Mono", Menlo, Monaco, Consolas, monospace`

### Typographic Hierarchy
| Role | Size | Weight | Line Height | Use Case |
|---|---|---|---|---|
| **Display** | `28px` | Bold 700 | 1.2 | Modal hero headings, project titles |
| **Title** | `20px` | Semibold 600 | 1.3 | View headers, drawer sheet titles |
| **Headline** | `16px` | Semibold 600 | 1.4 | Column headers, card titles, section labels |
| **Body** | `14px` | Regular 400 | 1.5 | Ticket descriptions, comments, long-form notes |
| **Label / Meta** | `12px` | Medium 500 | 1.4 | Ticket IDs (`APP-42`), status chips, date badges |

### ⚠️ The 12px Floor Invariant
**NEVER use font sizes smaller than 12px (`var(--text-xs)` / `12px`).**
Sub-12px micro-fonts (`10px` or `11px`) are strictly forbidden across both `theme.css` and inline React styles. This guarantees legibility across high-DPI Retina displays and eliminates eye strain.

---

## 4. Eye-Comfort Canvas Gradients & Appearance Balancing

To eliminate screen glare during long engineering sessions, Kanban provides customized eye-comfort gradient tints:

### Light & Fresh Gradients (Auto Sets `data-theme="light"`)
- `warm-sand`: Amber paper tint with high contrast dark charcoal text.
- `soft-slate`: Slate mist with cool grey undertones.
- `light-blue`: Sky azure tint for refreshing daytime clarity.
- `light-green`: Mint sage tint reducing visual fatigue.
- `magenta`: Blush rose quartz.
- `aurora-mist`: Subtle pastel sage.
- `lavender-dusk`: Twilight lilac tint.
- `sunset-glow`: Soft peach warmth.

### Dark Nocturnes (Auto Sets `data-theme="dark"`)
- `dark-obsidian`: Midnight charcoal (default deep focus).
- `navy-blue`: Deep maritime ocean tint.
- `dark-emerald`: Nocturnal spruce tint.
- `dark-magenta`: Velvet midnight plum.
- `deep-indigo`: Cosmic slate indigo.

**Automatic Appearance Balancing**: Switching to a light tint automatically recalculates text and border contrast tokens so icons and text remain 100% accessible.

---

## 5. Component Patterns & Invariants

### 1. Kanban Cards
- **Minimum Height**: Strictly `72px` (`min-height: 72px`).
- **Two-Line Clamp**: Ticket titles clamp at 2 lines with clean ellipsis overflow.
- **Card Padding**: Balanced `12px` inner padding.
- **Hover Motion**: Subtle 1px lift (`translateY(-1px)`) with smooth 150ms ease-out transitions.

### 2. Slide Drawer (`TicketDetailDrawer.tsx`)
- Opens smoothly from the right edge with a clean backdrop mask.
- **Markdown by Default**: Ticket descriptions render Markdown preview by default; double-clicking enters edit mode.
- Keyboard accessible: <kbd>Esc</kbd> closes the drawer gracefully.

### 3. Command Palette (`Cmd+K`)
- Spotlight-style centered modal with 16px background blur.
- Fuzzy substring matching with bold match highlights.
- Full keyboard navigation (<kbd>Up</kbd>, <kbd>Down</kbd>, <kbd>Enter</kbd>, <kbd>Esc</kbd>).

### 4. Persistent Webview Tabs
- Webview tabs (`type: "webview"`) are never unmounted from the DOM when switching between tabs (`display: isTabActive ? "flex" : "none"`).
- Videos, audio playback, documentation pages, and forms persist uninterrupted.

