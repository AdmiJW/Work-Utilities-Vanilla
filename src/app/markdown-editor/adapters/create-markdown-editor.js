import { EditorState, StateField, StateEffect, Compartment, Transaction } from '@codemirror/state';
import { EditorView, keymap, drawSelection, lineNumbers } from '@codemirror/view';
import {
  history,
  historyKeymap,
  defaultKeymap,
  isolateHistory,
  invertedEffects,
} from '@codemirror/commands';
import { syntaxHighlighting, HighlightStyle, indentUnit } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { searchKeymap, closeSearchPanel } from '@codemirror/search';
import { markdown, commonmarkLanguage, markdownKeymap } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { sql, MSSQL } from '@codemirror/lang-sql';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { element, button } from '../../shared/dom.js';
import { normalize, tableCell } from '../functions/markdown.js';
import { readEmbeddedImage } from '../functions/images.js';
import { createPreviewField } from './preview.js';
import { markdownText } from '../components/inline-content.js';
import { enterTable } from './table-navigation.js';
import { createMarkdownSearch } from '../components/markdown-search.js';
import { applyIndentation } from '../../shared/indentation.js';
import { listIndentation } from '../functions/list-indentation.js';

const endingEffect = StateEffect.define(),
  refresh = StateEffect.define();
const ending = StateField.define({
  create: () => '\n',
  update: (value, tr) => tr.effects.find((e) => e.is(endingEffect))?.value ?? value,
});
const detectEnding = (value) => (value.includes('\r\n') ? '\r\n' : '\n');
const languages = {
  sql: sql({ dialect: MSSQL }),
  javascript: javascript(),
  typescript: javascript({ typescript: true }),
  json: json(),
  python: python(),
  html: html(),
  css: css(),
};
const aliases = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  htm: 'html',
  tsql: 'sql',
  mssql: 'sql',
};
const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--accent)' },
  { tag: [tags.string, tags.regexp], color: 'var(--json-string)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--json-literal)' },
  { tag: tags.comment, color: 'var(--muted)', fontStyle: 'italic' },
  { tag: tags.heading, fontWeight: 'bold' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.link, tags.url], color: 'var(--accent)' },
  { tag: [tags.typeName, tags.className, tags.attributeName], color: 'var(--json-literal)' },
  { tag: tags.invalid, textDecoration: 'underline wavy var(--json-literal)' },
]);

export function createMarkdownEditor(host, source, options, callbacks) {
  const modeConfig = new Compartment(),
    appearance = new Compartment();
  const bookmarks = new Set(),
    imageCache = new Map();
  const owner = {
    mode: ['live', 'source', 'reading'].includes(options.mode) ? options.mode : 'live',
    dark: options.dark,
    references: new Map(),
    referenceVersion: 0,
    activeTable: null,
    tables: new Set(),
    source,
    pruneImages: (urls) => {
      for (const url of imageCache.keys()) if (!urls.has(url)) imageCache.delete(url);
    },
    paste: (event) => callbacks.paste?.(event) ?? false,
    notify: (text) => callbacks.notify?.(text),
    validateInsertion: (source) => callbacks.validateInsertion?.(source),
    find: (replace = false) => find.open({ replace }),
    patch: (changes) =>
      owner.outer.dispatch({ changes, annotations: isolateHistory.of('full'), userEvent: 'input' }),
    formatKeys: () => [
      { key: 'Mod-b', run: () => format('bold') },
      { key: 'Mod-i', run: () => format('italic') },
      {
        key: 'Mod-k',
        run: () => {
          callbacks.link?.();
          return true;
        },
      },
    ],
    imageDOM: (parts, range) => {
      const wrapper = element('span', { className: 'md-image', contentEditable: 'false' });
      if (!imageCache.has(parts.url)) imageCache.set(parts.url, readEmbeddedImage(parts.url));
      const metadata = imageCache.get(parts.url);
      if (metadata) {
        const image = element('img', {
          src: parts.url,
          alt: markdownText(parts.label),
          width: metadata.width,
          height: metadata.height,
          loading: 'lazy',
        });
        image.addEventListener(
          'error',
          () =>
            image.replaceWith(
              element(
                'span',
                { className: 'md-image-placeholder' },
                `Image could not be decoded: ${parts.label}`,
              ),
            ),
          { once: true },
        );
        wrapper.append(image);
      } else
        wrapper.append(
          element(
            'span',
            { className: 'md-image-placeholder' },
            `Image unavailable offline${parts.label ? `: ${parts.label}` : ''}`,
          ),
        );
      if (range) {
        const tools = element('span', { className: 'md-image-tools' });
        for (const [label, action] of [
          ['Alt text', 'alt'],
          ['Replace image', 'replace'],
          ['Remove image', 'remove'],
        ]) {
          const control = button(label, () => callbacks.imageAction?.(action, parts, range), {
            'aria-label': label,
          });
          control.addEventListener('mousedown', (event) => event.preventDefault());
          tools.append(control);
        }
        wrapper.append(tools);
      }
      return wrapper;
    },
  };
  const find = createMarkdownSearch(owner, host, callbacks.searchChanged);
  const config = () => [
    EditorState.readOnly.of(owner.mode === 'reading'),
    EditorView.editable.of(owner.mode !== 'reading'),
    owner.mode === 'source' ? lineNumbers() : [],
    EditorView.contentAttributes.of({
      'aria-label': owner.mode === 'reading' ? 'Markdown reading view' : 'Markdown editor',
      spellcheck: owner.mode === 'source' ? 'false' : 'true',
    }),
  ];
  const preview = createPreviewField(owner);
  const length = normalize(source).length;
  const clamp = (p) => (Number.isInteger(p) ? Math.max(0, Math.min(length, p)) : 0);
  let alive = true;
  owner.outer = new EditorView({
    parent: host,
    dispatchTransactions: (transactions, view) => {
      const active = owner.activeTable?.active,
        focused = active?.view.hasFocus;
      view.update(transactions);
      const focusTarget = document.activeElement;
      if (
        focused &&
        (focusTarget === view.contentDOM ||
          focusTarget === view.dom ||
          focusTarget === document.body) &&
        owner.activeTable?.active === active &&
        active.view.dom.isConnected &&
        !active.view.hasFocus
      )
        active.view.focus();
    },
    state: EditorState.create({
      doc: normalize(source),
      selection: {
        anchor: clamp(options.selection?.anchor),
        head: clamp(options.selection?.head ?? options.selection?.anchor),
      },
      extensions: [
        ending.init(() => detectEnding(source)),
        invertedEffects.of((tr) =>
          tr.effects.some((e) => e.is(endingEffect))
            ? [endingEffect.of(tr.startState.field(ending))]
            : [],
        ),
        markdown({
          base: commonmarkLanguage,
          extensions: [GFM],
          completeHTMLTags: false,
          codeLanguages: (name) =>
            languages[aliases[name.toLowerCase()] ?? name.toLowerCase()]?.language ?? null,
        }),
        syntaxHighlighting(highlight),
        indentUnit.of('    '),
        EditorState.tabSize.of(4),
        history(),
        drawSelection(),
        EditorView.lineWrapping,
        modeConfig.of(config()),
        appearance.of(EditorView.theme({}, { dark: owner.dark })),
        preview,
        find.extension,
        keymap.of([
          { key: 'Tab', run: (view) => indent(view, false), shift: (view) => indent(view, true) },
          { key: 'Mod-]', run: (view) => indent(view, false) },
          { key: 'Mod-[', run: (view) => indent(view, true) },
          { key: 'ArrowUp', run: () => enterTable(owner, false) },
          { key: 'ArrowDown', run: () => enterTable(owner, true) },
          ...owner.formatKeys(),
          ...markdownKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...defaultKeymap,
        ]),
        EditorView.domEventHandlers({
          paste: (event) => owner.paste(event),
          mousedown: (_event) => {
            if (owner.activeTable) owner.activeTable.leave(false);
            return false;
          },
          click: (event) => {
            const link = event.target.closest?.('[data-url]');
            if (link && (owner.mode === 'reading' || event.ctrlKey || event.metaKey)) {
              window.open(link.dataset.url, '_blank', 'noopener,noreferrer');
              return true;
            }
            return false;
          },
          keydown: (event) => {
            const link = event.target.closest?.('[data-url]');
            if (link && event.key === 'Enter') {
              window.open(link.dataset.url, '_blank', 'noopener,noreferrer');
              return true;
            }
            return false;
          },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged || update.selectionSet)
            for (const table of owner.tables) table.highlight(update.state.selection.main);
          for (const tr of update.transactions)
            for (const mark of bookmarks) {
              const collapsed = mark.from === mark.to;
              mark.from = tr.changes.mapPos(mark.from, 1);
              mark.to = tr.changes.mapPos(mark.to, collapsed ? 1 : -1);
              if (mark.to < mark.from) mark.to = mark.from;
            }
          if (
            update.docChanged ||
            update.transactions.some((tr) => tr.effects.some((e) => e.is(endingEffect)))
          ) {
            owner.source = update.state.doc.toString().replaceAll('\n', update.state.field(ending));
            callbacks.changed(owner.source);
          }
          if (update.selectionSet)
            callbacks.viewChanged({
              selection: {
                anchor: update.state.selection.main.anchor,
                head: update.state.selection.main.head,
              },
            });
        }),
      ],
    }),
  });
  owner.outer.scrollDOM.scrollTop = options.scrollTop ?? 0;
  function indent(view, outdent) {
    if (view.state.readOnly || view.composing || view.compositionStarted) return false;
    const result = listIndentation(view.state, outdent);
    if (result.error) {
      owner.notify(result.error);
      return true;
    }
    return applyIndentation(view, outdent, result.changes);
  }
  const scroll = () => callbacks.viewChanged({ scrollTop: owner.outer.scrollDOM.scrollTop });
  owner.outer.scrollDOM.addEventListener('scroll', scroll);

  function format(command, value) {
    if (owner.mode === 'reading') return false;
    const view = owner.activeTable?.active?.view ?? owner.outer;
    if (owner.activeTable && !['bold', 'italic', 'strike', 'code', 'link'].includes(command))
      return false;
    const { from, to } = view.state.selection.main,
      selected = view.state.sliceDoc(from, to);
    const pairs = {
      bold: ['**', '**', 'bold'],
      italic: ['*', '*', 'italic'],
      strike: ['~~', '~~', 'text'],
      code: ['`', '`', 'code'],
      link: ['[', `](${value ?? 'https://example.com'})`, 'link'],
    };
    let changes, selection;
    if (pairs[command]) {
      const [before, after, placeholder] = pairs[command],
        text = selected || placeholder;
      if (
        selected.startsWith(before) &&
        selected.endsWith(after) &&
        selected.length >= before.length + after.length &&
        command !== 'link'
      ) {
        const insert = selected.slice(before.length, -after.length);
        changes = { from, to, insert };
        selection = { anchor: from, head: from + insert.length };
      } else {
        changes = { from, to, insert: before + text + after };
        selection = { anchor: from + before.length, head: from + before.length + text.length };
      }
    } else if (command === 'table' || command === 'fence' || command === 'divider') {
      const insert = {
        table: '\n| Column 1 | Column 2 |\n| --- | --- |\n|  |  |\n',
        fence: `\n\`\`\`\n${selected}\n\`\`\`\n`,
        divider: '\n\n---\n\n',
      }[command];
      changes = { from, to, insert };
      selection = { anchor: from + insert.length };
    } else {
      const first = view.state.doc.lineAt(from),
        last = view.state.doc.lineAt(to);
      const prefix = {
        heading: '#'.repeat(Math.max(1, Math.min(6, Number(value) || 1))) + ' ',
        bullet: '- ',
        numbered: '1. ',
        task: '- [ ] ',
        quote: '> ',
      }[command];
      if (!prefix) return false;
      const text = view.state
        .sliceDoc(first.from, last.to)
        .split('\n')
        .map((line) => prefix + (command === 'heading' ? line.replace(/^#{1,6}\s+/, '') : line))
        .join('\n');
      changes = { from: first.from, to: last.to, insert: text };
      selection = { anchor: first.from, head: first.from + text.length };
    }
    view.dispatch({
      changes,
      selection,
      annotations: isolateHistory.of('full'),
      userEvent: 'input',
    });
    view.focus();
    return true;
  }

  return {
    owner,
    editor: owner.outer,
    text: () => owner.source,
    serialized: (value) => normalize(value).replaceAll('\n', owner.outer.state.field(ending)),
    format,
    get reading() {
      return owner.mode === 'reading';
    },
    get cellActive() {
      return !!owner.activeTable;
    },
    selection() {
      const r = owner.outer.state.selection.main;
      return { from: r.from, to: r.to };
    },
    bookmark(range = this.selection()) {
      const mark = { ...range, valid: true };
      bookmarks.add(mark);
      return mark;
    },
    release(mark) {
      bookmarks.delete(mark);
      mark.valid = false;
    },
    replace(value, adoptEnding = true) {
      imageCache.clear();
      for (const mark of bookmarks) mark.valid = false;
      owner.activeTable?.leave(false);
      owner.outer.dispatch({
        changes: { from: 0, to: owner.outer.state.doc.length, insert: normalize(value) },
        effects: adoptEnding ? endingEffect.of(detectEnding(value)) : [],
        selection: { anchor: 0 },
        annotations: isolateHistory.of('full'),
      });
    },
    insert(value, range = this.selection(), limited = false) {
      if (!alive || range.valid === false || owner.mode === 'reading') return false;
      const cell = owner.activeTable?.active?.range;
      if (cell && range.from >= cell.from && range.to <= cell.to) {
        return owner.activeTable.insert(value, range, limited);
      }
      if (owner.mode === 'live')
        for (const table of owner.tables)
          for (let r = 0; r < table.model.rows.length; r++)
            for (let c = 0; c < table.model.columns; c++) {
              const target = tableCell(table.model, r, c, owner.outer.state.doc);
              if (range.from >= target.from && range.to <= target.to) {
                table.edit(r, c, {
                  selection: { anchor: range.from - target.from, head: range.to - target.from },
                });
                return table.insert(value, range, limited);
              }
            }
      if (limited)
        owner.validateInsertion(
          owner.outer.state.sliceDoc(0, range.from) +
            normalize(value) +
            owner.outer.state.sliceDoc(range.to),
        );
      owner.activeTable?.leave(false);
      owner.outer.dispatch({
        changes: { from: range.from, to: range.to, insert: normalize(value) },
        selection: { anchor: range.from + normalize(value).length },
        annotations: isolateHistory.of('full'),
        scrollIntoView: true,
        userEvent: 'input',
      });
      owner.outer.focus();
      return true;
    },
    setMode(mode) {
      if (mode === owner.mode) return;
      const composing = owner.activeTable?.active?.view ?? owner.outer;
      if (composing.composing) {
        composing.contentDOM.addEventListener(
          'compositionend',
          () => {
            if (alive) this.setMode(mode);
          },
          { once: true },
        );
        return;
      }
      owner.activeTable?.leave(false);
      closeSearchPanel(owner.outer);
      owner.mode = mode;
      owner.outer.dispatch({
        effects: [modeConfig.reconfigure(config()), refresh.of(null)],
        annotations: Transaction.addToHistory.of(false),
      });
    },
    setTheme(dark) {
      if (dark === owner.dark) return;
      owner.dark = dark;
      owner.outer.dispatch({ effects: appearance.reconfigure(EditorView.theme({}, { dark })) });
    },
    find() {
      find.toggle();
    },
    focus() {
      owner.outer.focus();
      owner.outer.requestMeasure();
    },
    dispose() {
      alive = false;
      for (const mark of bookmarks) mark.valid = false;
      bookmarks.clear();
      find.dispose();
      owner.outer.scrollDOM.removeEventListener('scroll', scroll);
      owner.outer.destroy();
      imageCache.clear();
    },
  };
}
