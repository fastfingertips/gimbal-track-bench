import Konva from 'konva';

/**
 * GlobalConfig holds cross-mode visual settings that PTZ camera testers frequently tune.
 * Defaults are now tailored to a sleek, matte VS Code Dark+ style palette.
 */
export class GlobalConfig {
  constructor(canvasManager) {
    this.canvasManager = canvasManager;

    this.settings = {
      // Target appearance (Default to stylish Cyan/VS Code tracking blue)
      targetColor: '#007acc',
      targetGlow: true,
      glowBlur: 14,

      // Obstacle appearance (Pure matte dark block)
      obstacleColor: '#141414',
      obstacleOpacity: 1.0,

      // Background appearance (VS Code editor gray #1e1e1e)
      backgroundColor: '#1e1e1e',
      showGrid: true,
      gridSpacing: 60,
      gridColor: '#2b2b2e',

      // Camera assistance
      crosshair: false,
    };

    this.changeListeners = new Set();
  }

  get(key) {
    return this.settings[key];
  }

  set(key, value) {
    this.settings[key] = value;
    this.notify();
  }

  update(patch) {
    Object.assign(this.settings, patch);
    this.notify();
  }

  onChange(callback) {
    this.changeListeners.add(callback);
    return () => this.changeListeners.delete(callback);
  }

  notify() {
    this.applyBackgroundAndGrid();
    for (const cb of this.changeListeners) {
      cb(this.settings);
    }
  }

  applyBackgroundAndGrid() {
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
