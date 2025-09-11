// pages/api/hotel.js
import fetch from "node-fetch";
import orderBy from "lodash/orderBy";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  const { city } = req.query;

  if (!city) {
    return res.status(400).json({ error: "City parameter is required" });
  }

  console.log(`[API LOG] Fetching hotels for city: ${city}`);

  try {
    // --- Step 1: Geocode city to get coordinates ---
    const geoUrl = `https://forward-reverse-geocoding.p.rapidapi.com/v1/forward?city=${encodeURIComponent(
      city
    )}&format=json&limit=1`;

    const geoResponse = await fetch(geoUrl, {
      headers: {
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        "X-RapidAPI-Host": "forward-reverse-geocoding.p.rapidapi.com",
      },
    });

    if (!geoResponse.ok) {
      console.error(`[API LOG] Geocoding failed: ${geoResponse.status}`);
      return res
        .status(200)
        .json({ hotels: getDummyHotels(city), summary: `Fallback data used for ${city}` });
    }

    const geoData = await geoResponse.json();
    if (!geoData.length) {
      console.warn(`[API LOG] No geocoding result for city: ${city}`);
      return res
        .status(200)
        .json({ hotels: getDummyHotels(city), summary: `Fallback data used for ${city}` });
    }

    const { lat, lon } = geoData[0];
    console.log(`[API LOG] City ${city} resolved to coordinates: ${lat}, ${lon}`);

    // --- Step 2: Fetch hotels from Booking.com API ---
    const url = `https://booking-com.p.rapidapi.com/v1/hotels/search-by-coordinates?dest_type=city&order_by=popularity&filter_by_currency=INR&locale=en-gb&adults_number=1&units=metric&room_number=1&checkin_date=2025-09-20&checkout_date=2025-09-21&latitude=${lat}&longitude=${lon}`;

    const response = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        "X-RapidAPI-Host": "booking-com.p.rapidapi.com",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API LOG] Booking.com API returned error: ${response.status}`);
      console.error(`[API LOG] Error body: ${errorText}`);
      return res
        .status(200)
        .json({ hotels: getDummyHotels(city), summary: `Booking API failed, fallback used` });
    }

    const json = await response.json();
    const results = json.result || json.results || [];
    console.log(`[API LOG] Total hotels received: ${results.length}`);

    if (results.length === 0) {
      return res
        .status(200)
        .json({ hotels: getDummyHotels(city), summary: `No hotels found, fallback used` });
    }

    // --- Step 3: Map and sort ---
    const mappedHotels = results.map((h) => ({
      id: h.hotel_id,
      name: h.hotel_name || h.name,
      address: h.address || h.address_trans || "",
      latitude: h.latitude,
      longitude: h.longitude,
      price: h.price_breakdown?.gross_price ?? null,
      currency: h.price_breakdown?.currency ?? "INR",
      review_score: Number(h.review_score) || 0,
      review_count: Number(h.review_count) || 0,
      review_text: h.review_score_word || "",
      image_url: h.max_1440_photo || h.main_photo_url || null,
    }));

    const sortedHotels = orderBy(mappedHotels, ["review_score", "review_count"], ["desc", "desc"]);

    // --- Step 4: AI Rerank + Summary ---
//    const aiResult = await rerankAndSummarizeWithGemini(sortedHotels.slice(0, 20), city);
//
//    return res.status(200).json({
//      hotels: aiResult.hotels,
//      summary: aiResult.summary,
//    });
//  } catch (error) {
//    console.error("[API LOG] Unexpected error:", error);
//    return res.status(200).json({
//      hotels: getDummyHotels(city),
//      summary: `Internal error, fallback data used`,
//    });
//  }
//}




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
}
