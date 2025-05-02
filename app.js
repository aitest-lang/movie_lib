
// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const resultsGrid = document.getElementById('resultsGrid');
const watchedGrid = document.getElementById('watchedGrid');
const wishlistGrid = document.getElementById('wishlistGrid');
const languageFilter = document.getElementById('languageFilter');
const typeFilter = document.getElementById('typeFilter');
const sortBy = document.getElementById('sortBy');
const toast = document.getElementById('toast');
const loading = document.getElementById('loading');
const themeToggle = document.getElementById('themeToggle');
const watchedCount = document.getElementById('watchedCount');
const wishlistCount = document.getElementById('wishlistCount');

// State
let searchResults = [];
let debounceTimer;

// Initialize the app
function init() {
    loadThemePreference();
    renderLibrary();
    setupEventListeners();
}

// Set up event listeners
function setupEventListeners() {
    searchInput.addEventListener('input', handleSearchInput);
    searchButton.addEventListener('click', handleSearch);
    languageFilter.addEventListener('change', renderLibrary);
    typeFilter.addEventListener('change', renderLibrary);
    sortBy.addEventListener('change', renderLibrary);
    themeToggle.addEventListener('click', toggleTheme);
}

// Handle search input with debounce
function handleSearchInput() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        if (searchInput.value.trim() !== '') {
            handleSearch();
        } else {
            clearSearchResults();
        }
    }, 500);
}

// Handle search
async function handleSearch() {
    const query = searchInput.value.trim();
    if (query === '') {
        clearSearchResults();
        return;
    }

    showLoading(true);
    try {
        // First try TVMaze API
        const apiResults = await searchShows(query);
        searchResults = [...apiResults, ...searchLocalMovies(query)];
        renderSearchResults();
    } catch (error) {
        console.error("API search failed, using local data only", error);
        searchResults = searchLocalMovies(query);
        renderSearchResults();
        showToast("Couldn't connect to API. Showing local results only.");
    } finally {
        showLoading(false);
    }
}

// Search TVMaze API
async function searchShows(query) {
    const response = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    return data.map(item => ({
        id: `tvmaze-${item.show.id}`,
        title: item.show.name,
        year: item.show.premiered?.split("-")[0] || "N/A",
        poster: item.show.image?.medium || "./placeholder.jpg",
        rating: item.show.rating?.average || "N/A",
        type: "TV Series",
        language: item.show.language || "English"
    }));
}

// Search local movies
function searchLocalMovies(query) {
    const lowerQuery = query.toLowerCase();
    return localMovies.filter(movie => 
        movie.title.toLowerCase().includes(lowerQuery) ||
        (movie.year && movie.year.toString().includes(lowerQuery))
    );
}

// Clear search results
function clearSearchResults() {
    searchResults = [];
    resultsGrid.innerHTML = '';
}

// Render search results
function renderSearchResults() {
    resultsGrid.innerHTML = '';
    
    if (searchResults.length === 0) {
        resultsGrid.innerHTML = '<p class="no-results">No results found</p>';
        return;
    }
    
    searchResults.forEach(item => {
        const card = createCard(item, true);
        resultsGrid.appendChild(card);
    });
}

// Render library sections
function renderLibrary() {
    const language = languageFilter.value;
    const type = typeFilter.value;
    const sortOption = sortBy.value;
    
    renderLibrarySection('watched', watchedGrid, language, type, sortOption);
    renderLibrarySection('wishlist', wishlistGrid, language, type, sortOption);
    
    // Update counts
    watchedCount.textContent = `(${getLibraryItems('watched').length})`;
    wishlistCount.textContent = `(${getLibraryItems('wishlist').length})`;
}

// Render a library section
function renderLibrarySection(section, container, language, type, sortOption) {
    container.innerHTML = '';
    
    let items = getLibraryItems(section);
    
    // Apply filters
    if (language !== 'all') {
        items = items.filter(item => item.language === language);
    }
    
    if (type !== 'all') {
        items = items.filter(item => item.type === type);
    }
    
    // Apply sorting
    items = sortItems(items, sortOption);
    
    if (items.length === 0) {
        container.innerHTML = `<p class="no-results">No ${section} items found</p>`;
        return;
    }
    
    items.forEach(item => {
        const card = createCard(item, false, section);
        container.appendChild(card);
    });
}

// Get items from a library section
function getLibraryItems(section) {
    const library = JSON.parse(localStorage.getItem('mediaLibrary')) || { watched: [], wishlist: [] };
    const itemIds = library[section] || [];
    
    return itemIds.map(id => {
        // Check if it's a TVMaze item
        if (id.startsWith('tvmaze-')) {
            const tvmazeId = id.replace('tvmaze-', '');
            // Try to find in search results first (for current session)
            const apiItem = searchResults.find(item => item.id === id);
            if (apiItem) return apiItem;
            
            // Otherwise return basic info (from localStorage)
            return {
                id,
                title: `TV Show (ID: ${tvmazeId})`,
                year: "N/A",
                poster: "./placeholder.jpg",
                rating: "N/A",
                type: "TV Series",
                language: "English"
            };
        }
        
        // Otherwise it's a local movie
        return localMovies.find(movie => movie.id.toString() === id);
    }).filter(Boolean); // Filter out undefined items
}

// Sort items based on the selected option
function sortItems(items, sortOption) {
    const [field, order] = sortOption.split('-');
    
    return [...items].sort((a, b) => {
        let valueA = a[field];
        let valueB = b[field];
        
        // Handle "N/A" values
        if (valueA === "N/A") valueA = field === 'rating' ? 0 : '';
        if (valueB === "N/A") valueB = field === 'rating' ? 0 : '';
        
        // Convert to numbers if needed
        if (field === 'year' || field === 'rating') {
            valueA = Number(valueA) || 0;
            valueB = Number(valueB) || 0;
        } else {
            valueA = String(valueA).toLowerCase();
            valueB = String(valueB).toLowerCase();
        }
        
        if (order === 'asc') {
            return valueA > valueB ? 1 : -1;
        } else {
            return valueA < valueB ? 1 : -1;
        }
    });
}

// Create a card element
function createCard(item, isSearchResult, currentSection) {
    const card = document.createElement('div');
    card.className = `card ${currentSection === 'watched' ? 'watched-item' : currentSection === 'wishlist' ? 'wishlist-item' : ''}`;
    
    const poster = item.poster || './placeholder.jpg';
    const year = item.year || 'N/A';
    const rating = item.rating || 'N/A';
    const type = item.type || 'Unknown';
    const language = item.language || 'Unknown';
    
    card.innerHTML = `
        <img src="${poster}" alt="${item.title}" class="card-poster" onerror="this.src='./placeholder.jpg'">
        <div class="card-info">
            <h3 class="card-title" title="${item.title}">${item.title}</h3>
            <div class="card-meta">
                <span>${year}</span>
                <span>⭐ ${rating}</span>
            </div>
            <div class="card-meta">
                <span>${type}</span>
                <span>${language}</span>
            </div>
            <div class="card-actions">
                ${isSearchResult ? `
                    <button class="watched-btn" data-id="${item.id}">
                        <i class="fas fa-eye"></i> Watched
                    </button>
                    <button class="wishlist-btn" data-id="${item.id}">
                        <i class="fas fa-heart"></i> Wishlist
                    </button>
                ` : `
                    <button class="${currentSection === 'watched' ? 'move-btn' : 'watched-btn'}" data-id="${item.id}" data-section="${currentSection}">
                        <i class="fas ${currentSection === 'watched' ? 'fa-undo' : 'fa-eye'}"></i> ${currentSection === 'watched' ? 'Move' : 'Watched'}
                    </button>
                    <button class="remove-btn" data-id="${item.id}" data-section="${currentSection}">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                `}
            </div>
        </div>
    `;
    
    // Add event listeners to buttons
    const buttons = card.querySelectorAll('button');
    buttons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = button.getAttribute('data-id');
            
            if (button.classList.contains('watched-btn')) {
                addToLibrary('watched', id);
                showToast("Added to Watched");
            } else if (button.classList.contains('wishlist-btn')) {
                addToLibrary('wishlist', id);
                showToast("Added to Wishlist");
            } else if (button.classList.contains('move-btn')) {
                const fromSection = button.getAttribute('data-section');
                const toSection = fromSection === 'watched' ? 'wishlist' : 'watched';
                moveBetweenSections(id, fromSection, toSection);
                showToast(`Moved to ${toSection === 'watched' ? 'Watched' : 'Wishlist'}`);
            } else if (button.classList.contains('remove-btn')) {
                const section = button.getAttribute('data-section');
                removeFromLibrary(section, id);
                showToast("Removed from library");
            }
        });
    });
    
    return card;
}

// Add item to a library section
function addToLibrary(section, id) {
    const library = JSON.parse(localStorage.getItem('mediaLibrary')) || { watched: [], wishlist: [] };
    
    // Check if item already exists in either section
    if (!library.watched.includes(id) && !library.wishlist.includes(id)) {
        library[section].push(id);
        localStorage.setItem('mediaLibrary', JSON.stringify(library));
        renderLibrary();
    } else {
        showToast("Item already exists in your library");
    }
}

// Remove item from a library section
function removeFromLibrary(section, id) {
    const library = JSON.parse(localStorage.getItem('mediaLibrary')) || { watched: [], wishlist: [] };
    library[section] = library[section].filter(itemId => itemId !== id);
    localStorage.setItem('mediaLibrary', JSON.stringify(library));
    renderLibrary();
}

// Move item between sections
function moveBetweenSections(id, fromSection, toSection) {
    const library = JSON.parse(localStorage.getItem('mediaLibrary')) || { watched: [], wishlist: [] };
    
    // Remove from current section
    library[fromSection] = library[fromSection].filter(itemId => itemId !== id);
    
    // Add to new section if not already there
    if (!library[toSection].includes(id)) {
        library[toSection].push(id);
    }
    
    localStorage.setItem('mediaLibrary', JSON.stringify(library));
    renderLibrary();
}

// Show toast notification
function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Show/hide loading spinner
function showLoading(show) {
    if (show) {
        loading.classList.add('active');
    } else {
        loading.classList.remove('active');
    }
}

// Theme management
function loadThemePreference() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = themeToggle.querySelector('i');
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// Initialize the app
document.addEventListener('DOMContentLoaded', init);
