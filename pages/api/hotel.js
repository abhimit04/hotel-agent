import fetch from 'node-fetch';
import orderBy from 'lodash/orderBy';
import crypto from 'crypto';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

// Helper to generate unique hotel ID
const getHotelId = ({ name, address, latitude, longitude }) =>
  crypto.createHash('sha1').update(`${name}||${address || ''}||${latitude || ''}||${longitude || ''}`).digest('hex');

// Fetch hotels from Booking.com RapidAPI
async function fetchBookingHotels(city, topN = 10) {
  if (!RAPIDAPI_KEY) throw new Error('RAPIDAPI_KEY not set in environment variables');

  const url = new URL('https://booking-com.p.rapidapi.com/v1/hotels/search');
  url.searchParams.set('city_name', city);
  url.searchParams.set('adults_number', '1');
  url.searchParams.set('locale', 'en-us');

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'booking-com.p.rapidapi.com',
        'Accept': 'application/json',
      },
    });

    const rawText = await res.text();
    console.log('[API LOG] Raw Booking.com API response:', rawText.slice(0, 500), '...'); // log first 500 chars

    if (!res.ok) {
      console.error('[API LOG] Booking.com API returned error status:', res.status);
      return [];
    }

    const json = JSON.parse(rawText);
    const hotels = (json.results || []).map(h => ({
      id: getHotelId(h),
      name: h.hotel_name,
      address: h.address,
      latitude: h.latitude,
      longitude: h.longitude,
      price: h.price_breakdown?.gross_price || null,
      review_score: Number(h.review_score || 0),
      review_count: Number(h.review_count || 0),
    }));

    return orderBy(hotels, ['review_score', 'review_count'], ['desc', 'desc']).slice(0, topN);

  } catch (err) {
    console.error('[API LOG] Error fetching Booking.com hotels:', err);
    return [];
  }
}

// API route handler
export default async function handler(req, res) {
  const city = req.query.city;
  if (!city) {
    console.log('[API LOG] Missing city parameter');
    return res.status(400).json({ error: 'Missing city parameter, use ?city=CityName' });
  }

  console.log('[API LOG] Fetching hotels for city:', city);
  try {
    const hotels = await fetchBookingHotels(city);

    if (!hotels.length) {
      console.log('[API LOG] No hotels found or API returned empty data for city:', city);
      return res.status(404).json({ error: 'No hotels found or API returned empty data' });
    }

    console.log('[API LOG] Fetched hotels count:', hotels.length);
    res.status(200).json({ city, count: hotels.length, hotels });

  } catch (err) {
    console.error('[API LOG] Unhandled error in /api/hotels:', err);
    res.status(500).json({ error: 'Failed to fetch hotels', details: err.message });
  }
}
