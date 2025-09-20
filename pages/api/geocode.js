// /pages/api/geocode.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: "Query required" });

  try {
    const url = `https://booking-com.p.rapidapi.com/v1/hotels/locations?name=${encodeURIComponent(
      query
    )}&locale=en-gb`;
    const response = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        "X-RapidAPI-Host": "booking-com.p.rapidapi.com",
      },
    });

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(200).json({ type: "unknown" });
    }

    const first = data[0];
    console.log("Geocode result inside geocode.js:", first);

    // Booking.com returns dest_type (city, region, hotel, landmark, etc.)
    return res.status(200).json({
      type: first.dest_type, // "city", "district", "hotel", etc.
      name: first.name || first.label,
      lat: first.latitude,
      lon: first.longitude,
    });
  } catch (error) {
    console.error("geocode API error:", error);
    return res.status(500).json({ type: "unknown" });
  }
}
