'use client';

import { useEffect, useState, useRef } from 'react';
import { fileApi } from '@/lib/api';
import { FileImage } from 'lucide-react';

type ParsedContent = {
  elements: unknown[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
};

function parseContent(content: string | null): ParsedContent | null {
  if (!content?.trim()) return { elements: [], appState: {}, files: {} };
  try {
    const parsed = JSON.parse(content);
    const rawElements = parsed?.elements ?? [];
    const rawAppState = parsed?.appState ?? {};
    const rawFiles = parsed?.files ?? {};
    return {
      elements: Array.isArray(rawElements) ? rawElements : [],
      appState: typeof rawAppState === 'object' && rawAppState !== null ? rawAppState : {},
      files: typeof rawFiles === 'object' && rawFiles !== null ? rawFiles : {},
    };
  } catch {
    return null;
  }
}

export interface BoardCardThumbnailProps {
  fileId: string;
  className?: string;
}

export function BoardCardThumbnail({ fileId, className }: BoardCardThumbnailProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [emptyScene, setEmptyScene] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(false);
      setDataUrl(null);
      setEmptyScene(false);
      try {
        const file = await fileApi.getById(fileId);
        const parsed = parseContent(file.content ?? null);
        if (cancelled || !parsed) {
          setLoading(false);
          if (!parsed && file.content) setError(true);
          return;
        }
        // Empty scene: show white blank (no icon, no gray)
        if (!parsed.elements.length) {
          if (!cancelled) {
            setEmptyScene(true);
            setLoading(false);
          }
          return;
        }
        const { exportToCanvas } = await import('@excalidraw/excalidraw');
        const canvas = await exportToCanvas({
          elements: parsed.elements as any,
          appState: parsed.appState as any,
          files: parsed.files as any,
          maxWidthOrHeight: 360,
          exportPadding: 16,
          getDimensions: (width: number, height: number) => ({
            width: Math.max(width, 360),
            height: Math.max(height, 270),
          }),
        });
        if (cancelled) return;
        const url = canvas.toDataURL('image/png');
        if (!cancelled) setDataUrl(url);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  if (loading) {
    return (
      <div
        className={className}
        style={{ aspectRatio: '4/3' }}
      >
        <div className="flex h-full w-full items-center justify-center bg-muted/50">
          <div className="h-8 w-8 animate-pulse rounded-full bg-muted-foreground/20" />
        </div>
      </div>
    );
  }

  if (emptyScene) {
    return (
      <div
        className={className}
        style={{ aspectRatio: '4/3' }}
      >
        <div className="h-full w-full bg-background" />
      </div>
    );
  }

  if (error || !dataUrl) {
    return (
      <div
        className={className}
        style={{ aspectRatio: '4/3' }}
      >
        <div className="flex h-full w-full items-center justify-center bg-muted/50">
          <FileImage className="h-12 w-12 text-muted-foreground/60" />
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ aspectRatio: '4/3' }}>
      <img
        src={dataUrl}
        alt=""
        className="h-full w-full object-contain bg-[var(--color-background)]"
      />
    </div>
  );
}
