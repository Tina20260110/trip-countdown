import { countGraphemes as countUnicodeGraphemes } from 'unicode-segmenter/grapheme';

export function countGraphemes(value: string): number {
  return countUnicodeGraphemes(value);
}
