import Konva from 'konva';
import gsap from 'gsap';
import { BaseMode } from '../core/BaseMode.js';

/**
 * DistractorSwappingMode (Crossing Paths Benchmark)
 * Tests whether an AI camera maintains identity lock on the primary target
 * when a second "distractor" object crosses its path directly or diagonally.
 */
export class DistractorSwappingMode extends BaseMode {
  constructor() {
    super({
      id: 'distractor-swapping',
      name: 'Crossing Paths (Target Swap Test)',
      description: 'Simulates secondary moving objects crossing the primary target to test AI identity lock.',
    });

    this.primaryRadius = 36;
    this.distractorRadius = 36;
    this.distractorColor = '#e06c75'; // Soft matte red
    this.crossingPattern = 'x-cross'; // 'x-cross' | 'head-on' | 'orbit-chase'
    this.duration = 4.0;
    this.primaryTween = null;
    this.distractorTween = null;
  }

  getControls() {
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
        onChange: (val) => {
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
        onChange: (val) => {
          this.distractorRadius = val;
          if (this.distractor) {
            this.distractor.radius(this.distractorRadius);
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
        onChange: (val) => {
          this.distractorColor = val;
          this.updateDistractorColor();
        },
      },
    ];
  }

  setupElements() {
    this.primaryLayer = this.canvasManager.getLayer('primary-target-layer');
    this.distractorLayer = this.canvasManager.getLayer('distractor-layer');

    const primaryColor = this.globalConfig ? this.globalConfig.get('targetColor') : '#007acc';
    const primaryGlow = this.globalConfig ? this.globalConfig.get('targetGlow') : true;

    // Primary Target (with subtle label 'A')
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

    // Distractor Target (with label 'B')
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

  updateDistractorColor() {
    if (!this.distractorCircle) return;
    const primaryColor = this.globalConfig ? this.globalConfig.get('targetColor') : '#007acc';
    const color = this.distractorColor === 'SAME' ? primaryColor : this.distractorColor;
    this.distractorCircle.fill(color);
    this.distractorCircle.shadowColor(color);
    this.distractorLayer.batchDraw();
  }

  setupAnimation() {
    const { width, height } = this.canvasManager.getDimensions();
    const padX = 80;
    const padY = 80;

    if (this.primaryTween) this.primaryTween.kill();
    if (this.distractorTween) this.distractorTween.kill();

    if (this.crossingPattern === 'x-cross') {
      // Primary travels Top-Left <-> Bottom-Right
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

      // Distractor travels Bottom-Left <-> Top-Right (Perfect center intersection)
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
      // Both move horizontally across same centerY line and pass directly through each other
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
      // Primary moves horizontally, distractor orbits around center crossing repeatedly
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

  onGlobalConfigChange(settings) {
    if (this.primaryCircle) {
      this.primaryCircle.fill(settings.targetColor);
      this.primaryCircle.shadowColor(settings.targetColor);
      this.primaryCircle.shadowBlur(settings.targetGlow ? settings.glowBlur : 0);
      this.primaryLayer.batchDraw();
    }
    this.updateDistractorColor();
  }

  setPaused(paused) {
    super.setPaused(paused);
    if (this.primaryTween) paused ? this.primaryTween.pause() : this.primaryTween.play();
    if (this.distractorTween) paused ? this.distractorTween.pause() : this.distractorTween.play();
  }

  setTimeScale(scale) {
    super.setTimeScale(scale);
    if (this.primaryTween) this.primaryTween.timeScale(scale);
    if (this.distractorTween) this.distractorTween.timeScale(scale);
  }

  onResize() {
    this.setupAnimation();
  }

  cleanupAnimation() {
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
