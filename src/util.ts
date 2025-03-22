export async function nextTick(fn: () => void) {
  Promise.resolve().then(fn);
}
