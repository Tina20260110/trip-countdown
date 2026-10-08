import { countGraphemes } from '@/src/domain/graphemes';

describe('countGraphemes', () => {
  it.each([
    ['plain text', 'Tokyo', 5],
    ['combining accent', 'e\u0301', 1],
    ['flag emoji', '🇯🇵', 1],
    ['ZWJ emoji', '👨‍👩‍👧‍👦', 1],
    ['surrounding whitespace', ' \t ', 3],
    ['empty text', '', 0],
  ])('counts %s by user-visible grapheme clusters', (_label, value, expected) => {
    expect(countGraphemes(value)).toBe(expected);
  });
});
