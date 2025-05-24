class AlbumsController < ApplicationController
  before_action :authenticate_user!

  def index
    if params[:query].present?
      @result = DeezerService.search_songs(params[:query])
      @albums = @result[:songs].map { |song| song['album'] }.uniq if @result[:success]
    else
      @albums = []
    end
  end

  def show
    @result = DeezerService.get_album_songs(params[:id])
    @album = @result[:album] if @result[:success]
    @songs = @result[:songs] || []
  end
end 