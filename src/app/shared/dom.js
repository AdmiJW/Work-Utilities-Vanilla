/** Build UI without interpreting SQL or imported values as HTML. */
export function element(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || (value === false && !key.startsWith('aria-')))
      continue;
    if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'className') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key in node && !key.startsWith('aria-') && key !== 'role') node[key] = value;
    else node.setAttribute(key, value === true && !key.startsWith('aria-') ? '' : String(value));
  }
  node.append(...children.flat(Infinity).filter((value) => value !== null && value !== undefined));
  return node;
}

export function button(label, action, attributes = {}) {
  return element('button', { type: 'button', onclick: action, ...attributes }, label);
}

export function clear(node, ...children) {
  node.replaceChildren(...children.flat(Infinity).filter(Boolean));
}

export function message(error, fallback = 'The operation could not be completed.') {
  return error instanceof Error ? error.message : fallback;
}

export function subscribeTo(store, listener) {
  store.addEventListener('change', listener);
  return () => store.removeEventListener('change', listener);
}

export function createStore(initial) {
  const store = new EventTarget();
  store.value = initial;
  store.update = (changes) => {
    store.value = { ...store.value, ...changes };
    store.dispatchEvent(new Event('change'));
  };
  return store;
}
