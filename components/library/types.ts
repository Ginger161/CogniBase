export type SourceType = 'file' | 'youtube' | 'website' | 'text';

export type LibrarySource = {
  id: string;
  name: string;
  url: string;
  sourceType: SourceType;
  fileSize: number | null;
  category: string | null;
  createdAt: string;
  workspaceId: string;
  indexed: boolean;
  chunkCount: number;
};

export type IndexingState = { percent: number; message: string };

export const ACCEPTED_EXTENSIONS = ['pdf', 'docx', 'pptx', 'txt', 'png', 'jpg', 'jpeg', 'webp'] as const;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES_AT_ONCE = 20;

export function extensionOf(name: string): string {
  return name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
}

export function kindLabel(s: Pick<LibrarySource, 'name' | 'sourceType'>): string {
  if (s.sourceType === 'youtube') return 'YT';
  if (s.sourceType === 'website') return 'WEB';
  if (s.sourceType === 'text') return 'TXT';
  const ext = extensionOf(s.name);
  if (ext === 'docx') return 'DOC';
  if (ext === 'pptx') return 'PPT';
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'IMG';
  return (ext || 'FILE').toUpperCase().slice(0, 4);
}
