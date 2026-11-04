import Konva from 'konva';
import gsap from 'gsap';
import { BaseMode } from '../core/BaseMode';
import type { ModeControlSpec } from '../core/BaseMode';
import type { GlobalSettings } from '../core/GlobalConfig';

export class CircularTrackingMode extends BaseMode {
  private radius: number = 35;
  private orbitRadiusRatio: number = 0.35;
  private orbitEccentricity: number = 1.0;
  private direction: number = 1;
  private showTrail: boolean = true;
  private baseDuration: number = 5;
  private orbitAngle: { angle: number } = { angle: 0 };

  private guideLayer!: Konva.Layer;
  private targetLayer!: Konva.Layer;
  private guideEllipse!: Konva.Ellipse;
  private target!: Konva.Circle;
  private tween: gsap.core.Tween | null = null;

  constructor() {
    super({
      id: 'circular-tracking',
      name: 'Circular Orbit (Pan/Tilt Speed)',
      description: 'Continuous circular tracking to evaluate angular acceleration and gimbal smoothness.',
    });
  }

  public getControls(): ModeControlSpec[] {
    return [
      {
        id: 'orbitRadius',
        label: 'Orbit Radius',
        type: 'range',
        min: 10,
        max: 48,
        step: 1,
        value: Math.round(this.orbitRadiusRatio * 100),
        onChange: (val: number) => {
          this.orbitRadiusRatio = val / 100;
          this.updateOrbitGuide();
        },
      },
      {
        id: 'eccentricity',
        label: 'Aspect (X:Y)',
        type: 'range',
        min: 0.4,
        max: 2.2,
        step: 0.1,
        value: this.orbitEccentricity,
        onChange: (val: number) => {
          this.orbitEccentricity = val;
          this.updateOrbitGuide();
        },
      },
      {
        id: 'direction',
        label: 'Direction',
        type: 'select',
        options: { 'Clockwise (CW)': 1, 'Counter-Clockwise (CCW)': -1 },
        value: this.direction,
        onChange: (val: string | number) => {
          this.direction = parseInt(String(val), 10);
          this.setupAnimation();
        },
      },
      {
        id: 'targetSize',
        label: 'Target Size',
        type: 'range',
        min: 10,
        max: 80,
        step: 2,
        value: this.radius,
        onChange: (val: number) => {
          this.radius = val;
          if (this.target) {
            this.target.radius(this.radius);
            this.targetLayer.batchDraw();
          }
        },
      },
      {
        id: 'showGuide',
        label: 'Show Path Guide',
        type: 'checkbox',
        value: this.showTrail,
        onChange: (val: boolean) => {
          this.showTrail = val;
          if (this.guideEllipse) {
            this.guideEllipse.visible(val);
            this.guideLayer.batchDraw();
          }
        },
      },
    ];
  }

  public setupElements(): void {
    const { width, height } = this.canvasManager!.getDimensions();
    const centerX = width / 2;
    const centerY = height / 2;
    const minDim = Math.min(width, height);
    const radiusY = minDim * this.orbitRadiusRatio;
    const radiusX = radiusY * this.orbitEccentricity;

    this.guideLayer = this.canvasManager!.getLayer('guide-layer');
    this.targetLayer = this.canvasManager!.getLayer('target-layer');

    const targetColor = this.globalConfig ? this.globalConfig.get('targetColor') : '#007acc';
    const targetGlow = this.globalConfig ? this.globalConfig.get('targetGlow') : true;

    this.guideEllipse = new Konva.Ellipse({
      x: centerX,
      y: centerY,
      radiusX,
      radiusY,
      stroke: '#333338',
      strokeWidth: 2,
      dash: [6, 6],
      visible: this.showTrail,
    });
    this.guideLayer.add(this.guideEllipse);

    this.target = new Konva.Circle({
      x: centerX + radiusX,
      y: centerY,
      radius: this.radius,
      fill: targetColor,
      shadowColor: targetColor,
      shadowBlur: targetGlow ? 16 : 0,
      shadowOpacity: 0.85,
    });
    this.targetLayer.add(this.target);

    this.guideLayer.batchDraw();
    this.targetLayer.batchDraw();
  }

  public updateOrbitGuide(): void {
    const { width, height } = this.canvasManager!.getDimensions();
    const centerX = width / 2;
    const centerY = height / 2;
    const minDim = Math.min(width, height);
    const radiusY = minDim * this.orbitRadiusRatio;
    const radiusX = radiusY * this.orbitEccentricity;

    if (this.guideEllipse) {
      this.guideEllipse.position({ x: centerX, y: centerY });
      this.guideEllipse.radiusX(radiusX);
      this.guideEllipse.radiusY(radiusY);
      this.guideLayer.batchDraw();
    }
  }

  public setupAnimation(): void {
    if (this.tween) {
      this.tween.kill();
    }

    this.orbitAngle.angle = 0;

    this.tween = gsap.to(this.orbitAngle, {
      angle: Math.PI * 2 * this.direction,
      duration: this.baseDuration,
      ease: 'none',
      repeat: -1,
      onUpdate: () => {
        const { width, height } = this.canvasManager!.getDimensions();
        const centerX = width / 2;
        const centerY = height / 2;
        const minDim = Math.min(width, height);
        const radiusY = minDim * this.orbitRadiusRatio;
        const radiusX = radiusY * this.orbitEccentricity;

        const x = centerX + Math.cos(this.orbitAngle.angle) * radiusX;
        const y = centerY + Math.sin(this.orbitAngle.angle) * radiusY;

        this.target.position({ x, y });
        this.targetLayer.batchDraw();
      },
    });

    this.tween.timeScale(this.timeScale);
    if (this.isPaused) {
      this.tween.pause();
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
    if (!this.tween) return;
    if (paused) this.tween.pause();
    else this.tween.play();
  }

  public override setTimeScale(scale: number): void {
    super.setTimeScale(scale);
    if (this.tween) this.tween.timeScale(scale);
  }

  public override onResize(): void {
    this.updateOrbitGuide();
  }

  public override cleanupAnimation(): void {
    if (this.tween) {
      this.tween.kill();
      this.tween = null;
    }
  }
}
