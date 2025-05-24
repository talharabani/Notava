import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["dropdown", "input"]
  static values = {
    minChars: { type: Number, default: 2 }
  }
  
  connect() {
    console.log("Search controller connected");
    this.debounceTimer = null;
    this.minChars = this.hasMinCharsValue ? this.minCharsValue : 2;
    this.selectedIndex = -1; // Track selected result index for keyboard navigation
    this.recentSearches = [];
    this.trendingSearches = ['pop', 'rock', 'jazz', 'hip hop', 'electronic', 'indie'];
    
    // Fix for dropdown target not being found
    if (!this.hasDropdownTarget) {
      // Try to find the dropdown using an alternative selector
      const dropdown = this.element.querySelector('#search_dropdown');
      if (dropdown) {
        console.log("Found dropdown using alternative selector");
        // Store a reference to the dropdown element
        this.dropdownElement = dropdown;
      } else {
        console.warn("Dropdown element not found!");
      }
    } else {
      console.log("Dropdown target found via Stimulus");
    }
    
    // Load recent searches from localStorage
    this.loadRecentSearches();
    
    // Close dropdown when clicking outside
    document.addEventListener('click', this.closeDropdown.bind(this));
    
    // Add keyboard event listener
    if (this.hasInputTarget) {
      this.inputTarget.addEventListener('keydown', this.handleKeydown.bind(this));
      
      // Show suggestions on focus
      this.inputTarget.addEventListener('focus', this.showSuggestions.bind(this));
    }
    
    // Add window resize event to reposition dropdown
    window.addEventListener('resize', this.repositionDropdown.bind(this));
    
    // Add scroll event to keep dropdown in view
    window.addEventListener('scroll', this.repositionDropdown.bind(this));
    
    // Create a MutationObserver to watch for DOM changes that might affect dropdown positioning
    this.observer = new MutationObserver(() => {
      this.repositionDropdown();
    });
    
    // Start observing the document body for DOM changes
    this.observer.observe(document.body, { childList: true, subtree: true });
  }
  
  disconnect() {
    document.removeEventListener('click', this.closeDropdown.bind(this));
    
    if (this.hasInputTarget) {
      this.inputTarget.removeEventListener('keydown', this.handleKeydown.bind(this));
      this.inputTarget.removeEventListener('focus', this.showSuggestions.bind(this));
    }
    
    window.removeEventListener('resize', this.repositionDropdown.bind(this));
    window.removeEventListener('scroll', this.repositionDropdown.bind(this));
    
    // Stop the MutationObserver when the controller is disconnected
    if (this.observer) {
      this.observer.disconnect();
    }
  }
  
  // Load recent searches from localStorage
  loadRecentSearches() {
    if (typeof localStorage !== 'undefined') {
      const recentSearches = localStorage.getItem('recentSearches');
      if (recentSearches) {
        try {
          this.recentSearches = JSON.parse(recentSearches);
        } catch (e) {
          console.error('Error parsing recent searches:', e);
          this.recentSearches = [];
        }
      }
    }
  }
  
  // Save a search term to recent searches
  saveSearchTerm(term) {
    if (!term || term.length < this.minChars) return;
    
    // Add to recent searches
    const searches = this.loadRecentSearches();
    
    // Remove if already exists (to move it to the top)
    const index = searches.indexOf(term);
    if (index > -1) {
      searches.splice(index, 1);
    }
    
    // Add to the beginning and limit to 5 items
    searches.unshift(term);
    this.recentSearches = searches.slice(0, 5);
    
    // Save to localStorage
    try {
      localStorage.setItem('recentSearches', JSON.stringify(this.recentSearches));
    } catch (e) {
      console.error("Error saving recent searches:", e);
    }
  }
  
  // Show suggestions when the input is focused
  showSuggestions() {
    const dropdown = this.getDropdownElement();
    if (!dropdown) {
      console.warn("Search dropdown element not found");
      return;
    }
    
    const query = this.inputTarget.value.trim();
    
    // If there's already a query, perform a search
    if (query.length >= this.minChars) {
      this.search({ target: this.inputTarget });
      return;
    }
    
    // Otherwise show recent and trending searches
    const resultsContainer = dropdown.querySelector('#search_results');
    if (!resultsContainer) {
      console.warn("Search results container not found");
      return;
    }
    
    let html = '';
    
    // Recent searches section
    if (this.recentSearches.length > 0) {
      html += `<div class="text-xs text-cyan-300 mb-2 px-2 font-medium">Recent Searches</div>`;
      
      this.recentSearches.forEach(term => {
        html += this.renderSuggestion(term);
      });
      
      html += `<div class="border-t border-cyan-900/30 my-2"></div>`;
    }
    
    // Trending searches section
    html += `<div class="text-xs text-cyan-300 mb-2 px-2 font-medium">Trending</div>`;
    
    this.trendingSearches.slice(0, 5).forEach(term => {
      html += this.renderSuggestion(term);
    });
    
    resultsContainer.innerHTML = html;
    this.showDropdown();
  }
  
  // Render a single suggestion item
  renderSuggestion(term) {
    return `
      <div class="flex items-center p-2 hover:bg-indigo-800/70 rounded cursor-pointer transition duration-150" 
           data-action="click->search#selectSuggestion"
           data-term="${term}">
        <div class="flex items-center text-cyan-300 mr-2">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm truncate text-white">${term}</div>
        </div>
      </div>
    `;
  }
  
  // Select a suggestion and perform search
  selectSuggestion(event) {
    const term = event.currentTarget.dataset.term;
    
    // Set the input value
    this.inputTarget.value = term;
    
    // Save as a recent search
    this.saveSearchTerm(term);
    
    // Perform the search
    this.fetchResults(term);
  }
  
  // Clear the search input and show suggestions
  clearSearch() {
    // Clear the input
    if (this.hasInputTarget) {
      this.inputTarget.value = '';
      
      // Hide the clear button
      const clearButton = this.element.querySelector('.clear-search-btn');
      if (clearButton) {
        clearButton.classList.add('hidden');
      }
      
      // Focus the input
      this.inputTarget.focus();
      
      // Show suggestions
      this.showSuggestions();
    }
  }
  
  closeDropdown(event) {
    if (!this.element.contains(event.target)) {
      this.hideDropdown();
    }
  }
  
  repositionDropdown() {
    // Get dropdown safely using our helper
    const dropdown = this.getDropdownElement();
    if (!dropdown) {
      console.warn("Search dropdown element not found");
      return;
    }
    
    // Check if dropdown is hidden
    if (dropdown.classList.contains('hidden')) {
      return;
    }
    
    // Get the input field's position and dimensions
    const inputRect = this.inputTarget.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Position the dropdown relative to the input field
    const dropdownWidth = Math.min(600, Math.max(300, inputRect.width));
    
    // Calculate position relative to viewport
    let leftPosition = Math.max(10, Math.min(
      viewportWidth - dropdownWidth - 10,
      inputRect.left
    ));
    
    // Set dropdown position and width
    dropdown.style.width = `${dropdownWidth}px`;
    
    // When in body, we need to use viewport coordinates
    if (dropdown.dataset.movedToBody) {
      dropdown.style.left = `${leftPosition}px`;
      dropdown.style.top = `${inputRect.bottom + 5}px`;
    } else {
      // Original relative positioning code
      dropdown.style.left = `${leftPosition}px`;
      dropdown.style.top = `${inputRect.bottom + window.scrollY + 5}px`;
    }
    
    // Adjust height if needed to keep within viewport
    const dropdownRect = dropdown.getBoundingClientRect();
    const maxHeight = viewportHeight - dropdownRect.top - 20;
    dropdown.style.maxHeight = `${Math.max(200, maxHeight)}px`;
  }
  
  // Handle keyboard navigation
  handleKeydown(event) {
    const dropdown = this.getDropdownElement();
    
    // Only process if dropdown is visible and exists
    if (!dropdown || dropdown.classList.contains('hidden')) {
      return;
    }
    
    const results = this.getSearchResults();
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, results.length - 1);
        this.highlightResult();
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
        this.highlightResult();
        break;
        
      case 'Enter':
        event.preventDefault();
        if (this.selectedIndex >= 0 && this.selectedIndex < results.length) {
          results[this.selectedIndex].click();
        }
        break;
        
      case 'Escape':
        event.preventDefault();
        this.hideDropdown();
        break;
    }
  }
  
  // Get all search result elements
  getSearchResults() {
    const dropdown = this.getDropdownElement();
    if (!dropdown) {
      return [];
    }
    return Array.from(dropdown.querySelectorAll('[data-action="click->search#selectResult"]'));
  }
  
  // Highlight the selected result
  highlightResult() {
    const dropdown = this.getDropdownElement();
    if (!dropdown) {
      return;
    }
    
    const results = this.getSearchResults();
    
    // Remove highlight from all results
    results.forEach((result, index) => {
      if (index === this.selectedIndex) {
        result.classList.add('bg-indigo-800/70');
        
        // Scroll into view if needed
        result.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        result.classList.remove('bg-indigo-800/70');
      }
    });
  }
  
  search(event) {
    const query = event.target.value.trim();
    
    clearTimeout(this.debounceTimer);
    
    if (query.length >= this.minChars) {
      this.debounceTimer = setTimeout(() => {
        this.fetchResults(query);
      }, 300);
    } else if (query.length === 0) {
      // Show suggestions when query is cleared
      this.showSuggestions();
    } else {
      this.hideDropdown();
    }
  }
  
  submit(event) {
    const form = event.currentTarget;
    const query = form.querySelector('input[name="query"]').value.trim();
    
    if (query.length === 0) {
      event.preventDefault();
    } else {
      // Save search term when form is submitted
      this.saveSearchTerm(query);
    }
  }
  
  fetchResults(query) {
    fetch(`/music/search?query=${encodeURIComponent(query)}&format=json`)
      .then(response => response.json())
      .then(data => {
        this.displayResults(data, query);
      })
      .catch(error => {
        console.error("Error fetching search results:", error);
      });
  }
  
  displayResults(data, query) {
    const dropdown = this.getDropdownElement();
    if (!dropdown) {
      console.warn("Search dropdown element not found");
      return;
    }
    
    const resultsContainer = dropdown.querySelector('#search_results');
    if (!resultsContainer) {
      console.warn("Search results container not found");
      return;
    }
    
    // Reset selected index when displaying new results
    this.selectedIndex = -1;
    
    if (data.data && data.data.length > 0) {
      let html = `<div class="text-xs text-cyan-300 mb-2 px-2 font-medium">Results for "${query}"</div>`;
      
      data.data.slice(0, 5).forEach(track => {
        html += `
          <div class="flex items-center p-2 hover:bg-indigo-800/70 rounded cursor-pointer transition duration-150" 
               data-action="click->search#selectResult"
               data-song='${JSON.stringify({
                 id: track.id,
                 title: track.title,
                 artist: { name: track.artist.name, id: track.artist.id },
                 album: { title: track.album.title, cover_medium: track.album.cover_medium },
                 preview: track.preview
               })}'>
            <img src="${track.album.cover_small}" class="w-10 h-10 rounded mr-2 shadow-sm" alt="${track.title}">
            <div class="flex-1 min-w-0">
              <div class="font-medium text-sm truncate text-white">${track.title}</div>
              <div class="text-cyan-400 text-xs truncate">${track.artist.name}</div>
            </div>
            <button class="ml-2 text-cyan-400 hover:text-white p-1 rounded-full hover:bg-cyan-700/70 transition">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>
          </div>
        `;
      });
      
      html += `
        <div class="border-t border-cyan-900/30 mt-2 pt-2 px-2">
          <a href="/search?query=${encodeURIComponent(query)}" class="text-cyan-400 text-sm hover:underline flex items-center">
            <span>See all results</span>
            <svg class="w-4 h-4 ml-1" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
            </svg>
          </a>
        </div>
      `;
      
      resultsContainer.innerHTML = html;
      this.showDropdown();
      
      // Save the search term
      this.saveSearchTerm(query);
    } else {
      resultsContainer.innerHTML = `
        <div class="p-4 text-center text-gray-400">
          No results found for "${query}"
        </div>
      `;
      this.showDropdown();
    }
  }
  
  selectResult(event) {
    const songData = JSON.parse(event.currentTarget.dataset.song);
    
    // Find the player controller and play the song
    const playerController = this.application.getControllerForElementAndIdentifier(
      document.getElementById('player-bar'),
      'player'
    );
    
    if (playerController) {
      // Check if shift key is pressed to add to queue
      const addToQueue = event.shiftKey;
      
      // Create a synthetic event with the song data
      const customEvent = new CustomEvent('click', {
        bubbles: true,
        cancelable: true
      });
      
      // Add the dataset property to the event
      Object.defineProperty(customEvent, 'currentTarget', {
        value: {
          dataset: {
            song: JSON.stringify(songData),
            addToQueue: addToQueue.toString()
          }
        },
        writable: false
      });
      
      // Call the playSong method on the player controller
      playerController.playSong(customEvent);
      
      // Show a tip about adding to queue
      if (!localStorage.getItem('queueTipShown')) {
        playerController.showNotification("Tip: Hold Shift while clicking to add to queue");
        localStorage.setItem('queueTipShown', 'true');
      }
    }
    
    this.hideDropdown();
  }
  
  showDropdown() {
    const dropdown = this.getDropdownElement();
    if (!dropdown) {
      console.warn("Search dropdown element not found");
      return;
    }
    
    // Add a special class to the body to prevent scrolling or interactions underneath
    document.body.classList.add('search-dropdown-active');
    
    // First make sure the dropdown is visible
    dropdown.classList.remove('hidden');
    
    // Move the dropdown to the body element to prevent stacking context issues
    if (!dropdown.dataset.movedToBody) {
      // Store original parent for hideDropdown
      this.originalParent = dropdown.parentElement;
      this.originalPosition = dropdown.nextSibling;
      
      // Clone the dropdown's inline styles
      const styles = window.getComputedStyle(dropdown);
      const originalStyles = {};
      for (let i = 0; i < styles.length; i++) {
        const prop = styles[i];
        originalStyles[prop] = styles.getPropertyValue(prop);
      }
      this.originalStyles = originalStyles;
      
      // Move to body
      document.body.appendChild(dropdown);
      dropdown.dataset.movedToBody = 'true';
    }
    
    // Reposition it correctly
    this.repositionDropdown();
    
    // Apply additional CSS to ensure it appears above everything
    dropdown.style.position = 'fixed';
    dropdown.style.zIndex = '99999'; // Increased z-index
    dropdown.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.5)';
    dropdown.style.backdropFilter = 'blur(8px)';
    dropdown.style.backgroundColor = 'rgba(15, 23, 42, 0.95)'; // Indigo-950 with opacity
    
    // Add a subtle animation
    dropdown.style.opacity = '0';
    dropdown.style.transform = 'translateY(-10px) scale(0.98)';
    
    // Force a repaint to ensure the dropdown is visible
    setTimeout(() => {
      dropdown.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      dropdown.style.opacity = '1';
      dropdown.style.transform = 'translateY(0) scale(1)';
    }, 10);
  }
  
  hideDropdown() {
    document.body.classList.remove('search-dropdown-active');
    
    const dropdown = this.getDropdownElement();
    if (!dropdown) {
      return;
    }
    
    // Reset styles
    dropdown.style.transition = '';
    dropdown.style.transform = '';
    
    // Hide the dropdown
    dropdown.classList.add('hidden');
    this.selectedIndex = -1;
    
    // Move back to original position if it was moved
    if (dropdown.dataset.movedToBody && this.originalParent) {
      if (this.originalPosition) {
        this.originalParent.insertBefore(dropdown, this.originalPosition);
      } else {
        this.originalParent.appendChild(dropdown);
      }
      delete dropdown.dataset.movedToBody;
    }
  }
  
  // Helper method to get the dropdown element safely
  getDropdownElement() {
    // Prioritize the stored Stimulus target if available
    if (this.hasDropdownTarget) {
      return this.dropdownTarget;
    }
    // Then, check the manually stored element from connect()
    if (this.dropdownElement) {
      // Verify it's still in the DOM
      if (document.body.contains(this.dropdownElement)) {
        return this.dropdownElement;
      } else {
        // Clear it if it's no longer in DOM, so we can re-query
        this.dropdownElement = null;
      }
    }
    // If neither is available or valid, try to query for it again
    // This covers cases where it might be added to the DOM after connect
    // or if the Stimulus target was momentarily detached.
    const dropdownById = this.element.querySelector('#search_dropdown');
    if (dropdownById) {
      this.dropdownElement = dropdownById; // Store for next time
      return dropdownById;
    }

    // As a final fallback, try to find it by Stimulus target attribute directly within this controller's element
    // This can be useful if Stimulus internal target references were lost for some reason.
    const dropdownByTargetAttr = this.element.querySelector('[data-search-target="dropdown"]');
    if (dropdownByTargetAttr) {
        // Note: This doesn't re-establish it as this.dropdownTarget in Stimulus terms,
        // but provides a usable element for the function.
        return dropdownByTargetAttr;
    }

    console.warn("Dropdown element could not be found by any method.");
    return null;
  }
} 