// Hush Content Script
console.log('[Hush] Content Script Injected');

function getMediaElements() {
  return Array.from(document.querySelectorAll<HTMLMediaElement>('audio, video'));
}

// Keep track of the target volume for this tab
let targetVolume = 1.0;

function applyVolume() {
  const elements = getMediaElements();
  for (const el of elements) {
    if (el.volume !== targetVolume) {
      el.volume = targetVolume;
    }
  }
  
  try {
    window.dispatchEvent(new CustomEvent('HushVolumeChange', {
      detail: { volume: targetVolume }
    }));
  } catch {}
}

// Debounce helper
let timeoutId: number | null = null;
function debouncedApplyVolume() {
  if (timeoutId) return;
  timeoutId = window.setTimeout(() => {
    applyVolume();
    timeoutId = null;
  }, 500); // 500ms debounce
}

function notifyPlaybackState(isPlaying: boolean) {
  try {
    if (chrome.runtime?.id) {
      chrome.runtime.sendMessage({
        type: 'MEDIA_PLAYBACK_SIGNAL',
        playing: isPlaying,
        hasMedia: getMediaElements().length > 0,
      });
    }
  } catch {}
}

try {
  // Capture media events (fastest and most accurate for media playback)
  document.addEventListener('play', () => {
    applyVolume();
    notifyPlaybackState(true);
  }, true);
  document.addEventListener('playing', () => {
    applyVolume();
    notifyPlaybackState(true);
  }, true);
  document.addEventListener('pause', () => {
    const anyPlaying = getMediaElements().some(el => !el.paused && !el.ended);
    notifyPlaybackState(anyPlaying);
  }, true);
  document.addEventListener('ended', () => {
    const anyPlaying = getMediaElements().some(el => !el.paused && !el.ended);
    notifyPlaybackState(anyPlaying);
  }, true);
  document.addEventListener('loadstart', applyVolume, true);

  // Fallback mutation observer (lightweight)
  const observer = new MutationObserver((mutations) => {
    let shouldCheck = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        shouldCheck = true;
        break;
      }
    }
    if (shouldCheck) {
      debouncedApplyVolume();
    }
  });

  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    });
  }
} catch (err) {
  console.error('[Hush] Observer Error:', err);
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SET_VOLUME') {
    targetVolume = message.volume;
    applyVolume();
    sendResponse({ success: true, newVolume: targetVolume });
  } else if (message.type === 'PAUSE_MEDIA') {
    const elements = getMediaElements();
    elements.forEach(el => {
      try {
        if (!el.paused) el.pause();
      } catch {}
    });
    sendResponse({ success: true, count: elements.length });
  } else if (message.type === 'PING') {
    sendResponse({ pong: true, hasMedia: getMediaElements().length > 0 });
  }
});

// Initial application
applyVolume();
