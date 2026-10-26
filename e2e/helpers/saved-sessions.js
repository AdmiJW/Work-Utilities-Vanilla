async function seedSavedSessions(page, sessions) {
  await page.evaluate(
    (records) =>
      new Promise((resolve, reject) => {
        const opening = indexedDB.open('work-utilities-vanilla');
        opening.onerror = () =>
          reject(opening.error ?? new Error('Could not open fixture storage.'));
        opening.onsuccess = () => {
          const database = opening.result;
          const transaction = database.transaction(
            ['summaries', 'documents', 'preferences'],
            'readwrite',
          );
          for (const record of records) {
            const { source, options, missingDocument, ...summary } = record;
            transaction.objectStore('summaries').put({ ...summary, isOpen: false });
            if (!missingDocument)
              transaction.objectStore('documents').put({
                id: record.id,
                schemaVersion: 1,
                revision: 0,
                source,
                options: options ?? {},
              });
          }
          transaction.objectStore('preferences').put({
            key: 'workspace',
            value: {
              order: [],
              activeId: null,
              counters: { 'sql-formatter': 20, 'output-analyzer': 20 },
            },
          });
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onabort = () => {
            database.close();
            reject(transaction.error ?? new Error('Could not persist fixture sessions.'));
          };
        };
      }),
    sessions,
  );
}
export { seedSavedSessions };
