# frozen_string_literal: true

require 'httparty'

class JamendoService
  class ConfigurationError < StandardError; end

  include HTTParty
  base_uri 'https://api.jamendo.com/v3.0'
  debug_output $stdout if Rails.env.development?

  def initialize
    @client_id = Rails.application.credentials.jamendo&.dig(:client_id)
    Rails.logger.info "Initializing JamendoService"
    Rails.logger.info "Client ID present: #{@client_id.present?}"
    
    if @client_id.blank?
      Rails.logger.error "Jamendo client_id is missing from credentials"
      raise ConfigurationError, "Jamendo client_id is not configured"
    end
  end

  def search_tracks(query)
    begin
      Rails.logger.info "Searching Jamendo API for: #{query}"
      
      # Build the API URL with parameters
      url = "#{base_uri}/tracks"
      params = {
        client_id: @client_id,
        format: 'json',
        limit: 20,
        search: query,
        include: 'musicinfo stats'
      }
      
      Rails.logger.info "Making request to: #{url}"
      Rails.logger.info "With params: #{params.except(:client_id).inspect}"
      
      response = HTTParty.get(url, query: params)

      Rails.logger.info "Response status: #{response.code}"
      Rails.logger.info "Response headers: #{response.headers}"
      Rails.logger.debug "Response body: #{response.body}"

      if response.success?
        begin
          parsed_response = JSON.parse(response.body)
          
          # Validate the response structure
          unless parsed_response.is_a?(Hash) && parsed_response['results'].is_a?(Array)
            Rails.logger.error "Invalid response structure: #{parsed_response.inspect}"
            return {
              success: false,
              error: "Invalid response from Jamendo API"
            }
          end
          
          if parsed_response['results'].empty?
            Rails.logger.info "No tracks found for query: #{query}"
            return {
              success: true,
              songs: [],
              total: 0
            }
          end
          
          tracks = parsed_response['results']
          Rails.logger.info "Successfully parsed #{tracks.length} tracks"
          
          {
            success: true,
            songs: format_tracks(tracks),
            total: parsed_response['headers']['results_count']
          }
        rescue JSON::ParserError => e
          Rails.logger.error "JSON Parse Error: #{e.message}"
          Rails.logger.error "Response body: #{response.body}"
          {
            success: false,
            error: "Invalid JSON response from Jamendo API"
          }
        end
      else
        error_message = "Failed to fetch tracks from Jamendo: #{response.code}"
        Rails.logger.error "#{error_message} - Response: #{response.body}"
        {
          success: false,
          error: error_message
        }
      end
    rescue HTTParty::Error => e
      Rails.logger.error "HTTP Error: #{e.message}"
      {
        success: false,
        error: "Network error while connecting to Jamendo: #{e.message}"
      }
    rescue => e
      Rails.logger.error "Unexpected Error: #{e.class} - #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
      {
        success: false,
        error: "Unexpected error: #{e.message}"
      }
    end
  end

  private

  def format_tracks(tracks)
    tracks.map do |track|
      begin
        {
          id: track['id'],
          title: track['name'],
          artist: {
            id: track['artist_id'],
            name: track['artist_name']
          },
          album: {
            cover_medium: track['image'],
            cover_small: track['image']
          },
          preview: track['audio'],
          duration: track['duration'],
          license: track['license_ccurl'],
          file_type: 'mp3',
          streamable: true,
          stats: {
            plays: track['stats']['plays'],
            favorites: track['stats']['favorites']
          }
        }
      rescue => e
        Rails.logger.error "Error formatting track: #{e.message}"
        Rails.logger.error "Track data: #{track.inspect}"
        nil
      end
    end.compact
  end
end 