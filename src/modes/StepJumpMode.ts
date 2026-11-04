import Konva from 'konva';
import gsap from 'gsap';
import { BaseMode } from '../core/BaseMode';
import type { ModeControlSpec } from '../core/BaseMode';
import type { GlobalSettings } from '../core/GlobalConfig';
import type { InspectableEntity } from '../core/SceneInspector';

interface Waypoint {
  x: number;
  y: number;
}

export class StepJumpMode extends BaseMode {
  private radius: number = 40;
  private holdDuration: number = 1.8;
  private jumpDuration: number = 0.15;
  private pattern: string = 'quadrant';
  private showMarkers: boolean = true;

  private waypointsLayer!: Konva.Layer;
  private targetLayer!: Konva.Layer;
  private target!: Konva.Circle;
  private waypointMarkers: Konva.Group[] = [];
  private timeline: gsap.core.Timeline | null = null;

  constructor() {
    super({
      id: 'step-jump',
      name: 'Step Response & Saccade Jump',
      description: 'Instantaneous position hops to test camera response time, latency, and overshoot.',
    });
  }

  public getControls(): ModeControlSpec[] {
    return [
      {
        id: 'pattern',
        label: 'Jump Pattern',
        type: 'select',
        options: {
          '4 Quadrants + Center': 'quadrant',
          'Horizontal Snap (Edge-to-Edge)': 'horizontal-snap',
          'Diagonal Cross (X-Pattern)': 'diagonal-cross',
        },
        value: this.pattern,
        onChange: (val: string) => {
          this.pattern = val;
          this.rebuildWaypoints();
          this.setupAnimation();
        },
      },
      {
        id: 'holdDuration',
        label: 'Dwell Time (Hold)',
        type: 'range',
        min: 0.2,
        max: 5.0,
        step: 0.1,
        value: this.holdDuration,
        onChange: (val: number) => {
          this.holdDuration = val;
          this.setupAnimation();
        },
      },
      {
        id: 'jumpDuration',
        label: 'Transition (0 = Teleport)',
        type: 'range',
        min: 0.0,
        max: 1.0,
        step: 0.05,
        value: this.jumpDuration,
        onChange: (val: number) => {
          this.jumpDuration = val;
          this.setupAnimation();
        },
      },
      {
        id: 'targetRadius',
        label: 'Target Size',
        type: 'range',
        min: 15,
        max: 80,
        step: 5,
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
        id: 'showMarkers',
        label: 'Show Markers',
        type: 'checkbox',
        value: this.showMarkers,
        onChange: (val: boolean) => {
          this.showMarkers = val;
          if (this.waypointsLayer) {
            this.waypointsLayer.visible(val);
            this.waypointsLayer.batchDraw();
          }
        },
      },
    ];
  }

  public override getSceneEntities(): InspectableEntity[] {
    const targetColor = this.globalConfig ? this.globalConfig.get('targetColor') : '#007acc';

    return [
      {
        id: 'saccade-target',
        name: 'Target (Saccade Jumper)',
        category: 'target',
        colorTag: targetColor,
        position: this.target ? { x: Math.round(this.target.x()), y: Math.round(this.target.y()) } : undefined,
        properties: [
          {
            id: 'saccade-radius',
            label: 'Target Radius',
            type: 'slider',
            min: 10,
            max: 100,
            step: 5,
            value: this.radius,
            onChange: (val) => {
              this.radius = val;
              if (this.target) {
                this.target.radius(val);
                this.targetLayer.batchDraw();
              }
            },
          },
          {
            id: 'saccade-hold',
            label: 'Dwell Time (Hold sec)',
            type: 'slider',
            min: 0.2,
            max: 5.0,
            step: 0.1,
            value: this.holdDuration,
            onChange: (val) => {
              this.holdDuration = val;
              this.setupAnimation();
            },
          },
          {
            id: 'saccade-jump-speed',
            label: 'Jump Transition Speed',
            type: 'slider',
            min: 0.0,
            max: 1.0,
            step: 0.05,
            value: this.jumpDuration,
            onChange: (val) => {
              this.jumpDuration = val;
              this.setupAnimation();
            },
          },
          {
            id: 'saccade-color',
            label: 'Color',
            type: 'color',
            value: targetColor,
            onChange: (val) => {
              if (this.globalConfig) this.globalConfig.set('targetColor', val);
            },
          },
        ],
      },
      {
        id: 'waypoint-markers',
        name: 'Waypoint Reticles',
        category: 'environment',
        colorTag: '#555560',
        properties: [
          {
            id: 'waypoints-visible',
            label: 'Show Marker Rings',
            type: 'boolean',
            value: this.showMarkers,
            onChange: (val) => {
              this.showMarkers = val;
              if (this.waypointsLayer) {
                this.waypointsLayer.visible(val);
                this.waypointsLayer.batchDraw();
              }
            },
          },
        ],
      },
    ];
  }

  public getWaypoints(): Waypoint[] {
    const { width, height } = this.canvasManager!.getDimensions();
    const padX = Math.max(90, width * 0.15);
    const padY = Math.max(90, height * 0.18);

    if (this.pattern === 'horizontal-snap') {
      return [
        { x: padX, y: height / 2 },
        { x: width - padX, y: height / 2 },
      ];
    } else if (this.pattern === 'diagonal-cross') {
      return [
        { x: padX, y: padY },
        { x: width - padX, y: height - padY },
        { x: width - padX, y: padY },
        { x: padX, y: height - padY },
        { x: width / 2, y: height / 2 },
      ];
    }

    return [
      { x: padX, y: padY },
      { x: width - padX, y: padY },
      { x: width - padX, y: height - padY },
      { x: padX, y: height - padY },
      { x: width / 2, y: height / 2 },
    ];
  }

  public setupElements(): void {
    this.waypointsLayer = this.canvasManager!.getLayer('waypoints-layer');
    this.targetLayer = this.canvasManager!.getLayer('target-layer');

    const targetColor = this.globalConfig ? this.globalConfig.get('targetColor') : '#007acc';
    const targetGlow = this.globalConfig ? this.globalConfig.get('targetGlow') : true;

    this.rebuildWaypoints();

    const waypoints = this.getWaypoints();
    this.target = new Konva.Circle({
      x: waypoints[0].x,
      y: waypoints[0].y,
      radius: this.radius,
      fill: targetColor,
      shadowColor: targetColor,
      shadowBlur: targetGlow ? 16 : 0,
      shadowOpacity: 0.85,
    });
    this.targetLayer.add(this.target);

    this.targetLayer.batchDraw();
  }

  public rebuildWaypoints(): void {
    this.waypointsLayer.destroyChildren();
    const waypoints = this.getWaypoints();

    this.waypointMarkers = waypoints.map((pt, index) => {
      const group = new Konva.Group();
      const circle = new Konva.Circle({
        x: pt.x,
        y: pt.y,
        radius: 14,
        stroke: '#2c2c34',
        strokeWidth: 2,
        dash: [4, 4],
      });
      const text = new Konva.Text({
        x: pt.x - 4,
        y: pt.y - 5,
        text: `${index + 1}`,
        fontSize: 10,
        fill: '#555560',
        fontFamily: 'monospace',
      });
      group.add(circle);
      group.add(text);
      this.waypointsLayer.add(group);
      return group;
    });

    this.waypointsLayer.visible(this.showMarkers);
    this.waypointsLayer.batchDraw();
  }

  public setupAnimation(): void {
    if (this.timeline) {
      this.timeline.kill();
    }

    const waypoints = this.getWaypoints();
    this.timeline = gsap.timeline({ repeat: -1 });

    waypoints.forEach((pt) => {
      this.timeline!.to(this.target, {
        x: pt.x,
        y: pt.y,
        duration: this.jumpDuration,
        ease: this.jumpDuration === 0 ? 'none' : 'power2.inOut',
        onUpdate: () => {
          this.targetLayer.batchDraw();
        },
      });

      this.timeline!.to({}, { duration: this.holdDuration });
    });

    this.timeline.timeScale(this.timeScale);
    if (this.isPaused) {
      this.timeline.pause();
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
    if (!this.timeline) return;
    if (paused) this.timeline.pause();
    else this.timeline.play();
  }

  public override setTimeScale(scale: number): void {
    super.setTimeScale(scale);
    if (this.timeline) this.timeline.timeScale(scale);
  }

  public override onResize(): void {
    this.rebuildWaypoints();
    this.setupAnimation();
  }

  public override cleanupAnimation(): void {
    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }
  }
}
