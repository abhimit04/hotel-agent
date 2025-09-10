export default async function handler(req, res) {
  try {
    const { city, checkin, checkout, adults = 2, rooms = 1 } = req.query;

    if (!city || !checkin || !checkout) {
      return res.status(400).json({ error: "city, checkin and checkout are required" });
    }

    // 1. Get destinationId from city name
    const locResp = await fetch(
      `https://booking-com.p.rapidapi.com/v1/hotels/locations?name=${encodeURIComponent(city + ", India")}&locale=en-us`,
      {
        headers: {
          "x-rapidapi-host": "booking-com.p.rapidapi.com",
          "x-rapidapi-key": process.env.RAPIDAPI_KEY,
        },
      }
    );

    const locData = await locResp.json();
    if (!locData?.length) {
      return res.status(404).json({ error: "City not found in Booking.com" });
    }

    const destId = locData[0].dest_id;
    const destType = locData[0].dest_type;

    // 2. Search hotels
    const hotelResp = await fetch(
      `https://booking-com.p.rapidapi.com/v1/hotels/search?dest_id=${destId}&dest_type=${destType}&checkin_date=${checkin}&checkout_date=${checkout}&adults_number=${adults}&room_number=${rooms}&order_by=review_score&locale=en-us&filter_by_currency=INR`,
      {
        headers: {
          "x-rapidapi-host": "booking-com.p.rapidapi.com",
          "x-rapidapi-key": process.env.RAPIDAPI_KEY,
        },
      }
    );

    const hotelData = await hotelResp.json();

    if (!hotelData?.result?.length) {
      return res.status(404).json({ error: "No hotels found" });
    }

    const hotels = hotelData.result.map((h) => ({
      id: h.hotel_id,
      name: h.hotel_name,
      address: h.address,
      reviewScore: h.review_score,
      reviewCount: h.review_nr,
      price: h.price_breakdown?.all_inclusive_price,
      currency: h.price_breakdown?.currency,
      photo: h.max_photo_url,
    }));

    return res.status(200).json({ city, hotels });
  } catch (err) {
    console.error("Hotel search error:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
