import Konva from 'konva';
import gsap from 'gsap';
import { BaseMode } from '../core/BaseMode.js';

/**
 * LinearOcclusionMode
 * Tests PTZ/Gimbal tracking recovery during complete visual occlusion
 * with a center obstacle and linear back-and-forth movement.
 */
export class LinearOcclusionMode extends BaseMode {
  constructor() {
    super({
      id: 'linear-occlusion',
      name: 'Linear Occlusion (Center Block)',
      description: 'Horizontal tracking pass with a center obstacle to test occlusion recovery.',
    });

    this.radius = 40;
    this.obstacleWidth = 300;
    this.baseDuration = 4;
    this.tween = null;
  }

  getControls() {
    return [
      {
        id: 'obstacle-width',
        label: 'Obstacle Width',
        type: 'range',
        min: 50,
        max: 800,
        step: 10,
        value: this.obstacleWidth,
        unit: 'px',
        onChange: (val) => {
          this.obstacleWidth = parseFloat(val);
          this.updateObstacle();
        },
      },
      {
        id: 'target-radius',
        label: 'Target Size',
        type: 'range',
        min: 15,
        max: 80,
        step: 5,
        value: this.radius,
        unit: 'px',
        onChange: (val) => {
          this.radius = parseFloat(val);
          this.target.radius(this.radius);
          this.targetLayer.batchDraw();
          this.setupAnimation();
        },
      },
    ];
  }

  setupElements() {
    const { width, height } = this.canvasManager.getDimensions();

    this.targetLayer = this.canvasManager.getLayer('target-layer');
    this.obstacleLayer = this.canvasManager.getLayer('obstacle-layer');

    // 1. Neon Green Target Circle
    this.target = new Konva.Circle({
      x: this.radius,
      y: height / 2,
      radius: this.radius,
      fill: '#00ff66',
      shadowColor: '#00ff66',
      shadowBlur: 16,
      shadowOpacity: 0.85,
    });
    this.targetLayer.add(this.target);

    // 2. Center Black Obstacle
    this.obstacle = new Konva.Rect({
      x: (width - this.obstacleWidth) / 2,
      y: 0,
      width: this.obstacleWidth,
      height: height,
      fill: '#000000',
    });
    this.obstacleLayer.add(this.obstacle);

    this.targetLayer.batchDraw();
    this.obstacleLayer.batchDraw();
  }

  setupAnimation() {
    const { width } = this.canvasManager.getDimensions();
    const startX = this.radius;
    const endX = width - this.radius;

    if (this.tween) {
      this.tween.kill();
    }

    this.target.x(startX);
    this.targetLayer.batchDraw();

    this.tween = gsap.to(this.target, {
      x: endX,
      duration: this.baseDuration,
      ease: 'none',
      repeat: -1,
      yoyo: true,
      onUpdate: () => {
        this.targetLayer.batchDraw();
      },
    });

    this.tween.timeScale(this.timeScale);
    if (this.isPaused) {
      this.tween.pause();
    }
  }

  updateObstacle() {
    if (!this.obstacle) return;
    const { width, height } = this.canvasManager.getDimensions();
    this.obstacle.width(this.obstacleWidth);
    this.obstacle.x((width - this.obstacleWidth) / 2);
    this.obstacle.height(height);
    this.obstacleLayer.batchDraw();
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
    const { height } = this.canvasManager.getDimensions();
    if (this.target) {
      this.target.y(height / 2);
    }
    this.updateObstacle();
    this.setupAnimation();
  }

  cleanupAnimation() {
    if (this.tween) {
      this.tween.kill();
      this.tween = null;
    }
  }
}
