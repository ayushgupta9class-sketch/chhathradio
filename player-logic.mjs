export const CATEGORY_INDEXES = Object.freeze({
  'Traditional': [8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,0,1,2,3,4,5,6,7],
  'Sharda Sinha': [0,1,2,3,4,5,6,7],
  'Morning Arghya': [6,7,10,9,13,14,24,27],
  'Evening Arghya': [2,8,12,15,17,19,22,23,28],
  'Classics': [2,0,1,3,4,5,6,7,8,9,10,11,12,13,14,15,16],
});

export function createQueueState(playlistLength) {
  const safeLength = Math.max(0, Number.isFinite(playlistLength) ? Math.floor(playlistLength) : 0);
  return {
    playlistLength: safeLength,
    queue: Array.from({ length: safeLength }, (_, i) => i),
    position: 0,
    category: 'All',
  };
}

export function selectCategory(state, category) {
  const playlistLength = state.playlistLength ?? (state.queue.length ? Math.max(...state.queue) + 1 : 0);
  const source = CATEGORY_INDEXES[category] ?? Array.from({ length: playlistLength }, (_, i) => i);
  const queue = source.filter((index) => index >= 0 && index < playlistLength);
  return {
    ...state,
    queue,
    position: 0,
    category,
  };
}

export function nextIndex(state) {
  if (!state.queue.length) return { index: null, state };
  const position = (state.position + 1) % state.queue.length;
  return {
    index: state.queue[position],
    state: { ...state, position },
  };
}

export function previousIndex(state) {
  if (!state.queue.length) return { index: null, state };
  const position = (state.position - 1 + state.queue.length) % state.queue.length;
  return {
    index: state.queue[position],
    state: { ...state, position },
  };
}

export function formatTime(seconds) {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}
