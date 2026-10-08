import { countGraphemes } from '@/src/domain/graphemes';
import { validateChecklistItemInput } from '@/src/domain/validation';

describe('field grapheme boundaries', () => {
  it.each([
    ['destination at limit', '🇯🇵'.repeat(80), 80],
    ['destination over limit', '🇯🇵'.repeat(81), 81],
    ['checklist title at limit', 'e\u0301'.repeat(100), 100],
    ['checklist title over limit', 'e\u0301'.repeat(101), 101],
    ['notes at limit', '👨‍👩‍👧‍👦'.repeat(500), 500],
    ['notes over limit', '👨‍👩‍👧‍👦'.repeat(501), 501],
  ])('counts %s without UTF-16 code-unit semantics', (_label, value, expected) => {
    expect(countGraphemes(value)).toBe(expected);
  });
});

describe('Checklist title validation', () => {
  it('trims a valid title', () => {
    expect(validateChecklistItemInput({ title: '  Passport  ' })).toEqual({
      ok: true,
      value: { title: 'Passport' },
    });
  });

  it('accepts exactly 100 graphemes', () => {
    expect(validateChecklistItemInput({ title: '🇯🇵'.repeat(100) }).ok).toBe(true);
  });

  it.each(['   ', '🇯🇵'.repeat(101)])('rejects an invalid title', (title) => {
    expect(validateChecklistItemInput({ title })).toMatchObject({
      ok: false,
      error: {
        kind: 'validation',
        fieldErrors: { title: expect.any(String) },
      },
    });
  });
});
