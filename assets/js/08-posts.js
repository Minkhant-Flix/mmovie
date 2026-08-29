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
  
  const imageUrl = post.ImageURL || NO_IMAGE_PLACEHOLDER;
  
  col.innerHTML = `<div class="post-card">${contentTypeDisplay}${hotBadge}${viewBadge}<img src="${imageUrl}" class="post-img" alt="${post.Title || 'Post Image'}" onerror="this.src='${NO_IMAGE_PLACEHOLDER}'"><div class="card-body"><h5 class="post-title">${post.Title || 'Untitled Post'}</h5>${ratingStars ? `<div class="post-rating mb-2">${ratingStars}</div>` : ''}${genreBadges ? `<div class="post-genres mb-2">${genreBadges}</div>` : ''}<div class="truncate">${textPreview || 'No content available'}</div><div class="post-meta"><i class="far fa-calendar me-1"></i> ${displayDate}${isHotPost ? '<i class="fa-solid fa-fire-flame-curved text-danger ms-2" title="HOT"></i>' : ''}<span class="ms-2 text-info" title="${post.Views || 0} views"><i class="fas fa-eye me-1"></i>${post.Views || 0}</span></div><div class="d-flex flex-wrap gap-2"><a href="?post=${post.ID}" class="btn btn-primary btn-custom btn-primary-custom btn-sm" onclick="handleWatchNowClick('${post.ID}')"><i class="fas fa-play-circle me-1"></i>Watch Now</a><button class="btn btn-secondary btn-custom btn-secondary-custom btn-sm" onclick="sharePost('${post.ID}')"><i class="fas fa-share-alt me-1"></i>Share</button></div></div></div>`;
  return col;
}

// ==================== Handle Watch Now Click ====================
async function handleWatchNowClick(postId) {
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
  
  // ===== DISPLAY TELEGRAM BUTTON (NO BOX) =====
  displayTelegramSection(post.TelegramPostLink, post.Title);
  
  // ===== VIDEO PLAYER SETUP =====
  currentVideoUrl = post.DownloadLink || '';
  const watchBtn = document.getElementById('singlePostWatchBtn');
  const videoContainer = document.getElementById('videoPlayerContainer');
  
  if (videoContainer) {
    videoContainer.style.display = 'none';
    document.getElementById('videoPlayer').innerHTML = '';
  }
  
  // Show Watch Button if Movie Link exists
  if (currentVideoUrl && currentVideoUrl.trim() !== '') {
    if (isValidVideoUrl(currentVideoUrl)) {
      watchBtn.style.display = 'inline-block';
    } else {
      watchBtn.style.display = 'none';
    }
  } else {
    watchBtn.style.display = 'none';
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

function createTextPreview(html, maxLines = 3) { if (!html) return ''; const temp = document.createElement('div'); temp.innerHTML = html; const text = temp.textContent || temp.innerText || ''; const lines = text.split('\n').filter(line => line.trim() !== ''); const preview = lines.slice(0, maxLines).join(' '); if (preview.length > 150) return preview.substring(0,147)+'...'; return preview; }

function renderPosts(page) { const list = document.getElementById("postList"); list.innerHTML = ""; const postsToShow = filteredPosts; const startIndex = (page-1)*postsPerPage, endIndex = Math.min(startIndex+postsPerPage, postsToShow.length), pagePosts = postsToShow.slice(startIndex, endIndex); if (pagePosts.length === 0 && page > 1) { currentPage = 1; renderPosts(1); return; } if (pagePosts.length === 0) { let message = '', icon = 'fas fa-search'; if (showHotOnly && selectedContentType && selectedGenre && isSearching) message = 'No posts match all your filters and search term.'; else if (showHotOnly && selectedContentType && selectedGenre) message = 'No HOT posts found in the selected content type and genre.'; else if (showHotOnly && selectedContentType) message = 'No HOT posts found in the selected content type.'; else if (showHotOnly && selectedGenre) message = 'No HOT posts found in the selected genre.'; else if (selectedContentType && selectedGenre) message = `No ${selectedContentType} found in the "${selectedGenre}" genre.`; else if (selectedContentType) message = `No ${selectedContentType} available.`; else if (selectedGenre) message = `No posts found in the "${selectedGenre}" genre.`; else if (isSearching) message = 'No results found for your search term.'; else { message = 'No posts on this page. Try going back to page 1.'; icon = 'fas fa-inbox'; } list.innerHTML = `<div class="empty-state"><i class="${icon} fa-3x mb-4"></i><h3>No results found</h3><p>${message}</p><button class="btn btn-primary btn-custom btn-primary-custom mt-3" onclick="clearAllFilters()"><i class="fas fa-times me-2"></i>Clear All Filters</button></div>`; return; } pagePosts.forEach((post, index) => { const col = createPostCard(post); col.style.animationDelay = `${index * 0.1}s`; list.appendChild(col); }); }

function renderPagination() { const pagination = document.getElementById("pagination"), postsToShow = filteredPosts; if (postsToShow.length <= postsPerPage) { pagination.style.display = "none"; return; } pagination.style.display = "flex"; const totalPages = Math.ceil(postsToShow.length / postsPerPage); if (currentPage > totalPages) currentPage = totalPages; if (currentPage < 1) currentPage = 1; const paginationList = document.querySelector("#pagination .pagination"); if (!paginationList) return; paginationList.innerHTML = ""; const prevItem = document.createElement("li"); prevItem.className = `page-item ${currentPage === 1 ? "disabled" : ""}`; prevItem.innerHTML = `<a class="page-link pagination-btn" href="#" data-page="prev"><i class="fas fa-chevron-left"></i> Previous</a>`; paginationList.appendChild(prevItem); let startPage = Math.max(1, currentPage - 2), endPage = Math.min(totalPages, startPage + 4); if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4); if (startPage > 1) { const firstPageItem = document.createElement("li"); firstPageItem.className = "page-item"; firstPageItem.innerHTML = `<a class="page-link pagination-btn" href="#" data-page="1">1</a>`; paginationList.appendChild(firstPageItem); if (startPage > 2) { const ellipsisItem = document.createElement("li"); ellipsisItem.className = "page-item disabled"; ellipsisItem.innerHTML = `<span class="page-link">...</span>`; paginationList.appendChild(ellipsisItem); } } for (let i = startPage; i <= endPage; i++) { const pageItem = document.createElement("li"); pageItem.className = `page-item ${i === currentPage ? "active" : ""}`; pageItem.innerHTML = `<a class="page-link pagination-btn" href="#" data-page="${i}">${i}</a>`; paginationList.appendChild(pageItem); } if (endPage < totalPages) { if (endPage < totalPages - 1) { const ellipsisItem = document.createElement("li"); ellipsisItem.className = "page-item disabled"; ellipsisItem.innerHTML = `<span class="page-link">...</span>`; paginationList.appendChild(ellipsisItem); } const lastPageItem = document.createElement("li"); lastPageItem.className = "page-item"; lastPageItem.innerHTML = `<a class="page-link pagination-btn" href="#" data-page="${totalPages}">${totalPages}</a>`; paginationList.appendChild(lastPageItem); } const nextItem = document.createElement("li"); nextItem.className = `page-item ${currentPage === totalPages ? "disabled" : ""}`; nextItem.innerHTML = `<a class="page-link pagination-btn" href="#" data-page="next">Next <i class="fas fa-chevron-right"></i></a>`; paginationList.appendChild(nextItem); document.querySelectorAll(".pagination-btn").forEach(btn => { btn.addEventListener("click", function(e) { e.preventDefault(); const page = this.getAttribute("data-page"); navigateToPage(page); }); }); }

function navigateToPage(page) { if (page === "prev") { if (currentPage > 1) currentPage--; } else if (page === "next") { const postsToShow = filteredPosts; const totalPages = Math.ceil(postsToShow.length / postsPerPage); if (currentPage < totalPages) currentPage++; } else currentPage = parseInt(page); const url = new URL(window.location); url.searchParams.set('page', currentPage); window.history.pushState({}, '', url); renderPosts(currentPage); renderPagination(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

function loadSinglePost(postId) { 
  trackPostView(postId);
  handleWatchNowClick(postId); 
}

function showPostNotFound() { document.getElementById('singlePostPage').innerHTML = `<div class="container my-5"><div class="single-post-container text-center py-5"><i class="fas fa-exclamation-triangle fa-4x text-warning mb-4"></i><h2>Post Not Found</h2><p class="mb-4">The post you're looking for doesn't exist or has been removed.</p><a href="?" class="btn btn-primary btn-custom btn-primary-custom"><i class="fas fa-arrow-left me-2"></i>Back to Posts</a></div></div>`; }

function displayGenres(genresString) { const genresContainer = document.getElementById('genresContainer'), genresTags = document.getElementById('postGenres'); if (!genresString || genresString.trim() === '') { genresContainer.style.display = 'none'; return; } const genres = genresString.split(',').map(g=>g.trim()).filter(g=>g); if (genres.length === 0) { genresContainer.style.display = 'none'; return; } genresTags.innerHTML = ''; genres.forEach(genre => { const tag = document.createElement('span'); tag.className = 'genre-tag'; tag.textContent = genre; genresTags.appendChild(tag); }); genresContainer.style.display = 'block'; }

function displayRating(rating) { const ratingContainer = document.getElementById('ratingContainer'), ratingStars = document.getElementById('postRatingStars'), ratingText = document.getElementById('postRatingText'); if (!rating || parseFloat(rating) <= 0) { ratingContainer.style.display = 'none'; return; } const numericRating = parseFloat(rating); ratingStars.innerHTML = ''; for (let i = 1; i <= 10; i++) { const star = document.createElement('span'); star.className = 'rating-star'; if (i <= Math.floor(numericRating)) { star.innerHTML = '<i class="fas fa-star"></i>'; star.style.color = '#ffc107'; } else if (i === Math.floor(numericRating) + 1 && (numericRating % 1) >= 0.5) { star.innerHTML = '<i class="fas fa-star-half-alt"></i>'; star.style.color = '#ffc107'; } else { star.innerHTML = '<i class="far fa-star"></i>'; star.style.color = '#ccc'; } ratingStars.appendChild(star); } ratingText.textContent = `${numericRating.toFixed(1)}/10`; ratingContainer.style.display = 'block'; }