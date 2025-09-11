import { useState } from 'react';

export default function HotelLanding() {
  const [city, setCity] = useState('');
  const [checkin, setCheckin] = useState('');
  const [checkout, setCheckout] = useState('');
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchHotels = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setHotels([]);

    try {
      const res = await fetch(`/api/hotels?city=${encodeURIComponent(city)}&checkin=${checkin}&checkout=${checkout}`);
      const data = await res.json();
      console.log('API response:', data);
      if (!data.hotels || data.hotels.length === 0) {
        setError('No hotels found');
      } else {
        setHotels(data.hotels);
      }
    } catch (err) {
      console.error(err);
      setError('Error fetching hotels');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 shadow-md">
        <h1 className="text-3xl font-bold text-center">Top Hotels Finder</h1>
      </header>

      <main className="flex-1 p-6 flex flex-col items-center">

        <form onSubmit={fetchHotels} className="w-full max-w-md bg-white p-6 rounded-xl shadow-lg flex flex-col gap-4">
          <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Enter city" className="p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" required />
          <input type="date" value={checkin} onChange={e => setCheckin(e.target.value)} className="p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
          <input type="date" value={checkout} onChange={e => setCheckout(e.target.value)} className="p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
          <button type="submit" className="bg-purple-600 text-white p-3 rounded-lg hover:bg-purple-700 transition">Search Hotels</button>
        </form>

        {loading && <p className="mt-6 text-gray-600">Loading...</p>}
        {error && <p className="mt-6 text-red-500 font-semibold">{error}</p>}

        <div className="mt-6 w-full max-w-5xl grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {hotels.map(h => (
            <div key={h.id} className="bg-white p-5 rounded-xl shadow-md hover:shadow-xl transition transform hover:-translate-y-1">
              <h3 className="font-bold text-xl mb-2 text-purple-700">{h.name}</h3>
              <p className="text-gray-600 mb-1">{h.address}</p>
              <p className="text-gray-800 font-semibold mb-1">Review Score: {h.review_score} ({h.review_count} reviews)</p>
              <p className="text-gray-800 font-semibold">Agent Score: {h.agent_score}</p>
            </div>
          ))}
        </div>

      </main>

      <footer className="bg-gray-900 text-white text-center p-4 mt-auto">
        &copy; 2025 Hotel Finder. All rights reserved.
      </footer>
    </div>
  );
}