const API_URL = "https://mmovie-api.mmovie.site/";
let postsCache = [];
let allPosts = [];
let filteredPosts = [];
let isSearching = false;
let currentPage = 1;
const postsPerPage = 12;
let autoRefreshInterval;
let currentTrailerLink = '';
let youtubePlayer = null;

// View tracking variables
let viewCounts = {};
let popularPosts = [];
let viewUpdateQueue = [];
let isUpdatingViews = false;

// ==================== VIEW TRACKING - PREVENT DUPLICATE ====================
let viewedPosts = new Set(); // Track which posts have been viewed
let viewQueueProcessing = false;

// ==================== VIDEO PLAYER VARIABLES ====================
let currentVideoUrl = '';
let videoPlayerInitialized = false;

// ==================== EPISODE VARIABLES ====================
let currentPostEpisodes = [];
let currentPostContentType = 'movie';
let currentEpisodeVideoUrl = '';
let currentEpisodeTitle = '';

// ==================== CONSTANT: No Image Placeholder ====================
// Use SVG data URI to avoid via.placeholder.com connection issues
const NO_IMAGE_PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"%3E%3Crect width="400" height="300" fill="%23e9ecef"/%3E%3Ctext x="50%25" y="45%25" text-anchor="middle" dy=".3em" font-family="Arial, sans-serif" font-size="20" fill="%23999"%3ENo Image%3C/text%3E%3Ctext x="50%25" y="60%25" text-anchor="middle" dy=".3em" font-family="Arial, sans-serif" font-size="14" fill="%23b0b0b0"%3ENot Available%3C/text%3E%3C/svg%3E';

const NO_IMAGE_SMALL = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200"%3E%3Crect width="400" height="200" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-family="Arial" font-size="16" fill="%23999"%3ENo Image%3C/text%3E%3C/svg%3E';

// ==================== HELPER: Google Drive URL to Thumbnail ====================
function convertGoogleDriveUrlToThumbnail(url) {
  if (!url) return url;
  if (url.includes('drive.google.com/thumbnail')) return url;
  
  const drivePattern = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
  const match = url.match(drivePattern);
  if (match) {
    const fileId = match[1];
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=s800`;
  }
  
  const downloadPattern = /drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/;
  const downloadMatch = url.match(downloadPattern);
  if (downloadMatch) {
    const fileId = downloadMatch[1];
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=s800`;
  }
  
  return url;
}

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

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== EPISODE FUNCTIONS ====================

/**
 * Display episodes for a series post
 */
function displayEpisodes(post) {
  const episodesSection = document.getElementById('episodesSection');
  const episodesGrid = document.getElementById('episodesGrid');
  const episodeCountBadge = document.getElementById('episodeCountBadge');
  
  // Check if this is a series with episodes
  const contentType = post.ContentType || 'movie';
  let episodes = [];
  
  try {
    if (post.Episodes) {
      episodes = typeof post.Episodes === 'string' ? JSON.parse(post.Episodes) : post.Episodes;
    }
  } catch (e) {
    console.warn('Failed to parse episodes:', e);
  }
  
  currentPostEpisodes = episodes;
  currentPostContentType = contentType;
  
  if (contentType !== 'series' || !episodes || episodes.length === 0) {
    episodesSection.style.display = 'none';
    return;
  }
  
  episodesSection.style.display = 'block';
  episodeCountBadge.textContent = `${episodes.length} Episodes`;
  
  // Sort episodes by episode number
  episodes.sort((a, b) => (a.episode || a.Episode || 0) - (b.episode || b.Episode || 0));
  
  let html = '';
  episodes.forEach((ep) => {
    const epNum = ep.episode || ep.Episode || 0;
    const link = ep.link || ep.Link || '#';
    
    html += `
      <div class="episode-card">
        <span class="episode-number">
          <i class="fas fa-play-circle"></i> Episode ${epNum}
        </span>
        <button class="episode-watch-btn" onclick="playEpisode('${link}', 'Episode ${epNum}')" title="Watch Episode ${epNum}">
          <i class="fas fa-play"></i> Watch
        </button>
      </div>
    `;
  });
  
  episodesGrid.innerHTML = html;
}

/**
 * Play episode in the video player (In-Page)
 */
function playEpisode(videoUrl, episodeTitle) {
  if (!videoUrl || videoUrl === '#') {
    showNotification('No video link available for this episode', 'warning');
    return;
  }
  
  // Store episode video info
  currentEpisodeVideoUrl = videoUrl;
  currentEpisodeTitle = episodeTitle || 'Episode';
  
  // Open video player with the episode link
  openEpisodeVideoPlayer(videoUrl, episodeTitle);
}

/**
 * Open video player specifically for episode (In-Page)
 */
function openEpisodeVideoPlayer(videoUrl, episodeTitle) {
  const videoContainer = document.getElementById('videoPlayerContainer');
  const videoPlayer = document.getElementById('videoPlayer');
  
  if (!videoUrl) {
    showNotification('No video link available', 'warning');
    return;
  }
  
  // Close any existing trailer
  closeTrailer();
  
  videoContainer.style.display = 'block';
  videoPlayer.innerHTML = '';
  
  // Add episode title above player
  const titleHtml = `
    <div class="episode-player-title" style="color:#fff; padding:10px 16px; background:rgba(0,0,0,0.6); font-weight:600; font-size:1rem; border-bottom:2px solid var(--series-color);">
      <i class="fas fa-play-circle text-success me-2"></i>${episodeTitle || 'Episode'}
    </div>
  `;
  
  const embedHtml = getVideoEmbedHtml(videoUrl);
  
  if (embedHtml) {
    videoPlayer.innerHTML = titleHtml + embedHtml;
    videoContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else {
    // If can't embed, show a fallback with direct link
    videoPlayer.innerHTML = `
      <div class="video-loading" style="min-height:200px;">
        <i class="fas fa-external-link-alt fa-3x text-warning mb-3"></i>
        <p>Unable to embed video.</p>
        <a href="${videoUrl}" target="_blank" class="btn btn-success btn-custom btn-success-custom" rel="noopener noreferrer">
          <i class="fas fa-play me-2"></i>Open Link to Watch
        </a>
        <button class="btn btn-secondary btn-custom btn-secondary-custom mt-2" onclick="closeVideoPlayer()">
          <i class="fas fa-times me-1"></i>Close
        </button>
      </div>
    `;
    showNotification('Unable to embed video. Please open link directly.', 'warning');
  }
}

// ==================== VIDEO PLAYER FUNCTIONS ====================

/**
 * Open video player with the post's download link
 */
function openVideoPlayer() {
  const videoContainer = document.getElementById('videoPlayerContainer');
  const videoPlayer = document.getElementById('videoPlayer');
  
  if (!currentVideoUrl) {
    showNotification('No video link available', 'warning');
    return;
  }
  
  // Close any existing trailer
  closeTrailer();
  
  videoContainer.style.display = 'block';
  videoPlayer.innerHTML = '';
  
  const embedHtml = getVideoEmbedHtml(currentVideoUrl);
  
  if (embedHtml) {
    videoPlayer.innerHTML = embedHtml;
    videoContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else {
    videoPlayer.innerHTML = `
      <div class="video-loading">
        <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
        <p>Unable to embed video. <a href="${currentVideoUrl}" target="_blank" class="text-primary">Open link directly</a></p>
      </div>
    `;
    showNotification('Unable to embed video. Please open link directly.', 'warning');
  }
}

/**
 * Get embed HTML for different video platforms
 */
function getVideoEmbedHtml(url) {
  if (!url) return null;
  
  // YouTube
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (youtubeMatch) {
    const videoId = youtubeMatch[1];
    return `<iframe src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&showinfo=0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen></iframe>`;
  }
  
  // Fembed
  const fembedMatch = url.match(/fembed\.(?:com|net|co|to)\/embed\/([a-zA-Z0-9_-]+)/);
  if (fembedMatch) {
    const videoId = fembedMatch[1];
    return `<iframe src="https://fembed.co/embed/${videoId}" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen></iframe>`;
  }
  
  // Vidoza
  if (url.includes('vidoza.net')) {
    return `<iframe src="${url}" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen></iframe>`;
  }
  
  // MP4 direct link
  if (url.match(/\.(mp4|webm|ogg|mov)$/i)) {
    return `<video controls autoplay style="width:100%;height:100%;background:#000;">
            <source src="${url}" type="video/mp4">
            Your browser does not support video.
            </video>`;
  }
  
  // Generic iframe
  if (url.includes('embed') || url.includes('iframe')) {
    return `<iframe src="${url}" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen></iframe>`;
  }
  
  return null;
}

/**
 * Close video player
 */
function closeVideoPlayer() {
  const videoContainer = document.getElementById('videoPlayerContainer');
  const videoPlayer = document.getElementById('videoPlayer');
  
  if (videoContainer) {
    videoContainer.style.display = 'none';
  }
  if (videoPlayer) {
    videoPlayer.innerHTML = '';
  }
  videoPlayerInitialized = false;
  currentEpisodeVideoUrl = '';
  currentEpisodeTitle = '';
}

/**
 * Check if a URL is a valid video link
 */
function isValidVideoUrl(url) {
  if (!url) return false;
  const videoPatterns = [
    /youtube\.com/i,
    /youtu\.be/i,
    /fembed\.(com|net|co|to)/i,
    /vidoza\.net/i,
    /\.(mp4|webm|ogg|mov)$/i,
    /embed/i
  ];
  return videoPatterns.some(pattern => pattern.test(url));
}

// ==================== VIEW TRACKING FUNCTIONS (FIXED - PREVENT DUPLICATE) ====================

/**
 * Track post view - prevents duplicate views
 * Only counts once per post per page load
 */
function trackPostView(postId) {
  if (!postId) return;
  
  // Check if this post has already been viewed in this session
  if (viewedPosts.has(postId)) {
    console.log(`[View] Post ${postId} already counted, skipping`);
    return;
  }
  
  // Mark as viewed
  viewedPosts.add(postId);
  
  console.log(`[View] Tracking post ${postId}`);
  viewUpdateQueue.push(postId);
  
  if (!viewCounts[postId]) viewCounts[postId] = 1;
  else viewCounts[postId]++;
  
  updatePopularPosts(postId);
  
  const urlParams = new URLSearchParams(window.location.search);
  const currentPostId = urlParams.get('post');
  if (currentPostId === postId) updateSinglePostViewCount(postId);
  
  clearTimeout(window.viewUpdateTimer);
  window.viewUpdateTimer = setTimeout(processViewQueue, 2000);
}

/**
 * Process view queue - sends batch updates to server
 */
function processViewQueue() {
  if (viewUpdateQueue.length === 0 || isUpdatingViews) return;
  if (viewQueueProcessing) return;
  
  viewQueueProcessing = true;
  isUpdatingViews = true;
  
  const viewGroups = {};
  viewUpdateQueue.forEach(postId => { 
    viewGroups[postId] = (viewGroups[postId] || 0) + 1; 
  });
  
  // Clear queue immediately to prevent duplicates
  viewUpdateQueue = [];
  
  const promises = Object.keys(viewGroups).map(postId => incrementServerViewCount(postId, viewGroups[postId]));
  
  Promise.all(promises)
    .then(() => { 
      viewQueueProcessing = false; 
      isUpdatingViews = false; 
    })
    .catch(error => { 
      console.error('Error updating view counts:', error); 
      viewQueueProcessing = false; 
      isUpdatingViews = false; 
    });
}

function incrementServerViewCount(postId, count = 1) {
  return fetch(`${API_URL}?action=incrementView&postId=${postId}`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const postIndex = postsCache.findIndex(p => p.ID == postId);
        if (postIndex !== -1) postsCache[postIndex].Views = data.newViews;
        return data;
      } else throw new Error(data.message);
    });
}

function updateSinglePostViewCount(postId) {
  const post = postsCache.find(p => p.ID == postId);
  if (post) {
    const viewCountElement = document.getElementById('viewCount');
    if (viewCountElement) viewCountElement.textContent = `Views: ${post.Views || 0}`;
  }
}

function updatePopularPosts(postId) {
  const post = postsCache.find(p => p.ID == postId);
  if (post) {
    const existingIndex = popularPosts.findIndex(p => p.ID === postId);
    if (existingIndex !== -1) popularPosts[existingIndex].Views = (popularPosts[existingIndex].Views || 0) + 1;
    else popularPosts.push({...post});
    popularPosts.sort((a, b) => (b.Views || 0) - (a.Views || 0));
    if (popularPosts.length > 20) popularPosts = popularPosts.slice(0, 20);
    updateTrendingSection();
  }
}

function updateTrendingSection() {
  const hotFeaturedSection = document.getElementById('hotFeaturedSection');
  if (hotFeaturedSection && hotFeaturedSection.style.display !== 'none') loadHotFeaturedContent();
}

function loadPopularPosts() {
  fetch(`${API_URL}?action=getPopularPosts`)
    .then(res => res.json())
    .then(popular => { 
      popularPosts = Array.isArray(popular) ? popular : []; 
    })
    .catch(error => console.error('Error loading popular posts:', error));
}

// ==================== CONTENT TYPE VARIABLES ====================
let showHotOnly = false;
let selectedGenre = null;
let selectedContentType = null;
let allGenres = [];
let genrePostCounts = {};
let hotPostsCount = 0;
let contentTypeCounts = { movie: 0, series: 0, animation: 0 };
const DISPLAY_LIMIT = 8;
let displayedCounts = { movie: 0, series: 0, animation: 0 };
let loadMorePages = { movie: 1, series: 1, animation: 1 };

// ==================== CONTENT TYPE FUNCTIONS ====================
function initContentType() { countContentTypePosts(); updateContentTypeCounts(); toggleContentTypeSections(); }

function countContentTypePosts() {
  contentTypeCounts = { movie: 0, series: 0, animation: 0 };
  allPosts.forEach(post => { const ct = post.ContentType || 'movie'; if (contentTypeCounts.hasOwnProperty(ct)) contentTypeCounts[ct]++; else contentTypeCounts.movie++; });
  hotPostsCount = allPosts.filter(post => post.IsHot === "TRUE" || post.IsHot === true).length;
}

function updateContentTypeCounts() {
  document.getElementById('movieCount').textContent = contentTypeCounts.movie;
  document.getElementById('seriesCount').textContent = contentTypeCounts.series;
  document.getElementById('animationCount').textContent = contentTypeCounts.animation;
  const hotBtn = document.getElementById('hotFilterBtnUser');
  if (hotBtn) {
    const existingCounter = hotBtn.querySelector('.hot-posts-counter');
    if (hotPostsCount > 0) { if (!existingCounter) { const c = document.createElement('span'); c.className = 'hot-posts-counter'; c.textContent = hotPostsCount; hotBtn.appendChild(c); } else existingCounter.textContent = hotPostsCount; }
    else if (existingCounter) existingCounter.remove();
  }
}

function toggleContentTypeSections() {
  const movieSection = document.getElementById('movieSection'), seriesSection = document.getElementById('seriesSection'), animationSection = document.getElementById('animationSection'), hotFeaturedSection = document.getElementById('hotFeaturedSection');
  if (contentTypeCounts.movie > 0) movieSection.style.display = 'block';
  if (contentTypeCounts.series > 0) seriesSection.style.display = 'block';
  if (contentTypeCounts.animation > 0) animationSection.style.display = 'block';
  const hotPosts = allPosts.filter(post => post.IsHot === "TRUE" || post.IsHot === true);
  if (hotPosts.length > 0) { hotFeaturedSection.style.display = 'block'; loadHotFeaturedContent(); } else hotFeaturedSection.style.display = 'none';
}

function getContentTypeIcon(type) { switch(type) { case 'movie': return 'fa-film'; case 'series': return 'fa-tv'; case 'animation': return 'fa-robot'; default: return 'fa-film'; } }

function filterByContentType(type) {
  if (type === 'all') { clearContentTypeFilter(); return; }
  selectedContentType = type;
  const icon = getContentTypeIcon(type), displayName = capitalizeFirstLetter(type);
  document.getElementById('contentTypeDropdown').innerHTML = `<i class="fas ${icon} me-1"></i>${displayName}`;
  document.getElementById('contentTypeSections').style.display = 'none';
  document.getElementById('hotFeaturedSection').style.display = 'none';
  document.getElementById('filteredView').style.display = 'block';
  updateActiveFiltersDisplay(); applyFilters();
  document.getElementById('filteredViewTitle').textContent = `All ${displayName}`;
  showNotification(`Filtering by: ${displayName}`, 'info');
}

function clearContentTypeFilter() {
  selectedContentType = null;
  document.getElementById('contentTypeDropdown').innerHTML = `<i class="fas fa-film me-1"></i>All Content`;
  document.getElementById('contentTypeSections').style.display = 'block';
  document.getElementById('filteredView').style.display = 'none';
  const hotPosts = allPosts.filter(post => post.IsHot === "TRUE" || post.IsHot === true);
  if (hotPosts.length > 0) document.getElementById('hotFeaturedSection').style.display = 'block';
  updateActiveFiltersDisplay(); loadContentTypeSections();
  showNotification('Content type filter cleared', 'info');
}

function loadContentTypeSections() { loadMovies(1, DISPLAY_LIMIT); if (contentTypeCounts.series > 0) loadSeries(1, DISPLAY_LIMIT); if (contentTypeCounts.animation > 0) loadAnimations(1, DISPLAY_LIMIT); }

function loadMovies(page = 1, limit = DISPLAY_LIMIT) {
  const movieList = document.getElementById('movieList'), moviePagination = document.getElementById('moviePagination');
  const movies = allPosts.filter(post => (post.ContentType || 'movie') === 'movie');
  const startIndex = (page - 1) * limit, endIndex = Math.min(startIndex + limit, movies.length), pageMovies = movies.slice(startIndex, endIndex);
  if (page === 1) { movieList.innerHTML = ''; displayedCounts.movie = 0; }
  if (pageMovies.length === 0) { if (page === 1) movieList.innerHTML = `<div class="col-12 text-center py-4"><i class="fas fa-film fa-3x text-white-50 mb-3"></i><h4 class="text-white">No movies available</h4><p class="text-white-50">Check back later for new movie releases.</p></div>`; return; }
  pageMovies.forEach(post => { movieList.appendChild(createPostCard(post)); displayedCounts.movie++; });
  moviePagination.style.display = movies.length > displayedCounts.movie ? 'block' : 'none';
  loadMorePages.movie = page;
}

function loadSeries(page = 1, limit = DISPLAY_LIMIT) {
  const seriesList = document.getElementById('seriesList'), seriesPagination = document.getElementById('seriesPagination');
  const series = allPosts.filter(post => (post.ContentType || 'movie') === 'series');
  const startIndex = (page - 1) * limit, endIndex = Math.min(startIndex + limit, series.length), pageSeries = series.slice(startIndex, endIndex);
  if (page === 1) { seriesList.innerHTML = ''; displayedCounts.series = 0; }
  if (pageSeries.length === 0) { if (page === 1) seriesList.innerHTML = `<div class="col-12 text-center py-4"><i class="fas fa-tv fa-3x text-white-50 mb-3"></i><h4 class="text-white">No series available</h4><p class="text-white-50">Check back later for new TV series.</p></div>`; return; }
  pageSeries.forEach(post => { seriesList.appendChild(createPostCard(post)); displayedCounts.series++; });
  seriesPagination.style.display = series.length > displayedCounts.series ? 'block' : 'none';
  loadMorePages.series = page;
}

function loadAnimations(page = 1, limit = DISPLAY_LIMIT) {
  const animationList = document.getElementById('animationList'), animationPagination = document.getElementById('animationPagination');
  const animations = allPosts.filter(post => (post.ContentType || 'movie') === 'animation');
  const startIndex = (page - 1) * limit, endIndex = Math.min(startIndex + limit, animations.length), pageAnimations = animations.slice(startIndex, endIndex);
  if (page === 1) { animationList.innerHTML = ''; displayedCounts.animation = 0; }
  if (pageAnimations.length === 0) { if (page === 1) animationList.innerHTML = `<div class="col-12 text-center py-4"><i class="fas fa-robot fa-3x text-white-50 mb-3"></i><h4 class="text-white">No animations available</h4><p class="text-white-50">Check back later for new animated content.</p></div>`; return; }
  pageAnimations.forEach(post => { animationList.appendChild(createPostCard(post)); displayedCounts.animation++; });
  animationPagination.style.display = animations.length > displayedCounts.animation ? 'block' : 'none';
  loadMorePages.animation = page;
}

function loadHotFeaturedContent() {
  const hotMovieList = document.getElementById('hotMovieList'), hotSeriesList = document.getElementById('hotSeriesList'), hotAnimationList = document.getElementById('hotAnimationList'), hotSeriesRow = document.getElementById('hotSeriesRow'), hotAnimationRow = document.getElementById('hotAnimationRow');
  const hotPosts = allPosts.filter(post => post.IsHot === "TRUE" || post.IsHot === true);
  const popularMovies = popularPosts.filter(post => (post.ContentType || 'movie') === 'movie').slice(0, 4);
  const popularSeries = popularPosts.filter(post => (post.ContentType || 'movie') === 'series').slice(0, 4);
  const popularAnimations = popularPosts.filter(post => (post.ContentType || 'movie') === 'animation').slice(0, 4);
  const hotMovies = hotPosts.filter(post => (post.ContentType || 'movie') === 'movie'), hotSeries = hotPosts.filter(post => (post.ContentType || 'movie') === 'series'), hotAnimations = hotPosts.filter(post => (post.ContentType || 'movie') === 'animation');
  hotMovieList.innerHTML = '';
  const trendingMovies = [...hotMovies, ...popularMovies].filter((p,i,s)=>i===s.findIndex(x=>x.ID===p.ID)).slice(0,4);
  if (trendingMovies.length > 0) trendingMovies.forEach(post => hotMovieList.appendChild(createPostCard(post)));
  else hotMovieList.innerHTML = `<div class="col-12 text-center py-4"><p class="text-white-50">No trending movies available</p></div>`;
  if (hotSeries.length > 0 || popularSeries.length > 0) {
    hotSeriesRow.style.display = 'block'; hotSeriesList.innerHTML = '';
    const trendingSeries = [...hotSeries, ...popularSeries].filter((p,i,s)=>i===s.findIndex(x=>x.ID===p.ID)).slice(0,4);
    trendingSeries.forEach(post => hotSeriesList.appendChild(createPostCard(post)));
  } else hotSeriesRow.style.display = 'none';
  if (hotAnimations.length > 0 || popularAnimations.length > 0) {
    hotAnimationRow.style.display = 'block'; hotAnimationList.innerHTML = '';
    const trendingAnimations = [...hotAnimations, ...popularAnimations].filter((p,i,s)=>i===s.findIndex(x=>x.ID===p.ID)).slice(0,4);
    trendingAnimations.forEach(post => hotAnimationList.appendChild(createPostCard(post)));
  } else hotAnimationRow.style.display = 'none';
}

function loadMore(type) { switch(type) { case 'movie': loadMovies(loadMorePages.movie + 1, DISPLAY_LIMIT); break; case 'series': loadSeries(loadMorePages.series + 1, DISPLAY_LIMIT); break; case 'animation': loadAnimations(loadMorePages.animation + 1, DISPLAY_LIMIT); break; } }

function createPostCard(post) {
  const col = document.createElement("div"); col.className = "col-lg-3 col-md-6 post-col";
  const textPreview = createTextPreview(post.Paragraph, 3);
  const contentType = post.ContentType || 'movie';
  const isHotPost = post.IsHot === "TRUE" || post.IsHot === true;
  let displayDate = post.CreatedAt;
  try { const date = new Date(post.CreatedAt); if (!isNaN(date.getTime())) displayDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); } catch(e) {}
  let genreBadges = '';
  if (post.Genres) { const genres = post.Genres.split(',').map(g=>g.trim()).filter(g=>g).slice(0,2); genres.forEach(genre=>{ genreBadges += `<span class="genre-badge">${genre}</span>`; }); if (post.Genres.split(',').length > 2) genreBadges += `<span class="genre-badge">+${post.Genres.split(',').length-2}</span>`; } else genreBadges = '';
  let ratingStars = '';
  if (post.Rating && parseFloat(post.Rating) > 0) {
    const rating = parseFloat(post.Rating);
    const fullStars = Math.floor(rating), hasHalfStar = (rating % 1) >= 0.5;
    ratingStars = '<div class="rating-mini"><div class="stars-row">';
    for (let i = 1; i <= 10; i++) {
      if (i <= fullStars) ratingStars += '<i class="fas fa-star"></i>';
      else if (i === fullStars + 1 && hasHalfStar) ratingStars += '<i class="fas fa-star-half-alt"></i>';
      else ratingStars += '<i class="far fa-star"></i>';
    }
    ratingStars += `</div><div class="rating-number">${rating.toFixed(1)}/10</div></div>`;
  }
  const contentTypeIcon = getContentTypeIcon(contentType);
  const contentTypeDisplay = `<div class="post-content-type ${contentType}"><i class="fas ${contentTypeIcon}"></i></div>`;
  const hotBadge = isHotPost ? `<div class="hot-card-badge"><i class="fa-solid fa-fire-flame-curved"></i> HOT</div>` : '';
  const viewBadge = post.Views > 0 ? `<div class="view-count-badge" title="${post.Views} views"><i class="fas fa-eye me-1"></i>${formatViewCount(post.Views)}</div>` : '';
  
  // Use local placeholder instead of via.placeholder.com
  const imageUrl = post.ImageURL || NO_IMAGE_PLACEHOLDER;
  
  col.innerHTML = `<div class="post-card">${contentTypeDisplay}${hotBadge}${viewBadge}<img src="${imageUrl}" class="post-img" alt="${post.Title || 'Post Image'}" onerror="this.src='${NO_IMAGE_PLACEHOLDER}'"><div class="card-body"><h5 class="post-title">${post.Title || 'Untitled Post'}</h5>${ratingStars ? `<div class="post-rating mb-2">${ratingStars}</div>` : ''}${genreBadges ? `<div class="post-genres mb-2">${genreBadges}</div>` : ''}<div class="truncate">${textPreview || 'No content available'}</div><div class="post-meta"><i class="far fa-calendar me-1"></i> ${displayDate}${isHotPost ? '<i class="fa-solid fa-fire-flame-curved text-danger ms-2" title="HOT"></i>' : ''}<span class="ms-2 text-info" title="${post.Views || 0} views"><i class="fas fa-eye me-1"></i>${post.Views || 0}</span></div><div class="d-flex flex-wrap gap-2"><a href="?post=${post.ID}" class="btn btn-primary btn-custom btn-primary-custom btn-sm" onclick="handleWatchNowClick('${post.ID}')"><i class="fas fa-play-circle me-1"></i>Watch Now</a><button class="btn btn-secondary btn-custom btn-secondary-custom btn-sm" onclick="sharePost('${post.ID}')"><i class="fas fa-share-alt me-1"></i>Share</button></div></div></div>`;
  return col;
}

// ==================== Handle Watch Now Click ====================
async function handleWatchNowClick(postId) {
  // Track view - will only count once
  trackPostView(postId);
  showNotification('Loading content...', 'info');
  
  try {
    const response = await fetch(`${API_URL}?action=getPosts&from=mmovie.site`);
    const posts = await response.json();
    const post = posts.find(p => p.ID == postId);
    
    if (!post) {
      showNotification('Post not found', 'danger');
      return;
    }
    
    pendingPostData = post;
    pendingPostId = postId;
    await showAdForPost(postId, 'both');
    
    if (!isAdShowing && pendingPostData) {
      displaySinglePostDirectly(pendingPostData);
      pendingPostData = null;
      pendingPostId = null;
    }
    
    const url = new URL(window.location);
    url.searchParams.set('post', postId);
    window.history.pushState({}, '', url);
  } catch (error) {
    console.error('Error loading post:', error);
    showNotification('Error loading content. Please try again.', 'danger');
    pendingPostData = null;
    pendingPostId = null;
  }
}

// ==================== Display Single Post ====================
function displaySinglePostDirectly(post) {
  document.getElementById('mainPage').style.display = 'none';
  document.getElementById('singlePostPage').style.display = 'block';
  
  document.getElementById('singlePostTitle').textContent = post.Title || 'Untitled Post';
  let displayDate = post.CreatedAt;
  try { 
    const date = new Date(post.CreatedAt); 
    if (!isNaN(date.getTime())) {
      displayDate = date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  } catch(e) {}
  document.getElementById('singlePostDate').textContent = `Posted on: ${displayDate}`;
  
  const imageElement = document.getElementById('singlePostImage');
  imageElement.src = post.ImageURL || NO_IMAGE_PLACEHOLDER;
  imageElement.alt = post.Title || 'Post Image';
  imageElement.onerror = function() { 
    this.src = NO_IMAGE_PLACEHOLDER; 
  };
  
  document.getElementById('singlePostContent').innerHTML = post.Paragraph || '<p>No content available.</p>';
  
  // ===== DISPLAY EPISODES FOR SERIES =====
  displayEpisodes(post);
  
  // ===== VIDEO PLAYER SETUP =====
  currentVideoUrl = post.DownloadLink || '';
  const watchBtn = document.getElementById('singlePostWatchBtn');
  const watchLink = document.getElementById('singlePostWatch');
  const videoContainer = document.getElementById('videoPlayerContainer');
  
  if (videoContainer) {
    videoContainer.style.display = 'none';
    document.getElementById('videoPlayer').innerHTML = '';
  }
  
  if (currentVideoUrl && currentVideoUrl.trim() !== '') {
    if (isValidVideoUrl(currentVideoUrl)) {
      watchBtn.style.display = 'inline-block';
      watchLink.style.display = 'none';
    } else {
      watchBtn.style.display = 'none';
      watchLink.style.display = 'inline-block';
      watchLink.href = currentVideoUrl;
    }
  } else {
    watchBtn.style.display = 'none';
    watchLink.style.display = 'none';
  }
  
  // Add view count
  const existingViewCount = document.getElementById('viewCount');
  if (existingViewCount) existingViewCount.remove();
  const viewCountElement = document.createElement('div');
  viewCountElement.id = 'viewCount';
  viewCountElement.className = 'view-count-display mb-4';
  viewCountElement.innerHTML = `<h4><i class="fas fa-eye me-2"></i>Views</h4><div class="view-count-number"><i class="fas fa-chart-line me-2"></i><span class="display-4">${post.Views || 0}</span><span class="text-muted ms-2">views</span></div>`;
  const hotBadgeContainer = document.getElementById('hotBadgeContainer');
  if (hotBadgeContainer) hotBadgeContainer.parentNode.insertBefore(viewCountElement, hotBadgeContainer);
  else {
    const contentTypeBadgeContainer = document.getElementById('contentTypeBadgeContainer');
    if (contentTypeBadgeContainer) contentTypeBadgeContainer.parentNode.insertBefore(viewCountElement, contentTypeBadgeContainer);
    else {
      const genresContainer = document.getElementById('genresContainer');
      if (genresContainer) genresContainer.parentNode.insertBefore(viewCountElement, genresContainer);
      else document.getElementById('singlePostContent').prepend(viewCountElement);
    }
  }
  
  // HOT Badge
  const isHotPost = post.IsHot === "TRUE" || post.IsHot === true;
  if (isHotPost && hotBadgeContainer) hotBadgeContainer.style.display = 'flex';
  else if (hotBadgeContainer) hotBadgeContainer.style.display = 'none';
  
  // Content Type Badge
  const contentTypeBadgeContainer = document.getElementById('contentTypeBadgeContainer');
  const contentTypeBadge = document.getElementById('contentTypeBadge');
  const contentType = post.ContentType || 'movie';
  if (contentType && contentTypeBadgeContainer && contentTypeBadge) {
    contentTypeBadgeContainer.style.display = 'flex';
    contentTypeBadge.className = `badge content-type-badge ${contentType}`;
    const icon = getContentTypeIcon(contentType);
    const displayName = capitalizeFirstLetter(contentType);
    contentTypeBadge.innerHTML = `<i class="fas ${icon} me-1"></i>${displayName}`;
  } else if (contentTypeBadgeContainer) contentTypeBadgeContainer.style.display = 'none';
  
  // Genres & Rating
  displayGenres(post.Genres);
  displayRating(post.Rating);
  
  // Trailer
  const trailerBtn = document.getElementById('singlePostTrailerBtn');
  if (post.TrailerLink && post.TrailerLink.trim() !== '') {
    currentTrailerLink = post.TrailerLink;
    trailerBtn.style.display = "inline-block";
  } else {
    currentTrailerLink = '';
    trailerBtn.style.display = "none";
  }
  
  document.getElementById('trailerContainer').style.display = 'none';
  document.title = `${post.Title || 'Post'} - M-Movie`;
  
  if (autoRefreshInterval) clearInterval(autoRefreshInterval);
}

function formatViewCount(views) { if (views >= 1000000) return (views/1000000).toFixed(1)+'M'; else if (views >= 1000) return (views/1000).toFixed(1)+'K'; return views.toString(); }

// ==================== HOT FILTER FUNCTIONS ====================
function initHotFeature() { updateHotFilterButton(); }

function updateHotFilterButton() {
  const hotBtn = document.getElementById('hotFilterBtnUser'); if (!hotBtn) return;
  if (showHotOnly) { hotBtn.classList.add('active'); hotBtn.innerHTML = `<i class="fa-solid fa-fire-flame-curved me-1"></i>HOT (${hotPostsCount})`; }
  else { hotBtn.classList.remove('active'); hotBtn.innerHTML = `<i class="fa-solid fa-fire-flame-curved me-1"></i>HOT`; if (hotPostsCount > 0) { const c = document.createElement('span'); c.className = 'hot-posts-counter'; c.textContent = hotPostsCount; hotBtn.appendChild(c); } }
}

function toggleHotFilter() {
  showHotOnly = !showHotOnly; updateHotFilterButton();
  if (showHotOnly) { document.getElementById('contentTypeSections').style.display = 'none'; document.getElementById('hotFeaturedSection').style.display = 'none'; document.getElementById('filteredView').style.display = 'block'; }
  updateActiveFiltersDisplay(); applyFilters();
  if (showHotOnly) showNotification(`Showing ${hotPostsCount} HOT content`, 'warning');
  else { showNotification('Showing all content', 'info'); if (!selectedContentType && !selectedGenre && !isSearching) { document.getElementById('contentTypeSections').style.display = 'block'; document.getElementById('filteredView').style.display = 'none'; const hotPosts = allPosts.filter(p=>p.IsHot==="TRUE"||p.IsHot===true); if (hotPosts.length>0) document.getElementById('hotFeaturedSection').style.display = 'block'; } }
}

function clearHotFilter() { if (!showHotOnly) return; showHotOnly = false; updateHotFilterButton(); updateActiveFiltersDisplay(); if (!selectedContentType && !selectedGenre && !isSearching) { document.getElementById('contentTypeSections').style.display = 'block'; document.getElementById('filteredView').style.display = 'none'; const hotPosts = allPosts.filter(p=>p.IsHot==="TRUE"||p.IsHot===true); if (hotPosts.length>0) document.getElementById('hotFeaturedSection').style.display = 'block'; } else applyFilters(); showNotification('HOT filter cleared', 'info'); }

// ==================== GENRE FILTER FUNCTIONS ====================
function extractAllGenres() { allGenres = []; genrePostCounts = {}; allPosts.forEach(post => { if (post.Genres && post.Genres.trim() !== '') { post.Genres.split(',').map(g=>g.trim()).filter(g=>g).forEach(genre => { if (!allGenres.includes(genre)) { allGenres.push(genre); genrePostCounts[genre] = 1; } else genrePostCounts[genre]++; }); } }); allGenres.sort(); }

function populateGenreDropdown() {
  const dropdownMenu = document.getElementById('genreDropdownMenu'); const loadingElement = dropdownMenu.querySelector('.loading-genres'); if (loadingElement) loadingElement.remove();
  allGenres.forEach(genre => { const li = document.createElement('li'); li.innerHTML = `<a class="dropdown-item genre-filter-item" href="#" data-genre="${genre}">${genre}<span class="genre-count">${genrePostCounts[genre]||0}</span></a>`; dropdownMenu.appendChild(li); });
  document.querySelectorAll('.genre-filter-item').forEach(item => { item.addEventListener('click', function(e) { e.preventDefault(); const genre = this.getAttribute('data-genre'); filterByGenre(genre); const dropdown = document.getElementById('genreDropdown'); const bsDropdown = bootstrap.Dropdown.getInstance(dropdown); if (bsDropdown && window.innerWidth < 768) bsDropdown.hide(); }); });
}

function filterByGenre(genre) { if (genre === 'all') { clearGenreFilter(); return; } selectedGenre = genre; document.getElementById('genreDropdown').innerHTML = `<i class="fas fa-tags me-1"></i>${genre}`; document.getElementById('contentTypeSections').style.display = 'none'; document.getElementById('hotFeaturedSection').style.display = 'none'; document.getElementById('filteredView').style.display = 'block'; updateActiveFiltersDisplay(); applyFilters(); showNotification(`Filtering by genre: ${genre}`, 'info'); }

function clearGenreFilter() { selectedGenre = null; document.getElementById('genreDropdown').innerHTML = `<i class="fas fa-tags me-1"></i>All Genres`; updateActiveFiltersDisplay(); if (!selectedContentType && !showHotOnly && !isSearching) { document.getElementById('contentTypeSections').style.display = 'block'; document.getElementById('filteredView').style.display = 'none'; const hotPosts = allPosts.filter(p=>p.IsHot==="TRUE"||p.IsHot===true); if (hotPosts.length>0) document.getElementById('hotFeaturedSection').style.display = 'block'; } else applyFilters(); showNotification('Genre filter cleared', 'info'); }

function clearAllFilters() { showHotOnly = false; selectedGenre = null; selectedContentType = null; clearSearch(); document.getElementById('contentTypeDropdown').innerHTML = `<i class="fas fa-film me-1"></i>All Content`; document.getElementById('genreDropdown').innerHTML = `<i class="fas fa-tags me-1"></i>All Genres`; updateHotFilterButton(); document.getElementById('contentTypeSections').style.display = 'block'; document.getElementById('filteredView').style.display = 'none'; const hotPosts = allPosts.filter(p=>p.IsHot==="TRUE"||p.IsHot===true); if (hotPosts.length>0) document.getElementById('hotFeaturedSection').style.display = 'block'; updateActiveFiltersDisplay(); loadContentTypeSections(); showNotification('All filters cleared', 'success'); }

function updateActiveFiltersDisplay() {
  const activeFiltersDiv = document.getElementById('activeFilters'), activeFiltersText = document.getElementById('activeFiltersText'), clearHotBtn = document.getElementById('clearHotFilterBtn'), clearContentTypeBtn = document.getElementById('clearContentTypeFilterBtn'), clearGenreBtn = document.getElementById('clearGenreFilterBtn');
  let filters = [];
  if (showHotOnly) { filters.push(`<strong><i class="fa-solid fa-fire-flame-curved text-danger me-1"></i>HOT</strong>`); clearHotBtn.style.display = 'inline-block'; } else clearHotBtn.style.display = 'none';
  if (selectedContentType) { const dn = capitalizeFirstLetter(selectedContentType), icon = getContentTypeIcon(selectedContentType); filters.push(`<i class="fas ${icon} me-1"></i>${dn}`); clearContentTypeBtn.style.display = 'inline-block'; } else clearContentTypeBtn.style.display = 'none';
  if (selectedGenre) { filters.push(`Genre: <strong>${selectedGenre}</strong>`); clearGenreBtn.style.display = 'inline-block'; } else clearGenreBtn.style.display = 'none';
  if (isSearching) { const searchInput = document.getElementById('searchInput'); filters.push(`Search: <strong>"${searchInput.value}"</strong>`); }
  if (filters.length > 0) { activeFiltersText.innerHTML = `Active filters: ${filters.join(' • ')}`; activeFiltersDiv.style.display = 'block'; } else activeFiltersDiv.style.display = 'none';
}

function applyFilters() {
  filteredPosts = allPosts;
  if (showHotOnly) filteredPosts = filteredPosts.filter(post => post.IsHot === "TRUE" || post.IsHot === true);
  if (selectedContentType) filteredPosts = filteredPosts.filter(post => (post.ContentType || 'movie') === selectedContentType);
  if (selectedGenre) filteredPosts = filteredPosts.filter(post => { if (!post.Genres) return false; return post.Genres.split(',').map(g=>g.trim()).includes(selectedGenre); });
  if (isSearching) { const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase(); filteredPosts = filteredPosts.filter(post => (post.Title?.toLowerCase()||'').includes(searchTerm) || (post.Paragraph?.toLowerCase()||'').includes(searchTerm) || (post.Genres?.toLowerCase()||'').includes(searchTerm)); }
  if (document.getElementById('filteredView').style.display === 'block') { currentPage = 1; renderPosts(currentPage); renderPagination(); updateActiveFiltersDisplay(); }
}

function displayGenres(genresString) { const genresContainer = document.getElementById('genresContainer'), genresTags = document.getElementById('postGenres'); if (!genresString || genresString.trim() === '') { genresContainer.style.display = 'none'; return; } const genres = genresString.split(',').map(g=>g.trim()).filter(g=>g); if (genres.length === 0) { genresContainer.style.display = 'none'; return; } genresTags.innerHTML = ''; genres.forEach(genre => { const tag = document.createElement('span'); tag.className = 'genre-tag'; tag.textContent = genre; genresTags.appendChild(tag); }); genresContainer.style.display = 'block'; }

function displayRating(rating) { const ratingContainer = document.getElementById('ratingContainer'), ratingStars = document.getElementById('postRatingStars'), ratingText = document.getElementById('postRatingText'); if (!rating || parseFloat(rating) <= 0) { ratingContainer.style.display = 'none'; return; } const numericRating = parseFloat(rating); ratingStars.innerHTML = ''; for (let i = 1; i <= 10; i++) { const star = document.createElement('span'); star.className = 'rating-star'; if (i <= Math.floor(numericRating)) { star.innerHTML = '<i class="fas fa-star"></i>'; star.style.color = '#ffc107'; } else if (i === Math.floor(numericRating) + 1 && (numericRating % 1) >= 0.5) { star.innerHTML = '<i class="fas fa-star-half-alt"></i>'; star.style.color = '#ffc107'; } else { star.innerHTML = '<i class="far fa-star"></i>'; star.style.color = '#ccc'; } ratingStars.appendChild(star); } ratingText.textContent = `${numericRating.toFixed(1)}/10`; ratingContainer.style.display = 'block'; }

// ==================== TRAILER FUNCTIONS ====================
function showTrailer() { if (!currentTrailerLink) return; const trailerContainer = document.getElementById('trailerContainer'), trailerVideoDiv = document.getElementById('trailerVideo'); if (youtubePlayer) { youtubePlayer.stopVideo(); youtubePlayer = null; } trailerVideoDiv.innerHTML = ''; let videoId = extractYouTubeVideoId(currentTrailerLink); if (!videoId) { trailerVideoDiv.innerHTML = `<iframe src="${currentTrailerLink}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100%;height:100%;border:none;"></iframe>`; } else { const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&showinfo=0`; trailerVideoDiv.innerHTML = `<iframe src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100%;height:100%;border:none;" referrerpolicy="strict-origin-when-cross-origin"></iframe>`; } trailerContainer.style.display = 'block'; trailerContainer.scrollIntoView({ behavior: 'smooth', block: 'start' }); document.getElementById('singlePostTrailerBtn').style.display = 'none'; }

function closeTrailer() { const trailerContainer = document.getElementById('trailerContainer'), trailerVideoDiv = document.getElementById('trailerVideo'); trailerVideoDiv.innerHTML = ''; trailerContainer.style.display = 'none'; if (currentTrailerLink) document.getElementById('singlePostTrailerBtn').style.display = 'inline-block'; }

function extractYouTubeVideoId(url) { if (!url) return null; const patterns = [/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/, /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/, /youtu\.be\/([a-zA-Z0-9_-]{11})/]; for (let pattern of patterns) { const match = url.match(pattern); if (match && match[1]) return match[1]; } return null; }

function performSearch() { const searchInput = document.getElementById('searchInput'), searchTerm = searchInput.value.trim().toLowerCase(), clearBtn = document.querySelector('.search-clear'); if (searchTerm === '') { clearSearch(); return; } isSearching = true; currentPage = 1; const searchResultsDiv = document.getElementById('searchResults'), searchResultsText = document.getElementById('searchResultsText'); document.getElementById('contentTypeSections').style.display = 'none'; document.getElementById('hotFeaturedSection').style.display = 'none'; document.getElementById('filteredView').style.display = 'block'; applyFilters(); if (filteredPosts.length > 0) searchResultsText.textContent = `Found ${filteredPosts.length} result(s) for "${searchTerm}"`; else searchResultsText.textContent = `No results found for "${searchTerm}"`; searchResultsDiv.style.display = 'block'; clearBtn.style.display = 'block'; document.getElementById('filteredViewTitle').textContent = `Search Results`; updateActiveFiltersDisplay(); showNotification(`Search results for: ${searchTerm}`, 'info'); }

function clearSearch() { const searchInput = document.getElementById('searchInput'), searchResultsDiv = document.getElementById('searchResults'), clearBtn = document.querySelector('.search-clear'); searchInput.value = ''; isSearching = false; searchResultsDiv.style.display = 'none'; clearBtn.style.display = 'none'; if (!selectedContentType && !showHotOnly && !selectedGenre) { document.getElementById('contentTypeSections').style.display = 'block'; document.getElementById('filteredView').style.display = 'none'; const hotPosts = allPosts.filter(p=>p.IsHot==="TRUE"||p.IsHot===true); if (hotPosts.length>0) document.getElementById('hotFeaturedSection').style.display = 'block'; } else applyFilters(); }

// ==================== AUTO-REFRESH FUNCTIONS ====================

/**
 * Start auto-refresh interval (1 minute = 60000 ms)
 * Silently fetches new posts without page reload
 */
function startAutoRefresh() {
  if (autoRefreshInterval) clearInterval(autoRefreshInterval);
  autoRefreshInterval = setInterval(() => {
    silentRefreshPosts();
  }, 60000); // 1 minute
}

/**
 * Silent refresh - fetches new posts without reloading the page
 * Shows notification only if new posts are found
 */
async function silentRefreshPosts() {
  try {
    const response = await fetch(`${API_URL}?action=getPosts&from=mmovie.site`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const newPosts = await response.json();
    if (!Array.isArray(newPosts)) return;
    
    // Sort new posts
    const sortedNew = [...newPosts].sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));
    const sortedOld = [...allPosts].sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));
    
    // Check if there are new posts (by comparing IDs)
    const oldIds = new Set(sortedOld.map(p => p.ID));
    const newPostIds = sortedNew.filter(p => !oldIds.has(p.ID));
    
    if (newPostIds.length > 0) {
      // Update data
      allPosts = sortedNew;
      postsCache = allPosts;
      
      // Update genre lists
      extractAllGenres();
      populateGenreDropdown();
      
      // Update counts
      countContentTypePosts();
      updateContentTypeCounts();
      
      // Check if we're on the main page (not single post)
      const isMainPage = document.getElementById('mainPage').style.display !== 'none';
      
      if (isMainPage) {
        // Check current view mode
        const isFilteredView = document.getElementById('filteredView').style.display === 'block';
        const isContentTypeView = document.getElementById('contentTypeSections').style.display !== 'none';
        
        if (isFilteredView) {
          // If in filtered view, re-apply filters
          applyFilters();
        } else if (isContentTypeView) {
          // If in content type sections, reload sections
          loadContentTypeSections();
          loadHotFeaturedContent();
        } else {
          // Fallback - reload everything
          loadContentTypeSections();
          loadHotFeaturedContent();
        }
        
        // Show notification
        showNewPostNotification(newPostIds.length);
      }
    }
  } catch (error) {
    console.error('Silent refresh error:', error);
  }
}

/**
 * Show new post notification with dismiss option
 */
function showNewPostNotification(count) {
  // Remove existing notifications
  document.querySelectorAll('.new-post-notification').forEach(notif => notif.remove());
  
  const notification = document.createElement('div');
  notification.className = 'new-post-notification alert alert-info alert-dismissible fade show position-fixed';
  notification.style.top = '80px';
  notification.style.right = '20px';
  notification.style.zIndex = '9999';
  notification.style.minWidth = '300px';
  notification.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
  notification.style.borderRadius = '12px';
  
  notification.innerHTML = `
    <div class="d-flex align-items-center">
      <i class="fas fa-bell me-2 text-primary"></i>
      <strong>${count} new post${count > 1 ? 's' : ''} available!</strong>
      <button type="button" class="btn-close ms-3" onclick="this.parentElement.parentElement.remove()"></button>
    </div>
    <div class="mt-2">
      <button class="btn btn-sm btn-primary" onclick="refreshPosts()">
        <i class="fas fa-sync-alt me-1"></i>Refresh Now
      </button>
      <button class="btn btn-sm btn-outline-secondary ms-2" onclick="this.parentElement.parentElement.remove()">
        Dismiss
      </button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Auto dismiss after 8 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }
  }, 8000);
}

/**
 * Manual refresh - called when user clicks "Refresh Now"
 */
function refreshPosts() {
  // Remove notification
  document.querySelectorAll('.new-post-notification').forEach(notif => notif.remove());
  
  // Show loading indicator
  showNotification('Refreshing content...', 'info');
  
  // Perform full refresh
  const isMainPage = document.getElementById('mainPage').style.display !== 'none';
  
  if (isMainPage) {
    loadPosts();
  } else {
    // If on single post page, reload the post
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('post');
    if (postId) {
      loadSinglePost(postId);
    } else {
      window.location.reload();
    }
  }
}

// ==================== CHECK FOR NEW POSTS (Legacy - kept for compatibility) ====================
async function checkForNewPosts() {
  // This is now handled by silentRefreshPosts()
  await silentRefreshPosts();
}

// ==================== START AUTO-REFRESH ON MAIN PAGE ====================
// Modified startAutoRefresh is called from checkPageType()

function checkPageType() { 
  const urlParams = new URLSearchParams(window.location.search); 
  const postId = urlParams.get('post'); 
  const page = parseInt(urlParams.get('page')) || 1; 
  currentPage = page; 
  if (postId) { 
    document.getElementById('mainPage').style.display = 'none'; 
    document.getElementById('singlePostPage').style.display = 'block'; 
    loadSinglePost(postId); 
    // View is tracked inside handleWatchNowClick
    if (autoRefreshInterval) clearInterval(autoRefreshInterval); 
  } else { 
    document.getElementById('mainPage').style.display = 'block'; 
    document.getElementById('singlePostPage').style.display = 'none'; 
    loadPosts(); 
    startAutoRefresh(); 
    setTimeout(() => { showPageLoadAd(); }, 1000); 
  } 
}

async function loadPosts() { try { document.getElementById('noContentMessage').style.display = 'none'; const list = document.getElementById("postList"); list.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><p class="mt-3 text-white">Loading content...</p></div>`; const res = await fetch(`${API_URL}?action=getPosts&from=mmovie.site`); if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`); const data = await res.json(); allPosts = data; allPosts.sort((a,b)=>new Date(b.CreatedAt)-new Date(a.CreatedAt)); postsCache = allPosts; if (allPosts.length === 0) { document.getElementById('noContentMessage').style.display = 'block'; document.getElementById('contentTypeSections').style.display = 'none'; document.getElementById('hotFeaturedSection').style.display = 'none'; document.getElementById('filteredView').style.display = 'none'; return; } extractAllGenres(); populateGenreDropdown(); initContentType(); loadContentTypeSections(); loadPopularPosts(); } catch (error) { console.error("Error loading posts:", error); const list = document.getElementById("postList"); list.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle fa-3x mb-4"></i><h3>Error loading content</h3><p class="mb-3">${error.message}</p><button class="btn btn-primary btn-custom btn-primary-custom" onclick="loadPosts()"><i class="fas fa-redo me-2"></i>Try Again</button></div>`; document.getElementById('pagination').style.display = 'none'; } }

function createTextPreview(html, maxLines = 3) { if (!html) return ''; const temp = document.createElement('div'); temp.innerHTML = html; const text = temp.textContent || temp.innerText || ''; const lines = text.split('\n').filter(line => line.trim() !== ''); const preview = lines.slice(0, maxLines).join(' '); if (preview.length > 150) return preview.substring(0,147)+'...'; return preview; }

function renderPosts(page) { const list = document.getElementById("postList"); list.innerHTML = ""; const postsToShow = filteredPosts; const startIndex = (page-1)*postsPerPage, endIndex = Math.min(startIndex+postsPerPage, postsToShow.length), pagePosts = postsToShow.slice(startIndex, endIndex); if (pagePosts.length === 0 && page > 1) { currentPage = 1; renderPosts(1); return; } if (pagePosts.length === 0) { let message = '', icon = 'fas fa-search'; if (showHotOnly && selectedContentType && selectedGenre && isSearching) message = 'No posts match all your filters and search term.'; else if (showHotOnly && selectedContentType && selectedGenre) message = 'No HOT posts found in the selected content type and genre.'; else if (showHotOnly && selectedContentType) message = 'No HOT posts found in the selected content type.'; else if (showHotOnly && selectedGenre) message = 'No HOT posts found in the selected genre.'; else if (selectedContentType && selectedGenre) message = `No ${selectedContentType} found in the "${selectedGenre}" genre.`; else if (selectedContentType) message = `No ${selectedContentType} available.`; else if (selectedGenre) message = `No posts found in the "${selectedGenre}" genre.`; else if (isSearching) message = 'No results found for your search term.'; else { message = 'No posts on this page. Try going back to page 1.'; icon = 'fas fa-inbox'; } list.innerHTML = `<div class="empty-state"><i class="${icon} fa-3x mb-4"></i><h3>No results found</h3><p>${message}</p><button class="btn btn-primary btn-custom btn-primary-custom mt-3" onclick="clearAllFilters()"><i class="fas fa-times me-2"></i>Clear All Filters</button></div>`; return; } pagePosts.forEach((post, index) => { const col = createPostCard(post); col.style.animationDelay = `${index * 0.1}s`; list.appendChild(col); }); }

function renderPagination() { const pagination = document.getElementById("pagination"), postsToShow = filteredPosts; if (postsToShow.length <= postsPerPage) { pagination.style.display = "none"; return; } pagination.style.display = "flex"; const totalPages = Math.ceil(postsToShow.length / postsPerPage); if (currentPage > totalPages) currentPage = totalPages; if (currentPage < 1) currentPage = 1; const paginationList = document.querySelector("#pagination .pagination"); if (!paginationList) return; paginationList.innerHTML = ""; const prevItem = document.createElement("li"); prevItem.className = `page-item ${currentPage === 1 ? "disabled" : ""}`; prevItem.innerHTML = `<a class="page-link pagination-btn" href="#" data-page="prev"><i class="fas fa-chevron-left"></i> Previous</a>`; paginationList.appendChild(prevItem); let startPage = Math.max(1, currentPage - 2), endPage = Math.min(totalPages, startPage + 4); if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4); if (startPage > 1) { const firstPageItem = document.createElement("li"); firstPageItem.className = "page-item"; firstPageItem.innerHTML = `<a class="page-link pagination-btn" href="#" data-page="1">1</a>`; paginationList.appendChild(firstPageItem); if (startPage > 2) { const ellipsisItem = document.createElement("li"); ellipsisItem.className = "page-item disabled"; ellipsisItem.innerHTML = `<span class="page-link">...</span>`; paginationList.appendChild(ellipsisItem); } } for (let i = startPage; i <= endPage; i++) { const pageItem = document.createElement("li"); pageItem.className = `page-item ${i === currentPage ? "active" : ""}`; pageItem.innerHTML = `<a class="page-link pagination-btn" href="#" data-page="${i}">${i}</a>`; paginationList.appendChild(pageItem); } if (endPage < totalPages) { if (endPage < totalPages - 1) { const ellipsisItem = document.createElement("li"); ellipsisItem.className = "page-item disabled"; ellipsisItem.innerHTML = `<span class="page-link">...</span>`; paginationList.appendChild(ellipsisItem); } const lastPageItem = document.createElement("li"); lastPageItem.className = "page-item"; lastPageItem.innerHTML = `<a class="page-link pagination-btn" href="#" data-page="${totalPages}">${totalPages}</a>`; paginationList.appendChild(lastPageItem); } const nextItem = document.createElement("li"); nextItem.className = `page-item ${currentPage === totalPages ? "disabled" : ""}`; nextItem.innerHTML = `<a class="page-link pagination-btn" href="#" data-page="next">Next <i class="fas fa-chevron-right"></i></a>`; paginationList.appendChild(nextItem); document.querySelectorAll(".pagination-btn").forEach(btn => { btn.addEventListener("click", function(e) { e.preventDefault(); const page = this.getAttribute("data-page"); navigateToPage(page); }); }); }

function navigateToPage(page) { if (page === "prev") { if (currentPage > 1) currentPage--; } else if (page === "next") { const postsToShow = filteredPosts; const totalPages = Math.ceil(postsToShow.length / postsPerPage); if (currentPage < totalPages) currentPage++; } else currentPage = parseInt(page); const url = new URL(window.location); url.searchParams.set('page', currentPage); window.history.pushState({}, '', url); renderPosts(currentPage); renderPagination(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

function loadSinglePost(postId) { 
  // Track view - will only count once
  trackPostView(postId);
  // Then load the post
  handleWatchNowClick(postId); 
}

function showPostNotFound() { document.getElementById('singlePostPage').innerHTML = `<div class="container my-5"><div class="single-post-container text-center py-5"><i class="fas fa-exclamation-triangle fa-4x text-warning mb-4"></i><h2>Post Not Found</h2><p class="mb-4">The post you're looking for doesn't exist or has been removed.</p><a href="?" class="btn btn-primary btn-custom btn-primary-custom"><i class="fas fa-arrow-left me-2"></i>Back to Posts</a></div></div>`; }

// ==================== SHARE FUNCTIONS (FIXED) ====================

/**
 * Share a specific post
 * @param {string} postId - The ID of the post to share
 */
function sharePost(postId) { 
  // Get current post ID from URL if not provided
  if (!postId) {
    const urlParams = new URLSearchParams(window.location.search);
    postId = urlParams.get('post');
    if (!postId) {
      showNotification('No post to share', 'warning');
      return;
    }
  }
  
  // Try to find the post in cache first
  let post = postsCache.find(p => p.ID == postId);
  
  // If not found in cache, try allPosts
  if (!post) {
    post = allPosts.find(p => p.ID == postId);
  }
  
  // If still not found, try to get from the current page display
  if (!post) {
    const urlParams = new URLSearchParams(window.location.search);
    const currentPostId = urlParams.get('post');
    if (currentPostId == postId) {
      // We're on the single post page - get data from the page
      const titleEl = document.getElementById('singlePostTitle');
      const contentEl = document.getElementById('singlePostContent');
      const imgEl = document.getElementById('singlePostImage');
      
      if (titleEl) {
        post = {
          ID: postId,
          Title: titleEl.textContent || 'M-Movie',
          Paragraph: contentEl ? contentEl.innerHTML : '',
          ImageURL: imgEl ? imgEl.src : '',
          CreatedAt: new Date().toISOString()
        };
      }
    }
  }
  
  // If post still not found, create basic share with ID only
  if (!post) {
    console.warn('Post not found in cache, sharing with ID only');
    post = { Title: 'M-Movie', Paragraph: '' };
  }
  
  const shareUrl = `${window.location.origin}${window.location.pathname}?post=${postId}`;
  const shareTitle = post.Title || 'M-Movie';
  const shareText = stripHtml(post.Paragraph || '').substring(0, 100) + '...';
  
  // Use Web Share API if available (mobile)
  if (navigator.share) {
    navigator.share({
      title: shareTitle,
      text: shareText,
      url: shareUrl
    }).catch(err => {
      // User cancelled share dialog - ignore
      if (err.name !== 'AbortError') {
        console.error('Share error:', err);
        fallbackCopyShare(shareUrl);
      }
    });
  } else {
    // Fallback: Copy to clipboard
    fallbackCopyShare(shareUrl);
  }
}

/**
 * Fallback copy to clipboard with prompt fallback
 * @param {string} shareUrl - The URL to copy/share
 */
function fallbackCopyShare(shareUrl) {
  // Try clipboard API first
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(shareUrl)
      .then(() => showNotification('Link copied to clipboard!', 'success'))
      .catch(() => {
        // If clipboard fails, show prompt with link
        prompt("Copy this link to share:", shareUrl);
      });
  } else {
    // Fallback: Show prompt with link
    prompt("Copy this link to share:", shareUrl);
  }
}

/**
 * Share current post (called from single post page)
 * This function gets the post ID from URL and calls sharePost
 */
function shareCurrentPost() {
  const urlParams = new URLSearchParams(window.location.search);
  const postId = urlParams.get('post');
  
  if (postId) {
    sharePost(postId);
  } else {
    // If no post ID, share current page URL
    const shareUrl = window.location.href;
    const shareTitle = document.title || 'M-Movie';
    
    if (navigator.share) {
      navigator.share({
        title: shareTitle,
        url: shareUrl
      }).catch(err => {
        if (err.name !== 'AbortError') {
          fallbackCopyShare(shareUrl);
        }
      });
    } else {
      fallbackCopyShare(shareUrl);
    }
  }
}

function stripHtml(html) { if (!html) return ''; const tmp = document.createElement("div"); tmp.innerHTML = html; return tmp.textContent || tmp.innerText || ""; }

function showNotification(message, type = 'info') { const notification = document.createElement('div'); notification.className = `alert alert-${type} position-fixed`; notification.style.top = '20px'; notification.style.right = '20px'; notification.style.zIndex = '9999'; notification.style.minWidth = '300px'; notification.innerHTML = `<div class="d-flex justify-content-between align-items-center"><span>${message}</span><button type="button" class="btn-close" onclick="this.parentElement.parentElement.remove()"></button></div>`; document.body.appendChild(notification); setTimeout(()=>{if(notification.parentElement)notification.remove();},3000); }

function capitalizeFirstLetter(string) { return string.charAt(0).toUpperCase() + string.slice(1); }

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('searchInput'); if (searchInput) searchInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') performSearch(); });
  document.querySelectorAll('.content-type-filter-item').forEach(item => { item.addEventListener('click', function(e) { e.preventDefault(); const type = this.getAttribute('data-type'); filterByContentType(type); const dropdown = document.getElementById('contentTypeDropdown'); const bsDropdown = bootstrap.Dropdown.getInstance(dropdown); if (bsDropdown && window.innerWidth < 768) bsDropdown.hide(); }); });
  checkPageType();
  window.addEventListener('popstate', function() { const urlParams = new URLSearchParams(window.location.search); const page = parseInt(urlParams.get('page')) || 1; const postId = urlParams.get('post'); if (postId) { document.getElementById('mainPage').style.display = 'none'; document.getElementById('singlePostPage').style.display = 'block'; loadSinglePost(postId); if (autoRefreshInterval) clearInterval(autoRefreshInterval); } else { currentPage = page; document.getElementById('mainPage').style.display = 'block'; document.getElementById('singlePostPage').style.display = 'none'; if (selectedContentType || showHotOnly || selectedGenre || isSearching) applyFilters(); else { loadContentTypeSections(); loadHotFeaturedContent(); } startAutoRefresh(); } });
  document.addEventListener('click', function(event) { const trailerContainer = document.getElementById('trailerContainer'), trailerBtn = document.getElementById('singlePostTrailerBtn'); if (trailerContainer.style.display === 'block' && !trailerContainer.contains(event.target) && event.target !== trailerBtn) closeTrailer(); });
  const backToTopButton = document.getElementById('backToTop'); if (backToTopButton) { window.addEventListener('scroll', function() { if (window.pageYOffset > 300) backToTopButton.classList.add('show'); else backToTopButton.classList.remove('show'); }); backToTopButton.addEventListener('click', function() { window.scrollTo({ top: 0, behavior: 'smooth' }); }); }
});

window.addEventListener('beforeunload', function() { if (autoRefreshInterval) clearInterval(autoRefreshInterval); if (youtubePlayer && youtubePlayer.destroy) youtubePlayer.destroy(); if (viewUpdateQueue.length > 0) processViewQueue(); });