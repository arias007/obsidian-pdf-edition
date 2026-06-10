import { Notice, Plugin, TFile, WorkspaceLeaf, setIcon } from "obsidian";
import { PDFDocument, rgb } from "pdf-lib";

type ToolMode = "select" | "pen" | "highlight" | "eraser";

const INK_COLORS = ["#d9480f", "#fab005", "#228be6", "#2f9e44", "#212529"];

interface PdfViewLike {
  containerEl?: HTMLElement;
  contentEl?: HTMLElement;
  file?: TFile;
  getViewType?: () => string;
}

interface InkPoint {
  x: number;
  y: number;
}

interface InkStroke {
  color: string;
  id: string;
  opacity: number;
  pageCssHeight: number;
  pageCssWidth: number;
  pageIndex: number;
  points: InkPoint[];
  saved: boolean;
  tool: Exclude<ToolMode, "eraser" | "select">;
  width: number;
}

interface PageOverlay {
  abort: AbortController;
  canvas: HTMLCanvasElement;
  cssHeight: number;
  cssWidth: number;
  dpr: number;
  pageEl: HTMLElement;
  pageIndex: number;
}

interface TouchScrollState {
  lastY: number;
  scrollEl: HTMLElement;
}

export default class ObPdfInkXodoPlugin extends Plugin {
  private sessions = new Map<HTMLElement, InkSession>();
  private surfaceScanTimers: number[] = [];

  async onload(): Promise<void> {
    document.body.classList.add("xodo-pdf-ink-menu-boost");

    this.addCommand({
      id: "toggle-pdf-ink",
      name: "Toggle PDF ink annotation",
      callback: () => {
        const session = this.getActivePdfSession();
        if (!session) {
          new Notice("Open a PDF first.");
          return;
        }
        session.toggle();
      }
    });

    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.queuePdfSurfaceScans()));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.queuePdfSurfaceScans()));
    this.registerEvent(this.app.workspace.on("file-open", () => this.queuePdfSurfaceScans()));
    this.register(() => this.clearSurfaceScanTimers());

    this.queuePdfSurfaceScans();
  }

  onunload(): void {
    document.body.classList.remove("xodo-pdf-ink-menu-boost");
    for (const session of this.sessions.values()) {
      session.destroy();
    }
    this.sessions.clear();
    this.clearSurfaceScanTimers();
  }

  private queuePdfSurfaceScans(): void {
    this.clearSurfaceScanTimers();
    for (const delay of [0, 120, 420, 1000, 2200]) {
      const timer = window.setTimeout(() => {
        this.surfaceScanTimers = this.surfaceScanTimers.filter((value) => value !== timer);
        this.scanPdfSurfaces();
      }, delay);
      this.surfaceScanTimers.push(timer);
    }
  }

  private clearSurfaceScanTimers(): void {
    for (const timer of this.surfaceScanTimers) {
      window.clearTimeout(timer);
    }
    this.surfaceScanTimers = [];
  }

  private scanPdfSurfaces(): void {
    const liveRoots = new Set<HTMLElement>();

    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view as unknown as PdfViewLike;
      const hostEl = view.containerEl ?? view.contentEl;
      if (!hostEl) {
        return;
      }

      for (const surface of this.findPdfSurfaces(hostEl, view)) {
        liveRoots.add(surface.rootEl);
        const existing = this.sessions.get(surface.rootEl);
        if (existing) {
          existing.updateFile(surface.file);
          existing.scheduleQuietScan();
          continue;
        }

        const session = new InkSession(this, leaf, surface.file, surface.rootEl);
        this.sessions.set(surface.rootEl, session);
      }
    });

    for (const [rootEl, session] of this.sessions.entries()) {
      if (!document.body.contains(rootEl) || !liveRoots.has(rootEl)) {
        session.destroy();
        this.sessions.delete(rootEl);
      }
    }
  }

  private findPdfSurfaces(hostEl: HTMLElement, view: PdfViewLike): Array<{ file: TFile; rootEl: HTMLElement }> {
    const directFile = view.file?.extension === "pdf" ? view.file : null;
    const viewType = view.getViewType?.();
    if (directFile || viewType === "pdf") {
      const file = directFile ?? this.resolvePdfFile(hostEl, view.file);
      return file ? [{ file, rootEl: hostEl }] : [];
    }

    const roots = new Set<HTMLElement>();
    for (const page of this.findPdfPageElements(hostEl)) {
      const root =
        page.closest<HTMLElement>(
          ".internal-embed, .media-embed, .file-embed, .pdf-embed, .pdf-container, .pdf-viewer, .pdfViewer"
        ) ?? page.parentElement ?? hostEl;
      roots.add(root);
    }

    const surfaces: Array<{ file: TFile; rootEl: HTMLElement }> = [];
    for (const rootEl of roots) {
      const file = this.resolvePdfFile(rootEl, view.file);
      if (file && this.hasPdfPages(rootEl)) {
        surfaces.push({ file, rootEl });
      }
    }
    return surfaces;
  }

  private findPdfPageElements(rootEl: HTMLElement): HTMLElement[] {
    return Array.from(
      rootEl.querySelectorAll<HTMLElement>(
        ".pdfViewer .page, .pdf-viewer .page, .pdf-container .page, .page[data-page-number]"
      )
    ).filter((page) => page.querySelector("canvas") !== null);
  }

  private hasPdfPages(rootEl: HTMLElement): boolean {
    return this.findPdfPageElements(rootEl).some((page) => page.clientWidth > 0 && page.clientHeight > 0);
  }

  private resolvePdfFile(rootEl: HTMLElement, sourceFile?: TFile): TFile | null {
    if (sourceFile?.extension === "pdf") {
      return sourceFile;
    }

    for (const rawPath of collectPdfPathHints(rootEl)) {
      const file = this.resolvePdfPathHint(rawPath, sourceFile);
      if (file) {
        return file;
      }
    }

    return null;
  }

  private resolvePdfPathHint(rawPath: string, sourceFile?: TFile): TFile | null {
    const cleaned = cleanPdfPathHint(rawPath);
    if (!cleaned) {
      return null;
    }

    const linked = this.app.metadataCache.getFirstLinkpathDest(cleaned, sourceFile?.path ?? "");
    if (linked instanceof TFile && linked.extension === "pdf") {
      return linked;
    }

    const normalized = cleaned.replace(/\\/g, "/").replace(/^\/+/, "");
    const direct = this.app.vault.getAbstractFileByPath(normalized);
    if (direct instanceof TFile && direct.extension === "pdf") {
      return direct;
    }

    const fileName = normalized.split("/").pop()?.toLowerCase();
    if (!fileName) {
      return null;
    }

    return this.app.vault.getFiles().find((file) => file.extension === "pdf" && file.name.toLowerCase() === fileName) ?? null;
  }

  private getActivePdfSession(): InkSession | null {
    const leaf = this.app.workspace.activeLeaf;
    if (!leaf) {
      return null;
    }

    const view = leaf.view as unknown as PdfViewLike;
    const rootEl = view.containerEl ?? view.contentEl;
    if (!rootEl) {
      return null;
    }

    this.scanPdfSurfaces();
    const direct = this.sessions.get(rootEl);
    if (direct) {
      return direct;
    }

    for (const [sessionRoot, session] of this.sessions.entries()) {
      if (rootEl.contains(sessionRoot) || sessionRoot.contains(rootEl)) {
        return session;
      }
    }

    return null;
  }
}

class InkSession {
  private button: HTMLElement | null = null;
  private currentStroke: InkStroke | null = null;
  private dirty = false;
  private enabled = false;
  private mutationObserver: MutationObserver;
  private overlays = new Map<HTMLElement, PageOverlay>();
  private activeTouchId: number | null = null;
  private pendingSaveAfterCurrentSave = false;
  private palette: HTMLElement | null = null;
  private penOpacity = 1;
  private saveTimer: number | null = null;
  private scanTimer: number | null = null;
  private selectedStrokeId: string | null = null;
  private saving = false;
  private strokeHistory: InkStroke[] = [];
  private toolbar: HTMLElement | null = null;
  private tool: ToolMode = "pen";
  private touchScroll: TouchScrollState | null = null;
  private color = "#d9480f";
  private highlightOpacity = 0.36;
  private width = 3;

  constructor(
    private plugin: ObPdfInkXodoPlugin,
    private leaf: WorkspaceLeaf,
    private file: TFile,
    private rootEl: HTMLElement
  ) {
    this.rootEl.classList.add("xodo-pdf-ink-root");
    this.injectButton();
    this.scanPages();

    this.mutationObserver = new MutationObserver((mutations) => {
      if (this.shouldScanForMutations(mutations)) {
        this.scheduleQuietScan();
      }
    });
    this.mutationObserver.observe(this.rootEl, {
      childList: true,
      subtree: true
    });
  }

  destroy(): void {
    this.clearAutoSaveTimer();
    this.clearScanTimer();
    this.mutationObserver.disconnect();
    this.button?.remove();
    this.palette?.remove();
    this.toolbar?.remove();
    for (const overlay of this.overlays.values()) {
      overlay.abort.abort();
      overlay.canvas.remove();
      overlay.pageEl.classList.remove("xodo-pdf-ink-page");
    }
    this.overlays.clear();
    this.rootEl.classList.remove("xodo-pdf-ink-enabled", "xodo-pdf-ink-root", "xodo-pdf-ink-selecting");
  }

  updateFile(file: TFile): void {
    if (file.path === this.file.path) {
      return;
    }

    this.file = file;
    this.clearAutoSaveTimer();
    this.currentStroke = null;
    this.dirty = false;
    this.selectedStrokeId = null;
    this.strokeHistory = [];
    this.redrawAll();
  }

  toggle(): void {
    this.setEnabled(!this.enabled);
  }

  scanPages(): void {
    this.clearScanTimer();
    if (this.isInteracting()) {
      this.scheduleScanPages(700);
      return;
    }

    this.injectButton();
    this.cleanupDetachedOverlays();

    const pageEls = this.findPageElements();
    for (let i = 0; i < pageEls.length; i += 1) {
      this.ensureOverlay(pageEls[i], i);
    }
  }

  scheduleQuietScan(): void {
    this.scheduleScanPages(this.enabled ? 650 : 180);
  }

  private scheduleScanPages(delay = 250): void {
    this.clearScanTimer();
    this.scanTimer = window.setTimeout(() => {
      this.scanTimer = null;
      this.scanPages();
    }, delay);
  }

  private shouldScanForMutations(mutations: MutationRecord[]): boolean {
    if (this.isInteracting()) {
      return false;
    }

    return mutations.some((mutation) => {
      for (const node of Array.from(mutation.addedNodes)) {
        if (this.isRelevantPdfMutationNode(node)) {
          return true;
        }
      }
      for (const node of Array.from(mutation.removedNodes)) {
        if (this.isRelevantPdfMutationNode(node)) {
          return true;
        }
      }
      return false;
    });
  }

  private isRelevantPdfMutationNode(node: Node): boolean {
    if (!(node instanceof HTMLElement)) {
      return false;
    }
    if (node.closest(".xodo-pdf-ink-root") && node.classList.contains("xodo-pdf-ink-canvas")) {
      return false;
    }
    if (node.closest(".xodo-pdf-ink-toolbar, .xodo-pdf-ink-palette-panel, .xodo-pdf-ink-embed-actions")) {
      return false;
    }
    if (node.classList.contains("page") || node.matches("canvas, .pdfViewer, .pdf-viewer, .pdf-container")) {
      return true;
    }
    return node.querySelector(".page, canvas, .pdfViewer, .pdf-viewer, .pdf-container") !== null;
  }

  private isInteracting(): boolean {
    return this.currentStroke !== null || this.activeTouchId !== null || this.touchScroll !== null;
  }

  private injectButton(): void {
    if (this.button?.isConnected) {
      return;
    }

    const existing = this.rootEl.querySelector<HTMLElement>(".xodo-pdf-ink-button");
    if (existing) {
      this.button = existing;
      return;
    }

    const button = createIconButton("pen-line", "PDF ink annotation");
    button.classList.add("xodo-pdf-ink-button");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.toggle();
    });

    const actions = this.findButtonHost();
    if (actions) {
      actions.prepend(button);
    } else {
      const floatingHost = document.createElement("div");
      floatingHost.className = "xodo-pdf-ink-embed-actions";
      floatingHost.appendChild(button);
      this.rootEl.appendChild(floatingHost);
    }

    this.button = button;
    this.updateButtonState();
  }

  private findButtonHost(): HTMLElement | null {
    return (
      this.rootEl.querySelector<HTMLElement>(".view-actions") ??
      this.rootEl.querySelector<HTMLElement>(".pdf-toolbar") ??
      this.rootEl.querySelector<HTMLElement>(".pdf-toolbar-container") ??
      this.rootEl.querySelector<HTMLElement>(".pdf-embed-toolbar") ??
      this.rootEl.querySelector<HTMLElement>(".file-embed-title") ??
      this.rootEl.querySelector<HTMLElement>(".embed-title")
    );
  }

  private findPageElements(): HTMLElement[] {
    const candidates = Array.from(
      this.rootEl.querySelectorAll<HTMLElement>(
        ".pdfViewer .page, .pdf-viewer .page, .pdf-container .page, .page[data-page-number]"
      )
    );

    const unique = new Set<HTMLElement>();
    return candidates.filter((candidate) => {
      if (unique.has(candidate)) {
        return false;
      }
      unique.add(candidate);
      return candidate.querySelector("canvas") !== null && candidate.clientWidth > 0 && candidate.clientHeight > 0;
    });
  }

  private ensureOverlay(pageEl: HTMLElement, fallbackIndex: number): void {
    const pageIndex = getPageIndex(pageEl, fallbackIndex);
    let overlay = this.overlays.get(pageEl);

    if (!overlay) {
      const canvas = document.createElement("canvas");
      canvas.className = "xodo-pdf-ink-canvas";

      const abort = new AbortController();
      const newOverlay: PageOverlay = {
        abort,
        canvas,
        cssHeight: 0,
        cssWidth: 0,
        dpr: 1,
        pageEl,
        pageIndex
      };

      canvas.addEventListener("pointerdown", (event) => this.onPointerDown(event, newOverlay), { signal: abort.signal });
      canvas.addEventListener("pointermove", (event) => this.onPointerMove(event, newOverlay), { signal: abort.signal });
      canvas.addEventListener("pointerup", (event) => this.onPointerUp(event, newOverlay), { signal: abort.signal });
      canvas.addEventListener("pointercancel", (event) => this.onPointerUp(event, newOverlay), { signal: abort.signal });
      canvas.addEventListener("lostpointercapture", (event) => this.onPointerUp(event, newOverlay), { signal: abort.signal });
      canvas.addEventListener("touchstart", (event) => this.onTouchStart(event, newOverlay), {
        passive: false,
        signal: abort.signal
      });
      canvas.addEventListener("touchmove", (event) => this.onTouchMove(event, newOverlay), {
        passive: false,
        signal: abort.signal
      });
      canvas.addEventListener("touchend", (event) => this.onTouchEnd(event, newOverlay), {
        passive: false,
        signal: abort.signal
      });
      canvas.addEventListener("touchcancel", (event) => this.onTouchEnd(event, newOverlay), {
        passive: false,
        signal: abort.signal
      });

      pageEl.classList.add("xodo-pdf-ink-page");
      pageEl.appendChild(canvas);
      overlay = newOverlay;
      this.overlays.set(pageEl, overlay);
    }

    overlay.pageIndex = pageIndex;
    this.resizeOverlay(overlay);
  }

  private resizeOverlay(overlay: PageOverlay): void {
    const rect = overlay.pageEl.getBoundingClientRect();
    const cssWidth = Math.round(rect.width);
    const cssHeight = Math.round(rect.height);
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

    if (cssWidth <= 0 || cssHeight <= 0) {
      return;
    }

    if (overlay.cssWidth === cssWidth && overlay.cssHeight === cssHeight && overlay.dpr === dpr) {
      return;
    }

    overlay.cssWidth = cssWidth;
    overlay.cssHeight = cssHeight;
    overlay.dpr = dpr;
    overlay.canvas.style.width = `${cssWidth}px`;
    overlay.canvas.style.height = `${cssHeight}px`;
    overlay.canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    overlay.canvas.height = Math.max(1, Math.round(cssHeight * dpr));
    this.redrawOverlay(overlay);
  }

  private setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.rootEl.classList.toggle("xodo-pdf-ink-enabled", this.enabled);
    this.rootEl.classList.toggle("xodo-pdf-ink-selecting", this.enabled && this.tool === "select");
    this.updateButtonState();

    if (this.enabled) {
      this.showToolbar();
      this.scanPages();
      new Notice("PDF ink enabled.");
    } else {
      this.currentStroke = null;
      this.selectedStrokeId = null;
      this.palette?.remove();
      this.palette = null;
      this.toolbar?.remove();
      this.toolbar = null;
      if (this.dirty) {
        this.scheduleAutoSave(150);
      }
      this.redrawAll();
    }
  }

  private updateButtonState(): void {
    this.button?.classList.toggle("is-active", this.enabled);
  }

  private showToolbar(): void {
    if (this.toolbar?.isConnected) {
      this.updateToolbarState();
      return;
    }

    const toolbar = document.createElement("div");
    toolbar.className = "xodo-pdf-ink-toolbar";

    const select = createIconButton("mouse-pointer-2", "Select");
    select.dataset.tool = "select";
    select.addEventListener("click", () => this.setTool("select"));
    toolbar.appendChild(select);

    const pen = createIconButton("pen-line", "Pen");
    pen.dataset.tool = "pen";
    pen.addEventListener("click", () => this.setTool("pen"));
    toolbar.appendChild(pen);

    const highlighter = createIconButton("highlighter", "Highlighter");
    highlighter.dataset.tool = "highlight";
    highlighter.addEventListener("click", () => this.setTool("highlight"));
    toolbar.appendChild(highlighter);

    const eraser = createIconButton("eraser", "Eraser");
    eraser.dataset.tool = "eraser";
    eraser.addEventListener("click", () => this.setTool("eraser"));
    toolbar.appendChild(eraser);

    const palette = createIconButton("palette", "调色板");
    palette.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.togglePalette();
    });
    toolbar.appendChild(palette);

    const undo = createIconButton("undo-2", "Undo");
    undo.addEventListener("click", () => this.undo());
    toolbar.appendChild(undo);

    const clear = createIconButton("trash-2", "Clear unsaved ink");
    clear.addEventListener("click", () => this.clearUnsavedInk());
    toolbar.appendChild(clear);

    this.rootEl.appendChild(toolbar);
    this.toolbar = toolbar;
    this.updateToolbarState();
  }

  private updateToolbarState(): void {
    if (!this.toolbar) {
      return;
    }

    for (const button of this.toolbar.querySelectorAll<HTMLElement>("[data-tool]")) {
      button.classList.toggle("is-active", button.dataset.tool === this.tool);
    }

    for (const colorButton of this.rootEl.querySelectorAll<HTMLElement>(".xodo-pdf-ink-color")) {
      colorButton.classList.toggle("is-active", colorButton.title === this.color);
    }

    this.updatePaletteState();
  }

  private setTool(tool: ToolMode): void {
    this.tool = tool;
    this.rootEl.classList.toggle("xodo-pdf-ink-selecting", this.enabled && this.tool === "select");
    if (tool === "highlight") {
      this.width = Math.max(this.width, 9);
    }
    if (tool !== "select") {
      this.selectedStrokeId = null;
      this.redrawAll();
    }
    this.updateToolbarState();
  }

  private onPointerDown(event: PointerEvent, overlay: PageOverlay): void {
    if (!this.enabled) {
      return;
    }
    if (event.pointerType === "touch") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    overlay.canvas.setPointerCapture(event.pointerId);
    this.beginInkInteraction(getNormalizedPoint(event, overlay.canvas), overlay);
  }

  private beginInkInteraction(point: InkPoint, overlay: PageOverlay): void {
    const tool = this.tool;

    if (tool === "select") {
      const selected = this.findStrokeAt(overlay, point);
      this.selectedStrokeId = selected?.id ?? null;
      this.redrawAll();
      return;
    }

    if (tool === "eraser") {
      this.eraseAt(overlay, point);
      return;
    }

    this.currentStroke = {
      color: this.color,
      id: makeStrokeId(),
      opacity: tool === "highlight" ? this.highlightOpacity : this.penOpacity,
      pageCssHeight: overlay.cssHeight,
      pageCssWidth: overlay.cssWidth,
      pageIndex: overlay.pageIndex,
      points: [point],
      saved: false,
      tool,
      width: tool === "highlight" ? Math.max(9, this.width) : this.width
    };
  }

  private togglePalette(): void {
    if (this.palette?.isConnected) {
      this.palette.remove();
      this.palette = null;
      return;
    }

    this.showPalette();
  }

  private showPalette(): void {
    this.palette?.remove();

    const panel = document.createElement("div");
    panel.className = "xodo-pdf-ink-palette-panel";
    panel.addEventListener("pointerdown", (event) => event.stopPropagation());
    panel.addEventListener("click", (event) => event.stopPropagation());

    const colorRow = document.createElement("div");
    colorRow.className = "xodo-pdf-ink-palette-colors";
    for (const swatch of INK_COLORS) {
      const colorButton = document.createElement("button");
      colorButton.className = "xodo-pdf-ink-color";
      colorButton.style.backgroundColor = swatch;
      colorButton.title = swatch;
      colorButton.type = "button";
      colorButton.addEventListener("click", () => {
        this.color = swatch;
        this.updateToolbarState();
      });
      colorRow.appendChild(colorButton);
    }
    panel.appendChild(colorRow);

    panel.appendChild(
      this.createPaletteRange("大小", "xodo-pdf-ink-width", 1, 18, 1, this.width, (value) => {
        this.width = value;
      })
    );

    panel.appendChild(
      this.createPaletteRange("钢笔透明度", "xodo-pdf-ink-opacity-pen", 0.05, 1, 0.05, this.penOpacity, (value) => {
        this.penOpacity = value;
      })
    );

    panel.appendChild(
      this.createPaletteRange(
        "高亮透明度",
        "xodo-pdf-ink-opacity-highlight",
        0.05,
        1,
        0.05,
        this.highlightOpacity,
        (value) => {
          this.highlightOpacity = value;
        }
      )
    );

    this.rootEl.appendChild(panel);
    this.palette = panel;
    this.updateToolbarState();
  }

  private createPaletteRange(
    title: string,
    className: string,
    min: number,
    max: number,
    step: number,
    value: number,
    onInput: (value: number) => void
  ): HTMLElement {
    const row = document.createElement("label");
    row.className = "xodo-pdf-ink-palette-range";
    row.title = title;

    const label = document.createElement("span");
    label.textContent = title;
    row.appendChild(label);

    const input = document.createElement("input");
    input.className = className;
    input.max = String(max);
    input.min = String(min);
    input.step = String(step);
    input.type = "range";
    input.value = String(value);
    input.addEventListener("input", () => onInput(Number(input.value)));
    row.appendChild(input);

    return row;
  }

  private updatePaletteState(): void {
    if (!this.palette) {
      return;
    }

    const widthInput = this.palette.querySelector<HTMLInputElement>(".xodo-pdf-ink-width");
    if (widthInput) {
      widthInput.value = String(this.width);
    }

    const penOpacityInput = this.palette.querySelector<HTMLInputElement>(".xodo-pdf-ink-opacity-pen");
    if (penOpacityInput) {
      penOpacityInput.value = String(this.penOpacity);
    }

    const highlightOpacityInput = this.palette.querySelector<HTMLInputElement>(".xodo-pdf-ink-opacity-highlight");
    if (highlightOpacityInput) {
      highlightOpacityInput.value = String(this.highlightOpacity);
    }
  }

  private onPointerMove(event: PointerEvent, overlay: PageOverlay): void {
    if (!this.enabled) {
      return;
    }
    if (event.pointerType === "touch") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.moveInkInteraction(getNormalizedPoint(event, overlay.canvas), overlay);
  }

  private moveInkInteraction(point: InkPoint, overlay: PageOverlay): void {
    const tool = this.tool;

    if (tool === "select") {
      return;
    }

    if (tool === "eraser") {
      this.eraseAt(overlay, point);
      return;
    }

    const stroke = this.currentStroke;
    if (!stroke || stroke.pageIndex !== overlay.pageIndex) {
      return;
    }

    const last = stroke.points[stroke.points.length - 1];
    if (last && normalizedDistance(last, point, overlay.cssWidth, overlay.cssHeight) < 1.5) {
      return;
    }

    stroke.points.push(point);
    this.redrawOverlay(overlay, stroke);
  }

  private onPointerUp(event: PointerEvent, overlay: PageOverlay): void {
    if (!this.enabled) {
      return;
    }
    if (event.pointerType === "touch") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (overlay.canvas.hasPointerCapture(event.pointerId)) {
      overlay.canvas.releasePointerCapture(event.pointerId);
    }

    this.endInkInteraction(overlay);
  }

  private endInkInteraction(overlay: PageOverlay): void {
    const stroke = this.currentStroke;
    if (!stroke) {
      return;
    }

    if (stroke.points.length === 1) {
      const only = stroke.points[0];
      stroke.points.push({
        x: Math.min(1, only.x + 0.001),
        y: Math.min(1, only.y + 0.001)
      });
    }

    this.strokeHistory.push(stroke);
    this.selectedStrokeId = null;
    this.currentStroke = null;
    this.dirty = true;
    this.redrawOverlay(overlay);
    this.scheduleAutoSave();
  }

  private onTouchStart(event: TouchEvent, overlay: PageOverlay): void {
    if (!this.enabled) {
      return;
    }

    if (event.touches.length >= 2) {
      event.preventDefault();
      event.stopPropagation();
      this.currentStroke = null;
      this.activeTouchId = null;
      this.redrawAll();
      this.touchScroll = {
        lastY: getTouchCenterY(event.touches),
        scrollEl: findScrollableAncestor(this.rootEl)
      };
      return;
    }

    if (event.touches.length !== 1) {
      return;
    }

    const touch = event.changedTouches[0];
    this.touchScroll = null;
    this.activeTouchId = touch.identifier;
    event.preventDefault();
    event.stopPropagation();
    this.beginInkInteraction(getNormalizedClientPoint(touch.clientX, touch.clientY, overlay.canvas), overlay);
  }

  private onTouchMove(event: TouchEvent, overlay: PageOverlay): void {
    if (!this.enabled) {
      return;
    }

    if (event.touches.length >= 2) {
      event.preventDefault();
      event.stopPropagation();
      const centerY = getTouchCenterY(event.touches);
      if (!this.touchScroll) {
        this.touchScroll = {
          lastY: centerY,
          scrollEl: findScrollableAncestor(this.rootEl)
        };
        return;
      }

      this.touchScroll.scrollEl.scrollTop += this.touchScroll.lastY - centerY;
      this.touchScroll.lastY = centerY;
      return;
    }

    if (this.activeTouchId === null) {
      return;
    }

    const touch = findTouch(event.touches, this.activeTouchId);
    if (!touch) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.moveInkInteraction(getNormalizedClientPoint(touch.clientX, touch.clientY, overlay.canvas), overlay);
  }

  private onTouchEnd(event: TouchEvent, overlay: PageOverlay): void {
    if (!this.enabled) {
      return;
    }

    if (event.touches.length >= 2) {
      return;
    }

    if (event.touches.length === 1 && this.touchScroll) {
      this.touchScroll = null;
      return;
    }

    this.touchScroll = null;
    if (this.activeTouchId === null) {
      return;
    }

    if (findTouch(event.touches, this.activeTouchId)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.activeTouchId = null;
    this.endInkInteraction(overlay);
  }

  private eraseAt(overlay: PageOverlay, point: InkPoint): void {
    const before = this.strokeHistory.length;
    this.strokeHistory = this.strokeHistory.filter((stroke) => {
      if (stroke.pageIndex !== overlay.pageIndex) {
        return true;
      }
      if (stroke.saved) {
        return true;
      }
      return !strokeContainsPoint(stroke, point, overlay.cssWidth, overlay.cssHeight);
    });

    if (this.strokeHistory.length !== before) {
      if (this.selectedStrokeId && !this.strokeHistory.some((stroke) => stroke.id === this.selectedStrokeId)) {
        this.selectedStrokeId = null;
      }
      this.dirty = this.hasUnsavedStrokes();
      this.redrawOverlay(overlay);
      this.scheduleAutoSave();
    }
  }

  private undo(): void {
    const index = findLastIndex(this.strokeHistory, (stroke) => !stroke.saved);
    if (index === -1) {
      return;
    }

    const [stroke] = this.strokeHistory.splice(index, 1);
    if (this.selectedStrokeId === stroke?.id) {
      this.selectedStrokeId = null;
    }
    this.dirty = this.hasUnsavedStrokes();
    this.redrawAll();
    this.scheduleAutoSave();
  }

  private clearUnsavedInk(): void {
    if (!this.hasUnsavedStrokes()) {
      return;
    }

    if (!window.confirm("Clear all ink that has not been auto-saved yet?")) {
      return;
    }

    this.currentStroke = null;
    this.strokeHistory = this.strokeHistory.filter((stroke) => stroke.saved);
    if (this.selectedStrokeId && !this.strokeHistory.some((stroke) => stroke.id === this.selectedStrokeId)) {
      this.selectedStrokeId = null;
    }
    this.dirty = this.hasUnsavedStrokes();
    this.redrawAll();
    this.scheduleAutoSave();
  }

  private redrawAll(): void {
    for (const overlay of this.overlays.values()) {
      this.redrawOverlay(overlay);
    }
  }

  private redrawOverlay(overlay: PageOverlay, previewStroke?: InkStroke): void {
    const ctx = overlay.canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.setTransform(overlay.dpr, 0, 0, overlay.dpr, 0, 0);
    ctx.clearRect(0, 0, overlay.cssWidth, overlay.cssHeight);

    for (const stroke of this.strokeHistory) {
      if (stroke.pageIndex === overlay.pageIndex) {
        drawStroke(ctx, stroke, overlay.cssWidth, overlay.cssHeight, stroke.id === this.selectedStrokeId);
      }
    }

    if (previewStroke && previewStroke.pageIndex === overlay.pageIndex) {
      drawStroke(ctx, previewStroke, overlay.cssWidth, overlay.cssHeight, previewStroke.id === this.selectedStrokeId);
    }
  }

  private async saveIntoPdf(auto = false): Promise<void> {
    const strokesToSave = this.strokeHistory.filter((stroke) => !stroke.saved);
    if (strokesToSave.length === 0) {
      if (!auto) {
        new Notice("No new ink to save.");
      }
      return;
    }

    if (this.saving) {
      this.pendingSaveAfterCurrentSave = true;
      return;
    }

    this.clearAutoSaveTimer();
    this.saving = true;

    try {
      const binary = await this.plugin.app.vault.readBinary(this.file);
      const pdf = await PDFDocument.load(binary, { ignoreEncryption: true });
      const pages = pdf.getPages();

      for (const stroke of strokesToSave) {
        const page = pages[stroke.pageIndex];
        if (!page || stroke.points.length < 2) {
          continue;
        }

        const size = page.getSize();
        const color = hexToRgb(stroke.color);
        const thickness = Math.max(0.5, stroke.width * (size.width / Math.max(1, stroke.pageCssWidth)));

        for (let i = 1; i < stroke.points.length; i += 1) {
          const start = stroke.points[i - 1];
          const end = stroke.points[i];
          page.drawLine({
            color: rgb(color.r, color.g, color.b),
            end: {
              x: end.x * size.width,
              y: size.height - end.y * size.height
            },
            opacity: stroke.opacity,
            start: {
              x: start.x * size.width,
              y: size.height - start.y * size.height
            },
            thickness
          });
        }
      }

      const saved = await pdf.save({ useObjectStreams: false });
      const buffer = new ArrayBuffer(saved.byteLength);
      new Uint8Array(buffer).set(saved);
      await this.plugin.app.vault.modifyBinary(this.file, buffer);

      this.currentStroke = null;
      for (const stroke of strokesToSave) {
        stroke.saved = true;
      }
      this.dirty = this.hasUnsavedStrokes();
      this.redrawAll();
      if (!auto) {
        new Notice(`Saved ink into ${this.file.name}.`);
      }
    } catch (error) {
      console.error(error);
      new Notice("Could not auto-save ink into this PDF. Check the console for details.");
    } finally {
      this.saving = false;
      if (this.pendingSaveAfterCurrentSave) {
        this.pendingSaveAfterCurrentSave = false;
        this.scheduleAutoSave(150);
      }
    }
  }

  private findStrokeAt(overlay: PageOverlay, point: InkPoint): InkStroke | null {
    for (let i = this.strokeHistory.length - 1; i >= 0; i -= 1) {
      const stroke = this.strokeHistory[i];
      if (stroke.pageIndex !== overlay.pageIndex) {
        continue;
      }
      if (strokeBoxContainsPoint(stroke, point, overlay.cssWidth, overlay.cssHeight)) {
        return stroke;
      }
    }
    return null;
  }

  private hasUnsavedStrokes(): boolean {
    return this.strokeHistory.some((stroke) => !stroke.saved);
  }

  private scheduleAutoSave(delay = 800): void {
    if (!this.hasUnsavedStrokes()) {
      return;
    }
    this.clearAutoSaveTimer();
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.saveIntoPdf(true);
    }, delay);
  }

  private clearAutoSaveTimer(): void {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  private clearScanTimer(): void {
    if (this.scanTimer !== null) {
      window.clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }
  }

  private cleanupDetachedOverlays(): void {
    for (const [pageEl, overlay] of this.overlays.entries()) {
      if (this.rootEl.contains(pageEl)) {
        continue;
      }

      overlay.abort.abort();
      overlay.canvas.remove();
      this.overlays.delete(pageEl);
    }
  }
}

function createIconButton(icon: string, title: string): HTMLElement {
  const button = document.createElement("button");
  button.className = "clickable-icon";
  button.title = title;
  button.type = "button";
  button.setAttribute("aria-label", title);
  setIcon(button, icon);
  return button;
}

function getPageIndex(pageEl: HTMLElement, fallbackIndex: number): number {
  const raw = pageEl.dataset.pageNumber ?? pageEl.getAttribute("data-page-number");
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed - 1 : fallbackIndex;
}

function getNormalizedPoint(event: PointerEvent, canvas: HTMLCanvasElement): InkPoint {
  return getNormalizedClientPoint(event.clientX, event.clientY, canvas);
}

function getNormalizedClientPoint(clientX: number, clientY: number, canvas: HTMLCanvasElement): InkPoint {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1),
    y: clamp((clientY - rect.top) / Math.max(1, rect.height), 0, 1)
  };
}

function getTouchCenterY(touches: TouchList): number {
  let sum = 0;
  for (let i = 0; i < touches.length; i += 1) {
    sum += touches[i].clientY;
  }
  return sum / Math.max(1, touches.length);
}

function findTouch(touches: TouchList, identifier: number): Touch | null {
  for (let i = 0; i < touches.length; i += 1) {
    if (touches[i].identifier === identifier) {
      return touches[i];
    }
  }
  return null;
}

function findScrollableAncestor(start: HTMLElement): HTMLElement {
  let element: HTMLElement | null = start;
  while (element) {
    const style = window.getComputedStyle(element);
    const canScroll = element.scrollHeight > element.clientHeight + 2;
    const allowsScroll = /auto|scroll|overlay/i.test(style.overflowY);
    if (canScroll && allowsScroll) {
      return element;
    }
    element = element.parentElement;
  }

  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: InkStroke,
  cssWidth: number,
  cssHeight: number,
  selected = false
): void {
  if (stroke.points.length < 2) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = selected ? Math.max(0.14, stroke.opacity * 0.38) : stroke.opacity;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = stroke.width;
  ctx.strokeStyle = stroke.color;
  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x * cssWidth, stroke.points[0].y * cssHeight);

  for (let i = 1; i < stroke.points.length; i += 1) {
    const point = stroke.points[i];
    ctx.lineTo(point.x * cssWidth, point.y * cssHeight);
  }

  ctx.stroke();
  ctx.restore();

  if (selected) {
    drawSelectionBox(ctx, stroke, cssWidth, cssHeight);
  }
}

function drawSelectionBox(ctx: CanvasRenderingContext2D, stroke: InkStroke, cssWidth: number, cssHeight: number): void {
  const box = strokeBounds(stroke, cssWidth, cssHeight);
  if (!box) {
    return;
  }

  const pad = Math.max(8, stroke.width * 1.8);
  const x = Math.max(0, box.minX - pad);
  const y = Math.max(0, box.minY - pad);
  const width = Math.min(cssWidth - x, box.maxX - box.minX + pad * 2);
  const height = Math.min(cssHeight - y, box.maxY - box.minY + pad * 2);

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#228be6";
  ctx.fillStyle = "rgba(34, 139, 230, 0.08)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.fillRect(x, y, width, height);
  ctx.strokeRect(x, y, width, height);
  ctx.restore();
}

function strokeBounds(
  stroke: InkStroke,
  cssWidth: number,
  cssHeight: number
): { maxX: number; maxY: number; minX: number; minY: number } | null {
  if (stroke.points.length === 0) {
    return null;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of stroke.points) {
    const x = point.x * cssWidth;
    const y = point.y * cssHeight;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return { maxX, maxY, minX, minY };
}

function strokeBoxContainsPoint(stroke: InkStroke, point: InkPoint, cssWidth: number, cssHeight: number): boolean {
  const box = strokeBounds(stroke, cssWidth, cssHeight);
  if (!box) {
    return false;
  }

  const pad = Math.max(8, stroke.width * 1.8);
  const px = point.x * cssWidth;
  const py = point.y * cssHeight;

  return px >= box.minX - pad && px <= box.maxX + pad && py >= box.minY - pad && py <= box.maxY + pad;
}

function strokeContainsPoint(stroke: InkStroke, point: InkPoint, cssWidth: number, cssHeight: number): boolean {
  if (stroke.points.length < 2) {
    return false;
  }

  const px = point.x * cssWidth;
  const py = point.y * cssHeight;
  const radius = Math.max(10, stroke.width * 2.2);

  for (let i = 1; i < stroke.points.length; i += 1) {
    const start = stroke.points[i - 1];
    const end = stroke.points[i];
    const distance = pointToSegmentDistance(
      px,
      py,
      start.x * cssWidth,
      start.y * cssHeight,
      end.x * cssWidth,
      end.y * cssHeight
    );

    if (distance <= radius) {
      return true;
    }
  }

  return false;
}

function pointToSegmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;

  if (dx === 0 && dy === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  return Math.hypot(px - closestX, py - closestY);
}

function normalizedDistance(a: InkPoint, b: InkPoint, cssWidth: number, cssHeight: number): number {
  return Math.hypot((a.x - b.x) * cssWidth, (a.y - b.y) * cssHeight);
}

function collectPdfPathHints(rootEl: HTMLElement): string[] {
  const hints = new Set<string>();
  const add = (value: string | null | undefined): void => {
    if (!value) {
      return;
    }
    if (value.toLowerCase().includes(".pdf")) {
      hints.add(value);
    }
  };

  const attrs = [
    "alt",
    "aria-label",
    "data-file",
    "data-href",
    "data-linkpath",
    "data-path",
    "data-src",
    "href",
    "src",
    "title"
  ];

  for (const attr of attrs) {
    add(rootEl.getAttribute(attr));
  }

  for (const el of rootEl.querySelectorAll<HTMLElement>("a, embed, iframe, object, .internal-embed, .media-embed")) {
    for (const attr of attrs) {
      add(el.getAttribute(attr));
    }
  }

  return Array.from(hints);
}

function cleanPdfPathHint(rawPath: string): string | null {
  let value = rawPath.trim();
  if (!value) {
    return null;
  }

  try {
    value = decodeURIComponent(value);
  } catch {
    // Keep the raw path when it is not URI-encoded.
  }

  const obsidianFileMatch = value.match(/[?&]file=([^&]+)/i);
  if (obsidianFileMatch?.[1]) {
    try {
      value = decodeURIComponent(obsidianFileMatch[1]);
    } catch {
      value = obsidianFileMatch[1];
    }
  }

  value = value
    .replace(/^app:\/\/local\//i, "")
    .replace(/^obsidian:\/\/open\?/i, "")
    .replace(/^file:\/+/i, "")
    .replace(/^vault:\/+/i, "")
    .replace(/^\/+/, "")
    .split("#")[0]
    .split("?")[0]
    .trim();

  const pdfIndex = value.toLowerCase().indexOf(".pdf");
  if (pdfIndex === -1) {
    return null;
  }

  return value.slice(0, pdfIndex + 4).replace(/\\/g, "/");
}

function makeStrokeId(): string {
  return `stroke-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    if (predicate(items[i])) {
      return i;
    }
  }
  return -1;
}

function hexToRgb(hex: string): { b: number; g: number; r: number } {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean, 16);
  return {
    b: ((value >> 0) & 255) / 255,
    g: ((value >> 8) & 255) / 255,
    r: ((value >> 16) & 255) / 255
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
