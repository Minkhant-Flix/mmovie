// ==================== SHARE FUNCTIONS ====================

function sharePost(postId) { 
  if (!postId) {
    const urlParams = new URLSearchParams(window.location.search);
    postId = urlParams.get('post');
    if (!postId) {
      showNotification('No post to share', 'warning');
      return;
    }
  }
  
  let post = postsCache.find(p => p.ID == postId);
  if (!post) {
    post = allPosts.find(p => p.ID == postId);
  }
  
  if (!post) {
    const urlParams = new URLSearchParams(window.location.search);
    const currentPostId = urlParams.get('post');
    if (currentPostId == postId) {
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
  
  if (!post) {
    console.warn('Post not found in cache, sharing with ID only');
    post = { Title: 'M-Movie', Paragraph: '' };
  }
  
  const shareUrl = `${window.location.origin}${window.location.pathname}?post=${postId}`;
  const shareTitle = post.Title || 'M-Movie';
  const shareText = stripHtml(post.Paragraph || '').substring(0, 100) + '...';
  
  if (navigator.share) {
    navigator.share({
      title: shareTitle,
      text: shareText,
      url: shareUrl
    }).catch(err => {
      if (err.name !== 'AbortError') {
        console.error('Share error:', err);
        fallbackCopyShare(shareUrl);
      }
    });
  } else {
    fallbackCopyShare(shareUrl);
  }
}

function fallbackCopyShare(shareUrl) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(shareUrl)
      .then(() => showNotification('Link copied to clipboard!', 'success'))
      .catch(() => {
        prompt("Copy this link to share:", shareUrl);
      });
  } else {
    prompt("Copy this link to share:", shareUrl);
  }
}

function shareCurrentPost() {
  const urlParams = new URLSearchParams(window.location.search);
  const postId = urlParams.get('post');
  
  if (postId) {
    sharePost(postId);
  } else {
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