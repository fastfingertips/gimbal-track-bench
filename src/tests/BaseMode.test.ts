import { describe, it, expect } from 'vitest';
import { BaseMode } from '../core/BaseMode';
import type { ModeControlSpec } from '../core/BaseMode';

class DummyMode extends BaseMode {
  public speed: number = 100;
  public active: boolean = false;
  public pattern: string = 'circle';

  constructor() {
    super({
      id: 'dummy-mode',
      name: 'Dummy Mode',
      description: 'Test mode for unit tests',
    });
  }

  public getControls(): ModeControlSpec[] {
    return [
      {
        id: 'speed',
        label: 'Speed',
        type: 'range',
        value: this.speed,
        onChange: (v: number) => {
          this.speed = v;
        },
      },
      {
        id: 'active',
        label: 'Active',
        type: 'checkbox',
        value: this.active,
        onChange: (v: boolean) => {
          this.active = v;
        },
      },
      {
        id: 'pattern',
        label: 'Pattern',
        type: 'select',
        value: this.pattern,
        onChange: (v: string) => {
          this.pattern = v;
        },
      },
    ];
  }

  public setupElements(): void {}
  public setupAnimation(): void {}
}

describe('BaseMode Settings Serialization', () => {
  it('retrieves correct current settings dictionary', () => {
    const mode = new DummyMode();
    const settings = mode.getSettings();

    expect(settings).toEqual({
      speed: 100,
      active: false,
      pattern: 'circle',
    });
  });

  it('applies deserialized settings and triggers callbacks', () => {
    const mode = new DummyMode();
    mode.applySettings({
      speed: '250',
      active: 'true',
      pattern: 'spiral',
    });

    expect(mode.speed).toBe(250);
    expect(mode.active).toBe(true);
    expect(mode.pattern).toBe('spiral');
  });
});
