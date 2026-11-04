import Konva from 'konva';
import gsap from 'gsap';
import { BaseMode } from '../core/BaseMode.js';

export class StepJumpMode extends BaseMode {
  constructor() {
    super({
      id: 'step-jump',
      name: 'Step Response & Saccade Jump',
      description: 'Instantaneous position hops to test camera response time, latency, and overshoot.',
    });

    this.radius = 40;
    this.holdDuration = 1.8;
    this.jumpDuration = 0.15; // 0 = teleport / instant saccade
    this.pattern = 'quadrant'; // 'quadrant' | 'horizontal-snap' | 'diagonal-cross' | 'random'
    this.showMarkers = true;
    this.timeline = null;
  }

  getControls() {
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
        onChange: (val) => {
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
        onChange: (val) => {
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
        onChange: (val) => {
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
        onChange: (val) => {
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
        onChange: (val) => {
          this.showMarkers = val;
          if (this.waypointsLayer) {
            this.waypointsLayer.visible(val);
            this.waypointsLayer.batchDraw();
          }
        },
      },
    ];
  }

  getWaypoints() {
    const { width, height } = this.canvasManager.getDimensions();
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

    // Default 'quadrant'
    return [
      { x: padX, y: padY },
      { x: width - padX, y: padY },
      { x: width - padX, y: height - padY },
      { x: padX, y: height - padY },
      { x: width / 2, y: height / 2 },
    ];
  }

  setupElements() {
    this.waypointsLayer = this.canvasManager.getLayer('waypoints-layer');
    this.targetLayer = this.canvasManager.getLayer('target-layer');

    const targetColor = this.globalConfig ? this.globalConfig.get('targetColor') : '#00ff66';
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

  rebuildWaypoints() {
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

  setupAnimation() {
    if (this.timeline) {
      this.timeline.kill();
    }

    const waypoints = this.getWaypoints();
    this.timeline = gsap.timeline({ repeat: -1 });

    waypoints.forEach((pt) => {
      this.timeline.to(this.target, {
        x: pt.x,
        y: pt.y,
        duration: this.jumpDuration,
        ease: this.jumpDuration === 0 ? 'none' : 'power2.inOut',
        onUpdate: () => {
          this.targetLayer.batchDraw();
        },
      });

      this.timeline.to({}, { duration: this.holdDuration });
    });

    this.timeline.timeScale(this.timeScale);
    if (this.isPaused) {
      this.timeline.pause();
    }
  }

  onGlobalConfigChange(settings) {
    if (this.target) {
      this.target.fill(settings.targetColor);
      this.target.shadowColor(settings.targetColor);
      this.target.shadowBlur(settings.targetGlow ? settings.glowBlur : 0);
      this.targetLayer.batchDraw();
    }
  }

  setPaused(paused) {
    super.setPaused(paused);
    if (!this.timeline) return;
    if (paused) this.timeline.pause();
    else this.timeline.play();
  }

  setTimeScale(scale) {
    super.setTimeScale(scale);
    if (this.timeline) this.timeline.timeScale(scale);
  }

  onResize() {
    this.rebuildWaypoints();
    this.setupAnimation();
  }

  cleanupAnimation() {
    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }
  }
}
