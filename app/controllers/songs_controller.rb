require 'jamendo_service'

class SongsController < ApplicationController
  before_action :authenticate_user!

  def index
    if params[:query].present?
      Rails.logger.info "Processing index request with query: #{params[:query]}"
      begin
        @result = JamendoService.new.search_tracks(params[:query])
        @songs = @result[:songs] || []
        @error = @result[:error] unless @result[:success]
        @total = @result[:total] || 0
      rescue => e
        Rails.logger.error "Error in index action: #{e.class} - #{e.message}"
        Rails.logger.error e.backtrace.join("\n")
        @error = "Failed to search for songs"
        @songs = []
        @total = 0
      end
    else
      @songs = []
      @total = 0
    end
  end

  def search
    begin
      # Validate query parameter
      query = params[:query] || params[:q]
      
      if query.blank?
        Rails.logger.warn "Search attempted with blank query"
        return render json: { 
          success: false, 
          error: "Search query is required" 
        }, status: :bad_request
      end

      Rails.logger.info "Processing search request for query: #{query}"
      
      # Validate Jamendo credentials
      client_id = Rails.application.credentials.jamendo&.dig(:client_id)
      Rails.logger.info "Jamendo client_id present: #{client_id.present?}"
      
      if client_id.blank?
        Rails.logger.error "Jamendo client_id is missing from credentials"
        return render json: { 
          success: false, 
          error: "API configuration error. Please contact support." 
        }, status: :internal_server_error
      end

      # Initialize service and perform search
      service = JamendoService.new
      result = service.search_tracks(query)
      
      if result[:success]
        Rails.logger.info "Search successful, found #{result[:total]} results"
        render json: result
      else
        Rails.logger.error "Search failed: #{result[:error]}"
        render json: result, status: :unprocessable_entity
      end

    rescue JamendoService::ConfigurationError => e
      Rails.logger.error "Jamendo configuration error: #{e.message}"
      render json: {
        success: false,
        error: "API configuration error. Please contact support."
      }, status: :internal_server_error

    rescue HTTParty::Error => e
      Rails.logger.error "HTTP error during Jamendo API call: #{e.message}"
      render json: {
        success: false,
        error: "Failed to connect to music service. Please try again later."
      }, status: :service_unavailable

    rescue JSON::ParserError => e
      Rails.logger.error "JSON parsing error: #{e.message}"
      render json: {
        success: false,
        error: "Invalid response from music service. Please try again later."
      }, status: :internal_server_error

    rescue => e
      Rails.logger.error "Unexpected error in search: #{e.class} - #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
      render json: {
        success: false,
        error: "An unexpected error occurred. Please try again later."
      }, status: :internal_server_error
    end
  end
end 