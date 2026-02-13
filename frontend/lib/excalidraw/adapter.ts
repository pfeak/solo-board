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
  /** Load content; returns a Promise so callers can wait for restore() when loading official Excalidraw files. */
  load(content: string | object | null): Promise<void>;
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
          if (this.api) {
            this.load(content).then(() => this.emitEvent({ type: 'ready' }));
          } else {
            this.emitEvent({ type: 'ready' });
          }
        }, 0);
      } else {
        this.emitEvent({ type: 'ready' });
      }
    }
  }

  async load(content: string | object | null): Promise<void> {
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

      // Handle our schema vs official Excalidraw format
      const isOurSchema =
        parsed?.schema === 'solo-board/excalidraw-content' && parsed?.schemaVersion === 1;

      let elements: unknown[] = [];
      let appState: Record<string, unknown> = {};
      let files: Record<string, unknown> = {};

      if (parsed) {
        elements = parsed.elements ?? [];
        appState = parsed.appState ?? {};
        files = parsed.files ?? {};
      }

      // Official Excalidraw files need restore() so elements (especially text) are properly hydrated.
      // Our saved files were already in runtime shape, so skip restore to avoid double-processing.
      if (!isOurSchema && (elements.length > 0 || Object.keys(appState).length > 0 || Object.keys(files as object).length > 0)) {
        const { restore } = await import('@excalidraw/excalidraw');
        const restored = restore(
          { elements: elements as any, appState: appState as any, files: files as any },
          null,
          null,
        );
        elements = restored.elements;
        appState = restored.appState as Record<string, unknown>;
        files = restored.files as Record<string, unknown>;
      }

      // Excalidraw UserList expects appState.collaborators to be an array; when loading
      // saved state it may be an object (e.g. {} or Map-like), causing "forEach is not a function".
      if (appState && typeof appState.collaborators !== 'undefined') {
        const c = appState.collaborators;
        appState = { ...appState, collaborators: Array.isArray(c) ? c : Object.values(c ?? {}) };
      }

      // Ensure canvas shows solid white background when loading official/imported files.
      appState = normalizeAppStateForCanvas(appState);

      // Update scene
      this.api.updateScene({
        elements: elements as any,
        appState: appState as any,
        files: files as any,
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

/** Normalize appState so canvas shows solid white background, no grid (match thumbnail/export). */
function normalizeAppStateForCanvas(appState: Record<string, unknown>): Record<string, unknown> {
  const next = { ...appState };
  const vbc = appState.viewBackgroundColor;
  const isMissingOrTransparent =
    vbc == null ||
    vbc === '' ||
    String(vbc).toLowerCase() === 'transparent' ||
    (typeof vbc === 'string' && vbc.length >= 2 && vbc.slice(-2).toLowerCase() === '00');
  if (isMissingOrTransparent) {
    (next as any).viewBackgroundColor = '#ffffff';
  }
  if (appState.exportBackground === undefined || appState.exportBackground === null) {
    (next as any).exportBackground = true;
  }
  // Hide grid so canvas is pure white like thumbnail/export (gridSize null = grid off).
  (next as any).gridSize = null;
  return next;
}

export type ParsedExcalidrawContent = {
  elements: unknown[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
  /** True when content is solo-board schema; false for official .excalidraw format. */
  isOurSchema: boolean;
};

/**
 * Parse Excalidraw content (string or object) and return normalized elements, appState, files.
 * Use initialData only when isOurSchema: true (our saved files). Official files are loaded via load() + restore().
 */
export function parseExcalidrawContent(content: string | object | null): ParsedExcalidrawContent | null {
  if (content == null) return null;
  let parsed: any;
  if (typeof content === 'string') {
    if (!content.trim()) return null;
    try {
      parsed = JSON.parse(content);
    } catch {
      return null;
    }
  } else {
    parsed = content;
  }
  const isOurSchema =
    parsed?.schema === 'solo-board/excalidraw-content' && parsed?.schemaVersion === 1;
  let elements: unknown[] = [];
  let appState: Record<string, unknown> = {};
  let files: Record<string, unknown> = {};
  if (parsed) {
    elements = parsed.elements || [];
    appState = parsed.appState || {};
    files = parsed.files || {};
  }
  if (appState && typeof appState.collaborators !== 'undefined') {
    const c = appState.collaborators;
    appState = { ...appState, collaborators: Array.isArray(c) ? c : Object.values(c ?? {}) };
  }
  appState = normalizeAppStateForCanvas(appState);
  return { elements, appState, files, isOurSchema };
}
