// ==================== EPISODE FUNCTIONS ====================

/**
 * Display episodes for a series post
 */
function displayEpisodes(post) {
  const episodesSection = document.getElementById('episodesSection');
  const episodesGrid = document.getElementById('episodesGrid');
  const episodeCountBadge = document.getElementById('episodeCountBadge');
  
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
 * Play episode in the video player
 */
function playEpisode(videoUrl, episodeTitle) {
  if (!videoUrl || videoUrl === '#') {
    showNotification('No video link available for this episode', 'warning');
    return;
  }
  
  currentEpisodeVideoUrl = videoUrl;
  currentEpisodeTitle = episodeTitle || 'Episode';
  openEpisodeVideoPlayer(videoUrl, episodeTitle);
}

/**
 * Open video player specifically for episode
 */
function openEpisodeVideoPlayer(videoUrl, episodeTitle) {
  const videoContainer = document.getElementById('videoPlayerContainer');
  const videoPlayer = document.getElementById('videoPlayer');
  
  if (!videoUrl) {
    showNotification('No video link available', 'warning');
    return;
  }
  
  closeTrailer();
  
  videoContainer.style.display = 'block';
  videoPlayer.innerHTML = '';
  
  const titleHtml = `
    <div class="episode-player-title">
      <i class="fas fa-play-circle text-success me-2"></i>${episodeTitle || 'Episode'}
    </div>
  `;
  
  const embedHtml = getVideoEmbedHtml(videoUrl);
  
  if (embedHtml) {
    videoPlayer.innerHTML = titleHtml + embedHtml;
    videoContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else {
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