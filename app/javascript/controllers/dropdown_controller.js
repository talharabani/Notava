import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["menu", "trigger", "content"]

  connect() {
    console.log("Dropdown controller connected");
    document.addEventListener('click', this.outsideClick.bind(this));
    
    // Set a reference to this controller on the element
    this.element.__dropdownController = this;
  }

  disconnect() {
    document.removeEventListener('click', this.outsideClick.bind(this));
    
    // Clean up reference
    if (this.element.__dropdownController === this) {
      delete this.element.__dropdownController;
    }
  }

  outsideClick(event) {
    if (!this.element.contains(event.target) && !this.menuTarget.classList.contains('hidden')) {
      this.hide();
    }
  }

  toggle(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (this.menuTarget.classList.contains('hidden')) {
      this.show();
    } else {
      this.hide();
    }
  }

  show() {
    this.menuTarget.classList.remove('hidden');
    
    // Position the dropdown
    this.position();
    
    // Dispatch event for other components to respond
    const showEvent = new CustomEvent('dropdown:shown', { bubbles: true });
    this.element.dispatchEvent(showEvent);
  }

  hide() {
    this.menuTarget.classList.add('hidden');
    
    // Dispatch event for other components to respond
    const hideEvent = new CustomEvent('dropdown:hidden', { bubbles: true });
    this.element.dispatchEvent(hideEvent);
  }
  
  position() {
    // Only position if we have both a trigger and content
    if (!this.hasTriggerTarget || !this.hasMenuTarget) return;
    
    const triggerRect = this.triggerTarget.getBoundingClientRect();
    const menuRect = this.menuTarget.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    // Default position is below the trigger
    let top = triggerRect.bottom;
    let left = triggerRect.left;
    
    // Check if the dropdown would go off the bottom of the screen
    if (top + menuRect.height > viewportHeight) {
      // Position above the trigger if it would go off the bottom
      top = triggerRect.top - menuRect.height;
    }
    
    // Check if the dropdown would go off the right of the screen
    if (left + menuRect.width > viewportWidth) {
      // Align the right edge of the dropdown with the right edge of the trigger
      left = triggerRect.right - menuRect.width;
    }
    
    // Ensure the dropdown doesn't go off the left of the screen
    left = Math.max(0, left);
    
    // Set the position
    this.menuTarget.style.position = 'absolute';
    this.menuTarget.style.top = `${top}px`;
    this.menuTarget.style.left = `${left}px`;
    this.menuTarget.style.zIndex = '999';
  }
} 