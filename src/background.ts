import { classifyUrl, type Category, CATEGORIES } from './classifier';

console.log('[Hush] Service Worker Initialized');

function cleanupDeadTabs() {
  chrome.tabs.query({}, (tabs) => {
    const activeTabIds = new Set(tabs.map(t => t.id));
    chrome.storage.local.get(['tabVolumes'], (state) => {
      if (!state.tabVolumes) return;
      let hasChanges = false;
      const newTabVolumes: Record<number, number> = Object.assign({}, state.tabVolumes as Record<number, number>);
      for (const tabIdStr in newTabVolumes) {
        if (!activeTabIds.has(Number(tabIdStr))) {
          delete newTabVolumes[tabIdStr];
          hasChanges = true;
        }
      }
      if (hasChanges) {
        chrome.storage.local.set({ tabVolumes: newTabVolumes });
      }
    });
  });
}

chrome.runtime.onStartup.addListener(cleanupDeadTabs);
chrome.runtime.onInstalled.addListener(cleanupDeadTabs);

interface AppState {
  tabVolumes: Record<number, number>;
  groupVolumes: Record<Category, number>;
  categoryOverrides: Record<string, Category>;
}

const defaultState: AppState = {
  tabVolumes: {},
  groupVolumes: {
    [CATEGORIES.ENTERTAINMENT]: 1.0,
    [CATEGORIES.STUDY]: 1.0,
    [CATEGORIES.WORK]: 1.0,
    [CATEGORIES.COMMUNICATION]: 1.0,
    [CATEGORIES.UNKNOWN]: 1.0,
    [CATEGORIES.MUSIC]: 1.0,
    [CATEGORIES.SOCIAL]: 1.0,
    [CATEGORIES.GAMING]: 1.0,
  },
  categoryOverrides: {}
};

chrome.storage.local.get(['tabVolumes', 'groupVolumes', 'categoryOverrides'], (res) => {
  if (!res.groupVolumes) {
    chrome.storage.local.set(defaultState);
  }
});

function applyEffectiveVolume(tabId: number, callback?: (success: boolean) => void) {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab) {
      if (callback) callback(false);
      return;
    }
    
    chrome.storage.local.get(['tabVolumes', 'groupVolumes', 'categoryOverrides'], (state) => {
      const categoryOverrides = (state.categoryOverrides || {}) as Record<string, Category>;
      const category = classifyUrl(tab.url, categoryOverrides);
      
      const tabVolumes = (state.tabVolumes || {}) as Record<number, number>;
      const groupVolumes = (state.groupVolumes || defaultState.groupVolumes) as Record<Category, number>;
      
      const tVol = tabVolumes[tabId] ?? 1.0;
      const gVol = groupVolumes[category] ?? 1.0;
      const effectiveVolume = tVol * gVol;
      
      chrome.tabs.sendMessage(tabId, { type: 'SET_VOLUME', volume: effectiveVolume }, () => {
        if (chrome.runtime.lastError) {
          if (callback) callback(false);
        } else {
          if (callback) callback(true);
        }
      });
    });
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SET_TAB_VOLUME') {
    const { tabId, volume } = message;
    chrome.storage.local.get(['tabVolumes'], (state) => {
      const tabVolumes = (state.tabVolumes || {}) as Record<number, number>;
      tabVolumes[tabId] = volume;
      chrome.storage.local.set({ tabVolumes }, () => {
        applyEffectiveVolume(tabId, (success) => {
          sendResponse({ success });
        });
      });
    });
    return true;
  }
  
  if (message.type === 'SET_GROUP_VOLUME') {
    const { category, volume } = message;
    chrome.storage.local.get(['groupVolumes', 'categoryOverrides'], (state) => {
      const groupVolumes = (state.groupVolumes || defaultState.groupVolumes) as Record<Category, number>;
      const categoryOverrides = (state.categoryOverrides || {}) as Record<string, Category>;
      groupVolumes[category as Category] = volume;
      chrome.storage.local.set({ groupVolumes }, () => {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            if (tab.id && classifyUrl(tab.url, categoryOverrides) === category) {
              applyEffectiveVolume(tab.id);
            }
          });
        });
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (message.type === 'APPLY_FOCUS_MODE') {
    const { volumes, mutedCategories } = message;
    chrome.storage.local.get(['groupVolumes', 'categoryOverrides'], (state) => {
      const groupVolumes = (state.groupVolumes || defaultState.groupVolumes) as Record<Category, number>;
      const categoryOverrides = (state.categoryOverrides || {}) as Record<string, Category>;
      const newGroupVolumes: Record<Category, number> = Object.assign({}, groupVolumes, (volumes || {}) as Partial<Record<Category, number>>);
      chrome.storage.local.set({ groupVolumes: newGroupVolumes }, () => {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            if (tab.id) {
              const cat = classifyUrl(tab.url, categoryOverrides);
              if (mutedCategories && mutedCategories.includes(cat)) {
                chrome.tabs.update(tab.id, { muted: true });
              } else if (mutedCategories) {
                chrome.tabs.update(tab.id, { muted: false });
              }
              applyEffectiveVolume(tab.id);
            }
          });
        });
        sendResponse({ success: true });
      });
    });
    return true;
  }
  
  if (message.type === 'OVERRIDE_TAB_CATEGORY') {
    const { url, category } = message;
    if (url) {
      try {
        const hostname = new URL(url).hostname.replace('www.', '');
        chrome.storage.local.get(['categoryOverrides'], (state) => {
          const categoryOverrides = (state.categoryOverrides || {}) as Record<string, Category>;
          categoryOverrides[hostname] = category;
          chrome.storage.local.set({ categoryOverrides }, () => {
            chrome.tabs.query({}, (tabs) => {
              tabs.forEach(tab => {
                 if (tab.url && tab.id) {
                   try {
                     if (new URL(tab.url).hostname.replace('www.', '') === hostname) {
                       applyEffectiveVolume(tab.id);
                     }
                   } catch {}
                 }
              });
            });
            sendResponse({ success: true });
          });
        });
      } catch {
        sendResponse({ success: false });
      }
    }
    return true;
  }

  if (message.type === 'GET_STATE') {
    chrome.storage.local.get(['tabVolumes', 'groupVolumes', 'categoryOverrides'], (state) => {
      sendResponse({
        tabVolumes: state.tabVolumes || {},
        groupVolumes: state.groupVolumes || defaultState.groupVolumes,
        categoryOverrides: state.categoryOverrides || {}
      });
    });
    return true;
  }
  
  if (message.type === 'ORGANIZE_TABS') {
    chrome.tabs.query({ currentWindow: true }, async (tabs) => {
      try {
        const { categoryOverrides } = await chrome.storage.local.get(['categoryOverrides']);
        const overrides = (categoryOverrides || {}) as Record<string, Category>;
        
        const existingGroups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
        const categoryToGroupId: Partial<Record<Category, number>> = {};
        
        existingGroups.forEach(g => {
          if (g.title && Object.values(CATEGORIES).includes(g.title as Category)) {
            categoryToGroupId[g.title as Category] = g.id;
          }
        });

        const groups: Partial<Record<Category, number[]>> = {};
        
        tabs.forEach(tab => {
          if (!tab.id || tab.pinned) return; 
          
          if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
            const group = existingGroups.find(g => g.id === tab.groupId);
            if (group && !Object.values(CATEGORIES).includes(group.title as Category)) {
              return;
            }
          }

          const cat = classifyUrl(tab.url, overrides);
          if (!groups[cat]) groups[cat] = [];
          groups[cat]!.push(tab.id);
        });

        const CATEGORY_COLORS: Record<string, string> = {
          [CATEGORIES.ENTERTAINMENT]: 'red',
          [CATEGORIES.STUDY]: 'green',
          [CATEGORIES.WORK]: 'blue',
          [CATEGORIES.COMMUNICATION]: 'purple',
          [CATEGORIES.MUSIC]: 'pink',
          [CATEGORIES.SOCIAL]: 'cyan',
          [CATEGORIES.GAMING]: 'yellow',
          [CATEGORIES.UNKNOWN]: 'grey',
        };

        for (const [catStr, tabIds] of Object.entries(groups)) {
          const category = catStr as Category;
          if (tabIds.length > 0) {
            try {
              let groupId = categoryToGroupId[category];
              if (groupId !== undefined) {
                await chrome.tabs.group({ tabIds: tabIds as any, groupId });
              } else {
                groupId = await chrome.tabs.group({ tabIds: tabIds as any });
                await chrome.tabGroups.update(groupId, {
                  title: category,
                  color: (CATEGORY_COLORS as any)[category] || 'grey'
                });
              }
            } catch (e) {
              console.error("Failed to group tabs for category:", category, e);
            }
          }
        }
        sendResponse({ success: true });
      } catch (e) {
        console.error("Smart Organize Error:", e);
        sendResponse({ success: false });
      }
    });
    return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.get(['tabVolumes'], (state) => {
    const tabVolumes = (state.tabVolumes || {}) as Record<number, number>;
    if (tabVolumes[tabId] !== undefined) {
      delete tabVolumes[tabId];
      chrome.storage.local.set({ tabVolumes });
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    applyEffectiveVolume(tabId);
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-mute') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id) {
        const tab = tabs[0];
        chrome.tabs.update(tab.id, { muted: !tab.mutedInfo?.muted });
      }
    });
  }
});
