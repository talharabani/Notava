module ApplicationHelper
  # Determine if the current page is an inside view (not home, login, etc)
  def inside_view?
    # List all controller/action combinations that are NOT inside views
    excluded_routes = [
      { controller: 'home', action: 'index' },
      { controller: 'devise/sessions', action: 'new' },
      { controller: 'devise/registrations', action: 'new' },
      { controller: 'devise/passwords', action: 'new' },
      { controller: 'devise/passwords', action: 'edit' }
    ]
    
    !excluded_routes.any? do |route|
      controller.controller_name == route[:controller].to_s &&
      controller.action_name == route[:action].to_s
    end
  end
  
  # Get container class for the current view
  def container_class
    if inside_view?
      "inside-view-container"
    else
      "main-container"
    end
  end
  
  # Get background class for current view
  def background_class
    if inside_view?
      "bg-gradient-to-b from-primary-bg to-secondary-bg"
    else
      ""
    end
  end
  
  # Generate appropriate player class
  def player_class
    "player-container fixed bottom-0 left-0 right-0 bg-card-bg border-t border-border-color"
  end
  
  # Get appropriate class for search dropdown
  def search_dropdown_class
    "search-dropdown absolute z-[9999] bg-card-bg border border-border-color rounded-lg shadow-lg"
  end
  
  # Format duration in seconds to MM:SS
  def format_duration(seconds)
    return "0:00" unless seconds.is_a?(Numeric) && seconds > 0
    
    minutes = (seconds / 60).floor
    remaining_seconds = (seconds % 60).floor
    
    "#{minutes}:#{remaining_seconds.to_s.rjust(2, '0')}"
  end
  
  # Check if a song is currently playing
  def song_playing?(song, current_song)
    return false unless song.present? && current_song.present?
    
    song.id.to_s == current_song.id.to_s
  end
  
  # Generate consistent card styling
  def card_class
    "bg-card-bg rounded-lg p-4 hover:bg-opacity-80 transition duration-200"
  end
  
  # Create a consistent badge style
  def badge_class(type = :default)
    base_class = "px-2 py-1 rounded-full text-xs font-medium"
    
    case type
    when :success
      "#{base_class} bg-accent-color text-white"
    when :warning
      "#{base_class} bg-yellow-500 text-black"
    when :error
      "#{base_class} bg-red-500 text-white"
    else
      "#{base_class} bg-gray-700 text-white"
    end
  end
  
  # Generate consistent button styling
  def button_class(type = :primary, size = :md)
    base_class = "rounded font-medium transition duration-200"
    
    size_class = case size
    when :sm
      "px-3 py-1 text-sm"
    when :lg
      "px-6 py-3 text-lg"
    else
      "px-4 py-2" # Medium (default)
    end
    
    type_class = case type
    when :primary
      "bg-accent-color hover:bg-accent-hover text-white"
    when :secondary
      "bg-gray-700 hover:bg-gray-600 text-white"
    when :outline
      "bg-transparent border border-accent-color text-accent-color hover:bg-accent-color hover:text-white"
    when :text
      "bg-transparent text-text-color hover:text-accent-color"
    else
      "bg-accent-color hover:bg-accent-hover text-white" # Default to primary
    end
    
    "#{base_class} #{size_class} #{type_class}"
  end
end
