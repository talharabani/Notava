class DeezerService
  include HTTParty
  base_uri 'https://api.deezer.com'
  format :json

  def initialize
    # Initialize with any configuration if needed
  end

  def search_tracks(query, limit = 10)
    return { data: [] } if query.blank?
    
    response = self.class.get("/search", query: { q: query, limit: limit })
    parse_response(response)
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
      JSON.parse(response.body)
    else
      { error: "API request failed with status #{response.code}", data: [] }
    end
  rescue JSON::ParserError
    { error: "Invalid response from Deezer API", data: [] }
  rescue StandardError => e
    { error: "Error: #{e.message}", data: [] }
  end
end 