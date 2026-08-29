// ==================== TELEGRAM FUNCTIONS ====================

/**
 * Open Telegram link in new tab
 */
function openTelegramLink() {
  if (!currentTelegramLink || currentTelegramLink.trim() === '') {
    showNotification('No Telegram link available for this post', 'warning');
    return;
  }
  
  // Open in new tab
  window.open(currentTelegramLink, '_blank', 'noopener,noreferrer');
}

/**
 * Display Telegram button on single post page (NO BOX - only button)
 * @param {string} telegramLink - The Telegram post link
 * @param {string} postTitle - The post title for display
 */
function displayTelegramSection(telegramLink, postTitle) {
  const telegramBtn = document.getElementById('singlePostTelegramBtn');
  
  currentTelegramLink = telegramLink || '';
  currentPostTitle = postTitle || '';
  
  // Check if telegram link exists
  const hasTelegramLink = telegramLink && telegramLink.trim() !== '';
  
  // Show/hide the telegram button only (no box)
  if (hasTelegramLink && telegramBtn) {
    telegramBtn.style.display = 'inline-block';
  } else {
    if (telegramBtn) {
      telegramBtn.style.display = 'none';
    }
  }
}