'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/utils/supabase/client';
import { UserError, friendlyError, readApiError, storageUploadMessage } from '@/lib/client-errors';
import {
  ACCEPTED_EXTENSIONS,
  MAX_FILES_AT_ONCE,
  MAX_FILE_BYTES,
  extensionOf,
  type IndexingState,
  type LibrarySource,
} from './types';

type AnalyzeEvent =
  | { type: 'progress'; message: string; percent: number }
  | { type: 'done'; percent: number }
  | { type: 'error'; error: string };

async function errorFrom(res: Response, fallback: string): Promise<string> {
  return (await readApiError(res, fallback)).message;
}


export function useLibrary() {
  const [sources, setSources] = useState<LibrarySource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [indexing, setIndexing] = useState<Record<string, IndexingState>>({});
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const sourcesRef = useRef<LibrarySource[]>([]);

  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);

  const applyResult = useCallback((result: { docs: LibrarySource[] } | { error: string }) => {
    if ('docs' in result) {
      setSources(result.docs);
      setLoadError(null);
    } else {
      setLoadError(result.error);
    }
    setIsLoading(false);
  }, []);

  const fetchDocs = useCallback(async (): Promise<{ docs: LibrarySource[] } | { error: string }> => {
    try {
      const res = await fetch('/api/documents');
      if (!res.ok) return { error: await errorFrom(res, 'Could not load your library.') };
      const docs = await res.json();
      return { docs: Array.isArray(docs) ? docs : [] };
    } catch {
      return { error: 'Could not load your library. Check your connection.' };
    }
  }, []);

  const refresh = useCallback(async () => {
    applyResult(await fetchDocs());
  }, [applyResult, fetchDocs]);

  useEffect(() => {
    let cancelled = false;
    fetchDocs().then((result) => {
      if (!cancelled) applyResult(result);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchDocs, applyResult]);

  // Chunk + embed a source so Ask can search it. Reads the progress stream from the analyze route.
  const indexSource = useCallback(
    async (src: Pick<LibrarySource, 'id' | 'name' | 'url'>) => {
      const setState = (s: IndexingState | null) =>
        setIndexing((prev) => {
          const next = { ...prev };
          if (s) next[src.id] = s;
          else delete next[src.id];
          return next;
        });
      setState({ percent: 0, message: 'Starting…' });
      try {
        const res = await fetch('/api/engine/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ docId: src.id, fileUrl: src.url, fileName: src.name }),
        });
        if (!res.ok || !res.body) throw new UserError(await errorFrom(res, 'Indexing failed.'));

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finished = false;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';
          for (const frame of frames) {
            const line = frame.split('\n').find((l) => l.startsWith('data: '));
            if (!line) continue;
            const event = JSON.parse(line.slice(6)) as AnalyzeEvent;
            if (event.type === 'progress') setState({ percent: event.percent, message: event.message });
            else if (event.type === 'error') throw new UserError(event.error);
            else if (event.type === 'done') finished = true;
          }
        }
        if (!finished) throw new UserError('Indexing was interrupted. Try again.');
        await refresh();
      } catch (e) {
        toast.error(`${src.name}: ${friendlyError(e, 'Indexing failed.')}`);
      } finally {
        setState(null);
      }
    },
    [refresh]
  );

  // Indexing runs one source at a time so embedding calls don't trip rate limits.
  const enqueueIndex = useCallback(
    (src: Pick<LibrarySource, 'id' | 'name' | 'url'>) => {
      setIndexing((prev) => ({ ...prev, [src.id]: { percent: 0, message: 'Waiting…' } }));
      queue.current = queue.current.then(() => indexSource(src));
    },
    [indexSource]
  );

  const createDocument = useCallback(
    async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new UserError(await errorFrom(res, 'Could not add this source.'));
      const doc = (await res.json()) as LibrarySource;
      setSources((prev) => [{ ...doc, indexed: false, chunkCount: 0 }, ...prev.filter((s) => s.id !== doc.id)]);
      enqueueIndex(doc);
      return doc;
    },
    [enqueueIndex]
  );

  const addFiles = useCallback(
    async (files: File[], category: 'Note' | 'Assignment' = 'Note') => {
      if (files.length > MAX_FILES_AT_ONCE) {
        toast.error(`Add up to ${MAX_FILES_AT_ONCE} files at a time.`);
        return;
      }
      const known = sourcesRef.current;
      const todo: File[] = [];
      for (const f of files) {
        const ext = extensionOf(f.name);
        if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)) {
          toast.error(
            ext === 'doc'
              ? `${f.name}: legacy .doc files aren't supported. Save as .docx or PDF.`
              : `${f.name}: .${ext || 'this'} files aren't supported.`
          );
        } else if (f.size > MAX_FILE_BYTES) {
          toast.error(`${f.name} is over ${MAX_FILE_BYTES / 1024 / 1024}MB.`);
        } else if (known.some((s) => s.name === f.name && s.fileSize === f.size)) {
          toast.message(`${f.name} is already in your library.`);
        } else if (!todo.some((t) => t.name === f.name && t.size === f.size)) {
          todo.push(f);
        }
      }

      for (let i = 0; i < todo.length; i++) {
        const file = todo[i];
        setUploadStatus(todo.length > 1 ? `Uploading ${i + 1} of ${todo.length}…` : `Uploading ${file.name}…`);
        try {
          const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-');
          const { data: auth } = await supabase.auth.getUser();
          if (!auth.user) throw new UserError('Please sign in again.');
          // First folder is the user id, so storage policies can restrict each user to their own files.
          const path = `${auth.user.id}/${crypto.randomUUID().slice(0, 8)}-${cleanName}`;
          const { error } = await supabase.storage.from('workspace-files').upload(path, file);
          if (error) throw new UserError(storageUploadMessage(error.message));
          const { data } = supabase.storage.from('workspace-files').getPublicUrl(path);
          await createDocument({ name: file.name, url: data.publicUrl, fileSize: file.size, category });
        } catch (e) {
          toast.error(`${file.name}: ${friendlyError(e, 'Upload failed.')}`);
        }
      }
      setUploadStatus(null);
    },
    [createDocument]
  );

  const addLink = useCallback(
    async (url: string) => {
      setUploadStatus('Reading link…');
      try {
        await createDocument({ url });
      } catch (e) {
        toast.error(friendlyError(e, 'Could not add this link.'));
        throw e;
      } finally {
        setUploadStatus(null);
      }
    },
    [createDocument]
  );

  const addText = useCallback(
    async (title: string, text: string) => {
      setUploadStatus('Saving…');
      try {
        await createDocument({ name: title || 'Pasted notes', rawText: text });
      } catch (e) {
        toast.error(friendlyError(e, 'Could not save these notes.'));
        throw e;
      } finally {
        setUploadStatus(null);
      }
    },
    [createDocument]
  );

  const remove = useCallback(
    async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const res = await fetch('/api/documents?id=' + encodeURIComponent(id), { method: 'DELETE' });
          if (!res.ok) throw new UserError(await errorFrom(res, 'Delete failed.'));
          return id;
        })
      );
      const deleted = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
      const failed = results.length - deleted.length;
      setSources((prev) => prev.filter((s) => !deleted.includes(s.id)));
      if (failed > 0) toast.error(`${failed} item${failed === 1 ? '' : 's'} could not be deleted.`);
      return deleted;
    },
    []
  );

  return { sources, isLoading, loadError, indexing, uploadStatus, refresh, indexSource: enqueueIndex, addFiles, addLink, addText, remove };
}
