# Support and store-message attachments

Attachments use Cloudflare R2 through its S3-compatible endpoint. The application creates short-lived (10-minute) presigned PUT/GET URLs; credentials are never exposed to the browser. The first slice establishes database ownership records, strict metadata validation (10 MB maximum and an explicit MIME allowlist), and a server-only SigV4 presigner.

## Required environment

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

Create a dedicated private R2 bucket and scoped API token with object read/write access only to that bucket. Do not enable public bucket access. Configure CORS for the exact application origins and allow PUT/GET plus the signed Content-Type header.

## Security gate still required before user-facing rollout

R2 is object storage, not an antivirus scanner. Uploads must remain `PENDING_SCAN` and must not be downloadable or attached to a visible conversation until a malware-scanning worker has inspected the object and atomically marked it `CLEAN`. Rejected objects must be deleted and their records marked `REJECTED`. Do not configure a permissive default scanner. The upload/finalize API and UI journey, scanner worker, retention cleanup, and live R2 credential verification remain follow-up implementation gates; this commit does not claim attachments are live.
