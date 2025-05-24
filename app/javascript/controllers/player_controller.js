import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["playIcon", "pauseIcon", "progressBar", "volumeBar"]
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
    this.audio = new Audio(); // Create a new audio element instead of finding one in the DOM
    this.currentTimeElement = this.element.querySelector('.current-time');
    this.durationElement = this.element.querySelector('.duration');
    this.volumeBarElement = this.element.querySelector('.volume-bar');
    this.queue = [];
    this.currentIndex = 0;

    console.log("Audio element created");
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
      this.audio.addEventListener('timeupdate', this.updateProgress.bind(this));
      this.audio.addEventListener('ended', this.handleSongEnd.bind(this));
      this.audio.addEventListener('loadedmetadata', this.updateDuration.bind(this));
      this.audio.addEventListener('error', this.handleAudioError.bind(this));
      this.audio.addEventListener('abort', this.handleAudioAbort.bind(this));
      console.log("Audio event listeners set up");
    }

    // Store current song in localStorage if available
    if (typeof localStorage !== 'undefined') {
      const savedSong = localStorage.getItem('currentSong');
      if (savedSong) {
        try {
          const song = JSON.parse(savedSong);
          this.currentSongValue = song;
          this.queue = [song];
          this.updatePlayerUI(song);
        } catch (e) {
          console.error("Error parsing saved song:", e);
        }
      }
    }
  }

  disconnect() {
    // Clean up audio element and remove event listeners
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio.removeEventListener('timeupdate', this.updateProgress.bind(this));
      this.audio.removeEventListener('ended', this.handleSongEnd.bind(this));
      this.audio.removeEventListener('loadedmetadata', this.updateDuration.bind(this));
      this.audio.removeEventListener('error', this.handleAudioError.bind(this));
      this.audio.removeEventListener('abort', this.handleAudioAbort.bind(this));
    }
  }

  playSong(event) {
    console.log("playSong method called");
    try {
      const songData = event.currentTarget.dataset.song;
      console.log("Song data:", songData);
      
      const song = JSON.parse(songData);
      console.log("Parsed song:", song);
      
      this.currentSongValue = song;
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

    if (!this.audio) {
      console.error("Audio element not found");
      // Create a new audio element if it doesn't exist
      this.audio = new Audio();
      
      // Set up event listeners
      this.audio.addEventListener('timeupdate', this.updateProgress.bind(this));
      this.audio.addEventListener('ended', this.handleSongEnd.bind(this));
      this.audio.addEventListener('loadedmetadata', this.updateDuration.bind(this));
      this.audio.addEventListener('error', this.handleAudioError.bind(this));
      this.audio.addEventListener('abort', this.handleAudioAbort.bind(this));
    }

    // Stop any current playback and reset
    this.audio.pause();
    this.audio.currentTime = 0;
    
    // Set new source
    this.audio.src = src;
    console.log("Audio source set, attempting to play");
    
    // Check if we can autoplay (browsers often block autoplay)
    const userInteracted = document.documentElement.hasAttribute('data-user-interacted');
    console.log("User has interacted with the page:", userInteracted);
    
    // Force user interaction flag to true for testing
    document.documentElement.setAttribute('data-user-interacted', 'true');
    
    try {
      // Try to play the audio
      const playPromise = this.audio.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log("Audio playing successfully");
            this.isPlayingValue = true;
            this.updatePlayPauseIcon();
          })
          .catch(error => {
            console.error('Error playing audio:', error);
            
            if (error.name === 'NotAllowedError') {
              console.log("Autoplay prevented by browser, waiting for user interaction");
              // Mark the UI as if playing, so clicking the play/pause button will work
              this.updatePlayerUI(this.currentSongValue);
              
              // Add a one-time event listener for user interaction to try playing again
              const resumePlayback = () => {
                this.audio.play()
                  .then(() => {
                    console.log("Audio playing after user interaction");
                    this.isPlayingValue = true;
                    this.updatePlayPauseIcon();
                  })
                  .catch(err => console.error("Still can't play audio:", err));
              };
              
              // Set a flag to indicate we're waiting for user interaction
              document.documentElement.setAttribute('data-user-interacted', 'true');
              
              // Try to play when user clicks the play button
              const playButton = this.element.querySelector('[data-action="click->player#togglePlay"]');
              if (playButton) {
                playButton.addEventListener('click', resumePlayback, { once: true });
              }
              
              // Also try to play on the next user interaction with the document
              const interactionEvents = ['mousedown', 'keydown', 'touchstart'];
              const handleUserInteraction = () => {
                resumePlayback();
                interactionEvents.forEach(evt => {
                  document.removeEventListener(evt, handleUserInteraction);
                });
              };
              
              interactionEvents.forEach(evt => {
                document.addEventListener(evt, handleUserInteraction, { once: true });
              });
            } else if (error.name === 'AbortError') {
              console.log("Play request was aborted, likely due to navigation or removal");
              this.handleAudioAbort();
            } else {
              this.handleAudioError();
              
              // Try a different approach - create a new audio element
              console.log("Trying fallback approach with new audio element");
              const fallbackAudio = new Audio(src);
              fallbackAudio.volume = this.audio.volume;
              
              fallbackAudio.play()
                .then(() => {
                  console.log("Fallback audio playing successfully");
                  // Replace the main audio element
                  this.audio.pause();
                  this.audio = fallbackAudio;
                  this.isPlayingValue = true;
                  this.updatePlayPauseIcon();
                  
                  // Re-attach event listeners
                  this.audio.addEventListener('timeupdate', this.updateProgress.bind(this));
                  this.audio.addEventListener('ended', this.handleSongEnd.bind(this));
                  this.audio.addEventListener('error', this.handleAudioError.bind(this));
                })
                .catch(fallbackError => {
                  console.error("Fallback audio also failed:", fallbackError);
                });
            }
          });
      }
    } catch (error) {
      console.error("Exception while trying to play audio:", error);
      this.handleAudioError();
    }
  }

  handleAudioError() {
    console.log("handleAudioError method called");
    this.isPlayingValue = false;
    this.updatePlayPauseIcon();
    
    const songTitle = this.element.querySelector('.song-title');
    const artistName = this.element.querySelector('.artist-name');
    
    if (songTitle) songTitle.textContent = 'Error playing song';
    if (artistName) artistName.textContent = 'Please try another song';
  }

  handleAudioAbort() {
    console.log("handleAudioAbort method called - play was aborted");
    this.isPlayingValue = false;
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
    const song = this.queue[this.currentIndex];
    this.currentSongValue = song;
    
    // Save current song to localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('currentSong', JSON.stringify(song));
    }
    
    // Update player UI
    this.updatePlayerUI(song);
    
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
    
    if (this.hasVolumeBarTarget) {
      this.volumeBarTarget.style.width = `${percentage * 100}%`;
    }
    
    // Save volume preference
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('playerVolume', percentage.toString());
    }
  }

  handleSongEnd() {
    console.log("handleSongEnd method called");
    if (!this.audio) return;
    
    if (this.isRepeatingValue) {
      this.audio.currentTime = 0;
      this.audio.play();
    } else if (this.currentIndex < this.queue.length - 1) {
      this.next();
    } else {
      this.isPlayingValue = false;
      this.updatePlayPauseIcon();
    }
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
} 