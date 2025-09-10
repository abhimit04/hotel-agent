import { useState } from "react";

export default function Home() {
  const [city, setCity] = useState("");
  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  const [adults, setAdults] = useState(2);
  const [rooms, setRooms] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hotels, setHotels] = useState([]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!city || !checkin || !checkout) return;

    setLoading(true);
    setHotels([]);

    try {
      const res = await fetch(
        `/api/hotels/search?city=${encodeURIComponent(city)}&checkin=${checkin}&checkout=${checkout}&adults=${adults}&rooms=${rooms}`
      );
      const data = await res.json();
      setHotels(data.hotels || []);
    } catch (err) {
      console.error("Search error:", err);
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
          style={{ padding: "0.5rem", width: "200px", marginRight: "0.5rem" }}
        />
        <input
          type="date"
          value={checkin}
          onChange={(e) => setCheckin(e.target.value)}
          style={{ padding: "0.5rem", marginRight: "0.5rem" }}
        />
        <input
          type="date"
          value={checkout}
          onChange={(e) => setCheckout(e.target.value)}
          style={{ padding: "0.5rem", marginRight: "0.5rem" }}
        />
        <input
          type="number"
          min="1"
          value={adults}
          onChange={(e) => setAdults(e.target.value)}
          style={{ padding: "0.5rem", width: "60px", marginRight: "0.5rem" }}
        />
        <input
          type="number"
          min="1"
          value={rooms}
          onChange={(e) => setRooms(e.target.value)}
          style={{ padding: "0.5rem", width: "60px", marginRight: "0.5rem" }}
        />
        <button type="submit" style={{ padding: "0.5rem 1rem" }}>
          Search
        </button>
      </form>

      {loading && <p>Loading hotels...</p>}

      {!loading && hotels.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {hotels.map((h) => (
            <li
              key={h.id}
              style={{
                marginBottom: "1rem",
                borderBottom: "1px solid #ccc",
                paddingBottom: "0.5rem",
              }}
            >
              <h3>{h.name}</h3>
              <p>{h.address}</p>
              <p>⭐ {h.reviewScore} ({h.reviewCount} reviews)</p>
              {h.price && <p>💰 Price: {h.price} {h.currency}</p>}
              {h.photo && <img src={h.photo} alt={h.name} style={{ maxWidth: "300px", marginTop: "0.5rem" }} />}
            </li>
          ))}
        </ul>
      )}

      {!loading && hotels.length === 0 && city && <p>No hotels found.</p>}
    </div>
  );
}
