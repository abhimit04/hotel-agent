/**
 * @fileoverview API endpoint for fetching and summarizing a single hotel.
 * This file demonstrates the backend logic for the new feature.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { getDummyHotelDetails } = require('./dummyData');

// --- Assuming these are your API client functions ---
// In a real app, these would make network calls to external APIs
const fetchHotelByNameFromApi = async (hotelName, city, checkin, checkout) => {
    // --- Step 1: Search for the specific hotel using multiple APIs ---
    // In a real application, you would query multiple hotel APIs here.
    // For this example, we will simulate a successful lookup.
    // Real-world logic would include fuzzy matching, data aggregation, etc.

    console.log(`Searching for hotel "${hotelName}" in ${city} for dates ${checkin} to ${checkout}`);
    const foundHotel = getDummyHotelDetails(hotelName);

    return foundHotel;
};

// --- API Endpoint Handler ---
async function handleHotelDetails(req, res) {
    const { hotel_name, city, checkin_date, checkout_date } = req.query;

    if (!hotel_name || !city || !checkin_date || !checkout_date) {
        return res.status(400).json({ error: { message: "Hotel name, city, and dates are required." } });
    }

    try {
        // Fetch data for the specific hotel
        const hotel = await fetchHotelByNameFromApi(hotel_name, city, checkin_date, checkout_date);

        if (!hotel) {
            return res.status(200).json({ error: { message: `No hotel found with the name "${hotel_name}".` } });
        }

        // --- Step 2: Use Gemini to generate a summary for the single hotel ---
        let summary = '';
        try {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

            const summaryPrompt = `You are a hotel review assistant. Based on the following hotel details and reviews, provide a concise and engaging summary for a traveler. Highlight key features, amenities, and overall vibe.

            Hotel Details:
            - Name: ${hotel.name}
            - Address: ${hotel.address}
            - Review Score: ${hotel.review_score} (${hotel.review_count} reviews)
            - Description: ${hotel.description}
            - Amenities: ${hotel.amenities.join(', ')}

            Return the summary as a single paragraph. Do not use a header or title.`;

            const result = await model.generateContent(summaryPrompt);
            summary = result.response.text().trim();
        } catch (err) {
            console.error("Gemini summary generation failed:", err);
            summary = "AI analysis is currently unavailable. Please check the hotel details below.";
        }

        // --- Step 3: Return the hotel details and summary ---
        return res.status(200).json({
            hotel: hotel,
            summary: summary,
        });

    } catch (err) {
        console.error("Error in hotel-details API handler:", err);
        return res.status(500).json({ error: { message: "Internal server error." } });
    }
}

// In a real Node.js environment, you would export and use this function:
// module.exports = handleHotelDetails;
