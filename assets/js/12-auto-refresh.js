// ==================== AUTO-REFRESH FUNCTIONS ====================

function startAutoRefresh() {
  if (autoRefreshInterval) clearInterval(autoRefreshInterval);
  autoRefreshInterval = setInterval(() => {
    silentRefreshPosts();
  }, 60000);
}

async function silentRefreshPosts() {
  try {
    const response = await fetch(`${API_URL}?action=getPosts&from=mmovie.site`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const newPosts = await response.json();
    if (!Array.isArray(newPosts)) return;
    
    const sortedNew = [...newPosts].sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));
    const sortedOld = [...allPosts].sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));
    
    const oldIds = new Set(sortedOld.map(p => p.ID));
    const newPostIds = sortedNew.filter(p => !oldIds.has(p.ID));
    
    if (newPostIds.length > 0) {
      allPosts = sortedNew;
      postsCache = allPosts;
      
      extractAllGenres();
      populateGenreDropdown();
      
      countContentTypePosts();
      updateContentTypeCounts();
      
      const isMainPage = document.getElementById('mainPage').style.display !== 'none';
      
      if (isMainPage) {
        const isFilteredView = document.getElementById('filteredView').style.display === 'block';
        const isContentTypeView = document.getElementById('contentTypeSections').style.display !== 'none';
        
        if (isFilteredView) {
          applyFilters();
        } else if (isContentTypeView) {
          loadContentTypeSections();
          loadHotFeaturedContent();
        } else {
          loadContentTypeSections();
          loadHotFeaturedContent();
        }
        
        showNewPostNotification(newPostIds.length);
      }
    }
  } catch (error) {
    console.error('Silent refresh error:', error);
  }
}

function showNewPostNotification(count) {
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
  
  setTimeout(() => {
    if (notification.parentElement) {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }
  }, 8000);
}

function refreshPosts() {
  document.querySelectorAll('.new-post-notification').forEach(notif => notif.remove());
  showNotification('Refreshing content...', 'info');
  
  const isMainPage = document.getElementById('mainPage').style.display !== 'none';
  
  if (isMainPage) {
    loadPosts();
  } else {
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('post');
    if (postId) {
      loadSinglePost(postId);
    } else {
      window.location.reload();
    }
  }
}

async function checkForNewPosts() {
  await silentRefreshPosts();
}