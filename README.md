# Notava Music Streaming App

Made with ❤️ by Team Habibis

A modern web application for streaming music, built with Ruby on Rails and JavaScript.

## Recent Fixes & Improvements

### Audio Playback

1. **Fixed Audio Proxy Controller**
   - Replaced `open-uri` with more robust `Net::HTTP` for better streaming support
   - Added proper byte range request handling for seeking in audio tracks
   - Implemented detailed error handling with clear error messages
   - Enhanced CORS header support for cross-origin playback
   - Added support for a wider range of audio CDN domains

2. **Enhanced Player Controller**
   - Improved `handleAudioError` to better handle proxy-specific errors
   - Added automatic fallback mechanisms between proxy and direct URLs
   - Implemented intelligent format detection for unsupported audio formats
   - Created a more robust playlist navigation system (previous/next)
   - Added automatic playlist continuation when reaching the end

3. **Added DOM Safety Features**
   - Created DOM helper utilities to prevent race conditions and errors
   - Implemented safer DOM manipulation with error handling
   - Added auto-cleaning event listeners that remove themselves when elements are removed

### UI Improvements

1. **Fixed Z-Index Issues**
   - Created a dedicated CSS file for z-index management
   - Implemented a layering system with consistent z-index values
   - Fixed dropdown menus appearing behind other elements
   - Ensured search results appear on top of all other content

2. **Styling Consistency**
   - Added CSS variables for consistent colors and styles
   - Created helper methods for common UI components
   - Improved gradient backgrounds for all views
   - Enhanced card styling with proper hover states

3. **Added Testing Tools**
   - Created a comprehensive test page for audio proxy functionality
   - Added detailed logging for troubleshooting playback issues

## Core Features

- Browse and search for music
- Create and manage playlists
- Play music with a full-featured player
- View artist and album details
- Discover new music with recommendations

## Technical Details

### Audio Streaming Architecture

The application uses a multi-layered approach to ensure reliable audio playback:

1. First attempts direct playback from the source CDN
2. Falls back to server-side proxy for CORS issues
3. Tries alternative formats and CDN domains if initial playback fails
4. Handles browser autoplay restrictions gracefully

### DOM Management

To prevent errors and ensure consistent behavior across browsers, we've implemented:

- Safe DOM manipulation utilities
- Z-index management system
- Automatic event listener cleanup
- Proper handling of overlays and dropdowns

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Mobile Support

- iOS Safari
- Android Chrome
- Responsive design for all screen sizes