import fetch from 'node-fetch';
import orderBy from 'lodash/orderBy';
import crypto from 'crypto';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

// Helper: generate unique hotel ID
const getHotelId = ({ name, address, latitude, longitude }) =>
  crypto.createHash('sha1').update(`${name}||${address || ''}||${latitude || ''}||${longitude || ''}`).digest('hex');

// Fetch top hotels from Booking.com API
async function fetchBookingHotels(city, topN = 5) {
  if (!RAPIDAPI_KEY) throw new Error('RAPIDAPI_KEY not set');

  const url = new URL('https://booking-com.p.rapidapi.com/v1/hotels/search');
  url.searchParams.set('city_name', city);
  url.searchParams.set('adults_number', '1');
  url.searchParams.set('locale', 'en-us');

  const res = await fetch(url.toString(), {
    headers: {
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': 'booking-com.p.rapidapi.com',
      'Accept': 'application/json',
    },
  });

  if (!res.ok) throw new Error(`Booking.com API error: ${res.status}`);
  const json = await res.json();
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
}

// API handler
export default async function handler(req, res) {
  const city = req.query.city;
  if (!city) return res.status(400).json({ error: 'Missing city parameter' });

  try {
    const hotels = await fetchBookingHotels(city, 10);

    if (!hotels.length) return res.status(404).json({ error: 'No hotels found' });

    res.status(200).json({ city, count: hotels.length, hotels });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch hotels', details: err.message });
  }
}
