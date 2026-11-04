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
  private isDropdownOpen: boolean = false;

  private modeMenuWrapper: HTMLElement | null;
  private modeDropdownBtn: HTMLElement | null;
  private triggerActiveName: HTMLElement | null;
  private modeDropdownList: HTMLElement | null;
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

    this.modeMenuWrapper = document.getElementById('modeMenuWrapper');
    this.modeDropdownBtn = document.getElementById('modeDropdownBtn');
    this.triggerActiveName = document.getElementById('triggerActiveName');
    this.modeDropdownList = document.getElementById('modeDropdownList');
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

  /**
   * Render Top-Left Soft Dropdown list of modes
   */
  public populateModeList(modes: Array<{ id: string; name: string; description: string }>, selectedId: string): void {
    this.currentModeId = selectedId;
    if (!this.modeDropdownList) return;

    this.modeDropdownList.innerHTML = '';
    modes.forEach((mode) => {
      const itemBtn = document.createElement('button');
      itemBtn.type = 'button';
      itemBtn.className = `mode-item-btn ${mode.id === selectedId ? 'active' : ''}`;
      itemBtn.setAttribute('data-id', mode.id);

      const nameSpan = document.createElement('span');
      nameSpan.textContent = mode.name.split('(')[0].trim();

      const dot = document.createElement('span');
      dot.className = 'mode-item-dot';

      itemBtn.appendChild(nameSpan);
      itemBtn.appendChild(dot);

      itemBtn.addEventListener('click', () => {
        if (this.currentModeId !== mode.id) {
          this.currentModeId = mode.id;
          this.closeDropdown();
          if (this.onModeChange) {
            this.onModeChange(mode.id);
          }
        } else {
          this.closeDropdown();
        }
      });

      this.modeDropdownList.appendChild(itemBtn);
    });

    const activeObj = modes.find((m) => m.id === selectedId);
    if (activeObj) {
      this.updateActiveLabels(activeObj.name);
    }
  }

  private updateActiveLabels(name: string): void {
    const cleanName = name.split('(')[0].trim();
    if (this.triggerActiveName) {
      this.triggerActiveName.textContent = cleanName;
    }
    if (this.activeModeTitle) {
      this.activeModeTitle.textContent = cleanName;
    }

    if (this.modeDropdownList) {
      const items = this.modeDropdownList.querySelectorAll<HTMLButtonElement>('.mode-item-btn');
      items.forEach((btn) => {
        const isMatch = btn.textContent?.includes(cleanName) ?? false;
        btn.classList.toggle('active', isMatch);
      });
    }
  }

  public renderModeControls(modeInstance: BaseMode): void {
    this.updateActiveLabels(modeInstance.name);

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

  public toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
    if (this.modeDropdownList && this.modeMenuWrapper) {
      if (this.isDropdownOpen) {
        this.modeDropdownList.classList.remove('hidden');
        this.modeMenuWrapper.classList.add('open');
      } else {
        this.closeDropdown();
      }
    }
  }

  public closeDropdown(): void {
    this.isDropdownOpen = false;
    if (this.modeDropdownList && this.modeMenuWrapper) {
      this.modeDropdownList.classList.add('hidden');
      this.modeMenuWrapper.classList.remove('open');
    }
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
    // Mode dropdown toggle button
    if (this.modeDropdownBtn) {
      this.modeDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDropdown();
      });
    }

    // Close dropdown on outside click
    window.addEventListener('click', (e) => {
      if (this.isDropdownOpen && !this.modeMenuWrapper?.contains(e.target as Node)) {
        this.closeDropdown();
      }
    });

    // Right menu toggle button
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
      if (e.key === 'Escape' && this.isDropdownOpen) {
        this.closeDropdown();
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
