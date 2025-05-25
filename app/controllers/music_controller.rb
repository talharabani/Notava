class MusicController < ApplicationController
  before_action :set_deezer_service

  def search
    query = params[:query]
    puts "MusicController: Search requested for '#{query}'"
    
    @results = @deezer_service.search_tracks(query)
    
    # Format results for search dropdown
    formatted_results = format_search_results(@results)
    
    puts "MusicController: Formatted results - tracks: #{formatted_results[:tracks]&.length || 0}, artists: #{formatted_results[:artists]&.length || 0}, albums: #{formatted_results[:albums]&.length || 0}"
    
    respond_to do |format|
      format.html
      format.json { render json: formatted_results }
    end
  end

  def chart
    @tracks = @deezer_service.get_chart
    respond_to do |format|
      format.html
      format.json { render json: @tracks }
    end
  end

  def new_releases
    @albums = @deezer_service.get_new_releases
    respond_to do |format|
      format.html
      format.json { render json: @albums }
    end
  end

  def genres
    @genres = @deezer_service.get_genres
    respond_to do |format|
      format.html
      format.json { render json: @genres }
    end
  end

  def artist
    @artist = @deezer_service.get_artist(params[:id])
    @top_tracks = @deezer_service.get_artist_top_tracks(params[:id])
    respond_to do |format|
      format.html
      format.json { render json: { artist: @artist, top_tracks: @top_tracks } }
    end
  end

  def album
    @album = @deezer_service.get_album(params[:id])
    respond_to do |format|
      format.html
      format.json { render json: @album }
    end
  end

  private

  def set_deezer_service
    @deezer_service = DeezerService.new
  end
  
  # Format search results for the dropdown
  def format_search_results(results)
    if results.is_a?(Hash) && results['data'].is_a?(Array)
      tracks = []
      artists = []
      albums = []
      
      results['data'].each do |item|
        case item['type']
        when 'track'
          tracks << {
            id: item['id'],
            title: item['title'],
            preview: item['preview'],
            artist: {
              id: item['artist']['id'],
              name: item['artist']['name']
            },
            album: {
              id: item['album']['id'],
              title: item['album']['title'],
              cover_medium: item['album']['cover_medium']
            }
          }
        end
        
        # Add unique artists from tracks
        if item['artist'] && !artists.any? { |a| a[:id] == item['artist']['id'] }
          artists << {
            id: item['artist']['id'],
            name: item['artist']['name'],
            picture_medium: item['artist']['picture_medium']
          }
        end
        
        # Add unique albums from tracks
        if item['album'] && !albums.any? { |a| a[:id] == item['album']['id'] }
          albums << {
            id: item['album']['id'],
            title: item['album']['title'],
            cover_medium: item['album']['cover_medium'],
            artist: {
              id: item['artist']['id'],
              name: item['artist']['name']
            }
          }
        end
      end
      
      # Return a hash with all result types
      {
        tracks: tracks,
        artists: artists,
        albums: albums
      }
    else
      # Handle error case
      puts "MusicController: Invalid results format from DeezerService: #{results.inspect[0..100]}..."
      { tracks: [], artists: [], albums: [] }
    end
  end
end 