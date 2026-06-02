(function() {
  if (window.__watchSyncYouTube) return;
  window.__watchSyncYouTube = true;

  let video = null;
  let isSyncing = false;

  function getVideo() {
    return document.querySelector('video.html5-main-video') || document.querySelector('video');
  }

  function attachListeners(v) {
    v.addEventListener('play', () => {
      if (isSyncing) return;
      chrome.runtime.sendMessage({ type: 'PLAYER_EVENT', event: 'play', currentTime: v.currentTime });
    });
    v.addEventListener('pause', () => {
      if (isSyncing) return;
      chrome.runtime.sendMessage({ type: 'PLAYER_EVENT', event: 'pause', currentTime: v.currentTime });
    });
    v.addEventListener('seeked', () => {
      if (isSyncing) return;
      chrome.runtime.sendMessage({ type: 'PLAYER_EVENT', event: 'seek', currentTime: v.currentTime });
    });
  }

  // Listen for incoming sync from background
  chrome.runtime.onMessage.addListener((request) => {
    if (request.type === 'INCOMING_SYNC') {
      if (!video) video = getVideo();
      if (!video) return;
      isSyncing = true;
      const d = request.data;
      if (d.type === 'play') { video.currentTime = d.currentTime; video.play(); }
      else if (d.type === 'pause') { video.currentTime = d.currentTime; video.pause(); }
      else if (d.type === 'seek') { video.currentTime = d.currentTime; }
      setTimeout(() => { isSyncing = false; }, 500);
    }
  });

  const observer = new MutationObserver(() => {
    if (!video) {
      video = getVideo();
      if (video) attachListeners(video);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  video = getVideo();
  if (video) attachListeners(video);
})();