# Seller product listings

Product drafts support up to eight JPEG, PNG, or WebP images. Uploads go through the authenticated seller API and use one Imgur client ID first, with ImageKit as fallback. Configure server-only credentials:

- `IMGUR_CLIENT_ID`
- `IMAGEKIT_PRIVATE_KEY`

ImageKit's private key and Imgur's client ID must never use a `NEXT_PUBLIC_` prefix. The seller API requires catalog access to the selected store, limits image size to 8 MB, verifies the file signature, and limits each seller to 20 uploads per 15-minute window.
Successful identical image uploads are deduplicated for 15 minutes within a server instance, with a bounded 256-entry cache. This is a best-effort optimization, not a distributed cache or a substitute for provider quotas. Do not configure multiple IDs to rotate requests around provider limits; configure one ID and use the ImageKit fallback or an approved storage provider.

The real-estate category is installed by the seller-location migration with slug `real-estate`. Selecting it requires a map pin, property type, sale/rent, and floor area; bedrooms and bathrooms are optional. Other categories may also use the map, but do not require a location. Exact coordinates are stored for seller-side management while product pages receive coordinates rounded to two decimal places. Product maps use OpenStreetMap tiles and include attribution.

Apply database changes with the normal migration workflow before deploying the new seller listing UI.
