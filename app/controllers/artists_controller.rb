class ArtistsController < ApplicationController
  before_action :authenticate_user!

  def index
    if params[:query].present?
      @result = DeezerService.search_songs(params[:query])
      @artists = @result[:songs].map { |song| song['artist'] }.uniq if @result[:success]
    else
      @artists = []
    end
  end

  def show
    @result = DeezerService.get_artist_songs(params[:id])
    @songs = @result[:songs] || []
  end
end 