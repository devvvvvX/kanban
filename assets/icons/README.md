# Application Icon Reference

This directory preserves the three redesigned macOS app icon concepts created during the design iteration inspired by the minimalism and precision of **Cursor** and **Linear**.

All files are high-resolution 1024×1024 master assets with a genuine 32-bit RGBA alpha channel (100% transparent exterior, centered at `(512, 512)`).

---

## Icon Catalog

### 1. [`option-1-interlocking-delta.png`](./option-1-interlocking-delta.png) (Active Default)
* **Concept**: Dual precision-machined titanium wings separated by an intentional 22px negative-space slot. An interior electric-blue laser core (`#00F0FF` &rarr; `#0055FF`) illuminates the inner knife edge.
* **Palette**:
  - Titanium White: `#FFFFFF` &rarr; `#CBD5E1`
  - Lunar Silver: `#F1F5F9` &rarr; `#64748B`
  - Electric Blue Core: `#00F0FF` &rarr; `#002CB0` (with `#E0F7FF` core highlight)
  - Depth Underbody: `#475569` &rarr; `#1E293B`
* **Status**: **Active Default App Icon** for macOS, Windows, Linux, web favicons, and in-app UI.

### 2. [`option-2-prism-monolith.png`](./option-2-prism-monolith.png)
* **Concept**: A unified 3D chiseled titanium chevron cursor with clean faceted planes and an embedded electric-blue laser core cutting through the central crease.
* **Palette**:
  - Polished Titanium Face: `#FFFFFF` &rarr; `#CBD5E1`
  - Brushed Silver Wing: `#F1F5F9` &rarr; `#64748B`
  - Electric Blue Spine: `#00F0FF` &rarr; `#0055FF`
  - Graphite Depth: `#64748B` &rarr; `#1E293B`

### 3. [`option-3-cyber-caliper.png`](./option-3-cyber-caliper.png)
* **Concept**: An architectural cursor featuring a negative-space aperture with a floating, faceted electric-blue optical jewel centered within the notch.
* **Palette**:
  - Titanium White & Lunar Silver outer wings
  - Inlaid Optical Prism: `#00F0FF` &rarr; `#0055FF`
  - Graphite Depth: `#64748B` &rarr; `#1E293B`

---

## Technical Specifications

- **Resolution**: 1024 &times; 1024 px
- **Color Mode**: 32-bit RGBA
- **Alpha Transparency**: Genuine alpha channel (`rgba(0, 0, 0, 0)` on all exterior pixels)
- **Centering**: Geometrically centered at `(512, 512)`
- **Regeneration**: To promote any alternative option to active default, copy it to `/app-icon.png` and re-run `@tauri-apps/cli icon app-icon.png -o src-tauri/icons` followed by the native `iconutil` script.
