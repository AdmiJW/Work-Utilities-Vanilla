import { createStore } from './dom.js';

export const backgroundStatus = createStore({ mode: 'unverified', message: '' });

/** One current request per tool task; stale completions cannot overwrite newer input. */
export class BackgroundTask {
  constructor(kind, fallback) {
    this.kind = kind;
    this.fallback = fallback;
    this.sequence = 0;
    this.current = null;
  }

  cancel() {
    this.sequence++;
    if (!this.current) return;
    clearTimeout(this.current.startupTimer);
    this.current.worker?.terminate();
    if (this.current.url) URL.revokeObjectURL(this.current.url);
    this.current.reject(new DOMException('This operation was superseded.', 'AbortError'));
    this.current = null;
  }

  run(payload, progress = () => {}) {
    this.cancel();
    const sequence = this.sequence;
    return new Promise((resolve, reject) => {
      const current = { reject, worker: null, url: null };
      this.current = current;
      const finish = (error, value) => {
        if (sequence !== this.sequence || this.current !== current) return;
        clearTimeout(current.startupTimer);
        current.worker?.terminate();
        if (current.url) URL.revokeObjectURL(current.url);
        this.current = null;
        if (error) reject(error);
        else resolve(value);
      };
      const foreground = async () => {
        if (sequence !== this.sequence || this.current !== current) return;
        clearTimeout(current.startupTimer);
        current.worker?.terminate();
        if (current.url) URL.revokeObjectURL(current.url);
        current.worker = null;
        current.url = null;
        backgroundStatus.update({
          mode: 'foreground',
          message:
            'Background processing is unavailable. Large operations may temporarily slow the interface.',
        });
        await new Promise((resume) => setTimeout(resume, 30));
        if (sequence !== this.sequence) return;
        try {
          finish(null, await this.fallback(payload, progress));
        } catch (error) {
          finish(error);
        }
      };
      try {
        const source = globalThis.__WORK_UTILITIES_WORKERS__?.[this.kind];
        if (!source || typeof Worker !== 'function') {
          void foreground();
          return;
        }
        current.url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
        const worker = new Worker(current.url);
        current.worker = worker;
        worker.onmessage = ({ data }) => {
          if (sequence !== this.sequence) return;
          if (data.type === 'ready') {
            backgroundStatus.update({ mode: 'workers', message: '' });
            clearTimeout(current.startupTimer);
            worker.postMessage(payload);
          } else if (data.type === 'progress') progress(data.value);
          else if (data.type === 'error') finish(new Error(data.error));
          else finish(null, data.value);
        };
        worker.onerror = () => void foreground();
        current.startupTimer = setTimeout(() => void foreground(), 5000);
      } catch {
        void foreground();
      }
    });
  }
}
