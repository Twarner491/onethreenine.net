import type { APIRoute } from 'astro';
import { createSnapshot } from '../../lib/supabase';

/**
 * API endpoint to create a snapshot of the current board state
 * 
 * Usage:
 * POST /api/snapshot
 * 
 * Optional body:
 * {
 *   "date": "2024-01-15"  // Optional: defaults to today
 * }
 * 
 * For automated daily snapshots, you can:
 * 1. Use a cron service (like cron-job.org or EasyCron) to call this endpoint daily
 * 2. Use GitHub Actions with a scheduled workflow
 * 3. Use Vercel Cron (if deployed on Vercel)
 * 4. Use Supabase Edge Functions with pg_cron
 * 
 * Example cron setup (cron-job.org):
 * - URL: https://onethreenine.net/api/snapshot
 * - Method: POST
 * - Schedule: Daily at 11:59 PM
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    // Parse request body if present
    let snapshotDate: string | undefined;
    try {
      const body = await request.json();
      snapshotDate = body.date;
    } catch {
      // No body or invalid JSON, use default (today)
    }

    // Create snapshot
    const snapshot = await createSnapshot(snapshotDate);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Snapshot created successfully',
        snapshot: {
          id: snapshot.id,
          date: snapshot.snapshot_date,
          itemCount: snapshot.item_count,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error creating snapshot:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create snapshot',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};

// Also support GET for simple testing
export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      message: 'Snapshot API endpoint',
      usage: 'Send a POST request to this endpoint to create a snapshot',
      example: {
        method: 'POST',
        url: '/api/snapshot',
        body: {
          date: '2024-01-15 (optional)',
        },
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
};

