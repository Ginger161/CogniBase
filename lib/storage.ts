import { createClient } from '@/utils/supabase/server';
import { isTrustedStorageUrl } from '@/lib/api-auth';

const BUCKET = 'workspace-files';

/** Object path inside the bucket for a stored file URL (public, signed or plain path), or null. */
export function storagePathFromUrl(url: string): string | null {
  const at = url.indexOf(`${BUCKET}/`);
  if (at < 0) return null;
  return decodeURIComponent(url.slice(at + BUCKET.length + 1).split('?')[0]);
}

/**
 * Read a stored upload on the server. Uses the signed-in user's storage access first, so it keeps working
 * after the bucket is made private, and falls back to the public URL for buckets that are still public.
 */
export async function readStoredFile(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!isTrustedStorageUrl(url)) return null;

  const path = storagePathFromUrl(url);
  if (path) {
    const supabase = await createClient();
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (!error && data) {
      return { buffer: Buffer.from(await data.arrayBuffer()), contentType: data.type || 'application/octet-stream' };
    }
  }

  const res = await fetch(url);
  if (!res.ok) return null;
  return { buffer: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') || 'application/octet-stream' };
}
