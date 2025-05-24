class HomeController < ApplicationController
  def index
    deezer_service = DeezerService.new
    
    begin
      @new_friday_tracks = deezer_service.get_new_friday_tracks(10)
      Rails.logger.info("New Friday tracks fetched: #{@new_friday_tracks.inspect}")
    rescue => e
      Rails.logger.error("Error fetching new Friday tracks: #{e.message}")
      @new_friday_tracks = { 'data' => [] }
    end
    
    begin
      @chart_tracks = deezer_service.get_chart(10)
      Rails.logger.info("Chart tracks fetched: #{@chart_tracks.inspect}")
    rescue => e
      Rails.logger.error("Error fetching chart tracks: #{e.message}")
      @chart_tracks = { 'data' => [] }
    end
    
    begin
      @trending_tracks = deezer_service.get_trending_tracks(10)
      Rails.logger.info("Trending tracks fetched: #{@trending_tracks.inspect}")
    rescue => e
      Rails.logger.error("Error fetching trending tracks: #{e.message}")
      @trending_tracks = { 'data' => [] }
    end
    
    begin
      @popular_albums = deezer_service.get_popular_albums(10)
      Rails.logger.info("Popular albums fetched: #{@popular_albums.inspect}")
    rescue => e
      Rails.logger.error("Error fetching popular albums: #{e.message}")
      @popular_albums = { 'data' => [] }
    end
    
    begin
      @genres = deezer_service.get_genres
      Rails.logger.info("Genres fetched: #{@genres.inspect}")
    rescue => e
      Rails.logger.error("Error fetching genres: #{e.message}")
      @genres = { 'data' => [] }
    end
  end
  
  def search
    query = params[:query]
    
    if query.present?
      deezer_service = DeezerService.new
      @results = deezer_service.search_tracks(query, 10)
      
      respond_to do |format|
        format.html { render :search }
        format.json { render json: @results }
      end
    else
      @results = { 'data' => [] }
      
      respond_to do |format|
        format.html { render :search }
        format.json { render json: @results }
      end
    end
  end
end
