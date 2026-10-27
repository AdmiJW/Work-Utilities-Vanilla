import { createSidePanelLayout } from '../../shared/side-panel-layout.js';

export function createInspectorLayout(stage, main, options, remember) {
  return createSidePanelLayout(stage, main, {
    width: options.inspectorWidth,
    label: 'Resize cell inspector',
    changed: (inspectorWidth) => remember({ inspectorWidth }),
  });
}
