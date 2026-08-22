import {
  createQueueState,
  selectCategory,
  nextIndex,
  previousIndex,
  formatTime,
} from './player-logic.mjs';
import {
  countPresenceState,
  formatListenerCount,
  isValidSupabaseConfig,
  isValidGaMeasurementId,
} from './presence-logic.mjs';

const PLAYLIST_ID = 'PLBSxfi3wN5KA';
const PRESENCE_CHANNEL = 'chhath-radio-listeners';
const siteConfig = window.CHATH_RADIO_CONFIG || {};

const els = {
  time: document.getElementById('live-time'),
  listenerCount: document.getElementById('listener-count'),
  status: document.getElementById('live-status'),
  title: document.getElementById('player-title'),
  artist: document.getElementById('player-artist'),
  art: document.getElementById('player-art'),
  play: document.getElementById('play-toggle'),
  previous: document.getElementById('prev-track'),
  next: document.getElementById('next-track'),
  progress: document.getElementById('progress'),
  elapsed: document.getElementById('elapsed'),
  duration: document.getElementById('duration'),
  supportOpen: document.getElementById('support-open'),
  supportClose: document.getElementById('support-close'),
  supportDialog: document.getElementById('support-dialog'),
};

let player = null;
let playerReady = false;
let progressTimer = null;
let queueState = selectCategory(createQueueState(30), 'Traditional');
let playbackState = 'cued';

let supabaseClient = null;
let listenerChannel = null;
let presenceReady = false;
let listenerTracked = false;

function updateClock() {
  if (!els.time) return;
  const now = new Date();
  els.time.textContent = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function setListenerCount(count) {
  if (!els.listenerCount) return;
  els.listenerCount.textContent = formatListenerCount(count);
}

function setListenerUnavailable() {
  if (!els.listenerCount) return;
  els.listenerCount.textContent = '— listening';
  els.listenerCount.title = 'Live listener count will appear after realtime setup is connected.';
}

function initAnalytics() {
  const measurementId = String(siteConfig.gaMeasurementId || '').trim();
  if (!isValidGaMeasurementId(measurementId)) return false;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
  return true;
}

function analyticsEvent(name, params = {}) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', name, params);
}

function createPresenceKey() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `listener-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function refreshPresenceCount() {
  if (!listenerChannel) return;
  const state = listenerChannel.presenceState();
  setListenerCount(countPresenceState(state));
}

async function trackListener() {
  if (!presenceReady || !listenerChannel || listenerTracked || playbackState !== 'playing') return;
  const response = await listenerChannel.track({
    listening: true,
    online_at: new Date().toISOString(),
  });
  if (response === 'ok') listenerTracked = true;
}

async function untrackListener() {
  if (!listenerChannel || !listenerTracked) return;
  try {
    await listenerChannel.untrack();
  } finally {
    listenerTracked = false;
  }
}

function initListenerPresence() {
  if (!isValidSupabaseConfig(siteConfig) || !window.supabase?.createClient) {
    setListenerUnavailable();
    return false;
  }

  supabaseClient = window.supabase.createClient(
    siteConfig.supabaseUrl,
    siteConfig.supabasePublishableKey,
  );

  listenerChannel = supabaseClient.channel(PRESENCE_CHANNEL, {
    config: {
      presence: { key: createPresenceKey() },
    },
  });

  listenerChannel
    .on('presence', { event: 'sync' }, refreshPresenceCount)
    .on('presence', { event: 'join' }, refreshPresenceCount)
    .on('presence', { event: 'leave' }, refreshPresenceCount)
    .subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;
      presenceReady = true;
      refreshPresenceCount();
      await trackListener();
    });

  return true;
}

function setPlayIcon(isPlaying) {
  if (!els.play) return;
  els.play.textContent = isPlaying ? 'Ⅱ' : '▶';
  els.play.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
}

function videoThumbnail(videoId) {
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : 'assets/chhath-background.png';
}

function updateMetadata() {
  if (!playerReady || !player) return;
  const data = player.getVideoData?.() || {};
  if (data.title && els.title) els.title.textContent = data.title;
  if (data.author && els.artist) els.artist.textContent = data.author;
  if (data.video_id && els.art) els.art.src = videoThumbnail(data.video_id);
}

function updateTimeline() {
  if (!playerReady || !player) return;
  const current = Number(player.getCurrentTime?.() || 0);
  const duration = Number(player.getDuration?.() || 0);

  if (els.elapsed) els.elapsed.textContent = formatTime(current);
  if (els.duration) els.duration.textContent = formatTime(duration);
  if (els.progress && duration > 0 && document.activeElement !== els.progress) {
    els.progress.value = String(Math.round((current / duration) * 1000));
  }
}

function syncQueueLength() {
  if (!playerReady || !player) return;
  const playlist = player.getPlaylist?.();
  if (!Array.isArray(playlist) || playlist.length === 0) return;
  const selected = queueState.category === 'All' ? 'Traditional' : queueState.category;
  queueState = selectCategory(createQueueState(playlist.length), selected);
}

function playPlaylistIndex(index) {
  if (!playerReady || !player || index == null) return;
  player.playVideoAt(index);
  setTimeout(updateMetadata, 250);
}

function playNextFromQueue() {
  const result = nextIndex(queueState);
  queueState = result.state;
  playPlaylistIndex(result.index);
}

function playPreviousFromQueue() {
  const result = previousIndex(queueState);
  queueState = result.state;
  playPlaylistIndex(result.index);
}

function handlePlayerReady(event) {
  playerReady = true;
  event.target.cuePlaylist({
    listType: 'playlist',
    list: PLAYLIST_ID,
    index: 0,
    startSeconds: 0,
  });
  if (els.status) els.status.textContent = 'Live';
  clearInterval(progressTimer);
  progressTimer = window.setInterval(() => {
    updateTimeline();
    updateMetadata();
    syncQueueLength();
  }, 700);
}

function handlePlayerStateChange(event) {
  if (!window.YT) return;
  const { PlayerState } = window.YT;
  if (event.data === PlayerState.PLAYING) {
    playbackState = 'playing';
    setPlayIcon(true);
    updateMetadata();
    trackListener();
    analyticsEvent('listen_start', { playlist_id: PLAYLIST_ID, category: queueState.category });
  } else if (event.data === PlayerState.PAUSED) {
    playbackState = 'paused';
    setPlayIcon(false);
    untrackListener();
    analyticsEvent('listen_pause', { playlist_id: PLAYLIST_ID });
  } else if (event.data === PlayerState.CUED) {
    playbackState = 'cued';
    setPlayIcon(false);
    untrackListener();
  } else if (event.data === PlayerState.ENDED) {
    playbackState = 'ended';
    untrackListener();
    playNextFromQueue();
  }
}

function initYouTubePlayer() {
  if (player || !window.YT?.Player) return;
  player = new window.YT.Player('youtube-player', {
    width: '200',
    height: '200',
    playerVars: {
      playsinline: 1,
      controls: 0,
      rel: 0,
      listType: 'playlist',
      list: PLAYLIST_ID,
    },
    events: {
      onReady: handlePlayerReady,
      onStateChange: handlePlayerStateChange,
      onError: () => {
        if (els.status) els.status.textContent = 'Open playlist';
        playbackState = 'error';
        untrackListener();
      },
    },
  });
}

window.onYouTubeIframeAPIReady = initYouTubePlayer;
if (window.YT?.Player) initYouTubePlayer();

els.play?.addEventListener('click', () => {
  if (!playerReady || !player) return;
  const state = player.getPlayerState?.();
  if (state === window.YT?.PlayerState?.PLAYING) {
    player.pauseVideo();
  } else {
    const playlist = player.getPlaylist?.();
    if (Array.isArray(playlist) && playlist.length && player.getPlaylistIndex?.() < 0) {
      playPlaylistIndex(queueState.queue[queueState.position] ?? 0);
    } else {
      player.playVideo();
    }
  }
});

els.previous?.addEventListener('click', playPreviousFromQueue);
els.next?.addEventListener('click', playNextFromQueue);

els.progress?.addEventListener('input', () => {
  if (!playerReady || !player) return;
  const duration = Number(player.getDuration?.() || 0);
  if (duration <= 0) return;
  const fraction = Number(els.progress.value) / 1000;
  const target = Math.max(0, Math.min(duration, duration * fraction));
  player.seekTo(target, true);
  if (els.elapsed) els.elapsed.textContent = formatTime(target);
});

document.querySelectorAll('.category-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    const category = chip.dataset.category;
    const playlist = playerReady ? player?.getPlaylist?.() : null;
    const length = Array.isArray(playlist) && playlist.length ? playlist.length : queueState.playlistLength || 30;
    queueState = selectCategory(createQueueState(length), category);

    document.querySelectorAll('.category-chip').forEach((button) => {
      button.classList.toggle('is-active', button === chip);
    });

    analyticsEvent('category_select', { category });

    if (playerReady && queueState.queue.length) {
      playPlaylistIndex(queueState.queue[0]);
    }
  });
});

els.supportOpen?.addEventListener('click', () => {
  analyticsEvent('support_open');
  if (els.supportDialog?.showModal) els.supportDialog.showModal();
});

els.supportClose?.addEventListener('click', () => {
  els.supportDialog?.close?.();
});

els.supportDialog?.addEventListener('click', (event) => {
  if (event.target === els.supportDialog) els.supportDialog.close();
});

window.addEventListener('pagehide', () => {
  untrackListener();
});

updateClock();
window.setInterval(updateClock, 30_000);
initAnalytics();
initListenerPresence();
