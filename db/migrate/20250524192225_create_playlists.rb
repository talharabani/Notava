class CreatePlaylists < ActiveRecord::Migration[8.0]
  def change
    create_table :playlists do |t|
      t.string :name
      t.references :user, null: false, foreign_key: true
      t.string :description

      t.timestamps
    end
  end
end
