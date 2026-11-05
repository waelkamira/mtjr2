# Mtjr2 Design System — Claymorphism

**Status:** Claymorphism visual direction approved by the project owner; shared CSS foundation added. Page-by-page adoption and visual QA remain in progress.

## Design intent

Use a modern **Claymorphism / 3D Pastel Clay** language: soft tactile surfaces, rounded geometry, pastel color families, and restrained inner/outer shadows that make selected elements feel gently raised. The marketplace must still feel trustworthy, premium, readable, and commerce-first—not like a toy dashboard.

The visual language applies across the storefront, buyer account, seller workspace, and administration. Each area keeps its own information density and task hierarchy. Do not copy dashboard-only layouts into the shopping experience.

## Palette

| Family | Main value | Supporting values | Use |
|---|---|---|---|
| Lavender | `#7867A6` | `#E9E2F8`, `#F7F3FF`, deep text `#39334F` | Primary brand/action family |
| Mint | `#6C9D82` | `#DDF1E7`, `#F3FBF6`, deep text `#416A56` | Positive, seller and service highlights |
| Blush | `#BD8292` | `#F8DFE5`, `#FFF5F7` | Wishlist, campaigns and secondary accents |
| Butter | `#B69A53` | `#F8EDC9`, `#FFFAE9` | Offers and gentle attention cues |
| Sky | `#456C88` | `#DEEDF7` | Information and supporting visuals |
| Neutral | `#F1EEF7` | `#F8F6FC`, ink `#302D3B` | Canvas, cards and readable text |

Use dark foreground tokens for text on pastel backgrounds. Pastel colors are not automatically accessible; check actual contrast for every text/control pairing. Semantic success, warning, danger, and information colors remain separate from decorative palette accents.

## Clay surfaces and depth

- Use a soft matte surface with a light inner edge and diffuse outer shadow; use inset shadows for search fields, filters, and selected recessed controls.
- Reserve the strongest raised effect for cards, summary tiles, compact controls, and selected dashboard widgets. Avoid applying shadows to every nested container.
- Use real product imagery as the main visual content. 3D clay illustrations may support empty states, onboarding, and dashboard summaries, but must not replace product photography or essential status information.
- Avoid excessive blur, glassmorphism, glossy gradients, and heavy skeuomorphic buttons.
- Keep touch targets at least 44×44 CSS pixels; ensure focus, hover, active, disabled, loading, and error states remain distinct.

## Shape, typography and layout

- Controls: approximately 16px radius; cards: 24px; panels: 30px; feature surfaces: 36px.
- Use a consistent 4px spacing scale and a centered content width up to 1440px.
- Typography remains crisp and high-contrast; do not imitate rounded toy lettering for functional content.
- Product cards preserve image, title, seller, rating, variant, availability, and prominent price hierarchy.
- Support long localized labels, variable currencies, RTL/LTR, and mobile-first layouts.

## Workspace distinctions

- **Storefront:** editorial product discovery, strong search, category navigation, real product imagery, clear price and purchase actions. Pastel surfaces must not reduce product scannability.
- **Buyer account:** calm raised panels, readable order/wishlist summaries, and clear task progression.
- **Seller workspace:** structured inventory/order/finance workflows; mint and lavender can distinguish operational groups, but tables and statuses stay dense and legible.
- **Administration:** dashboard tiles and selected data visualizations may use the most expressive clay treatment; tables, permissions, and destructive actions remain restrained and precise.

## Functional and accessibility rules

1. Preserve routes, information architecture, category distribution, business rules, API calls, authorization, and database behavior during visual migration.
2. A visual control must remain a real control with its original action and complete UI → API/service → persistence journey.
3. Status must use text/icons as well as color.
4. Maintain keyboard navigation, visible focus, reduced-motion support, accessible names, and WCAG 2.2 AA contrast.
5. Validate mobile, tablet, desktop, RTL, and LTR. Prevent horizontal overflow and keep primary actions reachable without hover.

## Implementation sequence

1. **Foundation:** tokens, compatible aliases, page canvas, and opt-in clay surface primitives in `src/app/globals.css`.
2. **Shared shell:** navigation, buttons, inputs, cards, badges, menus, dialogs, and feedback states.
3. **Storefront:** home hero, category tiles, product cards, search, product detail, cart and checkout.
4. **Buyer account:** profile, orders, wishlist, addresses and support.
5. **Seller workspace and administration:** overview, catalog, fulfillment, finance, moderation, permissions and audit views.
6. **Visual QA:** compare screenshots at mobile/tablet/desktop and test the key actions affected by each migrated component.

Do not redesign the Super Admin workstream or its in-progress files as part of this foundation change; coordinate it separately.

## Current implementation boundary

The CSS tokens and opt-in surface primitives are implemented in `src/app/globals.css`. This foundation does not claim that every page or reusable component has already migrated. Component adoption must proceed in small slices with typecheck, lint, focused tests, build, responsive review, and verification that the affected user journeys still work.


## Central Tailwind v4 configuration

The project uses Tailwind CSS v4, so the shared Tailwind theme is defined with `@theme inline` in `src/app/globals.css` rather than a legacy `tailwind.config.js` file. This is intentional: Tailwind v4 is CSS-first.

- `:root` is the single source of truth for palette, semantic colors, surfaces, radii, and clay shadows.
- `@theme inline` exposes those tokens as Tailwind utilities (for example `bg-clay-lavender-100`, `text-clay-ink-950`, `shadow-clay-raised`, and `rounded-clay-card`).
- Change a token once in `:root`; both ordinary CSS and Tailwind utilities consume the same value.
- Component-level inline values should be migrated to these named tokens instead of introducing new one-off colors or shadows.
