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
  
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (youtubeMatch) {
    const videoId = youtubeMatch[1];
    return `<iframe src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&showinfo=0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen></iframe>`;
  }
  
  const fembedMatch = url.match(/fembed\.(?:com|net|co|to)\/embed\/([a-zA-Z0-9_-]+)/);
  if (fembedMatch) {
    const videoId = fembedMatch[1];
    return `<iframe src="https://fembed.co/embed/${videoId}" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen></iframe>`;
  }
  
  if (url.includes('vidoza.net')) {
    return `<iframe src="${url}" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen></iframe>`;
  }
  
  if (url.match(/\.(mp4|webm|ogg|mov)$/i)) {
    return `<video controls autoplay style="width:100%;height:100%;background:#000;">
            <source src="${url}" type="video/mp4">
            Your browser does not support video.
            </video>`;
  }
  
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