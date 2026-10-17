/**
 * One Expo Router linking owner.
 *
 * Expo Router 6 keeps a module-level list of linking handlers and logs
 * "linking in multiple places" as soon as a second root mounts. On Android
 * that second mount is often the same app coming back: a Dev Client reload,
 * a confirmation/recovery return, or an activity handoff whose previous
 * effect never ran its cleanup. Those are not two navigators.
 *
 * Two handlers claimed in the same turn stay registered and are reported.
 * A handler left behind by an older turn is released so the new root is the
 * only listener. Auth links are not filtered here.
 */
const roots = [];
let batchSerial = 0;
let batchOpen = false;
let conflictReported = false;

let listenerSerial = 0;
let activeListener = 0;
let activeRemove = null;

function closeBatchSoon() {
  if (batchOpen) return;
  batchOpen = true;
  batchSerial += 1;
  const batch = batchSerial;
  queueMicrotask(() => {
    if (batchSerial === batch) batchOpen = false;
  });
}

function claimLinkingRoot() {
  closeBatchSoon();
  const root = { live: true, batch: batchSerial };
  roots.push(root);
  return root;
}

function releaseLinkingRoot(root) {
  if (!root || root.live === false) return;
  root.live = false;
  const index = roots.indexOf(root);
  if (index >= 0) roots.splice(index, 1);
  if (roots.filter((item) => item.live).length <= 1) conflictReported = false;
}

function evaluateLinkingRoots() {
  const live = roots.filter((root) => root.live);
  if (live.length <= 1) {
    conflictReported = false;
    return { conflict: false, reported: false, released: 0 };
  }
  const newest = Math.max(...live.map((root) => root.batch));
  let released = 0;
  for (const root of live) {
    if (root.batch !== newest) {
      releaseLinkingRoot(root);
      released += 1;
    }
  }
  const still = roots.filter((root) => root.live);
  if (still.length <= 1) {
    conflictReported = false;
    return { conflict: false, reported: false, released };
  }
  if (conflictReported) return { conflict: true, reported: false, released };
  conflictReported = true;
  return { conflict: true, reported: true, released };
}

function retainUrlSubscription(addListener) {
  const token = ++listenerSerial;
  if (typeof activeRemove === 'function') {
    const previous = activeRemove;
    activeRemove = null;
    activeListener = 0;
    previous.force = true;
    previous();
  }
  const subscription = addListener();
  const remove = () => {
    if (remove.done) return;
    if (!remove.force && activeListener !== token) return;
    remove.done = true;
    if (activeListener === token) {
      activeListener = 0;
      activeRemove = null;
    }
    subscription?.remove?.();
  };
  activeListener = token;
  activeRemove = remove;
  return remove;
}

function resetLinkingSessionForTests() {
  roots.splice(0, roots.length);
  batchSerial = 0;
  batchOpen = false;
  conflictReported = false;
  listenerSerial = 0;
  activeListener = 0;
  activeRemove = null;
}

module.exports = {
  claimLinkingRoot,
  releaseLinkingRoot,
  evaluateLinkingRoots,
  retainUrlSubscription,
  resetLinkingSessionForTests,
};
