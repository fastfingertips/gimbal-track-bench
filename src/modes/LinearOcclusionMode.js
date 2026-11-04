import Konva from 'konva';
import gsap from 'gsap';
import { BaseMode } from '../core/BaseMode.js';

export class LinearOcclusionMode extends BaseMode {
  constructor() {
    super({
      id: 'linear-occlusion',
      name: 'Linear Occlusion (Center Block)',
      description: 'Horizontal tracking pass with a center obstacle to test occlusion recovery.',
    });

    this.radius = 40;
    this.obstacleWidth = 300;
    this.obstacleCount = 1; // 1 or 2 pillars
    this.baseDuration = 4;
    this.easeType = 'none'; // 'none' | 'power2.inOut' | 'sine.inOut'
    this.verticalOffset = 0; // vertical drift
    this.tween = null;
  }

  getControls() {
    return [
      {
        id: 'obstacleWidth',
        label: 'Obstacle Width',
        type: 'range',
        min: 20,
        max: 800,
        step: 10,
        value: this.obstacleWidth,
        onChange: (val) => {
          this.obstacleWidth = val;
          this.updateObstacles();
        },
      },
      {
        id: 'obstacleCount',
        label: 'Pillar Count',
        type: 'select',
        options: { 'Single Pillar (Center)': 1, 'Dual Pillars': 2 },
        value: this.obstacleCount,
        onChange: (val) => {
          this.obstacleCount = parseInt(val, 10);
          this.rebuildObstacles();
        },
      },
      {
        id: 'targetRadius',
        label: 'Target Size',
        type: 'range',
        min: 10,
        max: 100,
        step: 2,
        value: this.radius,
        onChange: (val) => {
          this.radius = val;
          if (this.target) {
            this.target.radius(this.radius);
            this.targetLayer.batchDraw();
          }
          this.setupAnimation();
        },
      },
      {
        id: 'easeType',
        label: 'Motion Curve',
        type: 'select',
        options: { 'Linear (Constant)': 'none', 'Ease In-Out': 'power2.inOut', 'Sine Wave': 'sine.inOut' },
        value: this.easeType,
        onChange: (val) => {
          this.easeType = val;
          this.setupAnimation();
        },
      },
      {
        id: 'verticalOffset',
        label: 'V-Drift (Y)',
        type: 'range',
        min: -150,
        max: 150,
        step: 10,
        value: this.verticalOffset,
        onChange: (val) => {
          this.verticalOffset = val;
          const { height } = this.canvasManager.getDimensions();
          if (this.target) {
            this.target.y(height / 2 + this.verticalOffset);
            this.targetLayer.batchDraw();
          }
        },
      },
    ];
  }

  setupElements() {
    const { height } = this.canvasManager.getDimensions();

    this.targetLayer = this.canvasManager.getLayer('target-layer');
    this.obstacleLayer = this.canvasManager.getLayer('obstacle-layer');

    const targetColor = this.globalConfig ? this.globalConfig.get('targetColor') : '#00ff66';
    const targetGlow = this.globalConfig ? this.globalConfig.get('targetGlow') : true;

    // Target circle
    this.target = new Konva.Circle({
      x: this.radius,
      y: height / 2 + this.verticalOffset,
      radius: this.radius,
      fill: targetColor,
      shadowColor: targetColor,
      shadowBlur: targetGlow ? 16 : 0,
      shadowOpacity: 0.85,
    });
    this.targetLayer.add(this.target);

    this.rebuildObstacles();
    this.targetLayer.batchDraw();
  }

  rebuildObstacles() {
    this.obstacleLayer.destroyChildren();
    const { width, height } = this.canvasManager.getDimensions();
    const obsColor = this.globalConfig ? this.globalConfig.get('obstacleColor') : '#000000';
    const obsOpacity = this.globalConfig ? this.globalConfig.get('obstacleOpacity') : 1.0;

    this.obstacles = [];

    if (this.obstacleCount === 1) {
      const rect = new Konva.Rect({
        x: (width - this.obstacleWidth) / 2,
        y: 0,
        width: this.obstacleWidth,
        height: height,
        fill: obsColor,
        opacity: obsOpacity,
      });
      this.obstacleLayer.add(rect);
      this.obstacles.push(rect);
    } else {
      // 2 Pillars placed at 33% and 66% width
      const spacing = width / 3;
      const r1 = new Konva.Rect({
        x: spacing - this.obstacleWidth / 2,
        y: 0,
        width: this.obstacleWidth,
        height: height,
        fill: obsColor,
        opacity: obsOpacity,
      });
      const r2 = new Konva.Rect({
        x: spacing * 2 - this.obstacleWidth / 2,
        y: 0,
        width: this.obstacleWidth,
        height: height,
        fill: obsColor,
        opacity: obsOpacity,
      });
      this.obstacleLayer.add(r1);
      this.obstacleLayer.add(r2);
      this.obstacles.push(r1, r2);
    }

    this.obstacleLayer.batchDraw();
  }

  updateObstacles() {
    this.rebuildObstacles();
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
      ease: this.easeType,
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

  onGlobalConfigChange(settings) {
    if (this.target) {
      this.target.fill(settings.targetColor);
      this.target.shadowColor(settings.targetColor);
      this.target.shadowBlur(settings.targetGlow ? settings.glowBlur : 0);
      this.targetLayer.batchDraw();
    }
    if (this.obstacles) {
      this.obstacles.forEach((obs) => {
        obs.fill(settings.obstacleColor);
        obs.opacity(settings.obstacleOpacity);
      });
      this.obstacleLayer.batchDraw();
    }
  }

  setPaused(paused) {
    super.setPaused(paused);
    if (!this.tween) return;
    if (paused) this.tween.pause();
    else this.tween.play();
  }

  setTimeScale(scale) {
    super.setTimeScale(scale);
    if (this.tween) this.tween.timeScale(scale);
  }

  onResize() {
    const { height } = this.canvasManager.getDimensions();
    if (this.target) {
      this.target.y(height / 2 + this.verticalOffset);
    }
    this.updateObstacles();
    this.setupAnimation();
  }

  cleanupAnimation() {
    if (this.tween) {
      this.tween.kill();
      this.tween = null;
    }
  }
}
