import { WidgetType } from '@codemirror/view';

export class ImageWidget extends WidgetType {
  constructor(owner, parts, from, to, reading) {
    super();
    Object.assign(this, { owner, parts, from, to, reading });
  }
  eq(other) {
    return (
      this.owner === other.owner &&
      this.from === other.from &&
      this.to === other.to &&
      this.parts.url === other.parts.url &&
      this.parts.label === other.parts.label &&
      this.reading === other.reading
    );
  }
  toDOM() {
    return this.owner.imageDOM(this.parts, this.reading ? null : { from: this.from, to: this.to });
  }
  ignoreEvent() {
    return true;
  }
}
