import Konva from 'konva';

/**
 * GlobalConfig holds cross-mode visual settings that PTZ camera testers frequently tune.
 */
export class GlobalConfig {
  constructor(canvasManager) {
    this.canvasManager = canvasManager;

    this.settings = {
      // Target appearance
      targetColor: '#00ff66',
      targetShape: 'circle', // 'circle' | 'square'
      targetGlow: true,
      glowBlur: 16,

      // Obstacle appearance
      obstacleColor: '#000000',
      obstacleOpacity: 1.0,

      // Background appearance
      backgroundColor: '#121212',
      showGrid: true,
      gridSpacing: 60,
      gridColor: '#1e1e24',

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
    // 1. Update background color
    const container = document.getElementById('canvas-container');
    if (container) {
      container.style.backgroundColor = this.settings.backgroundColor;
    }

    // 2. Update background grid layer (underneath everything)
    const gridLayer = this.canvasManager.getLayer('background-grid-layer');
    // Ensure grid layer stays on bottom
    gridLayer.moveToBottom();
    gridLayer.destroyChildren();

    if (this.settings.showGrid) {
      const { width, height } = this.canvasManager.getDimensions();
      const spacing = this.settings.gridSpacing;

      // Vertical grid lines
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

      // Horizontal grid lines
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

    // 3. Center crosshair for camera alignment calibration
    if (this.settings.crosshair) {
      const { width, height } = this.canvasManager.getDimensions();
      const cx = width / 2;
      const cy = height / 2;

      gridLayer.add(
        new Konva.Line({
          points: [cx - 30, cy, cx + 30, cy],
          stroke: '#ff3366',
          strokeWidth: 1.5,
          listening: false,
        })
      );
      gridLayer.add(
        new Konva.Line({
          points: [cx, cy - 30, cx, cy + 30],
          stroke: '#ff3366',
          strokeWidth: 1.5,
          listening: false,
        })
      );
      gridLayer.add(
        new Konva.Circle({
          x: cx,
          y: cy,
          radius: 14,
          stroke: '#ff3366',
          strokeWidth: 1.2,
          listening: false,
        })
      );
    }

    gridLayer.batchDraw();
  }
}
