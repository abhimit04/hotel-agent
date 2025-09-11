// Hotel API Handler - Comprehensive hotel data fetching service
// This module handles fetching hotel data from multiple platforms

class HotelApiHandler {
  constructor() {
    this.rateLimitDelay = 1000; // 1 second between requests
    this.maxRetries = 3;
    this.cache = new Map();
    this.cacheExpiry = 30 * 60 * 1000; // 30 minutes
    this.apiUsageLimits = {
          booking: 1000,
          agoda: 1000,
          expedia: 1000,
          hotels: 1000,
          rapidapi: 1000
        };
    this.apiUsageCounts = {
          booking: 0,
          agoda: 0,
          expedia: 0,
          hotels: 0,
          rapidapi: 0
        };
  }


  // Main search function that coordinates all platform searches
  async searchHotels(searchParams) {
    const { city, checkIn, checkOut, guests, platforms = ['booking'] } = searchParams;

    console.log(`Searching hotels in ${city} for ${guests} guests from ${checkIn} to ${checkOut}`);

    const results = {
      hotels: [],
      searchId: Date.now(),
      searchParams,
      platformResults: {},
      errors: []
    };

    // Search each platform in parallel with error handling
    const platformPromises = platforms.map(async (platform) => {
      try {
        await this.delay(Math.random() * this.rateLimitDelay);
        const platformData = await this.fetchFromPlatform(platform, searchParams);
        // Increment usage count
        this.apiUsageCounts[platform] += 1;

                // Limit top 10 by reviews
        platformData.hotels = (platformData.hotels || [])
        .sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0))
        .slice(0, 10);

        results.platformResults[platform] = platformData;
        return platformData;
      } catch (error) {
        console.error(`Error fetching from ${platform}:`, error);
        const safeData = { hotels: [], platform, error: error.message };
        results.errors.push(safeData);
        return safeData;
      }
    });

    const platformResults = await Promise.all(platformPromises);

    // Merge and deduplicate results
    results.hotels = this.mergeHotelResults(platformResults);

    return results;
  }

  // Fetch data from specific platform
  async fetchFromPlatform(platform, searchParams) {
    const cacheKey = `${platform}-${JSON.stringify(searchParams)}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheExpiry) {
        console.log(`Returning cached data for ${platform}`);
        return cached.data;
      }
    }

    if (this.apiUsageCounts[platform] >= this.apiUsageLimits[platform]) {
          console.warn(`${platform} usage limit reached, skipping API call`);
          return { hotels: [], platform,  skipped: true };
    }
    let data;
    try{
    switch (platform) {
      case 'booking':
        data = await this.fetchBookingData(searchParams);
        break;
      case 'agoda':
        data = await this.fetchAgodaData(searchParams);
        break;
      case 'expedia':
        data = await this.fetchExpediaData(searchParams);
        break;
      case 'hotels':
        data = await this.fetchHotelsData(searchParams);
        break;
      case 'rapidapi':
        data = await this.fetchRapidApiData(searchParams);
        break;
      default:
        console.warn(`Skipping unsupported platform: ${platform}`);
        return { hotels: [], platform, skipped: true };
    }
    if (!data || !Array.isArray(data.hotels)) {
          console.warn(`${platform} returned invalid data, defaulting to empty`);
          data = { hotels: [], platform };
    }
    }catch (err) {
        console.error(`Error fetching from ${platform}:`, err);
        data = { hotels: [], platform, error: err.message };
      }


    // Cache the result
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });

    // **FIX START**
    // The `console.log` was moved before the `return` statement.
    console.log(`Fetched and cached data for ${platform}`);
    return data;
    // **FIX END**
  }

  // --- Booking.com API integration ---
  async fetchBookingData(searchParams) {
    const { city, checkIn, checkOut, guests } = searchParams;

    try {
      const url = new URL('https://booking-com.p.rapidapi.com/v1/hotels/search');
      url.search = new URLSearchParams({
          dest_type: 'city',
          dest_id: await this.getCityId(city, 'booking'),
          checkin_date: checkIn,
          checkout_date: checkOut,
          adults_number: guests.toString(),
          order_by: 'popularity',
          filter_by_currency: 'USD',
          locale: 'en-gb',
          room_number: '1',
          units: 'metric',
          include_adjacency: 'true'
      }).toString();

      const response = await fetch(url, {
          method: 'GET',
          headers: {
              'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || 'your_rapidapi_key_here',
              'X-RapidAPI-Host': 'booking-com.p.rapidapi.com'
          }
      });

      if (!response.ok) {
          throw new Error(`Booking API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Booking.com response data:', data);
      return this.parseBookingResponse(data);

    } catch (error) {
        console.error('Booking.com API error:', error);
        // **FIX START**
        // Added 'booking' as a string literal instead of a variable
        return { hotels: [], platform: 'booking',  skipped: true };
        // **FIX END**
    }
  }

  // --- Agoda API integration ---
  async fetchAgodaData(searchParams) {
    const { city, checkIn, checkOut, guests } = searchParams;

    try {
      const url = new URL('https://travel-advisor.p.rapidapi.com/hotels/list');
      url.search = new URLSearchParams({
        location_id: await this.getCityId(city, 'tripadvisor'),
        adults: guests.toString(),
        checkin: checkIn,
        checkout: checkOut,
        offset: '0',
        currency: 'USD',
        order: 'asc',
        limit: '30',
        sort: 'recommended'
      }).toString();
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || 'your_rapidapi_key_here',
          'X-RapidAPI-Host': 'travel-advisor.p.rapidapi.com'
        }
      });

      if (!response.ok) {
        throw new Error(`Agoda API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Agoda response data:', data);
      if (data.errors && data.errors.length > 0) {
        console.warn('Agoda API error response:', data.errors);
        return { hotels: [], platform: 'agoda', error: data.errors };
      }
      return this.parseAgodaResponse(data);

    } catch (error) {
      console.error('Agoda API error:', error);
      return this.generateMockAgodaData(searchParams);
    }
  }

  // --- Expedia API integration ---
  async fetchExpediaData(searchParams) {
    const { city, checkIn, checkOut, guests } = searchParams;

    try {
      const destUrl = new URL('https://hotels-com-provider.p.rapidapi.com/v2/regions');
      destUrl.search = new URLSearchParams({
        query: city,
        locale: 'en_IN',
        domain: 'IN'
      }).toString();

      const destResponse = await this.fetchWithRetry(destUrl, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'hotels-com-provider.p.rapidapi.com'
        }
      });

      console.log('Expedia destination response status:', destResponse.status);

      if (!destResponse.ok) {
        console.warn(`Expedia Destination API error: ${destResponse.status}`);
        return { hotels: [], platform: 'expedia' };
      }

      const destData = await destResponse.json();
      const suggestions = destData?.data || [];

      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        console.warn(`No suggestions found for city: ${city}`);
        return { hotels: [], platform: 'expedia' };
      }

      const cityResult = suggestions.find(r => r.type === 'CITY') || suggestions.find(r => r.type === 'AIRPORT');

      if (!cityResult) {
        console.warn(`No valid suggestions found for city: ${city}`);
        return { hotels: [], platform: 'expedia' };
      }

      const url = new URL('https://hotels-com-provider.p.rapidapi.com/v2/hotels/search');
      url.search = new URLSearchParams({
        domain: 'IN',
        locale: 'en_IN',
        region_id: cityResult.gaiaId,
        checkin_date: checkIn,
        checkout_date: checkOut,
        adults_number: guests,
        children_number: 0,
        rooms_number: 1,
        sort_order: 'REVIEW',
        currency: 'INR',
        page_number: 1
      }).toString();

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'hotels-com-provider.p.rapidapi.com'
        }
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.warn('Expedia API rate limit reached');
          return { hotels: [], platform: 'expedia' };
        }
        console.warn(`Expedia Hotels API error: ${response.status}`);
        return { hotels: [], platform: 'expedia' };
      }

      const data = await response.json();
      return this.parseExpediaResponse(data);

    } catch (error) {
      console.error('Expedia API error:', error.message);
      return { hotels: [], platform: 'expedia' };
    }
  }

  // --- RapidAPI generic hotel search ---
  async fetchRapidApiData(searchParams) {
    const { city, checkIn, checkOut, guests } = searchParams;

    try {
      const url = new URL('https://priceline-com-provider.p.rapidapi.com/v1/hotels/search');
      url.search = new URLSearchParams({
        sort_order: 'HDR',
        location_id: await this.getCityId(city, 'priceline'),
        date_checkout: checkOut,
        date_checkin: checkIn,
        adults_number: guests.toString(),
        rooms_number: '1'
      }).toString();
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || 'your_rapidapi_key_here',
          'X-RapidAPI-Host': 'priceline-com-provider.p.rapidapi.com'
        }
      });

      if (!response.ok) {
        throw new Error(`RapidAPI error: ${response.status}`);
      }

      const data = await response.json();
      console.log('RapidAPI response data:', data);
      return this.parseRapidApiResponse(data);

    } catch (error) {
      console.error('RapidAPI error:', error);
      return this.generateMockRapidApiData(searchParams);
    }
  }

  // --- Hotels.com API integration (using Expedia) ---
  async fetchHotelsData(searchParams) {
      const { city } = searchParams;
      console.warn('Hotels.com API is a part of Expedia. Using Expedia search handler.');
      return this.fetchExpediaData(searchParams);
  }

  // --- Utility Functions ---
  async fetchWithRetry(url, options) {
    for (let i = 0; i < this.maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.status !== 429) {
                return response;
            }
            console.warn(`Rate limit hit (429), retrying in ${this.rateLimitDelay}ms...`);
            await this.delay(this.rateLimitDelay * Math.pow(2, i)); // Exponential backoff
        } catch (error) {
            console.error(`Fetch attempt ${i + 1} failed:`, error);
        }
    }
    throw new Error('All fetch retries failed due to rate limiting or network errors.');
  }

  // Get city ID for different platforms
  async getCityId(cityName, platform) {
    const cityIds = {
      'booking': {
        'mumbai': '-2092174',
        'delhi': '-2106102',
        'bangalore': '-2090174',
        'chennai': '-2093701',
        'kolkata': '-2109251',
        'hyderabad': '-2094342',
        'pune': '-2111196',
        'ahmedabad': '-2095603'
      },
      'tripadvisor': {
        'mumbai': '304554',
        'delhi': '304551',
        'bangalore': '297628',
        'chennai': '304549',
        'kolkata': '304554',
        'hyderabad': '297586',
        'pune': '297654',
        'ahmedabad': '297608'
      },
      'priceline': {
        'mumbai': '6000078',
        'delhi': '6000079',
        'bangalore': '6000080',
        'chennai': '6000081',
        'kolkata': '6000082',
        'hyderabad': '6000083',
        'pune': '6000084',
        'ahmedabad': '6000085'
      }
    };

    const cityLower = cityName.toLowerCase();
    return cityIds[platform]?.[cityLower] || cityLower;
  }

  // Parse responses from different platforms
  parseBookingResponse(data) {
    const hotels = (data.result || []).map(hotel => ({
      id: hotel.hotel_id,
      name: hotel.hotel_name,
      rating: hotel.review_score / 2,
      location: `${hotel.address}, ${hotel.city}`,
      price: hotel.min_total_price,
      currency: hotel.currency_code,
      image: hotel.max_photo_url,
      description: hotel.hotel_name_trans,
      amenities: hotel.hotel_facilities || [],
      reviewCount: hotel.review_nr,
      platform: 'booking',
      url: hotel.url,
      coordinates: {
        lat: hotel.latitude,
        lng: hotel.longitude
      }
    }));

    return {
      platform: 'booking',
      hotels,
      total: hotels.length
    };
  }

  parseAgodaResponse(data) {
    const hotels = (data.data || []).map(hotel => ({
      id: hotel.location_id,
      name: hotel.name,
      rating: parseFloat(hotel.rating),
      location: hotel.address_obj?.address_string || hotel.location_string,
      price: hotel.price_level || 'N/A',
      image: hotel.photo?.images?.large?.url,
      description: hotel.description,
      amenities: hotel.amenities || [],
      reviewCount: hotel.num_reviews,
      platform: 'agoda',
      url: hotel.web_url,
      coordinates: {
        lat: parseFloat(hotel.latitude),
        lng: parseFloat(hotel.longitude)
      }
    }));

    return {
      platform: 'agoda',
      hotels,
      total: hotels.length
    };
  }

  parseExpediaResponse(data) {
    const hotels = (data.properties || []).map(hotel => ({
      id: hotel.id,
      name: hotel.name,
      rating: hotel.reviews?.score / 2 || 0,
      location: `${hotel.address?.line1}, ${hotel.address?.city}`,
      price: hotel.price?.lead?.amount,
      currency: hotel.price?.lead?.currencyInfo?.code,
      image: hotel.propertyImage?.image?.url,
      description: hotel.neighbourhood?.name,
      amenities: hotel.amenities?.amenities?.map(a => a.name) || [],
      reviewCount: hotel.reviews?.total,
      platform: 'expedia',
      url: `https://hotels.com/ho${hotel.id}`,
      coordinates: {
        lat: hotel.mapMarker?.latLong?.latitude,
        lng: hotel.mapMarker?.latLong?.longitude
      }
    }));

    return {
      platform: 'expedia',
      hotels,
      total: hotels.length
    };
  }

  parseRapidApiResponse(data) {
    const hotels = (data.hotels || []).map(hotel => ({
      id: hotel.hotelId,
      name: hotel.name,
      rating: hotel.starRating,
      location: hotel.address,
      price: hotel.ratePlan?.price?.exactCurrent,
      currency: 'USD',
      image: hotel.thumbnailUrl,
      description: hotel.shortDescription,
      amenities: hotel.amenities || [],
      reviewCount: hotel.guestReviews?.total,
      platform: 'rapidapi',
      url: hotel.deeplink
    }));

    return {
      platform: 'rapidapi',
      hotels,
      total: hotels.length
    };
  }

  // --- Mock data generators for fallback ---
  generateMockAgodaData(searchParams) {
    const { city } = searchParams;
    const mockHotels = [
      {
        id: `agoda-${Date.now()}-1`,
        name: `${city} Luxury Suites`,
        rating: 4.6,
        location: `Premium Area, ${city}`,
        price: Math.floor(Math.random() * 250) + 150,
        currency: 'USD',
        image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=300&h=200&fit=crop',
        description: `Luxury suites with premium amenities in ${city}`,
        amenities: ['Spa', 'Fine Dining', 'Concierge', 'Valet'],
        reviewCount: Math.floor(Math.random() * 600) + 200,
        platform: 'agoda',
        url: `https://agoda.com/hotel/${city.toLowerCase()}-luxury`,
        coordinates: { lat: 0, lng: 0 }
      }
    ];

    return {
      platform: 'agoda',
      hotels: mockHotels,
      total: mockHotels.length
    };
  }

  generateMockExpediaData(searchParams) {
    const { city } = searchParams;
    const mockHotels = [
      {
        id: `expedia-${Date.now()}-1`,
        name: `${city} Resort & Spa`,
        rating: 4.4,
        location: `Resort Area, ${city}`,
        price: Math.floor(Math.random() * 180) + 120,
        currency: 'USD',
        image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=300&h=200&fit=crop',
        description: `Full-service resort with spa facilities in ${city}`,
        amenities: ['Spa', 'Pool', 'Tennis', 'Golf', 'Multiple Restaurants'],
        reviewCount: Math.floor(Math.random() * 900) + 300,
        platform: 'expedia',
        url: `https://expedia.com/hotel/${city.toLowerCase()}-resort`,
        coordinates: { lat: 0, lng: 0 }
      }
    ];

    return {
      platform: 'expedia',
      hotels: mockHotels,
      total: mockHotels.length
    };
  }

  generateMockRapidApiData(searchParams) {
    const { city } = searchParams;
    const mockHotels = [
      {
        id: `rapidapi-${Date.now()}-1`,
        name: `${city} Premium Inn`,
        rating: 4.1,
        location: `City Center, ${city}`,
        price: Math.floor(Math.random() * 140) + 70,
        currency: 'USD',
        image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=300&h=200&fit=crop',
        description: `Comfortable and affordable hotel in ${city}`,
        amenities: ['WiFi', 'Breakfast', 'Parking', 'Pet Friendly'],
        reviewCount: Math.floor(Math.random() * 500) + 100,
        platform: 'rapidapi',
        url: `https://example.com/hotel/${city.toLowerCase()}-premium`,
        coordinates: { lat: 0, lng: 0 }
      }
    ];

    return {
      platform: 'rapidapi',
      hotels: mockHotels,
      total: mockHotels.length
    };
  }

  // --- Merge results from multiple platforms ---
  mergeHotelResults(platformResults) {
    const allHotels = [];
    const hotelMap = new Map();

    platformResults.forEach(result => {
      if (result.hotels) {
        result.hotels.forEach(hotel => {
          const key = this.generateHotelKey(hotel.name, hotel.location);

          if (hotelMap.has(key)) {
            const existing = hotelMap.get(key);
            existing.platforms.push(hotel.platform);
            existing.prices[hotel.platform] = {
              price: hotel.price,
              currency: hotel.currency,
              url: hotel.url
            };
            if (hotel.rating > existing.rating) {
              existing.rating = hotel.rating;
            }
          } else {
            const mergedHotel = {
              ...hotel,
              platforms: [hotel.platform],
              prices: {
                [hotel.platform]: {
                  price: hotel.price,
                  currency: hotel.currency,
                  url: hotel.url
                }
              }
            };
            hotelMap.set(key, mergedHotel);
            allHotels.push(mergedHotel);
          }
        });
      }
    });

    return allHotels.sort((a, b) => {
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      return (b.reviewCount || 0) - (a.reviewCount || 0);
    });
  }

  // Generate hotel key for deduplication
  generateHotelKey(name, location) {
    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanLocation = (location || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${cleanName}-${cleanLocation}`;
  }

  // Utility functions
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get available platforms
  getAvailablePlatforms() {
    return [
      { id: 'booking', name: 'Booking.com', supported: true },
      { id: 'agoda', name: 'Agoda', supported: true },
      { id: 'expedia', name: 'Expedia', supported: true },
      { id: 'hotels', name: 'Hotels.com', supported: true },
      { id: 'rapidapi', name: 'RapidAPI Hotels', supported: true }
    ];
  }

  // Price comparison across platforms
  comparePrice(hotels) {
    return hotels.map(hotel => {
      const prices = hotel.prices || {};
      const priceArray = Object.values(prices).map(p => p.price).filter(p => p && p !== 'N/A');

      if (priceArray.length > 0) {
        hotel.bestPrice = Math.min(...priceArray);
        hotel.avgPrice = priceArray.reduce((a, b) => a + b, 0) / priceArray.length;
        hotel.priceRange = {
          min: Math.min(...priceArray),
          max: Math.max(...priceArray)
        };
      }

      return hotel;
    });
  }

  // Filter and sort hotels
  filterAndSortHotels(hotels, filters = {}) {
    let filtered = [...hotels];

    if (filters.minRating) {
      filtered = filtered.filter(h => h.rating >= filters.minRating);
    }

    if (filters.maxPrice) {
      filtered = filtered.filter(h => h.bestPrice <= filters.maxPrice);
    }

    if (filters.amenities && filters.amenities.length > 0) {
      filtered = filtered.filter(h =>
        filters.amenities.some(amenity =>
          h.amenities.some(ha => ha.toLowerCase().includes(amenity.toLowerCase()))
        )
      );
    }

    if (filters.sortBy) {
      switch (filters.sortBy) {
        case 'price':
          filtered.sort((a, b) => (a.bestPrice || 0) - (b.bestPrice || 0));
          break;
        case 'rating':
          filtered.sort((a, b) => b.rating - a.rating);
          break;
        case 'reviews':
          filtered.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
          break;
        case 'name':
          filtered.sort((a, b) => a.name.localeCompare(b.name));
          break;
        default:
          break;
      }
    }

    return filtered;
  }

  // Get hotel details by ID
  async getHotelDetails(hotelId, platform) {
    console.log(`Fetching details for hotel ${hotelId} from ${platform}`);

    return {
      id: hotelId,
      platform,
      details: {
        fullDescription: 'Detailed hotel description...',
        photos: [],
        reviews: [],
        amenities: [],
        policies: {},
        roomTypes: []
      }
    };
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
    console.log('Cache cleared');
  }

  // Get cache statistics
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

// Export the class for use in other modules
if (typeof window !== 'undefined') {
  window.HotelApiHandler = HotelApiHandler;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = HotelApiHandler;
}