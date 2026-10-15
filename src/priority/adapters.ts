import type { ControlCapabilities } from './types';

export interface AudioControlAdapter {
  setVolume(tabId: number, volume: number): Promise<{ success: boolean; fallbackUsed: boolean }>;
  pauseMedia(tabId: number): Promise<{ success: boolean }>;
  setMuted(tabId: number, muted: boolean): Promise<boolean>;
  detectCapabilities(tabId: number, url?: string): Promise<ControlCapabilities>;
}

export class ChromeTabAudioAdapter implements AudioControlAdapter {
  /**
   * Adjusts volume via content script and main-world Web Audio gain node.
   * If volume control is unsupported (e.g. restricted page), safely falls back to native tab muting.
   */
  async setVolume(tabId: number, volume: number): Promise<{ success: boolean; fallbackUsed: boolean }> {
    if (typeof chrome === 'undefined' || !chrome.tabs?.sendMessage) {
      return { success: true, fallbackUsed: false }; // Mock environment
    }

    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: 'SET_VOLUME', volume }, (response) => {
        if (chrome.runtime.lastError || !response?.success) {
          // Reliable volume control unavailable on this target; apply safe fallback if volume == 0
          if (volume <= 0.05) {
            chrome.tabs.update(tabId, { muted: true }, (tab) => {
              if (chrome.runtime.lastError || !tab) {
                resolve({ success: false, fallbackUsed: true });
              } else {
                resolve({ success: true, fallbackUsed: true });
              }
            });
          } else {
            // Cannot reliably duck to arbitrary percentage on restricted page
            resolve({ success: false, fallbackUsed: false });
          }
        } else {
          resolve({ success: true, fallbackUsed: false });
        }
      });
    });
  }

  async pauseMedia(tabId: number): Promise<{ success: boolean }> {
    if (typeof chrome === 'undefined' || !chrome.tabs?.sendMessage) {
      return { success: true };
    }

    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: 'PAUSE_MEDIA' }, (response) => {
        if (chrome.runtime.lastError || !response?.success) {
          // Fallback to mute
          chrome.tabs.update(tabId, { muted: true }, (tab) => {
            resolve({ success: Boolean(tab && !chrome.runtime.lastError) });
          });
        } else {
          resolve({ success: true });
        }
      });
    });
  }

  async setMuted(tabId: number, muted: boolean): Promise<boolean> {
    if (typeof chrome === 'undefined' || !chrome.tabs?.update) {
      return true;
    }

    return new Promise((resolve) => {
      chrome.tabs.update(tabId, { muted }, (tab) => {
        resolve(Boolean(tab && !chrome.runtime.lastError));
      });
    });
  }

  async detectCapabilities(tabId: number, url?: string): Promise<ControlCapabilities> {
    const isRestrictedUrl = Boolean(
      url && (
        url.startsWith('chrome://') ||
        url.startsWith('edge://') ||
        url.startsWith('chrome-extension://') ||
        url.startsWith('https://chromewebstore.google.com')
      )
    );

    if (isRestrictedUrl) {
      return {
        supportsVolume: false,
        supportsPause: false,
        isWebAudio: false,
        isHtml5Media: false,
      };
    }

    if (typeof chrome === 'undefined' || !chrome.tabs?.sendMessage) {
      return {
        supportsVolume: true,
        supportsPause: true,
        isWebAudio: true,
        isHtml5Media: true,
      };
    }

    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: 'PING' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          resolve({
            supportsVolume: false,
            supportsPause: false,
            isWebAudio: false,
            isHtml5Media: false,
          });
        } else {
          resolve({
            supportsVolume: true,
            supportsPause: true,
            isWebAudio: true,
            isHtml5Media: response.hasMedia || false,
          });
        }
      });
    });
  }
}

export const defaultAudioAdapter = new ChromeTabAudioAdapter();
