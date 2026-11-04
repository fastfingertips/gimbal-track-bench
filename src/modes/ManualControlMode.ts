import Konva from 'konva';
import { BaseMode } from '../core/BaseMode';
import type { ModeControlSpec } from '../core/BaseMode';
import type { GlobalSettings } from '../core/GlobalConfig';
import type { InspectableEntity } from '../core/SceneInspector';

export type InputMode = 'both' | 'mouse' | 'keyboard';
export type BoundaryMode = 'clamp' | 'wrap' | 'free';

interface TrailPoint {
  x: number;
  y: number;
}

export class ManualControlMode extends BaseMode {
  // Target geometry & aesthetics
  private radius: number = 36;
  private currentX: number = 0;
  private currentY: number = 0;
  private targetMouseX: number = 0;
  private targetMouseY: number = 0;

  // Configuration options
  private inputMode: InputMode = 'both';
  private keySpeed: number = 16;
  private mouseSmoothing: number = 0.15; // 0 = instant snap, 0.9 = heavy glide
  private showTrail: boolean = true;
  private showReticle: boolean = true;
  private boundaryMode: BoundaryMode = 'clamp';

  // Konva graphic nodes
  private targetLayer!: Konva.Layer;
  private trailLayer!: Konva.Layer;
  private targetGroup!: Konva.Group;
  private targetCircle!: Konva.Circle;
  private centerPip!: Konva.Circle;
  private reticleHLine!: Konva.Line;
  private reticleVLine!: Konva.Line;
  private reticleRing!: Konva.Circle;
  private trailDots: Konva.Circle[] = [];

  // Motion history for trail
  private trailHistory: TrailPoint[] = [];
  private readonly maxTrailLength: number = 18;

  // Keyboard state
  private activeKeys: Set<string> = new Set();

  // Animation and event listeners
  private anim: Konva.Animation | null = null;
  private onKeyDownBound: ((e: KeyboardEvent) => void) | null = null;
  private onKeyUpBound: ((e: KeyboardEvent) => void) | null = null;
  private onMouseMoveBound: ((e: MouseEvent) => void) | null = null;
  private onTouchMoveBound: ((e: TouchEvent) => void) | null = null;

  constructor() {
    super({
      id: 'manual-control',
      name: 'Manual Pilot (Mouse & Keys)',
      description: 'Interactive real-time steering with hidden cursor. Move via mouse position or Arrow/WASD keys.',
    });
  }

  public getControls(): ModeControlSpec[] {
    return [
      {
        id: 'inputMode',
        label: 'Input Source',
        type: 'select',
        options: {
          'Mouse & Keys': 'both',
          'Mouse Only': 'mouse',
          'Keyboard Only': 'keyboard',
        },
        value: this.inputMode,
        onChange: (val: InputMode) => {
          this.inputMode = val;
        },
      },
      {
        id: 'mouseSmoothing',
        label: 'Mouse Glide (Inertia)',
        type: 'range',
        min: 0,
        max: 0.9,
        step: 0.05,
        value: this.mouseSmoothing,
        onChange: (val: number) => {
          this.mouseSmoothing = val;
        },
      },
      {
        id: 'keySpeed',
        label: 'Key Speed (px)',
        type: 'range',
        min: 5,
        max: 50,
        step: 1,
        value: this.keySpeed,
        onChange: (val: number) => {
          this.keySpeed = val;
        },
      },
      {
        id: 'targetRadius',
        label: 'Target Size',
        type: 'range',
        min: 12,
        max: 100,
        step: 2,
        value: this.radius,
        onChange: (val: number) => {
          this.radius = val;
          this.updateTargetGeometry();
        },
      },
      {
        id: 'showReticle',
        label: 'Gimbal Reticle',
        type: 'checkbox',
        value: this.showReticle,
        onChange: (val: boolean) => {
          this.showReticle = val;
          this.updateReticleVisibility();
        },
      },
      {
        id: 'showTrail',
        label: 'Motion Trail',
        type: 'checkbox',
        value: this.showTrail,
        onChange: (val: boolean) => {
          this.showTrail = val;
          if (!val) {
            this.clearTrail();
          }
        },
      },
      {
        id: 'boundaryMode',
        label: 'Screen Boundary',
        type: 'select',
        options: {
          'Clamp (Screen Bounds)': 'clamp',
          'Wrap Around Edges': 'wrap',
          'Free (Unbounded)': 'free',
        },
        value: this.boundaryMode,
        onChange: (val: BoundaryMode) => {
          this.boundaryMode = val;
        },
      },
    ];
  }

  public override getSceneEntities(): InspectableEntity[] {
    const targetColor = this.globalConfig ? this.globalConfig.get('targetColor') : '#007acc';
    const targetGlow = this.globalConfig ? this.globalConfig.get('targetGlow') : true;
    const glowBlur = this.globalConfig ? this.globalConfig.get('glowBlur') : 14;

    const entities: InspectableEntity[] = [
      {
        id: 'manual-target',
        name: 'Manual Controlled Target',
        category: 'target',
        colorTag: targetColor,
        position: { x: Math.round(this.currentX), y: Math.round(this.currentY) },
        properties: [
          {
            id: 'manual-pos-x',
            label: 'X Coordinate',
            type: 'slider',
            min: this.radius,
            max: this.canvasManager ? this.canvasManager.getDimensions().width - this.radius : 1920,
            step: 5,
            value: Math.round(this.currentX),
            onChange: (val) => {
              this.currentX = val;
              this.targetMouseX = val;
              this.syncPositionToCanvas();
            },
          },
          {
            id: 'manual-pos-y',
            label: 'Y Coordinate',
            type: 'slider',
            min: this.radius,
            max: this.canvasManager ? this.canvasManager.getDimensions().height - this.radius : 1080,
            step: 5,
            value: Math.round(this.currentY),
            onChange: (val) => {
              this.currentY = val;
              this.targetMouseY = val;
              this.syncPositionToCanvas();
            },
          },
          {
            id: 'manual-size',
            label: 'Target Radius',
            type: 'slider',
            min: 10,
            max: 120,
            step: 2,
            value: this.radius,
            onChange: (val) => {
              this.radius = val;
              this.updateTargetGeometry();
            },
          },
          {
            id: 'manual-keyspeed',
            label: 'Keyboard Move Speed',
            type: 'slider',
            min: 5,
            max: 50,
            step: 1,
            value: this.keySpeed,
            onChange: (val) => {
              this.keySpeed = val;
            },
          },
          {
            id: 'manual-smoothing',
            label: 'Mouse Glide Inertia',
            type: 'slider',
            min: 0,
            max: 0.9,
            step: 0.05,
            value: this.mouseSmoothing,
            onChange: (val) => {
              this.mouseSmoothing = val;
            },
          },
          {
            id: 'manual-trail',
            label: 'Trajectory Trail',
            type: 'boolean',
            value: this.showTrail,
            onChange: (val) => {
              this.showTrail = val;
              if (!val) this.clearTrail();
            },
          },
          {
            id: 'target-color',
            label: 'Target Color',
            type: 'color',
            value: targetColor,
            onChange: (val) => {
              if (this.globalConfig) this.globalConfig.set('targetColor', val);
            },
          },
          {
            id: 'target-glow',
            label: 'Neon Glow',
            type: 'boolean',
            value: targetGlow,
            onChange: (val) => {
              if (this.globalConfig) this.globalConfig.set('targetGlow', val);
            },
          },
          {
            id: 'glow-blur',
            label: 'Glow Intensity',
            type: 'slider',
            min: 0,
            max: 50,
            step: 2,
            value: glowBlur,
            onChange: (val) => {
              if (this.globalConfig) this.globalConfig.set('glowBlur', val);
            },
          },
        ],
      },
    ];

    return entities;
  }

  public setupElements(): void {
    const { width, height } = this.canvasManager!.getDimensions();

    this.trailLayer = this.canvasManager!.getLayer('guide-layer');
    this.targetLayer = this.canvasManager!.getLayer('target-layer');

    // Default start position is dead center
    this.currentX = width / 2;
    this.currentY = height / 2;
    this.targetMouseX = this.currentX;
    this.targetMouseY = this.currentY;

    // Build Motion Trail Pool
    this.trailDots = [];
    const targetColor = this.globalConfig ? this.globalConfig.get('targetColor') : '#007acc';

    for (let i = 0; i < this.maxTrailLength; i++) {
      const dot = new Konva.Circle({
        x: this.currentX,
        y: this.currentY,
        radius: Math.max(2, this.radius * 0.25 * (1 - i / this.maxTrailLength)),
        fill: targetColor,
        opacity: 0,
        listening: false,
      });
      this.trailLayer.add(dot);
      this.trailDots.push(dot);
    }

    // Build Target Group
    this.targetGroup = new Konva.Group({
      x: this.currentX,
      y: this.currentY,
      name: 'manual-target-group',
    });

    const targetGlow = this.globalConfig ? this.globalConfig.get('targetGlow') : true;
    const glowBlur = this.globalConfig ? this.globalConfig.get('glowBlur') : 14;

    // 1. Outer target ring / circle
    this.targetCircle = new Konva.Circle({
      x: 0,
      y: 0,
      radius: this.radius,
      fill: targetColor,
      opacity: 0.88,
      shadowColor: targetColor,
      shadowBlur: targetGlow ? glowBlur : 0,
      shadowOpacity: 0.9,
      stroke: '#ffffff',
      strokeWidth: 1.5,
    });

    // 2. Reticle outer concentric ring
    this.reticleRing = new Konva.Circle({
      x: 0,
      y: 0,
      radius: this.radius + 12,
      stroke: targetColor,
      strokeWidth: 1,
      dash: [6, 6],
      opacity: 0.65,
      listening: false,
    });

    // 3. Reticle crosshair lines
    const reticleOffset = this.radius + 18;
    this.reticleHLine = new Konva.Line({
      points: [-reticleOffset, 0, reticleOffset, 0],
      stroke: '#ffffff',
      strokeWidth: 1.2,
      opacity: 0.7,
      listening: false,
    });

    this.reticleVLine = new Konva.Line({
      points: [0, -reticleOffset, 0, reticleOffset],
      stroke: '#ffffff',
      strokeWidth: 1.2,
      opacity: 0.7,
      listening: false,
    });

    // 4. White center core pip
    this.centerPip = new Konva.Circle({
      x: 0,
      y: 0,
      radius: 3.5,
      fill: '#ffffff',
      listening: false,
    });

    this.targetGroup.add(this.reticleRing);
    this.targetGroup.add(this.reticleHLine);
    this.targetGroup.add(this.reticleVLine);
    this.targetGroup.add(this.targetCircle);
    this.targetGroup.add(this.centerPip);

    this.targetLayer.add(this.targetGroup);

    this.updateReticleVisibility();
    this.trailLayer.batchDraw();
    this.targetLayer.batchDraw();
  }

  public setupAnimation(): void {
    // Hide mouse cursor on the canvas for immersive gimbal/camera tracking
    document.body.classList.add('manual-control-active');

    this.bindInputEvents();

    // Setup Konva continuous loop for fluid 60/120fps motion
    this.anim = new Konva.Animation(() => {
      if (this.isPaused) return;

      const { width, height } = this.canvasManager!.getDimensions();
      let movedByKeyboard = false;

      // 1. Process Keyboard Movement
      if (this.inputMode === 'both' || this.inputMode === 'keyboard') {
        let dx = 0;
        let dy = 0;

        if (this.activeKeys.has('ArrowLeft') || this.activeKeys.has('KeyA')) dx -= 1;
        if (this.activeKeys.has('ArrowRight') || this.activeKeys.has('KeyD')) dx += 1;
        if (this.activeKeys.has('ArrowUp') || this.activeKeys.has('KeyW')) dy -= 1;
        if (this.activeKeys.has('ArrowDown') || this.activeKeys.has('KeyS')) dy += 1;

        if (dx !== 0 || dy !== 0) {
          // Normalize diagonal movement
          if (dx !== 0 && dy !== 0) {
            dx *= 0.7071;
            dy *= 0.7071;
          }

          const isShift = this.activeKeys.has('ShiftLeft') || this.activeKeys.has('ShiftRight');
          const effectiveSpeed = this.keySpeed * (isShift ? 2.0 : 1.0) * this.timeScale;

          this.currentX += dx * effectiveSpeed;
          this.currentY += dy * effectiveSpeed;

          // Keep targetMouse in sync so mouse lerp does not yank back
          this.targetMouseX = this.currentX;
          this.targetMouseY = this.currentY;
          movedByKeyboard = true;
        }
      }

      // 2. Process Mouse Movement (if not overridden by keyboard this frame)
      if (!movedByKeyboard && (this.inputMode === 'both' || this.inputMode === 'mouse')) {
        const factor = 1 - Math.min(0.95, Math.max(0, this.mouseSmoothing));
        if (this.mouseSmoothing === 0) {
          this.currentX = this.targetMouseX;
          this.currentY = this.targetMouseY;
        } else {
          this.currentX += (this.targetMouseX - this.currentX) * factor;
          this.currentY += (this.targetMouseY - this.currentY) * factor;
        }
      }

      // 3. Apply Boundary Rules
      if (this.boundaryMode === 'clamp') {
        this.currentX = Math.max(this.radius, Math.min(width - this.radius, this.currentX));
        this.currentY = Math.max(this.radius, Math.min(height - this.radius, this.currentY));
      } else if (this.boundaryMode === 'wrap') {
        if (this.currentX < -this.radius) this.currentX = width + this.radius;
        else if (this.currentX > width + this.radius) this.currentX = -this.radius;

        if (this.currentY < -this.radius) this.currentY = height + this.radius;
        else if (this.currentY > height + this.radius) this.currentY = -this.radius;
      }

      // 4. Update Target Group Position
      this.targetGroup.position({ x: this.currentX, y: this.currentY });

      // 5. Update Trail
      if (this.showTrail) {
        this.updateTrail();
      }
    }, [this.targetLayer, this.trailLayer]);

    this.anim.start();
  }

  private bindInputEvents(): void {
    this.onKeyDownBound = (e: KeyboardEvent) => {
      // Prevent scrolling the page when using arrow keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        if (e.code !== 'Space') e.preventDefault();
      }
      this.activeKeys.add(e.code);

      // Hotkey 'R' to instantly recenter target
      if (e.code === 'KeyR') {
        const { width, height } = this.canvasManager!.getDimensions();
        this.currentX = width / 2;
        this.currentY = height / 2;
        this.targetMouseX = this.currentX;
        this.targetMouseY = this.currentY;
        this.syncPositionToCanvas();
        this.clearTrail();
      }
    };

    this.onKeyUpBound = (e: KeyboardEvent) => {
      this.activeKeys.delete(e.code);
    };

    this.onMouseMoveBound = (e: MouseEvent) => {
      if (this.isPaused) return;
      if (this.inputMode === 'keyboard') return;

      this.targetMouseX = e.clientX;
      this.targetMouseY = e.clientY;
    };

    this.onTouchMoveBound = (e: TouchEvent) => {
      if (this.isPaused) return;
      if (this.inputMode === 'keyboard') return;
      if (e.touches.length > 0) {
        this.targetMouseX = e.touches[0].clientX;
        this.targetMouseY = e.touches[0].clientY;
      }
    };

    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
    window.addEventListener('mousemove', this.onMouseMoveBound);
    window.addEventListener('touchmove', this.onTouchMoveBound, { passive: true });
  }

  private updateTrail(): void {
    // Record current coordinate
    this.trailHistory.unshift({ x: this.currentX, y: this.currentY });
    if (this.trailHistory.length > this.maxTrailLength) {
      this.trailHistory.pop();
    }

    // Position each trail dot along the history line with fading opacity
    for (let i = 0; i < this.trailDots.length; i++) {
      const dot = this.trailDots[i];
      const point = this.trailHistory[i];

      if (point) {
        dot.position({ x: point.x, y: point.y });
        const ratio = 1 - i / this.maxTrailLength;
        dot.opacity(ratio * 0.45);
        dot.visible(true);
      } else {
        dot.visible(false);
      }
    }
  }

  private clearTrail(): void {
    this.trailHistory = [];
    for (const dot of this.trailDots) {
      dot.visible(false);
    }
    if (this.trailLayer) {
      this.trailLayer.batchDraw();
    }
  }

  private syncPositionToCanvas(): void {
    if (this.targetGroup) {
      this.targetGroup.position({ x: this.currentX, y: this.currentY });
      this.targetLayer.batchDraw();
    }
  }

  private updateTargetGeometry(): void {
    if (!this.targetCircle) return;

    this.targetCircle.radius(this.radius);
    this.reticleRing.radius(this.radius + 12);

    const reticleOffset = this.radius + 18;
    this.reticleHLine.points([-reticleOffset, 0, reticleOffset, 0]);
    this.reticleVLine.points([0, -reticleOffset, 0, reticleOffset]);

    for (let i = 0; i < this.trailDots.length; i++) {
      this.trailDots[i].radius(Math.max(2, this.radius * 0.25 * (1 - i / this.maxTrailLength)));
    }

    this.targetLayer.batchDraw();
  }

  private updateReticleVisibility(): void {
    if (!this.reticleRing) return;
    this.reticleRing.visible(this.showReticle);
    this.reticleHLine.visible(this.showReticle);
    this.reticleVLine.visible(this.showReticle);
    this.targetLayer.batchDraw();
  }

  public override onGlobalConfigChange(settings: GlobalSettings): void {
    if (!this.targetCircle) return;

    this.targetCircle.fill(settings.targetColor);
    this.targetCircle.shadowColor(settings.targetColor);
    this.targetCircle.shadowBlur(settings.targetGlow ? settings.glowBlur : 0);
    this.reticleRing.stroke(settings.targetColor);

    for (const dot of this.trailDots) {
      dot.fill(settings.targetColor);
    }

    this.targetLayer.batchDraw();
    this.trailLayer.batchDraw();
  }

  public override setPaused(paused: boolean): void {
    super.setPaused(paused);
    if (this.anim) {
      if (paused) {
        this.anim.stop();
      } else {
        this.anim.start();
      }
    }
  }

  public override onResize(dims: { width: number; height: number }): void {
    if (this.boundaryMode === 'clamp') {
      this.currentX = Math.max(this.radius, Math.min(dims.width - this.radius, this.currentX));
      this.currentY = Math.max(this.radius, Math.min(dims.height - this.radius, this.currentY));
      this.syncPositionToCanvas();
    }
  }

  public override cleanupAnimation(): void {
    // Restore default cursor
    document.body.classList.remove('manual-control-active');

    if (this.anim) {
      this.anim.stop();
      this.anim = null;
    }

    if (this.onKeyDownBound) {
      window.removeEventListener('keydown', this.onKeyDownBound);
      this.onKeyDownBound = null;
    }

    if (this.onKeyUpBound) {
      window.removeEventListener('keyup', this.onKeyUpBound);
      this.onKeyUpBound = null;
    }

    if (this.onMouseMoveBound) {
      window.removeEventListener('mousemove', this.onMouseMoveBound);
      this.onMouseMoveBound = null;
    }

    if (this.onTouchMoveBound) {
      window.removeEventListener('touchmove', this.onTouchMoveBound);
      this.onTouchMoveBound = null;
    }

    this.activeKeys.clear();
    this.clearTrail();
  }
}
