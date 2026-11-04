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

  constructor() {
    this.canvasManager = new CanvasManager('canvas-container');
    this.globalConfig = new GlobalConfig(this.canvasManager);
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
      },
      onModeChange: (modeId: string) => {
        this.modeRegistry.switchMode(modeId);
      },
    });

    this.modeRegistry = new ModeRegistry(this.canvasManager, this.uiManager, this.globalConfig);

    this.modeRegistry.register(new LinearOcclusionMode());
    this.modeRegistry.register(new DistractorSwappingMode());
    this.modeRegistry.register(new DepthZoomMode());
    this.modeRegistry.register(new CircularTrackingMode());
    this.modeRegistry.register(new StepJumpMode());
    this.modeRegistry.register(new ManualControlMode());
    this.modeRegistry.register(new CustomPathMode());

    const allModes = this.modeRegistry.getAllModes();
    const initialModeId = allModes[0].id;
    this.uiManager.populateModeList(allModes, initialModeId);
    this.modeRegistry.switchMode(initialModeId);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new App();
});

