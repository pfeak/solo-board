/**
 * Excalidraw adapter layer (sole integration point with @excalidraw/excalidraw).
 *
 * Spec: ui_prd_excalidraw_adapter.md
 */

import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types/types';

export type ExcalidrawTheme = 'light' | 'dark';

export type ExcalidrawAdapterEvent =
  | { type: 'ready' }
  | { type: 'change'; dirty: boolean }
  | { type: 'error'; message: string; detail?: unknown };

export type SoloBoardExcalidrawContentV1 = {
  schema: 'solo-board/excalidraw-content';
  schemaVersion: 1;
  elements: unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
  updatedAt?: number;
};

export type ExcalidrawAdapter = {
  bindApi(api: ExcalidrawImperativeAPI | null): void;
  load(content: string | object | null): void;
  serialize(): SoloBoardExcalidrawContentV1;
  isDirty(): boolean;
  markSaved(): void;
  setTheme(theme: ExcalidrawTheme): void;
  refresh(): void;
  onEvent(cb: (evt: ExcalidrawAdapterEvent) => void): () => void;
};

class ExcalidrawAdapterImpl implements ExcalidrawAdapter {
  private api: ExcalidrawImperativeAPI | null = null;
  private dirty = false;
  private lastSavedContent: string | null = null;
  private eventListeners: Set<(evt: ExcalidrawAdapterEvent) => void> = new Set();

  bindApi(api: ExcalidrawImperativeAPI | null): void {
    this.api = api;
    if (api) {
      this.emitEvent({ type: 'ready' });
    }
  }

  load(content: string | object | null): void {
    if (!this.api) {
      this.emitEvent({ type: 'error', message: 'API not ready' });
      return;
    }

    try {
      let parsed: any;
      if (typeof content === 'string') {
        parsed = content ? JSON.parse(content) : null;
      } else {
        parsed = content;
      }

      // Handle legacy Excalidraw format or V1 format
      let elements: unknown[] = [];
      let appState: Record<string, unknown> = {};
      let files: Record<string, unknown> = {};

      if (parsed) {
        if (parsed.schema === 'solo-board/excalidraw-content' && parsed.schemaVersion === 1) {
          elements = parsed.elements || [];
          appState = parsed.appState || {};
          files = parsed.files || {};
        } else {
          // Legacy format: assume it's Excalidraw native format
          elements = parsed.elements || [];
          appState = parsed.appState || {};
          files = parsed.files || {};
        }
      }

      // Update scene
      this.api.updateScene({
        elements: elements as any,
        appState: appState as any,
        files: files as any,
      });

      this.lastSavedContent = JSON.stringify({ elements, appState, files });
      this.dirty = false;
    } catch (error: any) {
      this.emitEvent({
        type: 'error',
        message: 'Failed to load content',
        detail: error,
      });
    }
  }

  serialize(): SoloBoardExcalidrawContentV1 {
    if (!this.api) {
      throw new Error('API not ready');
    }

    const elements = this.api.getSceneElements();
    const appState = this.api.getAppState();
    const files = this.api.getFiles();

    return {
      schema: 'solo-board/excalidraw-content',
      schemaVersion: 1,
      elements: elements as unknown[],
      appState: appState as Record<string, unknown>,
      files: files as Record<string, unknown>,
      updatedAt: Math.floor(Date.now() / 1000),
    };
  }

  isDirty(): boolean {
    return this.dirty;
  }

  markSaved(): void {
    if (this.api) {
      const current = JSON.stringify(this.serialize());
      this.lastSavedContent = current;
      this.dirty = false;
      this.emitEvent({ type: 'change', dirty: false });
    }
  }

  setTheme(theme: ExcalidrawTheme): void {
    if (this.api) {
      this.api.updateScene({
        appState: { theme } as any,
      });
    }
  }

  refresh(): void {
    // Refresh view if needed
    if (this.api) {
      // Force a re-render by updating scene with current state
      const elements = this.api.getSceneElements();
      const appState = this.api.getAppState();
      this.api.updateScene({
        elements,
        appState,
      });
    }
  }

  onEvent(cb: (evt: ExcalidrawAdapterEvent) => void): () => void {
    this.eventListeners.add(cb);
    return () => {
      this.eventListeners.delete(cb);
    };
  }

  private emitEvent(evt: ExcalidrawAdapterEvent): void {
    this.eventListeners.forEach((cb) => cb(evt));
  }

  // Internal method to handle onChange from Excalidraw
  handleChange(): void {
    if (!this.api) return;

    const current = JSON.stringify(this.serialize());
    const isDirty = current !== this.lastSavedContent;

    if (isDirty !== this.dirty) {
      this.dirty = isDirty;
      this.emitEvent({ type: 'change', dirty: isDirty });
    }
  }
}

// Singleton instance
let adapterInstance: ExcalidrawAdapterImpl | null = null;

export function createExcalidrawAdapter(): ExcalidrawAdapter {
  if (!adapterInstance) {
    adapterInstance = new ExcalidrawAdapterImpl();
  }
  return adapterInstance;
}

// Export internal handleChange for wrapper
export function getAdapterInstance(): ExcalidrawAdapterImpl | null {
  return adapterInstance;
}
