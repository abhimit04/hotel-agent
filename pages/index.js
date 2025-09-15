import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useRouter } from "next/router";

export default function HotelLanding() {
  const [city, setCity] = useState('');
  const [checkin, setCheckin] = useState('');
  const [checkout, setCheckout] = useState('');
  const [geoData, setGeoData] = useState('');
  const [hotels, setHotels] = useState([]);
  const [hotelName, setHotelName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [selectedHotelLoading, setSelectedHotelLoading] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const validateDates = () => {
    if (!checkin || !checkout) {
      setError("Please select check-in and check-out dates.");
      return false;
    }
    if (new Date(checkout) <= new Date(checkin)) {
      setError("Check-out date must be after check-in date.");
      return false;
    }
    return true;
  };

  async function fetchHotelsByCity(cityQuery) {
    if (!cityQuery || !cityQuery.trim()) {
      setError("Please enter a city or locality.");
      return;
    }
    if (!validateDates()) return;

    setLoading(true);
    setError("");
    setHotels([]);
    setSummary("");

    try {
      const res = await fetch(
        `/api/hotels?city=${encodeURIComponent(cityQuery)}&checkin_date=${encodeURIComponent(
          checkin
        )}&checkout_date=${encodeURIComponent(checkout)}`
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error?.message || "Failed to fetch hotels.");
        return;
      }
      if (!data.hotels || data.hotels.length === 0) {
        setError("No hotels found for that location and dates.");
        return;
      }

      setHotels(data.hotels);
      generateAiSummary(data.hotels, cityQuery);
    } catch (err) {
      console.error("fetchHotelsByCity error", err);
      setError("Unable to fetch hotels. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchHotelDetailsByName(nameToSearch) {
    if (!nameToSearch || !nameToSearch.trim()) {
      setError("Please enter a hotel name.");
      return false;
    }
    if (!validateDates()) return false;

//    setSelectedHotelLoading(true);
//    setSelectedHotel(null);
//    setError("");
//    setSummary("");

    try {
//      const res = await fetch(
//        `/api/hotel-details?hotel_name=${encodeURIComponent(
//          nameToSearch
//        )}&checkin_date=${encodeURIComponent(checkin)}&checkout_date=${encodeURIComponent(checkout)}`
//      );
//      const data = await res.json();
//
//      if (!res.ok || data.error || !data.hotel) {
//        console.warn(`[API LOG] No exact hotel match for "${nameToSearch}"`);
//        return false;
//      }
//
//      setSelectedHotel(data.hotel);
//      if (data.summary) setSummary(data.summary);
//      return true;
        // Navigate to details page instead of fetching directly
           router.push({
        pathname: `/hotel/${encodeURIComponent(nameToSearch)}`,
        query: {
        checkin_date: checkin,
        checkout_date: checkout
         }
        });
        return true;
    } catch (err) {
      console.error("fetchHotelDetailsByName error", err);
      setError("Unable to fetch hotel details. Try again.");
      return false;
//    } finally {
//      setSelectedHotelLoading(false);
//    }
     }
  }

  async function detectQueryType(query) {
    try {
      const res = await fetch(`/api/geocode?query=${encodeURIComponent(query)}`);
      if (!res.ok) return { type: "unknown" };

      const data = await res.json();
      // Assuming response looks like: { type: "hotel" | "city" | "locality", name, lat, lon }
      console.log("Geocode response inside index.js:", data);
      return data;
    } catch (err) {
      console.error("detectQueryType error", err);
      return { type: "unknown" };
    }
  }

  // ✅ Main Search Handler — updated to NOT fallback to city if hotel name search fails
  const handleSearch = async () => {
    setError("");
    setHotels([]);
    setSelectedHotel(null);
    setSummary("");

    const query = searchQuery.trim();
    if (!query) {
      setError("Please enter a city, locality, or hotel name.");
      return;
    }

    // ✅ First step: detect what user typed
      const detection = await detectQueryType(query);

      if (detection.type === "hotel") {
        const foundHotel = await fetchHotelDetailsByName(detection.name);
        if (!foundHotel) setError("No hotels available with that name.");
        return;
      }

      if (detection.type === "city" || detection.type === "region" || detection.type === "district" || detection.type === "locality") {
        await fetchHotelsByCity(detection.name);
        return;
      }
    // First try hotel name search
//    const foundHotel = await fetchHotelDetailsByName(query);
//    if (foundHotel) return;

//    // If user specifically entered a hotel name and no match found, STOP here
//    if (hotelName.trim()) {
//      setError("No hotels available with that name for the selected dates.");
//      return;
//    }

    setError("No matching city or hotel found. Please try again.");
    };


  const handleKeyPress = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  const openHotelDetails = async (hotel) => {
    const name = hotel.name || hotel.hotel_name || "";
    await fetchHotelDetailsByName(name);
  };

  const generateAiSummary = async (hotelData, searchCity) => {
    setSummaryLoading(true);
    try {
      // Simulate AI summary generation - replace with your actual API call
      const summaryRes = await fetch('/api/hotel-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotels: hotelData, city: searchCity })
      });

      const summaryData = await summaryRes.json();
      setSummary(summaryData.summary);
    } catch (err) {
      console.error('Error generating AI summary:', err);
      setSummary('Unable to generate AI summary at this time.');
    } finally {
      setSummaryLoading(false);
    }
  };

//  const handleSearch = () => {
//    if (city.trim()) {
//      fetchHotels({ preventDefault: () => {} });
//    }
//  };
//
//  const handleKeyPress = (e) => {
//    if (e.key === 'Enter') {
//      handleSearch();
//    }
//  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full blur-xl animate-pulse"></div>
        <div className="absolute top-1/4 right-20 w-24 h-24 bg-yellow-300 rounded-full blur-lg animate-bounce"></div>
        <div className="absolute bottom-20 left-1/4 w-40 h-40 bg-cyan-300 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute bottom-32 right-1/3 w-20 h-20 bg-pink-300 rounded-full blur-md animate-bounce"></div>
      </div>

      {/* Travel Background Pattern */}
      <div className="absolute inset-0 opacity-10"
           style={{
             backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='white' fill-opacity='0.1'%3E%3Cpath d='M20 20c0 5.5-4.5 10-10 10s-10-4.5-10-10 4.5-10 10-10 10 4.5 10 10zm10 0c0 5.5-4.5 10-10 10s-10-4.5-10-10 4.5-10 10-10 10 4.5 10 10z'/%3E%3C/g%3E%3C/svg%3E")`,
           }}>
      </div>

      <header className="relative z-10 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 backdrop-blur-sm bg-opacity-90 text-white p-8 shadow-2xl border-b border-white border-opacity-20">
        <div className="container mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white bg-opacity-20 rounded-full mb-4 backdrop-blur-sm">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-white to-cyan-200 bg-clip-text text-transparent drop-shadow-lg">
            Hotel Genie
          </h1>
          <p className="text-xl text-cyan-100 font-light">Smart recommendations powered by intelligent automation.</p>
        </div>
      </header>

      <main className="relative z-10 flex-1 p-8 flex flex-col items-center">
        {/* Glassmorphism Search Form */}
        <div className="w-full max-w-lg mb-12">
          <div className="bg-white bg-opacity-20 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white border-opacity-30 transform hover:scale-105 transition-all duration-300">
            <div className="flex flex-col gap-6">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}// use onKeyDown (preferred)
                  placeholder="Enter city, locality, or hotel name"
                  className="w-full p-4 bg-white bg-opacity-90 backdrop-blur-sm border border-white border-opacity-50 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-300 focus:ring-opacity-50 text-gray-800 placeholder-gray-500 shadow-inner transition-all duration-300"
                />

                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <input
                    type="date"
                    value={checkin}
                    onChange={e => setCheckin(e.target.value)}
                    className="w-full p-4 bg-white bg-opacity-90 backdrop-blur-sm border border-white border-opacity-50 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-300 focus:ring-opacity-50 text-gray-800 shadow-inner transition-all duration-300"
                  />
                  <label className="absolute -top-3 left-4 bg-gradient-to-r from-cyan-500 to-teal-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                    Check In
                  </label>
                </div>

                <div className="relative">
                  <input
                    type="date"
                    value={checkout}
                    onChange={e => setCheckout(e.target.value)}
                    className="w-full p-4 bg-white bg-opacity-90 backdrop-blur-sm border border-white border-opacity-50 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-300 focus:ring-opacity-50 text-gray-800 shadow-inner transition-all duration-300"
                  />
                  <label className="absolute -top-3 left-4 bg-gradient-to-r from-cyan-500 to-teal-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                    Check Out
                  </label>
                </div>
              </div>

              <button
                onClick={handleSearch}
                disabled={loading || selectedHotelLoading || !searchQuery.trim()}
                className="relative overflow-hidden bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white p-4 rounded-2xl hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      Searching...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                      Search Hotels
                    </>
                  )}
                </span>

                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 hover:opacity-20 transform -skew-x-12 transition-all duration-700"></div>
              </button>
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {loading && (
          <div className="flex items-center gap-3 bg-white bg-opacity-20 backdrop-blur-xl px-6 py-4 rounded-2xl shadow-xl border border-white border-opacity-30 mb-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-cyan-400 border-t-transparent"></div>
            <p className="text-white font-medium">Finding...</p>
            <p className="text-white font-medium">This might take 15-20 sec depending on API response & AI analysis...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-500 bg-opacity-20 backdrop-blur-xl border border-red-300 border-opacity-50 text-red-100 px-6 py-4 rounded-2xl shadow-xl mb-8">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Hotels Grid */}
        {hotels.length > 0 && (
          <div className="w-full max-w-7xl grid gap-8 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {hotels.map(h => (
              <div
                key={h.id}
                className="group bg-white bg-opacity-15 backdrop-blur-xl p-6 rounded-3xl shadow-2xl border border-white border-opacity-30 hover:bg-opacity-25 transition-all duration-500 transform hover:-translate-y-2 hover:shadow-3xl"
              >
                {/* Top Section */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
                    <span className="text-emerald-300 text-sm font-medium">
                      {hotelName?.trim()
                        ? "Direct Match"
                        : "AI Recommends"}
                    </span>
                  </div>

                  {!hotelName?.trim() && (
                    <div className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-3 py-1 rounded-full text-xs font-bold">
                      TOP RATED
                    </div>
                  )}
                </div>

                {/* Hotel Name */}
                <h3 className="font-bold text-2xl mb-3 text-white group-hover:text-cyan-200 transition-colors duration-300">
                  {h.name}
                </h3>

                {/* Hotel Details */}
                <div className="space-y-3 text-gray-200">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    <p className="text-sm">{h.address}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <p className="font-semibold">
                      Review Score: <span className="text-yellow-300">{h.review_score}</span> ({h.review_count} reviews)
                    </p>
                  </div>

                  {h.agent_score && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="font-semibold">
                        Agent Score: <span className="text-emerald-300">{h.agent_score}</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* CTA */}
                <div className="mt-6 pt-4 border-t border-white border-opacity-20">
                  <button
                    onClick={() =>
                    router.push({
                          pathname: `/hotel/${encodeURIComponent(h.name)}`,
                          query: { checkin_date: checkin, checkout_date: checkout }
                        })
                      }
                    className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 text-white py-3 rounded-xl font-semibold hover:from-cyan-600 hover:to-teal-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                  View Hotel Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* AI Summary Section */}
        {(summaryLoading || summary) && (
          <div className="w-full max-w-7xl mt-16 mb-8">
            <div className="bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 bg-opacity-40 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white border-opacity-20">
              {/* AI Summary Header */}
              <div className="flex items-center gap-4 mb-6 pb-4 border-b border-white border-opacity-20">
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full animate-ping"></div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full"></div>
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white mb-1 bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                    AI Summary
                  </h2>
                  <p className="text-purple-200 text-sm">Intelligent analysis of your hotel search results</p>
                </div>
              </div>

              {/* AI Summary Content */}
              <div className="relative">
                {summaryLoading ? (
                  <div className="flex items-center gap-4 p-6 bg-white bg-opacity-10 rounded-2xl backdrop-blur-sm">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <p className="text-white font-medium">AI is analyzing hotel data to generate personalized insights...</p>
                  </div>
                ) : summary ? (
                  <div className="space-y-4">
                    <div className="bg-white bg-opacity-10 backdrop-blur-sm p-6 rounded-2xl border border-white border-opacity-20">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-center mt-1 flex-shrink-0">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                           <div className="text-white leading-relaxed text-lg font-light prose prose-invert max-w-none">
                           <ReactMarkdown>{summary}</ReactMarkdown>
                           </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-purple-300 text-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Analysis powered by AI • Generated in real-time</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="relative z-10 bg-gradient-to-r from-gray-900 via-slate-800 to-gray-900 backdrop-blur-sm bg-opacity-90 text-white text-center p-6 mt-16 border-t border-white border-opacity-10">
        <div className="container mx-auto">
          <div className="flex items-center justify-center gap-2 mb-2">
            <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
            </svg>
            <span className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
              Hotel Genie
            </span>
          </div>
          <p className="text-gray-300">&copy; 2025 AbhiAi. All rights reserved. | Discover. Book. Explore.</p>
        </div>
      </footer>
    </div>
  );
}