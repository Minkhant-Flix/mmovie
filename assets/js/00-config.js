const API_URL = "https://mmovie-api.mmovie.site/";
let postsCache = [];
let allPosts = [];
let filteredPosts = [];
let isSearching = false;
let currentPage = 1;
const postsPerPage = 12;
let autoRefreshInterval;
let currentTrailerLink = '';
let youtubePlayer = null;

// Telegram link variables
let currentTelegramLink = '';
let currentPostTitle = '';

// View tracking variables
let viewCounts = {};
let popularPosts = [];
let viewUpdateQueue = [];
let isUpdatingViews = false;

// ==================== VIEW TRACKING - PREVENT DUPLICATE ====================
let viewedPosts = new Set();
let viewQueueProcessing = false;

// ==================== VIDEO PLAYER VARIABLES ====================
let currentVideoUrl = '';
let videoPlayerInitialized = false;

// ==================== EPISODE VARIABLES ====================
let currentPostEpisodes = [];
let currentPostContentType = 'movie';
let currentEpisodeVideoUrl = '';
let currentEpisodeTitle = '';

// ==================== CONSTANT: No Image Placeholder ====================
const NO_IMAGE_PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"%3E%3Crect width="400" height="300" fill="%23e9ecef"/%3E%3Ctext x="50%25" y="45%25" text-anchor="middle" dy=".3em" font-family="Arial, sans-serif" font-size="20" fill="%23999"%3ENo Image%3C/text%3E%3Ctext x="50%25" y="60%25" text-anchor="middle" dy=".3em" font-family="Arial, sans-serif" font-size="14" fill="%23b0b0b0"%3ENot Available%3C/text%3E%3C/svg%3E';

const NO_IMAGE_SMALL = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200"%3E%3Crect width="400" height="200" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-family="Arial" font-size="16" fill="%23999"%3ENo Image%3C/text%3E%3C/svg%3E';