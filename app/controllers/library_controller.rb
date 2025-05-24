class LibraryController < ApplicationController
  before_action :authenticate_user!
  
  def songs
    deezer_service = DeezerService.new
    
    begin
      # In a real app, this would fetch the user's library from the database
      # For now, we'll create a simulated library with some chart tracks
      @library_tracks = deezer_service.get_chart(30)
      
      # Create some mock playlists
      @playlists = [
        {
          'id' => 1,
          'title' => 'My Favorites',
          'nb_tracks' => 12,
          'picture_medium' => 'https://e-cdns-images.dzcdn.net/images/cover/1cac28532dc6d689f0ccba5a3b71b9d0/500x500-000000-80-0-0.jpg',
          'tracks' => deezer_service.get_chart(12)['data'] || []
        },
        {
          'id' => 2,
          'title' => 'Workout Mix',
          'nb_tracks' => 8,
          'picture_medium' => 'https://e-cdns-images.dzcdn.net/images/cover/7f962f63ec89d0348958782bdb2c7b2a/500x500-000000-80-0-0.jpg',
          'tracks' => deezer_service.get_chart(8)['data'] || []
        },
        {
          'id' => 3,
          'title' => 'Chill Vibes',
          'nb_tracks' => 10,
          'picture_medium' => 'https://e-cdns-images.dzcdn.net/images/cover/5baddb938d5ecd8f0249546ede7505d6/500x500-000000-80-0-0.jpg',
          'tracks' => deezer_service.get_chart(10)['data'] || []
        }
      ]
    rescue => e
      Rails.logger.error("Error fetching library songs: #{e.message}")
      @library_tracks = { 'data' => [] }
      @playlists = []
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