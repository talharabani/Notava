import { Controller } from "@hotwired/stimulus"
import { playWithFallbacks, hasAutoplayRestrictions, unlockAudioContext } from "controllers/audio_helper"

/**
 * Song Element Controller
 * 
 * Handles interaction with individual song elements across the app.
 * This controller connects to any element that should be clickable to play a song.
 * It standardizes the interface between song elements and the global player.
 */
export default class extends Controller {
  static values = {
    song: Object,
    addToQueue: { type: Boolean, default: false }
  }
  
  static targets = ["addToPlaylistButton"]

  connect() {
    console.log("Song element controller connected");
    
    // Mark this element as interactive for styling purposes
    this.element.classList.add('song-interactive');
    
    // Set data attributes if they're not already set
    if (!this.element.dataset.song && this.hasSongValue) {
      this.element.dataset.song = JSON.stringify(this.songValue);
    }
  }
  
  /**
   * Play the song when clicked
   * This is the main entry point for playing a song from any view
   */
  playSong(event) {
    // Don't process clicks on buttons within the song element unless it's the play button itself
    if (event.target.closest('button') && event.target.closest('button') !== this.element && 
        !event.target.closest('button').classList.contains('play-button')) {
      return;
    }
    
    // Stop propagation to prevent multiple handlers
    event.stopPropagation();
    
    // Prevent default action if this is a link or button
    if (this.element.tagName === 'A' || this.element.tagName === 'BUTTON') {
      event.preventDefault();
    }
    
    console.log("Song element clicked, attempting to play song");
    
    try {
      // Try multiple strategies to find song data
      let songData = this.getSongDataFromElement();
      
      if (!songData) {
        console.error("No song data found in element or controller", this.element);
        
        // Try to extract song data from the DOM structure as a last resort
        const extractedData = this.extractSongDataFromDOM();
        if (extractedData) {
          console.log("Extracted song data from DOM:", extractedData);
          
          // Save the extracted data to the element for future use
          this.element.dataset.song = JSON.stringify(extractedData);
          songData = JSON.stringify(extractedData);
        } else {
          // Still no song data, provide visual feedback and return
          this.element.classList.add('song-error');
          setTimeout(() => this.element.classList.remove('song-error'), 1000);
          
          // Try to get the player controller to show a notification
          const playerController = this.getPlayerController();
          if (playerController) {
            playerController.showNotification("Error: Unable to find song data");
          } else {
            console.error("No song data found and player controller not available");
          }
          return;
        }
      }
      
      // Parse the song data to check for preview URL
      try {
        const parsedSong = JSON.parse(songData);
        if (!parsedSong.preview || parsedSong.preview.trim() === '') {
          console.warn("Song data found but missing preview URL:", parsedSong.title);
          
          // Try to find a preview URL in the DOM
          const previewUrl = this.findPreviewUrlInDOM();
          if (previewUrl) {
            parsedSong.preview = previewUrl;
            songData = JSON.stringify(parsedSong);
            console.log("Found preview URL in DOM:", previewUrl);
          } else {
            // Continue anyway - the player controller will handle missing preview URLs
            console.log("No preview URL found, player controller will try fallback methods");
          }
        }
      } catch (parseError) {
        console.error("Error parsing song data:", parseError);
      }
      
      // Get the global player controller
      const playerController = this.getPlayerController();
      if (!playerController) {
        console.error("Player controller not found");
        
        // Try to recreate the player controller connection
        setTimeout(() => {
          const retryPlayerController = this.getPlayerController();
          if (retryPlayerController) {
            this.playWithController(retryPlayerController, songData, event.shiftKey);
          } else {
            // Last resort: try to play the audio directly
            try {
              const parsedSong = JSON.parse(songData);
              this.playAudioDirectly(parsedSong);
            } catch (parseError) {
              console.error("Error parsing song data for direct playback:", parseError);
              this.element.classList.add('song-error');
              setTimeout(() => this.element.classList.remove('song-error'), 1000);
            }
          }
        }, 100);
        return;
      }
      
      // Play the song using the player controller
      this.playWithController(playerController, songData, event.shiftKey);
      
    } catch (error) {
      console.error("Error in playSong method:", error);
      // Provide visual feedback
      this.element.classList.add('song-error');
      setTimeout(() => this.element.classList.remove('song-error'), 1000);
    }
  }
  
  /**
   * Get the global player controller instance
   * @returns {Object} The player controller instance
   */
  getPlayerController() {
    // Try to get the player controller from the window object first
    let playerController = window.playerController;
    
    // If not available, try to get it from the DOM
    if (!playerController) {
      // Look for the player element with data-controller="player"
      const playerElement = document.querySelector('[data-controller="player"]');
      if (playerElement) {
        console.log("Found player element:", playerElement);
        
        // Try to get the controller from Stimulus
        const application = window.Stimulus;
        if (application && application.getControllerForElementAndIdentifier) {
          playerController = application.getControllerForElementAndIdentifier(playerElement, 'player');
          if (playerController) {
            console.log("Found player controller via Stimulus application");
            // Store it globally for future use
            window.playerController = playerController;
          }
        }
      } else {
        // Look for the player bar as a fallback
        const playerBar = document.getElementById('player-bar');
        if (playerBar) {
          console.log("Found player bar element:", playerBar);
          
          // Try to get it from Stimulus
          const application = window.Stimulus;
          if (application && application.getControllerForElementAndIdentifier) {
            playerController = application.getControllerForElementAndIdentifier(playerBar, 'player');
            if (playerController) {
              console.log("Found player controller via player bar");
              // Store it globally for future use
              window.playerController = playerController;
            }
          }
        } else {
          console.error("No player element found");
        }
      }
    }
    
    // If we still don't have it, check if the application is available in a different location
    if (!playerController) {
      if (window.application) {
        console.log("Trying to get controller from window.application");
        const elements = document.querySelectorAll('[data-controller="player"]');
        for (const element of elements) {
          playerController = window.application.getControllerForElementAndIdentifier(element, 'player');
          if (playerController) {
            console.log("Found player controller via window.application");
            window.playerController = playerController;
            break;
          }
        }
      }
    }
    
    return playerController;
  }
  
  /**
   * Add the song to the queue instead of playing immediately
   */
  addToQueue(event) {
    event.stopPropagation();
    event.preventDefault();
    
    const playerController = this.getPlayerController();
    if (!playerController) {
      console.error("Player controller not found");
      return;
    }
    
    const songData = this.element.dataset.song || 
                    (this.hasSongValue ? JSON.stringify(this.songValue) : null);
    
    if (!songData) {
      console.error("No song data found");
      return;
    }
    
    try {
      const song = JSON.parse(songData);
      playerController.addToQueue(song);
      playerController.showNotification(`Added "${song.title}" to queue`);
    } catch (error) {
      console.error("Error adding song to queue:", error);
    }
  }

  // Helper method to play a song with the player controller
  playWithController(playerController, songData, addToQueue = false) {
    // Create a synthetic event to send to the player controller
    const customEvent = new CustomEvent('click', {
      bubbles: true,
      cancelable: true
    });
    
    // Make sure songData is a string
    if (typeof songData === 'object') {
      songData = JSON.stringify(songData);
    }
    
    // Add the dataset property to the event
    Object.defineProperty(customEvent, 'currentTarget', {
      value: {
        dataset: {
          song: songData,
          addToQueue: addToQueue.toString()
        }
      },
      writable: false
    });
    
    // Call the playSong method on the player controller
    playerController.playSong(customEvent);
    
    // Add visual feedback
    this.element.classList.add('song-playing-animation');
    setTimeout(() => this.element.classList.remove('song-playing-animation'), 500);
  }

  // Fallback method to play audio directly if controller is not available
  playAudioDirectly(song) {
    if (!song || !song.preview) {
      console.error("Cannot play directly: missing song or preview URL");
      return;
    }
    
    console.log("Attempting to play directly:", song.preview);
    
    // Create audio element
    const audio = new Audio();
    
    // Use our helper functions for better playback
    if (typeof playWithFallbacks === 'function') {
      playWithFallbacks(
        audio,
        song.preview,
        () => {
          console.log("Playing audio directly (fallback) succeeded");
          window.currentPlayingAudio = audio;
          window.currentPlayingSong = song;
          this.element.classList.add('song-active');
        },
        (error) => {
          console.error("Error playing audio directly:", error);
          this.element.classList.add('song-error');
          setTimeout(() => this.element.classList.remove('song-error'), 1000);
        }
      );
    } else {
      // Standard method as fallback
      audio.src = song.preview;
      audio.volume = 0.7;
      
      // Try to play
      audio.play()
        .then(() => {
          console.log("Playing audio directly (fallback)");
          // Store in window for other components to access
          window.currentPlayingAudio = audio;
          window.currentPlayingSong = song;
          
          // Add visual feedback
          this.element.classList.add('song-active');
        })
        .catch(err => {
          console.error("Error playing audio directly:", err);
          this.element.classList.add('song-error');
          setTimeout(() => this.element.classList.remove('song-error'), 1000);
        });
    }
  }

  // Handle click on the "Add to Playlist" button
  addToPlaylist(event) {
    event.preventDefault();
    event.stopPropagation();
    
    // Get song data
    let songData;
    try {
      songData = this.element.dataset.song || 
                (this.hasSongValue ? JSON.stringify(this.songValue) : null);
      
      if (!songData) {
        console.error("No song data available for adding to playlist");
        return;
      }
      
      const song = JSON.parse(songData);
      const trackId = song.id;
      
      // Find the playlist controller
      const playlistController = this.application.getControllerForElementAndIdentifier(
        document.querySelector('[data-controller="playlist"]'),
        'playlist'
      );
      
      if (playlistController) {
        // Call the method to show the "Add to Playlist" modal
        playlistController.showAddToPlaylistModalGlobal(trackId, songData);
      } else {
        console.error("Playlist controller not found");
        
        // Check if there's a global method to show the playlist modal
        if (window.showAddToPlaylistModal) {
          window.showAddToPlaylistModal(trackId, songData);
        } else {
          console.error("No global method to show playlist modal");
        }
      }
    } catch (error) {
      console.error("Error in addToPlaylist method:", error);
    }
  }

  /**
   * Get song data from the element
   * Tries multiple strategies to find song data
   */
  getSongDataFromElement() {
    try {
      // First, check if we have the song value in the controller
      if (this.hasSongValue) {
        const songData = this.songValue;
        console.log("Found song data in controller value:", songData.title);
        
        // Return song data as a string
        if (typeof songData === 'object') {
          return JSON.stringify(songData);
        }
        return songData;
      }
      
      // Next, check if the element has a data-song attribute
      if (this.element.dataset.song) {
        console.log("Found song data in element dataset");
        
        // Verify that it's valid JSON
        try {
          const parsed = JSON.parse(this.element.dataset.song);
          if (parsed) {
            return this.element.dataset.song;
          }
        } catch (e) {
          console.warn("Invalid JSON in data-song attribute:", e);
          // Continue with other methods
        }
      }
      
      // Check for nested elements with data-song attributes
      const songElements = this.element.querySelectorAll('[data-song]');
      if (songElements.length > 0) {
        console.log("Found nested elements with song data");
        for (const el of songElements) {
          try {
            const parsed = JSON.parse(el.dataset.song);
            if (parsed) {
              return el.dataset.song;
            }
          } catch (e) {
            console.warn("Invalid JSON in nested data-song attribute:", e);
            // Continue with next element
          }
        }
      }
      
      // Look for data-audio-src or similar attributes
      if (this.element.dataset.audioSrc) {
        console.log("Found audio src in element dataset");
        // Create a minimal song object with the audio src
        const songObj = {
          id: `generated-${Date.now()}`,
          title: this.extractTitle() || 'Unknown Track',
          artist: { name: this.extractArtist() || 'Unknown Artist', id: 'unknown' },
          album: { 
            title: 'Unknown Album', 
            cover_medium: this.extractAlbumCover() || '' 
          },
          preview: this.element.dataset.audioSrc
        };
        return JSON.stringify(songObj);
      }
      
      // Try to find an audio element
      const audioElement = this.element.querySelector('audio');
      if (audioElement && audioElement.src) {
        console.log("Found audio element with src");
        // Create a minimal song object with the audio src
        const songObj = {
          id: `generated-${Date.now()}`,
          title: this.extractTitle() || audioElement.getAttribute('title') || 'Unknown Track',
          artist: { name: this.extractArtist() || 'Unknown Artist', id: 'unknown' },
          album: { 
            title: 'Unknown Album', 
            cover_medium: this.extractAlbumCover() || '' 
          },
          preview: audioElement.src
        };
        return JSON.stringify(songObj);
      }
      
      // As a last resort, try to extract song data from the DOM structure
      console.log("Attempting to extract song data from DOM structure");
      const extractedData = this.extractSongDataFromDOM();
      if (extractedData) {
        // Save the extracted data to the element for future use
        this.element.dataset.song = JSON.stringify(extractedData);
        return JSON.stringify(extractedData);
      }
      
      return null;
    } catch (e) {
      console.error("Error getting song data from element:", e);
      return null;
    }
  }

  // Validate that song data has the required fields, especially preview URL
  validateSongData(song) {
    if (!song) return false;
    
    // Check for required fields
    if (!song.id || !song.title) return false;
    
    // Check for preview URL - this is the most critical for playback
    if (!song.preview || song.preview.trim() === '') return false;
    
    return true;
  }

  // Try to enhance song data by adding missing fields
  enhanceSongData(song) {
    if (!song) return null;
    
    // Create a copy of the song to avoid modifying the original
    const enhancedSong = {...song};
    
    // If missing preview URL, try to find one
    if (!enhancedSong.preview || enhancedSong.preview.trim() === '') {
      const previewUrl = this.findPreviewUrlInDOM();
      if (previewUrl) {
        enhancedSong.preview = previewUrl;
      } else {
        return null; // Can't enhance without a preview URL
      }
    }
    
    // Ensure other required fields are present
    if (!enhancedSong.id) enhancedSong.id = `generated-${Date.now()}`;
    if (!enhancedSong.title) enhancedSong.title = this.extractTitle() || 'Unknown Title';
    
    // Ensure artist object is complete
    if (!enhancedSong.artist) {
      enhancedSong.artist = { name: this.extractArtist() || 'Unknown Artist', id: 'unknown' };
    } else if (typeof enhancedSong.artist === 'string') {
      enhancedSong.artist = { name: enhancedSong.artist, id: 'unknown' };
    }
    
    // Ensure album object is complete
    if (!enhancedSong.album) {
      enhancedSong.album = { 
        title: 'Unknown Album', 
        cover_medium: this.extractAlbumCover() || '' 
      };
    }
    
    return enhancedSong;
  }

  // Look for a preview URL in the DOM
  findPreviewUrlInDOM() {
    // Try to find an audio element
    const audio = this.element.querySelector('audio');
    if (audio && audio.src) {
      return audio.src;
    }
    
    // Check for data attributes that might contain a preview URL
    const elementsWithData = this.element.querySelectorAll('[data-preview], [data-audio], [data-src], [data-url], [data-track-url]');
    for (const el of elementsWithData) {
      if (el.dataset.preview) return el.dataset.preview;
      if (el.dataset.audio) return el.dataset.audio;
      if (el.dataset.src) return el.dataset.src;
      if (el.dataset.url) return el.dataset.url;
      if (el.dataset.trackUrl) return el.dataset.trackUrl;
    }
    
    // Check for audio source elements
    const sourceElement = this.element.querySelector('source');
    if (sourceElement && sourceElement.src) {
      return sourceElement.src;
    }
    
    // Look for URL patterns in element attributes
    const allElements = this.element.querySelectorAll('*');
    for (const el of allElements) {
      for (const attr of el.attributes) {
        if (attr.value.includes('.mp3') || attr.value.includes('.wav') || attr.value.includes('/audio/')) {
          return attr.value;
        }
      }
    }
    
    return '';
  }

  // Extract song data from DOM structure as a last resort
  extractSongDataFromDOM() {
    // Look for typical song information in the DOM
    const title = this.extractTitle();
    const artist = this.extractArtist();
    const albumCover = this.extractAlbumCover();
    const previewUrl = this.extractPreviewUrl();
    
    // If we have at least a title and either an artist or preview URL, create a song object
    if (title && (artist || previewUrl)) {
      return {
        id: `generated-${Date.now()}`,
        title: title,
        artist: { name: artist || 'Unknown Artist', id: 'unknown' },
        album: { 
          title: 'Unknown Album', 
          cover_medium: albumCover || '' 
        },
        preview: previewUrl || ''
      };
    }
    
    return null;
  }

  // Extract title from DOM
  extractTitle() {
    // Try different selectors for title
    const titleSelectors = [
      '.song-title', '.track-title', '.title', 
      '[class*="title"]', 'h1', 'h2', 'h3', 'h4', 
      'strong', '.font-medium', '.font-bold'
    ];
    
    for (const selector of titleSelectors) {
      const element = this.element.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }
    
    // If no title found with selectors, try to find any text node that might be a title
    // Often the first text node with content is the title
    const textNodes = Array.from(this.element.querySelectorAll('*'))
      .filter(el => el.childNodes.length === 1 && el.childNodes[0].nodeType === 3)
      .map(el => el.textContent.trim())
      .filter(text => text.length > 0);
    
    return textNodes[0] || '';
  }

  // Extract artist from DOM
  extractArtist() {
    // Try different selectors for artist
    const artistSelectors = [
      '.artist-name', '.artist', '[class*="artist"]', 
      '.text-xs', '.text-sm', '.text-gray-400', '.text-cyan-400'
    ];
    
    for (const selector of artistSelectors) {
      const element = this.element.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }
    
    // If no artist found with selectors, try the second text node (often the artist)
    const textNodes = Array.from(this.element.querySelectorAll('*'))
      .filter(el => el.childNodes.length === 1 && el.childNodes[0].nodeType === 3)
      .map(el => el.textContent.trim())
      .filter(text => text.length > 0);
    
    return textNodes[1] || '';
  }

  // Extract album cover from DOM
  extractAlbumCover() {
    // Try to find an image element
    const img = this.element.querySelector('img');
    if (img && img.src) {
      return img.src;
    }
    
    // Check for background image
    const elementsWithBg = Array.from(this.element.querySelectorAll('*'));
    for (const el of elementsWithBg) {
      const style = window.getComputedStyle(el);
      const bgImage = style.backgroundImage;
      if (bgImage && bgImage !== 'none') {
        // Extract URL from "url('...')" format
        const match = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
        if (match && match[1]) {
          return match[1];
        }
      }
    }
    
    return '';
  }

  // Extract preview URL from DOM
  extractPreviewUrl() {
    // Try to find an audio element or data attribute with preview URL
    const audio = this.element.querySelector('audio');
    if (audio && audio.src) {
      return audio.src;
    }
    
    // Check for data-preview, data-audio, or data-src attributes
    const elementsWithData = this.element.querySelectorAll('[data-preview], [data-audio], [data-src], [data-url]');
    for (const el of elementsWithData) {
      if (el.dataset.preview) return el.dataset.preview;
      if (el.dataset.audio) return el.dataset.audio;
      if (el.dataset.src) return el.dataset.src;
      if (el.dataset.url) return el.dataset.url;
    }
    
    // Check for source elements
    const sourceElement = this.element.querySelector('source');
    if (sourceElement && sourceElement.src) {
      return sourceElement.src;
    }
    
    // Look for any data-song attribute that might contain a parsed JSON object with preview
    const songElements = this.element.querySelectorAll('[data-song]');
    for (const el of songElements) {
      try {
        const songData = JSON.parse(el.dataset.song);
        if (songData && songData.preview) {
          return songData.preview;
        }
      } catch (e) {
        console.error("Error parsing song data:", e);
      }
    }
    
    // Look for any data-* attribute that might contain a preview URL
    const allElements = this.element.querySelectorAll('*');
    for (const el of allElements) {
      for (const key in el.dataset) {
        const value = el.dataset[key];
        // Check if it looks like a media URL
        if (typeof value === 'string' && 
           (value.includes('.mp3') || value.includes('preview') || 
            value.includes('audio') || value.includes('/api/') ||
            value.includes('cdn') || value.includes('stream'))) {
          return value;
        }
      }
    }
    
    // Check for any URLs in the page that might be preview URLs
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('preview')) {
      return searchParams.get('preview');
    }
    
    // As a last resort, check for any script tag that might contain the preview URL
    const scripts = document.querySelectorAll('script:not([src])');
    for (const script of scripts) {
      const content = script.textContent;
      if (content.includes('preview') && content.includes('mp3')) {
        const matches = content.match(/"preview":\s*"([^"]+)"/);
        if (matches && matches[1]) {
          return matches[1];
        }
      }
    }
    
    return '';
  }
} 