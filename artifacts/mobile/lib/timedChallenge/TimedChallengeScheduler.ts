export type TimedChallengeScheduler = {
  setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (handle: ReturnType<typeof setTimeout> | null) => void;
};

export const defaultTimedChallengeScheduler: TimedChallengeScheduler = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => {
    if (handle !== null) clearTimeout(handle);
  },
};
