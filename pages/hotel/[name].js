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
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-cyan-400 border-t-transparent mb-4"></div>
          <p className="text-white text-xl font-light">Loading hotel details...</p>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 flex items-center justify-center">
        <div className="text-center bg-red-500 bg-opacity-20 backdrop-blur-xl p-8 rounded-3xl border border-red-300 border-opacity-30">
          <svg
            className="w-16 h-16 text-red-400 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-red-100 text-xl">{error}</p>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Luxury Hotel Lobby Background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url("https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1932&q=80")`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-slate-900/85 to-black/90"></div>
      </div>

      {/* Animated Background Elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-20 w-32 h-32 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/3 right-32 w-24 h-24 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-full blur-2xl animate-bounce"></div>
        <div className="absolute bottom-32 left-1/4 w-40 h-40 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-1/3 w-28 h-28 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full blur-2xl animate-bounce"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen p-8">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-8 group flex items-center gap-3 bg-white bg-opacity-10 backdrop-blur-xl px-6 py-3 rounded-2xl border border-white border-opacity-20 text-white hover:bg-opacity-20 transition-all duration-300"
        >
          <svg
            className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Search
        </button>

        <div className="max-w-6xl mx-auto">
          {/* Hotel Header Card */}
          <div className="bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-2xl p-8 rounded-3xl shadow-2xl border border-white border-opacity-20 mb-8 transform hover:scale-[1.01] transition-all duration-500">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-4 h-4 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full animate-pulse"></div>
                </div>
                <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-white via-cyan-200 to-emerald-200 bg-clip-text text-transparent">
                  {hotel?.name || name}
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-gray-200">
              <div className="flex items-center gap-2 bg-black bg-opacity-30 px-4 py-2 rounded-xl backdrop-blur-sm">
                <svg
                  className="w-5 h-5 text-cyan-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span className="font-medium">
                  Check-in: {checkin_date || "N/A"}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-black bg-opacity-30 px-4 py-2 rounded-xl backdrop-blur-sm">
                <svg
                  className="w-5 h-5 text-pink-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span className="font-medium">
                  Check-out: {checkout_date || "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Hotel Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {Object.entries(hotel)
              .filter(([key]) => key !== "name")
              .map(([key, value], index) => (
                <div
                  key={key}
                  className="group bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white border-opacity-20 hover:border-opacity-40 transform hover:-translate-y-1 hover:scale-[1.02] transition-all duration-500 shadow-xl hover:shadow-2xl"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                      {key.includes("price") || key.includes("cost") ? (
                        <svg
                          className="w-5 h-5 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                          />
                        </svg>
                      ) : key.includes("rating") || key.includes("score") ? (
                        <svg
                          className="w-5 h-5 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ) : key.includes("address") || key.includes("location") ? (
                        <svg
                          className="w-5 h-5 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-5 h-5 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      )}
                    </div>
                    <h3 className="text-gray-300 text-sm font-semibold uppercase tracking-wider">
                      {key.replace(/_/g, " ")}
                    </h3>
                  </div>
                  <div className="text-white text-lg font-medium leading-relaxed group-hover:text-cyan-200 transition-colors duration-300">
                    {typeof value === "object"
                      ? JSON.stringify(value, null, 2)
                      : value?.toString() || "N/A"}
                  </div>
                </div>
              ))}
          </div>

          {/* AI Summary Section */}
          {summary && (
            <div className="bg-gradient-to-br from-purple-900/40 to-indigo-900/40 backdrop-blur-2xl rounded-3xl p-8 border border-purple-300 border-opacity-20 shadow-2xl mb-8 transform hover:scale-[1.01] transition-all duration-500">
              <div className="flex items-center gap-4 mb-6 pb-4 border-b border-white border-opacity-20">
                <div className="relative">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-500 via-pink-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg
                      className="w-7 h-7 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full animate-ping"></div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full"></div>
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white mb-1 bg-gradient-to-r from-purple-300 via-pink-300 to-indigo-300 bg-clip-text text-transparent">
                    AI Summary
                  </h2>
                  <p className="text-purple-200 text-sm">
                    Intelligent insights powered by AI analysis
                  </p>
                </div>
              </div>

              <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl p-6 border border-white border-opacity-20">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-center mt-1 flex-shrink-0">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-white leading-relaxed text-lg font-light prose prose-invert max-w-none">
                      <ReactMarkdown>{summary}</ReactMarkdown>
                    </div>
                  </div>

                </div>
              </div>

              <div className="flex items-center gap-2 text-purple-300 text-sm mt-4">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>Analysis generated using advanced AI algorithms</span>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="text-center">
            <a
              href={
                hotel?.source_url ||
                `https://www.google.com/search?q=${encodeURIComponent(name)}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-3 bg-gradient-to-r from-emerald-500 via-cyan-500 to-teal-500 px-8 py-4 rounded-2xl text-white font-bold text-lg hover:from-emerald-600 hover:via-cyan-600 hover:to-teal-600 transform hover:-translate-y-1 hover:scale-105 transition-all duration-300 shadow-xl hover:shadow-2xl"
            >
              <svg className="w-6 h-6 group-hover:rotate-12 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View on {hotel?.source_name || "Google"}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 transform -skew-x-12 transition-all duration-700 rounded-2xl"></div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}