import { Pane } from 'tweakpane';

/**
 * UIManager handles the floating Tweakpane panel in the top-right corner.
 * Features:
 * - Collapsible & movable floating GUI
 * - Global controls: Active Test Mode selector, Play/Pause, Speed scale, Visibility toggle
 * - Dynamic mode parameter folders that update automatically on mode switch
 * - 'H' hotkey to hide/show GUI for unhindered camera view
 */
export class UIManager {
  constructor({ onPlayPauseToggle, onSpeedChange, onModeChange }) {
    this.onPlayPauseToggle = onPlayPauseToggle;
    this.onSpeedChange = onSpeedChange;
    this.onModeChange = onModeChange;

    this.isPaused = false;
    this.currentSpeed = 1.0;
    this.currentModeId = '';

    this.hudModeName = document.getElementById('hudModeName');

    // Initialize Tweakpane
    this.pane = new Pane({
      title: 'Tracking Controls',
      expanded: true,
    });

    this.modeFolder = null;
    this.setupGlobalControls();
    this.bindKeyboardShortcuts();
  }

  setupGlobalControls() {
    // 1. Playback folder
    const globalFolder = this.pane.addFolder({
      title: 'Global Settings',
      expanded: true,
    });

    // Speed Slider
    globalFolder
      .addBinding({ speed: this.currentSpeed }, 'speed', {
        min: 0.2,
        max: 4.0,
        step: 0.1,
        label: 'Speed',
      })
      .on('change', (ev) => {
        this.currentSpeed = ev.value;
        if (this.onSpeedChange) {
          this.onSpeedChange(this.currentSpeed);
        }
      });

    // Play / Pause Button
    this.playPauseBtn = globalFolder.addButton({
      title: '⏸ Pause',
      label: 'Playback',
    });

    this.playPauseBtn.on('click', () => {
      this.isPaused = !this.isPaused;
      this.playPauseBtn.title = this.isPaused ? '▶ Play' : '⏸ Pause';
      if (this.onPlayPauseToggle) {
        this.onPlayPauseToggle(this.isPaused);
      }
    });

    // Test Mode Dropdown binding
    this.modeParams = { mode: '' };
    this.modeBinding = globalFolder
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
  }

  populateModeList(modes, selectedId) {
    this.currentModeId = selectedId;
    this.modeParams.mode = selectedId;

    // Convert mode array to Tweakpane options mapping: { 'Display Name': 'id' }
    const options = {};
    modes.forEach((m) => {
      options[m.name] = m.id;
    });

    // Rebind dropdown with populated options
    this.modeBinding.dispose();
    const globalFolder = this.pane.children[0];
    this.modeBinding = globalFolder
      .addBinding(this.modeParams, 'mode', {
        label: 'Test Mode',
        options,
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
    if (this.hudModeName) {
      this.hudModeName.textContent = modeInstance.name;
    }

    // Dispose old mode parameter folder if exists
    if (this.modeFolder) {
      this.modeFolder.dispose();
      this.modeFolder = null;
    }

    const controls = modeInstance.getControls();
    if (!controls || controls.length === 0) return;

    this.modeFolder = this.pane.addFolder({
      title: `${modeInstance.name} Params`,
      expanded: true,
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

  bindKeyboardShortcuts() {
    // Press 'H' to toggle GUI visibility for completely clean camera tracking testing
    window.addEventListener('keydown', (e) => {
      if (e.key === 'h' || e.key === 'H') {
        const el = this.pane.element;
        if (el) {
          el.style.display = el.style.display === 'none' ? '' : 'none';
        }
      }
    });
  }
}
