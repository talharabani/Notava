class PlaylistsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_playlist, only: [:show, :edit, :update, :destroy, :add_track, :remove_track]
  before_action :authorize_playlist, only: [:edit, :update, :destroy, :add_track, :remove_track]

  def index
    @playlists = current_user.playlists
    
    respond_to do |format|
      format.html
      format.json do
        render json: @playlists.map { |playlist| 
          { 
            id: playlist.id, 
            name: playlist.name, 
            track_count: playlist.playlist_tracks.count,
            cover_image: playlist.cover_image
          } 
        }
      end
    end
  end

  def show
    @tracks = @playlist.playlist_tracks
  end

  def new
    @playlist = current_user.playlists.new
  end

  def create
    @playlist = current_user.playlists.new(playlist_params)

    if @playlist.save
      redirect_to @playlist, notice: 'Playlist created successfully.'
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
  end

  def update
    if @playlist.update(playlist_params)
      redirect_to @playlist, notice: 'Playlist updated successfully.'
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @playlist.destroy
    redirect_to playlists_path, notice: 'Playlist deleted successfully.'
  end

  def add_track
    track_id = params[:track_id]
    track_data = params[:track_data]
    
    begin
      # Parse JSON string if it's a string
      if track_data.is_a?(String)
        track_data = JSON.parse(track_data)
      end
      
      # Check if the track is already in the playlist
      existing_track = @playlist.playlist_tracks.find_by(track_id: track_id)
      
      if existing_track
        render json: { status: 'error', message: 'Track already exists in this playlist' }, status: :unprocessable_entity
        return
      end
      
      # Create a new playlist track
      @playlist_track = @playlist.playlist_tracks.new(
        track_id: track_id,
        track_data: track_data
      )
      
      if @playlist_track.save
        render json: { 
          status: 'success', 
          message: 'Track added to playlist', 
          playlist: {
            id: @playlist.id,
            name: @playlist.name,
            track_count: @playlist.playlist_tracks.count
          }
        }
      else
        render json: { status: 'error', message: 'Failed to add track to playlist' }, status: :unprocessable_entity
      end
    rescue => e
      render json: { status: 'error', message: "Error: #{e.message}" }, status: :unprocessable_entity
    end
  end

  def remove_track
    track_id = params[:track_id]
    playlist_track = @playlist.playlist_tracks.find_by(track_id: track_id)
    
    if playlist_track
      playlist_track.destroy
      respond_to do |format|
        format.html { redirect_to @playlist, notice: 'Track removed from playlist.' }
        format.json { render json: { status: 'success', message: 'Track removed from playlist' } }
      end
    else
      respond_to do |format|
        format.html { redirect_to @playlist, alert: 'Track not found in this playlist.' }
        format.json { render json: { status: 'error', message: 'Track not found in this playlist' }, status: :not_found }
      end
    end
  end

  private

  def set_playlist
    @playlist = Playlist.find(params[:id])
  end

  def authorize_playlist
    unless @playlist.user == current_user
      redirect_to playlists_path, alert: 'You are not authorized to perform this action.'
    end
  end

  def playlist_params
    params.require(:playlist).permit(:name, :description)
  end
end
