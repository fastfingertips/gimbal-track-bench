import { Pane } from 'tweakpane';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';

/**
 * UIManager handles:
 * - Top-Left: Mode switcher pills
 * - Top-Center: Active mode name indicator
 * - Top-Right: Isolated parameter controls (Tweakpane)
 * - Bottom-Right: GitHub repo badge
 */
export class UIManager {
  constructor({ onPlayPauseToggle, onSpeedChange, onModeChange, globalConfig }) {
    this.onPlayPauseToggle = onPlayPauseToggle;
    this.onSpeedChange = onSpeedChange;
    this.onModeChange = onModeChange;
    this.globalConfig = globalConfig;

    this.isPaused = false;
    this.currentSpeed = 1.0;
    this.currentModeId = '';
    this.isMenuVisible = true;

    this.modeBar = document.getElementById('modeBar');
    this.activeModeTitle = document.getElementById('activeModeTitle');
    this.guiContainer = document.getElementById('gui-container');
    this.toggleMenuBtn = document.getElementById('toggleMenuBtn');

    // Initialize Tweakpane inside the isolated #gui-container
    this.pane = new Pane({
      container: this.guiContainer,
      title: 'Controls & Tuning',
      expanded: true,
    });

    // Register essentials plugin (for FPS meter)
    this.pane.registerPlugin(EssentialsPlugin);

    this.modeFolder = null;
    this.setupGlobalFolders();
    this.bindEvents();
  }

  setupGlobalFolders() {
    // -------------------------------------------------------------
    // FOLDER 1: Playback & Engine (Speed, Play/Pause, FPS)
    // -------------------------------------------------------------
    const playbackFolder = this.pane.addFolder({
      title: 'Engine & Playback',
      expanded: true,
    });

    // Speed Slider
    playbackFolder
      .addBinding({ speed: this.currentSpeed }, 'speed', {
        min: 0.1,
        max: 5.0,
        step: 0.1,
        label: 'Speed Scale',
      })
      .on('change', (ev) => {
        this.currentSpeed = ev.value;
        if (this.onSpeedChange) {
          this.onSpeedChange(this.currentSpeed);
        }
      });

    // Play / Pause Button
    this.playPauseBtn = playbackFolder.addButton({
      title: '⏸ Pause (Space)',
      label: 'Playback',
    });

    this.playPauseBtn.on('click', () => {
      this.togglePlayPause();
    });

    // FPS / Performance Meter
    this.fpsGraph = playbackFolder.addBlade({
      view: 'fpsgraph',
      label: 'Performance',
      lineCount: 2,
    });

    // -------------------------------------------------------------
    // FOLDER 2: Visual & Camera Calibration
    // -------------------------------------------------------------
    const visualFolder = this.pane.addFolder({
      title: 'Camera & Visuals',
      expanded: false,
    });

    if (this.globalConfig) {
      // Target Color (Color picker)
      visualFolder
        .addBinding(this.globalConfig.settings, 'targetColor', {
          label: 'Target Color',
          view: 'color',
        })
        .on('change', (ev) => {
          this.globalConfig.set('targetColor', ev.value);
        });

      // Target Glow Toggle
      visualFolder
        .addBinding(this.globalConfig.settings, 'targetGlow', {
          label: 'Neon Glow',
        })
        .on('change', (ev) => {
          this.globalConfig.set('targetGlow', ev.value);
        });

      // Glow intensity blur
      visualFolder
        .addBinding(this.globalConfig.settings, 'glowBlur', {
          label: 'Glow Blur',
          min: 0,
          max: 40,
          step: 2,
        })
        .on('change', (ev) => {
          this.globalConfig.set('glowBlur', ev.value);
        });

      // Obstacle Color
      visualFolder
        .addBinding(this.globalConfig.settings, 'obstacleColor', {
          label: 'Obstacle Color',
          view: 'color',
        })
        .on('change', (ev) => {
          this.globalConfig.set('obstacleColor', ev.value);
        });

      // Obstacle Opacity (Transparency for semi-occlusion test)
      visualFolder
        .addBinding(this.globalConfig.settings, 'obstacleOpacity', {
          label: 'Obstacle Alpha',
          min: 0.1,
          max: 1.0,
          step: 0.05,
        })
        .on('change', (ev) => {
          this.globalConfig.set('obstacleOpacity', ev.value);
        });

      // Background Color
      visualFolder
        .addBinding(this.globalConfig.settings, 'backgroundColor', {
          label: 'Background',
          view: 'color',
        })
        .on('change', (ev) => {
          this.globalConfig.set('backgroundColor', ev.value);
        });

      // Calibration Grid & Crosshair
      visualFolder
        .addBinding(this.globalConfig.settings, 'showGrid', {
          label: 'Reference Grid',
        })
        .on('change', (ev) => {
          this.globalConfig.set('showGrid', ev.value);
        });

      visualFolder
        .addBinding(this.globalConfig.settings, 'crosshair', {
          label: 'Center Reticle',
        })
        .on('change', (ev) => {
          this.globalConfig.set('crosshair', ev.value);
        });
    }
  }

  /**
   * Render Top-Left Mode Switcher Buttons (Pills)
   */
  populateModeList(modes, selectedId) {
    this.currentModeId = selectedId;
    if (!this.modeBar) return;

    this.modeBar.innerHTML = '';
    modes.forEach((mode) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `mode-pill ${mode.id === selectedId ? 'active' : ''}`;
      btn.textContent = mode.name.split('(')[0].trim(); // Clean short name
      btn.title = mode.description;

      btn.addEventListener('click', () => {
        if (this.currentModeId !== mode.id) {
          this.currentModeId = mode.id;
          this.updateActivePill(mode.id);
          if (this.onModeChange) {
            this.onModeChange(mode.id);
          }
        }
      });

      this.modeBar.appendChild(btn);
    });

    const activeObj = modes.find((m) => m.id === selectedId);
    if (activeObj && this.activeModeTitle) {
      this.activeModeTitle.textContent = activeObj.name;
    }
  }

  updateActivePill(modeId) {
    if (!this.modeBar) return;
    const buttons = this.modeBar.querySelectorAll('.mode-pill');
    buttons.forEach((btn) => {
      btn.classList.toggle('active', btn.textContent === this.getModeShortName(modeId));
    });
  }

  getModeShortName(modeId) {
    const map = {
      'linear-occlusion': 'Linear Occlusion',
      'distractor-swapping': 'Crossing Paths',
      'depth-zoom': 'Depth & Auto-Zoom',
      'circular-tracking': 'Circular Orbit',
      'step-jump': 'Step Response & Saccade Jump',
    };
    return map[modeId] || modeId;
  }

  renderModeControls(modeInstance) {
    // Update Top-Center Active Mode Name Badge
    if (this.activeModeTitle) {
      this.activeModeTitle.textContent = modeInstance.name;
    }

    // Update active pill button state
    if (this.modeBar) {
      const buttons = this.modeBar.querySelectorAll('.mode-pill');
      buttons.forEach((btn) => {
        const isThis = modeInstance.name.startsWith(btn.textContent);
        btn.classList.toggle('active', isThis);
      });
    }

    // Rebuild mode controls in right panel
    if (this.modeFolder) {
      this.modeFolder.dispose();
      this.modeFolder = null;
    }

    const controls = modeInstance.getControls();
    if (!controls || controls.length === 0) return;

    this.modeFolder = this.pane.addFolder({
      title: `⚙️ Mode Parameters`,
      expanded: true,
      index: 0, // Mode parameters at the very top of right menu!
    });

    controls.forEach((ctrl) => {
      if (ctrl.type === 'range') {
        const state = { [ctrl.id]: ctrl.value };
        this.modeFolder
          .addBinding(state, ctrl.id, {
            label: ctrl.label,
            min: ctrl.min,
            max: ctrl.max,
            step: ctrl.step || 1,
          })
          .on('change', (ev) => {
            ctrl.onChange(ev.value);
          });
      } else if (ctrl.type === 'select') {
        const state = { [ctrl.id]: ctrl.value };
        this.modeFolder
          .addBinding(state, ctrl.id, {
            label: ctrl.label,
            options: ctrl.options,
          })
          .on('change', (ev) => {
            ctrl.onChange(ev.value);
          });
      } else if (ctrl.type === 'checkbox') {
        const state = { [ctrl.id]: !!ctrl.value };
        this.modeFolder
          .addBinding(state, ctrl.id, {
            label: ctrl.label,
          })
          .on('change', (ev) => {
            ctrl.onChange(ev.value);
          });
      }
    });
  }

  toggleMenuVisibility() {
    this.isMenuVisible = !this.isMenuVisible;

    if (this.guiContainer) {
      if (this.isMenuVisible) {
        this.guiContainer.classList.remove('hidden');
      } else {
        this.guiContainer.classList.add('hidden');
      }
    }

    if (this.toggleMenuBtn) {
      if (this.isMenuVisible) {
        this.toggleMenuBtn.classList.add('active');
        this.toggleMenuBtn.setAttribute('title', 'Hide Controls Panel (Hotkey: H)');
      } else {
        this.toggleMenuBtn.classList.remove('active');
        this.toggleMenuBtn.setAttribute('title', 'Open Controls Panel (Hotkey: H)');
      }
    }
  }

  togglePlayPause() {
    this.isPaused = !this.isPaused;
    this.playPauseBtn.title = this.isPaused ? '▶ Play (Space)' : '⏸ Pause (Space)';
    if (this.onPlayPauseToggle) {
      this.onPlayPauseToggle(this.isPaused);
    }
  }

  bindEvents() {
    if (this.toggleMenuBtn) {
      this.toggleMenuBtn.classList.add('active');
      this.toggleMenuBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleMenuVisibility();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'h' || e.key === 'H') {
        this.toggleMenuVisibility();
      }
      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlayPause();
      }
    });

    const tick = () => {
      if (this.fpsGraph && this.fpsGraph.begin) {
        this.fpsGraph.begin();
      }
      requestAnimationFrame(() => {
        if (this.fpsGraph && this.fpsGraph.end) {
          this.fpsGraph.end();
        }
        requestAnimationFrame(tick);
      });
    };
    requestAnimationFrame(tick);
  }
}
