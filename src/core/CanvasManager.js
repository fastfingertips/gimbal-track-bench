import Konva from 'konva';

/**
 * CanvasManager handles stage creation, layer management, and resize events.
 */
export class CanvasManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container #${containerId} not found`);
    }

    const { width, height } = this.getDimensions();

    this.stage = new Konva.Stage({
      container: containerId,
      width,
      height,
    });

    this.layers = new Map();
    this.resizeCallbacks = new Set();

    window.addEventListener('resize', () => this.handleResize());
  }

  getDimensions() {
    return {
      width: this.container.clientWidth || window.innerWidth,
      height: this.container.clientHeight || (window.innerHeight - 100),
    };
  }

  getLayer(name) {
    if (!this.layers.has(name)) {
      const layer = new Konva.Layer();
      this.stage.add(layer);
      this.layers.set(name, layer);
    }
    return this.layers.get(name);
  }

  clearAllLayers() {
    this.layers.forEach((layer) => {
      layer.destroyChildren();
      layer.batchDraw();
    });
  }

  onResize(callback) {
    this.resizeCallbacks.add(callback);
    return () => this.resizeCallbacks.delete(callback);
  }

  handleResize() {
    const { width, height } = this.getDimensions();
    this.stage.width(width);
    this.stage.height(height);

    for (const callback of this.resizeCallbacks) {
      callback({ width, height });
    }
  }

  draw() {
    this.layers.forEach((layer) => layer.batchDraw());
  }
}
