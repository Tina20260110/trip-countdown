import {
  validateCreateTripInput,
  validateEditTripInput,
} from '@/src/domain/validation';

describe('Trip validation', () => {
  const localToday = '2026-10-07';

  it('trims destination and preserves notes exactly', () => {
    const result = validateCreateTripInput(
      {
        destination: '  Tokyo  ',
        departureDate: '2026-10-08',
        notes: '  Keep my spacing  ',
      },
      localToday,
    );

    expect(result).toEqual({
      ok: true,
      value: {
        destination: 'Tokyo',
        departureDate: '2026-10-08',
        notes: '  Keep my spacing  ',
      },
    });
  });

  it('accepts destination and notes at their grapheme limits', () => {
    const result = validateCreateTripInput(
      {
        destination: '🇯🇵'.repeat(80),
        departureDate: localToday,
        notes: 'e\u0301'.repeat(500),
      },
      localToday,
    );

    expect(result.ok).toBe(true);
  });

  it('returns field errors for blank or oversized values', () => {
    const result = validateCreateTripInput(
      {
        destination: '  ',
        departureDate: localToday,
        notes: '👨‍👩‍👧‍👦'.repeat(501),
      },
      localToday,
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: 'validation',
        fieldErrors: {
          destination: expect.any(String),
          notes: expect.any(String),
        },
      },
    });
  });

  it('rejects a destination over 80 graphemes', () => {
    const result = validateCreateTripInput(
      {
        destination: '🇯🇵'.repeat(81),
        departureDate: localToday,
        notes: '',
      },
      localToday,
    );

    expect(result).toMatchObject({
      ok: false,
      error: { fieldErrors: { destination: expect.any(String) } },
    });
  });

  it('rejects a past date when creating a Trip', () => {
    const result = validateCreateTripInput(
      { destination: 'Tokyo', departureDate: '2026-10-06', notes: '' },
      localToday,
    );

    expect(result).toMatchObject({
      ok: false,
      error: { fieldErrors: { departureDate: expect.any(String) } },
    });
  });

  it('accepts the current local date when creating a Trip', () => {
    const result = validateCreateTripInput(
      { destination: 'Tokyo', departureDate: localToday, notes: '' },
      localToday,
    );

    expect(result.ok).toBe(true);
  });

  it('accepts a valid past date when editing an existing Trip', () => {
    const result = validateEditTripInput({
      destination: 'Tokyo',
      departureDate: '2025-01-02',
      notes: '',
    });

    expect(result).toEqual({
      ok: true,
      value: {
        destination: 'Tokyo',
        departureDate: '2025-01-02',
        notes: '',
      },
    });
  });

  it.each(['2026-1-02', '2025-02-29', '2026-13-01', 'not-a-date'])(
    'rejects an invalid calendar date for both Create and Edit: %s',
    (departureDate) => {
      const input = { destination: 'Tokyo', departureDate, notes: '' };

      expect(validateCreateTripInput(input, localToday)).toMatchObject({
        ok: false,
        error: { fieldErrors: { departureDate: expect.any(String) } },
      });
      expect(validateEditTripInput(input)).toMatchObject({
        ok: false,
        error: { fieldErrors: { departureDate: expect.any(String) } },
      });
    },
  );
});
