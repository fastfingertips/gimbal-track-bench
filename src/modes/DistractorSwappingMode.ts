import Konva from 'konva';
import gsap from 'gsap';
import { BaseMode } from '../core/BaseMode';
import type { ModeControlSpec } from '../core/BaseMode';
import type { GlobalSettings } from '../core/GlobalConfig';
import type { InspectableEntity } from '../core/SceneInspector';

export class DistractorSwappingMode extends BaseMode {
  private primaryRadius: number = 36;
  private distractorRadius: number = 36;
  private distractorColor: string = '#e06c75';
  private crossingPattern: string = 'x-cross';
  private duration: number = 4.0;

  private primaryLayer!: Konva.Layer;
  private distractorLayer!: Konva.Layer;
  private primaryGroup!: Konva.Group;
  private primaryCircle!: Konva.Circle;
  private primaryText!: Konva.Text;
  private distractorGroup!: Konva.Group;
  private distractorCircle!: Konva.Circle;
  private distractorText!: Konva.Text;

  private primaryTween: gsap.core.Tween | null = null;
  private distractorTween: gsap.core.Tween | null = null;

  constructor() {
    super({
      id: 'distractor-swapping',
      name: 'Crossing Paths (Target Swap Test)',
      description: 'Simulates secondary moving objects crossing the primary target to test AI identity lock.',
    });
  }

  public getControls(): ModeControlSpec[] {
    return [
      {
        id: 'crossingPattern',
        label: 'Crossing Pattern',
        type: 'select',
        options: {
          'Diagonal X-Cross': 'x-cross',
          'Head-On Collision Pass': 'head-on',
          'Orbit & Intersect': 'orbit-chase',
        },
        value: this.crossingPattern,
        onChange: (val: string) => {
          this.crossingPattern = val;
          this.setupAnimation();
        },
      },
      {
        id: 'distractorRadius',
        label: 'Distractor Size',
        type: 'range',
        min: 15,
        max: 80,
        step: 2,
        value: this.distractorRadius,
        onChange: (val: number) => {
          this.distractorRadius = val;
          if (this.distractorCircle) {
            this.distractorCircle.radius(this.distractorRadius);
            this.distractorLayer.batchDraw();
          }
        },
      },
      {
        id: 'distractorColor',
        label: 'Distractor Color',
        type: 'select',
        options: {
          'Matte Red (#e06c75)': '#e06c75',
          'Matte Yellow (#e5c07b)': '#e5c07b',
          'Same as Target': 'SAME',
        },
        value: this.distractorColor,
        onChange: (val: string) => {
          this.distractorColor = val;
          this.updateDistractorColor();
        },
      },
    ];
  }

  public override getSceneEntities(): InspectableEntity[] {
    const primaryColor = this.globalConfig ? this.globalConfig.get('targetColor') : '#007acc';
    const actualDistractorColor = this.distractorColor === 'SAME' ? primaryColor : this.distractorColor;

    return [
      {
        id: 'target-a',
        name: 'Target A (Primary Subject)',
        category: 'target',
        colorTag: primaryColor,
        position: this.primaryGroup ? { x: Math.round(this.primaryGroup.x()), y: Math.round(this.primaryGroup.y()) } : undefined,
        properties: [
          {
            id: 'target-a-x',
            label: 'Position X',
            type: 'slider',
            min: 50,
            max: this.canvasManager ? this.canvasManager.getDimensions().width - 50 : 1920,
            step: 5,
            value: this.primaryGroup ? Math.round(this.primaryGroup.x()) : 0,
            onChange: (val) => {
              if (this.primaryGroup) {
                this.primaryGroup.x(val);
                this.primaryLayer.batchDraw();
              }
            },
          },
          {
            id: 'target-a-y',
            label: 'Position Y',
            type: 'slider',
            min: 50,
            max: this.canvasManager ? this.canvasManager.getDimensions().height - 50 : 1080,
            step: 5,
            value: this.primaryGroup ? Math.round(this.primaryGroup.y()) : 0,
            onChange: (val) => {
              if (this.primaryGroup) {
                this.primaryGroup.y(val);
                this.primaryLayer.batchDraw();
              }
            },
          },
          {
            id: 'target-a-radius',
            label: 'Radius',
            type: 'slider',
            min: 15,
            max: 100,
            step: 2,
            value: this.primaryRadius,
            onChange: (val) => {
              this.primaryRadius = val;
              if (this.primaryCircle) {
                this.primaryCircle.radius(val);
                this.primaryLayer.batchDraw();
              }
            },
          },
          {
            id: 'target-a-color',
            label: 'Color',
            type: 'color',
            value: primaryColor,
            onChange: (val) => {
              if (this.globalConfig) this.globalConfig.set('targetColor', val);
            },
          },
        ],
      },
      {
        id: 'distractor-b',
        name: 'Target B (Distractor Imposter)',
        category: 'target',
        colorTag: actualDistractorColor,
        position: this.distractorGroup ? { x: Math.round(this.distractorGroup.x()), y: Math.round(this.distractorGroup.y()) } : undefined,
        properties: [
          {
            id: 'distractor-b-x',
            label: 'Position X',
            type: 'slider',
            min: 50,
            max: this.canvasManager ? this.canvasManager.getDimensions().width - 50 : 1920,
            step: 5,
            value: this.distractorGroup ? Math.round(this.distractorGroup.x()) : 0,
            onChange: (val) => {
              if (this.distractorGroup) {
                this.distractorGroup.x(val);
                this.distractorLayer.batchDraw();
              }
            },
          },
          {
            id: 'distractor-b-y',
            label: 'Position Y',
            type: 'slider',
            min: 50,
            max: this.canvasManager ? this.canvasManager.getDimensions().height - 50 : 1080,
            step: 5,
            value: this.distractorGroup ? Math.round(this.distractorGroup.y()) : 0,
            onChange: (val) => {
              if (this.distractorGroup) {
                this.distractorGroup.y(val);
                this.distractorLayer.batchDraw();
              }
            },
          },
          {
            id: 'distractor-b-radius',
            label: 'Radius',
            type: 'slider',
            min: 15,
            max: 100,
            step: 2,
            value: this.distractorRadius,
            onChange: (val) => {
              this.distractorRadius = val;
              if (this.distractorCircle) {
                this.distractorCircle.radius(val);
                this.distractorLayer.batchDraw();
              }
            },
          },
          {
            id: 'distractor-b-color',
            label: 'Color',
            type: 'color',
            value: actualDistractorColor,
            onChange: (val) => {
              this.distractorColor = val;
              this.updateDistractorColor();
            },
          },
        ],
      },
    ];
  }

  public setupElements(): void {
    this.primaryLayer = this.canvasManager!.getLayer('primary-target-layer');
    this.distractorLayer = this.canvasManager!.getLayer('distractor-layer');

    const primaryColor = this.globalConfig ? this.globalConfig.get('targetColor') : '#007acc';
    const primaryGlow = this.globalConfig ? this.globalConfig.get('targetGlow') : true;

    this.primaryGroup = new Konva.Group();
    this.primaryCircle = new Konva.Circle({
      radius: this.primaryRadius,
      fill: primaryColor,
      shadowColor: primaryColor,
      shadowBlur: primaryGlow ? 14 : 0,
      shadowOpacity: 0.8,
    });
    this.primaryText = new Konva.Text({
      text: 'A',
      fontSize: 14,
      fontFamily: 'Consolas, monospace',
      fontStyle: 'bold',
      fill: '#ffffff',
      offsetX: 4,
      offsetY: 6,
    });
    this.primaryGroup.add(this.primaryCircle);
    this.primaryGroup.add(this.primaryText);
    this.primaryLayer.add(this.primaryGroup);

    this.distractorGroup = new Konva.Group();
    const actualDistractorColor = this.distractorColor === 'SAME' ? primaryColor : this.distractorColor;
    this.distractorCircle = new Konva.Circle({
      radius: this.distractorRadius,
      fill: actualDistractorColor,
      shadowColor: actualDistractorColor,
      shadowBlur: primaryGlow ? 14 : 0,
      shadowOpacity: 0.8,
    });
    this.distractorText = new Konva.Text({
      text: 'B',
      fontSize: 14,
      fontFamily: 'Consolas, monospace',
      fontStyle: 'bold',
      fill: '#ffffff',
      offsetX: 4,
      offsetY: 6,
    });
    this.distractorGroup.add(this.distractorCircle);
    this.distractorGroup.add(this.distractorText);
    this.distractorLayer.add(this.distractorGroup);

    this.primaryLayer.batchDraw();
    this.distractorLayer.batchDraw();
  }

  public updateDistractorColor(): void {
    if (!this.distractorCircle) return;
    const primaryColor = this.globalConfig ? this.globalConfig.get('targetColor') : '#007acc';
    const color = this.distractorColor === 'SAME' ? primaryColor : this.distractorColor;
    this.distractorCircle.fill(color);
    this.distractorCircle.shadowColor(color);
    this.distractorLayer.batchDraw();
  }

  public setupAnimation(): void {
    const { width, height } = this.canvasManager!.getDimensions();
    const padX = 80;
    const padY = 80;

    if (this.primaryTween) this.primaryTween.kill();
    if (this.distractorTween) this.distractorTween.kill();

    if (this.crossingPattern === 'x-cross') {
      this.primaryGroup.position({ x: padX, y: padY });
      this.primaryTween = gsap.to(this.primaryGroup, {
        x: width - padX,
        y: height - padY,
        duration: this.duration,
        ease: 'power1.inOut',
        repeat: -1,
        yoyo: true,
        onUpdate: () => this.primaryLayer.batchDraw(),
      });

      this.distractorGroup.position({ x: padX, y: height - padY });
      this.distractorTween = gsap.to(this.distractorGroup, {
        x: width - padX,
        y: padY,
        duration: this.duration,
        ease: 'power1.inOut',
        repeat: -1,
        yoyo: true,
        onUpdate: () => this.distractorLayer.batchDraw(),
      });
    } else if (this.crossingPattern === 'head-on') {
      const centerY = height / 2;
      this.primaryGroup.position({ x: padX, y: centerY });
      this.primaryTween = gsap.to(this.primaryGroup, {
        x: width - padX,
        duration: this.duration,
        ease: 'none',
        repeat: -1,
        yoyo: true,
        onUpdate: () => this.primaryLayer.batchDraw(),
      });

      this.distractorGroup.position({ x: width - padX, y: centerY });
      this.distractorTween = gsap.to(this.distractorGroup, {
        x: padX,
        duration: this.duration,
        ease: 'none',
        repeat: -1,
        yoyo: true,
        onUpdate: () => this.distractorLayer.batchDraw(),
      });
    } else if (this.crossingPattern === 'orbit-chase') {
      this.primaryGroup.position({ x: padX, y: height / 2 });
      this.primaryTween = gsap.to(this.primaryGroup, {
        x: width - padX,
        duration: this.duration * 1.5,
        ease: 'none',
        repeat: -1,
        yoyo: true,
        onUpdate: () => this.primaryLayer.batchDraw(),
      });

      const orbitState = { angle: 0 };
      const orbitR = Math.min(width, height) * 0.32;
      this.distractorTween = gsap.to(orbitState, {
        angle: Math.PI * 2,
        duration: this.duration,
        ease: 'none',
        repeat: -1,
        onUpdate: () => {
          this.distractorGroup.position({
            x: width / 2 + Math.cos(orbitState.angle) * orbitR,
            y: height / 2 + Math.sin(orbitState.angle) * orbitR,
          });
          this.distractorLayer.batchDraw();
        },
      });
    }

    this.setTimeScale(this.timeScale);
    if (this.isPaused) {
      this.setPaused(true);
    }
  }

  public override onGlobalConfigChange(settings: GlobalSettings): void {
    if (this.primaryCircle) {
      this.primaryCircle.fill(settings.targetColor);
      this.primaryCircle.shadowColor(settings.targetColor);
      this.primaryCircle.shadowBlur(settings.targetGlow ? settings.glowBlur : 0);
      this.primaryLayer.batchDraw();
    }
    this.updateDistractorColor();
  }

  public override setPaused(paused: boolean): void {
    super.setPaused(paused);
    if (this.primaryTween) paused ? this.primaryTween.pause() : this.primaryTween.play();
    if (this.distractorTween) paused ? this.distractorTween.pause() : this.distractorTween.play();
  }

  public override setTimeScale(scale: number): void {
    super.setTimeScale(scale);
    if (this.primaryTween) this.primaryTween.timeScale(scale);
    if (this.distractorTween) this.distractorTween.timeScale(scale);
  }

  public override onResize(): void {
    this.setupAnimation();
  }

  public override cleanupAnimation(): void {
    if (this.primaryTween) {
      this.primaryTween.kill();
      this.primaryTween = null;
    }
    if (this.distractorTween) {
      this.distractorTween.kill();
      this.distractorTween = null;
    }
  }
}
