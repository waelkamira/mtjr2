# Mtjr2 — Visual Design System

**Status:** Snow, Orange, and Onyx palette applied to the shared CSS foundation. Page-by-page adoption and visual QA remain in progress.

## Design intent

Use a refined commerce design with snow-white surfaces, Spanish-orange actions and indicators, onyx typography, and elegant layered shadows. Keep the marketplace trustworthy, premium, readable, and commerce-first.

The visual language applies across the storefront, buyer account, seller workspace, and administration. Each area keeps its own information density and task hierarchy. Do not copy dashboard-only layouts into the shopping experience.

## Palette

| Color | Value | Use |
|---|---|---|
| Snow | `#FFF5F5` | Page canvas, cards, menus, fields, and other surfaces |
| Spanish orange | `#F0660D` | Buttons, indicators, icons, focus rings, and active states |
| Onyx | `#454545` | Text, borders, and all other interface elements |

Legacy color tokens remain as compatibility aliases and resolve only to these three colors. Success, warning, error, and information states use onyx text with orange indicators rather than introducing additional hues.

## Clay surfaces and depth

- Keep surfaces snow-white and use subtle onyx shadows to distinguish menus, cards, and buttons without adding background colors.
- Reserve the strongest raised effect for floating menus, dialogs, and primary interactive surfaces. Avoid applying shadows to every nested container.
- Use real product imagery as the main visual content. 3D clay illustrations may support empty states, onboarding, and dashboard summaries, but must not replace product photography or essential status information.
- Avoid excessive blur, colored gradients, and heavy skeuomorphic buttons.
- Keep touch targets at least 44×44 CSS pixels; ensure focus, hover, active, disabled, loading, and error states remain distinct.

## Shape, typography and layout

- Controls: approximately 16px radius; cards: 24px; panels: 30px; feature surfaces: 36px.
- Use a consistent 4px spacing scale and a centered content width up to 1440px.
- Typography remains crisp and high-contrast; do not imitate rounded toy lettering for functional content.
- Product cards preserve image, title, seller, rating, variant, availability, and prominent price hierarchy.
- Support long localized labels, variable currencies, RTL/LTR, and mobile-first layouts.

## Workspace distinctions

- **Storefront:** editorial product discovery, strong search, category navigation, real product imagery, clear price and purchase actions. White surfaces must not reduce product scannability.
- **Buyer account:** calm raised panels, readable order/wishlist summaries, and clear task progression.
- **Seller workspace:** structured inventory/order/finance workflows; use orange indicators and onyx labels to distinguish operational status while keeping tables dense and legible.
- **Administration:** white dashboard surfaces and restrained onyx shadows; tables, permissions, and destructive actions remain precise.

## Functional and accessibility rules

1. Preserve routes, information architecture, category distribution, business rules, API calls, authorization, and database behavior during visual migration.
2. A visual control must remain a real control with its original action and complete UI → API/service → persistence journey.
3. Status must use text/icons as well as color.
4. Maintain keyboard navigation, visible focus, reduced-motion support, accessible names, and WCAG 2.2 AA contrast.
5. Validate mobile, tablet, desktop, RTL, and LTR. Prevent horizontal overflow and keep primary actions reachable without hover.

## Implementation sequence

1. **Foundation:** tokens, compatible aliases, page canvas, and opt-in clay/dashboard primitives in `src/app/theme.css` and `src/app/globals.css`.
2. **Shared shell:** navigation, buttons, inputs, cards, badges, menus, dialogs, and feedback states.
3. **Storefront:** home hero, category tiles, product cards, search, product detail, cart and checkout.
4. **Buyer account:** profile, orders, wishlist, addresses and support.
5. **Seller workspace and administration:** overview, catalog, fulfillment, finance, moderation, permissions and audit views.
6. **Visual QA:** compare screenshots at mobile/tablet/desktop and test the key actions affected by each migrated component.

Do not redesign the Super Admin workstream or its in-progress files as part of this foundation change; coordinate it separately.

## Current implementation boundary

The theme tokens and Tailwind mappings are centralized in `src/app/theme.css`; global resets and reusable clay/dashboard primitives live in `src/app/globals.css`. This foundation does not claim that every page or reusable component has already migrated. Component adoption must proceed in small slices with typecheck, lint, focused tests, build, responsive review, and verification that the affected user journeys still work.

## Central Tailwind v4 configuration

The project uses Tailwind CSS v4, so the shared Tailwind theme is defined with `@theme inline` in `src/app/theme.css` rather than a legacy `tailwind.config.js` file. This is intentional: Tailwind v4 is CSS-first.

- `:root` is the single source of truth for palette, semantic colors, surfaces, typography, radii, shadows, icon tiles, and dashboard layout dimensions.
- `@theme inline` exposes those tokens as Tailwind utilities (for example `bg-clay-surface`, `text-clay-ink-950`, `shadow-clay-raised`, and `rounded-clay-card`).
- Change a token once in `:root`; both ordinary CSS and Tailwind utilities consume the same value.
- The `.clay-dashboard-*` layout recipes and `.clay-icon-tile` variants provide responsive structure and icon backplates; feature components supply their own accessible SVG icons.
- Font families use a configurable system stack to avoid runtime font-network requests. For a bundled brand font, load a local font with `next/font/local` and update `--font-body` and `--font-heading`.

Tune the values in `src/app/theme.css`; for example, change `--background` and `--surface` for canvas/card tones, `--font-body` for typography, `--shadow-clay` and `--shadow-clay-hover` for shadow intensity, or `--dashboard-sidebar-width` and `--dashboard-gap` for layout proportions. Keep storefront information architecture distinct from dashboard layouts.
