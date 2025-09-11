// pages/api/hotels/search.js

// Import the HotelApiHandler class
import HotelApiHandler from './hotel-api-handler';

export default async function handler(req, res) {
  // Only allow GET requests for a search operation
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // Extract the search parameters from the URL query
  const { destination, checkin, checkout, guests = '2', rooms = '1', platforms } = req.query;

  // Basic validation to ensure required parameters are present
  if (!destination || !checkin || !checkout) {
    return res.status(400).json({ success: false, message: 'Missing required parameters' });
  }

  try {
    // Create an instance of your HotelApiHandler
    const hotelAPI = new HotelApiHandler();

    // Prepare search parameters
    const searchParams = {
      city: destination,
      checkIn: checkin,
      checkOut: checkout,
      guests: parseInt(guests, 10),
      rooms: parseInt(rooms, 10),
      platforms: platforms ? platforms.split(',') : undefined // e.g., "booking,expedia"
    };

    // Call the search method with the extracted parameters
    // Perform hotel search
    const results = await hotelAPI.searchHotels(searchParams);

    // Optionally, compute price comparison
    const hotelsWithPrice = hotelAPI.comparePrice(results.hotels);

    res.status(200).json({
      success: true,
      data: {
        searchId: results.searchId,
        searchParams,
        hotels: hotelsWithPrice,
        platformResults: results.platformResults,
        errors: results.errors
      }
    });

  } catch (error) {
    console.error('API search handler error:', error);
    // Return more detailed error information for debugging
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}