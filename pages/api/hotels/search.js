// pages/api/hotels/search.js

// Import the HotelApiHandler class
import HotelApiHandler from '../../../hotel-api-handler';

export default async function handler(req, res) {
  // Only allow GET requests for a search operation
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // Extract the search parameters from the URL query
  const { destination, checkin, checkout, guests, rooms } = req.query;

  // Basic validation to ensure required parameters are present
  if (!destination || !checkin || !checkout) {
    return res.status(400).json({ success: false, message: 'Missing required parameters' });
  }

  try {
    // Create an instance of your HotelApiHandler
    const hotelAPI = new HotelApiHandler();

    // Call the search method with the extracted parameters
    const results = await hotelAPI.searchHotels({
      city: destination,
      checkIn: checkin,
      checkOut: checkout,
      guests: parseInt(guests) || 2,
      rooms: parseInt(rooms) || 1,
    });

    // Send a successful JSON response with the search results
    res.status(200).json({
      success: true,
      data: results
    });

  } catch (error) {
    // If an error occurs, log it and send a 500 status code
    console.error('API search handler error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}