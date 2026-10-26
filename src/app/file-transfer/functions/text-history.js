/** Bounded snapshots keep large imports undoable without native paste processing. */
export class TextHistory {
  constructor(text) {
    this.entries = [{ text, start: 0, end: 0 }];
    this.index = 0;
    this.group = '';
    this.recordedAt = 0;
  }
  get current() {
    return this.entries[this.index];
  }
  capture(start, end) {
    this.entries[this.index] = { ...this.current, start, end };
  }
  record(text, start, end, group = '') {
    if (text === this.current.text) {
      this.capture(start, end);
      return;
    }
    const now = Date.now();
    this.entries.splice(this.index + 1);
    if (group && group === this.group && now - this.recordedAt < 750 && this.index > 0)
      this.entries[this.index] = { text, start, end };
    else {
      this.entries.push({ text, start, end });
      this.index++;
    }
    this.group = group;
    this.recordedAt = now;
    let bytes = this.entries.reduce((count, item) => count + item.text.length * 2, 0);
    while (this.entries.length > 2 && (this.entries.length > 100 || bytes > 64 * 1024 * 1024)) {
      bytes -= this.entries[0].text.length * 2;
      this.entries.shift();
      this.index--;
    }
  }
  undo() {
    if (this.index > 0) this.index--;
    this.group = '';
    return this.current;
  }
  redo() {
    if (this.index < this.entries.length - 1) this.index++;
    this.group = '';
    return this.current;
  }
  breakGroup() {
    this.group = '';
  }
}
