import Konva from 'konva';

export interface CanvasDimensions {
  width: number;
  height: number;
}

export type ResizeCallback = (dims: CanvasDimensions) => void;

/**
 * CanvasManager handles full-screen Konva stage creation, layers, and resize observers.
 */
export class CanvasManager {
  private container: HTMLElement;
  public stage: Konva.Stage;
  private layers: Map<string, Konva.Layer>;
  private resizeCallbacks: Set<ResizeCallback>;

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) {
      throw new Error(`Container #${containerId} not found`);
    }
    this.container = el;

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

  public getDimensions(): CanvasDimensions {
    return {
      width: this.container.clientWidth || window.innerWidth,
      height: this.container.clientHeight || window.innerHeight,
    };
  }

  public getLayer(name: string): Konva.Layer {
    if (!this.layers.has(name)) {
      const layer = new Konva.Layer();
      this.stage.add(layer);
      this.layers.set(name, layer);
    }
    return this.layers.get(name)!;
  }

  public clearAllLayers(): void {
    this.layers.forEach((layer) => {
      layer.destroyChildren();
      layer.batchDraw();
    });
  }

  public onResize(callback: ResizeCallback): () => void {
    this.resizeCallbacks.add(callback);
    return () => this.resizeCallbacks.delete(callback);
  }

  public handleResize(): void {
    const { width, height } = this.getDimensions();
    this.stage.width(width);
    this.stage.height(height);

    for (const callback of this.resizeCallbacks) {
      callback({ width, height });
    }
  }

  public draw(): void {
    this.layers.forEach((layer) => layer.batchDraw());
  }
}

