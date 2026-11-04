import Konva from 'konva';
import gsap from 'gsap';
import { BaseMode } from '../core/BaseMode.js';

/**
 * CircularTrackingMode
 * Tests continuous angular pan/tilt velocity and acceleration limits
 * by rotating the target in an elliptical or circular orbit.
 */
export class CircularTrackingMode extends BaseMode {
  constructor() {
    super({
      id: 'circular-tracking',
      name: 'Circular Orbit (Pan/Tilt Speed)',
      description: 'Continuous circular tracking to evaluate angular acceleration and gimbal smoothness.',
    });

    this.radius = 35;
    this.orbitRadiusRatio = 0.35; // % of canvas min dimension
    this.showTrail = true;
    this.baseDuration = 5;
    this.orbitAngle = { angle: 0 };
    this.tween = null;
  }

  getControls() {
    return [
      {
        id: 'orbit-size',
        label: 'Orbit Radius',
        type: 'range',
        min: 15,
        max: 48,
        step: 1,
        value: Math.round(this.orbitRadiusRatio * 100),
        unit: '%',
        onChange: (val) => {
          this.orbitRadiusRatio = parseFloat(val) / 100;
          this.updateOrbitGuide();
        },
      },
      {
        id: 'show-orbit-guide',
        label: 'Orbit Guide',
        type: 'checkbox',
        value: this.showTrail,
        onChange: (val) => {
          this.showTrail = val;
          if (this.guideCircle) {
            this.guideCircle.visible(val);
            this.guideLayer.batchDraw();
          }
        },
      },
    ];
  }

  setupElements() {
    const { width, height } = this.canvasManager.getDimensions();
    const centerX = width / 2;
    const centerY = height / 2;
    const minDim = Math.min(width, height);
    const orbitR = minDim * this.orbitRadiusRatio;

    this.guideLayer = this.canvasManager.getLayer('guide-layer');
    this.targetLayer = this.canvasManager.getLayer('target-layer');

    // Dashed guide circle
    this.guideCircle = new Konva.Circle({
      x: centerX,
      y: centerY,
      radius: orbitR,
      stroke: '#333333',
      strokeWidth: 2,
      dash: [8, 8],
      visible: this.showTrail,
    });
    this.guideLayer.add(this.guideCircle);

    // Neon Target
    this.target = new Konva.Circle({
      x: centerX + orbitR,
      y: centerY,
      radius: this.radius,
      fill: '#00ff66',
      shadowColor: '#00ff66',
      shadowBlur: 16,
      shadowOpacity: 0.85,
    });
    this.targetLayer.add(this.target);

    this.guideLayer.batchDraw();
    this.targetLayer.batchDraw();
  }

  updateOrbitGuide() {
    const { width, height } = this.canvasManager.getDimensions();
    const centerX = width / 2;
    const centerY = height / 2;
    const minDim = Math.min(width, height);
    const orbitR = minDim * this.orbitRadiusRatio;

    if (this.guideCircle) {
      this.guideCircle.position({ x: centerX, y: centerY });
      this.guideCircle.radius(orbitR);
      this.guideLayer.batchDraw();
    }
  }

  setupAnimation() {
    if (this.tween) {
      this.tween.kill();
    }

    this.orbitAngle.angle = 0;

    this.tween = gsap.to(this.orbitAngle, {
      angle: Math.PI * 2,
      duration: this.baseDuration,
      ease: 'none',
      repeat: -1,
      onUpdate: () => {
        const { width, height } = this.canvasManager.getDimensions();
        const centerX = width / 2;
        const centerY = height / 2;
        const minDim = Math.min(width, height);
        const orbitR = minDim * this.orbitRadiusRatio;

        const x = centerX + Math.cos(this.orbitAngle.angle) * orbitR;
        const y = centerY + Math.sin(this.orbitAngle.angle) * orbitR;

        this.target.position({ x, y });
        this.targetLayer.batchDraw();
      },
    });

    this.tween.timeScale(this.timeScale);
    if (this.isPaused) {
      this.tween.pause();
    }
  }

  setPaused(paused) {
    super.setPaused(paused);
    if (!this.tween) return;
    if (paused) {
      this.tween.pause();
    } else {
      this.tween.play();
    }
  }

  setTimeScale(scale) {
    super.setTimeScale(scale);
    if (this.tween) {
      this.tween.timeScale(scale);
    }
  }

  onResize() {
    this.updateOrbitGuide();
  }

  cleanupAnimation() {
    if (this.tween) {
      this.tween.kill();
      this.tween = null;
    }
  }
}
