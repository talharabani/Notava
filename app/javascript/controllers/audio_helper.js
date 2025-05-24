/**
 * Audio Helper Utilities
 * 
 * This file contains utility functions to help with audio playback,
 * particularly in browsers with autoplay restrictions.
 */

/**
 * Play audio with fallbacks for autoplay restrictions
 * @param {HTMLAudioElement} audio - The audio element to play
 * @param {string} src - The source URL to play
 * @param {function} onSuccess - Callback when playback succeeds
 * @param {function} onError - Callback when all playback attempts fail
 */
export function playWithFallbacks(audio, src, onSuccess, onError) {
  if (!audio || !src) {
    console.error("Invalid audio element or source");
    if (onError) onError(new Error("Invalid audio element or source"));
    return;
  }
  
  // Make sure the source is set
  if (audio.src !== src) {
    audio.src = src;
    try {
      audio.load();
    } catch (e) {
      console.warn("Error pre-loading audio:", e);
    }
  }
  
  // Direct attempt to play
  const playPromise = audio.play();
  
  if (playPromise !== undefined) {
    playPromise.then(() => {
      // Success! Audio is playing
      console.log("Audio playback started successfully");
      if (onSuccess) onSuccess();
    }).catch(error => {
      console.warn("Initial playback failed:", error.name);
      
      // Most likely autoplay was blocked
      if (error.name === 'NotAllowedError') {
        console.log("Autoplay blocked, showing user interaction notification");
        // Mark that we need user interaction
        document.documentElement.setAttribute('data-needs-interaction', 'true');
        
        // Set up a click handler to try again after user interaction
        const unlockAudio = () => {
          document.documentElement.setAttribute('data-user-interacted', 'true');
          document.documentElement.removeAttribute('data-needs-interaction');
          
          console.log("User interaction detected, retrying playback");
          audio.play()
            .then(() => {
              console.log("Playback successful after user interaction");
              if (onSuccess) onSuccess();
            })
            .catch(err => {
              console.error("Playback still failed after user interaction:", err);
              // One last attempt with a fresh load
              setTimeout(() => {
                audio.load();
                audio.play()
                  .then(() => {
                    console.log("Final attempt successful");
                    if (onSuccess) onSuccess();
                  })
                  .catch(finalErr => {
                    console.error("All playback attempts failed:", finalErr);
                    if (onError) onError(finalErr);
                  });
              }, 100);
            });
        };
        
        // Add both click and touch events for better mobile support
        document.addEventListener('click', unlockAudio, { once: true });
        document.addEventListener('touchstart', unlockAudio, { once: true });
      } else {
        // Some other error occurred
        console.error("Error playing audio:", error);
        if (onError) onError(error);
      }
    });
  } else {
    // Browser doesn't return a promise - we're in older browser territory
    // Check if audio is actually playing
    if (audio.paused) {
      console.warn("Audio is still paused after play() call (older browser)");
      document.documentElement.setAttribute('data-needs-interaction', 'true');
      
      // Set up a one-time interaction handler
      const handleOldBrowserInteraction = () => {
        document.documentElement.setAttribute('data-user-interacted', 'true');
        document.documentElement.removeAttribute('data-needs-interaction');
        
        try {
          audio.play();
          setTimeout(() => {
            if (!audio.paused) {
              console.log("Playback successful in older browser");
              if (onSuccess) onSuccess();
            } else {
              console.error("Playback failed in older browser");
              if (onError) onError(new Error("Playback failed in older browser"));
            }
          }, 100);
        } catch (e) {
          console.error("Error in older browser playback:", e);
          if (onError) onError(e);
        }
      };
      
      document.addEventListener('click', handleOldBrowserInteraction, { once: true });
      document.addEventListener('touchstart', handleOldBrowserInteraction, { once: true });
    } else {
      console.log("Audio is playing (older browser)");
      if (onSuccess) onSuccess();
    }
  }
}

/**
 * Check if the browser is likely to have autoplay restrictions
 * @returns {boolean} True if the browser likely has autoplay restrictions
 */
export function hasAutoplayRestrictions() {
  // Check for mobile devices
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  // Check for Safari (which has strict autoplay policies)
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  
  // Check for iOS (all browsers on iOS use WebKit and have strict policies)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  
  return isMobile || isSafari || isIOS;
}

/**
 * Unlock audio context and prepare for user interaction
 * This should be called on the first user interaction with the page
 */
export function unlockAudioContext() {
  document.documentElement.setAttribute('data-user-interacted', 'true');
  
  // If Web Audio API is being used, unlock it
  if (window.AudioContext || window.webkitAudioContext) {
    try {
      // Create a short silent sound and play it to unlock the audio context
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const buffer = audioContext.createBuffer(1, 1, 22050);
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start(0);
      console.log("Audio context unlocked");
    } catch (e) {
      console.error("Error unlocking audio context:", e);
    }
  }
} 