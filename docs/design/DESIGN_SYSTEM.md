# Mtjr2 Design System — Visual Foundation

**Status:** Foundation defined; component-by-component adoption remains in progress.  
**Reference direction:** the owner-approved visual references discussed on 2026-11-04. The hexadecimal values below are the current implementation tokens, not a claim of pixel-sampled extraction from the source images.

## Principles

1. Preserve existing information architecture, routes, category distribution, and working commerce behavior while improving presentation.
2. Prefer warm, quiet surfaces with deep petrol framing, clear violet-blue primary actions, and restrained mint/orange/cyan accents.
3. Use glass/translucency only for deliberate hero or overlay surfaces; do not make every card translucent.
4. Keep shared components consistent across storefront, customer account, seller workspace, and administration while allowing each workspace to retain task-appropriate density.
5. A visual change must not turn a working control into a decorative or non-functional element.

## Color tokens

| Token | Hex | Intended use |
|---|---|---|
| Petrol 950 | `#142832` | deepest contrast/background |
| Petrol 900 | `#203746` | primary framing, navigation, strong headings |
| Petrol 800 | `#294858` | secondary dark surfaces |
| Violet 600 | `#5368F5` | primary actions, focus rings, selected controls |
| Violet 700 | `#4054DC` | stronger/hover primary action |
| Mint 500 | `#2FC58B` | positive states and restrained highlights |
| Orange 500 | `#FF8B3D` | promotional accent and attention cues |
| Cyan 300 | `#83E8E4` | decorative highlights and subtle interactive details |
| Ivory 100 | `#F5EEE9` | page background |
| Ivory 50 | `#FFFDFB` | cards and elevated surfaces |
| Ink 900 | `#252329` | primary text |

Semantic colors remain distinct from promotional accents: success `#167653`, warning `#9A571B`, danger `#B42332`, and information `#285FA8`.

## Component rules

- **Buttons:** primary actions use the violet-blue token; secondary actions use neutral/petrol styling. Destructive actions use semantic danger. All actions need disabled, loading, focus, and error/success feedback where applicable.
- **Cards:** warm white surfaces, consistent radius and restrained shadows. Product cards must preserve price, availability, variants, seller, and purchase affordances already required by their context.
- **Forms:** labels remain visible; validation errors are associated with the relevant field; focus state is keyboard-visible.
- **Navigation and search:** maintain clear hierarchy and responsive behavior; search remains functional and does not become a visual-only element.
- **Status indicators:** use semantic colors and text/icons together; never rely on color alone.
- **Motion:** short, purposeful transitions only; respect `prefers-reduced-motion`.
- **Responsive behavior:** validate small mobile, tablet, and desktop layouts. Avoid horizontal overflow and keep important actions reachable.
- **Accessibility:** maintain readable contrast, visible focus, keyboard access, and meaningful labels.

## Implementation and verification

- The first implementation slice adds CSS custom properties in `src/app/globals.css` and keeps compatibility aliases for existing forest/sage/copper token names.
- Tokens are a foundation, not proof that every page has been visually migrated.
- Adopt them in shared primitives before applying one-off page styles.
- For each UI slice, record the routes/components changed and verify typecheck, lint, relevant tests, build, responsive layout, and the affected user journey.
- Do not change data flow, authorization, APIs, or Prisma solely for a visual redesign.
- Do not claim pixel parity with the reference images until the actual rendered pages have been compared against them.
