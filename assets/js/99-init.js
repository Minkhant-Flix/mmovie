// ==================== INITIALIZATION ====================
function checkPageType() { 
  const urlParams = new URLSearchParams(window.location.search); 
  const postId = urlParams.get('post'); 
  const page = parseInt(urlParams.get('page')) || 1; 
  currentPage = page; 
  if (postId) { 
    document.getElementById('mainPage').style.display = 'none'; 
    document.getElementById('singlePostPage').style.display = 'block'; 
    loadSinglePost(postId); 
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

function performSearch() { const searchInput = document.getElementById('searchInput'), searchTerm = searchInput.value.trim().toLowerCase(), clearBtn = document.querySelector('.search-clear'); if (searchTerm === '') { clearSearch(); return; } isSearching = true; currentPage = 1; const searchResultsDiv = document.getElementById('searchResults'), searchResultsText = document.getElementById('searchResultsText'); document.getElementById('contentTypeSections').style.display = 'none'; document.getElementById('hotFeaturedSection').style.display = 'none'; document.getElementById('filteredView').style.display = 'block'; applyFilters(); if (filteredPosts.length > 0) searchResultsText.textContent = `Found ${filteredPosts.length} result(s) for "${searchTerm}"`; else searchResultsText.textContent = `No results found for "${searchTerm}"`; searchResultsDiv.style.display = 'block'; clearBtn.style.display = 'block'; document.getElementById('filteredViewTitle').textContent = `Search Results`; updateActiveFiltersDisplay(); showNotification(`Search results for: ${searchTerm}`, 'info'); }

function clearSearch() { const searchInput = document.getElementById('searchInput'), searchResultsDiv = document.getElementById('searchResults'), clearBtn = document.querySelector('.search-clear'); searchInput.value = ''; isSearching = false; searchResultsDiv.style.display = 'none'; clearBtn.style.display = 'none'; if (!selectedContentType && !showHotOnly && !selectedGenre) { document.getElementById('contentTypeSections').style.display = 'block'; document.getElementById('filteredView').style.display = 'none'; const hotPosts = allPosts.filter(p=>p.IsHot==="TRUE"||p.IsHot===true); if (hotPosts.length>0) document.getElementById('hotFeaturedSection').style.display = 'block'; } else applyFilters(); }

document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('searchInput'); if (searchInput) searchInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') performSearch(); });
  document.querySelectorAll('.content-type-filter-item').forEach(item => { item.addEventListener('click', function(e) { e.preventDefault(); const type = this.getAttribute('data-type'); filterByContentType(type); const dropdown = document.getElementById('contentTypeDropdown'); const bsDropdown = bootstrap.Dropdown.getInstance(dropdown); if (bsDropdown && window.innerWidth < 768) bsDropdown.hide(); }); });
  checkPageType();
  window.addEventListener('popstate', function() { const urlParams = new URLSearchParams(window.location.search); const page = parseInt(urlParams.get('page')) || 1; const postId = urlParams.get('post'); if (postId) { document.getElementById('mainPage').style.display = 'none'; document.getElementById('singlePostPage').style.display = 'block'; loadSinglePost(postId); if (autoRefreshInterval) clearInterval(autoRefreshInterval); } else { currentPage = page; document.getElementById('mainPage').style.display = 'block'; document.getElementById('singlePostPage').style.display = 'none'; if (selectedContentType || showHotOnly || selectedGenre || isSearching) applyFilters(); else { loadContentTypeSections(); loadHotFeaturedContent(); } startAutoRefresh(); } });
  document.addEventListener('click', function(event) { const trailerContainer = document.getElementById('trailerContainer'), trailerBtn = document.getElementById('singlePostTrailerBtn'); if (trailerContainer.style.display === 'block' && !trailerContainer.contains(event.target) && event.target !== trailerBtn) closeTrailer(); });
  const backToTopButton = document.getElementById('backToTop'); if (backToTopButton) { window.addEventListener('scroll', function() { if (window.pageYOffset > 300) backToTopButton.classList.add('show'); else backToTopButton.classList.remove('show'); }); backToTopButton.addEventListener('click', function() { window.scrollTo({ top: 0, behavior: 'smooth' }); }); }
});

window.addEventListener('beforeunload', function() { if (autoRefreshInterval) clearInterval(autoRefreshInterval); if (youtubePlayer && youtubePlayer.destroy) youtubePlayer.destroy(); if (viewUpdateQueue.length > 0) processViewQueue(); });