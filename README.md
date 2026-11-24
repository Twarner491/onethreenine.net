# onethreenine.net

[https://onethreenine.net](https://onethreenine.net)

## Corkboard photo storage

The optimization workflow checks active photo cards every two hours. It stores smaller display copies in the public `board-display-images` bucket and atomically updates their image URLs. Keep client write policies off this bucket. Each copy's path contains the original object key followed by the WebP content hash. Originals remain in `board-images` and existing snapshots retain their URLs.

For a new project, create the display bucket through the Storage API with `image/webp` as the allowed type, and apply the photo URL migration. The workflow uses the existing Supabase project URL and service-role GitHub secrets. With those credentials set locally as `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, run `npm ci` and `node scripts/optimize-board-photos.mjs` for a dry run. Add `--apply` to publish the copies and switch the live rows.

The daily snapshot workflow still records each daily snapshot. It only opens Chromium when the inputs to the previous thumbnail have changed. A regular manual run attempts a fresh thumbnail. The thumbnail-only option checks for changes without writing a daily snapshot.
