export class WorkspaceLock {
  constructor() {
    this.release = null;
    this.supported = typeof navigator.locks?.request === 'function';
  }

  async claim() {
    if (!this.supported) return true;
    return new Promise((resolve) => {
      void navigator.locks
        .request('work-utilities-vanilla-editor', { ifAvailable: true }, async (lock) => {
          if (!lock) {
            resolve(false);
            return;
          }
          resolve(true);
          await new Promise((release) => {
            this.release = release;
          });
        })
        .catch(() => {
          this.supported = false;
          resolve(true);
        });
    });
  }
}
