// pages/api/hotel.js
import fetch from "node-fetch";
import orderBy from "lodash/orderBy";

export default async function handler(req, res) {
  const { city } = req.query;

  if (!city) {
    return res.status(400).json({ error: "City parameter is required" });
  }

  console.log(`[API LOG] Fetching hotels for city: ${city}`);

  try {
    // --- Step 1: Fetch from Booking.com API ---
    const url = `https://booking-com.p.rapidapi.com/v1/hotels/search-by-coordinates?dest_type=city&order_by=popularity&filter_by_currency=INR&locale=en-gb&adults_number=1&units=metric&room_number=1&checkin_date=2025-09-20&checkout_date=2025-09-21&latitude=28.6139&longitude=77.2090`;

    const response = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        "X-RapidAPI-Host": "booking-com.p.rapidapi.com",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API LOG] Booking.com API returned error status: ${response.status}`);
      console.error(`[API LOG] Error body: ${errorText}`);
      return res.status(500).json({ error: "Failed to fetch hotels" });
    }

    const json = await response.json();
    console.log("[API LOG] Raw Booking.com search response keys:", Object.keys(json));

    // --- Step 2: Validate result key ---
    const results = json.result || json.results || [];
    console.log(`[API LOG] Total hotels received: ${results.length}`);

    if (results.length === 0) {
      return res.status(200).json({ hotels: [], message: "No hotels found" });
    }

    // Debug first 3 hotels before filtering
    console.log("[API LOG] First 3 raw hotels:", JSON.stringify(results.slice(0, 3), null, 2));

    // --- Step 3: Transform data safely ---
    const mappedHotels = results.map(h => ({
      id: h.hotel_id,
      name: h.hotel_name || h.name,
      address: h.address || h.address_trans || "",
      latitude: h.latitude,
      longitude: h.longitude,
      price: h.price_breakdown?.gross_price ?? null,
      currency: h.price_breakdown?.currency ?? "INR",
      review_score: Number(h.review_score) || 0,
      review_count: Number(h.review_count) || 0,
      image_url: h.max_1440_photo || h.main_photo_url || null,
    }));

    // --- Step 4: Sort by review score + review count ---
    const sortedHotels = orderBy(mappedHotels, ["review_score", "review_count"], ["desc", "desc"]);

    // --- Step 5: Return top 10 hotels ---
    const topHotels = sortedHotels.slice(0, 10);
    console.log(`[API LOG] Returning ${topHotels.length} top hotels to frontend`);

    return res.status(200).json({ hotels: topHotels });

  } catch (error) {
    console.error("[API LOG] Unexpected error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
