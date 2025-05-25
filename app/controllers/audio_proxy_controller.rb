require 'uri'
require 'net/http'

class AudioProxyController < ApplicationController
  # Skip CSRF protection for this controller
  skip_before_action :verify_authenticity_token, if: -> { request.format.json? }
  
  # Allow cross-origin requests
  before_action :set_cors_headers
  
  # Proxy audio files to handle CORS issues
  def proxy
    # Get the URL from the request parameters
    url = params[:url]
    
    # Validate the URL
    unless url.present? && valid_url?(url)
      Rails.logger.error("Invalid or missing URL parameter: #{url}")
      render json: { error: 'Invalid or missing URL parameter' }, status: :bad_request
      return
    end
    
    begin
      # Parse the URL
      uri = URI.parse(url)
      
      # Log the proxy request
      Rails.logger.info("Proxying audio: #{url}")
      
      # Check if we have range headers to support seeking
      range_header = request.headers['Range']
      
      # Set up the HTTP request
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = (uri.scheme == 'https')
      http.open_timeout = 5
      http.read_timeout = 10
      
      # Create a new request
      req = Net::HTTP::Get.new(uri.request_uri)
      
      # Set appropriate headers
      req['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      req['Referer'] = request.headers['Referer'] || 'https://yourapplication.com/'
      req['Accept'] = '*/*'
      
      # Pass through range header if present (for seeking)
      req['Range'] = range_header if range_header
      
      # Make the request
      http.request(req) do |remote_response|
        # Check if the request was successful
        if remote_response.is_a?(Net::HTTPSuccess) || remote_response.is_a?(Net::HTTPPartialContent)
          # Get content type and length from the response
          content_type = remote_response['Content-Type'] || 'audio/mpeg'
          content_length = remote_response['Content-Length']
          
          # Determine response status
          status = remote_response.is_a?(Net::HTTPPartialContent) ? :partial_content : :ok
          
          # Set response headers
          response.headers['Content-Type'] = content_type
          response.headers['Content-Length'] = content_length if content_length
          response.headers['Accept-Ranges'] = 'bytes'
          response.headers['Content-Disposition'] = 'inline'
          
          # Copy other important headers
          if remote_response['Content-Range']
            response.headers['Content-Range'] = remote_response['Content-Range']
          end
          
          # Stream the response to the client
          self.response_body = Enumerator.new do |yielder|
            remote_response.read_body do |chunk|
              yielder << chunk
            end
          end
          
          # Set the response status
          self.status = status
        else
          # Handle unsuccessful responses by passing through the status code
          Rails.logger.error("Remote server returned: #{remote_response.code} #{remote_response.message} for #{url}")
          render json: { 
            error: "Remote server error", 
            status: remote_response.code,
            message: remote_response.message 
          }, status: remote_response.code.to_i
        end
      end
    rescue URI::InvalidURIError
      Rails.logger.error("Invalid URI: #{url}")
      render json: { error: 'Invalid URL format' }, status: :bad_request
    rescue Net::OpenTimeout, Net::ReadTimeout
      Rails.logger.error("Timeout while accessing: #{url}")
      render json: { error: 'Request timed out' }, status: :gateway_timeout
    rescue SocketError
      Rails.logger.error("Socket error (host not found): #{url}")
      render json: { error: 'Host not found' }, status: :bad_gateway
    rescue Errno::ECONNREFUSED
      Rails.logger.error("Connection refused: #{url}")
      render json: { error: 'Connection refused' }, status: :bad_gateway
    rescue => e
      Rails.logger.error("Error proxying audio: #{e.class.name} - #{e.message} for #{url}")
      Rails.logger.error(e.backtrace.join("\n"))
      render json: { error: "Server error: #{e.message}" }, status: :internal_server_error
    end
  end
  
  private
  
  # Set CORS headers to allow cross-origin requests
  def set_cors_headers
    headers['Access-Control-Allow-Origin'] = '*'
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    headers['Access-Control-Allow-Headers'] = 'Origin, Content-Type, Accept, Authorization, X-Requested-With, Range'
    headers['Access-Control-Expose-Headers'] = 'Content-Length, Content-Range, Content-Type'
    headers['Access-Control-Max-Age'] = '3600'
    
    # Handle preflight OPTIONS requests
    if request.method == 'OPTIONS'
      headers['Access-Control-Allow-Credentials'] = 'true'
      render plain: '', status: :ok
    end
  end
  
  # Validate the URL format and restrict to audio hosting domains
  def valid_url?(url)
    begin
      uri = URI.parse(url)
      return false unless uri.is_a?(URI::HTTP) || uri.is_a?(URI::HTTPS)
      
      # Allow common audio hosting domains and CDNs
      allowed_domains = [
        'cdn.example.com',
        'e-cdns-proxy-*.dzcdn.net',
        'cdns-preview-*.dzcdn.net',
        'cdnt-preview.dzcdn.net',
        'cdns-*.dzcdn.net',
        'preview.example.com',
        'audio.example.com',
        'media.example.com',
        'api.deezer.com',
        # Add more allowed domains here
      ]
      
      # Check if the domain matches any in the allowed list
      # Use wildcard matching for flexible domain patterns
      domain_allowed = allowed_domains.any? do |pattern|
        # Convert wildcard pattern to regex
        regex = Regexp.new("^" + Regexp.escape(pattern).gsub('\*', '.*') + "$")
        uri.host =~ regex
      end
      
      # For development, allow all domains temporarily
      domain_allowed = true if Rails.env.development?
      
      return domain_allowed
    rescue URI::InvalidURIError
      return false
    end
  end
end 