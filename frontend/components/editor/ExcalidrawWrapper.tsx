'use client';

import { useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  type ExcalidrawTheme,
  type ExcalidrawAdapter,
  parseExcalidrawContent,
} from '@/lib/excalidraw/adapter';

const Excalidraw = dynamic(
  async () => (await import('@excalidraw/excalidraw')).Excalidraw,
  { ssr: false },
);

export interface ExcalidrawWrapperProps {
  initialContent?: string | null;
  theme?: ExcalidrawTheme;
  adapter: ExcalidrawAdapter;
  onDirtyChange?: (dirty: boolean) => void;
}

export function ExcalidrawWrapper({
  initialContent,
  theme = 'light',
  adapter,
  onDirtyChange,
}: ExcalidrawWrapperProps) {
  const lastLoadedContentRef = useRef<string | null>(null);

  // Parse content once for initialData so the first paint has correct background and text.
  // Using initialData avoids updateScene() timing issues that can leave text or background broken.
  // Only use initialData for our own saved files (solo-board schema). Official Excalidraw
  // files are loaded via load() + restore() so text and background render correctly.
  const initialData = useMemo(() => {
    const raw = initialContent ?? null;
    if (raw == null) return undefined;
    const parsed = parseExcalidrawContent(raw);
    if (!parsed || !parsed.isOurSchema) return undefined;
    return {
      elements: parsed.elements,
      appState: parsed.appState,
      files: parsed.files,
      scrollToContent: parsed.elements.length > 0,
    };
  }, [initialContent]);

  useEffect(() => {
    const unsubscribe = adapter.onEvent((evt) => {
      if (evt.type === 'change') {
        onDirtyChange?.(evt.dirty);
      }
      // When API becomes ready, sync adapter snapshot (in case we used initialData).
      if (evt.type === 'ready' && initialContent !== undefined) {
        const normalized = initialContent ?? null;
        adapter.load(normalized);
        lastLoadedContentRef.current = normalized;
      }
    });

    return unsubscribe;
  }, [adapter, onDirtyChange, initialContent]);

  useEffect(() => {
    adapter.setTheme(theme);
  }, [adapter, theme]);

  const handleExcalidrawAPI = (api: unknown | null) => {
    adapter.bindApi(api);
  };

  // Load (and re-load) content when it changes and API is ready.
  useEffect(() => {
    if (initialContent === undefined) return;
    const normalized = initialContent ?? null;
    if (lastLoadedContentRef.current === normalized) return;
    adapter.load(normalized);
    lastLoadedContentRef.current = normalized;

    // Fallback: re-apply after two frames so we run after Excalidraw has fully mounted.
    let cancelled = false;
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled && lastLoadedContentRef.current === normalized) {
          adapter.load(normalized);
        }
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
    };
  }, [adapter, initialContent]);

  return (
    <div className="h-full w-full">
      <Excalidraw
        excalidrawAPI={handleExcalidrawAPI}
        onChange={() => adapter.handleChange()}
        theme={theme}
        initialData={initialData}
      />
    </div>
  );
}
