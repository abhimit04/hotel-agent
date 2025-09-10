import React, { useState, useEffect } from 'react';
import { Search, Star, MapPin, Calendar, Users, Loader2, AlertCircle, ExternalLink, DollarSign } from 'lucide-react';
import HotelApiHandler from './hotel-api-handler.js';

const hotelAPI = new HotelApiHandler();

//const searchHotels = async () => {
//  const results = await hotelAPI.searchHotels({
//    city,
//    checkIn,
//    checkOut,
//    guests,
//    platforms: selectedPlatforms
//  });
//
//  setHotels(results.hotels);
//  setPlatformResults(results.platformResults);
//};

const HotelLandingPage = () => {
  const [searchParams, setSearchParams] = useState({
    city: '',
    checkIn: '',
    checkOut: '',
    guests: 2,
    rooms: 1
  });

  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchHistory, setSearchHistory] = useState([]);
  const [totalResults, setTotalResults] = useState(0);

  // Load search history from memory on component mount
  useEffect(() => {
    const savedHistory = JSON.parse(localStorage.getItem('hotelSearchHistory') || '[]');
    setSearchHistory(savedHistory);
  }, []);

  const saveToHistory = (searchData) => {
    const historyItem = {
      city: searchData.city,
      checkIn: searchData.checkIn,
      checkOut: searchData.checkOut,
      timestamp: new Date().toISOString()
    };

    const newHistory = [historyItem, ...searchHistory.filter(item =>
      item.city !== searchData.city || item.checkIn !== searchData.checkIn
    )].slice(0, 5);

    setSearchHistory(newHistory);
    localStorage.setItem('hotelSearchHistory', JSON.stringify(newHistory));
  };

  const searchHotels = async () => {
    if (!searchParams.city.trim()) {
      setError('Please enter a city name');
      return;
    }

    setLoading(true);
    setError('');
    setHotels([]);

    try {
      // Call the hotel API service
      const response = await fetch('/api/hotels/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          destination: searchParams.city,
          checkin: searchParams.checkIn,
          checkout: searchParams.checkOut,
          guests: searchParams.guests,
          rooms: searchParams.rooms
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setHotels(data.hotels);
        setTotalResults(data.total);
        saveToHistory(searchParams);
      } else {
        setError(data.message || 'Failed to fetch hotels');
      }

    } catch (err) {
      setError(`Failed to search hotels: ${err.message}`);
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setSearchParams(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      searchHotels();
    }
  };

  const formatPrice = (price, currency = 'INR') => {
    if (!price) return 'Price unavailable';

    const formatNumber = (num) => {
      return new Intl.NumberFormat('en-IN').format(num);
    };

    return `₹${formatNumber(price)}`;
  };

  const calculateStayDuration = () => {
    if (!searchParams.checkIn || !searchParams.checkOut) return 0;
    const start = new Date(searchParams.checkIn);
    const end = new Date(searchParams.checkOut);
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  };

  const HotelCard = ({ hotel }) => {
    const stayDuration = calculateStayDuration();
    const totalPrice = stayDuration > 0 ? hotel.price * stayDuration : hotel.price;

    return (
      <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 mb-6 border border-gray-100">
        <div className="md:flex">
          {/* Hotel Image */}
          <div className="md:w-1/3 relative">
            <img
              src={hotel.image || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=300&fit=crop'}
              alt={hotel.name}
              className="w-full h-48 md:h-full object-cover"
            />
            {hotel.discount && (
              <div className="absolute top-3 left-3 bg-red-500 text-white px-2 py-1 rounded text-sm font-semibold">
                {hotel.discount}% OFF
              </div>
            )}
          </div>

          {/* Hotel Details */}
          <div className="md:w-2/3 p-6">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-1">{hotel.name}</h3>
                <div className="flex items-center text-gray-600">
                  <MapPin size={14} className="mr-1" />
                  <span className="text-sm">{hotel.address}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">
                  {formatPrice(hotel.price)}
                </div>
                <div className="text-xs text-gray-500">per night</div>
                {stayDuration > 0 && (
                  <div className="text-sm text-gray-600 mt-1">
                    Total: {formatPrice(totalPrice)} ({stayDuration} nights)
                  </div>
                )}
              </div>
            </div>

            {/* Rating and Reviews */}
            <div className="flex items-center mb-4">
              <div className="flex items-center mr-4">
                <Star size={16} className="text-yellow-500 fill-current mr-1" />
                <span className="font-semibold">{hotel.rating || 'N/A'}</span>
                {hotel.reviewCount && (
                  <span className="text-gray-500 ml-1">({hotel.reviewCount} reviews)</span>
                )}
              </div>
              {hotel.starRating && (
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      className={i < hotel.starRating ? 'text-yellow-400 fill-current' : 'text-gray-300'}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Platform Sources */}
            <div className="mb-4">
              <div className="text-sm text-gray-600 mb-2">Available on:</div>
              <div className="flex gap-2 flex-wrap">
                {hotel.sources && hotel.sources.map((source, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 rounded-full text-xs font-medium border border-blue-200"
                  >
                    {source}
                  </span>
                ))}
              </div>
            </div>

            {/* Amenities */}
            {hotel.amenities && hotel.amenities.length > 0 && (
              <div className="mb-4">
                <div className="text-sm text-gray-600 mb-2">Amenities:</div>
                <div className="flex flex-wrap gap-2">
                  {hotel.amenities.slice(0, 6).map((amenity, index) => (
                    <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                      {amenity}
                    </span>
                  ))}
                  {hotel.amenities.length > 6 && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                      +{hotel.amenities.length - 6} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 mt-4">
              <button className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                View Details
              </button>
              {hotel.bookingUrl && (
                <a
                  href={hotel.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  Book Now <ExternalLink size={16} />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Hotel Search Engine</h1>
            <p className="text-gray-600">Find and compare hotels from multiple booking platforms</p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Search Form */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              {/* Destination */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Destination
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Enter city or hotel name"
                    value={searchParams.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              {/* Check-in */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Check-in
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="date"
                    value={searchParams.checkIn}
                    onChange={(e) => handleInputChange('checkIn', e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              {/* Check-out */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Check-out
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="date"
                    value={searchParams.checkOut}
                    onChange={(e) => handleInputChange('checkOut', e.target.value)}
                    min={searchParams.checkIn || new Date().toISOString().split('T')[0]}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              {/* Guests */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Guests & Rooms
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <select
                      value={searchParams.guests}
                      onChange={(e) => handleInputChange('guests', parseInt(e.target.value))}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    >
                      {[1,2,3,4,5,6,7,8].map(num => (
                        <option key={num} value={num}>{num} Guest{num > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Search Button */}
            <div className="flex gap-4">
              <button
                onClick={searchHotels}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-8 rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all duration-200 font-medium shadow-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Searching Hotels...
                  </>
                ) : (
                  <>
                    <Search size={20} />
                    Search Hotels
                  </>
                )}
              </button>
            </div>

            {/* Search History */}
            {searchHistory.length > 0 && !loading && (
              <div className="mt-4 pt-4 border-t">
                <div className="text-sm text-gray-600 mb-2">Recent searches:</div>
                <div className="flex gap-2 flex-wrap">
                  {searchHistory.map((item, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setSearchParams(prev => ({
                          ...prev,
                          city: item.city,
                          checkIn: item.checkIn,
                          checkOut: item.checkOut
                        }));
                      }}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors"
                    >
                      {item.city} • {new Date(item.checkIn).toLocaleDateString()}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="max-w-4xl mx-auto mb-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
              <div>
                <div className="font-medium text-red-800">Search Failed</div>
                <div className="text-red-700 text-sm">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="max-w-4xl mx-auto mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center justify-center gap-3">
                <Loader2 className="animate-spin text-blue-600" size={24} />
                <div className="text-blue-800">
                  <div className="font-medium">Searching hotels across multiple platforms...</div>
                  <div className="text-sm text-blue-600">This may take 10-15 seconds</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results Header */}
        {hotels.length > 0 && !loading && (
          <div className="max-w-4xl mx-auto mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  Hotels in {searchParams.city}
                </h2>
                <p className="text-gray-600">
                  {totalResults} hotels found • Sorted by relevance
                </p>
              </div>
              <div className="flex gap-2">
                <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option>Sort by: Relevance</option>
                  <option>Price: Low to High</option>
                  <option>Price: High to Low</option>
                  <option>Rating: High to Low</option>
                  <option>Distance</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Hotel Results */}
        {hotels.length > 0 && (
          <div className="max-w-4xl mx-auto">
            <div className="space-y-6">
              {hotels.map((hotel, index) => (
                <HotelCard key={hotel.id || index} hotel={hotel} />
              ))}
            </div>

            {/* Load More */}
            {hotels.length < totalResults && (
              <div className="text-center mt-8">
                <button className="bg-gray-100 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-200 transition-colors font-medium">
                  Load More Hotels ({totalResults - hotels.length} remaining)
                </button>
              </div>
            )}
          </div>
        )}

        {/* No Results */}
        {!loading && hotels.length === 0 && searchParams.city && !error && (
          <div className="max-w-4xl mx-auto text-center py-12">
            <div className="text-gray-400 mb-4">
              <Search size={48} className="mx-auto" />
            </div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No hotels found</h3>
            <p className="text-gray-500">Try adjusting your search criteria or search for a different destination.</p>
          </div>
        )}

        {/* API Status Info */}
        <div className="max-w-4xl mx-auto mt-8">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-blue-600 mt-0.5 flex-shrink-0" size={20} />
              <div>
                <div className="font-semibold text-blue-800 mb-1">API Integration Status</div>
                <div className="text-blue-700 text-sm">
                  This interface is ready for API integration. The backend will fetch real-time data from:
                  <br />• Booking.com (via RapidAPI)
                  <br />• Agoda (web scraping)
                  <br />• Hotels.com (API)
                  <br />• Local hotel databases
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HotelLandingPage;