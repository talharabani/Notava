#!/usr/bin/env ruby
require 'httparty'
require 'json'

class DeezerApiTest
  include HTTParty
  base_uri 'https://api.deezer.com'
  format :json

  def test_search(query)
    puts "Testing Deezer API search for: #{query}"
    response = self.class.get("/search", query: { q: query })
    
    puts "Response code: #{response.code}"
    
    if response.success?
      begin
        result = JSON.parse(response.body)
        
        if result['error']
          puts "Error in response: #{result['error'].inspect}"
        else
          puts "Success! Found #{result['data']&.length || 0} results"
          
          if result['data']&.length.to_i > 0
            puts "\nFirst result:"
            puts JSON.pretty_generate(result['data'][0])
          end
        end
      rescue JSON::ParserError => e
        puts "Failed to parse JSON: #{e.message}"
        puts "Response body: #{response.body[0..200]}..."
      end
    else
      puts "Request failed with status: #{response.code}"
    end
  end
end

# Test with a few search terms
tester = DeezerApiTest.new
['Beyonce', 'Coldplay', 'Ed Sheeran', 'Sixteen', 'Pop', 'Rock'].each do |term|
  tester.test_search(term)
  puts "\n" + "-" * 50 + "\n"
  sleep(1) # Be nice to the API
end 