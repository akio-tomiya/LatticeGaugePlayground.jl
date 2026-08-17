import('./simulation-worker-runtime.js?v=runtime-v20').catch(error => {
  const detail = error instanceof Error
    ? `${error.name}: ${error.message}\n${error.stack ?? ''}`
    : String(error);
  self.postMessage({
    type: 'error',
    stage: 'worker-import',
    detail,
  });
});
