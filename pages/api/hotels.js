// pages/api/hotel.js
import fetch from "node-fetch";
import orderBy from "lodash/orderBy";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// In-memory cache
const memoryCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 10 minutes

export default async function handler(req, res) {
  const { city, checkin_date, checkout_date } = req.query;

    // ✅ Mandatory field validation
    if (!city || !checkin_date || !checkout_date) {
      return res.status(400).json({ error: "City, check-in, and check-out dates are required" });
    }

    if (new Date(checkout_date) <= new Date(checkin_date)) {
      return res.status(400).json({ error: "Check-out date must be after check-in date" });
    }

  console.log(`[API LOG] Fetching hotels for city: ${city} between ${checkin_date} - ${checkout_date}`);


  try {
    // --- Step 0: Check memory cache first ---
    const cacheKey = `${city.toLowerCase()}_${checkin_date}_${checkout_date}`;
    const now = Date.now();
    if (memoryCache.has(cacheKey)) {
      const cached = memoryCache.get(cacheKey);
      if (now - cached.timestamp < CACHE_TTL) {
        console.log(`[CACHE] Serving hotels for ${city} from memory`);
        return res.status(200).json({ hotels: cached.data });
      } else {
        memoryCache.delete(cacheKey);
      }
    }

    // --- Step 1: Check Supabase cache ---
    const { data: dbCache, error: dbError } = await supabase
      .from("hotel_cache")
      .select("data, created_at")
      .eq("cache_key", cacheKey)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (dbError && dbError.code !== "PGRST116") { // Ignore 'not found' error
          console.error("[DB ERROR] Supabase cache lookup failed:", dbError.message);
      }

    if (dbCache && new Date() - new Date(dbCache.created_at) < CACHE_TTL) {
      console.log(`[CACHE] Serving hotels for ${city} from Supabase`);
      // Store back to memory for faster access next time
      memoryCache.set(cacheKey, { data: dbCache.data, timestamp: now });
      return res.status(200).json({ hotels: dbCache.data });
    }

    // --- Step 2: Fetch fresh data if no cache available ---
    const geoData = await safeFetchGeo(city);
    if (!geoData || !geoData.length) {
      console.warn(`[API LOG] No geocoding result for city: ${city}`);
      return res.status(200).json({
      error: {
            code: "CITY_NOT_FOUND",
            message: "Sorry!! this finder is not configured for region-specific search. Please try specifying a city like Delhi or Mumbai."
          }});
    }

    const { lat, lon } = geoData[0];
    console.log(`[API LOG] City ${city} resolved to coordinates: ${lat}, ${lon}`);

    const [bookingHotels, tripAdvisorHotels, travelAdvisorHotels] = await Promise.allSettled([
      fetchBookingHotels(lat, lon),
      fetchTripAdvisorHotels(city),
      fetchTravelAdvisorHotels(city),
    ]);


    const hotels = [
      ...(bookingHotels.status === "fulfilled" ? bookingHotels.value : []),
      ...(tripAdvisorHotels.status === "fulfilled" ? tripAdvisorHotels.value : []),
      ...(travelAdvisorHotels.status === "fulfilled" ? travelAdvisorHotels.value : []),
    ];

    console.log(`[API LOG] Total hotels collected: ${hotels.length}`);

//    if (hotels.length === 0) {
//          return res.status(200).json({hotels: getDummyHotels(city)});
//        }

        const sortedHotels = orderBy(hotels, ["review_score", "review_count"], ["desc", "desc"]);

         // --- Step 3: Save to cache (memory + supabase) ---
        // memoryCache.set(cacheKey, { data: sortedHotels, timestamp: now });

        //Send to Gemini for rerank --
        let topHotels = sortedHotels.slice(0, 10);

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

            const rerankPrompt = `You are a travel assistant. Rank these hotels in "${city}" by:
            - Review score (highest first)
            - Review count (higher is better)
            - Positive review text (prefer 'Excellent' over 'Good')
        Important: Do not return anything if you get ${hotels.length} as 0.
            Return strictly as JSON:
            {
              "hotels": [ ...top 10 hotels exactly as provided, no extra commentary... ]
            }

            Hotels: ${JSON.stringify(sortedHotels.slice(0, 25))}`;


            try {
              const rerankResult = await model.generateContent(rerankPrompt);
              const rerankText = rerankResult.response.text().trim();
              const jsonMatch = rerankText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.hotels && Array.isArray(parsed.hotels)) {
                  topHotels = parsed.hotels;
                }
              }
            } catch (err) {
              console.warn("[API LOG] Gemini rerank failed, using numeric fallback");
            }

            // --- Step 4: Save to cache (Supabase and memory) ---
              // Await the insert operation to ensure it completes before returning the response
              const { error: insertError } = await supabase
                .from("hotel_cache")
                .insert({
                  cache_key: cacheKey,
                  data: topHotels,
                  created_at: new Date().toISOString(),
                });
             if (insertError) {
                 console.error("[DB ERROR] Failed to save to Supabase cache:", insertError.message);
               } else {
                 console.log(`[CACHE] Successfully saved hotels for ${city} to Supabase`);
               }

            // Store back to memory for faster access next time
              memoryCache.set(cacheKey, { data: topHotels, timestamp: now });

              // --- Step 5: Return the final result ---
              // A single, final return statement is cleaner
              return res.status(200).json({ hotels: topHotels });

            } catch (error) {
              console.error("[API LOG] Unexpected error:", error);
              // Return dummy hotels on any uncaught error
              return res.status(200).json({ hotels: getDummyHotels(city) });
            }
 }

/** Availability Check - Safe */
//async function enrichAvailability(hotels) {
//  if (!Array.isArray(hotels)) return [];
//  return Promise.all(
//    hotels.map(async (hotel) => {
//      try {
//        // Only check Booking.com availability if hotel.id exists
//        if (hotel.id && hotel.name) {
//          const url = `https://booking-com.p.rapidapi.com/v1/hotels/availability?hotel_id=${hotel.id}&checkin_date=2025-09-20&checkout_date=2025-09-21&adults_number=2&currency=INR&locale=en-gb`;
//          const response = await fetch(url, {
//            headers: {
//              "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
//              "X-RapidAPI-Host": "booking-com.p.rapidapi.com",
//            },
//          });
//
//          if (!response.ok) return { ...hotel, available: true }; // fallback
//          const data = await response.json();
//
//          return { ...hotel, available: Array.isArray(data.rooms) ? data.rooms.length > 0 : true };
//        }
//        return { ...hotel, available: true };
//      } catch (err) {
//        console.error(`[API LOG] Availability check failed for ${hotel.name}:`, err);
//        return { ...hotel, available: true };
//      }
//    })
//  );
//}

/** Safe geocoding fetch with error handling */
/** Safe geocoding fetch with error handling */
async function safeFetchGeo(location) {
  try {
    const geoUrl = `https://forward-reverse-geocoding.p.rapidapi.com/v1/search?q=${encodeURIComponent(location)}&format=json&limit=1`;

    const geoResponse = await fetch(geoUrl, {
      headers: {
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        "X-RapidAPI-Host": "forward-reverse-geocoding.p.rapidapi.com",
      },
    });
    if (!geoResponse.ok) {
      console.error(`[API LOG] Geocoding failed with status: ${geoResponse.status}`);
      return null;
    }
    return await geoResponse.json();
    // The search endpoint returns an array of features. We want the first one.
        if (data.length > 0) {
          return data[0];
        }

        return null;
  } catch (err) {
    console.error(`[API LOG] Geocoding request error:`, err);
    return null;
  }
}

async function fetchBookingHotels(lat, lon) {
  try {
    const url = `https://booking-com15.p.rapidapi.com/v1/hotels/search-by-coordinates?dest_type=city&order_by=popularity&filter_by_currency=INR&locale=en-gb&adults_number=1&units=metric&room_number=1&checkin_date=2025-09-20&checkout_date=2025-09-21&latitude=${lat}&longitude=${lon}`;
    const response = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        "X-RapidAPI-Host": "booking-com15.p.rapidapi.com",
      },
    });

    if (!response.ok) {
      console.error(`[API LOG] Booking.com API failed: ${response.status}`);
      return [];
    }

    const json = await response.json();
    console.log("[API LOG] Booking.com raw response:", json);
    console.log(JSON.stringify(json));

    return (json.result || []).map((h) => ({
      id: h.hotel_id,
      name: h.hotel_name || h.name,
      address: h.address || "",
      latitude: h.latitude,
      longitude: h.longitude,
      city : h.city_name_en || h.city,
      price: h.price_breakdown?.gross_price ?? null,
      currency: h.price_breakdown?.currency ?? "INR",
      review_score: Number(h.review_score) || 0,
      review_count: Number(h.review_count) || 0,
      review_text: h.review_score_word || "",
      image_url: h.max_1440_photo || h.main_photo_url || null,
      //available: h.soldout === false || h.soldout === undefined,
    }));
  } catch (err) {
    console.error("[API LOG] Booking.com fetch error:", err);
    return [];
  }
}

async function fetchTripAdvisorHotels(city) {
  try {
    const url = `https://tripadvisor16.p.rapidapi.com/api/v1/hotels/searchLocation?query=${encodeURIComponent(city)}`;
    const response = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        "X-RapidAPI-Host": "tripadvisor16.p.rapidapi.com",
      },
    });

    if (!response.ok) {
      console.error(`[API LOG] TripAdvisor API failed: ${response.status}`);
      return [];
    }

    const json = await response.json();
    return (json.data || []).slice(0, 10).map((h) => ({
      id: h.location_id,
      name: h.name,
      address: h.address || "",
      latitude: h.latitude,
      longitude: h.longitude,
      price: null,
      currency: "INR",
      review_score: Number(h.rating) || 0,
      review_count: Number(h.num_reviews) || 0,
      review_text: "",
      image_url: h.photo?.images?.large?.url || null,
      //available: true,
    }));
  } catch (err) {
    console.error("[API LOG] TripAdvisor fetch error:", err);
    return [];
  }
}

async function fetchTravelAdvisorHotels(city) {
  try {
    const url = `https://travel-advisor.p.rapidapi.com/locations/search?query=${encodeURIComponent(city)}&limit=10&offset=0&lang=en_IN&currency=INR`;
    const response = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        "X-RapidAPI-Host": "travel-advisor.p.rapidapi.com",
      },
    });

    if (!response.ok) {
      console.error(`[API LOG] TravelAdvisor API failed: ${response.status}`);
      return [];
    }

    const json = await response.json();
    return (json.data || [])
      .filter((x) => x.result_type === "lodging")
      .slice(0, 10)
      .map((h) => ({
        id: h.result_object.location_id,
        name: h.result_object.name,
        address: h.result_object.address || "",
        latitude: h.result_object.latitude,
        longitude: h.result_object.longitude,
        price: null,
        currency: "INR",
        review_score: Number(h.result_object.rating) || 0,
        review_count: Number(h.result_object.num_reviews) || 0,
        review_text: "",
        image_url: h.result_object.photo?.images?.large?.url || null,
        //available: true,
      }));
  } catch (err) {
    console.error("[API LOG] TravelAdvisor fetch error:", err);
    return [];
  }
}

function getDummyHotels(city) {
  return [
    {
      id: "dummy1",
      name: `${city} Palace Hotel`,
      address: `Central ${city}`,
      price: 4999,
      currency: "INR",
      review_score: 8.9,
      review_count: 1200,
      image_url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c",
    },
    {
      id: "dummy2",
      name: `${city} Luxury Inn`,
      address: `${city} Downtown`,
      price: 3499,
      currency: "INR",
      review_score: 8.5,
      review_count: 900,
      image_url: "https://images.unsplash.com/photo-1551776235-dde6d4829808",
    },
  ];
  }

