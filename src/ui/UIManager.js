import { Pane } from 'tweakpane';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';

/**
 * UIManager handles the floating Tweakpane panel with extended camera testing controls:
 * - Can be collapsed into an icon or reopened via the top-right toggle button or 'H' hotkey.
 * - Ghost GitHub badge at bottom right expanding on hover.
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

    this.toggleMenuBtn = document.getElementById('toggleMenuBtn');

    // Initialize Tweakpane
    this.pane = new Pane({
      title: '🎥 Gimbal Test Suite',
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
    // FOLDER 1: Test Mode Selection & Playback
    // -------------------------------------------------------------
    const playbackFolder = this.pane.addFolder({
      title: 'Control & Playback',
      expanded: true,
    });

    // Test Mode Dropdown binding
    this.modeParams = { mode: '' };
    this.modeBinding = playbackFolder
      .addBinding(this.modeParams, 'mode', {
        label: 'Test Mode',
        options: {},
      })
      .on('change', (ev) => {
        if (ev.value && ev.value !== this.currentModeId) {
          this.currentModeId = ev.value;
          if (this.onModeChange) {
            this.onModeChange(ev.value);
          }
        }
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

  toggleMenuVisibility() {
    this.isMenuVisible = !this.isMenuVisible;
    const el = this.pane.element;
    if (el) {
      if (this.isMenuVisible) {
        el.classList.remove('tp-hidden');
        if (this.toggleMenuBtn) this.toggleMenuBtn.classList.add('active');
      } else {
        el.classList.add('tp-hidden');
        if (this.toggleMenuBtn) this.toggleMenuBtn.classList.remove('active');
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

  populateModeList(modes, selectedId) {
    this.currentModeId = selectedId;
    this.modeParams.mode = selectedId;

    const options = {};
    modes.forEach((m) => {
      options[m.name] = m.id;
    });

    this.modeBinding.dispose();
    const playbackFolder = this.pane.children[0];
    this.modeBinding = playbackFolder
      .addBinding(this.modeParams, 'mode', {
        label: 'Test Mode',
        options,
        index: 0,
      })
      .on('change', (ev) => {
        if (ev.value && ev.value !== this.currentModeId) {
          this.currentModeId = ev.value;
          if (this.onModeChange) {
            this.onModeChange(ev.value);
          }
        }
      });
  }

  renderModeControls(modeInstance) {
    if (this.modeFolder) {
      this.modeFolder.dispose();
      this.modeFolder = null;
    }

    const controls = modeInstance.getControls();
    if (!controls || controls.length === 0) return;

    this.modeFolder = this.pane.addFolder({
      title: `⚙️ ${modeInstance.name} Params`,
      expanded: true,
      index: 1, // Place right below Control & Playback
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

  bindEvents() {
    // Toggle menu with top-right gear icon button
    if (this.toggleMenuBtn) {
      this.toggleMenuBtn.classList.add('active');
      this.toggleMenuBtn.addEventListener('click', () => {
        this.toggleMenuVisibility();
      });
    }

    window.addEventListener('keydown', (e) => {
      // Toggle GUI with 'H'
      if (e.key === 'h' || e.key === 'H') {
        this.toggleMenuVisibility();
      }
      // Toggle Play/Pause with 'Space'
      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlayPause();
      }
    });

    // Start FPS graph ticker
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
