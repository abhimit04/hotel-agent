// pages/api/hotel-details.js
// pages/api/hotel-details.js
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import orderBy from "lodash/orderBy";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function safeFetchGeo(location) {
  try {
    const geoUrl = `https://forward-reverse-geocoding.p.rapidapi.com/v1/search?q=${encodeURIComponent(
      location
    )}&format=json&limit=1`;
    const geoResponse = await fetch(geoUrl, {
      headers: {
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        "X-RapidAPI-Host": "forward-reverse-geocoding.p.rapidapi.com",
      },
    });
    if (!geoResponse.ok) return null;
    const data = await geoResponse.json();
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch (err) {
    console.error("[API LOG] Geocoding error:", err);
    return null;
  }
}

export default async function handler(req, res) {
  const { hotel_name, checkin_date, checkout_date, location } = req.query;

  console.log("API Query Params:", { hotel_name, checkin_date, checkout_date, location });

  if (!hotel_name || !checkin_date || !checkout_date) {
    return res.status(400).json({
      error: "hotel_name, checkin_date, and checkout_date are required parameters",
    });
  }

  if (new Date(checkout_date) <= new Date(checkin_date)) {
    return res.status(400).json({ error: "Check-out date must be after check-in date" });
  }

  console.log(`[API LOG] Fetching hotel details for: ${hotel_name}`);

  try {
    // --- Step 1: Cache check ---
    const cacheKey = `${hotel_name.toLowerCase()}_${checkin_date}_${checkout_date}`;
    const { data: dbCache, error: dbError } = await supabase
      .from("hotel_cache")
      .select("data, created_at")
      .eq("cache_key", cacheKey)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (dbError && dbError.code !== "PGRST116") {
      console.error("[DB ERROR] Supabase cache lookup failed:", dbError.message);
    }

    if (dbCache) {
      console.log(`[CACHE] Serving hotel details for ${hotel_name} from Supabase`);
      return res.status(200).json({ hotel: dbCache.data });
    }

    // --- Step 2: Geocode to get lat/lon (only for better match) ---
    const geo = await safeFetchGeo(hotel_name);
    let lat = geo?.lat;
    let lon = geo?.lon;

    if (geo) {
      console.log(`[API LOG] Geocoded "${hotel_name}" → lat:${lat}, lon:${lon}`);
    }

    // --- Step 3: Fetch from all hotel APIs (STRICT mode: no fallback to city search) ---
    const [bookingHotels, tripAdvisorHotels, travelAdvisorHotels] = await Promise.allSettled([
      fetchBookingHotelsByName(hotel_name, checkin_date, checkout_date, lat, lon,location),
      fetchTripAdvisorHotelsByName(hotel_name,location),
      fetchTravelAdvisorHotelsByName(hotel_name,location),
    ]);
    console.log("[API LOG] Fetched hotel data from APIs");


    let hotels = [
      ...(bookingHotels.status === "fulfilled" ? bookingHotels.value : []),
      ...(tripAdvisorHotels.status === "fulfilled" ? tripAdvisorHotels.value : []),
      ...(travelAdvisorHotels.status === "fulfilled" ? travelAdvisorHotels.value : []),
    ];

    // ✅ STRICT MODE: if no hotels found, return immediately — no city fallback
    const exactMatches = hotels.filter(
      h => h.name?.toLowerCase().includes(hotel_name.toLowerCase()) &&
           (!location || h.city?.toLowerCase() === location.toLowerCase())
    );

    let matchedHotel;
    if (exactMatches.length > 0) {
      // If multiple exact matches, pick highest review score
      matchedHotel = exactMatches.sort((a, b) => b.review_score - a.review_score)[0];
    } else {
      // Fallback: highest score among all hotels
      matchedHotel = hotels.sort((a, b) => b.review_score - a.review_score)[0];
    }


    // Fetch room details if from Booking.com
    const rooms = await fetchHotelRooms(matchedHotel.id, checkin_date, checkout_date);
    matchedHotel.rooms = rooms;
    console.log(`[API LOG] Selected hotel: ${matchedHotel.name} with ${rooms.length} room types`);

    // --- Step 5: AI summary enrichment ---
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const roomList = rooms.map(r => `${r.room_name}: ${r.price} ${r.currency}`).join("\n");


      const summaryPrompt = `You are a travel assistant. Summarize this hotel:
      Name: ${matchedHotel.name}
      Address: ${matchedHotel.address}
      Review Score: ${matchedHotel.review_score}
      Review Count: ${matchedHotel.review_count}
      Description: ${matchedHotel.review_text}
      Available rooms and pricing:
      ${roomList}

      Write a well-formatted 3-4 sentence engaging summary for the hotel highlighting cleanliness (room and toilet), location, price, room service, food and overall guest experience.
      Provide a structured analysis in Markdown format with these sections:
      - Begin with a short intro sentence.
      - Then list location,amenities, room-service.
      - Then Focus on types of room available and prices.
      - List down 2-3 customer feedbacks.
      - End with a short closing remark (1 line) encouraging booking.

//      Write a 3-4 sentence engaging summary .
//      Also provide the types of room available and prices. Insight on the typical guest profile (e.g., business, family, couples) is a plus.
      //Provide an insight about the month when this is in demand and when it tapers off.

      Return ONLY the Markdown summary (no JSON, no explanations).`;


      const aiResult = await model.generateContent(summaryPrompt);
      matchedHotel.ai_summary = aiResult.response.text().trim();
    } catch (err) {
      console.warn("[API LOG] Gemini AI enrichment failed, skipping summary");
    }

    // --- Step 6: Cache result ---
    await supabase.from("hotel_cache").insert({
      cache_key: cacheKey,
      data: matchedHotel,
      created_at: new Date().toISOString(),
    });

    return res.status(200).json({ hotel: matchedHotel });
  } catch (error) {
    console.error("[API LOG] Unexpected error in hotel-details:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// --- Helper functions unchanged, except Booking uses lat/lon if available ---
async function fetchBookingHotelsByName(name, checkin, checkout, lat, lon, location) {
  try {
    let url = `https://booking-com.p.rapidapi.com/v1/hotels/locations?name=${encodeURIComponent(name)}&locale=en-gb`;

    if (lat && lon) url += `&latitude=${lat}&longitude=${lon}`;

    const response = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        "X-RapidAPI-Host": "booking-com.p.rapidapi.com",
      },
    });

    if (!response.ok) return [];

    const json = await response.json();
    console.log("Booking.com raw data:", json);

    const filtered = json
      .map((h) => ({
        name: h.label,
        label: h.label,
        address: h.label,
        city: h.city_name,
        review_score: Number(h.review_score) || 0,
      }))
      .filter((h) => {
        const nameMatch = h.name?.toLowerCase().includes(name.toLowerCase());

        console.log(`Name match for "${h.name}":`, nameMatch);

        const locationMatch = location
                                  ? h.city?.toLowerCase() === location.toLowerCase() ||
                                    h.label?.toLowerCase().includes(location.toLowerCase())
                                  : true;

        console.log(`Location match for "${h.label}":`, locationMatch);
        return nameMatch && locationMatch;
      });

    console.log("Filtered Booking.com hotels:", filtered);
    return filtered;
  } catch (err) {
    console.error("[API LOG] Booking.com name search error:", err);
    return [];
  }
}
// fetching roomdetails from booking.com
async function fetchHotelRooms(hotelId, checkin, checkout) {
  try {
    const url = `https://booking-com.p.rapidapi.com/v1/hotels/room-list?hotel_id=${hotelId}&checkin_date=${checkin}&checkout_date=${checkout}&adults_number=2&locale=en-gb&currency=USD`;
    const response = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        "X-RapidAPI-Host": "booking-com.p.rapidapi.com",
      },
    });

    if (!response.ok) return [];
    const json = await response.json();

    return json.map((room) => ({
      room_name: room.name,
      room_description: room.description,
      price: room.price_breakdown?.gross_price || null,
      currency: room.price_breakdown?.currency || "INR",
      max_occupancy: room.max_occupancy || null,
      photos: room.photos?.map((p) => p.url_max) || [],
    }));
  } catch (err) {
    console.error("[API LOG] Booking.com room list error:", err);
    return [];
  }
}


// TripAdvisor & TravelAdvisor functions remain the same.


// TripAdvisor + TravelAdvisor helpers remain unchanged

async function fetchTripAdvisorHotelsByName(name) {
  try {
    const url = `https://tripadvisor16.p.rapidapi.com/api/v1/hotels/searchLocation?query=${encodeURIComponent(
      name
    )}`;
    const response = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        "X-RapidAPI-Host": "tripadvisor16.p.rapidapi.com",
      },
    });

    if (!response.ok) return [];

    const json = await response.json();

    return (json.data || []).map((h) => ({
      //id: h.location_id,
      name: h.name,
      address: h.address,
      review_score: Number(h.rating) || 0,
      //review_count: Number(h.num_reviews) || 0,
      //image_url: h.photo?.images?.large?.url || null,
    }));
  } catch (err) {
    console.error("[API LOG] TripAdvisor name search error:", err);
    return [];
  }
}

async function fetchTravelAdvisorHotelsByName(name) {
  try {
    const url = `https://travel-advisor.p.rapidapi.com/locations/search?query=${encodeURIComponent(
      name
    )}&limit=3&lang=en_IN&currency=INR`;
    const response = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        "X-RapidAPI-Host": "travel-advisor.p.rapidapi.com",
      },
    });

    if (!response.ok) return [];

    const json = await response.json();

    return (json.data || [])
      .filter((x) => x.result_type === "lodging")
      .map((h) => ({
        //id: h.result_object.location_id,
        name: h.result_object.name,
        address: h.result_object.address,
        review_score: Number(h.result_object.rating) || 0,
        //review_count: Number(h.result_object.num_reviews) || 0,
        //image_url: h.result_object.photo?.images?.large?.url || null,\
      }));
  } catch (err) {
    console.error("[API LOG] TravelAdvisor name search error:", err);
    return [];
  }
}
