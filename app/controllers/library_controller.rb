class LibraryController < ApplicationController
  before_action :authenticate_user!
  
  def songs
    deezer_service = DeezerService.new
    
    begin
      # In a real app, this would fetch the user's library from the database
      # For now, we'll create a simulated library with some chart tracks
      @library_tracks = deezer_service.get_chart(30)
      
      # Get the user's playlists
      @user_playlists = current_user.playlists
      
      # Create some mock playlists if user has none
      if @user_playlists.empty? && !current_user.playlists.create(name: "My First Playlist", description: "Songs I love").persisted?
        # Creation failed, continue without mock data
        Rails.logger.error("Failed to create initial playlist for user")
      end
    rescue => e
      Rails.logger.error("Error fetching library songs: #{e.message}")
      @library_tracks = { 'data' => [] }
      @user_playlists = []
    end
  end
  
  def albums
    deezer_service = DeezerService.new
    
    begin
      # In a real app, this would fetch the user's saved albums from the database
      # For now, we'll create a simulated library with popular albums
      @library_albums = deezer_service.get_popular_albums(24)
    rescue => e
      Rails.logger.error("Error fetching library albums: #{e.message}")
      @library_albums = { 'data' => [] }
    end
  end
  
  def artists
    deezer_service = DeezerService.new
    
    begin
      # In a real app, this would fetch the user's followed artists from the database
      # For now, we'll extract artists from popular tracks
      @popular_tracks = deezer_service.get_chart(50)
      @library_artists = []
      
      if @popular_tracks['data'] && @popular_tracks['data'].is_a?(Array)
        # Extract unique artists from the tracks
        artist_ids = @popular_tracks['data'].map { |track| track['artist']['id'] }.uniq.first(20)
        
        # Fetch detailed artist data
        @library_artists = artist_ids.map do |id| 
          artist_data = deezer_service.get_artist(id)
          # Fetch top tracks for this artist
          top_tracks = deezer_service.get_artist_top_tracks(id, 5)
          artist_data['top_tracks'] = top_tracks['data'] if top_tracks['data']
          artist_data
        end
      end
    rescue => e
      Rails.logger.error("Error fetching library artists: #{e.message}")
      @library_artists = []
    end
  end
  
  def history
    deezer_service = DeezerService.new
    
    begin
      # In a real app, this would fetch the user's play history from the database
      # For now, we'll create a simulated history with some tracks
      
      # Get tracks for "Recently Played"
      @recently_played = deezer_service.get_chart(10)
      
      # Get tracks for "Most Played"
      @most_played = deezer_service.get_trending_tracks(10)
      
      # Create a timeline of listening activity (last 7 days)
      @listening_days = []
      7.downto(0) do |days_ago|
        date = Date.today - days_ago.days
        @listening_days << {
          'date' => date,
          'formatted_date' => date.strftime('%a, %b %d'),
          'track_count' => rand(5..25),
          'tracks' => deezer_service.get_chart(5)['data'] || []
        }
      end
    rescue => e
      Rails.logger.error("Error fetching history: #{e.message}")
      @recently_played = { 'data' => [] }
      @most_played = { 'data' => [] }
      @listening_days = []
    end
  end
end 