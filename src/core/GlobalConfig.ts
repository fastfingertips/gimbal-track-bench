import Konva from 'konva';
import type { CanvasManager } from './CanvasManager';

export interface GlobalSettings {
  targetColor: string;
  targetGlow: boolean;
  glowBlur: number;
  obstacleColor: string;
  obstacleOpacity: number;
  backgroundColor: string;
  showGrid: boolean;
  gridSpacing: number;
  gridColor: string;
  crosshair: boolean;
}

export type GlobalConfigChangeListener = (settings: GlobalSettings) => void;

/**
 * GlobalConfig holds cross-mode visual settings that PTZ camera testers frequently tune.
 */
export class GlobalConfig {
  private canvasManager: CanvasManager;
  public settings: GlobalSettings;
  private changeListeners: Set<GlobalConfigChangeListener>;

  constructor(canvasManager: CanvasManager) {
    this.canvasManager = canvasManager;

    this.settings = {
      targetColor: '#007acc',
      targetGlow: true,
      glowBlur: 14,
      obstacleColor: '#141414',
      obstacleOpacity: 1.0,
      backgroundColor: '#1e1e1e',
      showGrid: true,
      gridSpacing: 60,
      gridColor: '#2b2b2e',
      crosshair: false,
    };

    this.changeListeners = new Set();
  }

  public get<K extends keyof GlobalSettings>(key: K): GlobalSettings[K] {
    return this.settings[key];
  }

  public set<K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]): void {
    this.settings[key] = value;
    this.notify();
  }

  public update(patch: Partial<GlobalSettings>): void {
    Object.assign(this.settings, patch);
    this.notify();
  }

  public applyFromUrlParams(params: URLSearchParams): void {
    const patch: Partial<GlobalSettings> = {};
    if (params.has('targetColor')) patch.targetColor = params.get('targetColor')!;
    if (params.has('targetGlow')) patch.targetGlow = params.get('targetGlow') === 'true';
    if (params.has('glowBlur')) {
      const v = Number(params.get('glowBlur'));
      if (!isNaN(v)) patch.glowBlur = v;
    }
    if (params.has('obstacleColor')) patch.obstacleColor = params.get('obstacleColor')!;
    if (params.has('obstacleOpacity')) {
      const v = Number(params.get('obstacleOpacity'));
      if (!isNaN(v)) patch.obstacleOpacity = v;
    }
    if (params.has('backgroundColor')) patch.backgroundColor = params.get('backgroundColor')!;
    if (params.has('showGrid')) patch.showGrid = params.get('showGrid') === 'true';
    if (params.has('gridColor')) patch.gridColor = params.get('gridColor')!;
    if (params.has('gridSpacing')) {
      const v = Number(params.get('gridSpacing'));
      if (!isNaN(v)) patch.gridSpacing = v;
    }

    if (Object.keys(patch).length > 0) {
      this.update(patch);
    }
  }

  public onChange(callback: GlobalConfigChangeListener): () => void {
    this.changeListeners.add(callback);
    return () => this.changeListeners.delete(callback);
  }

  private notify(): void {
    this.applyBackgroundAndGrid();
    for (const cb of this.changeListeners) {
      cb(this.settings);
    }
  }

  public applyBackgroundAndGrid(): void {
    const container = document.getElementById('canvas-container');
    if (container) {
      container.style.backgroundColor = this.settings.backgroundColor;
    }

    const gridLayer = this.canvasManager.getLayer('background-grid-layer');
    gridLayer.moveToBottom();
    gridLayer.destroyChildren();

    if (this.settings.showGrid) {
      const { width, height } = this.canvasManager.getDimensions();
      const spacing = this.settings.gridSpacing;

      for (let x = spacing; x < width; x += spacing) {
        gridLayer.add(
          new Konva.Line({
            points: [x, 0, x, height],
            stroke: this.settings.gridColor,
            strokeWidth: 1,
            listening: false,
          })
        );
      }

      for (let y = spacing; y < height; y += spacing) {
        gridLayer.add(
          new Konva.Line({
            points: [0, y, width, y],
            stroke: this.settings.gridColor,
            strokeWidth: 1,
            listening: false,
          })
        );
      }
    }

    if (this.settings.crosshair) {
      const { width, height } = this.canvasManager.getDimensions();
      const cx = width / 2;
      const cy = height / 2;

      gridLayer.add(
        new Konva.Line({
          points: [cx - 30, cy, cx + 30, cy],
          stroke: '#007acc',
          strokeWidth: 1.5,
          listening: false,
        })
      );
      gridLayer.add(
        new Konva.Line({
          points: [cx, cy - 30, cx, cy + 30],
          stroke: '#007acc',
          strokeWidth: 1.5,
          listening: false,
        })
      );
      gridLayer.add(
        new Konva.Circle({
          x: cx,
          y: cy,
          radius: 14,
          stroke: '#007acc',
          strokeWidth: 1.2,
          listening: false,
        })
      );
    }

    gridLayer.batchDraw();
  }
}

