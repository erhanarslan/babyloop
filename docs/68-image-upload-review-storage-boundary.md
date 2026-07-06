# Image upload/review storage boundary

Image upload/review storage boundary is the release guard for the public upload to image safety/authenticity to admin review to public visibility chain.

Run:

pnpm security:image-upload-review-storage

This guard covers:

- seller upload responses do not expose objectKey, filePath, contentHash, storageDriver, uploadRoot, raw upload body, raw provider output, base64 image data, credentials, tokens, cookies, or local absolute paths;
- admin listing image review responses do not expose objectKey, filePath, contentHash, storage credentials, raw image binary data, raw provider output, seller contact data, tokens, or auth/session data;
- needs_review and rejected images stay hidden from public listing list/detail responses;
- admin listing detail can show rejected/needs-review images with safe review metadata only;
- image authenticity audit input/output stays privacy-safe and does not store base64 image bytes, raw listing description, raw prompts, raw provider output, API keys, tokens, cookies, or password hashes;
- local upload serving remains path-safe and does not expose local filesystem paths;
- S3/R2 contract tests remain metadata-safe and do not leak credentials in returned values.

This boundary does not enable S3/R2 rollout, does not enable signed upload, does not mutate buckets, does not copy objects, does not purge CDN, and does not start queue workers. External storage rollout remains blocked until the dedicated storage provider, IAM/private bucket, signed URL, migration, lifecycle cleanup, observability, and audit gates are complete.

Image upload/review storage boundary does not expose objectKey, does not expose filePath, and does not expose contentHash in public or admin API responses.
