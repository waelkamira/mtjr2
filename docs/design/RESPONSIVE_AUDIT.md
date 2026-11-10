# Matjar responsive UI audit

**Started:** 2026-11-10  
**Target:** main  
**Scope:** All existing App Router pages and shared UI components listed in PAGE_INVENTORY.md.  
**Status:** Shared responsive corrections committed; route-by-route browser verification remains open.

## Responsive acceptance matrix

Every route must be reviewed at these viewport widths, in both Arabic RTL and English LTR:

| Profile | CSS viewport | Main concern |
|---|---:|---|
| Compact phone | 320 × 640 | No clipped controls, readable labels, reachable actions |
| Common phone | 360 × 800 | Single-column forms, stable navigation, usable dialogs |
| Large phone | 430 × 932 | No stretched cards or excessive empty space |
| Tablet portrait | 768 × 1024 | Sidebar/navigation transition, sensible two-column layouts |
| Tablet landscape / small laptop | 1024 × 768 | Dashboard density, tables and filters |
| Desktop | 1280 × 800 | Full navigation, balanced content width |
| Wide desktop | 1440 × 900 | Content max-width, no stretched cards or charts |

Also verify browser zoom at 200%, keyboard-only navigation, long Arabic labels, long product/store names, large currency values, and touch interaction without hover.

## Shared defects found and corrected

1. **Admin navigation on phones:** the original single horizontal strip forced users to horizontally scroll through a large number of admin destinations. It now wraps into rows inside a bounded, vertically scrollable navigation region on narrow screens; desktop navigation remains vertical.
2. **Seller navigation on phones:** the seller workspace had a horizontal strip containing every destination. It now wraps and uses bounded vertical scrolling so destinations are discoverable without forcing a page-wide horizontal scroll.
3. **Seller top bar:** its fixed 150px title block could compete with controls on narrow screens. It now yields available width and allows long localized section names to wrap.
4. **Global overflow containment:** the shared stylesheet now constrains root/page width, media, form controls and nested layout regions; wide seller/admin tables scroll within their own region rather than widening the viewport.
5. **Seller and admin grids:** breakpoint-based grids retain their intended phone/tablet column counts; broad CSS overrides that had collapsed every grid (including image galleries and KPI tiles) were removed. Dialogs are constrained to the available viewport height and width.
6. **RTL/LTR and zoom:** existing document direction and focus styling are preserved; final browser verification at both directions and 200% zoom is still required.

## Route coverage to review

Use the authoritative route-by-route list in PAGE_INVENTORY.md. Review every existing route, grouped as follows:

- Public marketplace: home, catalog, search, categories, brands, stores, product and store details.
- Commerce: cart, checkout, order detail, shipping/return entry points and reviews.
- Identity: login, registration, password reset, MFA, verification and security pages.
- Customer account: overview, profile, addresses, orders, favorites, messages, support and notifications.
- Seller workspace: overview, products, product creation/editing, orders, inventory, shipping, returns, messages, questions, reviews, advertising, staff, finance, commissions and settings.
- Administration: dashboard, users, sellers/stores, catalog moderation, categories, brands, orders, payments, providers, refunds, logistics, returns, support, reviews, Q&A, search, tax, commissions, coupons, advertising, audit and platform control.

For each route, inspect the page shell, title/action row, filters, forms, cards, charts, tables, tabs, menus, dialogs, pagination, empty/loading/error states and fixed/floating controls. A page is not complete merely because its outer container fits.

## Remaining route-level work

- Inspect each route's bespoke fixed widths, minimum widths, nowrap text, fixed-position overlays and multi-column grids.
- Confirm each table has an intentional small-screen presentation: card/list conversion where appropriate, or a clearly bounded horizontal table scroller when tabular comparison is essential.
- Confirm every modal has an internal scroll region and does not hide its submit/cancel actions behind mobile browser chrome.
- Confirm chart labels, legends and tooltips remain understandable at narrow widths.
- Confirm intentional two-column phone layouts (product image galleries, KPI tiles and application steps) retain enough width and do not clip.
- Confirm maps and location pickers retain usable map controls and do not cover their form actions.
- Confirm all interactive targets are comfortably tappable and focus remains visible.
- Confirm long localized text does not overlap adjacent controls.

## Verification boundary

The changes above are source-level corrections only. No claim is made that all 79 route files have passed browser testing or screenshot comparison. The next acceptance step is a browser sweep of the route inventory at the viewport matrix above, recording each route as PASS, ISSUE, or BLOCKED and fixing each issue before declaring the responsive audit complete.
## Additional source-level page refinements (2026-11-10)

- Admin page shells: reduced default horizontal and vertical padding on compact screens across users, orders, brands, logistics, shipments, audit log, payments, products, AI settings, payment details, user details, coupons, sellers, platform access, categories, order details, payment providers, privilege requests, dashboard and catalog product management.
- Seller inventory: reduced mobile page/card padding, improved warehouse edit form breakpoints, and made the stock-count warehouse selector shrink without forcing a 220px minimum on phones. Existing inventory tables remain independently scrollable.
- Seller commission view: store selector can shrink on compact screens; the commission snapshot tables stay inside their own horizontal scroll regions.
- Catalog discovery: filter controls and result summary wrap; mobile page gutters and heading size are reduced.
- Checkout review: header actions wrap, page gutters are reduced on phones, and long quote references may break rather than widen the viewport.
- Public/storefront and customer routes: adjusted mobile gutters on account overview, stores, brand/category details, wishlist, MFA step-up, customer orders, returns, support-ticket details, storefront brand directory, home discovery sections, admin review listing and cart.
- Product image preview uses the dynamic viewport height; floating AI assistant now respects device safe-area insets.

These changes are code-level corrections only. No route has been marked visually PASS until inspected in an actual browser at the acceptance widths and in both RTL and LTR.
- Seller inbox: the active-store selector is fluid on phones and the conversation list is bounded/scrollable below desktop widths.
- Notifications: preference rows and their channel toggles wrap on compact screens.
- Catalog list controls: search/sort/submit controls are allowed to wrap instead of forcing a single horizontal row.
- Remaining wide admin/seller data tables were checked at source level and are contained in dedicated horizontal scroll wrappers.