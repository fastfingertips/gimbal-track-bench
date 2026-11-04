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
  private syncTimeoutId: number | null = null;

  constructor() {
    this.canvasManager = new CanvasManager('canvas-container');
    this.globalConfig = new GlobalConfig(this.canvasManager);

    // Parse initial URL query parameters
    const initialParams = new URLSearchParams(window.location.search);
    this.globalConfig.applyFromUrlParams(initialParams);
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
        this.queueUrlSync(false);
      },
      onModeChange: (modeId: string) => {
        this.modeRegistry.switchMode(modeId);
        this.queueUrlSync(true);
      },
      onSettingsChange: () => {
        this.queueUrlSync(false);
      },
    });

    if (initialParams.has('speed')) {
      const spd = Number(initialParams.get('speed'));
      if (!isNaN(spd)) {
        this.uiManager.setSpeed(spd);
      }
    }

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
    const initialModeSettings = this.getModeParamsFromUrl(initialParams);

    this.uiManager.populateModeList(allModes, initialModeId);
    this.modeRegistry.switchMode(initialModeId, initialModeSettings);
    this.queueUrlSync(false);

    // Listen for browser navigation (Back / Forward buttons)
    window.addEventListener('popstate', () => {
      const currentParams = new URLSearchParams(window.location.search);
      const targetModeId = this.getModeFromUrl(allModes);
      if (targetModeId) {
        this.globalConfig.applyFromUrlParams(currentParams);
        const modeParams = this.getModeParamsFromUrl(currentParams);
        this.modeRegistry.switchMode(targetModeId, modeParams);
      }
    });
  }

  private getModeFromUrl(allModes: Array<{ id: string }>): string | null {
    const params = new URLSearchParams(window.location.search);
    const searchMode = params.get('mode');
    if (searchMode && allModes.some((m) => m.id === searchMode)) {
      return searchMode;
    }

    const hash = window.location.hash.replace(/^#/, '');
    if (hash && allModes.some((m) => m.id === hash)) {
      return hash;
    }

    return null;
  }

  private getModeParamsFromUrl(params: URLSearchParams): Record<string, any> {
    const res: Record<string, any> = {};
    const excluded = new Set([
      'mode',
      'speed',
      'targetColor',
      'targetGlow',
      'glowBlur',
      'obstacleColor',
      'obstacleOpacity',
      'backgroundColor',
      'showGrid',
      'gridColor',
      'gridSpacing',
    ]);
    params.forEach((val, key) => {
      if (!excluded.has(key)) {
        res[key] = val;
      }
    });
    return res;
  }

  private queueUrlSync(pushState: boolean = false): void {
    if (this.syncTimeoutId !== null) {
      window.clearTimeout(this.syncTimeoutId);
    }
    this.syncTimeoutId = window.setTimeout(() => {
      this.syncUrlWithCurrentState(pushState);
      this.syncTimeoutId = null;
    }, 180);
  }

  private syncUrlWithCurrentState(pushState: boolean = false): void {
    const active = this.modeRegistry.getActiveMode();
    if (!active) return;

    const url = new URL(window.location.href);
    const newParams = new URLSearchParams();
    newParams.set('mode', active.id);

    // 1. Mode controls / parameters
    const modeSettings = active.getSettings();
    for (const [key, val] of Object.entries(modeSettings)) {
      if (val !== undefined && val !== null) {
        newParams.set(key, String(val));
      }
    }

    // 2. Speed scale if non-default
    if (this.uiManager.currentSpeed !== 1.0) {
      newParams.set('speed', String(this.uiManager.currentSpeed));
    }

    // 3. Global settings if non-default
    const gs = this.globalConfig.settings;
    if (gs.targetColor !== '#007acc') newParams.set('targetColor', gs.targetColor);
    if (!gs.targetGlow) newParams.set('targetGlow', 'false');
    if (gs.glowBlur !== 14) newParams.set('glowBlur', String(gs.glowBlur));
    if (gs.obstacleColor !== '#141414') newParams.set('obstacleColor', gs.obstacleColor);
    if (gs.obstacleOpacity !== 1.0) newParams.set('obstacleOpacity', String(gs.obstacleOpacity));
    if (gs.backgroundColor !== '#1e1e1e') newParams.set('backgroundColor', gs.backgroundColor);
    if (!gs.showGrid) newParams.set('showGrid', 'false');

    url.search = newParams.toString();
    if (pushState) {
      window.history.pushState({ mode: active.id }, '', url.toString());
    } else {
      window.history.replaceState({ mode: active.id }, '', url.toString());
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new App();
});

