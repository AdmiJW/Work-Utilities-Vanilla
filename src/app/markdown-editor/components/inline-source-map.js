import { sourceOffset } from '../functions/inline-offsets.js';

export function createInlineSourceMap(decode) {
  const text = new WeakMap(),
    objects = new WeakMap();
  return {
    text,
    objects,
    hit(host, event, length) {
      const x = event.clientX,
        y = event.clientY;
      const object = event.target.closest?.('.md-image');
      if (object && objects.has(object)) {
        const range = objects.get(object),
          box = object.getBoundingClientRect();
        return x < (box.left + box.right) / 2 ? range.from : range.to;
      }
      const caret = document.caretPositionFromPoint?.(x, y);
      const range = caret ? null : document.caretRangeFromPoint?.(x, y);
      const node = caret?.offsetNode ?? range?.startContainer;
      const offset = caret?.offset ?? range?.startOffset ?? 0;
      if (node && host.contains(node) && text.has(node)) {
        const span = text.get(node);
        const position =
          span.from + (span.literal ? offset : sourceOffset(span.raw, offset, decode));
        return Math.max(0, Math.min(length, position));
      }
      const box = host.getBoundingClientRect();
      if (node && host.contains(node)) {
        const next = node.childNodes?.[offset],
          previous = node.childNodes?.[offset - 1];
        if (next && objects.has(next)) return objects.get(next).from;
        if (previous && objects.has(previous)) return objects.get(previous).to;
        if (objects.has(node)) return objects.get(node).from;
      }
      return x < (box.left + box.right) / 2 ? 0 : length;
    },
  };
}
