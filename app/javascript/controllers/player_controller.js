import { Controller } from "@hotwired/stimulus"

// Create a singleton audio player that will be shared across all instances
let globalAudio = null;
let globalIsPlaying = false;
let globalCurrentSong = null;

export default class extends Controller {
  static targets = ["playIcon", "pauseIcon", "progressBar", "volumeBar", "queuePanel", "queueItems"]
  static values = {
    currentSong: Object,
    isPlaying: Boolean,
    isShuffled: Boolean,
    isRepeating: Boolean,
    queue: Array,
    volume: { type: Number, default: 0.7 }
  }

  connect() {
    console.log("Player controller connected");
    
    // Use the global audio instance or create one if it doesn't exist
    if (!globalAudio) {
      globalAudio = new Audio();
      console.log("Created new global audio element");
    }
    
    this.audio = globalAudio;
    this.currentTimeElement = this.element.querySelector('.current-time');
    this.durationElement = this.element.querySelector('.duration');
    this.volumeBarElement = this.element.querySelector('.volume-bar');
    this.queue = [];
    this.currentIndex = 0;

    console.log("Using global audio element");
    console.log("Current time element found:", !!this.currentTimeElement);
    console.log("Duration element found:", !!this.durationElement);

    // Set initial volume
    if (this.audio) {
      this.audio.volume = this.volumeValue;
      console.log("Initial volume set:", this.volumeValue);
    }
    
    if (this.hasVolumeBarTarget) {
      this.volumeBarTarget.style.width = `${this.volumeValue * 100}%`;
      console.log("Volume bar width set");
    }

    // Set up audio event listeners
    if (this.audio) {
      // Remove any existing event listeners to avoid duplicates
      this.audio.removeEventListener('timeupdate', this.updateProgress.bind(this));
      this.audio.removeEventListener('ended', this.handleSongEnd.bind(this));
      this.audio.removeEventListener('loadedmetadata', this.updateDuration.bind(this));
      this.audio.removeEventListener('error', this.handleAudioError.bind(this));
      this.audio.removeEventListener('abort', this.handleAudioAbort.bind(this));
      
      // Add event listeners
      this.audio.addEventListener('timeupdate', this.updateProgress.bind(this));
      this.audio.addEventListener('ended', this.handleSongEnd.bind(this));
      this.audio.addEventListener('loadedmetadata', this.updateDuration.bind(this));
      this.audio.addEventListener('error', this.handleAudioError.bind(this));
      this.audio.addEventListener('abort', this.handleAudioAbort.bind(this));
      console.log("Audio event listeners set up");
    }

    // Load the queue from localStorage
    this.loadQueue();

    // Update UI if there's a current global song
    if (globalCurrentSong) {
      console.log("Restoring global current song:", globalCurrentSong.title);
      this.currentSongValue = globalCurrentSong;
      // Don't overwrite the queue here, we already loaded it above
      if (this.queue.length === 0) {
        this.queue = [globalCurrentSong];
      }
      this.updatePlayerUI(globalCurrentSong);
      this.isPlayingValue = globalIsPlaying;
      this.updatePlayPauseIcon();
      
      // Update progress bar if song is playing
      if (globalIsPlaying && this.hasProgressBarTarget && !isNaN(this.audio.duration)) {
        const progress = (this.audio.currentTime / this.audio.duration) * 100;
        this.progressBarTarget.style.width = `${progress}%`;
        
        if (this.currentTimeElement) {
          this.currentTimeElement.textContent = this.formatTime(this.audio.currentTime);
        }
        
        if (this.durationElement) {
          this.durationElement.textContent = this.formatTime(this.audio.duration);
        }
      }
    } else {
      // Store current song in localStorage if available
      if (typeof localStorage !== 'undefined') {
        const savedSong = localStorage.getItem('currentSong');
        if (savedSong) {
          try {
            const song = JSON.parse(savedSong);
            this.currentSongValue = song;
            globalCurrentSong = song;
            // Only add to queue if queue is empty (we already loaded it above)
            if (this.queue.length === 0) {
              this.queue = [song];
            }
            this.updatePlayerUI(song);
          } catch (e) {
            console.error("Error parsing saved song:", e);
          }
        }
      }
    }
    
    // Register this controller globally
    window.playerController = this;
  }

  disconnect() {
    // Don't clean up audio element since it's shared globally
    console.log("Player controller disconnected, but keeping global audio player");
  }

  playSong(event) {
    console.log("playSong method called");
    try {
      const songData = event.currentTarget.dataset.song;
      const addToQueue = event.currentTarget.dataset.addToQueue === 'true';
      console.log("Song data:", songData, "Add to queue:", addToQueue);
      
      const song = JSON.parse(songData);
      console.log("Parsed song:", song);
      
      if (addToQueue) {
        // Add to queue instead of replacing
        this.addToQueue(song);
      } else {
        // Replace current queue
        this.currentSongValue = song;
        globalCurrentSong = song;
        this.queue = [song];
        this.currentIndex = 0;
        
        // Save current song to localStorage
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('currentSong', JSON.stringify(song));
        }
        
        // Update player UI
        this.updatePlayerUI(song);
        
        // Play the song
        if (song.preview && song.preview.trim() !== '') {
          console.log("Playing preview URL:", song.preview);
          this.playAudio(song.preview);
        } else {
          console.error("No preview URL found in song data");
          
          // Try to find a preview URL from the album or artist if available
          let previewUrl = '';
          
          if (song.album && song.album.tracks && song.album.tracks.data && song.album.tracks.data.length > 0) {
            // Try to get preview from album tracks
            const trackWithPreview = song.album.tracks.data.find(track => track.preview && track.preview.trim() !== '');
            if (trackWithPreview) {
              previewUrl = trackWithPreview.preview;
              console.log("Found preview URL from album tracks:", previewUrl);
            }
          }
          
          if (previewUrl) {
            this.playAudio(previewUrl);
          } else {
            this.handleAudioError();
            
            // Show a more specific error message
            const songTitle = this.element.querySelector('.song-title');
            const artistName = this.element.querySelector('.artist-name');
            
            if (songTitle) songTitle.textContent = 'No preview available';
            if (artistName) artistName.textContent = 'Try another song';
          }
        }
      }
    } catch (error) {
      console.error("Error in playSong method:", error);
      this.handleAudioError();
    }
  }

  updatePlayerUI(song) {
    const songTitle = this.element.querySelector('.song-title');
    const artistName = this.element.querySelector('.artist-name');
    const albumCover = this.element.querySelector('.album-cover');
    
    console.log("UI elements found:", {
      songTitle: !!songTitle,
      artistName: !!artistName,
      albumCover: !!albumCover
    });
    
    if (songTitle) songTitle.textContent = song.title;
    if (artistName) artistName.textContent = song.artist.name;
    if (albumCover) albumCover.src = song.album?.cover_medium || '';
  }

  playAudio(src) {
    console.log("playAudio method called with src:", src);
    if (!src) {
      console.error("No source provided to playAudio");
      this.handleAudioError();
      return;
    }

    // Stop any existing audio playback first - this ensures only one song plays at a time
    if (globalAudio) {
      console.log("Stopping current audio playback");
      globalAudio.pause();
      globalAudio.currentTime = 0;
    }

    if (!this.audio) {
      console.error("Audio element not found");
      // Create a new audio element if it doesn't exist
      this.audio = new Audio();
      globalAudio = this.audio;
      
      // Set up event listeners
      this.audio.addEventListener('timeupdate', this.updateProgress.bind(this));
      this.audio.addEventListener('ended', this.handleSongEnd.bind(this));
      this.audio.addEventListener('loadedmetadata', this.updateDuration.bind(this));
      this.audio.addEventListener('error', this.handleAudioError.bind(this));
      this.audio.addEventListener('abort', this.handleAudioAbort.bind(this));
    }

    // Reset progress bar
    if (this.hasProgressBarTarget) {
      this.progressBarTarget.style.width = '0%';
    }
    
    // Set new source
    this.audio.src = src;
    console.log("Audio source set, attempting to play");
    
    // Check if we can autoplay (browsers often block autoplay)
    const userInteracted = document.documentElement.hasAttribute('data-user-interacted');
    console.log("User has interacted with the page:", userInteracted);
    
    // Reset pending playback flag
    this.pendingPlayback = false;
    
    try {
      // Try to play the audio
      const playPromise = this.audio.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log("Audio playing successfully");
            this.isPlayingValue = true;
            globalIsPlaying = true;
            this.updatePlayPauseIcon();
          })
          .catch(error => {
            console.error('Error playing audio:', error);
            
            if (error.name === 'NotAllowedError') {
              console.log("Autoplay blocked by browser, waiting for user interaction");
              
              // Set pending playback flag
              this.pendingPlayback = true;
              
              // Show a notification to the user
              this.showNotification("Click anywhere to enable audio playback");
              
              // Setup a one-time click handler to resume playback
              const resumePlayback = () => {
                console.log("User interaction detected, trying to play audio again");
                
                this.audio.play()
                  .then(() => {
                    console.log("Audio playing after user interaction");
                    this.isPlayingValue = true;
                    globalIsPlaying = true;
                    this.updatePlayPauseIcon();
                    
                    // Remove the event listener
                    document.removeEventListener('click', resumePlayback);
                  })
                  .catch(err => {
                    console.error("Still can't play audio after user interaction:", err);
                  });
              };
              
              // Add a click event listener to the document
              document.addEventListener('click', resumePlayback, { once: true });
            } else {
              this.handleAudioError();
              
              // Try a fallback approach
              console.log("Trying fallback approach with a new audio element");
              const fallbackAudio = new Audio();
              fallbackAudio.src = src;
              fallbackAudio.volume = this.audio.volume;
              
              fallbackAudio.play()
                .then(() => {
                  console.log("Fallback audio playing successfully");
                  // Replace the main audio element
                  this.audio = fallbackAudio;
                  globalAudio = fallbackAudio;
                  this.isPlayingValue = true;
                  globalIsPlaying = true;
                  this.updatePlayPauseIcon();
                  
                  // Re-attach event listeners
                  this.audio.addEventListener('timeupdate', this.updateProgress.bind(this));
                  this.audio.addEventListener('ended', this.handleSongEnd.bind(this));
                  this.audio.addEventListener('loadedmetadata', this.updateDuration.bind(this));
                  this.audio.addEventListener('error', this.handleAudioError.bind(this));
                  this.audio.addEventListener('abort', this.handleAudioAbort.bind(this));
                })
                .catch(fallbackError => {
                  console.error("Fallback audio also failed:", fallbackError);
                });
            }
          });
      }
    } catch (error) {
      console.error("Error attempting to play audio:", error);
      this.handleAudioError();
    }
  }

  handleAudioError() {
    console.log("handleAudioError method called");
    this.isPlayingValue = false;
    globalIsPlaying = false;
    this.updatePlayPauseIcon();
    
    const songTitle = this.element.querySelector('.song-title');
    const artistName = this.element.querySelector('.artist-name');
    
    if (songTitle) songTitle.textContent = 'Error playing song';
    if (artistName) artistName.textContent = 'Please try another song';
  }

  handleAudioAbort() {
    console.log("handleAudioAbort method called - play was aborted");
    this.isPlayingValue = false;
    globalIsPlaying = false;
    this.updatePlayPauseIcon();
  }

  togglePlay() {
    console.log("togglePlay method called");
    if (!this.audio) {
      console.error("Audio element not found");
      return;
    }
    
    if (this.audio.paused) {
      console.log("Audio is paused, attempting to play");
      const playPromise = this.audio.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log("Audio playing after toggle");
            this.isPlayingValue = true;
            globalIsPlaying = true;
            this.updatePlayPauseIcon();
          })
          .catch(error => {
            if (error.name === 'AbortError') {
              console.log("Play request was aborted during toggle");
              this.handleAudioAbort();
            } else {
              console.error('Error playing audio:', error);
              this.handleAudioError();
            }
          });
      }
    } else {
      console.log("Audio is playing, pausing");
      this.audio.pause();
      this.isPlayingValue = false;
      globalIsPlaying = false;
      this.updatePlayPauseIcon();
    }
  }

  updatePlayPauseIcon() {
    console.log("updatePlayPauseIcon method called, isPlaying:", this.isPlayingValue);
    if (!this.hasPlayIconTarget || !this.hasPauseIconTarget) {
      console.error("Play/pause icon targets not found");
      return;
    }
    
    if (this.isPlayingValue) {
      this.playIconTarget.classList.add('hidden');
      this.pauseIconTarget.classList.remove('hidden');
    } else {
      this.playIconTarget.classList.remove('hidden');
      this.pauseIconTarget.classList.add('hidden');
    }
  }

  previous() {
    console.log("previous method called");
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.playSongFromQueue();
    }
  }

  next() {
    console.log("next method called");
    if (this.currentIndex < this.queue.length - 1) {
      this.currentIndex++;
      this.playSongFromQueue();
    }
  }

  playSongFromQueue() {
    console.log("playSongFromQueue method called");
    
    // Get the song from the queue
    const song = this.queue[this.currentIndex];
    if (!song) {
      console.error("No song found at index", this.currentIndex);
      return;
    }
    
    // Stop any currently playing audio
    if (this.audio) {
      this.audio.pause();
    }
    
    // Update current song values
    this.currentSongValue = song;
    globalCurrentSong = song;
    
    // Save current song to localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('currentSong', JSON.stringify(song));
    }
    
    // Update player UI
    this.updatePlayerUI(song);
    
    // Update the queue UI if the panel is visible
    if (this.hasQueuePanelTarget && !this.queuePanelTarget.classList.contains('hidden')) {
      this.updateQueueUI();
    }
    
    // Check if song has a preview URL
    if (!song.preview || song.preview.trim() === '') {
      console.error("No preview URL found for song:", song.title);
      this.showNotification(`No preview available for: ${song.title}`);
      this.handleAudioError();
      return;
    }
    
    // Play the song
    this.playAudio(song.preview);
  }

  toggleShuffle() {
    console.log("toggleShuffle method called");
    this.isShuffledValue = !this.isShuffledValue;
    if (this.isShuffledValue && this.queue.length > 1) {
      this.shuffleQueue();
    }
  }

  toggleRepeat() {
    console.log("toggleRepeat method called");
    this.isRepeatingValue = !this.isRepeatingValue;
  }

  shuffleQueue() {
    console.log("shuffleQueue method called");
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
  }

  updateProgress() {
    if (!this.audio || !this.hasProgressBarTarget) return;
    
    // Make sure we have a valid duration before calculating progress
    if (isNaN(this.audio.duration) || this.audio.duration === 0) return;
    
    const progress = (this.audio.currentTime / this.audio.duration) * 100;
    this.progressBarTarget.style.width = `${progress}%`;
    
    // Update current time display
    if (this.currentTimeElement) {
      this.currentTimeElement.textContent = this.formatTime(this.audio.currentTime);
    }
    
    // For debugging
    console.log(`Progress: ${progress.toFixed(1)}%, Current time: ${this.audio.currentTime.toFixed(1)}s, Duration: ${this.audio.duration.toFixed(1)}s`);
  }

  updateDuration() {
    console.log("updateDuration method called");
    if (!this.audio) return;
    
    // Make sure we have a valid duration
    if (isNaN(this.audio.duration) || this.audio.duration === 0) {
      console.log("Invalid duration:", this.audio.duration);
      // Try again in a moment
      setTimeout(() => this.updateDuration(), 500);
      return;
    }
    
    console.log("Audio duration:", this.audio.duration);
    
    if (this.durationElement) {
      this.durationElement.textContent = this.formatTime(this.audio.duration);
      console.log("Duration element updated:", this.durationElement.textContent);
    } else {
      console.log("Duration element not found");
    }
  }

  seek(event) {
    console.log("seek method called");
    if (!this.audio) return;
    
    const progressBar = event.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = x / rect.width;
    this.audio.currentTime = percentage * this.audio.duration;
  }

  adjustVolume(event) {
    console.log("adjustVolume method called");
    if (!this.audio) return;
    
    const volumeBar = event.currentTarget;
    const rect = volumeBar.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = Math.min(Math.max(x / rect.width, 0), 1);
    
    console.log("New volume percentage:", percentage);
    this.volumeValue = percentage;
    this.audio.volume = percentage;
    
    // Update all volume bars with the same class
    const volumeBars = document.querySelectorAll('.volume-bar');
    volumeBars.forEach(bar => {
      bar.style.width = `${percentage * 100}%`;
    });
    
    // Save volume preference
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('playerVolume', percentage.toString());
    }
  }

  handleSongEnd() {
    console.log("handleSongEnd method called");
    if (!this.audio) return;
    
    if (this.isRepeatingValue) {
      // If repeat is enabled, just restart the current song
      this.audio.currentTime = 0;
      this.audio.play().catch(error => {
        console.error("Error replaying song:", error);
      });
    } else if (this.currentIndex < this.queue.length - 1) {
      // If there's a next song in the queue, play it
      this.next();
    } else {
      // If we're at the end of the queue
      if (this.queue.length > 0) {
        // If shuffle is enabled, reshuffle the queue and start from the beginning
        if (this.isShuffledValue) {
          this.shuffleQueue();
          this.currentIndex = 0;
          this.playSongFromQueue();
          return;
        }
      }
      
      // Otherwise, just stop playback
      this.isPlayingValue = false;
      globalIsPlaying = false;
      this.updatePlayPauseIcon();
      
      // Show a notification that the queue is finished
      this.showNotification("End of queue reached");
    }
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  // Add a new method to add songs to the queue
  addToQueue(song) {
    console.log("Adding song to queue:", song.title);
    this.queue.push(song);
    
    // If this is the first song, play it immediately
    if (this.queue.length === 1 || (!this.isPlayingValue && this.currentIndex === this.queue.length - 2)) {
      this.currentIndex = this.queue.length - 1;
      this.playSongFromQueue();
    }
    
    // Show a notification
    this.showNotification(`Added to queue: ${song.title}`);
    
    // Save queue to localStorage
    this.saveQueue();
    
    // Update the queue UI if the panel is visible
    if (this.hasQueuePanelTarget && !this.queuePanelTarget.classList.contains('hidden')) {
      this.updateQueueUI();
    }
  }

  // Add a method to save the queue to localStorage
  saveQueue() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('musicQueue', JSON.stringify(this.queue));
    }
  }

  // Add a method to load the queue from localStorage
  loadQueue() {
    if (typeof localStorage !== 'undefined') {
      const savedQueue = localStorage.getItem('musicQueue');
      if (savedQueue) {
        try {
          this.queue = JSON.parse(savedQueue);
          console.log("Loaded queue from localStorage:", this.queue.length, "songs");
        } catch (e) {
          console.error("Error parsing saved queue:", e);
        }
      }
    }
  }

  // Add a method to show notifications
  showNotification(message) {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('player-notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'player-notification';
      notification.className = 'fixed bottom-20 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg transform transition-transform duration-300 translate-y-10 opacity-0 z-50';
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

  // Add a method to clear the queue
  clearQueue() {
    // Keep the current song only
    if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
      const currentSong = this.queue[this.currentIndex];
      this.queue = [currentSong];
      this.currentIndex = 0;
    } else {
      this.queue = [];
      this.currentIndex = -1;
    }
    
    // Save the queue to localStorage
    this.saveQueue();
    
    // Update the queue UI
    this.updateQueueUI();
    
    // Show a notification
    this.showNotification("Queue cleared");
  }

  // Add a method to toggle the queue panel
  toggleQueuePanel() {
    console.log("toggleQueuePanel method called");
    if (this.hasQueuePanelTarget) {
      this.queuePanelTarget.classList.toggle('hidden');
      
      // If showing the panel, update the queue UI
      if (!this.queuePanelTarget.classList.contains('hidden')) {
        this.updateQueueUI();
      }
    }
  }

  // Add a method to update the queue UI
  updateQueueUI() {
    console.log("updateQueueUI method called");
    if (!this.hasQueueItemsTarget) return;
    
    if (this.queue.length === 0) {
      this.queueItemsTarget.innerHTML = `
        <div class="text-center text-gray-500 text-sm py-4">No songs in queue</div>
      `;
      return;
    }
    
    let html = '';
    
    this.queue.forEach((song, index) => {
      const isCurrentSong = index === this.currentIndex;
      
      html += `
        <div class="flex items-center p-2 ${isCurrentSong ? 'bg-gray-700' : 'hover:bg-gray-700'} rounded mb-1">
          <img src="${song.album?.cover_medium || ''}" class="w-10 h-10 rounded mr-2" alt="${song.title}">
          <div class="flex-1 min-w-0">
            <div class="font-medium text-sm truncate ${isCurrentSong ? 'text-pink-500' : 'text-white'}">${song.title}</div>
            <div class="text-gray-400 text-xs truncate">${song.artist?.name || 'Unknown Artist'}</div>
          </div>
          <div class="flex space-x-1">
            ${isCurrentSong ? `
              <span class="text-pink-500">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5.14v14l11-7-11-7z"/>
                </svg>
              </span>
            ` : `
              <button class="text-gray-400 hover:text-white" data-action="click->player#playQueueItem" data-index="${index}">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5.14v14l11-7-11-7z"/>
                </svg>
              </button>
            `}
            <button class="text-gray-400 hover:text-white" data-action="click->player#removeFromQueue" data-index="${index}">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
        </div>
      `;
    });
    
    this.queueItemsTarget.innerHTML = html;
  }

  // Add a method to play a specific item from the queue
  playQueueItem(event) {
    // Prevent default to avoid bubbling
    event.preventDefault();
    event.stopPropagation();
    
    const index = parseInt(event.currentTarget.dataset.index, 10);
    console.log("playQueueItem method called with index:", index);
    
    if (isNaN(index) || index < 0 || index >= this.queue.length) {
      console.error("Invalid queue index:", index);
      return;
    }
    
    // Stop any current playback
    if (this.audio) {
      this.audio.pause();
    }
    
    // Update current index and play the song
    this.currentIndex = index;
    this.playSongFromQueue();
  }

  // Add a method to remove a song from the queue
  removeFromQueue(event) {
    const index = parseInt(event.currentTarget.dataset.index, 10);
    console.log("removeFromQueue method called with index:", index);
    
    if (isNaN(index) || index < 0 || index >= this.queue.length) {
      console.error("Invalid queue index:", index);
      return;
    }
    
    // If removing the current song, play the next one
    if (index === this.currentIndex) {
      if (this.queue.length > 1) {
        // Remove the song
        this.queue.splice(index, 1);
        
        // If we removed the last song, adjust the current index
        if (this.currentIndex >= this.queue.length) {
          this.currentIndex = this.queue.length - 1;
        }
        
        // Play the song at the new current index
        this.playSongFromQueue();
      } else {
        // If it's the only song, just stop playback
        this.audio.pause();
        this.isPlayingValue = false;
        globalIsPlaying = false;
        this.updatePlayPauseIcon();
        
        // Clear the queue
        this.queue = [];
        this.currentIndex = -1;
        
        // Update player UI
        const songTitle = this.element.querySelector('.song-title');
        const artistName = this.element.querySelector('.artist-name');
        const albumCover = this.element.querySelector('.album-cover');
        
        if (songTitle) songTitle.textContent = 'Select a song to play';
        if (artistName) artistName.textContent = '-';
        if (albumCover) albumCover.src = '';
      }
    } else {
      // If removing a different song, just remove it
      this.queue.splice(index, 1);
      
      // If we removed a song before the current one, adjust the current index
      if (index < this.currentIndex) {
        this.currentIndex--;
      }
    }
    
    // Save the queue to localStorage
    this.saveQueue();
    
    // Update the queue UI
    this.updateQueueUI();
  }

  // Add a method to resume pending playback after user interaction
  resumePendingPlayback() {
    console.log("resumePendingPlayback method called");
    
    // If we have a pending playback and the user has interacted with the page
    if (this.pendingPlayback && document.documentElement.hasAttribute('data-user-interacted')) {
      console.log("Resuming pending playback");
      
      // Clear the pending playback flag
      this.pendingPlayback = false;
      
      // Try to play the audio
      if (this.audio && this.audio.paused && this.audio.src) {
        this.audio.play()
          .then(() => {
            console.log("Successfully resumed playback after user interaction");
            this.isPlayingValue = true;
            globalIsPlaying = true;
            this.updatePlayPauseIcon();
          })
          .catch(error => {
            console.error("Failed to resume playback after user interaction:", error);
          });
      }
    }
  }
}