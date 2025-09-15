import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

export default function HotelDetailsPage() {
  const router = useRouter();
  const { name, checkin_date, checkout_date } = router.query;
  const [hotel, setHotel] = useState(null);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!name) return;
    async function fetchHotelDetails() {
      try {
        const res = await fetch(
          `/api/hotel-details?hotel_name=${encodeURIComponent(name)}&checkin_date=${checkin_date}&checkout_date=${checkout_date}`
        );
        const data = await res.json();
        if (!res.ok || data.error || !data.hotel) {
          setError("No details found for this hotel.");
          return;
        }

        setHotel(data.hotel);
        setSummary(data.summary || "");
      } catch (err) {
        console.error("Error fetching hotel details:", err);
        setError("Failed to load hotel details.");
      } finally {
        setLoading(false);
      }
    }
    fetchHotelDetails();
  }, [name, checkin_date, checkout_date]);

  if (loading)
    return <p className="text-center text-white p-10">Loading hotel details...</p>;
  if (error)
    return <p className="text-center text-red-400 p-10">{error}</p>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-8">
      <div className="max-w-4xl mx-auto bg-white bg-opacity-10 p-6 rounded-3xl shadow-xl">
        {/* Hotel Name */}
        <h1 className="text-3xl font-bold mb-2">{hotel?.name || name}</h1>
        <p className="mb-6 text-gray-300">
          Check-in: {checkin_date || "N/A"} | Check-out: {checkout_date || "N/A"}
        </p>

        {/* Dynamic Hotel Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {Object.entries(hotel)
            .filter(([key]) => key !== "name") // avoid duplicating name
            .map(([key, value]) => (
              <div
                key={key}
                className="bg-black bg-opacity-30 rounded-xl p-4 shadow-md"
              >
                <p className="text-gray-400 text-sm uppercase">{key.replace(/_/g, " ")}</p>
                <p className="text-lg font-medium">
                  {typeof value === "object"
                    ? JSON.stringify(value, null, 2)
                    : value?.toString() || "N/A"}
                </p>
              </div>
            ))}
        </div>

        {/* AI Summary */}
        {summary && (
          <div className="mt-8 bg-black bg-opacity-30 p-6 rounded-xl">
            <h2 className="text-2xl font-semibold mb-4">AI Summary</h2>
            <ReactMarkdown className="prose prose-invert">{summary}</ReactMarkdown>
          </div>
        )}

        {/* External Link */}
        <a
          href={hotel?.source_url || `https://www.google.com/search?q=${encodeURIComponent(name)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-6 bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-3 rounded-xl text-white font-semibold hover:from-emerald-600 hover:to-cyan-600"
        >
          View on {hotel?.source_name || "Google"}
        </a>
      </div>
    </div>
  );
}
