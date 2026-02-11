'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types/types';
import { createExcalidrawAdapter, getAdapterInstance, type ExcalidrawTheme } from '@/lib/excalidraw/adapter';

const Excalidraw = dynamic(
  async () => (await import('@excalidraw/excalidraw')).Excalidraw,
  { ssr: false },
);

export interface ExcalidrawWrapperProps {
  initialContent?: string | null;
  theme?: ExcalidrawTheme;
  onDirtyChange?: (dirty: boolean) => void;
}

export function ExcalidrawWrapper({
  initialContent,
  theme = 'light',
  onDirtyChange,
}: ExcalidrawWrapperProps) {
  const adapterRef = useRef(createExcalidrawAdapter());
  const initializedRef = useRef(false);

  useEffect(() => {
    const adapter = adapterRef.current;

    // Subscribe to events
    const unsubscribe = adapter.onEvent((evt) => {
      if (evt.type === 'change') {
        onDirtyChange?.(evt.dirty);
      }
    });

    return unsubscribe;
  }, [onDirtyChange]);

  useEffect(() => {
    const adapter = adapterRef.current;
    adapter.setTheme(theme);
  }, [theme]);

  const handleExcalidrawAPI = (api: ExcalidrawImperativeAPI | null) => {
    const adapter = adapterRef.current;
    adapter.bindApi(api);

    // Load initial content only once
    if (api && initialContent !== undefined && !initializedRef.current) {
      adapter.load(initialContent);
      initializedRef.current = true;
    }
  };

  const handleChange = () => {
    const instance = getAdapterInstance();
    if (instance) {
      instance.handleChange();
    }
  };

  return (
    <div className="h-full w-full">
      <Excalidraw
        excalidrawAPI={handleExcalidrawAPI}
        onChange={handleChange}
        theme={theme}
      />
    </div>
  );
}
