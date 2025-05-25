import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["input", "results", "form"]

  connect() {
    console.log("Search controller connected");
    this.dropdown = null;
    this.clickAwayHandler = this.clickAway.bind(this);
    this.currentRequest = null;
    this.debounceTimer = null;
    
    // Keep track of whether dropdown is open
    this.isDropdownOpen = false;
    
    // Add an event listener for the escape key
    this.escapeHandler = this.handleEscape.bind(this);
    document.addEventListener('keydown', this.escapeHandler);
    
    // Setup resize handling to reposition dropdown
    this.resizeHandler = this.handleResize.bind(this);
    window.addEventListener('resize', this.resizeHandler);
    
    // Load recent searches from localStorage
    this.recentSearches = this.loadRecentSearches();
    this.trendingSearches = ['pop', 'rock', 'jazz', 'hip hop', 'electronic', 'indie'];
    
    // Make this controller globally accessible
    if (typeof window !== 'undefined') {
      window.searchController = this;
    }
  }

  disconnect() {
    console.log("Search controller disconnected");
    // Clean up event listeners
    document.removeEventListener('click', this.clickAwayHandler);
    document.removeEventListener('keydown', this.escapeHandler);
    window.removeEventListener('resize', this.resizeHandler);
    this.cleanupDropdown();
    
    // Remove global reference
    if (typeof window !== 'undefined' && window.searchController === this) {
      delete window.searchController;
    }
  }
  
  handleEscape(event) {
    if (event.key === 'Escape' && this.isDropdownOpen) {
      this.hideResults();
    }
  }
  
  handleResize() {
    if (this.isDropdownOpen && this.dropdown) {
      this.positionDropdown();
    }
  }
  
  // Load recent searches from localStorage
  loadRecentSearches() {
    try {
      if (typeof localStorage !== 'undefined') {
        const recentSearches = localStorage.getItem('recentSearches');
        if (recentSearches) {
          return JSON.parse(recentSearches);
        }
      }
    } catch (e) {
      console.error('Error loading recent searches:', e);
    }
    return [];
  }
  
  // Save a search term to recent searches
  saveSearchTerm(term) {
    try {
      if (!term || term.length < 2) return;
      
      // Make sure we have an array of recent searches
      let searches = this.recentSearches || [];
      
      // Remove if already exists (to move it to the top)
      const index = searches.indexOf(term);
      if (index > -1) {
        searches.splice(index, 1);
      }
      
      // Add to the beginning and limit to 5 items
      searches.unshift(term);
      this.recentSearches = searches.slice(0, 5);
      
      // Save to localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('recentSearches', JSON.stringify(this.recentSearches));
      }
    } catch (e) {
      console.error("Error saving recent searches:", e);
    }
  }

  search() {
    // Clear any existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    // Set up a new debounce timer
    this.debounceTimer = setTimeout(() => {
      const query = this.inputTarget.value.trim();
      
      // Cancel any in-flight request
      if (this.currentRequest) {
        this.currentRequest.abort();
      }
      
      if (query.length < 2) {
        // If query is too short but input is focused, show suggestions
        if (document.activeElement === this.inputTarget) {
          this.showSuggestions();
        } else {
          this.hideResults();
        }
        return;
      }

      console.log("Searching for:", query);
      
      // Create an AbortController to handle cancellation
      const controller = new AbortController();
      this.currentRequest = controller;
      
      // Create the URL with proper escaping
      const url = `/search?query=${encodeURIComponent(query)}&format=json`;
      
      fetch(url, { signal: controller.signal })
        .then(response => {
          if (!response.ok) {
            throw new Error(`Search request failed with status ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          console.log("Search results:", data);
          this.showResults(data);
          // Save search term to recent searches
          this.saveSearchTerm(query);
        })
        .catch(error => {
          if (error.name === 'AbortError') {
            console.log("Search request was aborted");
          } else {
            console.error("Error fetching search results:", error);
            this.showError("Error fetching results. Please try again.");
          }
        })
        .finally(() => {
          if (this.currentRequest === controller) {
            this.currentRequest = null;
          }
        });
    }, 300); // 300ms debounce
  }
  
  // Show suggestions when input is focused but no query
  showSuggestions() {
    // Clean up any existing dropdown
    this.cleanupDropdown();
    
    // Create new dropdown
    this.dropdown = document.createElement('div');
    this.dropdown.className = 'search-dropdown';
    
    // Add z-index classes to ensure it appears on top
    this.dropdown.style.zIndex = '9999';
    this.dropdown.style.position = 'absolute';
    
    // Style the dropdown
    Object.assign(this.dropdown.style, {
      backgroundColor: 'var(--card-bg, #282828)',
      border: '1px solid var(--border-color, #333)',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      maxHeight: '80vh',
      overflowY: 'auto',
      width: `${this.inputTarget.offsetWidth}px`,
      minWidth: '300px'
    });
    
    // Add a header
    const header = document.createElement('div');
    header.style.padding = '12px 16px';
    header.style.borderBottom = '1px solid var(--border-color, #333)';
    header.style.fontWeight = 'bold';
    header.textContent = 'Suggestions';
    this.dropdown.appendChild(header);
    
    // Add recent searches
    if (this.recentSearches && this.recentSearches.length > 0) {
      const recentSection = document.createElement('div');
      recentSection.style.padding = '8px 0';
      
      const sectionTitle = document.createElement('div');
      sectionTitle.style.padding = '8px 16px';
      sectionTitle.style.fontSize = '14px';
      sectionTitle.style.color = 'var(--text-secondary, #a7a7a7)';
      sectionTitle.textContent = 'Recent Searches';
      recentSection.appendChild(sectionTitle);
      
      this.recentSearches.forEach(term => {
        const item = this.createSuggestionItem(term);
        recentSection.appendChild(item);
      });
      
      this.dropdown.appendChild(recentSection);
    }
    
    // Add trending searches
    const trendingSection = document.createElement('div');
    trendingSection.style.padding = '8px 0';
    
    const sectionTitle = document.createElement('div');
    sectionTitle.style.padding = '8px 16px';
    sectionTitle.style.fontSize = '14px';
    sectionTitle.style.color = 'var(--text-secondary, #a7a7a7)';
    sectionTitle.textContent = 'Trending';
    trendingSection.appendChild(sectionTitle);
    
    this.trendingSearches.forEach(term => {
      const item = this.createSuggestionItem(term);
      trendingSection.appendChild(item);
    });
    
    this.dropdown.appendChild(trendingSection);
    
    // Add to body and position correctly
    document.body.appendChild(this.dropdown);
    this.positionDropdown();
    
    // Mark dropdown as open
    this.isDropdownOpen = true;
    document.body.classList.add('has-open-dropdown');
    
    // Add click away listener
    setTimeout(() => {
      document.addEventListener('click', this.clickAwayHandler);
    }, 10);
  }
  
  createSuggestionItem(term) {
    const item = document.createElement('div');
    item.className = 'search-suggestion-item';
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.padding = '8px 16px';
    item.style.cursor = 'pointer';
    
    // Add hover effect
    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    });
    
    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = 'transparent';
    });
    
    // Add search icon
    const icon = document.createElement('div');
    icon.style.width = '24px';
    icon.style.height = '24px';
    icon.style.marginRight = '12px';
    icon.style.color = 'var(--text-secondary, #a7a7a7)';
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`;
    item.appendChild(icon);
    
    // Add text
    const text = document.createElement('div');
    text.style.color = 'var(--text-color, #f0f0f0)';
    text.textContent = term;
    item.appendChild(text);
    
    // Add click handler
    item.addEventListener('click', () => {
      this.inputTarget.value = term;
      this.hideResults();
      this.search();
    });
    
    return item;
  }

  showResults(data) {
    // Clean up any existing dropdown
    this.cleanupDropdown();
    
    // Create new dropdown
    this.dropdown = document.createElement('div');
    this.dropdown.className = 'search-dropdown';
    this.dropdown.setAttribute('data-search-target', 'results');
    
    // Add z-index classes to ensure it appears on top
    this.dropdown.style.zIndex = '9999';
    this.dropdown.style.position = 'absolute';
    
    // Style the dropdown
    Object.assign(this.dropdown.style, {
      backgroundColor: 'var(--card-bg, #282828)',
      border: '1px solid var(--border-color, #333)',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      maxHeight: '80vh',
      overflowY: 'auto',
      width: `${this.inputTarget.offsetWidth}px`,
      minWidth: '300px'
    });
    
    // Add a header with count of results
    const totalResults = this.countResults(data);
    const header = document.createElement('div');
    header.className = 'search-header';
    header.style.padding = '12px 16px';
    header.style.borderBottom = '1px solid var(--border-color, #333)';
    header.style.fontWeight = 'bold';
    header.textContent = `Found ${totalResults} result${totalResults !== 1 ? 's' : ''}`;
    this.dropdown.appendChild(header);

    // Handle no results case
    if (totalResults === 0) {
      const noResults = document.createElement('div');
      noResults.className = 'no-results';
      noResults.style.padding = '16px';
      noResults.style.color = 'var(--text-secondary, #a7a7a7)';
      noResults.style.textAlign = 'center';
      noResults.textContent = 'No results found. Try different keywords.';
      this.dropdown.appendChild(noResults);
    } else {
      // Create sections for different result types
      this.addResultSection(this.dropdown, 'Tracks', data.tracks || []);
      this.addResultSection(this.dropdown, 'Albums', data.albums || []);
      this.addResultSection(this.dropdown, 'Artists', data.artists || []);
      this.addResultSection(this.dropdown, 'Playlists', data.playlists || []);
    }
    
    // Add to body and position correctly
    document.body.appendChild(this.dropdown);
    this.positionDropdown();
    
    // Mark dropdown as open
    this.isDropdownOpen = true;
    document.body.classList.add('has-open-dropdown');
    
    // Add click away listener
    setTimeout(() => {
      document.addEventListener('click', this.clickAwayHandler);
    }, 10);
  }
  
  countResults(data) {
    return (
      (data.tracks?.length || 0) +
      (data.albums?.length || 0) +
      (data.artists?.length || 0) +
      (data.playlists?.length || 0)
    );
  }
  
  addResultSection(container, title, items) {
    if (!items || items.length === 0) return;
    
    // Create section container
    const section = document.createElement('div');
    section.className = 'search-section';
    section.style.padding = '8px 0';
    
    // Add section title
    const sectionTitle = document.createElement('div');
    sectionTitle.className = 'section-title';
    sectionTitle.style.padding = '8px 16px';
    sectionTitle.style.fontSize = '14px';
    sectionTitle.style.fontWeight = 'bold';
    sectionTitle.style.color = 'var(--text-secondary, #a7a7a7)';
    sectionTitle.textContent = title;
    section.appendChild(sectionTitle);
    
    // Add items
    items.slice(0, 5).forEach(item => {
      const itemElement = document.createElement('a');
      itemElement.className = 'search-item';
      itemElement.href = this.getItemUrl(item, title.toLowerCase());
      itemElement.style.display = 'flex';
      itemElement.style.alignItems = 'center';
      itemElement.style.padding = '8px 16px';
      itemElement.style.color = 'var(--text-color, #f0f0f0)';
      itemElement.style.textDecoration = 'none';
      itemElement.style.transition = 'background-color 0.2s ease';
      
      // Add hover effect
      itemElement.addEventListener('mouseenter', () => {
        itemElement.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
      });
      
      itemElement.addEventListener('mouseleave', () => {
        itemElement.style.backgroundColor = 'transparent';
      });
      
      // Add thumbnail if available
      if (item.cover_small || item.picture_small) {
        const img = document.createElement('img');
        img.src = item.cover_small || item.picture_small;
        img.alt = item.title || item.name;
        img.style.width = '40px';
        img.style.height = '40px';
        img.style.marginRight = '12px';
        img.style.borderRadius = title === 'Artists' ? '50%' : '4px';
        img.style.objectFit = 'cover';
        itemElement.appendChild(img);
      } else {
        // Placeholder for items without image
        const placeholder = document.createElement('div');
        placeholder.style.width = '40px';
        placeholder.style.height = '40px';
        placeholder.style.marginRight = '12px';
        placeholder.style.backgroundColor = 'var(--border-color, #333)';
        placeholder.style.borderRadius = title === 'Artists' ? '50%' : '4px';
        
        // Add icon based on type
        const icon = document.createElement('div');
        icon.style.display = 'flex';
        icon.style.alignItems = 'center';
        icon.style.justifyContent = 'center';
        icon.style.height = '100%';
        icon.style.color = 'var(--text-secondary, #a7a7a7)';
        
        // Simple icons with unicode
        if (title === 'Tracks') icon.textContent = '♪';
        else if (title === 'Albums') icon.textContent = '💿';
        else if (title === 'Artists') icon.textContent = '👤';
        else if (title === 'Playlists') icon.textContent = '📄';
        
        placeholder.appendChild(icon);
        itemElement.appendChild(placeholder);
      }
      
      // Add text content
      const textContainer = document.createElement('div');
      textContainer.style.display = 'flex';
      textContainer.style.flexDirection = 'column';
      
      const primaryText = document.createElement('div');
      primaryText.style.fontWeight = 'bold';
      primaryText.textContent = item.title || item.name;
      textContainer.appendChild(primaryText);
      
      // Add secondary text if applicable
      if (item.artist && item.artist.name) {
        const secondaryText = document.createElement('div');
        secondaryText.style.fontSize = '14px';
        secondaryText.style.color = 'var(--text-secondary, #a7a7a7)';
        secondaryText.textContent = item.artist.name;
        textContainer.appendChild(secondaryText);
      }
      
      itemElement.appendChild(textContainer);
      section.appendChild(itemElement);
      
      // Special handling for tracks - add play button
      if (title === 'Tracks') {
        // If track, make it playable with player controller
        itemElement.href = 'javascript:void(0)';
        itemElement.setAttribute('data-song', JSON.stringify(item));
        itemElement.setAttribute('data-action', 'click->player#playSong');
      }
      
      // Add click handler to hide dropdown when item is clicked
      itemElement.addEventListener('click', () => {
        this.hideResults();
      });
    });
    
    // Add a "View all" link if there are more than 5 items
    if (items.length > 5) {
      const viewAll = document.createElement('a');
      viewAll.className = 'view-all';
      viewAll.href = this.getViewAllUrl(title.toLowerCase());
      viewAll.style.display = 'block';
      viewAll.style.padding = '8px 16px';
      viewAll.style.textAlign = 'center';
      viewAll.style.color = 'var(--accent-color, #1DB954)';
      viewAll.style.fontSize = '14px';
      viewAll.style.fontWeight = 'bold';
      viewAll.textContent = `View all ${items.length} ${title.toLowerCase()}`;
      
      viewAll.addEventListener('mouseenter', () => {
        viewAll.style.textDecoration = 'underline';
      });
      
      viewAll.addEventListener('mouseleave', () => {
        viewAll.style.textDecoration = 'none';
      });
      
      section.appendChild(viewAll);
      
      // Add click handler to hide dropdown when "View all" is clicked
      viewAll.addEventListener('click', () => {
        this.hideResults();
      });
    }
    
    container.appendChild(section);
  }
  
  getItemUrl(item, type) {
    if (type === 'tracks') {
      // For tracks, just return # as they're played directly
      return '#';
    } else if (type === 'albums') {
      return `/music/${item.id}/album`;
    } else if (type === 'artists') {
      return `/music/${item.id}/artist`;
    } else if (type === 'playlists') {
      return `/playlists/${item.id}`;
    }
    return '#';
  }
  
  getViewAllUrl(type) {
    const query = encodeURIComponent(this.inputTarget.value.trim());
    return `/search?query=${query}&type=${type}`;
  }
  
  showError(message) {
    // Clean up any existing dropdown
    this.cleanupDropdown();
    
    // Create new dropdown
    this.dropdown = document.createElement('div');
    this.dropdown.className = 'search-dropdown';
    this.dropdown.setAttribute('data-search-target', 'results');
    
    // Style the dropdown
    Object.assign(this.dropdown.style, {
      zIndex: '9999',
      position: 'absolute',
      backgroundColor: 'var(--card-bg, #282828)',
      border: '1px solid var(--border-color, #333)',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      padding: '16px',
      color: 'var(--text-color, #f0f0f0)',
      textAlign: 'center'
    });
    
    this.dropdown.textContent = message;
    
    // Add to body and position correctly
    document.body.appendChild(this.dropdown);
    this.positionDropdown();
    
    // Mark dropdown as open
    this.isDropdownOpen = true;
    document.body.classList.add('has-open-dropdown');
    
    // Add click away listener
    setTimeout(() => {
      document.addEventListener('click', this.clickAwayHandler);
    }, 10);
  }
  
  positionDropdown() {
    const dropdown = this.getDropdownElement();
    if (!dropdown) return;
    
    try {
      // Move dropdown to body to avoid z-index issues with nested containers
      this.safelyMoveToBody(dropdown);
      
      // Get the input position
      const inputRect = this.inputTarget.getBoundingClientRect();
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
      
      // Position the dropdown
      dropdown.style.position = 'absolute';
      dropdown.style.zIndex = '9999'; // Very high z-index to appear above everything
      dropdown.style.top = `${inputRect.bottom + scrollTop}px`;
      dropdown.style.left = `${inputRect.left + scrollLeft}px`;
      dropdown.style.width = `${Math.max(inputRect.width, 300)}px`;
      
      // Check if dropdown would go off screen
      const dropdownRect = dropdown.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      
      if (dropdownRect.right > viewportWidth) {
        // Adjust position to stay within viewport
        dropdown.style.left = `${viewportWidth - dropdownRect.width - 10 + scrollLeft}px`;
      }
      
      // Ensure dropdown is visible by setting it to a high z-index
      dropdown.style.zIndex = '9999';
    } catch (error) {
      console.error("Error repositioning dropdown:", error);
    }
  }

  hideResults() {
    console.log("Hiding search results");
    this.cleanupDropdown();
    document.removeEventListener('click', this.clickAwayHandler);
    this.isDropdownOpen = false;
    document.body.classList.remove('has-open-dropdown');
  }
  
  cleanupDropdown() {
    // Safely remove dropdown if it exists
    if (this.dropdown && this.dropdown.parentNode) {
      try {
        this.dropdown.parentNode.removeChild(this.dropdown);
      } catch (error) {
        console.error("Error removing dropdown:", error);
      }
      this.dropdown = null;
    }
  }
  
  safelyMoveToBody(dropdown) {
    if (!dropdown) return;
    
    try {
      // Check if the dropdown is already in the body
      if (dropdown.parentNode !== document.body) {
        // Store the current position
        const rect = dropdown.getBoundingClientRect();
        
        // First remove from current parent
        if (dropdown.parentNode) {
          dropdown.parentNode.removeChild(dropdown);
        }
        
        // Append to body
        document.body.appendChild(dropdown);
        
        // Ensure it stays visually in the same position
        dropdown.style.position = 'absolute';
        dropdown.style.zIndex = '9999';
        
        // Make sure it's visible
        dropdown.style.display = '';
        dropdown.style.visibility = 'visible';
        dropdown.style.opacity = '1';
      }
    } catch (error) {
      console.error("Error moving dropdown to body:", error);
      
      // Try to recover
      try {
        if (!dropdown.isConnected) {
          document.body.appendChild(dropdown);
        }
      } catch (recoveryError) {
        console.error("Failed to recover dropdown:", recoveryError);
      }
    }
    
    return dropdown;
  }

  safelyCleanupDropdown(dropdown) {
    try {
      if (!dropdown) return;
      
      // Remove event listeners
      const resultItems = dropdown.querySelectorAll('.search-result-item');
      resultItems.forEach(item => {
        item.removeEventListener('click', this.selectSuggestion.bind(this));
      });
      
      // Remove from DOM
      if (dropdown.parentNode) {
        dropdown.parentNode.removeChild(dropdown);
      }
    } catch (error) {
      console.error("Error cleaning up dropdown:", error);
      
      // Try harder to clean up
      try {
        if (dropdown && dropdown.isConnected) {
          dropdown.remove();
        }
      } catch (secondError) {
        console.error("Failed second cleanup attempt:", secondError);
      }
    }
  }

  clickAway(event) {
    // Don't close if clicking on the search input
    if (this.inputTarget.contains(event.target)) {
      return;
    }
    
    // Don't close if clicking inside the dropdown
    if (this.dropdown && this.dropdown.contains(event.target)) {
      return;
    }
    
    this.hideResults();
  }

  submitForm(event) {
    if (event) {
      event.preventDefault();
    }
    
    const query = this.inputTarget.value.trim();
    
    if (query.length > 0) {
      // Save search term
      this.saveSearchTerm(query);
      
      // Navigate to search page
      window.location.href = `/search?query=${encodeURIComponent(query)}`;
    }
  }
  
  // Handle input focus
  focus() {
    // If input already has a value, trigger search, otherwise show suggestions
    const query = this.inputTarget.value.trim();
    
    if (query.length >= 2) {
      this.search();
    } else {
      this.showSuggestions();
    }
  }
  
  // Clear the search input
  clearSearch() {
    this.inputTarget.value = '';
    this.inputTarget.focus();
    this.showSuggestions();
  }
} 