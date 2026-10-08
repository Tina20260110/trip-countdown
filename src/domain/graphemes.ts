const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: 'grapheme',
});

export function countGraphemes(value: string): number {
  let count = 0;
  const segments = graphemeSegmenter.segment(value)[Symbol.iterator]();
  let current = segments.next();

  while (!current.done) {
    count += 1;
    current = segments.next();
  }

  return count;
}
