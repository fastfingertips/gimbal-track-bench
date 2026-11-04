import { Pane } from 'tweakpane';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';
import type { BaseMode } from '../core/BaseMode';
import type { GlobalConfig } from '../core/GlobalConfig';

export interface UIManagerOptions {
  onPlayPauseToggle: (isPaused: boolean) => void;
  onSpeedChange: (speed: number) => void;
  onModeChange: (modeId: string) => void;
  globalConfig: GlobalConfig;
}

export class UIManager {
  private onPlayPauseToggle: (isPaused: boolean) => void;
  private onSpeedChange: (speed: number) => void;
  private onModeChange: (modeId: string) => void;
  private globalConfig: GlobalConfig;

  public isPaused: boolean = false;
  public currentSpeed: number = 1.0;
  public currentModeId: string = '';
  public isMenuVisible: boolean = true;

  private modeBar: HTMLElement | null;
  private activeModeTitle: HTMLElement | null;
  private guiContainer: HTMLElement | null;
  private toggleMenuBtn: HTMLElement | null;

  public pane: any;
  private modeFolder: any = null;
  private playPauseBtn: any;
  private fpsGraph: any;

  constructor(options: UIManagerOptions) {
    this.onPlayPauseToggle = options.onPlayPauseToggle;
    this.onSpeedChange = options.onSpeedChange;
    this.onModeChange = options.onModeChange;
    this.globalConfig = options.globalConfig;

    this.modeBar = document.getElementById('modeBar');
    this.activeModeTitle = document.getElementById('activeModeTitle');
    this.guiContainer = document.getElementById('gui-container');
    this.toggleMenuBtn = document.getElementById('toggleMenuBtn');

    this.pane = new Pane({
      container: this.guiContainer as HTMLElement,
      title: 'Controls & Tuning',
      expanded: true,
    });

    this.pane.registerPlugin(EssentialsPlugin);

    this.setupGlobalFolders();
    this.bindEvents();
  }

  private setupGlobalFolders(): void {
    const playbackFolder = this.pane.addFolder({
      title: 'Engine & Playback',
      expanded: true,
    });

    playbackFolder
      .addBinding({ speed: this.currentSpeed }, 'speed', {
        min: 0.1,
        max: 5.0,
        step: 0.1,
        label: 'Speed Scale',
      })
      .on('change', (ev: { value: number }) => {
        this.currentSpeed = ev.value;
        if (this.onSpeedChange) {
          this.onSpeedChange(this.currentSpeed);
        }
      });

    this.playPauseBtn = playbackFolder.addButton({
      title: '⏸ Pause (Space)',
      label: 'Playback',
    });

    this.playPauseBtn.on('click', () => {
      this.togglePlayPause();
    });

    this.fpsGraph = playbackFolder.addBlade({
      view: 'fpsgraph',
      label: 'Performance',
      lineCount: 2,
    });

    const visualFolder = this.pane.addFolder({
      title: 'Camera & Visuals',
      expanded: false,
    });

    if (this.globalConfig) {
      visualFolder
        .addBinding(this.globalConfig.settings, 'targetColor', {
          label: 'Target Color',
          view: 'color',
        })
        .on('change', (ev: { value: string }) => {
          this.globalConfig.set('targetColor', ev.value);
        });

      visualFolder
        .addBinding(this.globalConfig.settings, 'targetGlow', {
          label: 'Neon Glow',
        })
        .on('change', (ev: { value: boolean }) => {
          this.globalConfig.set('targetGlow', ev.value);
        });

      visualFolder
        .addBinding(this.globalConfig.settings, 'glowBlur', {
          label: 'Glow Blur',
          min: 0,
          max: 40,
          step: 2,
        })
        .on('change', (ev: { value: number }) => {
          this.globalConfig.set('glowBlur', ev.value);
        });

      visualFolder
        .addBinding(this.globalConfig.settings, 'obstacleColor', {
          label: 'Obstacle Color',
          view: 'color',
        })
        .on('change', (ev: { value: string }) => {
          this.globalConfig.set('obstacleColor', ev.value);
        });

      visualFolder
        .addBinding(this.globalConfig.settings, 'obstacleOpacity', {
          label: 'Obstacle Alpha',
          min: 0.1,
          max: 1.0,
          step: 0.05,
        })
        .on('change', (ev: { value: number }) => {
          this.globalConfig.set('obstacleOpacity', ev.value);
        });

      visualFolder
        .addBinding(this.globalConfig.settings, 'backgroundColor', {
          label: 'Background',
          view: 'color',
        })
        .on('change', (ev: { value: string }) => {
          this.globalConfig.set('backgroundColor', ev.value);
        });

      visualFolder
        .addBinding(this.globalConfig.settings, 'showGrid', {
          label: 'Reference Grid',
        })
        .on('change', (ev: { value: boolean }) => {
          this.globalConfig.set('showGrid', ev.value);
        });

      visualFolder
        .addBinding(this.globalConfig.settings, 'crosshair', {
          label: 'Center Reticle',
        })
        .on('change', (ev: { value: boolean }) => {
          this.globalConfig.set('crosshair', ev.value);
        });
    }
  }

  public populateModeList(modes: Array<{ id: string; name: string; description: string }>, selectedId: string): void {
    this.currentModeId = selectedId;
    if (!this.modeBar) return;

    this.modeBar.innerHTML = '';
    modes.forEach((mode) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `mode-pill ${mode.id === selectedId ? 'active' : ''}`;
      btn.textContent = mode.name.split('(')[0].trim();
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

  public updateActivePill(modeId: string): void {
    if (!this.modeBar) return;
    const buttons = this.modeBar.querySelectorAll<HTMLButtonElement>('.mode-pill');
    buttons.forEach((btn) => {
      btn.classList.toggle('active', btn.textContent === this.getModeShortName(modeId));
    });
  }

  private getModeShortName(modeId: string): string {
    const map: Record<string, string> = {
      'linear-occlusion': 'Linear Occlusion',
      'distractor-swapping': 'Crossing Paths',
      'depth-zoom': 'Depth & Auto-Zoom',
      'circular-tracking': 'Circular Orbit',
      'step-jump': 'Step Response & Saccade Jump',
    };
    return map[modeId] || modeId;
  }

  public renderModeControls(modeInstance: BaseMode): void {
    if (this.activeModeTitle) {
      this.activeModeTitle.textContent = modeInstance.name;
    }

    if (this.modeBar) {
      const buttons = this.modeBar.querySelectorAll<HTMLButtonElement>('.mode-pill');
      buttons.forEach((btn) => {
        const isThis = modeInstance.name.startsWith(btn.textContent || '');
        btn.classList.toggle('active', isThis);
      });
    }

    if (this.modeFolder) {
      this.modeFolder.dispose();
      this.modeFolder = null;
    }

    const controls = modeInstance.getControls();
    if (!controls || controls.length === 0) return;

    this.modeFolder = this.pane.addFolder({
      title: `⚙️ Mode Parameters`,
      expanded: true,
      index: 0,
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
          .on('change', (ev: { value: any }) => {
            ctrl.onChange(ev.value);
          });
      } else if (ctrl.type === 'select') {
        const state = { [ctrl.id]: ctrl.value };
        this.modeFolder
          .addBinding(state, ctrl.id, {
            label: ctrl.label,
            options: ctrl.options,
          })
          .on('change', (ev: { value: any }) => {
            ctrl.onChange(ev.value);
          });
      } else if (ctrl.type === 'checkbox') {
        const state = { [ctrl.id]: !!ctrl.value };
        this.modeFolder
          .addBinding(state, ctrl.id, {
            label: ctrl.label,
          })
          .on('change', (ev: { value: any }) => {
            ctrl.onChange(ev.value);
          });
      }
    });
  }

  public toggleMenuVisibility(): void {
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

  public togglePlayPause(): void {
    this.isPaused = !this.isPaused;
    this.playPauseBtn.title = this.isPaused ? '▶ Play (Space)' : '⏸ Pause (Space)';
    if (this.onPlayPauseToggle) {
      this.onPlayPauseToggle(this.isPaused);
    }
  }

  private bindEvents(): void {
    if (this.toggleMenuBtn) {
      this.toggleMenuBtn.classList.add('active');
      this.toggleMenuBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleMenuVisibility();
      });
    }

    window.addEventListener('keydown', (e: KeyboardEvent) => {
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
