import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["dropdown"]
  
  connect() {
    console.log("Volume controller connected");
    
    // Close dropdown when clicking outside
    document.addEventListener('click', this.closeDropdown.bind(this));
  }
  
  disconnect() {
    document.removeEventListener('click', this.closeDropdown.bind(this));
  }
  
  closeDropdown(event) {
    if (!this.element.contains(event.target)) {
      this.hideDropdown();
    }
  }
  
  toggleVolumeMenu(event) {
    event.stopPropagation();
    
    if (this.hasDropdownTarget) {
      if (this.dropdownTarget.classList.contains('hidden')) {
        this.showDropdown();
      } else {
        this.hideDropdown();
      }
    }
  }
  
  showDropdown() {
    // Add a special class to the body to prevent scrolling or interactions underneath
    document.body.classList.add('volume-dropdown-active');
    
    // First make sure the dropdown is visible
    this.dropdownTarget.classList.remove('hidden');
    
    // Apply additional CSS to ensure it appears above everything
    this.dropdownTarget.style.position = 'fixed';
    this.dropdownTarget.style.zIndex = '9999';
    
    // Add a subtle animation
    this.dropdownTarget.style.opacity = '0';
    this.dropdownTarget.style.transform = 'translateY(10px)';
    
    // Force a repaint to ensure the dropdown is visible
    setTimeout(() => {
      this.dropdownTarget.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      this.dropdownTarget.style.opacity = '1';
      this.dropdownTarget.style.transform = 'translateY(0)';
    }, 10);
  }
  
  hideDropdown() {
    document.body.classList.remove('volume-dropdown-active');
    
    // Add the transition for hiding
    this.dropdownTarget.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    this.dropdownTarget.style.opacity = '0';
    this.dropdownTarget.style.transform = 'translateY(10px)';
    
    // Wait for animation to complete before hiding
    setTimeout(() => {
      this.dropdownTarget.classList.add('hidden');
      
      // Reset styles
      this.dropdownTarget.style.transition = '';
      this.dropdownTarget.style.transform = '';
    }, 200);
  }
} 