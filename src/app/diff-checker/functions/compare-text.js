import { Chunk, diff } from '@codemirror/merge';
import { Text } from '@codemirror/state';

const diffConfig = { scanLimit: 2000, timeout: 250 };

export function compareText({ left, right }) {
  const a = Text.of(left.split(/\r\n?|\n/));
  const b = Text.of(right.split(/\r\n?|\n/));
  return Chunk.build(a, b, diffConfig).map((chunk) => {
    if (!chunk.precise) return chunk;
    // Keep the merge library's line alignment and refine replacements within one line.
    const changes = chunk.changes.flatMap((change) => {
      if (change.fromA === change.toA || change.fromB === change.toB) return [change];
      const fromA = chunk.fromA + change.fromA,
        fromB = chunk.fromB + change.fromB,
        toA = chunk.fromA + change.toA,
        toB = chunk.fromB + change.toB;
      if (toA > a.lineAt(fromA).to || toB > b.lineAt(fromB).to) return [change];
      return diff(a.sliceString(fromA, toA), b.sliceString(fromB, toB), diffConfig).map((part) => ({
        fromA: change.fromA + part.fromA,
        toA: change.fromA + part.toA,
        fromB: change.fromB + part.fromB,
        toB: change.fromB + part.toB,
      }));
    });
    return { ...chunk, changes };
  });
}
