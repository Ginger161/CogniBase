// Browser-only helpers for offline use. Everything here fails quietly where the browser has no Cache API.

const AUDIO_CACHE = 'cb-audio';
const audioKey = (id: string) => `/offline-audio/${id}`;

/** A playable link to an episode saved on this device, or null if it has not been saved. */
export async function savedAudioUrl(id: string): Promise<string | null> {
  try {
    const hit = await (await caches.open(AUDIO_CACHE)).match(audioKey(id));
    return hit ? URL.createObjectURL(await hit.blob()) : null;
  } catch {
    return null;
  }
}

/** Downloads an episode's audio onto this device. Returns a playable link, or null if it could not be saved. */
export async function saveAudioOffline(id: string, url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    await (await caches.open(AUDIO_CACHE)).put(audioKey(id), res.clone());
    return URL.createObjectURL(await res.blob());
  } catch {
    return null;
  }
}

export async function removeAudioOffline(id: string): Promise<void> {
  try {
    await (await caches.open(AUDIO_CACHE)).delete(audioKey(id));
  } catch {
    /* nothing to remove */
  }
}

/** Forget everything kept on this device. Called on sign-out so a shared phone never shows the next person your material. */
export async function clearOfflineData(): Promise<void> {
  try {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith('cb-')).map((n) => caches.delete(n)));
  } catch {
    /* no Cache API */
  }
}
