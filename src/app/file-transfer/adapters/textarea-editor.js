import { TextHistory } from '../functions/text-history.js';

const normalize = (value) => value.replace(/\r\n?/g, '\n');
const ending = (value) => (value.includes('\r\n') ? '\r\n' : '\n');
const serialize = (value, lineEnding) => normalize(value).replaceAll('\n', lineEnding);

export function createTextareaEditor(input, changed, originalSource = input.value) {
  let history = new TextHistory(originalSource);
  const apply = (snapshot) => {
    input.value = snapshot.text;
    input.setSelectionRange(snapshot.start, snapshot.end);
    changed(snapshot.text);
  };
  const before = (event) => {
    if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
      event.preventDefault();
      apply(event.inputType === 'historyUndo' ? history.undo() : history.redo());
      return;
    }
    history.capture(input.selectionStart, input.selectionEnd);
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
    },
  };
}
