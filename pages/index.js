import { useState } from "react";

export default function Home() {
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [hotels, setHotels] = useState([]);
  const [error, setError] = useState("");

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!city) return;

    setLoading(true);
    setHotels([]);
    setError("");

    try {
      const res = await fetch(`/api/hotels/search?city=${encodeURIComponent(city)}`);
      const data = await res.json();

      if (res.ok) {
        setHotels(data.hotels || []);
      } else {
        setError(data.error || "No hotels found");
      }
    } catch (err) {
      console.error("Search error:", err);
      setError("Failed to fetch hotels");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: "Arial", padding: "2rem" }}>
      <h1>🏨 Hotel Finder</h1>
      <form onSubmit={handleSearch} style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          value={city}
          placeholder="Enter a city (e.g., Delhi)"
          onChange={(e) => setCity(e.target.value)}
          style={{ padding: "0.5rem", width: "250px" }}
        />
        <button type="submit" style={{ marginLeft: "0.5rem", padding: "0.5rem 1rem" }}>
          Search
        </button>
      </form>

      {loading && <p>Loading hotels...</p>}

      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && hotels.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {hotels.map((h) => (
            <li key={h.id} style={{ marginBottom: "2rem", borderBottom: "1px solid #ccc", paddingBottom: "1rem" }}>
              <h3>{h.name}</h3>
              {h.photo && <img src={h.photo} alt={h.name} style={{ width: "250px", borderRadius: "4px" }} />}
              <p>{h.address}</p>
              <p>⭐ {h.reviewScore} ({h.reviewCount} reviews)</p>
              {h.price && <p>💰 Price: {h.currency} {h.price}</p>}
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && hotels.length === 0 && city && <p>No hotels found.</p>}
    </div>
  );
}
