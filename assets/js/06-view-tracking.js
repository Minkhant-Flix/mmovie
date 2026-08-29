// ==================== VIEW TRACKING FUNCTIONS ====================

/**
 * Track post view - prevents duplicate views
 */
function trackPostView(postId) {
  if (!postId) return;
  
  if (viewedPosts.has(postId)) {
    console.log(`[View] Post ${postId} already counted, skipping`);
    return;
  }
  
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

function formatViewCount(views) { if (views >= 1000000) return (views/1000000).toFixed(1)+'M'; else if (views >= 1000) return (views/1000).toFixed(1)+'K'; return views.toString(); }