class MusicController < ApplicationController
  before_action :set_deezer_service

  def search
    @results = @deezer_service.search_tracks(params[:query])
    respond_to do |format|
      format.html
      format.json { render json: @results }
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
end 