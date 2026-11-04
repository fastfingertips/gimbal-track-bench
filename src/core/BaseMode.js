/**
 * Base class for all camera tracking test modes.
 * Each mode implements its own canvas setup, animation logic, and custom parameter controls.
 */
export class BaseMode {
  /**
   * @param {Object} options
   * @param {string} options.id - Unique mode identifier (e.g., 'linear-occlusion')
   * @param {string} options.name - Human-readable name
   * @param {string} options.description - Short summary of what this mode tests
   */
  constructor({ id, name, description }) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.canvasManager = null;
    this.globalConfig = null;
    this.isPaused = false;
    this.timeScale = 1.0;
  }

  /**
   * Defines UI controls specific to this test mode.
   * Return an array of control specifications:
   * [{ id, label, type: 'range' | 'select' | 'checkbox' | 'color', min, max, step, options, value, unit, onChange }]
   * @returns {Array}
   */
  getControls() {
    return [];
  }

  /**
   * Lifecycle method: Called when this mode becomes active.
   * @param {CanvasManager} canvasManager
   * @param {GlobalConfig} globalConfig
   */
  mount(canvasManager, globalConfig) {
    this.canvasManager = canvasManager;
    this.globalConfig = globalConfig;
    this.setupElements();
    this.setupAnimation();
    this.resizeUnsub = this.canvasManager.onResize((dims) => this.onResize(dims));

    if (this.globalConfig) {
      this.configUnsub = this.globalConfig.onChange((settings) => this.onGlobalConfigChange(settings));
    }
  }

  /**
   * Abstract method: Create Konva shapes and layers.
   */
  setupElements() {
    throw new Error('setupElements() must be implemented by subclass');
  }

  /**
   * Abstract method: Start GSAP / physics animation.
   */
  setupAnimation() {
    throw new Error('setupAnimation() must be implemented by subclass');
  }

  /**
   * Called when global colors/visuals change.
   */
  onGlobalConfigChange(settings) {
    // Override if needed
  }

  /**
   * Toggle or set play/pause state.
   */
  setPaused(paused) {
    this.isPaused = paused;
  }

  /**
   * Adjust global speed/timeScale.
   */
  setTimeScale(scale) {
    this.timeScale = scale;
  }

  /**
   * Handle canvas resize.
   */
  onResize(dimensions) {
    // Override if needed
  }

  /**
   * Lifecycle method: Cleanup before switching to another mode.
   */
  unmount() {
    if (this.resizeUnsub) {
      this.resizeUnsub();
    }
    if (this.configUnsub) {
      this.configUnsub();
    }
    this.cleanupAnimation();
    if (this.canvasManager) {
      this.canvasManager.clearAllLayers();
    }
  }

  /**
   * Cleanup tweens, timers, or event listeners.
   */
  cleanupAnimation() {
    // Override to kill GSAP tweens
  }
}
