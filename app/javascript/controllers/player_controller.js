import { Controller } from "@hotwired/stimulus"
import { playWithFallbacks, hasAutoplayRestrictions, unlockAudioContext } from "controllers/audio_helper"

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
            // Don't rethrow the error, simply log it and continue initialization
            // This prevents controller registration failure
          }
        }
      }
    }
    
    // Set up document-level click handler for autoplay restrictions
    this.setupGlobalInteractionHandler();
    
    // Register this controller globally
    window.playerController = this;
  }

  // Setup a global click handler to help with autoplay restrictions
  setupGlobalInteractionHandler() {
    // Only add if not already added
    if (!window.audioInteractionHandlerAdded) {
      window.audioInteractionHandlerAdded = true;
      
      const handleInteraction = () => {
        console.log("Document interaction detected");
        
        // Use our helper function to unlock audio
        unlockAudioContext();
        
        // If we have pending playback, try to resume it
        if (this.pendingPlayback) {
          this.resumePendingPlayback();
        }
      };
      
      // Add both click and touch events for mobile support
      document.addEventListener('click', handleInteraction);
      document.addEventListener('touchstart', handleInteraction);
      
      console.log("Global interaction handlers set up");
      
      // Show a notification on initial load if the browser likely has autoplay restrictions
      if (hasAutoplayRestrictions()) {
        setTimeout(() => {
          this.showNotification("Tap anywhere to enable audio playback", 5000);
        }, 1000);
      }
    }
  }

  disconnect() {
    // Don't clean up audio element since it's shared globally
    console.log("Player controller disconnected, but keeping global audio player");
  }

  playSong(event) {
    console.log("playSong method called");
    try {
      let songData = event.currentTarget.dataset.song;
      const addToQueue = event.currentTarget.dataset.addToQueue === 'true';
      console.log("Song data:", typeof songData, "Add to queue:", addToQueue);
      
      if (!songData) {
        console.error("No song data provided");
        this.showNotification("Error: No song data available");
        return;
      }
      
      // Parse the song data if it's a string
      let song;
      if (typeof songData === 'string') {
        try {
          song = JSON.parse(songData);
        } catch (parseError) {
          console.error("Error parsing song data:", parseError);
          this.showNotification("Error: Invalid song data format");
          return;
        }
      } else if (typeof songData === 'object') {
        // Already an object
        song = songData;
      } else {
        console.error("Unexpected song data type:", typeof songData);
        this.showNotification("Error: Invalid song data type");
        return;
      }
      
      console.log("Parsed song:", song);
      
      // Check for preview URL early
      if (!song.preview || song.preview.trim() === '') {
        console.error("No preview URL found in song data");
        this.showNotification(`No preview available for: ${song.title}`);
        
        // Try to find an alternative preview immediately
        this.findAlternativePreview(song)
          .then(alternativeUrl => {
            if (alternativeUrl) {
              console.log("Found alternative preview:", alternativeUrl);
              song.preview = alternativeUrl;
              this.processSongAfterPreviewCheck(song, addToQueue);
            } else {
              this.handleAudioError();
            }
          })
          .catch(error => {
            console.error("Error finding alternative preview:", error);
            this.handleAudioError();
          });
        return;
      }
      
      this.processSongAfterPreviewCheck(song, addToQueue);
    } catch (error) {
      console.error("Error in playSong method:", error);
      this.handleAudioError();
      this.showNotification("Error playing song");
    }
  }

  // New helper method to process song after preview URL check
  processSongAfterPreviewCheck(song, addToQueue) {
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
      console.log("Playing preview URL:", song.preview);
      this.playAudio(song.preview);
    }
  }

  /**
   * Find an alternative preview URL for a song
   * This method tries different approaches to find a playable audio source
   * @param {Object} song - The song object
   * @returns {Promise<string|null>} - Promise resolving to an alternative URL or null
   */
  async findAlternativePreview(song) {
    if (!song || !song.id) {
      console.warn("Cannot find alternative preview without a valid song object");
      return null;
    }
    
    console.log("Finding alternative preview for song:", song.title);
    
    try {
      // Track whether we're already trying a proxy
      const isProxyAttempt = song.preview && song.preview.includes('/audio-proxy');
      
      // First attempt: Try the audio proxy if the original URL exists and we're not already using it
      if (song.preview && !isProxyAttempt) {
        const proxyUrl = `/audio-proxy?url=${encodeURIComponent(song.preview)}`;
        console.log("Generated proxy URL:", proxyUrl);
        return proxyUrl;
      }
      
      // If we're already using a proxy, try the direct URL instead
      if (isProxyAttempt) {
        try {
          // Extract the original URL from the proxy URL
          const originalUrlMatch = song.preview.match(/url=([^&]+)/);
          if (originalUrlMatch && originalUrlMatch[1]) {
            const originalUrl = decodeURIComponent(originalUrlMatch[1]);
            console.log("Extracted original URL from proxy:", originalUrl);
            return originalUrl;
          }
        } catch (e) {
          console.warn("Error extracting original URL from proxy:", e);
        }
      }
      
      // Second attempt: Try to fetch the song details from our API to get a fresh URL
      try {
        const response = await fetch(`/music/search?query=${encodeURIComponent(song.title + " " + song.artist.name)}&format=json`);
        if (response.ok) {
          const data = await response.json();
          
          // Look for an exact match by ID
          let foundTrack = null;
          
          if (data.tracks && data.tracks.length > 0) {
            // First try to find by ID
            foundTrack = data.tracks.find(track => track.id === song.id);
            
            // If not found by ID, try to find by title and artist
            if (!foundTrack) {
              foundTrack = data.tracks.find(track => 
                track.title.toLowerCase() === song.title.toLowerCase() && 
                track.artist.name.toLowerCase() === song.artist.name.toLowerCase()
              );
            }
            
            // If still not found, just use the first result
            if (!foundTrack) {
              foundTrack = data.tracks[0];
            }
            
            if (foundTrack && foundTrack.preview) {
              console.log("Found alternative preview URL from API:", foundTrack.preview);
              // Use the new URL directly first, then try proxying if needed
              const newUrl = foundTrack.preview;
              
              // If we were already using a proxy and it failed, don't proxy the new URL immediately
              if (isProxyAttempt) {
                return newUrl;
              } else {
                // Otherwise try both options - direct first, then proxy as fallback
                try {
                  const checkResponse = await fetch(newUrl, { 
                    method: 'HEAD',
                    mode: 'no-cors'
                  });
                  
                  if (checkResponse.ok || checkResponse.status === 0) {
                    return newUrl;
                  }
                } catch (e) {
                  console.warn("Error checking new URL, will try proxy:", e);
                }
                
                // If direct access fails or throws, try the proxy
                return `/audio-proxy?url=${encodeURIComponent(newUrl)}`;
              }
            }
          }
        }
      } catch (apiError) {
        console.warn("Error fetching from API for alternative preview:", apiError);
      }
      
      // Third attempt: Try different file formats by modifying the original URL
      if (song.preview && !isProxyAttempt) {
        let urlToModify = song.preview;
        
        try {
          // Normalize the URL first
          const url = new URL(urlToModify);
          const path = url.pathname;
          const extension = path.split('.').pop().toLowerCase();
          
          // Try alternative formats
          const alternativeFormats = ['mp3', 'aac', 'ogg', 'wav', 'm4a', 'flac'].filter(format => format !== extension);
          
          for (const format of alternativeFormats) {
            // Only try a few formats to avoid too many requests
            if (alternativeFormats.indexOf(format) > 2) break;
            
            const newPath = path.replace(new RegExp(`\\.${extension}$`), `.${format}`);
            const alternativeUrl = new URL(newPath, url.origin);
            console.log(`Trying alternative format: ${format} at ${alternativeUrl.href}`);
            
            try {
              // Try the alternative format via proxy directly since this is a speculative attempt
              const formatProxyUrl = `/audio-proxy?url=${encodeURIComponent(alternativeUrl.href)}`;
              return formatProxyUrl;
            } catch (formatError) {
              console.warn(`Error creating alternative format URL ${format}:`, formatError);
            }
          }
        } catch (urlError) {
          console.warn("Error modifying URL for alternative formats:", urlError);
        }
      }
      
      // Fourth attempt: Try different CDN domains if the URL contains a known pattern
      if (song.preview && !isProxyAttempt) {
        try {
          // Replace the CDN domain pattern with alternatives
          const cdnPatterns = [
            { from: 'cdns-preview-', to: 'cdns-alt-preview-' },
            { from: 'cdns-preview-', to: 'e-cdns-proxy-' },
            { from: 'e-cdns-', to: 'cdns-' },
            { from: 'cdnt-preview', to: 'cdns-preview' }
          ];
          
          for (const pattern of cdnPatterns) {
            if (song.preview.includes(pattern.from)) {
              const altCdnUrl = song.preview.replace(pattern.from, pattern.to);
              console.log(`Trying alternative CDN URL: ${altCdnUrl}`);
              
              // Try via proxy since this is a speculative attempt
              const cdnProxyUrl = `/audio-proxy?url=${encodeURIComponent(altCdnUrl)}`;
              return cdnProxyUrl;
            }
          }
        } catch (cdnError) {
          console.warn("Error trying alternative CDNs:", cdnError);
        }
      }
      
      // Fifth attempt: If we still don't have anything and we're not already in a proxy attempt,
      // try the proxy with the original URL anyway as a last resort
      if (song.preview && !isProxyAttempt) {
        return `/audio-proxy?url=${encodeURIComponent(song.preview)}`;
      } else if (isProxyAttempt) {
        // If we're already in a proxy attempt that failed, try a direct connection
        try {
          // Extract the original URL from the proxy URL
          const originalUrlMatch = song.preview.match(/url=([^&]+)/);
          if (originalUrlMatch && originalUrlMatch[1]) {
            const originalUrl = decodeURIComponent(originalUrlMatch[1]);
            console.log("Last resort: trying original URL directly:", originalUrl);
            return originalUrl;
          }
        } catch (e) {
          console.warn("Error extracting original URL in last resort:", e);
        }
      }
      
      console.warn("Could not find any alternative preview for:", song.title);
      return null;
    } catch (error) {
      console.error("Error in findAlternativePreview:", error);
      return null;
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
    
    // Dispatch a custom event to notify that the song has changed
    const songChangedEvent = new CustomEvent('songChanged', { 
      detail: { song: song },
      bubbles: true
    });
    document.dispatchEvent(songChangedEvent);
    
    // Add active class to any matching song elements in the DOM
    this.updateActiveElements(song);
  }

  // Mark elements with matching song as active and remove active state from others
  updateActiveElements(song) {
    if (!song || !song.id) return;
    
    // Remove active class from all song elements
    document.querySelectorAll('.song-active, .playing').forEach(element => {
      element.classList.remove('song-active', 'playing');
    });
    
    // Add active class to matching song elements
    try {
      document.querySelectorAll('[data-song]').forEach(element => {
        try {
          const songData = JSON.parse(element.dataset.song);
          if (songData.id === song.id) {
            element.classList.add('song-active', 'playing');
            
            // If this element is in a scrollable container, scroll to it
            const scrollContainer = element.closest('.scrollable-container, .overflow-auto, [style*="overflow"]');
            if (scrollContainer) {
              const elementTop = element.offsetTop;
              const containerScrollTop = scrollContainer.scrollTop;
              const containerHeight = scrollContainer.clientHeight;
              
              // Only scroll if the element is outside the visible area
              if (elementTop < containerScrollTop || elementTop > containerScrollTop + containerHeight) {
                scrollContainer.scrollTo({
                  top: elementTop - containerHeight / 2,
                  behavior: 'smooth'
                });
              }
            }
          }
        } catch (e) {
          console.error("Error parsing song data:", e);
        }
      });
    } catch (e) {
      console.error("Error updating active elements:", e);
    }
    
    // Also update any elements with the current song ID as a data attribute
    document.querySelectorAll(`[data-song-id="${song.id}"]`).forEach(element => {
      element.classList.add('song-active', 'playing');
    });
  }

  playAudio(src) {
    console.log("playAudio method called with initial src:", src);
    if (!src) {
      console.error("No source provided to playAudio");
      this.handleAudioError();
      return;
    }

    let audioUrl = src; // Use a new variable for the final audio URL

    // Check if the source string is likely a JSON object containing the actual preview URL
    if (typeof audioUrl === 'string' && audioUrl.trim().startsWith('{') && audioUrl.trim().endsWith('}')) {
      console.log("Source appears to be a JSON string, attempting to parse for preview URL.");
      try {
        const parsedSongData = JSON.parse(audioUrl);
        if (parsedSongData && parsedSongData.preview) {
          audioUrl = parsedSongData.preview;
          console.log("Extracted actual preview URL from JSON:", audioUrl);
        } else {
          console.warn("Parsed JSON, but no preview URL found inside. Original source was:", audioUrl);
          // Potentially handle error or try to use audioUrl as is if parsing failed to find preview
        }
      } catch (e) {
        console.error("Failed to parse source as JSON, though it looked like one. Original source was:", audioUrl, "Error:", e);
        // audioUrl remains the original src; proceed to URL validation, which might fail
      }
    }

    // Now, validate/normalize the audioUrl (which should be an actual URL string here)
    try {
      // If audioUrl is already an absolute URL, the base window.location.href is ignored.
      // If it's relative, it's resolved against the base.
      const url = new URL(audioUrl, window.location.href);
      audioUrl = url.href; // Use the normalized URL
      console.log("Normalized audio URL for playback:", audioUrl);
    } catch (urlError) {
      console.error("Invalid audio URL format after potential JSON parsing. Attempted URL:", audioUrl, "Error:", urlError);
      this.handleAudioError();
      return;
    }

    // Stop any existing audio playback first - this ensures only one song plays at a time
    if (globalAudio) {
      console.log("Stopping current audio playback");
      globalAudio.pause();
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
    
    // Reset the audio element
    this.audio.currentTime = 0;
    
    // Set volume to current value
    this.audio.volume = this.volumeValue;
    
    // Log the source URL before attempting to play
    console.log("Attempting to play final audio source:", audioUrl);

    // Use our audio helper for improved playback
    playWithFallbacks(
      this.audio, 
      audioUrl, // Use the processed audioUrl
      // Success callback
      () => {
        console.log("Playback successful via helper");
        this.isPlayingValue = true;
        globalIsPlaying = true;
        this.updatePlayPauseIcon();
        document.documentElement.removeAttribute('data-needs-interaction');
      },
      // Error callback
      (error) => {
        console.error("All playback attempts failed:", error);
        this.handleAudioError(error);
        this.showNotification("Could not play audio. Try tapping the player.", 5000);
      }
    );
  }

  handleAudioError(error) {
    console.log("handleAudioError method called", error);
    this.isPlayingValue = false;
    globalIsPlaying = false;
    this.updatePlayPauseIcon();
    
    const songTitle = this.element.querySelector('.song-title');
    const artistName = this.element.querySelector('.artist-name');
    
    let errorMessage = 'Error playing song';
    let actionMessage = 'Please try another song';
    
    // Provide more specific error messages based on the error type
    if (error) {
      if (error.name === 'NotSupportedError') {
        errorMessage = 'Audio format not supported';
        actionMessage = 'Try a different song or format';
        
        // Log detailed information for troubleshooting
        console.error('NotSupportedError details:', {
          src: this.audio ? this.audio.src : 'No audio element',
          currentSong: this.currentSong ? this.currentSong.title : 'No current song',
          browser: navigator.userAgent
        });
        
        // Try to recover by finding an alternative source or format
        if (this.currentSong && this.currentSong.id) {
          this.findAlternativePreview(this.currentSong)
            .then(alternativeUrl => {
              if (alternativeUrl) {
                console.log("Found alternative preview URL:", alternativeUrl);
                // Attempt to play the alternative URL
                this.playAudio(alternativeUrl);
              } else {
                // No alternative found, show notification
                this.showNotification("This audio format isn't supported by your browser. Try another song.", 5000);
              }
            })
            .catch(err => {
              console.error("Error finding alternative preview:", err);
              this.showNotification("Couldn't play this song. Please try another.", 5000);
            });
        }
      } else if (error.name === 'AbortError') {
        errorMessage = 'Playback was interrupted';
        actionMessage = 'Please try again';
      } else if (error.name === 'NetworkError' || (error.message && error.message.includes('network'))) {
        errorMessage = 'Network error';
        actionMessage = 'Check your connection and try again';
        
        // Retry with the proxy if the current URL isn't already using it
        if (this.audio && this.audio.src && !this.audio.src.includes('/audio-proxy')) {
          const originalUrl = this.audio.src;
          console.log("Network error - trying to play through audio proxy:", originalUrl);
          
          // Use our proxy endpoint
          const proxyUrl = `/audio-proxy?url=${encodeURIComponent(originalUrl)}`;
          
          // Small delay before retry
          setTimeout(() => {
            this.playAudio(proxyUrl);
            this.showNotification("Retrying playback via proxy...");
          }, 500);
          
          return; // Exit early as we're handling this automatically
        }
      } else if (error.status === 500 || (this.audio && this.audio.src && this.audio.src.includes('/audio-proxy'))) {
        // Handle 500 errors from our proxy specifically
        errorMessage = 'Server proxy error';
        actionMessage = 'We\'ll try an alternative source';
        
        // If this is a proxy error, try to use the direct URL instead
        if (this.audio && this.audio.src && this.audio.src.includes('/audio-proxy')) {
          // Extract the original URL from the proxy URL
          const urlParam = new URLSearchParams(new URL(this.audio.src).search).get('url');
          
          if (urlParam) {
            console.log("Proxy error - trying direct playback:", urlParam);
            
            // Try direct playback with a small delay
            setTimeout(() => {
              this.playAudio(urlParam);
              this.showNotification("Trying direct playback...");
            }, 500);
            
            return; // Exit early as we're handling this automatically
          }
        }
        
        // If we're here, try to find an alternative preview
        if (this.currentSong && this.currentSong.id) {
          this.findAlternativePreview(this.currentSong)
            .then(alternativeUrl => {
              if (alternativeUrl) {
                console.log("Found alternative preview after proxy error:", alternativeUrl);
                // Attempt to play the alternative URL
                this.playAudio(alternativeUrl);
              }
            })
            .catch(() => {
              // Already showing error message, no need for additional notification
            });
        }
      } else {
        // Generic error with error name if available
        errorMessage = `Playback error: ${error.name || 'Unknown'}`;
      }
    }
    
    if (songTitle) songTitle.textContent = errorMessage;
    if (artistName) artistName.textContent = actionMessage;
    
    // Show notification for better user feedback
    this.showNotification(`${errorMessage}. ${actionMessage}`, 4000);
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

  next() {
    console.log("next method called");
    if (this.currentIndex < this.queue.length - 1) {
      this.currentIndex++;
      this.playSongFromQueue();
    } else {
      console.log("End of queue reached, looking for more songs");
      this.findMoreSongs()
        .then(success => {
          if (success && this.queue.length > this.currentIndex + 1) {
            this.currentIndex++;
            this.playSongFromQueue();
          } else {
            console.log("No more songs available");
            this.showNotification("End of playlist reached");
          }
        })
        .catch(error => {
          console.error("Error finding more songs:", error);
        });
    }
  }

  previous() {
    console.log("previous method called");
    
    // If we're more than 3 seconds into the song, restart it instead of going to previous
    if (this.audio && this.audio.currentTime > 3) {
      console.log("Restarting current song");
      this.audio.currentTime = 0;
      return;
    }
    
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.playSongFromQueue();
    } else {
      console.log("Already at the beginning of queue");
      this.showNotification("Beginning of playlist reached");
      
      // Just restart the current song
      if (this.audio) {
        this.audio.currentTime = 0;
      }
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
    console.log("Song ended");

    // If we're on repeat mode, play the same song again
    if (this.isRepeatingValue) {
      console.log("Repeating current song");
      this.audio.currentTime = 0;
      this.playAudio(this.audio.src);
      return;
    }

    // Otherwise, play the next song in the queue
    if (this.queue.length > 1) {
      if (this.currentIndex < this.queue.length - 1) {
        console.log("Playing next song in queue");
        this.currentIndex++;
        this.playSongFromQueue();
      } else {
        // We've reached the end of the queue
        if (this.isShuffledValue) {
          console.log("End of queue reached in shuffle mode, shuffling queue");
          this.shuffleQueue();
          this.currentIndex = 0;
          this.playSongFromQueue();
        } else {
          console.log("End of queue reached, finding more songs");
          
          // Try to find more songs to play
          this.findMoreSongs()
            .then(success => {
              if (success && this.queue.length > this.currentIndex + 1) {
                this.currentIndex++;
                this.playSongFromQueue();
              } else {
                console.log("No more songs found, stopping playback");
                this.isPlayingValue = false;
                globalIsPlaying = false;
                this.updatePlayPauseIcon();
                this.showNotification("End of playlist reached");
              }
            })
            .catch(error => {
              console.error("Error finding more songs:", error);
              this.isPlayingValue = false;
              globalIsPlaying = false;
              this.updatePlayPauseIcon();
            });
        }
      }
    } else {
      console.log("No more songs in queue, finding more");
      
      this.findMoreSongs()
        .then(success => {
          if (success && this.queue.length > 1) {
            this.currentIndex = 1; // Skip the song that just ended
            this.playSongFromQueue();
          } else {
            console.log("No more songs found, stopping playback");
            this.isPlayingValue = false;
            globalIsPlaying = false;
            this.updatePlayPauseIcon();
          }
        })
        .catch(error => {
          console.error("Error finding more songs:", error);
          this.isPlayingValue = false;
          globalIsPlaying = false;
          this.updatePlayPauseIcon();
        });
    }
  }

  // New method to find more songs from the page or via API
  async findMoreSongs() {
    console.log("Finding more songs to play");
    
    // First try to find songs in the current view
    const songsInView = await this.findSongsInCurrentView();
    if (songsInView.length > 0) {
      console.log("Found songs in current view, adding to queue:", songsInView.length);
      songsInView.forEach(song => this.queue.push(song));
      this.saveQueue();
      return true;
    }
    
    // Then try to find recommended songs based on the current song
    const recommendedSongs = await this.findRecommendedSongs();
    if (recommendedSongs.length > 0) {
      console.log("Found recommended songs, adding to queue:", recommendedSongs.length);
      recommendedSongs.forEach(song => this.queue.push(song));
      this.saveQueue();
      return true;
    }
    
    // Try to fetch featured songs from API
    try {
      console.log("Fetching featured songs from API");
      const response = await fetch('/music/chart?format=json');
      if (response.ok) {
        const data = await response.json();
        if (data.tracks && data.tracks.length > 0) {
          console.log("Found featured songs from API, adding to queue:", data.tracks.length);
          data.tracks.forEach(track => {
            // Only add if not already in queue
            if (!this.queue.find(song => song.id === track.id)) {
              this.queue.push(track);
            }
          });
          this.saveQueue();
          return true;
        }
      }
    } catch (error) {
      console.error("Error fetching featured songs:", error);
    }
    
    // If all else fails, return false
    return false;
  }

  // Find recommended songs based on the current song
  async findRecommendedSongs() {
    // If no current song, return empty array
    if (!this.currentSongValue) {
      return [];
    }

    try {
      console.log("Finding recommended songs for:", this.currentSongValue.title);
      
      // First, look for similar songs in the current view
      const songsInView = await this.findSongsInCurrentView();
      if (songsInView.length > 0) {
        return songsInView;
      }
      
      // If no songs found in the current view, try to find songs from the same artist
      // or look for elements that might contain similar songs
      const songElements = document.querySelectorAll('[data-song]');
      const similarSongs = [];
      
      songElements.forEach(element => {
        try {
          const songData = JSON.parse(element.dataset.song);
          // Check if this is a different song from the current one
          if (songData.id !== this.currentSongValue.id) {
            // Check if it's by the same artist
            if (songData.artist.name === this.currentSongValue.artist.name) {
              similarSongs.push(songData);
            }
          }
        } catch (error) {
          console.error("Error parsing song data:", error);
        }
      });
      
      // Return found similar songs, up to 5
      return similarSongs.slice(0, 5);
    } catch (error) {
      console.error("Error finding recommended songs:", error);
      return [];
    }
  }

  // Find songs in the current view that aren't already in the queue
  async findSongsInCurrentView() {
    try {
      console.log("Finding songs in current view");
      const songElements = document.querySelectorAll('[data-song]');
      const songs = [];
      const currentIds = this.queue.map(song => song.id);
      
      songElements.forEach(element => {
        try {
          const songData = JSON.parse(element.dataset.song);
          // Only add songs that aren't already in the queue
          if (!currentIds.includes(songData.id)) {
            songs.push(songData);
          }
        } catch (error) {
          console.error("Error parsing song data:", error);
        }
      });
      
      // Return found songs, up to 10
      return songs.slice(0, 10);
    } catch (error) {
      console.error("Error finding songs in current view:", error);
      return [];
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
  showNotification(message, duration = 2000) {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('player-notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'player-notification';
      notification.className = 'fixed bottom-20 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg transform transition-transform duration-300 translate-y-10 opacity-0 z-50';
      document.body.appendChild(notification);
      
      // Add click handler to dismiss notification
      notification.addEventListener('click', () => {
        notification.classList.remove('translate-y-0', 'opacity-100', 'persistent');
        notification.classList.add('translate-y-10', 'opacity-0');
      });
    }
    
    // Clear any existing timeout
    if (notification.timeoutId) {
      clearTimeout(notification.timeoutId);
      notification.timeoutId = null;
    }
    
    // Add persistent class for longer notifications
    if (duration > 3000) {
      notification.classList.add('persistent');
    } else {
      notification.classList.remove('persistent');
    }
    
    // Set message and show notification
    notification.textContent = message;
    notification.classList.remove('translate-y-10', 'opacity-0');
    notification.classList.add('translate-y-0', 'opacity-100');
    
    // Hide notification after a delay
    notification.timeoutId = setTimeout(() => {
      notification.classList.remove('translate-y-0', 'opacity-100', 'persistent');
      notification.classList.add('translate-y-10', 'opacity-0');
    }, duration);
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
      
      // Remove any needs-interaction indication
      document.documentElement.removeAttribute('data-needs-interaction');
      
      // Try to play the audio
      if (this.audio && this.audio.paused && this.audio.src) {
        // Show loading indicator
        this.showNotification("Starting playback...", 2000);
        
        // Use our audio helper for improved playback
        playWithFallbacks(
          this.audio,
          this.audio.src,
          // Success callback
          () => {
            console.log("Successfully resumed playback after user interaction");
            this.isPlayingValue = true;
            globalIsPlaying = true;
            this.updatePlayPauseIcon();
            this.showNotification("Now playing: " + (this.currentSongValue?.title || "Unknown track"));
          },
          // Error callback
          (error) => {
            console.error("Failed to resume playback after user interaction:", error);
            this.handleAudioError();
            this.showNotification("Unable to play this track");
          }
        );
      }
    }
  }
}