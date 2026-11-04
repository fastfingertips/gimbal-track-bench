import Konva from 'konva';
import gsap from 'gsap';

class CameraTrackingTool {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.speedSlider = document.getElementById('speedSlider');
    this.speedValue = document.getElementById('speedValue');
    this.obstacleWidthSlider = document.getElementById('obstacleWidthSlider');
    this.obstacleWidthValue = document.getElementById('obstacleWidthValue');
    this.togglePlayBtn = document.getElementById('togglePlayBtn');
    this.toggleIcon = document.getElementById('toggleIcon');
    this.toggleText = document.getElementById('toggleText');

    this.radius = 40;
    this.obstacleWidth = parseFloat(this.obstacleWidthSlider.value) || 300;
    this.baseDuration = 4; // Base seconds per horizontal sweep

    this.initCanvas();
    this.initShapes();
    this.initAnimation();
    this.bindEvents();
  }

  getDimensions() {
    return {
      width: this.container.clientWidth || window.innerWidth,
      height: this.container.clientHeight || (window.innerHeight - 100),
    };
  }

  initCanvas() {
    const { width, height } = this.getDimensions();

    this.stage = new Konva.Stage({
      container: 'canvas-container',
      width,
      height,
    });

    // Layer 1: Target Layer (bottom)
    this.targetLayer = new Konva.Layer();
    // Layer 2: Obstacle Layer (top, completely blocks Target)
    this.obstacleLayer = new Konva.Layer();

    this.stage.add(this.targetLayer);
    this.stage.add(this.obstacleLayer);
  }

  initShapes() {
    const { width, height } = this.getDimensions();

    // 1. Target: Neon Green Circle (radius 40px)
    this.target = new Konva.Circle({
      x: this.radius,
      y: height / 2,
      radius: this.radius,
      fill: '#00ff66',
      shadowColor: '#00ff66',
      shadowBlur: 15,
      shadowOpacity: 0.8,
    });
    this.targetLayer.add(this.target);

    // 2. Obstacle: Pure Black Rectangle centered horizontally, full canvas height
    this.obstacle = new Konva.Rect({
      x: (width - this.obstacleWidth) / 2,
      y: 0,
      width: this.obstacleWidth,
      height: height,
      fill: '#000000',
    });
    this.obstacleLayer.add(this.obstacle);

    this.targetLayer.draw();
    this.obstacleLayer.draw();
  }

  initAnimation() {
    const { width } = this.getDimensions();
    const startX = this.radius;
    const endX = width - this.radius;

    // Reset position to left boundary
    this.target.x(startX);
    this.targetLayer.batchDraw();

    // Kill existing tween if present
    if (this.tween) {
      const wasPaused = this.tween.paused();
      const currentScale = this.tween.timeScale();
      this.tween.kill();

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

      this.tween.timeScale(currentScale);
      if (wasPaused) {
        this.tween.pause();
      }
    } else {
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
      this.tween.timeScale(parseFloat(this.speedSlider.value) || 1.0);
    }
  }

  bindEvents() {
    // 1. Play / Pause Toggle
    this.togglePlayBtn.addEventListener('click', () => {
      if (this.tween.paused()) {
        this.tween.play();
        this.toggleIcon.textContent = '⏸';
        this.toggleText.textContent = 'Pause';
      } else {
        this.tween.pause();
        this.toggleIcon.textContent = '▶';
        this.toggleText.textContent = 'Play';
      }
    });

    // 2. Speed Slider
    this.speedSlider.addEventListener('input', (e) => {
      const speed = parseFloat(e.target.value);
      this.speedValue.textContent = `${speed.toFixed(1)}x`;
      this.tween.timeScale(speed);
    });

    // 3. Obstacle Width Slider
    this.obstacleWidthSlider.addEventListener('input', (e) => {
      this.obstacleWidth = parseFloat(e.target.value);
      this.obstacleWidthValue.textContent = `${this.obstacleWidth}px`;
      this.updateObstacleLayout();
    });

    // 4. Responsive Resize Handling
    window.addEventListener('resize', () => {
      this.handleResize();
    });
  }

  updateObstacleLayout() {
    const { width, height } = this.getDimensions();
    this.obstacle.width(this.obstacleWidth);
    this.obstacle.x((width - this.obstacleWidth) / 2);
    this.obstacle.height(height);
    this.obstacleLayer.batchDraw();
  }

  handleResize() {
    const { width, height } = this.getDimensions();

    this.stage.width(width);
    this.stage.height(height);

    // Keep vertical center for target
    this.target.y(height / 2);

    // Re-center obstacle
    this.updateObstacleLayout();

    // Reinitialize animation bounds
    this.initAnimation();
  }
}

// Bootstrap application on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new CameraTrackingTool();
});
