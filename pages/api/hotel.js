import fetch from 'node-fetch';
import orderBy from 'lodash/orderBy';
import crypto from 'crypto';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

// Helper to generate unique hotel ID
const getHotelId = ({ name, address, latitude, longitude }) =>
  crypto.createHash('sha1').update(`${name}||${address || ''}||${latitude || ''}||${longitude || ''}`).digest('hex');

// Fetch dest_id for a city
async function fetchDestinationId(city) {
  const url = `https://booking-com.p.rapidapi.com/v1/hotels/locations?name=${encodeURIComponent(city)}&locale=en-us`;

  try {
    const res = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'booking-com.p.rapidapi.com',
      },
    });

    const data = await res.json();
    if (!data.length) {
      console.log('[API LOG] No destination found for city:', city);
      return null;
    }

    // Take first matching destination
    const dest = data[0];
    return { dest_id: dest.dest_id, dest_type: dest.dest_type };

  } catch (err) {
    console.error('[API LOG] Error fetching destination ID:', err);
    return null;
  }
}

// Fetch hotels using dest_id and mandatory parameters
async function fetchHotels(dest_id, dest_type, checkin, checkout, adults = 1, topN = 10) {
  const url = new URL('https://booking-com.p.rapidapi.com/v1/hotels/search');
  url.searchParams.set('dest_id', dest_id);
  url.searchParams.set('dest_type', dest_type);
  url.searchParams.set('checkin_date', checkin);
  url.searchParams.set('checkout_date', checkout);
  url.searchParams.set('adults_number', adults.toString());
  url.searchParams.set('units', 'metric');
  url.searchParams.set('filter_by_currency', 'INR');
  url.searchParams.set('order_by', 'popularity');
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
    console.log('[API LOG] Raw Booking.com search response:', rawText.slice(0, 500), '...');

    if (!res.ok) {
      console.error('[API LOG] Booking.com search API returned error:', res.status);
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
    console.error('[API LOG] Error fetching hotels:', err);
    return [];
  }
}

// API route handler
export default async function handler(req, res) {
  const city = req.query.city;
  if (!city) return res.status(400).json({ error: 'Missing city parameter, use ?city=CityName' });

  console.log('[API LOG] Fetching hotels for city:', city);

  try {
    const destination = await fetchDestinationId(city);
    if (!destination) return res.status(404).json({ error: 'Destination not found for city' });

    // Set check-in/check-out dates (tomorrow and day after)
    const today = new Date();
    const checkin = new Date(today);
    checkin.setDate(today.getDate() + 1);
    const checkout = new Date(today);
    checkout.setDate(today.getDate() + 2);

    const formatDate = date => date.toISOString().split('T')[0];
    const hotels = await fetchHotels(
      destination.dest_id,
      destination.dest_type,
      formatDate(checkin),
      formatDate(checkout)
    );

    if (!hotels.length) return res.status(404).json({ error: 'No hotels found for city' });

    console.log('[API LOG] Fetched hotels count:', hotels.length);
    res.status(200).json({ city, count: hotels.length, hotels });

  } catch (err) {
    console.error('[API LOG] Unhandled error in /api/hotels:', err);
    res.status(500).json({ error: 'Failed to fetch hotels', details: err.message });
  }
}
