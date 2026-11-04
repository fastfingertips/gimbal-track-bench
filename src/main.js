import { CanvasManager } from './core/CanvasManager.js';
import { ModeRegistry } from './core/ModeRegistry.js';
import { GlobalConfig } from './core/GlobalConfig.js';
import { UIManager } from './ui/UIManager.js';

// Import test modes
import { LinearOcclusionMode } from './modes/LinearOcclusionMode.js';
import { CircularTrackingMode } from './modes/CircularTrackingMode.js';
import { StepJumpMode } from './modes/StepJumpMode.js';

class App {
  constructor() {
    // 1. Initialize canvas layer manager
    this.canvasManager = new CanvasManager('canvas-container');

    // 2. Initialize cross-mode visual & calibration config
    this.globalConfig = new GlobalConfig(this.canvasManager);
    this.globalConfig.applyBackgroundAndGrid();

    // 3. Initialize UI Manager (Tweakpane)
    this.uiManager = new UIManager({
      globalConfig: this.globalConfig,
      onPlayPauseToggle: (isPaused) => {
        const active = this.modeRegistry.getActiveMode();
        if (active) active.setPaused(isPaused);
      },
      onSpeedChange: (speed) => {
        const active = this.modeRegistry.getActiveMode();
        if (active) active.setTimeScale(speed);
      },
      onModeChange: (modeId) => {
        this.modeRegistry.switchMode(modeId);
      },
    });

    // 4. Initialize Mode Registry
    this.modeRegistry = new ModeRegistry(this.canvasManager, this.uiManager, this.globalConfig);

    // 5. Register all test modes
    this.modeRegistry.register(new LinearOcclusionMode());
    this.modeRegistry.register(new CircularTrackingMode());
    this.modeRegistry.register(new StepJumpMode());

    // 6. Populate dropdown & activate initial default mode
    const allModes = this.modeRegistry.getAllModes();
    const initialModeId = allModes[0].id;
    this.uiManager.populateModeList(allModes, initialModeId);
    this.modeRegistry.switchMode(initialModeId);
  }
}

// Bootstrap once DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
