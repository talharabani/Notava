class BrowseController < ApplicationController
  def discover
    deezer_service = DeezerService.new
    
    begin
      @trending_tracks = deezer_service.get_trending_tracks(10)
      @popular_albums = deezer_service.get_popular_albums(5)
      @new_releases = deezer_service.get_new_friday_tracks(5)
      @genres = deezer_service.get_genres
      
      # Get some recommended playlists (we'll simulate with chart data)
      @playlists = deezer_service.get_chart(5)
    rescue => e
      Rails.logger.error("Error fetching discover data: #{e.message}")
      @trending_tracks = { 'data' => [] }
      @popular_albums = { 'data' => [] }
      @new_releases = { 'data' => [] }
      @genres = { 'data' => [] }
      @playlists = { 'data' => [] }
    end
  end

  def new_releases
    deezer_service = DeezerService.new
    
    begin
      # Get new album releases
      @new_albums = deezer_service.get_new_releases(20)
      
      # Get new tracks from these albums
      @new_tracks = deezer_service.get_new_friday_tracks(20)
    rescue => e
      Rails.logger.error("Error fetching new releases: #{e.message}")
      @new_albums = { 'data' => [] }
      @new_tracks = { 'data' => [] }
    end
  end

  def popular
    deezer_service = DeezerService.new
    
    begin
      @popular_tracks = deezer_service.get_chart(20)
      @popular_albums = deezer_service.get_popular_albums(10)
      
      # Get some popular artists (we'll use data from popular tracks)
      @popular_artists = []
      
      if @popular_tracks['data'] && @popular_tracks['data'].is_a?(Array)
        artist_ids = @popular_tracks['data'].map { |track| track['artist']['id'] }.uniq.first(5)
        @popular_artists = artist_ids.map { |id| deezer_service.get_artist(id) }
      end
    rescue => e
      Rails.logger.error("Error fetching popular content: #{e.message}")
      @popular_tracks = { 'data' => [] }
      @popular_albums = { 'data' => [] }
      @popular_artists = []
    end
  end

  def charts
    deezer_service = DeezerService.new
    
    begin
      @chart_tracks = deezer_service.get_chart(30)
      @chart_albums = deezer_service.get_popular_albums(10)
    rescue => e
      Rails.logger.error("Error fetching charts: #{e.message}")
      @chart_tracks = { 'data' => [] }
      @chart_albums = { 'data' => [] }
    end
  end

  def radio
    deezer_service = DeezerService.new
    
    begin
      # Since we don't have actual radio/podcast data in the DeezerService,
      # we'll create a simulated radio experience with genre-based selections
      @genres = deezer_service.get_genres
      
      # Create some mock radio stations using genre data
      @radio_stations = []
      
      if @genres['data'] && @genres['data'].is_a?(Array)
        @radio_stations = @genres['data'].first(6).map do |genre|
          {
            'id' => genre['id'],
            'name' => "#{genre['name']} Radio",
            'picture' => genre['picture_medium'] || '',
            'description' => "The best #{genre['name']} music, all day long.",
            'tracks' => deezer_service.get_chart(5)['data'] || []
          }
        end
      end
      
      # Create some mock podcasts
      @podcasts = [
        {
          'id' => 1,
          'name' => 'Music Evolution',
          'description' => 'Exploring the evolution of music through the decades',
          'picture' => 'https://e-cdns-images.dzcdn.net/images/cover/1cac28532dc6d689f0ccba5a3b71b9d0/500x500-000000-80-0-0.jpg',
          'author' => 'DJ Historian'
        },
        {
          'id' => 2,
          'name' => 'Behind the Lyrics',
          'description' => 'The stories behind your favorite songs',
          'picture' => 'https://e-cdns-images.dzcdn.net/images/cover/7f962f63ec89d0348958782bdb2c7b2a/500x500-000000-80-0-0.jpg',
          'author' => 'Lyric Master'
        },
        {
          'id' => 3,
          'name' => 'Studio Sessions',
          'description' => 'Inside the recording studio with top artists',
          'picture' => 'https://e-cdns-images.dzcdn.net/images/cover/5baddb938d5ecd8f0249546ede7505d6/500x500-000000-80-0-0.jpg',
          'author' => 'Producer Talk'
        }
      ]
    rescue => e
      Rails.logger.error("Error setting up radio page: #{e.message}")
      @genres = { 'data' => [] }
      @radio_stations = []
      @podcasts = []
    end
  end

  def wishlist
    # In a real app, this would fetch the user's wishlist from the database
    # For now, we'll create a simulated wishlist
    
    if user_signed_in?
      deezer_service = DeezerService.new
      
      begin
        # Get some random tracks as wishlist items
        @wishlist_tracks = deezer_service.get_chart(8)
        
        # Get some random albums as wishlist items
        @wishlist_albums = deezer_service.get_popular_albums(4)
      rescue => e
        Rails.logger.error("Error fetching wishlist content: #{e.message}")
        @wishlist_tracks = { 'data' => [] }
        @wishlist_albums = { 'data' => [] }
      end
    else
      # If user is not signed in, redirect to sign in page with a message
      redirect_to new_user_session_path, notice: "Please sign in to view your wishlist"
    end
  end
end 