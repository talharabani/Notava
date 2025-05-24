// Configure your import map in config/importmap.rb. Read more: https://github.com/rails/importmap-rails
import "@hotwired/turbo-rails"
import "controllers"
import "global_player"

// Make Stimulus application globally available for controllers to find each other
document.addEventListener('DOMContentLoaded', function() {
  // Find the Stimulus application instance
  if (window.Stimulus === undefined) {
    try {
      // Try to find Stimulus in typical locations
      window.Stimulus = window.application || 
                        (typeof Stimulus !== 'undefined' ? Stimulus : null) || 
                        (typeof StimulusReflex !== 'undefined' ? StimulusReflex.application : null);
      
      console.log("Global Stimulus application initialized");
    } catch (e) {
      console.error("Could not initialize global Stimulus application:", e);
    }
  }
  
  // Set up a global click handler for song elements if needed
  document.addEventListener('click', function(event) {
    const songElement = event.target.closest('[data-song], [data-preview-url], [data-audio-src], .song-card, .song-item');
    if (songElement && !event.defaultPrevented) {
      console.log("Global click handler caught song element click");
      
      // Try to find player controller
      const playerElement = document.querySelector('[data-controller="player"]');
      if (playerElement && window.Stimulus) {
        try {
          const playerController = window.Stimulus.getControllerForElementAndIdentifier(playerElement, 'player');
          if (playerController) {
            console.log("Using player controller to play song");
            
            // Create a custom event
            const customEvent = {
              currentTarget: {
                dataset: songElement.dataset
              }
            };
            
            // Call the player's playSong method
            playerController.playSong(customEvent);
            event.preventDefault();
            return;
          }
        } catch (e) {
          console.error("Error using player controller:", e);
        }
      }
      
      // Fallback: Try to play directly
      if (songElement.dataset.song || songElement.dataset.previewUrl || songElement.dataset.audioSrc) {
        playDirectly(songElement);
        event.preventDefault();
      }
    }
  });
  
  // Function to play audio directly
  function playDirectly(element) {
    let previewUrl = '';
    let songTitle = 'Unknown Track';
    
    // Try to get preview URL from various places
    if (element.dataset.previewUrl) {
      previewUrl = element.dataset.previewUrl;
    } else if (element.dataset.audioSrc) {
      previewUrl = element.dataset.audioSrc;
    } else if (element.dataset.song) {
      try {
        const songData = JSON.parse(element.dataset.song);
        if (songData.preview) {
          previewUrl = songData.preview;
          songTitle = songData.title || songTitle;
        }
      } catch (e) {
        console.error("Error parsing song data:", e);
      }
    }
    
    if (previewUrl) {
      console.log("Playing directly:", previewUrl);
      
      // Create or get audio element
      let audio = window.currentAudio || new Audio();
      window.currentAudio = audio;
      
      // Stop current playback
      audio.pause();
      
      // Set up new audio
      audio.src = previewUrl;
      audio.volume = 0.7;
      
      // Play with error handling
      audio.play()
        .then(() => {
          console.log("Playing song:", songTitle);
          element.classList.add('playing');
        })
        .catch(err => {
          console.error("Error playing audio:", err);
          element.classList.add('error');
          setTimeout(() => element.classList.remove('error'), 1000);
        });
    }
  }
});
