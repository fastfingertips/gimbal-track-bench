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

  // Canvas Quick Inspector elements
  private canvasInspector: HTMLElement | null;
  private inspectorTitle: HTMLElement | null;
  private inspectorBody: HTMLElement | null;
  private closeInspectorBtn: HTMLElement | null;

  public pane: any;
  private modeFolder: any = null;
  private playPauseBtn: any;
  private fpsGraph: any;
  private activeModeRef: BaseMode | null = null;

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

    this.canvasInspector = document.getElementById('canvasInspector');
    this.inspectorTitle = document.getElementById('inspectorTitle');
    this.inspectorBody = document.getElementById('inspectorBody');
    this.closeInspectorBtn = document.getElementById('closeInspectorBtn');

    this.pane = new Pane({
      container: this.guiContainer as HTMLElement,
      title: 'Controls & Tuning',
      expanded: true,
    });

    this.pane.registerPlugin(EssentialsPlugin);

    this.setupGlobalFolders();
    this.bindEvents();
    this.bindCanvasInteraction();
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
    this.activeModeRef = modeInstance;
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
            this.syncInspectorValues(ctrl.id, ev.value);
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
            this.syncInspectorValues(ctrl.id, ev.value);
          });
      } else if (ctrl.type === 'checkbox') {
        const state = { [ctrl.id]: !!ctrl.value };
        this.modeFolder
          .addBinding(state, ctrl.id, {
            label: ctrl.label,
          })
          .on('change', (ev: { value: any }) => {
            ctrl.onChange(ev.value);
            this.syncInspectorValues(ctrl.id, ev.value);
          });
      }
    });
  }

  // -------------------------------------------------------------
  // CANVAS CLICK INSPECTOR & PAUSE LOGIC
  // -------------------------------------------------------------
  private bindCanvasInteraction(): void {
    const canvasContainer = document.getElementById('canvas-container');
    if (!canvasContainer) return;

    canvasContainer.addEventListener('click', (e: MouseEvent) => {
      // If user clicked directly on canvas (not on any HUD/menu)
      if (this.isDropdownOpen) {
        this.closeDropdown();
        return;
      }

      // If inspector is currently visible, clicking canvas resumes playback and hides inspector
      if (this.canvasInspector && !this.canvasInspector.classList.contains('hidden')) {
        this.hideInspectorAndResume();
        return;
      }

      // Pause playback and open quick property inspector at click location
      this.pauseAndShowInspector(e.clientX, e.clientY);
    });

    if (this.closeInspectorBtn) {
      this.closeInspectorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hideInspectorAndResume();
      });
    }
  }

  public pauseAndShowInspector(clickX: number, clickY: number): void {
    if (!this.isPaused) {
      this.togglePlayPause();
    }

    if (!this.canvasInspector || !this.inspectorBody || !this.activeModeRef) return;

    if (this.inspectorTitle) {
      this.inspectorTitle.textContent = `${this.activeModeRef.name.split('(')[0].trim()} Properties`;
    }

    this.inspectorBody.innerHTML = '';
    const controls = this.activeModeRef.getControls();

    controls.forEach((ctrl) => {
      const row = document.createElement('div');
      row.className = 'inspector-item';

      if (ctrl.type === 'range') {
        const labelRow = document.createElement('div');
        labelRow.className = 'inspector-label-row';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = ctrl.label;

        const valSpan = document.createElement('span');
        valSpan.className = 'inspector-val';
        valSpan.id = `insp-val-${ctrl.id}`;
        valSpan.textContent = String(ctrl.value);

        labelRow.appendChild(nameSpan);
        labelRow.appendChild(valSpan);

        const input = document.createElement('input');
        input.type = 'range';
        input.className = 'inspector-input-range';
        input.id = `insp-input-${ctrl.id}`;
        input.min = String(ctrl.min ?? 0);
        input.max = String(ctrl.max ?? 100);
        input.step = String(ctrl.step ?? 1);
        input.value = String(ctrl.value);

        input.addEventListener('input', (ev) => {
          const v = parseFloat((ev.target as HTMLInputElement).value);
          valSpan.textContent = String(v);
          ctrl.onChange(v);
          this.pane.refresh();
        });

        row.appendChild(labelRow);
        row.appendChild(input);
      } else if (ctrl.type === 'select') {
        const labelRow = document.createElement('div');
        labelRow.className = 'inspector-label-row';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = ctrl.label;
        labelRow.appendChild(nameSpan);

        const select = document.createElement('select');
        select.className = 'inspector-select';
        select.id = `insp-input-${ctrl.id}`;

        if (ctrl.options) {
          Object.entries(ctrl.options).forEach(([optLabel, optVal]) => {
            const opt = document.createElement('option');
            opt.value = String(optVal);
            opt.textContent = optLabel;
            if (String(optVal) === String(ctrl.value)) {
              opt.selected = true;
            }
            select.appendChild(opt);
          });
        }

        select.addEventListener('change', (ev) => {
          const v = (ev.target as HTMLSelectElement).value;
          ctrl.onChange(v);
          this.pane.refresh();
        });

        row.appendChild(labelRow);
        row.appendChild(select);
      }

      this.inspectorBody.appendChild(row);
    });

    // Position inspector intelligently near click position but within screen bounds
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const panelW = 290;
    const panelH = 260;

    let posX = clickX + 15;
    let posY = clickY + 15;

    if (posX + panelW > screenW - 20) {
      posX = clickX - panelW - 15;
    }
    if (posY + panelH > screenH - 20) {
      posY = screenH - panelH - 20;
    }
    if (posY < 20) posY = 20;
    if (posX < 20) posX = 20;

    this.canvasInspector.style.left = `${posX}px`;
    this.canvasInspector.style.top = `${posY}px`;
    this.canvasInspector.classList.remove('hidden');
  }

  public hideInspectorAndResume(): void {
    if (this.canvasInspector) {
      this.canvasInspector.classList.add('hidden');
    }
    if (this.isPaused) {
      this.togglePlayPause();
    }
  }

  private syncInspectorValues(ctrlId: string, val: any): void {
    const valSpan = document.getElementById(`insp-val-${ctrlId}`);
    if (valSpan) valSpan.textContent = String(val);

    const input = document.getElementById(`insp-input-${ctrlId}`) as HTMLInputElement | HTMLSelectElement;
    if (input) input.value = String(val);
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
    if (this.modeDropdownBtn) {
      this.modeDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDropdown();
      });
    }

    window.addEventListener('click', (e) => {
      if (this.isDropdownOpen && !this.modeMenuWrapper?.contains(e.target as Node)) {
        this.closeDropdown();
      }
    });

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
        if (this.canvasInspector && !this.canvasInspector.classList.contains('hidden')) {
          this.hideInspectorAndResume();
        } else {
          this.togglePlayPause();
        }
      }
      if (e.key === 'Escape') {
        if (this.isDropdownOpen) this.closeDropdown();
        if (this.canvasInspector && !this.canvasInspector.classList.contains('hidden')) {
          this.hideInspectorAndResume();
        }
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
