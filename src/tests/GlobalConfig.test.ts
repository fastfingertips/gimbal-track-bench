import { describe, it, expect, vi } from 'vitest';

vi.mock('konva', () => ({
  default: {},
}));

import { GlobalConfig } from '../core/GlobalConfig';

describe('GlobalConfig URL Parameter Parsing', () => {
  it('updates visual settings from URLSearchParams correctly', () => {
    const mockCanvasManager = {
      getDimensions: () => ({ width: 1920, height: 1080 }),
      getLayer: () => ({
        moveToBottom: vi.fn(),
        destroyChildren: vi.fn(),
        add: vi.fn(),
        batchDraw: vi.fn(),
      }),
    } as any;

    const config = new GlobalConfig(mockCanvasManager);

    const params = new URLSearchParams('targetColor=%23ff0055&targetGlow=false&glowBlur=28&showGrid=false');
    config.applyFromUrlParams(params);

    expect(config.get('targetColor')).toBe('#ff0055');
    expect(config.get('targetGlow')).toBe(false);
    expect(config.get('glowBlur')).toBe(28);
    expect(config.get('showGrid')).toBe(false);
  });
});
