/**
 * Excalidraw adapter layer (sole integration point with @excalidraw/excalidraw).
 *
 * Spec: ui_prd_excalidraw_adapter.md
 */

// NOTE:
// `CaptureUpdateAction` is not always exported from `@excalidraw/excalidraw` type surface.
// We resolve it dynamically at runtime and fall back to a string literal understood by Excalidraw.
const CAPTURE_UPDATE_NEVER: unknown = (() => {
  try {
    const mod = require('@excalidraw/excalidraw') as any;
    return mod?.CaptureUpdateAction?.NEVER ?? 'never';
  } catch {
    return 'never';
  }
})();

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
  /**
   * ExcalidrawAPI instance injected from Wrapper via `excalidrawAPI={(api)=>...}` callback.
   *
   * IMPORTANT: Upper layers must treat this as opaque and never call it directly.
   */
  bindApi(api: unknown | null): void;
  load(content: string | object | null): void;
  serialize(): SoloBoardExcalidrawContentV1;
  isDirty(): boolean;
  markSaved(): void;
  setTheme(theme: ExcalidrawTheme): void;
  refresh(): void;
  /** Scroll viewport to the center of all scene content; no-op if API not ready or unsupported. */
  scrollToContentCenter(): void;
  /**
   * Called by Wrapper when Excalidraw onChange fires.
   * This keeps Excalidraw details out of the page layer.
   */
  handleChange(): void;
  onEvent(cb: (evt: ExcalidrawAdapterEvent) => void): () => void;
};

/**
 * Minimal runtime shape we rely on from ExcalidrawImperativeAPI.
 * Keep it inside adapter to avoid leaking `@excalidraw/excalidraw` types outside.
 */
type ExcalidrawApiLike = {
  updateScene(payload: unknown): void;
  getSceneElements(): unknown[];
  getAppState(): Record<string, unknown>;
  getFiles(): Record<string, unknown>;
  /** Scroll viewport to content center (all elements); optional in older Excalidraw */
  scrollToContent?(target?: unknown, opts?: { animate?: boolean }): void;
};

class ExcalidrawAdapterImpl implements ExcalidrawAdapter {
  private api: ExcalidrawApiLike | null = null;
  private dirty = false;
  /**
   * When load() is called before API is ready, store content and apply in bindApi().
   */
  private pendingContent: string | null = null;
  /**
   * Snapshot used for dirty detection.
   * IMPORTANT: Must exclude volatile fields (e.g. updatedAt) to avoid "always dirty".
   */
  private lastSavedSnapshot: string | null = null;
  private eventListeners: Set<(evt: ExcalidrawAdapterEvent) => void> = new Set();

  bindApi(api: unknown | null): void {
    const nextApi = (api as ExcalidrawApiLike | null) || null;
    this.api = nextApi;
    if (nextApi) {
      if (this.pendingContent !== null) {
        const content = this.pendingContent;
        this.pendingContent = null;
        // Defer so Excalidraw has a full frame to initialize before we overwrite scene.
        setTimeout(() => {
          if (this.api) this.load(content);
          this.emitEvent({ type: 'ready' });
        }, 0);
      } else {
        this.emitEvent({ type: 'ready' });
      }
    }
  }

  load(content: string | object | null): void {
    if (!this.api) {
      this.pendingContent =
        content == null ? null : typeof content === 'string' ? content : JSON.stringify(content);
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

      // Excalidraw UserList expects appState.collaborators to be an array; when loading
      // saved state it may be an object (e.g. {} or Map-like), causing "forEach is not a function".
      if (appState && typeof appState.collaborators !== 'undefined') {
        const c = appState.collaborators;
        appState = { ...appState, collaborators: Array.isArray(c) ? c : Object.values(c ?? {}) };
      }

      // Update scene
      this.api.updateScene({
        elements: elements as any,
        appState: appState as any,
        files: files as any,
        // Avoid polluting local undo/redo stack for remote/initial sync.
        captureUpdate: CAPTURE_UPDATE_NEVER,
      });

      this.lastSavedSnapshot = this.createSnapshotFromParts(elements, appState, files);
      this.pendingContent = null;
      this.dirty = false;
      this.emitEvent({ type: 'change', dirty: false });
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
    if (!this.api) return;
    const elements = this.api.getSceneElements();
    const appState = this.api.getAppState();
    const files = this.api.getFiles();
    this.lastSavedSnapshot = this.createSnapshotFromParts(elements, appState, files);
    this.dirty = false;
    this.emitEvent({ type: 'change', dirty: false });
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

  scrollToContentCenter(): void {
    if (!this.api?.scrollToContent) return;
    try {
      // Scroll all scene elements to viewport center; animate for smoother UX
      this.api.scrollToContent(undefined, { animate: true });
    } catch {
      // Ignore if Excalidraw version doesn't support options
      this.api.scrollToContent?.();
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

  handleChange(): void {
    if (!this.api) return;

    const elements = this.api.getSceneElements();
    const appState = this.api.getAppState();
    const files = this.api.getFiles();
    const currentSnapshot = this.createSnapshotFromParts(elements, appState, files);
    const isDirty = currentSnapshot !== this.lastSavedSnapshot;

    if (isDirty !== this.dirty) {
      this.dirty = isDirty;
      this.emitEvent({ type: 'change', dirty: isDirty });
    }
  }

  private createSnapshotFromParts(
    elements: unknown[],
    appState: Record<string, unknown>,
    files: Record<string, unknown>,
  ): string {
    // Stable snapshot for comparisons; excludes volatile fields like updatedAt.
    return JSON.stringify({ elements, appState, files });
  }
}

export function createExcalidrawAdapter(): ExcalidrawAdapter {
  return new ExcalidrawAdapterImpl();
}
