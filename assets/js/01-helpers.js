// ==================== HELPER: Google Drive URL to Thumbnail ====================
function convertGoogleDriveUrlToThumbnail(url) {
  if (!url) return url;
  if (url.includes('drive.google.com/thumbnail')) return url;
  
  const drivePattern = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
  const match = url.match(drivePattern);
  if (match) {
    const fileId = match[1];
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=s800`;
  }
  
  const downloadPattern = /drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/;
  const downloadMatch = url.match(downloadPattern);
  if (downloadMatch) {
    const fileId = downloadMatch[1];
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=s800`;
  }
  
  return url;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function stripHtml(html) { if (!html) return ''; const tmp = document.createElement("div"); tmp.innerHTML = html; return tmp.textContent || tmp.innerText || ""; }

function showNotification(message, type = 'info') { const notification = document.createElement('div'); notification.className = `alert alert-${type} position-fixed`; notification.style.top = '20px'; notification.style.right = '20px'; notification.style.zIndex = '9999'; notification.style.minWidth = '300px'; notification.innerHTML = `<div class="d-flex justify-content-between align-items-center"><span>${message}</span><button type="button" class="btn-close" onclick="this.parentElement.parentElement.remove()"></button></div>`; document.body.appendChild(notification); setTimeout(()=>{if(notification.parentElement)notification.remove();},3000); }

function capitalizeFirstLetter(string) { return string.charAt(0).toUpperCase() + string.slice(1); }