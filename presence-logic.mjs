export function countPresenceState(state) {
  if (!state || typeof state !== 'object') return 0;
  return Object.values(state).reduce((total, presences) => {
    return total + (Array.isArray(presences) ? presences.length : 0);
  }, 0);
}

export function formatListenerCount(count) {
  const safe = Number.isFinite(Number(count)) ? Math.max(0, Math.floor(Number(count))) : 0;
  return `${safe} listening`;
}

export function shouldTrackListener(playbackState) {
  return playbackState === 'playing';
}

export function isValidSupabaseConfig(config = {}) {
  const url = String(config.supabaseUrl || '').trim();
  const key = String(config.supabasePublishableKey || '').trim();
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)
    && key.length >= 16
    && !/YOUR_|PLACEHOLDER/i.test(key);
}

export function isValidGaMeasurementId(value) {
  return /^G-[A-Z0-9]{6,}$/i.test(String(value || '').trim());
}
