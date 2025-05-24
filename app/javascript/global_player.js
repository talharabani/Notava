/**
 * Global Player Initializer
 * 
 * This script ensures that songs from any part of the application
 * can be played through a global audio player.
 */

document.addEventListener('DOMContentLoaded', function() {
  console.log("Global player initializer running");
  
  // Create a global audio player if none exists
  if (!window.globalAudio) {
    window.globalAudio = new Audio();
    console.log("Created global audio player");
  }
  
  // Add global styles for song interactivity
  const addStyles = () => {
    if (document.getElementById('global-player-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'global-player-styles';
    style.textContent = `
      .song-interactive {
        cursor: pointer;
        position: relative;
      }
      
      .song-interactive:hover {
        background-color: rgba(99, 102, 241, 0.2);
      }
      
      .song-interactive.playing {
        background-color: rgba(45, 212, 191, 0.2);
      }
      
      .song-interactive.error {
        background-color: rgba(239, 68, 68, 0.2);
      }
    `;
    
    document.head.appendChild(style);
  };
  
  // Find and enhance song elements
  const enhanceSongElements = () => {
    // Common selectors for song elements
    const songSelectors = [
      '[data-song]',
      '[data-preview-url]',
      '[data-audio-src]',
      '.song-card',
      '.track-item',
      '.song-item',
      '.track-card'
    ];
    
    // Find all potential song elements
    const elements = document.querySelectorAll(songSelectors.join(','));
    
    elements.forEach(element => {
      // Skip if already enhanced
      if (element.classList.contains('song-interactive')) return;
      
      // Add interactive class
      element.classList.add('song-interactive');
      
      // Add click handler if not using Stimulus
      if (!element.hasAttribute('data-controller')) {
        element.addEventListener('click', function(event) {
          // Skip if clicking on a button or link inside the element
          if (event.target.closest('button, a, [data-action]') && 
              event.target.closest('button, a, [data-action]') !== element) {
            return;
          }
          
          console.log("Song element clicked via direct handler");
          playElement(element);
          
          event.preventDefault();
          event.stopPropagation();
        });
      }
    });
  };
  
  // Play a song element directly
  const playElement = (element) => {
    let previewUrl = '';
    let songData = null;
    
    // Try to get preview URL from various sources
    if (element.dataset.previewUrl) {
      previewUrl = element.dataset.previewUrl;
    } else if (element.dataset.audioSrc) {
      previewUrl = element.dataset.audioSrc;
    } else if (element.dataset.song) {
      try {
        songData = JSON.parse(element.dataset.song);
        if (songData && songData.preview) {
          previewUrl = songData.preview;
        }
      } catch (e) {
        console.error("Error parsing song data:", e);
      }
    }
    
    // If we have an audio source, play it
    if (previewUrl) {
      playSong(previewUrl, element, songData);
    } else {
      console.error("No preview URL found for element:", element);
      element.classList.add('error');
      setTimeout(() => element.classList.remove('error'), 1000);
    }
  };
  
  // Play a song with the global audio player
  const playSong = (previewUrl, element, songData) => {
    // Get or create global audio player
    const audio = window.globalAudio || new Audio();
    window.globalAudio = audio;
    
    // Stop current playback
    audio.pause();
    
    // Reset any previously playing elements
    document.querySelectorAll('.song-interactive.playing').forEach(el => {
      el.classList.remove('playing');
    });
    
    // Set up new audio
    audio.src = previewUrl;
    audio.volume = 0.7;
    
    // Play with error handling
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log("Playing song:", songData ? songData.title : previewUrl);
          element.classList.add('playing');
          
          // Store current song data
          window.currentPlayingSong = songData;
          window.currentPlayingElement = element;
        })
        .catch(err => {
          console.error("Error playing audio:", err);
          element.classList.add('error');
          setTimeout(() => element.classList.remove('error'), 1000);
        });
    }
  };
  
  // Set up mutation observer to enhance new song elements
  const observeDOMChanges = () => {
    const observer = new MutationObserver((mutations) => {
      let shouldEnhance = false;
      
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
          shouldEnhance = true;
        }
      });
      
      if (shouldEnhance) {
        enhanceSongElements();
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  };
  
  // Initialize
  addStyles();
  enhanceSongElements();
  observeDOMChanges();
}); 