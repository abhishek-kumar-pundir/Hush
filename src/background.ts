import { CATEGORIES, classifyUrl, type Category } from './classifier';
import { priorityCoordinator } from './priority/coordinator';

console.log('[Hush] Service Worker Initialized');
priorityCoordinator.initialize().catch(err => {
  console.error('[Hush] Priority coordinator init error:', err);
});

export type TabGroupColor = 'grey' | 'blue' | 'red' | 'yellow' | 'green' | 'pink' | 'purple' | 'cyan' | 'orange';

export const CATEGORY_COLORS: Record<string, TabGroupColor> = {
  [CATEGORIES.ENTERTAINMENT]: 'red',
  [CATEGORIES.STUDY]: 'green',
  [CATEGORIES.WORK]: 'blue',
  [CATEGORIES.COMMUNICATION]: 'purple',
  [CATEGORIES.MUSIC]: 'pink',
  [CATEGORIES.SOCIAL]: 'cyan',
  [CATEGORIES.GAMING]: 'yellow',
  [CATEGORIES.OTHER]: 'grey',
  'Unknown': 'grey',
};

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
    [CATEGORIES.OTHER]: 1.0,
    [CATEGORIES.MUSIC]: 1.0,
    [CATEGORIES.SOCIAL]: 1.0,
    [CATEGORIES.GAMING]: 1.0,
  },
  categoryOverrides: {}
};

chrome.storage.local.get(['tabVolumes', 'groupVolumes', 'categoryOverrides'], (res: Record<string, any>) => {
  if (!res.groupVolumes) {
    chrome.storage.local.set(defaultState);
  } else {
    const gv = (res.groupVolumes || {}) as Record<string, number>;
    if (gv['Unknown'] !== undefined && gv[CATEGORIES.OTHER] === undefined) {
      const updated = Object.assign({}, gv, { [CATEGORIES.OTHER]: gv['Unknown'] });
      chrome.storage.local.set({ groupVolumes: updated });
    }
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
    priorityCoordinator.handleManualVolumeChange(tabId, volume);
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
    const { url, category, tabId } = message;
    if (url) {
      try {
        const hostname = new URL(url).hostname.replace('www.', '');
        chrome.storage.local.get(['categoryOverrides'], async (state) => {
          const categoryOverrides = (state.categoryOverrides || {}) as Record<string, Category>;
          categoryOverrides[hostname] = category;
          await chrome.storage.local.set({ categoryOverrides });

          // Synchronize Chrome native tab group
          chrome.tabs.query({}, async (tabs) => {
            const matchingTabs = tabs.filter(tab => {
              if (!tab.url) return false;
              try {
                return new URL(tab.url).hostname.replace('www.', '') === hostname;
              } catch {
                return false;
              }
            });

            // Update effective volumes
            matchingTabs.forEach(tab => {
              if (tab.id) applyEffectiveVolume(tab.id);
            });

            // Move the dragged tab (or matching tabs) in Chrome native tab groups
            const targetTabIds: number[] = tabId
              ? [tabId]
              : matchingTabs.map(t => t.id!).filter(Boolean);

            if (targetTabIds.length > 0) {
              try {
                if (category === CATEGORIES.OTHER) {
                  const groupedIds = targetTabIds.filter(id => {
                    const t = tabs.find(tab => tab.id === id);
                    return t && t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE;
                  });
                  if (groupedIds.length > 0) {
                    await chrome.tabs.ungroup(groupedIds as [number, ...number[]]);
                  }
                } else {
                  // Get windowId of the target tab
                  const firstTab = tabs.find(t => t.id === targetTabIds[0]);
                  const winId = firstTab?.windowId;
                  if (winId !== undefined) {
                    const existingGroups = await chrome.tabGroups.query({ windowId: winId });
                    const matchGroup = existingGroups.find(
                      g => g.title?.trim().toLowerCase() === category.toLowerCase()
                    );
                    if (matchGroup) {
                      await chrome.tabs.group({ tabIds: targetTabIds as any, groupId: matchGroup.id });
                    } else {
                      const newGid = await chrome.tabs.group({ tabIds: targetTabIds as any });
                      await chrome.tabGroups.update(newGid, {
                        title: category,
                        color: CATEGORY_COLORS[category] || 'grey'
                      });
                    }
                  }
                }
              } catch (e) {
                console.error("Failed to sync native tab group on override:", e);
              }
            }

            sendResponse({ success: true });
          });
        });
      } catch {
        sendResponse({ success: false });
      }
    }
    return true;
  }

  if (message.type === 'RESET_ALL_TABS') {
    chrome.tabs.query({ currentWindow: true }, async (tabs) => {
      try {
        // 1. Ungroup all grouped tabs in current window
        const groupedTabIds = tabs
          .filter(t => t.id && t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE)
          .map(t => t.id!);

        if (groupedTabIds.length > 0) {
          try {
            await chrome.tabs.ungroup(groupedTabIds as [number, ...number[]]);
          } catch (e) {
            console.error("Failed to ungroup tabs:", e);
          }
        }

        // 2. Set all currently open tab hostnames to CATEGORIES.OTHER
        const newOverrides: Record<string, Category> = {};
        tabs.forEach(tab => {
          if (tab.url) {
            try {
              const hostname = new URL(tab.url).hostname.replace('www.', '');
              if (hostname) {
                newOverrides[hostname] = CATEGORIES.OTHER;
              }
            } catch {}
          }
        });

        // 3. Reset group volumes to default
        const newGroupVolumes: Record<Category, number> = {
          [CATEGORIES.ENTERTAINMENT]: 1.0,
          [CATEGORIES.STUDY]: 1.0,
          [CATEGORIES.WORK]: 1.0,
          [CATEGORIES.COMMUNICATION]: 1.0,
          [CATEGORIES.OTHER]: 1.0,
          [CATEGORIES.MUSIC]: 1.0,
          [CATEGORIES.SOCIAL]: 1.0,
          [CATEGORIES.GAMING]: 1.0,
        };

        await chrome.storage.local.set({
          categoryOverrides: newOverrides,
          groupVolumes: newGroupVolumes
        });

        // 4. Update effective volume on all tabs
        tabs.forEach(tab => {
          if (tab.id) applyEffectiveVolume(tab.id);
        });

        sendResponse({ success: true });
      } catch (e) {
        console.error("Reset tabs error:", e);
        sendResponse({ success: false });
      }
    });
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
                  color: CATEGORY_COLORS[category] || 'grey'
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

  if (message.type === 'GET_PRIORITY_STATE') {
    sendResponse(priorityCoordinator.getState());
    return true;
  }

  if (message.type === 'SET_SCENE') {
    priorityCoordinator.setScene(message.sceneId);
    sendResponse(priorityCoordinator.getState());
    return true;
  }

  if (message.type === 'SET_MANUAL_PRIORITY') {
    priorityCoordinator.setManualPriority(message.tabId, message.priority);
    sendResponse(priorityCoordinator.getState());
    return true;
  }

  if (message.type === 'UPDATE_AUTOMATION_SETTINGS') {
    priorityCoordinator.updateSettings(message.settings);
    sendResponse(priorityCoordinator.getState());
    return true;
  }

  if (message.type === 'RESTORE_ALL_MANAGED') {
    priorityCoordinator.restoreAllManagedAudio().then(count => {
      sendResponse({ success: true, count, state: priorityCoordinator.getState() });
    });
    return true;
  }

  if (message.type === 'ACCEPT_SUGGESTION') {
    const success = priorityCoordinator.acceptSuggestion(message.suggestionId);
    sendResponse({ success, state: priorityCoordinator.getState() });
    return true;
  }

  if (message.type === 'DISMISS_SUGGESTION') {
    priorityCoordinator.dismissSuggestion(message.suggestionId);
    sendResponse({ success: true, state: priorityCoordinator.getState() });
    return true;
  }

  if (message.type === 'CLEAR_LEARNED_DATA') {
    priorityCoordinator.clearLearnedPreferences();
    sendResponse({ success: true, state: priorityCoordinator.getState() });
    return true;
  }

  if (message.type === 'MEDIA_PLAYBACK_SIGNAL') {
    if (_sender.tab && _sender.tab.id) {
      const src = priorityCoordinator.syncTab(_sender.tab, {
        isHtml5Media: true,
        supportsVolume: true,
        supportsPause: true,
      });
      src.mediaPlaying = Boolean(message.playing);
      priorityCoordinator.triggerEvaluation(false);
    }
    sendResponse({ received: true });
    return true;
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  priorityCoordinator.handleTabActivated(activeInfo.tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  priorityCoordinator.handleTabRemoved(tabId);
  chrome.storage.local.get(['tabVolumes'], (state) => {
    const tabVolumes = (state.tabVolumes || {}) as Record<number, number>;
    if (tabVolumes[tabId] !== undefined) {
      delete tabVolumes[tabId];
      chrome.storage.local.set({ tabVolumes });
    }
  });
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  priorityCoordinator.syncTab(tab);
  if (changeInfo.audible !== undefined || changeInfo.url) {
    priorityCoordinator.triggerEvaluation(false);
  }
  if (changeInfo.mutedInfo) {
    priorityCoordinator.handleManualMuteChange(tabId, changeInfo.mutedInfo.muted);
  }

  if (changeInfo.url) {
    applyEffectiveVolume(tabId);
  }

  // Auto-categorize and sync reopened / newly opened / navigated tabs
  const targetUrl = tab.url || changeInfo.url;
  if (targetUrl && (changeInfo.url || (changeInfo.status === 'loading' && tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE))) {
    if (!tab.pinned && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
      try {
        const { categoryOverrides } = await chrome.storage.local.get(['categoryOverrides']);
        const overrides = (categoryOverrides || {}) as Record<string, Category>;
        const category = classifyUrl(targetUrl, overrides);
        const hostname = new URL(targetUrl).hostname.replace('www.', '');
        const hasExplicitOverride = Boolean(overrides[hostname]);

        if (category && category !== CATEGORIES.OTHER) {
          const windowGroups = await chrome.tabGroups.query({ windowId: tab.windowId });
          const matchingGroup = windowGroups.find(
            g => g.title?.trim().toLowerCase() === category.toLowerCase()
          );

          if (matchingGroup) {
            if (tab.groupId !== matchingGroup.id) {
              await chrome.tabs.group({ tabIds: [tabId], groupId: matchingGroup.id });
            }
          } else if (hasExplicitOverride || windowGroups.length > 0) {
            // If the user previously categorized this site explicitly or window already uses tab groups,
            // automatically group into that category
            if (tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
              const newGroupId = await chrome.tabs.group({ tabIds: [tabId] });
              await chrome.tabGroups.update(newGroupId, {
                title: category,
                color: CATEGORY_COLORS[category] || 'grey'
              });
            }
          }
        }
      } catch {
        // Tab might be in flux
      }
    }
  }

  // When a user groups a tab in Chrome natively, remember it
  if (changeInfo.groupId !== undefined && changeInfo.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
    try {
      const group = await chrome.tabGroups.get(changeInfo.groupId);
      if (group && group.title && tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
        const matched = Object.values(CATEGORIES).find(
          c => c.toLowerCase() === group.title?.trim().toLowerCase()
        );
        if (matched) {
          const hostname = new URL(tab.url).hostname.replace('www.', '');
          const { categoryOverrides } = await chrome.storage.local.get(['categoryOverrides']);
          const overrides = (categoryOverrides || {}) as Record<string, Category>;
          if (overrides[hostname] !== matched) {
            overrides[hostname] = matched;
            await chrome.storage.local.set({ categoryOverrides: overrides });
          }
        }
      }
    } catch {}
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
