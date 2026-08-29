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