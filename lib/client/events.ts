'use client';

import type { EventType } from '@/lib/scoring/interaction';

/**
 * FR-16: fire-and-forget event recording.
 *
 * A failed write must never interrupt the user's action, and it must not be
 * silent either: the caller gets a result so the UI can say the decision was
 * applied but not logged. Payloads are scalars only (the route enforces it).
 */
export async function recordEvent(
  code: string,
  type: EventType,
  payload: Record<string, string | number | boolean | null | undefined> = {}
): Promise<boolean> {
  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(code)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
      // Not part of the navigation history of the page.
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}
