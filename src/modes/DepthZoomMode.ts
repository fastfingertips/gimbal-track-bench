import Konva from 'konva';
import gsap from 'gsap';
import { BaseMode } from '../core/BaseMode';
import type { ModeControlSpec } from '../core/BaseMode';
import type { GlobalSettings } from '../core/GlobalConfig';

export class DepthZoomMode extends BaseMode {
  private minRadius: number = 15;
  private maxRadius: number = 110;
  private zoomCycleDuration: number = 4.0;
  private movementPath: string = 'drift';

  private targetLayer!: Konva.Layer;
  private target!: Konva.Circle;
  private zoomTween: gsap.core.Tween | null = null;
  private posTween: gsap.core.Tween | null = null;

  constructor() {
    super({
      id: 'depth-zoom',
      name: 'Depth & Auto-Zoom (Scale Framing)',
      description: 'Tests camera auto-zoom and auto-framing by simulating perspective depth changes.',
    });
  }

  public getControls(): ModeControlSpec[] {
    return [
      {
        id: 'movementPath',
        label: 'Motion Profile',
        type: 'select',
        options: {
          'Drifting Walk (Approach)': 'drift',
          'Stationary Pulse (Zoom only)': 'center-pulse',
          'Elliptical Perspective Run': 'elliptical-approach',
        },
        value: this.movementPath,
        onChange: (val: string) => {
          this.movementPath = val;
          this.setupAnimation();
        },
      },
      {
        id: 'maxRadius',
        label: 'Close-Up Size (Max)',
        type: 'range',
        min: 60,
        max: 180,
        step: 5,
        value: this.maxRadius,
        onChange: (val: number) => {
          this.maxRadius = val;
          this.setupAnimation();
        },
      },
      {
        id: 'minRadius',
        label: 'Distance Size (Min)',
        type: 'range',
        min: 10,
        max: 40,
        step: 2,
        value: this.minRadius,
        onChange: (val: number) => {
          this.minRadius = val;
          this.setupAnimation();
        },
      },
    ];
  }

  public setupElements(): void {
    this.targetLayer = this.canvasManager!.getLayer('target-layer');
    const { width, height } = this.canvasManager!.getDimensions();

    const targetColor = this.globalConfig ? this.globalConfig.get('targetColor') : '#007acc';
    const targetGlow = this.globalConfig ? this.globalConfig.get('targetGlow') : true;

    this.target = new Konva.Circle({
      x: width / 2,
      y: height / 2,
      radius: this.minRadius,
      fill: targetColor,
      shadowColor: targetColor,
      shadowBlur: targetGlow ? 14 : 0,
      shadowOpacity: 0.8,
    });
    this.targetLayer.add(this.target);

    this.targetLayer.batchDraw();
  }

  public setupAnimation(): void {
    const { width, height } = this.canvasManager!.getDimensions();

    if (this.zoomTween) this.zoomTween.kill();
    if (this.posTween) this.posTween.kill();

    this.target.radius(this.minRadius);
    this.zoomTween = gsap.to(this.target, {
      radius: this.maxRadius,
      duration: this.zoomCycleDuration,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
      onUpdate: () => {
        this.targetLayer.batchDraw();
      },
    });

    if (this.movementPath === 'center-pulse') {
      this.target.position({ x: width / 2, y: height / 2 });
    } else if (this.movementPath === 'drift') {
      const padX = width * 0.2;
      this.target.position({ x: padX, y: height / 2 });
      this.posTween = gsap.to(this.target, {
        x: width - padX,
        duration: this.zoomCycleDuration * 1.6,
        ease: 'power1.inOut',
        repeat: -1,
        yoyo: true,
      });
    } else if (this.movementPath === 'elliptical-approach') {
      const orbitState = { angle: 0 };
      const rx = width * 0.35;
      const ry = height * 0.28;
      this.posTween = gsap.to(orbitState, {
        angle: Math.PI * 2,
        duration: this.zoomCycleDuration * 1.5,
        ease: 'none',
        repeat: -1,
        onUpdate: () => {
          this.target.position({
            x: width / 2 + Math.cos(orbitState.angle) * rx,
            y: height / 2 + Math.sin(orbitState.angle) * ry,
          });
        },
      });
    }

    this.setTimeScale(this.timeScale);
    if (this.isPaused) {
      this.setPaused(true);
    }
  }

  public override onGlobalConfigChange(settings: GlobalSettings): void {
    if (this.target) {
      this.target.fill(settings.targetColor);
      this.target.shadowColor(settings.targetColor);
      this.target.shadowBlur(settings.targetGlow ? settings.glowBlur : 0);
      this.targetLayer.batchDraw();
    }
  }

  public override setPaused(paused: boolean): void {
    super.setPaused(paused);
    if (this.zoomTween) paused ? this.zoomTween.pause() : this.zoomTween.play();
    if (this.posTween) paused ? this.posTween.pause() : this.posTween.play();
  }

  public override setTimeScale(scale: number): void {
    super.setTimeScale(scale);
    if (this.zoomTween) this.zoomTween.timeScale(scale);
    if (this.posTween) this.posTween.timeScale(scale);
  }

  public override onResize(): void {
    this.setupAnimation();
  }

  public override cleanupAnimation(): void {
    if (this.zoomTween) {
      this.zoomTween.kill();
      this.zoomTween = null;
    }
    if (this.posTween) {
      this.posTween.kill();
      this.posTween = null;
    }
  }
}

