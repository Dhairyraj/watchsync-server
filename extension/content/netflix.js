// netflix.js - Content script for Netflix.com

(function() {
  console.log('[WatchSync] Netflix content script loaded.');

  let videoElement = null;
  let latencyCorrector = null;
  let isSyncing = false;
  let syncTimeout = null;
  let lastTimeUpdate = 0;

  function findVideoElement() {
    videoElement = document.querySelector('video');
    if (videoElement) {
      console.log('[WatchSync] Netflix video element found.');
      latencyCorrector = new window.LatencyCorrector(videoElement);
      attachEventListeners();
    } else {
      setTimeout(findVideoElement, 2000); // Retry every 2 seconds
    }
  }

  function attachEventListeners() {
    videoElement.addEventListener('play', () => handlePlayerEvent('play'));
    videoElement.addEventListener('pause', () => handlePlayerEvent('pause'));
    videoElement.addEventListener('seeked', () => handlePlayerEvent('seek'));
    
    // Throttle timeupdate to every 5 seconds
    videoElement.addEventListener('timeupdate', () => {
      const now = Date.now();
      if (now - lastTimeUpdate > 5000) {
        handlePlayerEvent('timeupdate');
        lastTimeUpdate = now;
      }
    });
  }

  function handlePlayerEvent(eventType) {
    if (isSyncing) return; // Prevent infinite sync loop

    chrome.runtime.sendMessage({
      type: 'PLAYER_EVENT',
      event: eventType,
      currentTime: videoElement.currentTime,
      platform: 'netflix'
    });
  }

  // Listen for incoming sync messages from background.js
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'INCOMING_SYNC') {
      applySyncEvent(request.data);
    }
  });

  function applySyncEvent(data) {
    if (!videoElement) return;
    
    const { type, currentTime } = data;
    
    // Set flag to ignore local events triggered by this remote action
    isSyncing = true;
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => { isSyncing = false; }, 500);

    try {
      if (type === 'play') {
        if (Math.abs(videoElement.currentTime - currentTime) > 1) {
          videoElement.currentTime = currentTime;
        }
        videoElement.play().catch(e => console.warn('Play blocked:', e));
      } else if (type === 'pause') {
        videoElement.pause();
        videoElement.currentTime = currentTime;
      } else if (type === 'seek') {
        videoElement.currentTime = currentTime;
      } else if (type === 'timeupdate') {
        latencyCorrector.correct(currentTime);
      }
    } catch (e) {
      console.error('[WatchSync] Error applying sync event:', e);
    }
  }

  // Start initialization
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    findVideoElement();
  } else {
    document.addEventListener('DOMContentLoaded', findVideoElement);
  }
})();
