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