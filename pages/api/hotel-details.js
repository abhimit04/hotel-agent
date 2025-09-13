/**
 * @fileoverview API endpoint for fetching and summarizing a single hotel.
 * This file demonstrates the backend logic for the new feature.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { getDummyHotelDetails } = require('./dummyData');

// --- Step 1: Simulate third-party API clients ---
// In a real application, these functions would make network requests to external APIs.
// For this example, we return a mock hotel object.

const bookingHotels = async (hotelName, city, checkin, checkout) => {
    console.log(`Searching Booking.com for "${hotelName}"`);
    return new Promise(resolve => {
        setTimeout(() => {
            const data = getDummyHotelDetails(hotelName);
            if (data) {
                resolve({
                    ...data,
                    source: 'Booking.com',
                    url: `https://www.booking.com/search?q=${encodeURIComponent(hotelName)}`,
                });
            } else {
                resolve(null);
            }
        }, 500); // Simulate network delay
    });
};

const tripAdvisorHotels = async (hotelName, city, checkin, checkout) => {
    console.log(`Searching TripAdvisor for "${hotelName}"`);
    return new Promise(resolve => {
        setTimeout(() => {
            const data = getDummyHotelDetails(hotelName);
            if (data) {
                resolve({
                    ...data,
                    source: 'TripAdvisor',
                    url: `https://www.tripadvisor.com/search?q=${encodeURIComponent(hotelName)}`,
                });
            } else {
                resolve(null);
            }
        }, 700);
    });
};

const travelAdvisorHotels = async (hotelName, city, checkin, checkout) => {
    console.log(`Searching TravelAdvisor for "${hotelName}"`);
    return new Promise(resolve => {
        setTimeout(() => {
            const data = getDummyHotelDetails(hotelName);
            if (data) {
                resolve({
                    ...data,
                    source: 'TravelAdvisor',
                    url: `https://www.traveladvisor.com/search?q=${encodeURIComponent(hotelName)}`,
                });
            } else {
                resolve(null);
            }
        }, 600);
    });
};

// --- Step 2: Search and aggregate data from multiple APIs ---
const fetchHotelByNameFromApi = async (hotelName, city, checkin, checkout) => {
    // Run all API calls in parallel to speed up the process.
    const results = await Promise.allSettled([
        bookingHotels(hotelName, city, checkin, checkout),
        tripAdvisorHotels(hotelName, city, checkin, checkout),
        travelAdvisorHotels(hotelName, city, checkin, checkout),
    ]);

    let mergedHotel = null;

    // Aggregate data from successful API calls
    results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
            const hotelData = result.value;
            if (!mergedHotel) {
                mergedHotel = {
                    ...hotelData,
                    sources: [{ name: hotelData.source, url: hotelData.url }]
                };
            } else {
                // Merge data from other sources.
                // This is a simple merge; a real-world app would have more complex logic
                // to handle conflicting data (e.g., different review scores).
                mergedHotel.sources.push({ name: hotelData.source, url: hotelData.url });
                if (hotelData.review_score && hotelData.review_count) {
                    const totalReviews = mergedHotel.review_count + hotelData.review_count;
                    if (totalReviews > 0) {
                        mergedHotel.review_score = (
                            (mergedHotel.review_score * mergedHotel.review_count) +
                            (hotelData.review_score * hotelData.review_count)
                        ) / totalReviews;
                        mergedHotel.review_count = totalReviews;
                    }
                }
            }
        }
    });

    return mergedHotel;
};

// --- API Endpoint Handler ---
async function handleHotelDetails(req, res) {
    const { hotel_name, city, checkin_date, checkout_date } = req.query;

    if (!hotel_name || !city || !checkin_date || !checkout_date) {
        return res.status(400).json({ error: { message: "Hotel name, city, and dates are required." } });
    }

    try {
        // Fetch data for the specific hotel from multiple sources
        const hotel = await fetchHotelByNameFromApi(hotel_name, city, checkin_date, checkout_date);

        if (!hotel) {
            return res.status(200).json({ error: { message: `No hotel found with the name "${hotel_name}".` } });
        }

        // --- Step 3: Use Gemini to generate a summary for the single hotel ---
        let summary = '';
        try {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

            // Create a detailed prompt with the collated data
            const summaryPrompt = `You are a hotel review assistant. Based on the following hotel details and reviews, provide a concise and engaging summary for a traveler. Highlight key features, amenities, and overall vibe.

            Hotel Details:
            - Name: ${hotel.name}
            - Address: ${hotel.address}
            - Review Score: ${hotel.review_score ? hotel.review_score.toFixed(1) : 'N/A'} (${hotel.review_count} reviews)
            - Description: ${hotel.description || 'No description available.'}
            - Amenities: ${hotel.amenities.join(', ') || 'No amenities listed.'}
            - Sources: ${hotel.sources.map(s => s.name).join(', ')}

            Return the summary as a single paragraph. Do not use a header or title.`;

            const result = await model.generateContent(summaryPrompt);
            summary = result.response.text().trim();
        } catch (err) {
            console.error("Gemini summary generation failed:", err);
            summary = "AI analysis is currently unavailable. Please check the hotel details below.";
        }

        // --- Step 4: Return the hotel details and summary ---
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
