// TabSound Content Script
console.log('TabSound Content Script Injected');

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
    window.dispatchEvent(new CustomEvent('TabSoundVolumeChange', {
      detail: { volume: targetVolume }
    }));
  } catch (e) {}
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

try {
  // Capture media events (fastest and most accurate for media playback)
  document.addEventListener('play', applyVolume, true);
  document.addEventListener('playing', applyVolume, true);
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
} catch (e) {
  console.error("TabSound Observer Error:", e);
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SET_VOLUME') {
    targetVolume = message.volume;
    applyVolume();
    sendResponse({ success: true, newVolume: targetVolume });
  } else if (message.type === 'PING') {
    sendResponse({ pong: true, hasMedia: getMediaElements().length > 0 });
  }
});

// Initial application
applyVolume();
