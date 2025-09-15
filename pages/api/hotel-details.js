// pages/api/hotel-details.js
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import orderBy from "lodash/orderBy";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  const { hotel_name, checkin_date, checkout_date } = req.query;

  // ✅ Validate required params
  if (!hotel_name || !checkin_date || !checkout_date) {
    return res.status(400).json({
      error:
        "hotel_name, checkin_date, and checkout_date are required parameters",
    });
  }

  if (new Date(checkout_date) <= new Date(checkin_date)) {
    return res
      .status(400)
      .json({ error: "Check-out date must be after check-in date" });
  }

  console.log(
    `[API LOG] Fetching hotel details for: ${hotel_name} between ${checkin_date} - ${checkout_date}`
  );

  try {
    // --- Step 1: Try cache first (Supabase) ---
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

    // --- Step 2: Fetch hotels from your existing APIs ---
    const [bookingHotels, tripAdvisorHotels, travelAdvisorHotels] =
      await Promise.allSettled([
        fetchBookingHotelsByName(hotel_name, checkin_date, checkout_date),
        fetchTripAdvisorHotelsByName(hotel_name),
        fetchTravelAdvisorHotelsByName(hotel_name),
      ]);

    let hotels = [
      ...(bookingHotels.status === "fulfilled" ? bookingHotels.value : []),
      ...(tripAdvisorHotels.status === "fulfilled"
        ? tripAdvisorHotels.value
        : []),
      ...(travelAdvisorHotels.status === "fulfilled"
        ? travelAdvisorHotels.value
        : []),
    ];

    if (!hotels || hotels.length === 0) {
      console.warn(`[API LOG] No results found for: ${hotel_name}`);
      return res.status(404).json({
        error: `No results found for "${hotel_name}"`,
      });
    }

    // --- Step 3: Sort and take the most relevant match ---
    const sortedHotels = orderBy(hotels, ["review_score", "review_count"], [
      "desc",
      "desc",
    ]);

    let matchedHotel = sortedHotels[0];

    // --- Step 4: Optional AI enrichment with Gemini ---
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const summaryPrompt = `You are a travel assistant. Summarize this hotel:
      - Name: ${matchedHotel.name}
      - Address: ${matchedHotel.address}
      - Review Score: ${matchedHotel.review_score}
      - Review Count: ${matchedHotel.review_count}
      - Description: ${matchedHotel.review_text}

      Write a 3-4 sentence engaging summary that highlights its best features (cleanliness, location, value, guest reviews).
      Return only the summary text, no JSON, no code.`;

      const aiResult = await model.generateContent(summaryPrompt);
      matchedHotel.ai_summary = aiResult.response.text().trim();
    } catch (err) {
      console.warn("[API LOG] Gemini AI enrichment failed, skipping summary");
    }

    // --- Step 5: Save to cache ---
    await supabase.from("hotel_cache").insert({
      cache_key: cacheKey,
      data: matchedHotel,
      created_at: new Date().toISOString(),
    });

    return res.status(200).json({ hotel: matchedHotel });
  } catch (error) {
    console.error("[API LOG] Unexpected error in hotel-details:", error);
    return res
      .status(500)
      .json({ error: "Internal server error while fetching hotel details" });
  }
}

// --- Helper functions for name-based searches ---
async function fetchBookingHotelsByName(name, checkin, checkout) {
  try {
    const url = `https://booking-com.p.rapidapi.com/v1/hotels/locations?name=${encodeURIComponent(
      name
    )}&locale=en-gb`;
    const response = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        "X-RapidAPI-Host": "booking-com.p.rapidapi.com",
      },
    });

    if (!response.ok) return [];

    const json = await response.json();

    return json
      .map((h) => ({
        id: h.dest_id,
        name: h.label,
        address: h.city_name,
        review_score: Number(h.review_score) || 0,
        review_count: Number(h.review_count) || 0,
        image_url: h.image_url || null,
      }))
      .filter((h) =>
        h.name.toLowerCase().includes(name.toLowerCase())
      );
  } catch (err) {
    console.error("[API LOG] Booking.com name search error:", err);
    return [];
  }
}

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
      id: h.location_id,
      name: h.name,
      address: h.address,
      review_score: Number(h.rating) || 0,
      review_count: Number(h.num_reviews) || 0,
      image_url: h.photo?.images?.large?.url || null,
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
        id: h.result_object.location_id,
        name: h.result_object.name,
        address: h.result_object.address,
        review_score: Number(h.result_object.rating) || 0,
        review_count: Number(h.result_object.num_reviews) || 0,
        image_url: h.result_object.photo?.images?.large?.url || null,
      }));
  } catch (err) {
    console.error("[API LOG] TravelAdvisor name search error:", err);
    return [];
  }
}
