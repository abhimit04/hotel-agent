import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST supported" });
  }

  const { hotels, city } = req.body;
  if (!hotels || !Array.isArray(hotels)) {
    return res.status(400).json({ error: "Hotels array is required" });
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // --- Step 1: Rerank hotels ---
//    const rerankPrompt = `You are a travel assistant. Here is a list of hotels with name, review score, review count, and review text posted by travellers.
//Given these hotels for city "${city}", Analyse them and return ONLY the top 10 ranked by:
//- Review score (higher is better)
//- Review count (more is better)
//- Positive review text (e.g., "Excellent" > "Good")
//
//Return strictly as JSON with this format:
//{
//  "hotels": [ ...top 10 hotels... ]
//}
//
//Hotels: ${JSON.stringify(hotels)}
//`;
//
//    const rerankResult = await model.generateContent(rerankPrompt);
//    const rerankText = rerankResult.response.text().trim();
//
//    let topHotels = hotels.slice(0, 10); // fallback
//    try {
//      // Extract JSON using regex in case Gemini wraps it with text or code blocks
//      const jsonMatch = rerankText.match(/\{[\s\S]*\}/);
//      if (jsonMatch) {
//        const parsed = JSON.parse(jsonMatch[0]);
//        if (parsed.hotels && Array.isArray(parsed.hotels)) {
//          topHotels = parsed.hotels;
//        }
//      } else {
//        console.warn("[API LOG] No JSON found in Gemini response, using fallback");
//      }
//    } catch (err) {
//      console.error("[API LOG] Failed to parse Gemini response JSON:", rerankText);
//    }

    // --- Step 2: Generate summary separately ---
    const summaryPrompt = `You are a travel assistant.
Write a well-formatted summary for the top hotels in "${city}". Focus on cleanliness, location, price, and overall guest experience.
Provide a structured analysis in Markdown format with these sections:
- Begin with a short intro sentence.
- Then list the top 3-5 hotels as bullet points with this style:
 -Hotel Name — short description, key highlight, and rating (if available).
- End with a short closing remark (1 line) encouraging booking.

Hotels: ${JSON.stringify(topHotels)}

Return ONLY the Markdown summary (no JSON, no explanations).`;

    const summaryResult = await model.generateContent(summaryPrompt);
    const summaryText = summaryResult.response.text().trim();

    return res.status(200).json({ summary: summaryText });

  } catch (err) {
    console.error("[API LOG] Gemini rerank/summary failed:", err);
    return res.status(500).json({
      summary: `Top hotels in ${city} selected based on review score & count.`,
    });
  }
}
