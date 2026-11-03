# Mtjr2 — Visual Design System

**Status:** Approved visual direction; foundation tokens implemented.  
**Scope:** Shared design language for the global marketplace, buyer storefront, seller center, and platform administration.  
**Reference:** User-provided visual references (2026-11-03).

## 1. Design intent

Create a premium, calm, contemporary marketplace that feels editorial and trustworthy rather than like a generic discount storefront. The references contribute their botanical forest/sage palette, warm neutral surfaces, soft depth, rounded geometry, generous spacing, and tactile product presentation.

Mtjr2 is a global multi-vendor marketplace, not a grocery or plant shop. Do not copy the reference screens literally, their category content, or their wine/grocery-specific UI. The visual language must work for fashion, electronics, home, beauty, food, services, and future domains.

## 2. Color tokens

| Role | Token | Value |
|---|---|---|
| Deep forest / primary dark | `--color-forest-950` | `#102D27` |
| Primary forest | `--color-forest-800` | `#245044` |
| Secondary forest | `--color-forest-700` | `#326657` |
| Sage | `--color-sage-500` | `#8FA997` |
| Pale sage | `--color-sage-100` | `#EDF2EC` |
| Warm ivory page | `--color-ivory-50` | `#FCFBF7` |
| Soft ivory surface | `--color-ivory-100` | `#F6F4ED` |
| Main text | `--color-ink-900` | `#1B2823` |
| Muted text | `--color-stone-500` | `#777D75` |
| Restrained copper accent | `--color-copper-500` | `#D18449` |

Forest green is the primary action and identity color. Sage is supportive, not a replacement for readable text. Copper is a small accent for selected highlights, offers, and key micro-interactions; it must not dominate the interface. Status colors are semantic and must not be repurposed decoratively.

## 3. Surfaces and depth

- Main canvas: warm ivory, not pure white.
- Product and content cards: white or soft ivory with fine borders and subtle shadows.
- Dark forest surfaces: selected hero panels, navigation emphasis, premium campaign sections, and high-contrast overlays.
- Glassmorphism: limited to hero overlays, floating search/utility panels, or image-led campaign compositions. Never put essential product information inside low-contrast translucent glass.
- Use real product photography with consistent crop rules and quiet backgrounds. Avoid excessive gradients, ornamental blur, and generic stock decoration.

## 4. Shape, spacing, and typography

- Controls: 12px radius; cards: 18px; panels: 24px; feature surfaces: 32px.
- Use a consistent 4px spacing scale and a centered content width up to 1440px.
- Typography should be editorial and legible: clear display headings, compact but readable metadata, strong price hierarchy, and restrained use of uppercase labels.
- Prices, discounts, stock state, delivery estimate, seller identity, and variant selectors must remain easy to scan.
- Avoid excessive pill shapes. Reserve fully rounded pills for compact filters, tags, and selected states.

## 5. Marketplace component principles

- **Header:** calm utility strip, clear brand/search/category hierarchy, locale/currency entry, account, wishlist, and cart. Keep search prominent.
- **Navigation:** category navigation should scale to a large catalog without becoming visually dense.
- **Hero/campaign:** image-led editorial layouts, dark forest or soft sage panels, clear single primary action.
- **Category tiles:** image-forward, consistent crops, short labels, and responsive grid.
- **Product cards:** large image area, restrained seller/rating metadata, clear title, prominent price, honest discount treatment, and accessible quick actions. Do not hide key actions behind hover on touch devices.
- **Product detail:** strong gallery, readable variant/quantity controls, delivery/returns information, seller trust details, and a clear purchase panel.
- **Forms and checkout:** high-contrast fields, explicit validation, visible progress, and no decorative glass behind critical inputs.
- **Seller center/admin:** reuse the same tokens but prioritize information density, tables, status clarity, and task completion over storefront decoration.
- **Feedback:** consistent empty, loading, success, warning, and error states; never rely on color alone.

## 6. Responsive, international, and accessibility rules

- Mobile-first layouts; touch targets should be at least 44×44 CSS pixels.
- Support both LTR and RTL through logical CSS properties and document direction; do not hard-code left/right layout assumptions.
- Allow long translated labels, variable currencies, localized number formats, and multi-line product titles.
- Meet WCAG 2.2 AA contrast for text and controls. Check actual color pairings before shipping; palette swatches alone do not establish compliance.
- All controls need keyboard focus, labels, and meaningful accessible names. Respect reduced-motion preferences.
- Do not use animation as the only signal for state changes.

## 7. Implementation sequence

1. **Now — foundation:** establish design tokens, surface rules, accessibility baseline, and shared component principles. This can proceed alongside Phase 2 without changing its security exit gates.
2. **After Phase 2:** build the shared UI primitives and application shell.
3. **Marketplace Core:** apply the system to storefront navigation, category browsing, product cards, search, and product detail.
4. **Later domains:** extend the same system to seller/admin workflows, checkout, support, and property domain without creating disconnected visual styles.

## 8. Acceptance criteria

- One source of truth for color, radius, spacing, shadow, typography, and focus tokens.
- No page invents its own competing brand palette.
- Shared components work on mobile and desktop, LTR and RTL, keyboard and touch.
- Product information remains readable and actions discoverable without hover.
- Color contrast, reduced motion, empty/loading/error states, and responsive behavior are tested.
- Visual regression screenshots cover the primary buyer, seller, and admin journeys before release.

## 9. Current implementation boundary

The CSS foundation tokens are defined in `src/app/globals.css`. This commit does not claim that storefront pages or reusable marketplace components have been designed or implemented. The current repository is still completing Phase 2 identity/access; marketplace UI implementation follows the approved delivery sequence and Phase 2 exit gates.
