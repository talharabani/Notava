import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["modal", "addToPlaylistModal", "playlistList"]
  
  connect() {
    console.log("Playlist controller connected");
  }
  
  showAddToPlaylistModal(event) {
    event.preventDefault();
    
    const trackId = event.currentTarget.dataset.trackId;
    const trackDataElement = event.currentTarget.closest('tr')?.querySelector('[data-song]');
    const trackData = trackDataElement ? JSON.parse(trackDataElement.dataset.song) : null;
    
    if (!trackId) {
      console.error("No track ID provided");
      return;
    }
    
    // Set the track ID for later use
    this.trackId = trackId;
    this.trackData = trackData;
    
    // Fetch the user's playlists
    fetch('/playlists.json')
      .then(response => response.json())
      .then(playlists => {
        this.renderPlaylistOptions(playlists);
        this.showModal();
      })
      .catch(error => {
        console.error("Error fetching playlists:", error);
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
            <img src="${playlist.cover_image || ''}" class="w-full h-full object-cover rounded" alt="${playlist.name}">
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
    
    // Make a request to add the track to the playlist
    fetch(`/playlists/${playlistId}/add_track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content
      },
      body: JSON.stringify({
        track_id: this.trackId,
        track_data: this.trackData
      })
    })
    .then(response => response.json())
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
      this.hideModal();
    });
  }
  
  showNotification(message) {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('playlist-notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'playlist-notification';
      notification.className = 'fixed bottom-20 right-4 bg-indigo-900/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg shadow-lg transform transition-transform duration-300 translate-y-10 opacity-0 z-50';
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