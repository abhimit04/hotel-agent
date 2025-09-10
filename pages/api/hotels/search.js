// pages/api/hotels/search.js

export default async function handler(req, res) {
  try {
    const { city } = req.query;
    if (!city) {
      return res.status(400).json({ error: "City parameter is required" });
    }

    // 1. Get destinationId from Booking.com locations
    let locResp = await fetch(
      `https://booking-com.p.rapidapi.com/v1/hotels/locations?name=${encodeURIComponent(
        city
      )}&locale=en-us`,
      {
        headers: {
          "x-rapidapi-host": "booking-com.p.rapidapi.com",
          "x-rapidapi-key": process.env.RAPIDAPI_KEY,
        },
      }
    );

    let locData = await locResp.json();

    // fallback if no results
    if (!locData?.length) {
      locResp = await fetch(
        `https://booking-com.p.rapidapi.com/v1/hotels/locations?name=${encodeURIComponent(
          city + ", India"
        )}&locale=en-us`,
        {
          headers: {
            "x-rapidapi-host": "booking-com.p.rapidapi.com",
            "x-rapidapi-key": process.env.RAPIDAPI_KEY,
          },
        }
      );
      locData = await locResp.json();
    }

    if (!locData?.length) {
      return res.status(404).json({ error: "City not found in Booking.com" });
    }

    const destId = locData[0].dest_id;
    const destType = locData[0].dest_type;

    if (!destId || !destType) {
      return res.status(500).json({ error: "Invalid destination data" });
    }

    // 2. Dates (tomorrow -> day after tomorrow)
    const today = new Date();
    const checkinDate = new Date(today);
    checkinDate.setDate(today.getDate() + 1);
    const checkoutDate = new Date(today);
    checkoutDate.setDate(today.getDate() + 2);

    const formatDate = (d) => d.toISOString().split("T")[0];

    // 3. Search hotels
    const hotelResp = await fetch(
      `https://booking-com.p.rapidapi.com/v1/hotels/search?dest_id=${destId}&dest_type=${destType}&order_by=review_score&checkin_date=${formatDate(
        checkinDate
      )}&checkout_date=${formatDate(
        checkoutDate
      )}&adults_number=2&locale=en-us&filter_by_currency=INR&units=metric`,
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

    // 4. Map hotels
    const hotels = hotelData.result.map((h) => ({
      id: h.hotel_id,
      name: h.hotel_name,
      address: h.address,
      reviewScore: h.review_score ?? "N/A",
      reviewCount: h.review_nr ?? 0,
      price: h.price_breakdown?.all_inclusive_price ?? "N/A",
      currency: h.price_breakdown?.currency ?? "INR",
      photo: h.max_photo_url ?? null,
    }));

    return res.status(200).json({ city, hotels });
  } catch (err) {
    console.error("Hotel search error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
