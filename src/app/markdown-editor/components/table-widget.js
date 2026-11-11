import {
  EditorState,
  EditorSelection,
  StateField,
  StateEffect,
  Transaction,
} from '@codemirror/state';
import { EditorView, WidgetType, Decoration, keymap, drawSelection } from '@codemirror/view';
import { defaultKeymap, undo, redo, isolateHistory } from '@codemirror/commands';
import { markdown, commonmarkLanguage } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { element } from '../../shared/dom.js';
import { openContextMenu } from '../../shared/context-menu.js';
import {
  tableChange,
  tableCell,
  materializeCell,
  markdownParser,
  linkParts,
} from '../functions/markdown.js';
import { renderInline, markdownText } from './inline-content.js';
import { ImageWidget } from './image-widget.js';
import { createInlineSourceMap } from './inline-source-map.js';
import { setCaret, visualEdge } from '../adapters/table-navigation.js';
import { CellProjection, prepareCellEdit } from '../functions/cell-projection.js';
import { cellPreview } from '../adapters/cell-preview.js';
import { liveEditing, allowHTML } from '../adapters/live-editing.js';

const controllers = new WeakMap();
const rebaseImages = StateEffect.define();
function textChange(before, after) {
  let from = 0,
    end = 0;
  while (from < before.length && from < after.length && before[from] === after[from]) from++;
  while (
    end < before.length - from &&
    end < after.length - from &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  )
    end++;
  return { from, to: before.length - end, insert: after.slice(from, after.length - end) };
}

class TableController {
  constructor(owner, model, reading) {
    this.owner = owner;
    this.model = model;
    this.reading = reading;
    owner.tables.add(this);
    this.active = null;
    this.cells = [];
    this.rendered = new WeakMap();
    this.dom = element('div', { className: 'md-table-widget', contentEditable: 'false' });
    this.table = element('table', { 'aria-label': 'Markdown table' });
    this.dom.append(element('div', { className: 'md-table-scroll' }, this.table));
    this.update(model, reading);
  }

  update(model, reading) {
    const previousModel = this.model;
    this.model = model;
    this.reading = reading;
    if (this.cells.length !== model.rows.length || this.cells[0]?.length !== model.columns) {
      const previous = this.active && { row: this.active.row, column: this.active.column };
      this.stop();
      this.table.replaceChildren();
      this.cells = model.rows.map((_row, r) => {
        const tr = element('tr');
        const cells = Array.from({ length: model.columns }, (_, c) => {
          const td = element(r === 0 ? 'th' : 'td', {
            tabIndex: reading ? undefined : 0,
            'aria-label': `Row ${r + 1}, column ${c + 1}`,
          });
          td.addEventListener('click', (event) => {
            if (event.target.closest('button')) return;
            const link = event.target.closest('a');
            if (link && (this.reading || event.ctrlKey || event.metaKey)) return;
            if (link) event.preventDefault();
            if (this.reading) return;
            if (this.active?.row === r && this.active.column === c) {
              if (this.active.view.dom.contains(event.target)) return;
              const hit = this.active.view.posAndSideAtCoords(
                { x: event.clientX, y: event.clientY },
                false,
              );
              if (hit) setCaret(this.active.view, EditorSelection.cursor(hit.pos, hit.assoc));
              this.active.view.focus();
              this.goalColumn = undefined;
              return;
            }
            const value = this.model.rows[r].cells[c]?.value ?? '';
            const position = this.rendered.get(td)?.mapping.hit(td, event, value.length) ?? 0;
            this.edit(r, c, { position });
          });
          td.addEventListener('keydown', (e) => {
            if (!this.reading && (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))) {
              this.menu(e, r, c);
              return;
            }
            if (e.target === td && !this.reading && (e.key === 'Enter' || e.key === 'F2')) {
              e.preventDefault();
              this.edit(r, c);
            }
          });
          td.addEventListener('contextmenu', (event) => this.menu(event, r, c));
          tr.append(td);
          return td;
        });
        this.table.append(tr);
        return cells;
      });
      if (previous && !reading)
        queueMicrotask(() => {
          if (this.dom.isConnected)
            this.edit(
              Math.min(previous.row, model.rows.length - 1),
              Math.min(previous.column, model.columns - 1),
            );
        });
    }
    for (let r = 0; r < model.rows.length; r++)
      for (let c = 0; c < model.columns; c++) {
        const td = this.cells[r][c];
        td.style.textAlign = model.align[c];
        td.tabIndex = reading ? -1 : 0;
        let value = model.rows[r].cells[c]?.value ?? '';
        if (this.active?.row === r && this.active?.column === c) {
          // Whitespace typed at a cell boundary belongs to the active editor, even
          // though Markdown parsing otherwise treats it as table padding.
          const current = this.active.projection.source;
          const previousRange = this.active.range;
          if (!this.writing && previousModel !== model && value === current.trim()) {
            const cell = tableCell(model, r, c, this.owner.outer.state.doc);
            const from = cell.from - current.match(/^\s*/)[0].length;
            if (
              from >= model.rows[r].from &&
              this.owner.outer.state.sliceDoc(from, from + current.length) === current
            )
              this.active.range = { from, to: from + current.length };
          }
          const range = this.active.range;
          if (
            !this.active.virtual &&
            range.to <= this.owner.outer.state.doc.length &&
            this.owner.outer.state.sliceDoc(range.from, range.to) === current
          ) {
            model.rows[r].cells[c] = { ...range, value: current };
            value = current;
          } else {
            const cell = tableCell(model, r, c, this.owner.outer.state.doc);
            this.active.range = { from: cell.from, to: cell.to };
            this.active.virtual = cell.virtual;
          }
          if (reading) this.stop();
          else if (this.active.projection.source !== value) {
            const view = this.active.view;
            const projection = new CellProjection(value);
            this.active.projection = projection;
            const selection = this.owner.outer.state.selection.main;
            const start = this.active.range.from;
            const inside = selection.from >= start && selection.to <= this.active.range.to;
            this.syncing = true;
            view.dispatch({
              changes: textChange(view.state.doc.toString(), projection.text),
              selection: inside
                ? projection.selection(selection.anchor - start, selection.head - start)
                : { anchor: Math.min(view.state.selection.main.head, projection.text.length) },
            });
            this.syncing = false;
          }
          if (
            this.active &&
            !this.writing &&
            (previousRange.from !== this.active.range.from ||
              previousRange.to !== this.active.range.to)
          ) {
            this.syncing = true;
            this.active.view.dispatch({ effects: rebaseImages.of(null) });
            this.syncing = false;
          }
        }
        if (
          !(this.active?.row === r && this.active?.column === c) &&
          (this.rendered.get(td)?.value !== value ||
            this.rendered.get(td)?.references !== this.owner.referenceVersion)
        ) {
          const mapping = createInlineSourceMap(markdownText);
          td.replaceChildren(
            renderInline(
              value,
              this.owner.references,
              (parts, range) =>
                this.owner.imageDOM(
                  parts,
                  this.reading
                    ? null
                    : {
                        from: model.rows[r].cells[c].from + range.from,
                        to: model.rows[r].cells[c].from + range.to,
                      },
                ),
              mapping,
            ),
          );
          this.rendered.set(td, { value, references: this.owner.referenceVersion, mapping });
        }
      }
  }

  stop() {
    if (!this.active) return;
    const { row, column, view } = this.active;
    this.active = null;
    if (this.owner.activeTable === this) this.owner.activeTable = null;
    view.destroy();
    const td = this.cells[row]?.[column];
    if (td) {
      td.replaceChildren();
      this.rendered.delete(td);
    }
  }

  menu(event, row, column) {
    if (this.reading) return;
    event.stopPropagation();
    this.edit(row, column);
    const trigger = this.active?.view.contentDOM ?? this.cells[row][column];
    this.closeMenu = openContextMenu(
      event,
      [
        ['Add row', 'add-row'],
        ['Remove row', 'remove-row'],
        ['Add column', 'add-column'],
        ['Remove column', 'remove-column'],
        ['Align left', 'left'],
        ['Align center', 'center'],
        ['Align right', 'right'],
      ].map(([label, operation]) => ({ label, action: () => this.operation(operation) })),
      trigger,
      'Table actions',
    );
  }

  highlight(selection) {
    for (let r = 0; r < this.cells.length; r++)
      for (let c = 0; c < this.cells[r].length; c++) {
        const range = this.model.rows[r]?.cells[c];
        this.cells[r][c].classList.toggle(
          'md-selected-cell',
          !!range && !selection.empty && range.from < selection.to && range.to > selection.from,
        );
      }
  }

  edit(row, column, options = {}) {
    if (this.reading || !this.dom.isConnected) return;
    if (!options.vertical) this.goalColumn = undefined;
    if (this.active?.row === row && this.active.column === column) {
      if (options.selection)
        this.active.view.dispatch({
          selection: this.active.projection.selection(
            options.selection.anchor,
            options.selection.head,
          ),
          annotations: Transaction.addToHistory.of(false),
        });
      this.active.view.focus();
      return;
    }
    if (this.owner.activeTable && this.owner.activeTable !== this)
      this.owner.activeTable.leave(false);
    this.stop();
    this.update(this.model, this.reading);
    const cell = tableCell(this.model, row, column, this.owner.outer.state.doc);
    const projection = new CellProjection(cell.value);
    const td = this.cells[row][column];
    td.replaceChildren();
    const host = element('div', { className: 'md-cell-editor' });
    td.append(host);
    const history = (redoing) => {
      (redoing ? redo : undo)(this.owner.outer);
      return true;
    };
    const parsedImages = new WeakMap();
    const images = (state) => {
      const ranges = [];
      if (!parsedImages.has(state.doc)) {
        const found = [];
        markdownParser.parse(state.doc.toString()).iterate({
          enter: (ref) => {
            if (ref.name !== 'Image') return;
            const parts = linkParts(
              ref.node,
              (from, to) => state.sliceDoc(from, to),
              this.owner.references,
            );
            found.push({ parts, from: ref.from, to: ref.to });
            return false;
          },
        });
        parsedImages.set(state.doc, found);
      }
      const offset = this.active?.range.from ?? cell.from;
      const map = this.active?.projection ?? projection;
      for (const { parts, from, to } of parsedImages.get(state.doc))
        ranges.push(
          Decoration.replace({
            widget: new ImageWidget(
              this.owner,
              parts,
              offset + map.toSource(from),
              offset + map.toSource(to),
              false,
            ),
          }).range(from, to),
        );
      return Decoration.set(ranges, true);
    };
    const imageField = StateField.define({
      create: images,
      update: (value, tr) =>
        tr.docChanged || tr.effects.some((e) => e.is(rebaseImages)) ? images(tr.state) : value,
      provide: (field) => [
        EditorView.decorations.from(field),
        EditorView.atomicRanges.of((view) => view.state.field(field)),
      ],
    });
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: projection.text,
        extensions: [
          markdown({ base: commonmarkLanguage, extensions: [GFM], completeHTMLTags: false }),
          imageField,
          cellPreview(),
          liveEditing(this.owner, true, () => this.syncing),
          drawSelection(),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({
            'aria-label': `Table row ${row + 1} column ${column + 1}`,
            spellcheck: 'true',
          }),
          EditorView.theme({}, { dark: this.owner.dark }),
          EditorState.transactionFilter.of((tr) => {
            if (!tr.docChanged || this.syncing) return tr;
            const value = tr.newDoc.toString();
            const result = prepareCellEdit(
              tr.startState.doc.toString(),
              value,
              tr.changes,
              tr.newSelection.main,
            );
            if (result.error) {
              this.owner.notify(result.error);
              return [];
            }
            return result.text === value
              ? tr
              : [
                  tr,
                  {
                    changes: textChange(value, result.text),
                    selection: result.selection,
                    sequential: true,
                  },
                ];
          }),
          keymap.of([
            { key: 'Mod-f', run: () => this.owner.find() },
            { key: 'Mod-h', run: () => this.owner.find(true) },
            { key: 'Mod-z', run: () => history(false), shift: () => history(true) },
            { key: 'Mod-y', run: () => history(true) },
            { key: 'ArrowUp', run: () => this.vertical(false) },
            { key: 'ArrowDown', run: () => this.vertical(true) },
            { key: 'ArrowLeft', run: () => this.horizontal(-1) },
            { key: 'ArrowRight', run: () => this.horizontal(1) },
            { key: 'Tab', run: () => this.move(1), shift: () => this.move(-1) },
            { key: 'Enter', run: () => this.down() },
            {
              key: 'Shift-Enter',
              run: () => {
                if (view.composing || view.compositionStarted) return false;
                const { from, to } = view.state.selection.main;
                view.dispatch({
                  changes: { from, to, insert: '\n' },
                  selection: { anchor: from + 1 },
                  annotations: isolateHistory.of('full'),
                  userEvent: 'input.cell-break',
                });
                return true;
              },
            },
            {
              key: 'Escape',
              run: () => {
                this.leave();
                this.owner.outer.setTabFocusMode(2000);
                return true;
              },
            },
            ...this.owner.formatKeys(),
            ...defaultKeymap,
          ]),
          EditorView.domEventHandlers({
            beforeinput: (event) => {
              if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
                event.preventDefault();
                history(event.inputType === 'historyRedo');
                return true;
              }
              return false;
            },
            paste: (event) => this.owner.paste(event),
            mousedown: () => {
              this.goalColumn = undefined;
              return false;
            },
            keydown: (event) => {
              if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
                this.goalColumn = undefined;
              return false;
            },
          }),
        ],
      }),
      dispatchTransactions: (transactions, nested) => {
        nested.update(transactions);
        if (this.syncing || !this.active) return;
        const range = this.active.range;
        if (!range) return;
        const selection = nested.state.selection.main;
        const changed = transactions.some((tr) => tr.docChanged);
        if (changed) this.goalColumn = undefined;
        const isolation = transactions.map((tr) => tr.annotation(isolateHistory)).find(Boolean);
        const userEvent =
          transactions.map((tr) => tr.annotation(Transaction.userEvent)).find(Boolean) ??
          'input.type';
        // Compose the real transactions, including sanitizer/code-split edits.
        let composed = transactions[0]?.changes;
        for (const tr of transactions.slice(1)) composed = composed.compose(tr.changes);
        const result = changed ? this.active.projection.apply(composed) : null;
        let changes =
          result?.edits.map((edit) => ({
            ...edit,
            from: range.from + edit.from,
            to: range.from + edit.to,
          })) ?? null;
        if (changed) this.active.projection = result.projection;
        const virtual = changed && this.active.virtual;
        if (virtual) {
          const created = materializeCell(
            this.model,
            row,
            column,
            this.owner.outer.state.doc,
            result.projection.source,
          );
          changes = [created.changes];
          this.active.range = created.range;
          this.active.virtual = false;
        } else if (changed)
          this.active.range = {
            from: range.from,
            to: range.from + result.projection.source.length,
          };
        const target = this.active.range;
        this.writing = true;
        try {
          this.owner.outer.dispatch({
            ...(changes ? { changes } : {}),
            selection: {
              anchor: target.from + this.active.projection.toSource(selection.anchor),
              head: target.from + this.active.projection.toSource(selection.head),
            },
            annotations: changed
              ? [
                  Transaction.userEvent.of(userEvent),
                  ...(isolation || this.fresh || userEvent === 'input.paste'
                    ? [
                        isolateHistory.of(
                          isolation ?? (userEvent === 'input.paste' ? 'full' : 'before'),
                        ),
                      ]
                    : []),
                ]
              : Transaction.addToHistory.of(false),
          });
        } finally {
          this.writing = false;
        }
        if (changed && this.active?.view === nested) {
          this.syncing = true;
          nested.dispatch({ effects: rebaseImages.of(null) });
          this.syncing = false;
        }
        if (changed) this.fresh = false;
      },
    });
    this.active = {
      row,
      column,
      view,
      projection,
      range: { from: cell.from, to: cell.to },
      virtual: cell.virtual,
    };
    this.fresh = true;
    this.owner.activeTable = this;
    view.focus();
    if (options.vertical) {
      this.goalColumn = undefined;
      const boundary = options.vertical.forward
        ? view.moveToLineBoundary(EditorSelection.cursor(0), true, true)
        : EditorSelection.cursor(view.state.doc.length, -1);
      setCaret(view, EditorSelection.cursor(boundary.head, boundary.assoc));
    } else if (options.selection) {
      view.dispatch({
        selection: projection.selection(options.selection.anchor, options.selection.head),
        annotations: Transaction.addToHistory.of(false),
      });
    } else if (options.position !== undefined) {
      this.goalColumn = undefined;
      setCaret(view, EditorSelection.cursor(projection.toEditor(options.position)));
    } else
      setCaret(
        view,
        EditorSelection.cursor(
          Math.max(0, Math.min(view.state.doc.length, options.editorPosition ?? 0)),
        ),
      );
  }

  vertical(forward) {
    const active = this.active,
      view = active?.view;
    if (!view || view.composing || view.compositionStarted || !view.state.selection.main.empty)
      return false;
    if (!visualEdge(view, forward)) return false;
    const selection = view.state.selection.main,
      coords = view.coordsAtPos(selection.head, selection.assoc || 1);
    const goal =
      this.goalColumn ??
      selection.goalColumn ??
      (coords?.left ?? view.contentDOM.getBoundingClientRect().left) -
        view.contentDOM.getBoundingClientRect().left;
    const row = active.row + (forward ? 1 : -1);
    if (row >= 0 && row < this.model.rows.length)
      this.edit(row, active.column, { vertical: { forward } });
    else {
      const outer = this.owner.outer,
        screenX = view.contentDOM.getBoundingClientRect().left + goal;
      const rect = this.dom.getBoundingClientRect(),
        edge = forward ? this.model.to : this.model.from;
      this.leave(false);
      const hit = outer.posAndSideAtCoords(
        {
          x: screenX,
          y: forward
            ? rect.bottom + outer.defaultLineHeight / 2
            : rect.top - outer.defaultLineHeight / 2,
        },
        false,
      );
      const fallback = forward ? Math.min(outer.state.doc.length, edge + 1) : Math.max(0, edge - 1);
      const pos =
        hit && !(hit.pos > this.model.from && hit.pos < this.model.to) ? hit.pos : fallback;
      setCaret(
        outer,
        EditorSelection.cursor(
          pos,
          hit?.assoc ?? (forward ? 1 : -1),
          undefined,
          screenX - outer.contentDOM.getBoundingClientRect().left,
        ),
      );
      outer.focus();
    }
    return true;
  }

  leave(focus = true) {
    const end = this.model.to;
    this.stop();
    this.update(this.model, this.reading);
    if (focus) {
      this.owner.paragraphAfter(end);
    }
  }

  insert(value, range, limited = false) {
    const active = this.active;
    if (!active) return false;
    const from = active.projection.toEditor(range.from - active.range.from, -1);
    const to = active.projection.toEditor(range.to - active.range.from, 1);
    const insert = value.replace(/\r\n?/g, '\n');
    const transaction = active.view.state.update({
      changes: { from, to, insert },
      selection: { anchor: from + insert.length },
      annotations: [isolateHistory.of('full'), allowHTML.of(true)],
      userEvent: 'input.paste',
    });
    if (!transaction.docChanged) return false;
    if (limited) {
      const result = active.projection.apply(transaction.changes);
      const edits = active.virtual
        ? [
            materializeCell(
              this.model,
              active.row,
              active.column,
              this.owner.outer.state.doc,
              result.projection.source,
            ).changes,
          ]
        : result.edits.map((edit) => ({
            ...edit,
            from: active.range.from + edit.from,
            to: active.range.from + edit.to,
          }));
      this.owner.validateInsertion(
        this.owner.outer.state.changes(edits).apply(this.owner.outer.state.doc).toString(),
      );
    }
    active.view.dispatch(transaction);
    active.view.focus();
    return true;
  }

  exit(forward) {
    const outer = this.owner.outer,
      doc = outer.state.doc;
    let number = doc.lineAt(forward ? this.model.to : this.model.from).number + (forward ? 1 : -1);
    let position = forward ? doc.length : 0;
    while (number > 0 && number <= doc.lines) {
      const line = doc.line(number);
      if (line.text.trim()) {
        position = forward ? line.from : line.to;
        break;
      }
      number += forward ? 1 : -1;
    }
    this.leave(false);
    if (forward && position === doc.length) {
      this.owner.paragraphAfter(this.model.to);
      return;
    }
    setCaret(outer, EditorSelection.cursor(position, forward ? 1 : -1));
    outer.focus();
  }

  horizontal(direction) {
    const view = this.active?.view;
    if (!view || view.composing || view.compositionStarted || !view.state.selection.main.empty)
      return false;
    const head = view.state.selection.main.head;
    if (direction > 0 ? head !== view.state.doc.length : head !== 0) return false;
    const next = this.active.row * this.model.columns + this.active.column + direction;
    if (next < 0 || next >= this.model.rows.length * this.model.columns) this.exit(direction > 0);
    else
      this.edit(Math.floor(next / this.model.columns), next % this.model.columns, {
        editorPosition: direction > 0 ? 0 : Infinity,
      });
    return true;
  }

  move(direction) {
    if (this.active?.view.composing || this.active?.view.compositionStarted) return false;
    const { row, column } = this.active;
    const next = row * this.model.columns + column + direction;
    if (next < 0) {
      this.exit(false);
      return true;
    }
    if (next >= this.model.rows.length * this.model.columns) {
      const r = this.model.rows.length;
      this.operation('add-row');
      queueMicrotask(() => this.edit(r, 0, { editorPosition: 0 }));
    } else
      this.edit(Math.floor(next / this.model.columns), next % this.model.columns, {
        selection: {
          anchor: 0,
          head:
            this.model.rows[Math.floor(next / this.model.columns)].cells[next % this.model.columns]
              ?.value.length ?? 0,
        },
      });
    return true;
  }

  down() {
    if (this.active?.view.composing || this.active?.view.compositionStarted) return false;
    const { row, column } = this.active;
    if (row + 1 < this.model.rows.length)
      this.edit(row + 1, column, { vertical: { forward: true } });
    else this.exit(true);
    return true;
  }

  operation(operation) {
    if (this.reading || this.active?.view.composing) return;
    const { row = 0, column = 0 } = this.active ?? {};
    this.owner.outer.dispatch({
      changes: tableChange(this.model, operation, row, column),
      annotations: isolateHistory.of('full'),
      userEvent: 'input',
    });
  }
}

export class TableWidget extends WidgetType {
  constructor(owner, model, reading) {
    super();
    this.owner = owner;
    this.model = model;
    this.reading = reading;
  }
  eq(other) {
    return (
      other.owner === this.owner && other.model === this.model && other.reading === this.reading
    );
  }
  toDOM() {
    const controller = new TableController(this.owner, this.model, this.reading);
    controllers.set(controller.dom, controller);
    return controller.dom;
  }
  updateDOM(dom) {
    controllers.get(dom).update(this.model, this.reading);
    return true;
  }
  ignoreEvent() {
    return true;
  }
  destroy(dom) {
    const controller = controllers.get(dom);
    controller?.closeMenu?.(false);
    controller?.stop();
    if (controller) this.owner.tables.delete(controller);
  }
}
