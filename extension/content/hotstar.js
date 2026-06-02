// hotstar.js - Content script for Hotstar.com and JioHotstar.com

(function() {
  console.log('[WatchSync] Hotstar content script loaded.');

  let videoElement = null;
  let latencyCorrector = null;
  let isSyncing = false;
  let syncTimeout = null;
  let lastTimeUpdate = 0;
  let findRetries = 0;

  function findVideoElement() {
    videoElement = document.querySelector('video') || 
                   document.querySelector('.hotstar-player video') || 
                   document.querySelector('[class*="player"] video');
                   
    if (videoElement) {
      console.log('[WatchSync] Hotstar video element found.');
      latencyCorrector = new window.LatencyCorrector(videoElement);
      attachEventListeners();
      attachCustomButtonListeners();
    } else {
      if (findRetries < 10) {
        findRetries++;
        setTimeout(findVideoElement, 2000); // Retry every 2 seconds up to 10 times
      } else {
        showErrorPopup();
      }
    }
  }

  function showErrorPopup() {
    // Inject a quick popup to tell user to play video
    const el = document.createElement('div');
    el.innerText = 'WatchSync: Please start playing a video first.';
    el.style.cssText = 'position:fixed;top:20px;right:20px;background:#e50914;color:white;padding:10px 20px;z-index:999999;border-radius:4px;font-family:sans-serif;';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }

  function attachEventListeners() {
    videoElement.addEventListener('play', () => handlePlayerEvent('play'));
    videoElement.addEventListener('pause', () => handlePlayerEvent('pause'));
    videoElement.addEventListener('seeked', () => handlePlayerEvent('seek'));
    
    videoElement.addEventListener('timeupdate', () => {
      const now = Date.now();
      if (now - lastTimeUpdate > 5000) {
        handlePlayerEvent('timeupdate');
        lastTimeUpdate = now;
      }
    });
  }

  function attachCustomButtonListeners() {
    // Hotstar sometimes uses custom buttons, intercept their clicks too
    document.body.addEventListener('click', (e) => {
      const target = e.target.closest('[class*="play-pause"], [class*="PlayPause"]');
      if (target) {
        // Give the video element a moment to update state before broadcasting
        setTimeout(() => {
          handlePlayerEvent(videoElement.paused ? 'pause' : 'play');
        }, 100);
      }
    });
  }

  function isLiveContent() {
    return videoElement && (videoElement.duration === Infinity || isNaN(videoElement.duration));
  }

  function handlePlayerEvent(eventType) {
    if (isSyncing) return;
    
    // For live content, disable seek sync
    if (isLiveContent() && (eventType === 'seek' || eventType === 'timeupdate')) {
      return; 
    }

    chrome.runtime.sendMessage({
      type: 'PLAYER_EVENT',
      event: eventType,
      currentTime: videoElement.currentTime,
      platform: 'hotstar'
    });
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'INCOMING_SYNC') {
      applySyncEvent(request.data);
    }
  });

  function applySyncEvent(data) {
    if (!videoElement) return;
    
    const { type, currentTime } = data;
    
    // Ignore seeks for live content
    if (isLiveContent() && (type === 'seek' || type === 'timeupdate')) {
      return;
    }

    isSyncing = true;
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => { isSyncing = false; }, 500);

    try {
      if (type === 'play') {
        if (!isLiveContent() && Math.abs(videoElement.currentTime - currentTime) > 1) {
          videoElement.currentTime = currentTime;
        }
        videoElement.play().catch(e => console.warn('Play blocked:', e));
      } else if (type === 'pause') {
        videoElement.pause();
        if (!isLiveContent()) {
          videoElement.currentTime = currentTime;
        }
      } else if (type === 'seek') {
        videoElement.currentTime = currentTime;
      } else if (type === 'timeupdate') {
        latencyCorrector.correct(currentTime);
      }
    } catch (e) {
      console.error('[WatchSync] Error applying sync event:', e);
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    findVideoElement();
  } else {
    document.addEventListener('DOMContentLoaded', findVideoElement);
  }
})();
