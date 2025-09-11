import fetch from 'node-fetch';
import crypto from 'crypto';
import orderBy from 'lodash/orderBy';

// Environment variables (Vercel injects these automatically)
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
const GEMINI_ENDPOINT = process.env.GEMINI_ENDPOINT || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

function hotelId(h) {
  const key = `${h.name}||${h.address || ''}||${h.latitude || ''}||${h.longitude || ''}`;
  return crypto.createHash('sha1').update(key).digest('hex');
}

function normalizeBookingResponse(json) {
  const list = json.results || [];
  return list.map(item => {
    const name = item.hotel_name || '';
    const address = item.address || '';
    const latitude = item.latitude || null;
    const longitude = item.longitude || null;
    const price = item.price_breakdown && item.price_breakdown.gross_price || null;
    const review_score = Number(item.review_score || item.star_rating || 0);
    const review_count = Number(item.review_count || item.total_reviews || 0);
    const id = hotelId({name,address,latitude,longitude});
    return {id, name, address, latitude, longitude, price, review_score, review_count, raw: item};
  }).filter(h => h.name);
}

async function fetchBookingHotels(city, checkin=null, checkout=null, topN=5) {
  const url = new URL(`https://booking-com.p.rapidapi.com/v1/hotels/search`);
  url.searchParams.set('city_name', city);
  if (checkin) url.searchParams.set('checkin_date', checkin);
  if (checkout) url.searchParams.set('checkout_date', checkout);
  url.searchParams.set('adults_number', '1');
  url.searchParams.set('locale', 'en-us');

  const headers = {
    'X-RapidAPI-Key': RAPIDAPI_KEY,
    'X-RapidAPI-Host': 'booking-com.p.rapidapi.com',
    'Accept': 'application/json'
  };

  try {
    const res = await fetch(url.toString(), { headers });
    if (!res.ok) return [];
    const json = await res.json();
    const hotels = normalizeBookingResponse(json);
    console.log(`Fetched ${hotels.length} hotels from Booking.com for city=${city}`);
    return orderBy(hotels, ['review_score','review_count'], ['desc','desc']).slice(0, topN).map(h => ({...h, source: 'booking-com.p.rapidapi.com'}));
  } catch (err) {
    return [];
  }
}

function dedupeHotels(hotels) {
  const sorted = orderBy(hotels, ['review_score','review_count'], ['desc','desc']);
  const uniq = [];
  const seen = new Set();
  for (const h of sorted) {
    const nameKey = h.name.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const lat = h.latitude ? Number(h.latitude).toFixed(3) : '';
    const lon = h.longitude ? Number(h.longitude).toFixed(3) : '';
    const key = `${nameKey}||${lat}||${lon}`;
    if (!seen.has(key)) { seen.add(key); uniq.push(h); }
  }
  return uniq;
}

function heuristicScore(h) {
  let rs = Number(h.review_score || 0);
  if (rs > 10) rs = rs / 10 * 5;
  let score = (Math.min(rs,10)/10)*70;
  const rc = Math.log10((h.review_count||1)+1);
  score += Math.min(rc/3*30,30);
  return Math.round(score*10)/10;
}

async function rankWithGemini(hotels) {
  return hotels.map(h => ({...h, agent_score: heuristicScore(h)}));
}

export default async function handler(req, res) {
  const city = req.query.city;
  if (!city) return res.status(400).json({ error: 'city param required: ?city=London' });
  const checkin = req.query.checkin || null;
  const checkout = req.query.checkout || null;

  const hotels = await fetchBookingHotels(city, checkin, checkout);
  console.log(`Total hotels fetched before deduplication: ${hotels.length}`);
  if (!hotels.length) return res.status(502).json({ error: 'No data from Booking.com API.' });

  const deduped = dedupeHotels(hotels);
  const withScores = await rankWithGemini(deduped);
  const final = orderBy(withScores, ['agent_score','review_score','review_count'], ['desc','desc','desc']).slice(0,10);

  const out = final.map(h => ({
    id: h.id, name: h.name, address: h.address,
    latitude: h.latitude, longitude: h.longitude, price: h.price,
    review_score: h.review_score, review_count: h.review_count,
    agent_score: h.agent_score
  }));

  res.status(200).json({ city, count: out.length, hotels: out });
}