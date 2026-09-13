(async () => {
  const injectTime = performance.now();
  const { onExecute } = await import(chrome.runtime.getURL('dist/assets/index.tsx.js'));
  onExecute?.({ perf: { injectTime, loadTime: performance.now() - injectTime } });
})().catch(console.error);
