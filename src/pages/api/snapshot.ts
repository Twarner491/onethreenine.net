import type { APIRoute } from 'astro';
import { createSnapshot } from '../../lib/supabase';

/**
 * API endpoint to create a snapshot of the current board state
 * 
 * ⚠️ NOTE: This endpoint does NOT work on GitHub Pages (static hosting)
 * Astro API routes require a server adapter (Node, Vercel, Netlify, etc.)
 * 
 * Automated daily snapshots are instead handled by GitHub Actions workflow:
 * .github/workflows/daily-snapshot.yml
 * 
 * The workflow calls Supabase RPC function directly and runs daily at 11:59 PM UTC.
 * It can also be triggered manually from the Actions tab in GitHub.
 * 
 * This file is kept for reference/future use if hosting changes to SSR.
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


