import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["dropdown"]
  
  connect() {
    console.log("Search controller connected");
    this.debounceTimer = null;
    this.minChars = 2;
    
    // Close dropdown when clicking outside
    document.addEventListener('click', this.closeDropdown.bind(this));
  }
  
  disconnect() {
    document.removeEventListener('click', this.closeDropdown.bind(this));
  }
  
  closeDropdown(event) {
    if (!this.element.contains(event.target)) {
      this.hideDropdown();
    }
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
      // Create a synthetic event with the song data
      const customEvent = new CustomEvent('click', {
        bubbles: true,
        cancelable: true
      });
      
      // Add the dataset property to the event
      Object.defineProperty(customEvent, 'currentTarget', {
        value: {
          dataset: {
            song: JSON.stringify(songData)
          }
        },
        writable: false
      });
      
      // Call the playSong method on the player controller
      playerController.playSong(customEvent);
    }
    
    this.hideDropdown();
  }
  
  showDropdown() {
    this.dropdownTarget.classList.remove('hidden');
  }
  
  hideDropdown() {
    this.dropdownTarget.classList.add('hidden');
  }
} 