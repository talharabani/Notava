class Playlist < ApplicationRecord
  belongs_to :user
  has_many :playlist_tracks, dependent: :destroy
  
  validates :name, presence: true
  
  # Get a cover image for the playlist (uses the first track's album cover if available)
  def cover_image
    if playlist_tracks.first&.track_data.present?
      track_data = playlist_tracks.first.track_data
      if track_data.is_a?(String)
        track_data = JSON.parse(track_data) rescue {}
      end
      
      if track_data.is_a?(Hash) && track_data['album'] && track_data['album']['cover_medium']
        return track_data['album']['cover_medium']
      end
    end
    
    # Default cover if no tracks or no track has album cover
    "https://e-cdns-images.dzcdn.net/images/cover/1cac28532dc6d689f0ccba5a3b71b9d0/500x500-000000-80-0-0.jpg"
  end
end
