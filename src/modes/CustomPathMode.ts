import Konva from 'konva';
import { BaseMode } from '../core/BaseMode';
import type { ModeControlSpec } from '../core/BaseMode';
import type { GlobalSettings } from '../core/GlobalConfig';
import type { InspectableEntity } from '../core/SceneInspector';

interface Point {
  x: number;
  y: number;
}

export class CustomPathMode extends BaseMode {
  // Motion & Speed
  private speedPixelsPerSecond: number = 380;
  private loopMode: 'ping-pong' | 'loop' | 'once' = 'ping-pong';
  private direction: number = 1; // 1 = forward, -1 = reverse
  private currentDistance: number = 0;
  private totalLength: number = 0;
  private isDrawing: boolean = false;
  private showPathLine: boolean = true;
  private showHeading: boolean = true;
  private showTrail: boolean = true;
  private activePreset: string = 'infinity';

  // Path data
  private rawPoints: Point[] = [];
  private pathPoints: Point[] = [];
  private cumulativeDistances: number[] = [];

  // Target geometry
  private radius: number = 32;
  private currentX: number = 0;
  private currentY: number = 0;
  private currentAngleDeg: number = 0;

  // Konva graphic layers & shapes
  private guideLayer!: Konva.Layer;
  private targetLayer!: Konva.Layer;
  private trailLayer!: Konva.Layer;

  private pathLine!: Konva.Line;
  private previewLine!: Konva.Line;
  private startMarker!: Konva.Circle;
  private endMarker!: Konva.Circle;
  private startLabel!: Konva.Text;
  private endLabel!: Konva.Text;
  private hintText!: Konva.Text;

  private targetGroup!: Konva.Group;
  private targetCircle!: Konva.Circle;
  private targetHeading!: Konva.Line;
  private centerPip!: Konva.Circle;

  // Trail
  private trailDots: Konva.Circle[] = [];
  private trailHistory: Point[] = [];
  private readonly maxTrailLength: number = 15;

  // Animation and interaction handlers
  private anim: Konva.Animation | null = null;
  private lastTime: number = 0;
  private onPointerDownBound: ((e: PointerEvent) => void) | null = null;
  private onPointerMoveBound: ((e: PointerEvent) => void) | null = null;
  private onPointerUpBound: ((e: PointerEvent) => void) | null = null;

  constructor() {
    super({
      id: 'custom-path',
      name: 'Custom Trajectory (Freehand Path)',
      description: 'Draw arbitrary tracking paths on canvas with mouse/pen. Object glides at uniform speed.',
    });
  }

  public getControls(): ModeControlSpec[] {
    return [
      {
        id: 'speed',
        label: 'Travel Speed (px/s)',
        type: 'range',
        min: 80,
        max: 1200,
        step: 20,
        value: this.speedPixelsPerSecond,
        onChange: (val: number) => {
          this.speedPixelsPerSecond = val;
        },
      },
      {
        id: 'loopMode',
        label: 'Loop Behavior',
        type: 'select',
        options: {
          'Ping-Pong (Back & Forth)': 'ping-pong',
          'Loop to Start': 'loop',
          'Single Pass (Once)': 'once',
        },
        value: this.loopMode,
        onChange: (val: 'ping-pong' | 'loop' | 'once') => {
          this.loopMode = val;
        },
      },
      {
        id: 'preset',
        label: 'Trajectory Preset',
        type: 'select',
        options: {
          'Infinity Curve (∞)': 'infinity',
          'Sine Wave (S-Curve)': 'sine',
          'Cornering Circuit': 'circuit',
          'Spiral Vortex': 'spiral',
          'User Drawn (Freehand)': 'custom',
        },
        value: this.activePreset,
        onChange: (val: string) => {
          this.activePreset = val;
          if (val !== 'custom') {
            this.loadPreset(val);
          }
        },
      },
      {
        id: 'targetSize',
        label: 'Target Size',
        type: 'range',
        min: 12,
        max: 80,
        step: 2,
        value: this.radius,
        onChange: (val: number) => {
          this.radius = val;
          this.updateTargetGeometry();
        },
      },
      {
        id: 'showPath',
        label: 'Show Path Guide',
        type: 'checkbox',
        value: this.showPathLine,
        onChange: (val: boolean) => {
          this.showPathLine = val;
          this.updatePathVisibility();
        },
      },
      {
        id: 'showHeading',
        label: 'Heading Chevron',
        type: 'checkbox',
        value: this.showHeading,
        onChange: (val: boolean) => {
          this.showHeading = val;
          if (this.targetHeading) {
            this.targetHeading.visible(val);
            this.targetLayer.batchDraw();
          }
        },
      },
      {
        id: 'showTrail',
        label: 'Motion Trail',
        type: 'checkbox',
        value: this.showTrail,
        onChange: (val: boolean) => {
          this.showTrail = val;
          if (!val) this.clearTrail();
        },
      },
    ];
  }

  public override getSceneEntities(): InspectableEntity[] {
    const targetColor = this.globalConfig ? this.globalConfig.get('targetColor') : '#007acc';
    const targetGlow = this.globalConfig ? this.globalConfig.get('targetGlow') : true;
    const glowBlur = this.globalConfig ? this.globalConfig.get('glowBlur') : 14;

    const entities: InspectableEntity[] = [
      {
        id: 'trajectory-target',
        name: 'Trajectory Target',
        category: 'target',
        colorTag: targetColor,
        position: { x: Math.round(this.currentX), y: Math.round(this.currentY) },
        properties: [
          {
            id: 'path-progress',
            label: 'Path Progress',
            type: 'slider',
            min: 0,
            max: 100,
            step: 1,
            value: this.totalLength > 0 ? Math.round((this.currentDistance / this.totalLength) * 100) : 0,
            onChange: (val: number) => {
              if (this.totalLength > 0) {
                this.currentDistance = (val / 100) * this.totalLength;
                this.updateTargetPositionFromDistance();
              }
            },
          },
          {
            id: 'path-speed',
            label: 'Speed (px/s)',
            type: 'slider',
            min: 50,
            max: 1200,
            step: 25,
            value: this.speedPixelsPerSecond,
            onChange: (val: number) => {
              this.speedPixelsPerSecond = val;
            },
          },
          {
            id: 'target-radius',
            label: 'Target Radius',
            type: 'slider',
            min: 10,
            max: 100,
            step: 2,
            value: this.radius,
            onChange: (val: number) => {
              this.radius = val;
              this.updateTargetGeometry();
            },
          },
          {
            id: 'target-color',
            label: 'Target Color',
            type: 'color',
            value: targetColor,
            onChange: (val: string) => {
              if (this.globalConfig) this.globalConfig.set('targetColor', val);
            },
          },
          {
            id: 'target-glow',
            label: 'Neon Glow',
            type: 'boolean',
            value: targetGlow,
            onChange: (val: boolean) => {
              if (this.globalConfig) this.globalConfig.set('targetGlow', val);
            },
          },
          {
            id: 'glow-blur',
            label: 'Glow Blur',
            type: 'slider',
            min: 0,
            max: 50,
            step: 2,
            value: glowBlur,
            onChange: (val: number) => {
              if (this.globalConfig) this.globalConfig.set('glowBlur', val);
            },
          },
        ],
      },
      {
        id: 'trajectory-path',
        name: `User Trajectory (${Math.round(this.totalLength)} px)`,
        category: 'waypoint',
        colorTag: '#3b82f6',
        properties: [
          {
            id: 'show-path-guide',
            label: 'Display Guide Line',
            type: 'boolean',
            value: this.showPathLine,
            onChange: (val: boolean) => {
              this.showPathLine = val;
              this.updatePathVisibility();
            },
          },
          {
            id: 'show-heading-marker',
            label: 'Direction Heading Chevron',
            type: 'boolean',
            value: this.showHeading,
            onChange: (val: boolean) => {
              this.showHeading = val;
              if (this.targetHeading) {
                this.targetHeading.visible(val);
                this.targetLayer.batchDraw();
              }
            },
          },
        ],
      },
    ];

    return entities;
  }

  public setupElements(): void {
    this.guideLayer = this.canvasManager!.getLayer('guide-layer');
    this.trailLayer = this.canvasManager!.getLayer('obstacle-layer'); // Repurpose obstacle layer for trail
    this.targetLayer = this.canvasManager!.getLayer('target-layer');

    const targetColor = this.globalConfig ? this.globalConfig.get('targetColor') : '#007acc';
    const targetGlow = this.globalConfig ? this.globalConfig.get('targetGlow') : true;
    const glowBlur = this.globalConfig ? this.globalConfig.get('glowBlur') : 14;

    // 1. Path Guide Line
    this.pathLine = new Konva.Line({
      points: [],
      stroke: targetColor,
      strokeWidth: 2.2,
      dash: [10, 8],
      opacity: 0.7,
      lineCap: 'round',
      lineJoin: 'round',
      shadowColor: targetColor,
      shadowBlur: 6,
      shadowOpacity: 0.5,
      listening: false,
    });
    this.guideLayer.add(this.pathLine);

    // 2. Active Drawing Preview Line
    this.previewLine = new Konva.Line({
      points: [],
      stroke: '#00e5ff',
      strokeWidth: 3,
      lineCap: 'round',
      lineJoin: 'round',
      shadowColor: '#00e5ff',
      shadowBlur: 10,
      shadowOpacity: 0.8,
      visible: false,
      listening: false,
    });
    this.guideLayer.add(this.previewLine);

    // 3. Start & End Markers
    this.startMarker = new Konva.Circle({
      radius: 6,
      fill: '#4ade80',
      stroke: '#ffffff',
      strokeWidth: 1.5,
      visible: false,
      listening: false,
    });
    this.startLabel = new Konva.Text({
      text: 'START',
      fontSize: 10,
      fontFamily: 'Segoe UI, sans-serif',
      fill: '#4ade80',
      offsetY: 18,
      offsetX: 14,
      visible: false,
      listening: false,
    });

    this.endMarker = new Konva.Circle({
      radius: 6,
      fill: '#f87171',
      stroke: '#ffffff',
      strokeWidth: 1.5,
      visible: false,
      listening: false,
    });
    this.endLabel = new Konva.Text({
      text: 'END',
      fontSize: 10,
      fontFamily: 'Segoe UI, sans-serif',
      fill: '#f87171',
      offsetY: 18,
      offsetX: 10,
      visible: false,
      listening: false,
    });

    this.guideLayer.add(this.startMarker);
    this.guideLayer.add(this.startLabel);
    this.guideLayer.add(this.endMarker);
    this.guideLayer.add(this.endLabel);

    // 4. Subtle On-Canvas Drawing Hint
    const { width, height } = this.canvasManager!.getDimensions();
    this.hintText = new Konva.Text({
      text: '✏️ Drag on canvas to draw your custom trajectory',
      fontSize: 12,
      fontFamily: 'Segoe UI, sans-serif',
      fill: '#858585',
      align: 'center',
      x: width / 2 - 130,
      y: height - 42,
      listening: false,
      opacity: 0.7,
    });
    this.guideLayer.add(this.hintText);

    // 5. Motion Trail Pool
    this.trailDots = [];
    for (let i = 0; i < this.maxTrailLength; i++) {
      const dot = new Konva.Circle({
        radius: Math.max(2, this.radius * 0.22 * (1 - i / this.maxTrailLength)),
        fill: targetColor,
        opacity: 0,
        listening: false,
      });
      this.trailLayer.add(dot);
      this.trailDots.push(dot);
    }

    // 6. Target Group
    this.targetGroup = new Konva.Group({
      x: width / 2,
      y: height / 2,
      name: 'custom-target-group',
    });

    this.targetCircle = new Konva.Circle({
      radius: this.radius,
      fill: targetColor,
      opacity: 0.88,
      stroke: '#ffffff',
      strokeWidth: 1.5,
      shadowColor: targetColor,
      shadowBlur: targetGlow ? glowBlur : 0,
      shadowOpacity: 0.9,
    });

    // Heading Chevron pointing in travel direction
    const arrowLen = this.radius + 12;
    this.targetHeading = new Konva.Line({
      points: [0, 0, arrowLen, 0, arrowLen - 6, -5, arrowLen, 0, arrowLen - 6, 5],
      stroke: '#ffffff',
      strokeWidth: 2,
      lineCap: 'round',
      lineJoin: 'round',
      visible: this.showHeading,
      listening: false,
    });

    this.centerPip = new Konva.Circle({
      radius: 3.5,
      fill: '#ffffff',
      listening: false,
    });

    this.targetGroup.add(this.targetCircle);
    this.targetGroup.add(this.targetHeading);
    this.targetGroup.add(this.centerPip);
    this.targetLayer.add(this.targetGroup);

    // Load initial default path (Infinity curve)
    this.loadPreset('infinity');
  }

  public setupAnimation(): void {
    this.bindPointerEvents();
    this.lastTime = performance.now();

    this.anim = new Konva.Animation((frame) => {
      if (!frame || this.isPaused || this.isDrawing || this.totalLength <= 0) return;

      const now = performance.now();
      const deltaSec = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;

      // Advance distance along path
      const moveDistance = this.speedPixelsPerSecond * this.timeScale * deltaSec * this.direction;
      this.currentDistance += moveDistance;

      // Handle Loop Behavior
      if (this.loopMode === 'ping-pong') {
        if (this.currentDistance >= this.totalLength) {
          this.currentDistance = this.totalLength;
          this.direction = -1;
        } else if (this.currentDistance <= 0) {
          this.currentDistance = 0;
          this.direction = 1;
        }
      } else if (this.loopMode === 'loop') {
        if (this.currentDistance >= this.totalLength) {
          this.currentDistance = this.currentDistance % this.totalLength;
        } else if (this.currentDistance < 0) {
          this.currentDistance = this.totalLength + (this.currentDistance % this.totalLength);
        }
      } else if (this.loopMode === 'once') {
        if (this.currentDistance >= this.totalLength) {
          this.currentDistance = this.totalLength;
          this.setPaused(true);
        }
      }

      this.updateTargetPositionFromDistance();

      if (this.showTrail) {
        this.updateTrail();
      }
    }, [this.targetLayer, this.trailLayer]);

    this.anim.start();
  }

  private updateTargetPositionFromDistance(): void {
    if (this.pathPoints.length < 2 || this.totalLength <= 0) return;

    const clampedDist = Math.max(0, Math.min(this.totalLength, this.currentDistance));

    // Find active segment via binary search
    let low = 0;
    let high = this.cumulativeDistances.length - 1;
    let index = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.cumulativeDistances[mid] <= clampedDist) {
        index = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (index >= this.pathPoints.length - 1) {
      index = this.pathPoints.length - 2;
    }

    const p0 = this.pathPoints[index];
    const p1 = this.pathPoints[index + 1];
    const d0 = this.cumulativeDistances[index];
    const d1 = this.cumulativeDistances[index + 1];
    const segDist = d1 - d0;

    const ratio = segDist > 0 ? (clampedDist - d0) / segDist : 0;

    this.currentX = p0.x + (p1.x - p0.x) * ratio;
    this.currentY = p0.y + (p1.y - p0.y) * ratio;

    // Calculate heading angle
    const dx = (p1.x - p0.x) * (this.direction >= 0 ? 1 : -1);
    const dy = (p1.y - p0.y) * (this.direction >= 0 ? 1 : -1);
    this.currentAngleDeg = Math.atan2(dy, dx) * (180 / Math.PI);

    this.targetGroup.position({ x: this.currentX, y: this.currentY });
    this.targetHeading.rotation(this.currentAngleDeg);
  }

  private bindPointerEvents(): void {
    const canvasContainer = document.getElementById('canvas-container');
    if (!canvasContainer) return;

    this.onPointerDownBound = (e: PointerEvent) => {
      // Don't draw if interacting with UI buttons or menus
      const targetEl = e.target as HTMLElement;
      if (
        targetEl.closest('.mode-menu-wrapper') ||
        targetEl.closest('.gui-wrapper') ||
        targetEl.closest('.canvas-inspector') ||
        targetEl.closest('.menu-toggle-btn') ||
        targetEl.closest('.ghost-github-badge')
      ) {
        return;
      }

      this.isDrawing = true;
      this.rawPoints = [{ x: e.clientX, y: e.clientY }];

      this.previewLine.points([e.clientX, e.clientY]);
      this.previewLine.visible(true);
      this.guideLayer.batchDraw();

      if (this.hintText) {
        this.hintText.visible(false);
      }
    };

    this.onPointerMoveBound = (e: PointerEvent) => {
      if (!this.isDrawing) return;

      const lastPoint = this.rawPoints[this.rawPoints.length - 1];
      const dist = Math.hypot(e.clientX - lastPoint.x, e.clientY - lastPoint.y);

      // Collect points at smooth distance threshold
      if (dist >= 12) {
        this.rawPoints.push({ x: e.clientX, y: e.clientY });

        const pts: number[] = [];
        for (const p of this.rawPoints) {
          pts.push(p.x, p.y);
        }
        this.previewLine.points(pts);
        this.guideLayer.batchDraw();
      }
    };

    this.onPointerUpBound = () => {
      if (!this.isDrawing) return;
      this.isDrawing = false;
      this.previewLine.visible(false);

      if (this.rawPoints.length >= 2) {
        this.activePreset = 'custom';
        this.processNewPath(this.rawPoints);
      } else {
        this.guideLayer.batchDraw();
      }
    };

    window.addEventListener('pointerdown', this.onPointerDownBound);
    window.addEventListener('pointermove', this.onPointerMoveBound);
    window.addEventListener('pointerup', this.onPointerUpBound);
  }

  private processNewPath(points: Point[]): void {
    // Generate smooth spline curve through input points
    this.pathPoints = this.smoothPathPoints(points, 6);
    this.computeCumulativeDistances();

    // Reset target traversal
    this.currentDistance = 0;
    this.direction = 1;
    this.clearTrail();

    // Update Konva Path Line
    const flatCoords: number[] = [];
    for (const p of this.pathPoints) {
      flatCoords.push(p.x, p.y);
    }
    this.pathLine.points(flatCoords);

    // Update Start & End markers
    const startPt = this.pathPoints[0];
    const endPt = this.pathPoints[this.pathPoints.length - 1];

    this.startMarker.position(startPt);
    this.startLabel.position(startPt);
    this.startMarker.visible(true);
    this.startLabel.visible(true);

    this.endMarker.position(endPt);
    this.endLabel.position(endPt);
    this.endMarker.visible(true);
    this.endLabel.visible(true);

    this.updateTargetPositionFromDistance();

    this.guideLayer.batchDraw();
    this.targetLayer.batchDraw();
  }

  private smoothPathPoints(points: Point[], subdivisions: number): Point[] {
    if (points.length < 3) return points;

    const smoothed: Point[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i < points.length - 2 ? points[i + 2] : p2;

      for (let s = 0; s < subdivisions; s++) {
        const t = s / subdivisions;
        const pt = this.catmullRom(p0, p1, p2, p3, t);
        smoothed.push(pt);
      }
    }
    smoothed.push(points[points.length - 1]);
    return smoothed;
  }

  private catmullRom(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
    const t2 = t * t;
    const t3 = t2 * t;

    const x =
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);

    const y =
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

    return { x, y };
  }

  private computeCumulativeDistances(): void {
    this.cumulativeDistances = [0];
    let sum = 0;

    for (let i = 0; i < this.pathPoints.length - 1; i++) {
      const p0 = this.pathPoints[i];
      const p1 = this.pathPoints[i + 1];
      const d = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      sum += d;
      this.cumulativeDistances.push(sum);
    }

    this.totalLength = sum;
  }

  public loadPreset(name: string): void {
    const { width, height } = this.canvasManager!.getDimensions();
    const cx = width / 2;
    const cy = height / 2;
    const pts: Point[] = [];

    if (name === 'infinity') {
      const rx = Math.min(width * 0.36, 480);
      const ry = Math.min(height * 0.26, 260);
      const steps = 72;
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        const x = cx + rx * Math.sin(t);
        const y = cy + (ry * Math.sin(2 * t)) / 2;
        pts.push({ x, y });
      }
    } else if (name === 'sine') {
      const spanX = Math.min(width * 0.75, 1100);
      const ampY = Math.min(height * 0.22, 220);
      const steps = 60;
      const startX = cx - spanX / 2;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = startX + t * spanX;
        const y = cy + ampY * Math.sin(t * Math.PI * 4);
        pts.push({ x, y });
      }
    } else if (name === 'circuit') {
      const w = Math.min(width * 0.6, 800);
      const h = Math.min(height * 0.45, 450);
      const r = 50; // Corner radius
      const x0 = cx - w / 2;
      const y0 = cy - h / 2;
      const x1 = cx + w / 2;
      const y1 = cy + h / 2;

      pts.push({ x: x0 + r, y: y0 });
      pts.push({ x: x1 - r, y: y0 });
      pts.push({ x: x1, y: y0 + r });
      pts.push({ x: x1, y: y1 - r });
      pts.push({ x: x1 - r, y: y1 });
      pts.push({ x: x0 + r, y: y1 });
      pts.push({ x: x0, y: y1 - r });
      pts.push({ x: x0, y: y0 + r });
      pts.push({ x: x0 + r, y: y0 });
    } else if (name === 'spiral') {
      const maxR = Math.min(width * 0.32, height * 0.32);
      const loops = 3;
      const steps = 90;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const angle = t * Math.PI * 2 * loops;
        const r = maxR * (0.15 + t * 0.85);
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        pts.push({ x, y });
      }
    }

    if (pts.length >= 2) {
      this.processNewPath(pts);
    }
  }

  private updateTrail(): void {
    this.trailHistory.unshift({ x: this.currentX, y: this.currentY });
    if (this.trailHistory.length > this.maxTrailLength) {
      this.trailHistory.pop();
    }

    for (let i = 0; i < this.trailDots.length; i++) {
      const dot = this.trailDots[i];
      const pt = this.trailHistory[i];
      if (pt) {
        dot.position(pt);
        dot.opacity((1 - i / this.maxTrailLength) * 0.45);
        dot.visible(true);
      } else {
        dot.visible(false);
      }
    }
  }

  private clearTrail(): void {
    this.trailHistory = [];
    for (const dot of this.trailDots) {
      dot.visible(false);
    }
    if (this.trailLayer) {
      this.trailLayer.batchDraw();
    }
  }

  private updatePathVisibility(): void {
    if (!this.pathLine) return;
    this.pathLine.visible(this.showPathLine);
    this.startMarker.visible(this.showPathLine);
    this.startLabel.visible(this.showPathLine);
    this.endMarker.visible(this.showPathLine);
    this.endLabel.visible(this.showPathLine);
    this.guideLayer.batchDraw();
  }

  private updateTargetGeometry(): void {
    if (!this.targetCircle) return;
    this.targetCircle.radius(this.radius);

    const arrowLen = this.radius + 12;
    this.targetHeading.points([0, 0, arrowLen, 0, arrowLen - 6, -5, arrowLen, 0, arrowLen - 6, 5]);

    for (let i = 0; i < this.trailDots.length; i++) {
      this.trailDots[i].radius(Math.max(2, this.radius * 0.22 * (1 - i / this.maxTrailLength)));
    }

    this.targetLayer.batchDraw();
  }

  public override onGlobalConfigChange(settings: GlobalSettings): void {
    if (!this.targetCircle) return;

    this.targetCircle.fill(settings.targetColor);
    this.targetCircle.shadowColor(settings.targetColor);
    this.targetCircle.shadowBlur(settings.targetGlow ? settings.glowBlur : 0);

    if (this.pathLine) {
      this.pathLine.stroke(settings.targetColor);
      this.pathLine.shadowColor(settings.targetColor);
    }

    for (const dot of this.trailDots) {
      dot.fill(settings.targetColor);
    }

    this.targetLayer.batchDraw();
    this.guideLayer.batchDraw();
    this.trailLayer.batchDraw();
  }

  public override setPaused(paused: boolean): void {
    super.setPaused(paused);
    if (this.anim) {
      if (paused) this.anim.stop();
      else {
        this.lastTime = performance.now();
        this.anim.start();
      }
    }
  }

  public override onResize(dims: { width: number; height: number }): void {
    if (this.hintText) {
      this.hintText.position({ x: dims.width / 2 - 130, y: dims.height - 42 });
      this.guideLayer.batchDraw();
    }
    // If on default preset, recalculate for new dimensions
    if (this.activePreset !== 'custom') {
      this.loadPreset(this.activePreset);
    }
  }

  public override cleanupAnimation(): void {
    if (this.anim) {
      this.anim.stop();
      this.anim = null;
    }

    if (this.onPointerDownBound) {
      window.removeEventListener('pointerdown', this.onPointerDownBound);
      this.onPointerDownBound = null;
    }
    if (this.onPointerMoveBound) {
      window.removeEventListener('pointermove', this.onPointerMoveBound);
      this.onPointerMoveBound = null;
    }
    if (this.onPointerUpBound) {
      window.removeEventListener('pointerup', this.onPointerUpBound);
      this.onPointerUpBound = null;
    }

    this.clearTrail();
  }
}

