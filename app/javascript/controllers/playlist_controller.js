import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["modal", "addToPlaylistModal", "playlistList"]
  
  connect() {
    console.log("Playlist controller connected");
    
    // Make this controller globally available
    window.playlistController = this;
    
    // Initialize the global method for showing the modal
    window.showAddToPlaylistModal = this.showAddToPlaylistModalGlobal.bind(this);
  }
  
  disconnect() {
    // Remove global references when disconnected
    if (window.playlistController === this) {
      delete window.playlistController;
    }
    
    delete window.showAddToPlaylistModal;
  }
  
  // Global method to show the modal from anywhere
  showAddToPlaylistModalGlobal(trackId, trackData) {
    if (typeof trackData === 'string') {
      try {
        trackData = JSON.parse(trackData);
      } catch (e) {
        console.error("Error parsing track data:", e);
        trackData = null;
      }
    }
    
    this.trackId = trackId;
    this.trackData = trackData;
    
    // Fetch the user's playlists
    this.fetchPlaylists();
  }
  
  showAddToPlaylistModal(event) {
    event.preventDefault();
    
    const trackId = event.currentTarget.dataset.trackId;
    let trackData = null;
    
    // Try to get track data from various sources
    try {
      const trackDataElement = event.currentTarget.closest('tr')?.querySelector('[data-song]') || 
                             event.currentTarget.closest('[data-song]');
      
      if (trackDataElement) {
        trackData = JSON.parse(trackDataElement.dataset.song);
      }
    } catch (e) {
      console.error("Error parsing track data:", e);
    }
    
    if (!trackId) {
      console.error("No track ID provided");
      return;
    }
    
    // Set the track ID for later use
    this.trackId = trackId;
    this.trackData = trackData;
    
    // Fetch the user's playlists
    this.fetchPlaylists();
  }
  
  // Fetch playlists and render them
  fetchPlaylists() {
    // Show loading state
    if (this.hasPlaylistListTarget) {
      this.playlistListTarget.innerHTML = `
        <div class="p-4 text-center text-gray-400">
          <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500 mx-auto"></div>
          <p class="mt-2">Loading playlists...</p>
        </div>
      `;
    }
    
    // Show the modal first to provide immediate feedback
    this.showModal();
    
    // Fetch playlists
    fetch('/playlists.json')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to fetch playlists');
        }
        return response.json();
      })
      .then(playlists => {
        this.renderPlaylistOptions(playlists);
      })
      .catch(error => {
        console.error("Error fetching playlists:", error);
        
        // Show error message
        if (this.hasPlaylistListTarget) {
          this.playlistListTarget.innerHTML = `
            <div class="text-center py-4 text-gray-400">
              <p>Failed to load playlists. Please try again.</p>
              <button class="text-cyan-400 hover:underline mt-2 inline-block" data-action="click->playlist#fetchPlaylists">
                Retry
              </button>
            </div>
          `;
        }
      });
  }
  
  renderPlaylistOptions(playlists) {
    if (!this.hasPlaylistListTarget) return;
    
    if (playlists.length === 0) {
      this.playlistListTarget.innerHTML = `
        <div class="text-center py-4 text-gray-400">
          <p>You don't have any playlists yet.</p>
          <a href="/playlists/new" class="text-cyan-400 hover:underline mt-2 inline-block">Create a playlist</a>
        </div>
      `;
      return;
    }
    
    let html = '';
    playlists.forEach(playlist => {
      html += `
        <button class="w-full text-left px-4 py-3 hover:bg-indigo-800/50 transition flex items-center space-x-3" 
                data-action="click->playlist#addToPlaylist" 
                data-playlist-id="${playlist.id}">
          <div class="w-10 h-10 flex-shrink-0">
            <img src="${playlist.cover_image || '/default-playlist.svg'}" class="w-full h-full object-cover rounded" 
                 onerror="this.src='/default-playlist.svg'; this.onerror=null;" 
                 alt="${playlist.name}">
          </div>
          <div>
            <div class="font-medium text-white">${playlist.name}</div>
            <div class="text-xs text-gray-400">${playlist.track_count || 0} tracks</div>
          </div>
        </button>
      `;
    });
    
    html += `
      <div class="border-t border-cyan-900/30 mt-2 pt-2">
        <a href="/playlists/new" class="block px-4 py-3 text-cyan-400 hover:bg-indigo-800/50 transition">
          <svg class="w-4 h-4 inline mr-1" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          Create new playlist
        </a>
      </div>
    `;
    
    this.playlistListTarget.innerHTML = html;
  }
  
  showModal() {
    if (this.hasAddToPlaylistModalTarget) {
      this.addToPlaylistModalTarget.classList.remove('hidden');
      
      // Add overlay to the body
      document.body.classList.add('modal-open');
      
      // Add a click event to close the modal when clicking outside
      setTimeout(() => {
        document.addEventListener('click', this.closeModalOutside);
      }, 100);
    }
  }
  
  hideModal() {
    if (this.hasAddToPlaylistModalTarget) {
      this.addToPlaylistModalTarget.classList.add('hidden');
      
      // Remove overlay from the body
      document.body.classList.remove('modal-open');
      
      // Remove the click event
      document.removeEventListener('click', this.closeModalOutside);
    }
  }
  
  closeModalOutside = (event) => {
    if (this.hasAddToPlaylistModalTarget && !this.addToPlaylistModalTarget.contains(event.target)) {
      this.hideModal();
    }
  }
  
  addToPlaylist(event) {
    event.preventDefault();
    
    const playlistId = event.currentTarget.dataset.playlistId;
    
    if (!playlistId || !this.trackId) {
      console.error("Missing playlist ID or track ID");
      return;
    }
    
    // Show loading state on the button
    const button = event.currentTarget;
    const originalContent = button.innerHTML;
    button.innerHTML = `
      <div class="flex items-center justify-center">
        <div class="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-cyan-500 mr-2"></div>
        Adding...
      </div>
    `;
    button.disabled = true;
    
    // Create the request body with necessary data
    const requestBody = {
      track_id: this.trackId
    };
    
    // Add track data if available
    if (this.trackData) {
      requestBody.track_data = this.trackData;
    }
    
    // Make a request to add the track to the playlist
    fetch(`/playlists/${playlistId}/add_track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content
      },
      body: JSON.stringify(requestBody)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to add track to playlist');
      }
      return response.json();
    })
    .then(data => {
      if (data.status === 'success') {
        this.showNotification(`Added to ${data.playlist.name}`);
      } else {
        this.showNotification(data.message || 'Failed to add to playlist');
      }
      this.hideModal();
    })
    .catch(error => {
      console.error("Error adding track to playlist:", error);
      this.showNotification('Failed to add to playlist');
      
      // Restore button state
      button.innerHTML = originalContent;
      button.disabled = false;
    });
  }
  
  showNotification(message) {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('playlist-notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'playlist-notification';
      notification.className = 'fixed bottom-28 right-4 bg-indigo-900/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg shadow-lg transform transition-transform duration-300 translate-y-10 opacity-0 z-50';
      document.body.appendChild(notification);
    }
    
    // Set message and show notification
    notification.textContent = message;
    notification.classList.remove('translate-y-10', 'opacity-0');
    notification.classList.add('translate-y-0', 'opacity-100');
    
    // Hide notification after a delay
    setTimeout(() => {
      notification.classList.remove('translate-y-0', 'opacity-100');
      notification.classList.add('translate-y-10', 'opacity-0');
    }, 2000);
  }
} 