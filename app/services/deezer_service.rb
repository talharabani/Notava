class DeezerService
  include HTTParty
  base_uri 'https://api.deezer.com'
  format :json

  def initialize
    # Initialize with any configuration if needed
  end

  def search_tracks(query, limit = 10)
    return { data: [] } if query.blank?
    
    puts "DeezerService: Searching for '#{query}' with limit #{limit}"
    response = self.class.get("/search", query: { q: query, limit: limit })
    puts "DeezerService: Response status: #{response.code}"
    puts "DeezerService: Response body: #{response.body[0..300]}..." # Show first 300 chars of response
    
    result = parse_response(response)
    
    if result['data']
      puts "DeezerService: Found #{result['data'].length} results"
    else
      puts "DeezerService: No data in response"
    end
    
    result
  end

  def get_chart(limit = 10)
    response = self.class.get("/chart/0/tracks", query: { limit: limit })
    parse_response(response)
  end

  def get_album(album_id)
    response = self.class.get("/album/#{album_id}")
    parse_response(response)
  end

  def get_artist(artist_id)
    response = self.class.get("/artist/#{artist_id}")
    parse_response(response)
  end

  def get_artist_top_tracks(artist_id, limit = 10)
    response = self.class.get("/artist/#{artist_id}/top", query: { limit: limit })
    parse_response(response)
  end

  def get_playlist(playlist_id)
    response = self.class.get("/playlist/#{playlist_id}")
    parse_response(response)
  end

  def get_genre_artists(genre_id, limit = 10)
    response = self.class.get("/genre/#{genre_id}/artists", query: { limit: limit })
    parse_response(response)
  end

  def get_genres
    response = self.class.get("/genre")
    parse_response(response)
  end

  def get_new_releases(limit = 10)
    response = self.class.get("/chart/0/albums", query: { limit: limit })
    
    # Enhance album data with track information
    result = parse_response(response)
    
    if result['data'] && result['data'].is_a?(Array)
      result['data'].each do |album|
        album_details = get_album(album['id'])
        album['tracks'] = album_details['tracks'] if album_details['tracks']
      end
    end
    
    result
  end
  
  def get_new_friday_tracks(limit = 10)
    # Get the latest releases and extract their tracks
    albums_response = self.class.get("/chart/0/albums", query: { limit: 5 })
    albums_result = parse_response(albums_response)
    
    tracks = []
    
    if albums_result['data'] && albums_result['data'].is_a?(Array)
      albums_result['data'].each do |album|
        album_details = get_album(album['id'])
        if album_details['tracks'] && album_details['tracks']['data']
          # Get up to 2 tracks from each album to reach our limit
          album_tracks = album_details['tracks']['data'].first(2)
          album_tracks.each do |track|
            # Add album cover to each track
            track['album'] ||= {}
            track['album']['cover_medium'] = album['cover_medium']
            track['album']['title'] = album['title']
            tracks << track
          end
        end
      end
    end
    
    # Return in the same format as other methods
    { 'data' => tracks.first(limit) }
  end
  
  def get_trending_tracks(limit = 10)
    # Trending tracks are essentially chart tracks
    response = self.class.get("/chart/0/tracks", query: { limit: limit })
    parse_response(response)
  end
  
  def get_popular_albums(limit = 10)
    # Popular albums from the chart
    response = self.class.get("/chart/0/albums", query: { limit: limit, index: 10 })
    
    # Enhance album data with track information
    result = parse_response(response)
    
    if result['data'] && result['data'].is_a?(Array)
      result['data'].each do |album|
        album_details = get_album(album['id'])
        album['tracks'] = album_details['tracks'] if album_details['tracks']
      end
    end
    
    result
  end

  private

  def parse_response(response)
    if response.success?
      begin
        result = JSON.parse(response.body)
        if result.is_a?(Hash) && result['error']
          puts "DeezerService: Error in response: #{result['error']}"
        end
        result
      rescue JSON::ParserError => e
        puts "DeezerService: JSON parse error: #{e.message}"
        { error: "Invalid response from Deezer API", data: [] }
      end
    else
      puts "DeezerService: HTTP error: #{response.code}"
      { error: "API request failed with status #{response.code}", data: [] }
    end
  rescue StandardError => e
    puts "DeezerService: Exception: #{e.message}"
    { error: "Error: #{e.message}", data: [] }
  end
end 