/**
 * Audio Helper Utilities
 * 
 * This file contains utility functions to help with audio playback,
 * particularly in browsers with autoplay restrictions.
 */

/**
 * Audio format fallbacks to try if the primary format fails
 */
const FORMAT_FALLBACKS = {
  'mp3': ['mp3', 'aac', 'wav', 'ogg'],
  'ogg': ['ogg', 'mp3', 'aac', 'wav'],
  'aac': ['aac', 'mp3', 'wav', 'ogg'],
  'wav': ['wav', 'mp3', 'aac', 'ogg']
};

/**
 * Supported audio MIME types based on browser testing
 */
const SUPPORTED_AUDIO_TYPES = {
  'mp3': 'audio/mpeg',
  'ogg': 'audio/ogg',
  'wav': 'audio/wav',
  'aac': 'audio/aac',
  'm4a': 'audio/mp4',
  'flac': 'audio/flac'
};

/**
 * Global cache for tested URL validity to avoid repeated network requests
 */
const urlValidityCache = new Map();

/**
 * Check if the URL is valid and accessible
 * @param {string} url - URL to check
 * @returns {Promise<boolean>} - Promise resolving to true if URL is valid and accessible
 */
async function isUrlValid(url) {
  if (!url) return false;
  
  // Check cache first
  if (urlValidityCache.has(url)) {
    return urlValidityCache.get(url);
  }
  
  try {
    // Try a HEAD request first to avoid downloading the entire file
    const response = await fetch(url, { 
      method: 'HEAD',
      mode: 'cors',
      cache: 'no-cache',
      credentials: 'same-origin',
      redirect: 'follow',
      referrerPolicy: 'no-referrer',
      timeout: 2000 // 2 second timeout
    });
    
    const isValid = response.ok;
    urlValidityCache.set(url, isValid);
    return isValid;
  } catch (error) {
    console.warn(`URL validity check failed for ${url}:`, error);
    
    // If HEAD request fails, try a GET request with range header to get just the first few bytes
    try {
      const response = await fetch(url, { 
        headers: { 'Range': 'bytes=0-1024' },
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'same-origin',
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
        timeout: 3000 // 3 second timeout
      });
      
      const isValid = response.ok;
      urlValidityCache.set(url, isValid);
      return isValid;
    } catch (error) {
      console.error(`Both HEAD and GET requests failed for ${url}:`, error);
      urlValidityCache.set(url, false);
      return false;
    }
  }
}

/**
 * Detect audio format from URL
 * @param {string} url - URL to detect format from
 * @returns {string|null} - Format string or null if not detected
 */
function detectFormatFromUrl(url) {
  if (!url) return null;
  
  try {
    // Extract the file extension from the URL
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    const extension = path.split('.').pop().toLowerCase();
    
    // Check if the extension is a known audio format
    if (SUPPORTED_AUDIO_TYPES[extension]) {
      return extension;
    }
    
    // Check if the URL contains format information in the query string
    const params = new URLSearchParams(urlObj.search);
    for (const [key, value] of params.entries()) {
      if (key === 'format' && SUPPORTED_AUDIO_TYPES[value]) {
        return value;
      }
    }
    
    return null;
  } catch (error) {
    console.warn(`Error detecting format from URL ${url}:`, error);
    return null;
  }
}

/**
 * Generate alternative URL formats to try
 * @param {string} originalUrl - Original URL 
 * @returns {string[]} - Array of alternative URLs to try
 */
function generateAltUrls(originalUrl) {
  if (!originalUrl) return [];
  
  const altUrls = [];
  
  try {
    const urlObj = new URL(originalUrl);
    const path = urlObj.pathname;
    const currentFormat = path.split('.').pop().toLowerCase();
    
    // Only proceed if we can detect the current format
    if (SUPPORTED_AUDIO_TYPES[currentFormat]) {
      // Get possible format fallbacks
      const fallbacks = FORMAT_FALLBACKS[currentFormat] || ['mp3', 'aac', 'wav', 'ogg'];
      
      // For each fallback format, create an alternative URL
      for (const format of fallbacks) {
        if (format !== currentFormat) {
          // Replace the extension in the path
          const newPath = path.replace(new RegExp(`\\.${currentFormat}$`), `.${format}`);
          const altUrl = new URL(newPath, urlObj.origin);
          altUrl.search = urlObj.search;
          altUrls.push(altUrl.href);
        }
      }
    }
    
    // Add a CORS proxy version as a last resort
    if (urlObj.origin !== window.location.origin) {
      const corsProxyUrl = `/audio-proxy?url=${encodeURIComponent(originalUrl)}`;
      altUrls.push(corsProxyUrl);
    }
  } catch (error) {
    console.warn(`Error generating alternative URLs for ${originalUrl}:`, error);
  }
  
  return altUrls;
}

/**
 * Test browser audio format support
 * @returns {Object} - Object with format keys and boolean values indicating support
 */
function detectBrowserSupportedFormats() {
  const audio = document.createElement('audio');
  const supportMap = {};
  
  for (const [format, mimeType] of Object.entries(SUPPORTED_AUDIO_TYPES)) {
    supportMap[format] = audio.canPlayType(mimeType) !== '';
  }
  
  return supportMap;
}

// Cache browser format support
const browserSupportedFormats = detectBrowserSupportedFormats();

/**
 * Play audio with enhanced fallbacks for format, URL issues, and autoplay restrictions
 * @param {HTMLAudioElement} audio - The audio element to play
 * @param {string} src - The source URL to play
 * @param {function} onSuccess - Callback when playback succeeds
 * @param {function} onError - Callback when all playback attempts fail
 */
export async function playWithFallbacks(audio, src, onSuccess, onError) {
  if (!audio || !src) {
    console.error("Invalid audio element or source");
    if (onError) onError(new Error("Invalid audio element or source"));
    return;
  }
  
  // Normalize the source URL
  let audioUrl = src;
  try {
    // If audioUrl looks like a JSON string, try to extract the preview URL
    if (typeof audioUrl === 'string' && audioUrl.trim().startsWith('{') && audioUrl.trim().endsWith('}')) {
      try {
        const parsedSongData = JSON.parse(audioUrl);
        if (parsedSongData && parsedSongData.preview) {
          audioUrl = parsedSongData.preview;
          console.log("Extracted preview URL from JSON:", audioUrl);
        }
      } catch (e) {
        console.warn("Failed to parse source as JSON:", e);
      }
    }
    
    // Normalize the URL
    const url = new URL(audioUrl, window.location.href);
    audioUrl = url.href;
  } catch (urlError) {
    console.error("Invalid audio URL format:", urlError);
    if (onError) onError(new Error(`Invalid URL format: ${urlError.message}`));
    return;
  }
  
  // Detect the audio format from the URL
  const detectedFormat = detectFormatFromUrl(audioUrl);
  
  // Check if the detected format is supported by the browser
  if (detectedFormat && !browserSupportedFormats[detectedFormat]) {
    console.warn(`Browser doesn't support detected format ${detectedFormat}, will try fallbacks`);
  }
  
  // Generate a list of URLs to try (original + alternatives)
  const urlsToTry = [audioUrl, ...generateAltUrls(audioUrl)];
  let successfulPlayback = false;
  let lastError = null;
  
  // Try each URL in sequence
  for (const url of urlsToTry) {
    if (successfulPlayback) break;
    
    // Validate URL before attempting to play
    console.log(`Validating URL: ${url}`);
    const isValid = await isUrlValid(url);
    
    if (!isValid) {
      console.warn(`URL ${url} is not valid or accessible, trying next alternative`);
      continue;
    }
    
    console.log(`Attempting playback with URL: ${url}`);
    
    // Make sure the source is set
    audio.src = url;
    try {
      audio.load();
    } catch (e) {
      console.warn("Error pre-loading audio:", e);
      continue; // Try next URL
    }
    
    // Direct attempt to play
    try {
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        try {
          await playPromise;
          // Success! Audio is playing
          console.log("Audio playback started successfully with", url);
          successfulPlayback = true;
          if (onSuccess) onSuccess();
          break; // Exit the loop as we succeeded
        } catch (error) {
          lastError = error;
          
          // Most likely autoplay was blocked
          if (error.name === 'NotAllowedError') {
            console.log("Autoplay blocked, showing user interaction notification");
            // Mark that we need user interaction
            document.documentElement.setAttribute('data-needs-interaction', 'true');
            
            // Set up a click handler to try again after user interaction
            try {
              await new Promise((resolve, reject) => {
                const unlockAudio = async () => {
                  document.documentElement.setAttribute('data-user-interacted', 'true');
                  document.documentElement.removeAttribute('data-needs-interaction');
                  
                  console.log("User interaction detected, retrying playback");
                  try {
                    await audio.play();
                    console.log("Playback successful after user interaction");
                    successfulPlayback = true;
                    resolve();
                  } catch (err) {
                    console.error("Playback failed after user interaction:", err);
                    // One last attempt with a fresh load
                    try {
                      audio.load();
                      await audio.play();
                      console.log("Final attempt successful");
                      successfulPlayback = true;
                      resolve();
                    } catch (finalErr) {
                      console.error("All playback attempts failed for this URL:", finalErr);
                      reject(finalErr);
                    }
                  }
                };
                
                // Add both click and touch events for better mobile support
                document.addEventListener('click', unlockAudio, { once: true });
                document.addEventListener('touchstart', unlockAudio, { once: true });
                
                // Add a timeout in case user never interacts
                setTimeout(() => {
                  reject(new Error("User interaction timeout"));
                }, 60000); // 1 minute timeout
              });
              
              if (successfulPlayback) {
                if (onSuccess) onSuccess();
                break; // Exit the loop as we succeeded
              }
            } catch (interactionError) {
              console.warn("User interaction handling failed:", interactionError);
              // Continue to next URL
            }
          } else if (error.name === 'NotSupportedError') {
            // Format or source not supported
            console.warn(`Format not supported for ${url}, trying alternatives`);
            // Continue to next URL
          } else {
            // Some other error occurred
            console.error("Error playing audio:", error);
            // Continue to next URL
          }
        }
      } else {
        // Browser doesn't return a promise - we're in older browser territory
        // Check if audio is actually playing
        if (audio.paused) {
          console.warn("Audio is still paused after play() call (older browser)");
          document.documentElement.setAttribute('data-needs-interaction', 'true');
          
          try {
            await new Promise((resolve, reject) => {
              // Set up a one-time interaction handler
              const handleOldBrowserInteraction = () => {
                document.documentElement.setAttribute('data-user-interacted', 'true');
                document.documentElement.removeAttribute('data-needs-interaction');
                
                try {
                  audio.play();
                  setTimeout(() => {
                    if (!audio.paused) {
                      console.log("Playback successful in older browser");
                      successfulPlayback = true;
                      resolve();
                    } else {
                      console.error("Playback failed in older browser");
                      reject(new Error("Playback failed in older browser"));
                    }
                  }, 100);
                } catch (e) {
                  console.error("Error in older browser playback:", e);
                  reject(e);
                }
              };
              
              document.addEventListener('click', handleOldBrowserInteraction, { once: true });
              document.addEventListener('touchstart', handleOldBrowserInteraction, { once: true });
              
              // Add a timeout in case user never interacts
              setTimeout(() => {
                reject(new Error("User interaction timeout"));
              }, 60000); // 1 minute timeout
            });
            
            if (successfulPlayback) {
              if (onSuccess) onSuccess();
              break; // Exit the loop as we succeeded
            }
          } catch (interactionError) {
            console.warn("User interaction handling failed in older browser:", interactionError);
            // Continue to next URL
          }
        } else {
          console.log("Audio is playing (older browser)");
          successfulPlayback = true;
          if (onSuccess) onSuccess();
          break; // Exit the loop as we succeeded
        }
      }
    } catch (mainError) {
      console.error(`Unexpected error playing ${url}:`, mainError);
      lastError = mainError;
      // Continue to next URL
    }
  }
  
  // If we tried all URLs and none worked
  if (!successfulPlayback) {
    console.error("All playback attempts failed after trying multiple sources");
    
    // Try one last approach - create a completely new audio element
    try {
      const newAudio = new Audio();
      newAudio.src = audioUrl;
      newAudio.volume = audio.volume;
      newAudio.load();
      
      const finalPlayPromise = newAudio.play();
      if (finalPlayPromise !== undefined) {
        finalPlayPromise.then(() => {
          console.log("Last resort playback successful with new audio element");
          
          // Copy properties from new element to original
          audio.src = newAudio.src;
          
          // Stop the new element once original is ready
          setTimeout(() => {
            newAudio.pause();
            newAudio.src = '';
          }, 500);
          
          if (onSuccess) onSuccess();
        }).catch(finalError => {
          console.error("Final playback attempt failed:", finalError);
          if (onError) onError(lastError || finalError);
        });
      }
    } catch (finalError) {
      console.error("Final attempt with new audio element failed:", finalError);
      if (onError) onError(lastError || finalError);
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