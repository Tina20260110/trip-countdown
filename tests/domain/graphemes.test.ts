import { countGraphemes } from '@/src/domain/graphemes';

describe('countGraphemes', () => {
  it.each([
    ['plain text', 'Tokyo', 5],
    ['combining accent', 'e\u0301', 1],
    ['flag emoji', '🇯🇵', 1],
    ['ZWJ emoji', '👨‍👩‍👧‍👦', 1],
    ['emoji with skin tone modifier', '👍🏽', 1],
    ['surrounding whitespace', ' \t ', 3],
    ['empty text', '', 0],
  ])('counts %s by user-visible grapheme clusters', (_label, value, expected) => {
    expect(countGraphemes(value)).toBe(expected);
  });
});

describe('Hermes compatibility', () => {
  it('imports and counts graphemes when Intl.Segmenter is unavailable', () => {
    const originalSegmenter = Intl.Segmenter;

    Object.defineProperty(Intl, 'Segmenter', {
      configurable: true,
      value: undefined,
    });
    jest.resetModules();

    try {
      let hermesCountGraphemes: ((value: string) => number) | undefined;

      jest.isolateModules(() => {
        hermesCountGraphemes = require('@/src/domain/graphemes').countGraphemes;
      });

      expect(hermesCountGraphemes?.('e\u0301')).toBe(1);
      expect(hermesCountGraphemes?.('👨‍👩‍👧‍👦')).toBe(1);
      expect(hermesCountGraphemes?.('👍🏽')).toBe(1);
      expect(hermesCountGraphemes?.('🇯🇵')).toBe(1);
      expect(hermesCountGraphemes?.('东京')).toBe(2);
    } finally {
      Object.defineProperty(Intl, 'Segmenter', {
        configurable: true,
        value: originalSegmenter,
      });
      jest.resetModules();
    }
  });
});
