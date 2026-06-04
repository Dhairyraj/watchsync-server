(function() {
  if (window.__watchSyncPrime) return;
  window.__watchSyncPrime = true;

  let isSyncing = false;
  let syncTimeout = null;
  let videoElement = null;

  function safeSendMessage(message) {
    try {
      if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(message);
      }
    } catch (e) {
      console.warn('[WatchSync] Extension context invalidated or message failed', e);
    }
  }

  function handlePlayerEvent(eventType) {
    if (isSyncing || !videoElement) return;
    
    safeSendMessage({
      type: 'PLAYER_EVENT',
      event: eventType,
      currentTime: videoElement.currentTime
    });
  }

  function attachListeners(v) {
    v.addEventListener('play', () => handlePlayerEvent('play'));
    v.addEventListener('pause', () => handlePlayerEvent('pause'));
    v.addEventListener('seeked', () => handlePlayerEvent('seek'));
  }

  function initVideo(v) {
    if (videoElement === v) return;
    videoElement = v;
    attachListeners(v);
    console.log('[WatchSync] Prime Video initialized');
  }

  function tryFindVideo() {
    const v = document.querySelector('video');
    if (v) {
      initVideo(v);
      return true;
    }
    return false;
  }

  if (!tryFindVideo()) {
    const observer = new MutationObserver((mutations) => {
      if (tryFindVideo()) {
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  try {
    if (chrome && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'INCOMING_SYNC' && videoElement) {
          const data = request.data;
          
          isSyncing = true;
          clearTimeout(syncTimeout);
          syncTimeout = setTimeout(() => { isSyncing = false; }, 500);

          try {
            if (data.type === 'play') {
              if (Math.abs(videoElement.currentTime - data.currentTime) > 1) {
                videoElement.currentTime = data.currentTime;
              }
              videoElement.play().catch(e => console.warn('[WatchSync] Play blocked', e));
            } else if (data.type === 'pause') {
              videoElement.pause();
              videoElement.currentTime = data.currentTime;
            } else if (data.type === 'seek') {
              videoElement.currentTime = data.currentTime;
            }
          } catch (e) {
            console.error('[WatchSync] Error applying sync event', e);
          }
        }
      });
    }
  } catch (e) {
    console.warn('[WatchSync] Could not attach message listener', e);
  }
})();
