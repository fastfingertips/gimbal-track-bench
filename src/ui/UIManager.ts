import { Pane } from 'tweakpane';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';
import type { BaseMode } from '../core/BaseMode';
import type { GlobalConfig } from '../core/GlobalConfig';
import type { InspectableEntity } from '../core/SceneInspector';

export interface UIManagerOptions {
  onPlayPauseToggle: (isPaused: boolean) => void;
  onSpeedChange: (speed: number) => void;
  onModeChange: (modeId: string) => void;
  onSettingsChange?: () => void;
  globalConfig: GlobalConfig;
}

export class UIManager {
  private onPlayPauseToggle: (isPaused: boolean) => void;
  private onSpeedChange: (speed: number) => void;
  private onModeChange: (modeId: string) => void;
  private onSettingsChange?: () => void;
  private globalConfig: GlobalConfig;

  public isPaused: boolean = false;
  public currentSpeed: number = 1.0;
  public currentModeId: string = '';
  public isMenuVisible: boolean = true;
  private isDropdownOpen: boolean = false;

  // Inactivity / Idle Auto-Hide
  private idleTimeoutId: number | null = null;
  private isUserIdle: boolean = false;
  private readonly IDLE_DELAY_MS: number = 3000;

  private modeMenuWrapper: HTMLElement | null;
  private modeDropdownBtn: HTMLElement | null;
  private triggerActiveName: HTMLElement | null;
  private modeDropdownList: HTMLElement | null;
  private activeModeTitle: HTMLElement | null;
  private guiContainer: HTMLElement | null;
  private toggleMenuBtn: HTMLElement | null;

  // Scene-Wide Inspector HUD elements
  private canvasInspector: HTMLElement | null;
  private inspectorTitle: HTMLElement | null;
  private inspectorBody: HTMLElement | null;
  private closeInspectorBtn: HTMLElement | null;

  // Cursor Tooltip Element
  private cursorTooltip: HTMLElement | null;

  public pane: any;
  private modeFolder: any = null;
  private playPauseBtn: any;
  private fpsGraph: any;
  private activeModeRef: BaseMode | null = null;

  constructor(options: UIManagerOptions) {
    this.onPlayPauseToggle = options.onPlayPauseToggle;
    this.onSpeedChange = options.onSpeedChange;
    this.onModeChange = options.onModeChange;
    this.onSettingsChange = options.onSettingsChange;
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

    this.cursorTooltip = document.getElementById('cursorTooltip');

    // Root pane with NO collapse button or title bar (100% flat panel controlled solely by our toggle icon)
    this.pane = new Pane({
      container: this.guiContainer as HTMLElement,
      expanded: true,
    });

    this.pane.registerPlugin(EssentialsPlugin);

    this.setupGlobalFolders();
    this.bindEvents();
    this.bindCanvasInteraction();
    this.initInactivityTracker();
    this.initCursorHoverTracker();
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
        this.notifySettingsChanged();
      });

    this.playPauseBtn = playbackFolder.addButton({
      title: '⏸ Pause (Space)',
      label: 'Playback',
    });

    this.playPauseBtn.on('click', () => {
      this.togglePlayPause();
    });

    const shareBtn = playbackFolder.addButton({
      title: '📋 Copy Share Link',
      label: 'Share Setup',
    });

    shareBtn.on('click', () => {
      this.notifySettingsChanged();
      if (navigator.clipboard) {
        navigator.clipboard.writeText(window.location.href).then(() => {
          shareBtn.title = '✓ Link Copied!';
          setTimeout(() => {
            shareBtn.title = '📋 Copy Share Link';
          }, 2000);
        }).catch(() => {
          prompt('Copy this URL to share your test setup:', window.location.href);
        });
      } else {
        prompt('Copy this URL to share your test setup:', window.location.href);
      }
    });

    this.fpsGraph = playbackFolder.addBlade({
      view: 'fpsgraph',
      label: 'Performance',
      lineCount: 2,
    });

    const visualFolder = this.pane.addFolder({
      title: 'Camera & Visuals',
      expanded: true,
    });

    if (this.globalConfig) {
      visualFolder
        .addBinding(this.globalConfig.settings, 'targetColor', {
          label: 'Target Color',
          view: 'color',
        })
        .on('change', (ev: { value: string }) => {
          this.globalConfig.set('targetColor', ev.value);
          this.notifySettingsChanged();
        });

      visualFolder
        .addBinding(this.globalConfig.settings, 'targetGlow', {
          label: 'Neon Glow',
        })
        .on('change', (ev: { value: boolean }) => {
          this.globalConfig.set('targetGlow', ev.value);
          this.notifySettingsChanged();
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
          this.notifySettingsChanged();
        });

      visualFolder
        .addBinding(this.globalConfig.settings, 'obstacleColor', {
          label: 'Obstacle Color',
          view: 'color',
        })
        .on('change', (ev: { value: string }) => {
          this.globalConfig.set('obstacleColor', ev.value);
          this.notifySettingsChanged();
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
          this.notifySettingsChanged();
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

  // -------------------------------------------------------------
  // CURSOR HOVER TOOLTIP (Shows entity name near mouse pointer)
  // -------------------------------------------------------------
  private initCursorHoverTracker(): void {
    const canvasContainer = document.getElementById('canvas-container');
    if (!canvasContainer || !this.cursorTooltip) return;

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (
        this.isUserIdle ||
        this.currentModeId === 'manual-control' ||
        (this.canvasInspector && !this.canvasInspector.classList.contains('hidden')) ||
        this.isDropdownOpen
      ) {
        this.hideCursorTooltip();
        return;
      }

      const stage = (this.activeModeRef as any)?.canvasManager?.stage;
      if (!stage) {
        this.hideCursorTooltip();
        return;
      }

      const shape = stage.getIntersection({ x: e.clientX, y: e.clientY });

      if (shape && shape.isVisible()) {
        const entityInfo = this.identifyEntityFromShape(shape);
        if (entityInfo) {
          this.showCursorTooltip(e.clientX, e.clientY, entityInfo.name, entityInfo.tag, entityInfo.color);
          return;
        }
      }

      this.hideCursorTooltip();
    });
  }

  private identifyEntityFromShape(shape: any): { name: string; tag: string; color: string } | null {
    const parentName = shape.parent?.name() || '';
    const layerName = shape.getLayer()?.name() || '';

    if (this.currentModeId === 'linear-occlusion') {
      if (shape.className === 'Circle' || layerName === 'target-layer') {
        return { name: 'Tracking Target', tag: 'Neon Circle', color: shape.fill() || '#007acc' };
      }
      if (shape.className === 'Rect' || layerName === 'obstacle-layer') {
        return { name: 'Occlusion Obstacle', tag: 'Center Pillar', color: shape.fill() || '#141414' };
      }
    }

    if (this.currentModeId === 'distractor-swapping') {
      const groupText = shape.parent?.findOne('Text')?.text();
      if (groupText === 'A' || shape.getLayer()?.name() === 'primary-target-layer') {
        return { name: 'Target A (Primary)', tag: 'Subject Lock', color: '#007acc' };
      }
      if (groupText === 'B' || shape.getLayer()?.name() === 'distractor-layer') {
        return { name: 'Target B (Distractor)', tag: 'Imposter Pass', color: shape.fill() || '#e06c75' };
      }
    }

    if (this.currentModeId === 'depth-zoom') {
      if (shape.className === 'Circle') {
        return { name: 'Perspective Target', tag: 'Auto-Zoom Scale', color: shape.fill() || '#007acc' };
      }
    }

    if (this.currentModeId === 'circular-tracking') {
      if (shape.className === 'Circle') {
        return { name: 'Orbiting Target', tag: 'Pan/Tilt Velocity', color: shape.fill() || '#007acc' };
      }
      if (shape.className === 'Ellipse') {
        return { name: 'Orbit Path Guide', tag: 'Reference Ring', color: '#333338' };
      }
    }

    if (this.currentModeId === 'step-jump') {
      if (shape.className === 'Circle' && shape.radius() > 20) {
        return { name: 'Saccade Target', tag: 'Step Response', color: shape.fill() || '#007acc' };
      }
      if (shape.parent?.className === 'Group' || layerName === 'waypoints-layer') {
        return { name: 'Target Waypoint', tag: 'Quadrant Hop', color: '#555560' };
      }
    }

    // Check Manual Pilot
    if (this.currentModeId === 'manual-control') {
      if (shape.className === 'Circle' || parentName === 'manual-target-group' || layerName === 'target-layer') {
        return { name: 'Manual Pilot Target', tag: 'Mouse / Keys Controlled', color: shape.fill() || '#007acc' };
      }
    }

    // Check Custom Trajectory
    if (this.currentModeId === 'custom-path') {
      if (shape.className === 'Circle' || parentName === 'custom-target-group') {
        return { name: 'Trajectory Target', tag: 'Custom Path Tracking', color: shape.fill() || '#007acc' };
      }
      if (shape.className === 'Line') {
        return { name: 'Drawn Trajectory', tag: 'User Path Guide', color: '#555560' };
      }
    }

    if (shape.className === 'Circle') {
      return { name: 'Target Element', tag: 'Active', color: shape.fill() || '#007acc' };
    }
    if (shape.className === 'Rect') {
      return { name: 'Obstacle Block', tag: 'Static', color: shape.fill() || '#141414' };
    }

    return null;
  }

  private showCursorTooltip(x: number, y: number, name: string, tag: string, color: string): void {
    if (!this.cursorTooltip) return;

    this.cursorTooltip.innerHTML = `
      <span class="tooltip-color-tag" style="background-color: ${color}; box-shadow: 0 0 6px ${color};"></span>
      <span class="tooltip-text">${name}</span>
      <span class="tooltip-sub">${tag}</span>
    `;

    this.cursorTooltip.style.left = `${x}px`;
    this.cursorTooltip.style.top = `${y}px`;
    this.cursorTooltip.classList.remove('hidden');
  }

  private hideCursorTooltip(): void {
    if (this.cursorTooltip && !this.cursorTooltip.classList.contains('hidden')) {
      this.cursorTooltip.classList.add('hidden');
    }
  }

  // -------------------------------------------------------------
  // INACTIVITY / IDLE AUTO-HIDE TRACKER
  // -------------------------------------------------------------
  private initInactivityTracker(): void {
    const resetIdleTimer = () => {
      if (this.isUserIdle) {
        this.isUserIdle = false;
        document.body.classList.remove('user-idle');
      }

      if (this.idleTimeoutId !== null) {
        window.clearTimeout(this.idleTimeoutId);
      }

      if (this.isPaused || this.isDropdownOpen) {
        return;
      }

      this.idleTimeoutId = window.setTimeout(() => {
        if (!this.isPaused && !this.isDropdownOpen) {
          this.isUserIdle = true;
          document.body.classList.add('user-idle');
          this.hideCursorTooltip();
        }
      }, this.IDLE_DELAY_MS);
    };

    window.addEventListener('mousemove', resetIdleTimer, { passive: true });
    window.addEventListener('mousedown', resetIdleTimer, { passive: true });
    window.addEventListener('keydown', resetIdleTimer, { passive: true });
    window.addEventListener('touchstart', resetIdleTimer, { passive: true });

    resetIdleTimer();
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
        const isMatch = btn.getAttribute('data-id') === this.currentModeId || (btn.textContent?.includes(cleanName) ?? false);
        btn.classList.toggle('active', isMatch);
      });
    }
  }

  public renderModeControls(modeInstance: BaseMode): void {
    this.activeModeRef = modeInstance;
    this.currentModeId = modeInstance.id;
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
            this.pane.refresh();
            this.notifySettingsChanged();
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
            this.pane.refresh();
            this.notifySettingsChanged();
          });
      } else if (ctrl.type === 'checkbox') {
        const state = { [ctrl.id]: !!ctrl.value };
        this.modeFolder
          .addBinding(state, ctrl.id, {
            label: ctrl.label,
          })
          .on('change', (ev: { value: any }) => {
            ctrl.onChange(ev.value);
            this.pane.refresh();
            this.notifySettingsChanged();
          });
      }
    });
  }

  // -------------------------------------------------------------
  // FULL SCENE INSPECTOR (INSPECT EVERYTHING IN CANVAS)
  // -------------------------------------------------------------
  private bindCanvasInteraction(): void {
    const canvasContainer = document.getElementById('canvas-container');
    if (!canvasContainer) return;

    let downPos = { x: 0, y: 0 };
    canvasContainer.addEventListener('mousedown', (e: MouseEvent) => {
      downPos = { x: e.clientX, y: e.clientY };
    });

    canvasContainer.addEventListener('click', (e: MouseEvent) => {
      // If user dragged (e.g. while drawing custom trajectory), do not open pause inspector
      if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6) {
        return;
      }

      if (this.isDropdownOpen) {
        this.closeDropdown();
        return;
      }

      if (this.canvasInspector && !this.canvasInspector.classList.contains('hidden')) {
        this.hideInspectorAndResume();
        return;
      }

      this.pauseAndShowSceneInspector(e.clientX, e.clientY);
    });

    if (this.closeInspectorBtn) {
      this.closeInspectorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hideInspectorAndResume();
      });
    }
  }

  public pauseAndShowSceneInspector(clickX: number, clickY: number): void {
    if (!this.isPaused) {
      this.togglePlayPause();
    }

    this.isUserIdle = false;
    document.body.classList.remove('user-idle');
    this.hideCursorTooltip();

    if (!this.canvasInspector || !this.inspectorBody || !this.activeModeRef) return;

    if (this.inspectorTitle) {
      this.inspectorTitle.textContent = `Scene Inspector (${this.activeModeRef.name.split('(')[0].trim()})`;
    }

    this.inspectorBody.innerHTML = '';

    const modeEntities = this.activeModeRef.getSceneEntities();

    const environmentEntity: InspectableEntity = {
      id: 'env-grid',
      name: 'Canvas Environment & Grid',
      category: 'environment',
      colorTag: this.globalConfig.get('gridColor'),
      properties: [
        {
          id: 'env-bg-color',
          label: 'Background Color',
          type: 'color',
          value: this.globalConfig.get('backgroundColor'),
          onChange: (val) => this.globalConfig.set('backgroundColor', val),
        },
        {
          id: 'env-grid-show',
          label: 'Show Reference Grid',
          type: 'boolean',
          value: this.globalConfig.get('showGrid'),
          onChange: (val) => this.globalConfig.set('showGrid', val),
        },
        {
          id: 'env-grid-spacing',
          label: 'Grid Spacing (px)',
          type: 'slider',
          min: 30,
          max: 150,
          step: 10,
          value: this.globalConfig.get('gridSpacing'),
          onChange: (val) => this.globalConfig.set('gridSpacing', val),
        },
        {
          id: 'env-crosshair',
          label: 'Center Alignment Reticle',
          type: 'boolean',
          value: this.globalConfig.get('crosshair'),
          onChange: (val) => this.globalConfig.set('crosshair', val),
        },
      ],
    };

    const allEntities = [...modeEntities, environmentEntity];

    allEntities.forEach((entity) => {
      const section = document.createElement('div');
      section.className = 'inspector-entity-section';

      const secHeader = document.createElement('div');
      secHeader.className = 'entity-section-header';

      const leftWrap = document.createElement('div');
      leftWrap.className = 'entity-header-left';

      const dot = document.createElement('span');
      dot.className = 'entity-color-dot';
      dot.style.backgroundColor = entity.colorTag;

      const title = document.createElement('span');
      title.className = 'entity-title';
      title.textContent = entity.name;

      leftWrap.appendChild(dot);
      leftWrap.appendChild(title);

      const catBadge = document.createElement('span');
      catBadge.className = 'entity-cat-badge';
      catBadge.textContent = entity.category.toUpperCase();

      secHeader.appendChild(leftWrap);
      secHeader.appendChild(catBadge);
      section.appendChild(secHeader);

      const propsContainer = document.createElement('div');
      propsContainer.className = 'entity-props-container';

      entity.properties.forEach((prop) => {
        const item = document.createElement('div');
        item.className = 'inspector-item';

        const labelRow = document.createElement('div');
        labelRow.className = 'inspector-label-row';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = prop.label;
        labelRow.appendChild(nameSpan);

        if (prop.type === 'slider' || prop.type === 'number') {
          const valSpan = document.createElement('span');
          valSpan.className = 'inspector-val';
          valSpan.textContent = String(prop.value);
          labelRow.appendChild(valSpan);
          item.appendChild(labelRow);

          const input = document.createElement('input');
          input.type = 'range';
          input.className = 'inspector-input-range';
          input.min = String(prop.min ?? 0);
          input.max = String(prop.max ?? 100);
          input.step = String(prop.step ?? 1);
          input.value = String(prop.value);

          input.addEventListener('input', (ev) => {
            const v = parseFloat((ev.target as HTMLInputElement).value);
            valSpan.textContent = String(v);
            prop.onChange(v);
            this.pane.refresh();
            this.notifySettingsChanged();
          });

          item.appendChild(input);
        } else if (prop.type === 'color') {
          const colorInput = document.createElement('input');
          colorInput.type = 'color';
          colorInput.className = 'inspector-input-color';
          colorInput.value = String(prop.value);

          colorInput.addEventListener('input', (ev) => {
            const val = (ev.target as HTMLInputElement).value;
            dot.style.backgroundColor = val;
            prop.onChange(val);
            this.pane.refresh();
            this.notifySettingsChanged();
          });

          labelRow.appendChild(colorInput);
          item.appendChild(labelRow);
        } else if (prop.type === 'boolean') {
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'inspector-input-checkbox';
          checkbox.checked = !!prop.value;

          checkbox.addEventListener('change', (ev) => {
            prop.onChange((ev.target as HTMLInputElement).checked);
            this.pane.refresh();
            this.notifySettingsChanged();
          });

          labelRow.appendChild(checkbox);
          item.appendChild(labelRow);
        }

        propsContainer.appendChild(item);
      });

      section.appendChild(propsContainer);
      this.inspectorBody.appendChild(section);
    });

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const panelW = 320;
    const panelH = 420;

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
    document.body.classList.toggle('is-paused', this.isPaused);
    this.playPauseBtn.title = this.isPaused ? '▶ Play (Space)' : '⏸ Pause (Space)';
    if (this.onPlayPauseToggle) {
      this.onPlayPauseToggle(this.isPaused);
    }
  }

  public notifySettingsChanged(): void {
    if (this.onSettingsChange) {
      this.onSettingsChange();
    }
  }

  public setSpeed(speed: number): void {
    this.currentSpeed = speed;
    if (this.onSpeedChange) {
      this.onSpeedChange(speed);
    }
    if (this.pane) {
      this.pane.refresh();
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
