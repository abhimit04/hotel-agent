// pages/api/hotels/search.js

export default async function handler(req, res) {
  try {
    const { city } = req.query;

    if (!city) {
      return res.status(400).json({ error: "City parameter is required" });
    }

    // Booking.com RapidAPI endpoint
    const url = `https://booking-com.p.rapidapi.com/v1/hotels/locations?name=${encodeURIComponent(
      city
    )}&locale=en-gb`;

    // Step 1: Get city location id
    const locationResp = await fetch(url, {
      headers: {
        "x-rapidapi-host": "booking-com.p.rapidapi.com",
        "x-rapidapi-key": process.env.RAPIDAPI_KEY,
      },
    });
    const locations = await locationResp.json();

    if (!locations?.length) {
      return res.status(404).json({ error: "City not found in Booking.com" });
    }

    const destId = locations[0].dest_id;
    const destType = locations[0].dest_type;

    // Step 2: Search hotels
    const hotelsResp = await fetch(
      `https://booking-com.p.rapidapi.com/v1/hotels/search?checkin_date=2025-09-20&checkout_date=2025-09-21&dest_id=${destId}&dest_type=${destType}&locale=en-gb&adults_number=1&order_by=review_score&room_number=1&units=metric`,
      {
        headers: {
          "x-rapidapi-host": "booking-com.p.rapidapi.com",
          "x-rapidapi-key": process.env.RAPIDAPI_KEY,
        },
      }
    );
    const hotelsData = await hotelsResp.json();

    if (!hotelsData?.result?.length) {
      return res.status(404).json({ error: "No hotels found" });
    }

    // Step 3: Map hotel results
    const hotels = hotelsData.result.map((h) => ({
      id: h.hotel_id,
      name: h.hotel_name,
      address: h.address,
      city: h.city,
      country: h.country_trans,
      rating: h.review_score || "N/A",
      reviewCount: h.review_nr || 0,
      price: h.min_total_price ? `${h.min_total_price} ${h.currency_code}` : "N/A",
      url: h.url,
      photo: h.max_photo_url,
    }));

    return res.status(200).json({ city, hotels });
  } catch (err) {
    console.error("Hotel search error:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
