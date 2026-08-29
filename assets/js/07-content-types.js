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

function loadMore(type) { switch(type) { case 'movie': loadMovies(loadMorePages.movie + 1, DISPLAY_LIMIT); break; case 'series': loadSeries(loadMorePages.series + 1, DISPLAY_LIMIT); break; case 'animation': loadAnimations(loadMorePages.animation + 1, DISPLAY_LIMIT); break; } }

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