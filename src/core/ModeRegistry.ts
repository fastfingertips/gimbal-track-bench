import type { CanvasManager } from './CanvasManager';
import type { GlobalConfig } from './GlobalConfig';
import type { BaseMode } from './BaseMode';
import type { UIManager } from '../ui/UIManager';

export interface ModeSummary {
  id: string;
  name: string;
  description: string;
}

/**
 * ModeRegistry manages registered test modes and handles mode switching.
 */
export class ModeRegistry {
  private canvasManager: CanvasManager;
  private uiManager: UIManager | null;
  private globalConfig: GlobalConfig;
  private modes: Map<string, BaseMode>;
  private activeMode: BaseMode | null = null;

  constructor(canvasManager: CanvasManager, uiManager: UIManager | null, globalConfig: GlobalConfig) {
    this.canvasManager = canvasManager;
    this.uiManager = uiManager;
    this.globalConfig = globalConfig;
    this.modes = new Map();
  }

  public register(modeInstance: BaseMode): void {
    this.modes.set(modeInstance.id, modeInstance);
  }

  public getAllModes(): ModeSummary[] {
    return Array.from(this.modes.values()).map((mode) => ({
      id: mode.id,
      name: mode.name,
      description: mode.description,
    }));
  }

  public switchMode(modeId: string, initialSettings?: Record<string, any>): void {
    const nextMode = this.modes.get(modeId);
    if (!nextMode) {
      console.warn(`Mode "${modeId}" not found in registry.`);
      return;
    }

    if (this.activeMode) {
      this.activeMode.unmount();
    }

    this.activeMode = nextMode;
    this.activeMode.mount(this.canvasManager, this.globalConfig);

    if (initialSettings) {
      this.activeMode.applySettings(initialSettings);
    }

    if (this.globalConfig) {
      this.globalConfig.applyBackgroundAndGrid();
    }

    if (this.uiManager) {
      this.uiManager.renderModeControls(this.activeMode);
      this.activeMode.setPaused(this.uiManager.isPaused);
      this.activeMode.setTimeScale(this.uiManager.currentSpeed);
    }
  }

  public getActiveMode(): BaseMode | null {
    return this.activeMode;
  }
}

