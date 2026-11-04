/**
 * ModeRegistry manages registered test modes and handles mode switching.
 */
export class ModeRegistry {
  constructor(canvasManager, uiManager) {
    this.canvasManager = canvasManager;
    this.uiManager = uiManager;
    this.modes = new Map();
    this.activeMode = null;
  }

  register(modeInstance) {
    this.modes.set(modeInstance.id, modeInstance);
  }

  getAllModes() {
    return Array.from(this.modes.values()).map((mode) => ({
      id: mode.id,
      name: mode.name,
      description: mode.description,
    }));
  }

  switchMode(modeId) {
    const nextMode = this.modes.get(modeId);
    if (!nextMode) {
      console.warn(`Mode "${modeId}" not found in registry.`);
      return;
    }

    if (this.activeMode) {
      this.activeMode.unmount();
    }

    this.activeMode = nextMode;
    this.activeMode.mount(this.canvasManager);

    // Synchronize UI with current mode
    if (this.uiManager) {
      this.uiManager.renderModeControls(this.activeMode);
      // Sync global playback state
      this.activeMode.setPaused(this.uiManager.isPaused);
      this.activeMode.setTimeScale(this.uiManager.currentSpeed);
    }
  }

  getActiveMode() {
    return this.activeMode;
  }
}
