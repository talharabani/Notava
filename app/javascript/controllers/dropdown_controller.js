import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["menu"]

  connect() {
    console.log("Dropdown controller connected");
    document.addEventListener('click', this.outsideClick.bind(this));
  }

  disconnect() {
    document.removeEventListener('click', this.outsideClick.bind(this));
  }

  outsideClick(event) {
    if (!this.element.contains(event.target) && !this.menuTarget.classList.contains('hidden')) {
      this.hide();
    }
  }

  toggle() {
    if (this.menuTarget.classList.contains('hidden')) {
      this.show();
    } else {
      this.hide();
    }
  }

  show() {
    this.menuTarget.classList.remove('hidden');
  }

  hide() {
    this.menuTarget.classList.add('hidden');
  }
} 