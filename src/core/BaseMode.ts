import type { CanvasManager, CanvasDimensions } from './CanvasManager';
import type { GlobalConfig, GlobalSettings } from './GlobalConfig';
import type { InspectableEntity } from './SceneInspector';

export interface BaseModeOptions {
  id: string;
  name: string;
  description: string;
}

export interface ModeControlSpec {
  id: string;
  label: string;
  type: 'range' | 'select' | 'checkbox';
  min?: number;
  max?: number;
  step?: number;
  options?: Record<string, any>;
  value: any;
  onChange: (value: any) => void;
}

/**
 * Base class for all camera tracking test modes.
 */
export abstract class BaseMode {
  public id: string;
  public name: string;
  public description: string;
  protected canvasManager: CanvasManager | null = null;
  protected globalConfig: GlobalConfig | null = null;
  public isPaused: boolean = false;
  public timeScale: number = 1.0;

  private resizeUnsub: (() => void) | null = null;
  private configUnsub: (() => void) | null = null;

  constructor(options: BaseModeOptions) {
    this.id = options.id;
    this.name = options.name;
    this.description = options.description;
  }

  public getControls(): ModeControlSpec[] {
    return [];
  }

  /**
   * Retrieves all current mode parameters as a key-value record for URL serialization.
   */
  public getSettings(): Record<string, any> {
    const controls = this.getControls();
    const result: Record<string, any> = {};
    controls.forEach((ctrl) => {
      result[ctrl.id] = ctrl.value;
    });
    return result;
  }

  /**
   * Applies serialized URL parameter values to this mode's controls.
   */
  public applySettings(settings: Record<string, any>): void {
    const controls = this.getControls();
    controls.forEach((ctrl) => {
      if (settings[ctrl.id] !== undefined) {
        const rawVal = settings[ctrl.id];
        if (ctrl.type === 'range') {
          const num = Number(rawVal);
          if (!isNaN(num)) {
            ctrl.value = num;
            ctrl.onChange(num);
          }
        } else if (ctrl.type === 'checkbox') {
          const bool = rawVal === 'true' || rawVal === true || rawVal === '1';
          ctrl.value = bool;
          ctrl.onChange(bool);
        } else {
          if (typeof ctrl.value === 'number') {
            const num = Number(rawVal);
            if (!isNaN(num)) {
              ctrl.value = num;
              ctrl.onChange(num);
            } else {
              ctrl.value = rawVal;
              ctrl.onChange(rawVal);
            }
          } else {
            ctrl.value = String(rawVal);
            ctrl.onChange(String(rawVal));
          }
        }
      }
    });
  }

  /**
   * Returns a complete list of every interactive entity currently in the canvas scene:
   * Target(s), Obstacle(s), Guides/Waypoints, Grid & Environment.
   */
  public getSceneEntities(): InspectableEntity[] {
    return [];
  }

  public mount(canvasManager: CanvasManager, globalConfig: GlobalConfig): void {
    this.canvasManager = canvasManager;
    this.globalConfig = globalConfig;
    this.setupElements();
    this.setupAnimation();
    this.resizeUnsub = this.canvasManager.onResize((dims) => this.onResize(dims));

    if (this.globalConfig) {
      this.configUnsub = this.globalConfig.onChange((settings) => this.onGlobalConfigChange(settings));
    }
  }

  public abstract setupElements(): void;
  public abstract setupAnimation(): void;

  public onGlobalConfigChange(_settings: GlobalSettings): void {}

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
  }

  public setTimeScale(scale: number): void {
    this.timeScale = scale;
  }

  public onResize(_dimensions: CanvasDimensions): void {}

  public unmount(): void {
    if (this.resizeUnsub) this.resizeUnsub();
    if (this.configUnsub) this.configUnsub();
    this.cleanupAnimation();
    if (this.canvasManager) {
      this.canvasManager.clearAllLayers();
    }
  }

  public cleanupAnimation(): void {}
}
