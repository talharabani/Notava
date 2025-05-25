/**
 * DOM Helper Utility
 * 
 * This file contains utility functions for safely manipulating the DOM,
 * handling element references, and managing common operations that might fail.
 */

/**
 * Safely remove an element from the DOM
 * @param {HTMLElement} element - Element to remove
 * @returns {boolean} - Whether removal was successful
 */
export function safeRemove(element) {
  if (!element) return false;
  
  try {
    if (element.parentNode) {
      element.parentNode.removeChild(element);
      return true;
    } else if (element.isConnected) {
      element.remove();
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error removing element:", error);
    return false;
  }
}

/**
 * Safely add an element to a parent
 * @param {HTMLElement} parent - Parent element
 * @param {HTMLElement} child - Child element to add
 * @returns {boolean} - Whether addition was successful
 */
export function safeAppend(parent, child) {
  if (!parent || !child) return false;
  
  try {
    // If child is already in the DOM elsewhere, remove it first
    if (child.parentNode && child.parentNode !== parent) {
      child.parentNode.removeChild(child);
    }
    
    parent.appendChild(child);
    return true;
  } catch (error) {
    console.error("Error appending element:", error);
    return false;
  }
}

/**
 * Safely move an element to the document body
 * @param {HTMLElement} element - Element to move
 * @returns {HTMLElement|null} - The moved element or null if failed
 */
export function moveToBody(element) {
  if (!element) return null;
  
  try {
    // First remove from current parent if needed
    if (element.parentNode && element.parentNode !== document.body) {
      element.parentNode.removeChild(element);
    }
    
    // Then add to body
    document.body.appendChild(element);
    return element;
  } catch (error) {
    console.error("Error moving element to body:", error);
    return null;
  }
}

/**
 * Set element position and z-index for overlays/dropdowns
 * @param {HTMLElement} element - Element to position
 * @param {Object} options - Positioning options
 * @returns {HTMLElement|null} - The positioned element or null if failed
 */
export function positionElement(element, options = {}) {
  if (!element) return null;
  
  try {
    const {
      reference,      // Reference element to position relative to
      placement = 'bottom', // top, right, bottom, left
      offsetX = 0,    // Horizontal offset
      offsetY = 0,    // Vertical offset
      zIndex = 9999,  // z-index value
      fixed = false,  // Use fixed instead of absolute positioning
      width           // Optional width to set
    } = options;
    
    // Set position style
    element.style.position = fixed ? 'fixed' : 'absolute';
    element.style.zIndex = zIndex;
    
    // Set width if provided
    if (width) {
      element.style.width = typeof width === 'number' ? `${width}px` : width;
    }
    
    // If no reference element, just set the offsets and return
    if (!reference) {
      element.style.top = `${offsetY}px`;
      element.style.left = `${offsetX}px`;
      return element;
    }
    
    // Get reference element position
    const refRect = reference.getBoundingClientRect();
    
    // Calculate position based on placement
    switch (placement) {
      case 'top':
        element.style.bottom = fixed
          ? `${window.innerHeight - refRect.top + offsetY}px`
          : `${document.body.scrollHeight - refRect.top + offsetY}px`;
        element.style.left = `${refRect.left + offsetX}px`;
        break;
      case 'right':
        element.style.top = `${refRect.top + offsetY}px`;
        element.style.left = `${refRect.right + offsetX}px`;
        break;
      case 'bottom':
      default:
        element.style.top = fixed
          ? `${refRect.bottom + offsetY}px`
          : `${refRect.bottom + window.scrollY + offsetY}px`;
        element.style.left = `${refRect.left + offsetX}px`;
        break;
      case 'left':
        element.style.top = `${refRect.top + offsetY}px`;
        element.style.right = fixed
          ? `${window.innerWidth - refRect.left + offsetX}px`
          : `${document.body.scrollWidth - refRect.left + offsetX}px`;
        break;
    }
    
    // Ensure element stays within viewport
    const elementRect = element.getBoundingClientRect();
    
    // Adjust if off-screen to the right
    if (elementRect.right > window.innerWidth) {
      element.style.left = fixed
        ? `${window.innerWidth - elementRect.width - 10}px`
        : `${document.body.scrollWidth - elementRect.width - 10}px`;
    }
    
    // Adjust if off-screen to the bottom
    if (elementRect.bottom > window.innerHeight) {
      // Try positioning above the reference element instead
      if (placement === 'bottom') {
        element.style.top = fixed
          ? `${refRect.top - elementRect.height - offsetY}px`
          : `${refRect.top - elementRect.height + window.scrollY - offsetY}px`;
      } else {
        // Just make sure it doesn't go below the viewport
        element.style.maxHeight = `${window.innerHeight - elementRect.top - 20}px`;
      }
    }
    
    return element;
  } catch (error) {
    console.error("Error positioning element:", error);
    return null;
  }
}

/**
 * Create an event listener that automatically cleans up on element removal
 * @param {HTMLElement} element - Element to attach listener to
 * @param {string} eventType - Event type (e.g., 'click')
 * @param {Function} handler - Event handler function
 * @param {Object} options - Event listener options
 * @returns {Function} - Function to manually remove the listener
 */
export function addAutoCleaningEventListener(element, eventType, handler, options = {}) {
  if (!element || !eventType || !handler) {
    return () => {};
  }
  
  try {
    // Add the event listener
    element.addEventListener(eventType, handler, options);
    
    // Set up a MutationObserver to watch for the element being removed
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const nodes = Array.from(mutation.removedNodes);
        // Check if the element or any of its parents were removed
        const wasRemoved = nodes.some(node => 
          node === element || (node.contains && node.contains(element))
        );
        
        if (wasRemoved) {
          // Clean up the event listener
          element.removeEventListener(eventType, handler, options);
          observer.disconnect();
          break;
        }
      }
    });
    
    // Start observing the document body
    observer.observe(document.body, { 
      childList: true,
      subtree: true
    });
    
    // Return a function to manually remove the listener and disconnect the observer
    return () => {
      element.removeEventListener(eventType, handler, options);
      observer.disconnect();
    };
  } catch (error) {
    console.error("Error setting up auto-cleaning event listener:", error);
    return () => {};
  }
}

/**
 * Create a document click handler that ignores clicks on specified elements
 * @param {Function} handler - Click handler function
 * @param {HTMLElement[]} ignoreElements - Elements to ignore clicks on
 * @returns {Function} - Function to remove the click handler
 */
export function addClickAwayListener(handler, ignoreElements = []) {
  if (!handler) return () => {};
  
  try {
    const clickHandler = (event) => {
      // Check if click was on any of the ignored elements
      const wasIgnored = ignoreElements.some(element => 
        element && (element === event.target || element.contains(event.target))
      );
      
      if (!wasIgnored) {
        handler(event);
      }
    };
    
    // Add the click handler
    document.addEventListener('click', clickHandler);
    
    // Return function to remove the handler
    return () => {
      document.removeEventListener('click', clickHandler);
    };
  } catch (error) {
    console.error("Error setting up click away listener:", error);
    return () => {};
  }
}

/**
 * Check if an element is visible in the viewport
 * @param {HTMLElement} element - Element to check
 * @param {Object} options - Options for the check
 * @returns {boolean} - Whether the element is visible
 */
export function isVisibleInViewport(element, options = {}) {
  if (!element) return false;
  
  try {
    const { 
      fully = false, // Whether element must be fully in viewport
      offset = 0    // Offset from viewport edges
    } = options;
    
    const rect = element.getBoundingClientRect();
    
    if (fully) {
      return (
        rect.top >= offset &&
        rect.left >= offset &&
        rect.bottom <= window.innerHeight - offset &&
        rect.right <= window.innerWidth - offset
      );
    } else {
      return (
        rect.top <= window.innerHeight - offset &&
        rect.bottom >= offset &&
        rect.left <= window.innerWidth - offset &&
        rect.right >= offset
      );
    }
  } catch (error) {
    console.error("Error checking viewport visibility:", error);
    return false;
  }
}

/**
 * Set multiple CSS properties on an element at once
 * @param {HTMLElement} element - Element to style
 * @param {Object} styles - Object with style properties
 * @returns {HTMLElement|null} - The styled element or null if failed
 */
export function setStyles(element, styles = {}) {
  if (!element || !styles) return null;
  
  try {
    Object.entries(styles).forEach(([property, value]) => {
      element.style[property] = value;
    });
    return element;
  } catch (error) {
    console.error("Error setting styles:", error);
    return null;
  }
}

/**
 * Create an element with attributes and styles
 * @param {string} tagName - Element tag name
 * @param {Object} options - Element options
 * @returns {HTMLElement|null} - The created element or null if failed
 */
export function createElement(tagName, options = {}) {
  if (!tagName) return null;
  
  try {
    const {
      id,
      className,
      styles = {},
      attributes = {},
      innerHTML,
      textContent,
      parent
    } = options;
    
    const element = document.createElement(tagName);
    
    // Set ID if provided
    if (id) element.id = id;
    
    // Set class if provided
    if (className) element.className = className;
    
    // Set styles if provided
    setStyles(element, styles);
    
    // Set attributes if provided
    Object.entries(attributes).forEach(([name, value]) => {
      element.setAttribute(name, value);
    });
    
    // Set inner HTML if provided
    if (innerHTML !== undefined) element.innerHTML = innerHTML;
    
    // Set text content if provided
    if (textContent !== undefined) element.textContent = textContent;
    
    // Append to parent if provided
    if (parent) safeAppend(parent, element);
    
    return element;
  } catch (error) {
    console.error("Error creating element:", error);
    return null;
  }
}

/**
 * Global helper to manage z-index stacking
 */
export const ZIndexManager = {
  baseValues: {
    content: 1,
    navigation: 100,
    dropdown: 1000,
    modal: 2000,
    overlay: 3000,
    tooltip: 4000,
    notification: 5000
  },
  
  // Get z-index for a component type
  getZIndex(type) {
    return this.baseValues[type] || this.baseValues.content;
  },
  
  // Get a z-index that's guaranteed to be on top
  getTopZIndex() {
    // Find the highest z-index in the document
    const elements = document.querySelectorAll('*');
    let max = 0;
    
    for (const element of elements) {
      const zIndex = parseInt(window.getComputedStyle(element).zIndex, 10);
      if (!isNaN(zIndex) && zIndex > max) {
        max = zIndex;
      }
    }
    
    return Math.max(max + 10, this.baseValues.notification);
  }
}; 