Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html
  devise_for :users
  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Render dynamic PWA files from app/views/pwa/* (remember to link manifest in application.html.erb)
  # get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  # get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker

  # Defines the root path route ("/")
  root "home#index"
  resources :plans, only: [:index]
  
  # Profile routes
  get 'profile', to: 'profiles#show', as: :profile
  
  # Search route
  get 'search', to: 'home#search', as: :search
  
   # Browse section routes
  get 'discover', to: 'browse#discover', as: :discover
  get 'new_releases', to: 'browse#new_releases', as: :new_releases
  get 'popular', to: 'browse#popular', as: :popular
  get 'charts', to: 'browse#charts', as: :charts
  get 'radio', to: 'browse#radio', as: :radio
  get 'wishlist', to: 'browse#wishlist', as: :wishlist
  
  # Your Music section routes
  get 'songs', to: 'library#songs', as: :songs
  get 'albums', to: 'library#albums', as: :albums
  get 'artists', to: 'library#artists', as: :artists
  get 'history', to: 'library#history', as: :history
  
  # Music API routes
  resources :music, only: [] do
    collection do
      get 'search'
      get 'chart'
      get 'new_releases'
      get 'genres'
    end
    member do
      get 'artist'
      get 'album'
    end
  end
end
