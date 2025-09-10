// pages/api/hotels/search.js
export default async function handler(req, res) {
  try {
    const { city } = req.query;

    if (!city) {
      return res.status(400).json({ error: "City parameter is required" });
    }

    // Step 1: Geocode city
    const geoResp = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city)}&key=${process.env.GOOGLE_API_KEY}`
    );
    const geoData = await geoResp.json();

    if (!geoData.results?.length) {
      return res.status(404).json({ error: "City not found" });
    }

    const { lat, lng } = geoData.results[0].geometry.location;

    // Step 2: Search for hotels nearby
    const placesResp = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=20000&type=lodging&key=${process.env.GOOGLE_API_KEY}`
    );
    const placesData = await placesResp.json();

    console.log("Places API raw:", JSON.stringify(placesData, null, 2));

    if (!placesData.results?.length) {
      return res.status(404).json({ error: "No hotels found" });
    }

    // Step 3: Map results
    const hotels = placesData.results.map(hotel => ({
      id: hotel.place_id,
      name: hotel.name,
      address: hotel.vicinity,
      rating: hotel.rating || "N/A",
      userRatings: hotel.user_ratings_total || 0,
      priceLevel: hotel.price_level || "N/A",
      location: hotel.geometry.location,
      types: hotel.types || []
    }));

    return res.status(200).json({ city, hotels });
  } catch (err) {
    console.error("Hotel search error:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
