# onethreenine.net

[https://onethreenine.net](https://onethreenine.net)

## Setup

### Daily Snapshot Function (Supabase)

To enable automated daily snapshots, run the SQL in `supabase-daily-snapshot-function.sql` in your Supabase SQL Editor.

This creates a database function that:
- Takes a snapshot of all board items
- Stores it in the `board_snapshots` table
- Is automatically called daily by GitHub Actions at 11:59 PM UTC

### GitHub Secrets

Make sure these secrets are set in your GitHub repository:
- `PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon/public key