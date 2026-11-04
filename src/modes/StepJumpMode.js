import Konva from 'konva';
import gsap from 'gsap';
import { BaseMode } from '../core/BaseMode.js';

/**
 * StepJumpMode
 * Tests PTZ step response, settle time, and overshoot by performing
 * sudden instantaneous hops or rapid jumps across quadrants.
 */
export class StepJumpMode extends BaseMode {
  constructor() {
    super({
      id: 'step-jump',
      name: 'Step Response & Saccade Jump',
      description: 'Instantaneous position hops to test camera response time, latency, and overshoot.',
    });

    this.radius = 40;
    this.holdDuration = 2; // Settle time at each position (seconds)
    this.jumpDuration = 0.2; // Transition time (seconds, small for step response)
    this.currentIndex = 0;
    this.timeline = null;
  }

  getControls() {
    return [
      {
        id: 'hold-time',
        label: 'Dwell Time',
        type: 'range',
        min: 0.5,
        max: 5.0,
        step: 0.5,
        value: this.holdDuration,
        unit: 's',
        onChange: (val) => {
          this.holdDuration = parseFloat(val);
          this.setupAnimation();
        },
      },
      {
        id: 'jump-speed',
        label: 'Jump Duration',
        type: 'range',
        min: 0.0,
        max: 0.8,
        step: 0.05,
        value: this.jumpDuration,
        unit: 's',
        onChange: (val) => {
          this.jumpDuration = parseFloat(val);
          this.setupAnimation();
        },
      },
    ];
  }

  getWaypoints() {
    const { width, height } = this.canvasManager.getDimensions();
    const paddingX = Math.max(80, width * 0.15);
    const paddingY = Math.max(80, height * 0.18);

    return [
      { x: paddingX, y: paddingY }, // Top-Left
      { x: width - paddingX, y: paddingY }, // Top-Right
      { x: width - paddingX, y: height - paddingY }, // Bottom-Right
      { x: paddingX, y: height - paddingY }, // Bottom-Left
      { x: width / 2, y: height / 2 }, // Center
    ];
  }

  setupElements() {
    this.waypointsLayer = this.canvasManager.getLayer('waypoints-layer');
    this.targetLayer = this.canvasManager.getLayer('target-layer');

    const waypoints = this.getWaypoints();

    // Render faint target markers
    this.waypointMarkers = waypoints.map((pt) => {
      const marker = new Konva.Circle({
        x: pt.x,
        y: pt.y,
        radius: 12,
        stroke: '#2c2c2e',
        strokeWidth: 2,
        dash: [4, 4],
      });
      this.waypointsLayer.add(marker);
      return marker;
    });

    // Neon Target
    this.target = new Konva.Circle({
      x: waypoints[0].x,
      y: waypoints[0].y,
      radius: this.radius,
      fill: '#00ff66',
      shadowColor: '#00ff66',
      shadowBlur: 16,
      shadowOpacity: 0.85,
    });
    this.targetLayer.add(this.target);

    this.waypointsLayer.batchDraw();
    this.targetLayer.batchDraw();
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

      // Dwell period
      this.timeline.to({}, { duration: this.holdDuration });
    });

    this.timeline.timeScale(this.timeScale);
    if (this.isPaused) {
      this.timeline.pause();
    }
  }

  setPaused(paused) {
    super.setPaused(paused);
    if (!this.timeline) return;
    if (paused) {
      this.timeline.pause();
    } else {
      this.timeline.play();
    }
  }

  setTimeScale(scale) {
    super.setTimeScale(scale);
    if (this.timeline) {
      this.timeline.timeScale(scale);
    }
  }

  onResize() {
    const waypoints = this.getWaypoints();
    if (this.waypointMarkers) {
      this.waypointMarkers.forEach((marker, index) => {
        if (waypoints[index]) {
          marker.position(waypoints[index]);
        }
      });
      this.waypointsLayer.batchDraw();
    }
    this.setupAnimation();
  }

  cleanupAnimation() {
    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }
  }
}
