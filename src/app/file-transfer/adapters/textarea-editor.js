import { TextHistory } from '../functions/text-history.js';
import { indentationChanges, mapIndentPosition } from '../../shared/indentation.js';

const normalize = (value) => value.replace(/\r\n?/g, '\n');
const ending = (value) => (value.includes('\r\n') ? '\r\n' : '\n');
const serialize = (value, lineEnding) => normalize(value).replaceAll('\n', lineEnding);

export function createTextareaEditor(input, changed, originalSource = input.value) {
  let history = new TextHistory(originalSource);
  let escapeTab = 0;
  let composing = false;
  const startComposition = () => {
    composing = true;
  };
  const endComposition = () => {
    composing = false;
  };
  const apply = (snapshot) => {
    input.value = snapshot.text;
    input.setSelectionRange(snapshot.start, snapshot.end, snapshot.direction ?? 'none');
    changed(snapshot.text);
  };
  const before = (event) => {
    if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
      event.preventDefault();
      apply(event.inputType === 'historyUndo' ? history.undo() : history.redo());
      return;
    }
    history.capture(input.selectionStart, input.selectionEnd, input.selectionDirection);
  };
  const edited = (event) => {
    const source = serialize(input.value, ending(history.current.text));
    history.record(
      source,
      input.selectionStart,
      input.selectionEnd,
      ['insertText', 'deleteContentBackward', 'deleteContentForward'].includes(event.inputType)
        ? event.inputType
        : '',
    );
    changed(source);
  };
  const keys = (event) => {
    if (event.key === 'Escape') escapeTab = Date.now() + 2000;
    else if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (Date.now() < escapeTab) {
        escapeTab = 0;
        return;
      }
      if (event.isComposing || composing) return;
      event.preventDefault();
      const start = input.selectionStart,
        end = input.selectionEnd,
        direction = input.selectionDirection;
      const changes = indentationChanges(input.value, [{ from: start, to: end }], event.shiftKey);
      if (!changes.length) return;
      history.capture(start, end, direction);
      let value = input.value;
      for (const change of [...changes].reverse())
        value = value.slice(0, change.from) + change.insert + value.slice(change.to);
      history.record(
        serialize(value, ending(history.current.text)),
        mapIndentPosition(start, changes),
        mapIndentPosition(end, changes),
        '',
        direction,
      );
      apply(history.current);
      return;
    } else escapeTab = 0;
    if (
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      ['z', 'y'].includes(event.key.toLowerCase())
    ) {
      event.preventDefault();
      apply(event.key.toLowerCase() === 'y' || event.shiftKey ? history.redo() : history.undo());
    } else if (
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)
    )
      history.breakGroup();
  };
  const pointer = () => history.breakGroup();
  input.addEventListener('beforeinput', before);
  input.addEventListener('input', edited);
  input.addEventListener('keydown', keys);
  input.addEventListener('pointerdown', pointer);
  input.addEventListener('compositionstart', startComposition);
  input.addEventListener('compositionend', endComposition);
  return {
    replace(value, mode, selection) {
      const start = mode === 'replace' ? 0 : selection.start;
      const end = mode === 'replace' ? input.value.length : selection.end;
      history.capture(input.selectionStart, input.selectionEnd);
      const text =
        mode === 'replace'
          ? value
          : serialize(
              input.value.slice(0, start) + normalize(value) + input.value.slice(end),
              ending(history.current.text),
            );
      const caret = start + normalize(value).length;
      history.record(text, caret, caret);
      apply(history.current);
      input.focus();
    },
    sync(value) {
      if (history.current.text !== value) {
        input.value = value;
        history = new TextHistory(value);
      }
    },
    dispose() {
      input.removeEventListener('beforeinput', before);
      input.removeEventListener('input', edited);
      input.removeEventListener('keydown', keys);
      input.removeEventListener('pointerdown', pointer);
      input.removeEventListener('compositionstart', startComposition);
      input.removeEventListener('compositionend', endComposition);
    },
  };
}
