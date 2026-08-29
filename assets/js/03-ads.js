// ==================== AD MANAGEMENT SYSTEM ====================
let currentAd = null;
let adCloseTimer = null;
let adFrequencyCounter = {};
let lastAdShowTime = 0;
const MIN_AD_INTERVAL = 30000;
let pendingPostData = null;
let isAdShowing = false;
let pendingPostId = null;
let hasShownPageLoadAd = false;

async function showPageLoadAd() {
  if (hasShownPageLoadAd) return;
  const now = Date.now();
  if (now - lastAdShowTime < MIN_AD_INTERVAL) return;
  
  try {
    const response = await fetch(`${API_URL}?action=getPageLoadAds&from=mmovie.site`);
    const ads = await response.json();
    if (!Array.isArray(ads) || ads.length === 0) return;
    
    const today = new Date().toDateString();
    if (!adFrequencyCounter[today]) adFrequencyCounter[today] = {};
    
    const availableAds = ads.filter(ad => {
      const count = adFrequencyCounter[today][ad.ID] || 0;
      return count < ad.Frequency;
    });
    
    if (availableAds.length === 0) return;
    
    const randomIndex = Math.floor(Math.random() * availableAds.length);
    const ad = availableAds[randomIndex];
    adFrequencyCounter[today][ad.ID] = (adFrequencyCounter[today][ad.ID] || 0) + 1;
    lastAdShowTime = now;
    hasShownPageLoadAd = true;
    currentAd = ad;
    isAdShowing = true;
    displayAdModal(ad);
  } catch (error) {
    console.error('Error loading page load ad:', error);
  }
}

async function loadAdForPost(postId, placement = 'both') {
  const today = new Date().toDateString();
  if (!adFrequencyCounter[today]) adFrequencyCounter[today] = {};
  try {
    const response = await fetch(`${API_URL}?action=getActiveAds&placement=${placement}&postId=${postId}&from=mmovie.site`);
    const ads = await response.json();
    if (!Array.isArray(ads) || ads.length === 0) return null;
    const availableAds = ads.filter(ad => (adFrequencyCounter[today][ad.ID] || 0) < ad.Frequency);
    if (availableAds.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * availableAds.length);
    return availableAds[randomIndex];
  } catch (error) {
    console.error('Error loading ad:', error);
    return null;
  }
}

async function showAdForPost(postId, placement = 'both') {
  if (isAdShowing) return;
  
  const now = Date.now();
  if (now - lastAdShowTime < MIN_AD_INTERVAL) {
    if (pendingPostData) {
      displaySinglePostDirectly(pendingPostData);
      pendingPostData = null;
      pendingPostId = null;
    }
    return;
  }
  
  const ad = await loadAdForPost(postId, placement);
  if (!ad) {
    if (pendingPostData) {
      displaySinglePostDirectly(pendingPostData);
      pendingPostData = null;
      pendingPostId = null;
    }
    return;
  }
  
  const today = new Date().toDateString();
  adFrequencyCounter[today][ad.ID] = (adFrequencyCounter[today][ad.ID] || 0) + 1;
  lastAdShowTime = now;
  currentAd = ad;
  isAdShowing = true;
  displayAdModal(ad);
}

function displayAdModal(ad) {
  const container = document.getElementById('adModalContainer');
  let contentHtml = '';
  const link = ad.Link || '#';
  const convertedContent = convertGoogleDriveUrlToThumbnail(ad.Content);
  
  if (ad.Type === 'image' || ad.Type === 'gif') {
    contentHtml = `<img src="${convertedContent}" class="ad-image" alt="${escapeHtml(ad.Title)}" onerror="this.src='${NO_IMAGE_PLACEHOLDER}'">`;
  } else if (ad.Type === 'video') {
    let videoUrl = ad.Content;
    if (videoUrl.includes('youtube.com/watch') || videoUrl.includes('youtu.be')) {
      const videoId = extractYouTubeVideoId(videoUrl);
      if (videoId) {
        contentHtml = `<iframe width="100%" height="250" src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
      } else {
        contentHtml = `<video controls autoplay muted style="width: 100%; max-height: 250px;"><source src="${videoUrl}" type="video/mp4"></video>`;
      }
    } else {
      contentHtml = `<video controls autoplay muted style="width: 100%; max-height: 250px;"><source src="${videoUrl}" type="video/mp4"></video>`;
    }
  } else if (ad.Type === 'html') {
    contentHtml = ad.Content;
  }
  
  const modalHtml = `
    <div class="modal fade ad-modal" id="adModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content ad-modal-content">
          <div class="modal-body p-0 position-relative">
            <a href="${link}" target="_blank" class="ad-link" rel="noopener noreferrer">${contentHtml}</a>
            <div class="ad-close-container" id="adCloseContainer" style="display: none;">
              <button class="btn btn-sm btn-dark ad-close-btn" onclick="closeAdModalAndShowContent()">
                <i class="fas fa-times me-1"></i>Close Ad
              </button>
            </div>
            <div class="ad-timer" id="adTimer">
              <span id="adTimerCount">${ad.Duration}</span> seconds
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  container.innerHTML = modalHtml;
  const modal = new bootstrap.Modal(document.getElementById('adModal'));
  modal.show();
  
  let secondsLeft = ad.Duration;
  const timerElement = document.getElementById('adTimerCount');
  const closeContainer = document.getElementById('adCloseContainer');
  
  if (adCloseTimer) clearInterval(adCloseTimer);
  
  adCloseTimer = setInterval(() => {
    secondsLeft--;
    if (timerElement) timerElement.textContent = secondsLeft;
    if (secondsLeft <= 0) {
      clearInterval(adCloseTimer);
      if (closeContainer) closeContainer.style.display = 'block';
      if (timerElement && timerElement.parentElement) timerElement.parentElement.style.display = 'none';
    }
  }, 1000);
}

function closeAdModalAndShowContent() {
  if (adCloseTimer) clearInterval(adCloseTimer);
  const modalElement = document.getElementById('adModal');
  if (modalElement) {
    const modal = bootstrap.Modal.getInstance(modalElement);
    if (modal) modal.hide();
    modalElement.remove();
  }
  isAdShowing = false;
  
  if (pendingPostData) {
    displaySinglePostDirectly(pendingPostData);
    pendingPostData = null;
    pendingPostId = null;
  }
}