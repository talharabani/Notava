class PlaylistTrack < ApplicationRecord
  belongs_to :playlist
  
  validates :track_id, presence: true
  validates :track_id, uniqueness: { scope: :playlist_id, message: "is already in this playlist" }
  
  # Ensure track_data is always stored as JSON
  def track_data=(data)
    if data.is_a?(String)
      super(data)
    else
      super(data.to_json)
    end
  end
  
  # Ensure track_data is always returned as a hash
  def track_data
    data = super
    if data.is_a?(String)
      JSON.parse(data) rescue {}
    else
      data || {}
    end
  end
end
