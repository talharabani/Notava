import { Controller } from "@hotwired/stimulus"

// This controller ensures that song elements are properly connected to the player controller
export default class extends Controller {
  static values = {
    song: Object
  }

  connect() {
    console.log("Song element controller connected");
    
    // Add click event listener to play the song
    this.element.addEventListener('click', this.playSong.bind(this));
  }
  
  disconnect() {
    // Remove event listener when disconnected
    this.element.removeEventListener('click', this.playSong.bind(this));
  }
  
  playSong(event) {
    // Prevent default action if this is a link or button
    event.preventDefault();
    
    console.log("Song element clicked, attempting to play song");
    
    // Get the player controller
    const playerBar = document.getElementById('player-bar');
    if (!playerBar) {
      console.error("Player bar element not found");
      return;
    }
    
    // Try to get the player controller from the window object first
    let playerController = window.playerController;
    
    // If not available, try to get it from Stimulus
    if (!playerController) {
      const application = window.Stimulus;
      if (application) {
        playerController = application.getControllerForElementAndIdentifier(playerBar, 'player');
        if (playerController) {
          // Store it globally for future use
          window.playerController = playerController;
        }
      }
    }
    
    if (!playerController) {
      console.error("Player controller not found");
      return;
    }
    
    // Get the song data from the element
    const songData = this.element.dataset.song || JSON.stringify(this.songValue);
    
    if (!songData) {
      console.error("No song data found");
      return;
    }
    
    // Create a synthetic event to send to the player controller
    const customEvent = new CustomEvent('click', {
      bubbles: true,
      cancelable: true
    });
    
    // Add the dataset property to the event
    Object.defineProperty(customEvent, 'currentTarget', {
      value: {
        dataset: {
          song: songData,
          addToQueue: event.shiftKey.toString() // Add to queue if shift key is pressed
        }
      },
      writable: false
    });
    
    // Call the playSong method on the player controller
    playerController.playSong(customEvent);
  }
} 