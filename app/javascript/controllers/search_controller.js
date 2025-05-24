import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["dropdown", "input"]
  
  connect() {
    console.log("Search controller connected");
    this.debounceTimer = null;
    this.minChars = 2;
    this.selectedIndex = -1; // Track selected result index for keyboard navigation
    
    // Close dropdown when clicking outside
    document.addEventListener('click', this.closeDropdown.bind(this));
    
    // Add keyboard event listener
    if (this.hasInputTarget) {
      this.inputTarget.addEventListener('keydown', this.handleKeydown.bind(this));
    }
  }
  
  disconnect() {
    document.removeEventListener('click', this.closeDropdown.bind(this));
    if (this.hasInputTarget) {
      this.inputTarget.removeEventListener('keydown', this.handleKeydown.bind(this));
    }
  }
  
  closeDropdown(event) {
    if (!this.element.contains(event.target)) {
      this.hideDropdown();
    }
  }
  
  // Handle keyboard navigation
  handleKeydown(event) {
    // Only process if dropdown is visible
    if (this.dropdownTarget.classList.contains('hidden')) {
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
    return Array.from(this.dropdownTarget.querySelectorAll('[data-action="click->search#selectResult"]'));
  }
  
  // Highlight the selected result
  highlightResult() {
    const results = this.getSearchResults();
    
    // Remove highlight from all results
    results.forEach((result, index) => {
      if (index === this.selectedIndex) {
        result.classList.add('bg-gray-700');
        
        // Scroll into view if needed
        result.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        result.classList.remove('bg-gray-700');
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
    } else {
      this.hideDropdown();
    }
  }
  
  submit(event) {
    const form = event.currentTarget;
    const query = form.querySelector('input[name="query"]').value.trim();
    
    if (query.length === 0) {
      event.preventDefault();
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
    const resultsContainer = this.dropdownTarget.querySelector('#search_results');
    
    // Reset selected index when displaying new results
    this.selectedIndex = -1;
    
    if (data.data && data.data.length > 0) {
      let html = `<div class="text-xs text-gray-400 mb-2 px-2">Results for "${query}"</div>`;
      
      data.data.slice(0, 5).forEach(track => {
        html += `
          <div class="flex items-center p-2 hover:bg-gray-700 rounded cursor-pointer" 
               data-action="click->search#selectResult"
               data-song='${JSON.stringify({
                 id: track.id,
                 title: track.title,
                 artist: { name: track.artist.name, id: track.artist.id },
                 album: { title: track.album.title, cover_medium: track.album.cover_medium },
                 preview: track.preview
               })}'>
            <img src="${track.album.cover_small}" class="w-10 h-10 rounded mr-2" alt="${track.title}">
            <div class="flex-1 min-w-0">
              <div class="font-medium text-sm truncate">${track.title}</div>
              <div class="text-gray-400 text-xs truncate">${track.artist.name}</div>
            </div>
            <button class="ml-2 text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-600">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>
          </div>
        `;
      });
      
      html += `
        <div class="border-t border-gray-700 mt-2 pt-2 px-2">
          <a href="/search?query=${encodeURIComponent(query)}" class="text-blue-400 text-sm hover:underline">
            See all results
          </a>
        </div>
      `;
      
      resultsContainer.innerHTML = html;
      this.showDropdown();
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
    this.dropdownTarget.classList.remove('hidden');
  }
  
  hideDropdown() {
    this.dropdownTarget.classList.add('hidden');
    this.selectedIndex = -1;
  }
} 