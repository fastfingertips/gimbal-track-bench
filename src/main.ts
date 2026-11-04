import { CanvasManager } from './core/CanvasManager';
import { ModeRegistry } from './core/ModeRegistry';
import { GlobalConfig } from './core/GlobalConfig';
import { UIManager } from './ui/UIManager';

// Import all test modes (TypeScript)
import { LinearOcclusionMode } from './modes/LinearOcclusionMode';
import { CircularTrackingMode } from './modes/CircularTrackingMode';
import { StepJumpMode } from './modes/StepJumpMode';
import { DistractorSwappingMode } from './modes/DistractorSwappingMode';
import { DepthZoomMode } from './modes/DepthZoomMode';
import { ManualControlMode } from './modes/ManualControlMode';
import { CustomPathMode } from './modes/CustomPathMode';

class App {
  private canvasManager: CanvasManager;
  private globalConfig: GlobalConfig;
  private uiManager: UIManager;
  private modeRegistry: ModeRegistry;

  constructor() {
    this.canvasManager = new CanvasManager('canvas-container');
    this.globalConfig = new GlobalConfig(this.canvasManager);
    this.globalConfig.applyBackgroundAndGrid();

    this.uiManager = new UIManager({
      globalConfig: this.globalConfig,
      onPlayPauseToggle: (isPaused: boolean) => {
        const active = this.modeRegistry.getActiveMode();
        if (active) active.setPaused(isPaused);
      },
      onSpeedChange: (speed: number) => {
        const active = this.modeRegistry.getActiveMode();
        if (active) active.setTimeScale(speed);
      },
      onModeChange: (modeId: string) => {
        this.modeRegistry.switchMode(modeId);
        this.updateUrlForMode(modeId);
      },
    });

    this.modeRegistry = new ModeRegistry(this.canvasManager, this.uiManager, this.globalConfig);

    this.modeRegistry.register(new LinearOcclusionMode());
    this.modeRegistry.register(new DistractorSwappingMode());
    this.modeRegistry.register(new DepthZoomMode());
    this.modeRegistry.register(new CircularTrackingMode());
    this.modeRegistry.register(new StepJumpMode());
    this.modeRegistry.register(new ManualControlMode());
    this.modeRegistry.register(new CustomPathMode());

    const allModes = this.modeRegistry.getAllModes();
    const urlModeId = this.getModeFromUrl(allModes);
    const initialModeId = urlModeId || allModes[0].id;

    this.uiManager.populateModeList(allModes, initialModeId);
    this.modeRegistry.switchMode(initialModeId);
    this.updateUrlForMode(initialModeId, true);

    // Listen for browser navigation (Back / Forward buttons)
    window.addEventListener('popstate', () => {
      const targetModeId = this.getModeFromUrl(allModes);
      if (targetModeId && targetModeId !== this.modeRegistry.getActiveMode()?.id) {
        this.modeRegistry.switchMode(targetModeId);
      }
    });
  }

  private getModeFromUrl(allModes: Array<{ id: string }>): string | null {
    // Check search params ?mode=...
    const params = new URLSearchParams(window.location.search);
    const searchMode = params.get('mode');
    if (searchMode && allModes.some((m) => m.id === searchMode)) {
      return searchMode;
    }

    // Check hash #... (e.g. #manual-control)
    const hash = window.location.hash.replace(/^#/, '');
    if (hash && allModes.some((m) => m.id === hash)) {
      return hash;
    }

    return null;
  }

  private updateUrlForMode(modeId: string, replace: boolean = false): void {
    const url = new URL(window.location.href);
    if (url.searchParams.get('mode') === modeId) return;

    url.searchParams.set('mode', modeId);
    if (replace) {
      window.history.replaceState({ mode: modeId }, '', url.toString());
    } else {
      window.history.pushState({ mode: modeId }, '', url.toString());
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new App();
});

