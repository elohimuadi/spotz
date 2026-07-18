import { useState } from 'react';

const categories = ['food', 'shopping', 'nightlife', 'sightseeing'];

export default function App() {
  const [destination, setDestination] = useState('');
  const [category, setCategory] = useState('');
  const [places, setPlaces] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination, category }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Search failed. Please try again.');
      }

      setPlaces(await response.json());
    } catch (requestError) {
      setError(requestError.message);
      setPlaces([]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <header>
        <p className="eyebrow">Find your next favorite place</p>
        <h1>Spotz</h1>
      </header>

      <form className="search-form" onSubmit={handleSubmit}>
        <label>
          Destination
          <input
            type="text"
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            placeholder="City or country"
            required
          />
        </label>

        <label>
          Category <span>(optional)</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((option) => (
              <option key={option} value={option}>
                {option[0].toUpperCase() + option.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Searching…' : 'Search'}
        </button>
      </form>

      <section aria-label="Map">
        <div id="map" className="map-container">
          <p>Map coming next</p>
        </div>
      </section>

      <section className="results" aria-labelledby="results-heading">
        <h2 id="results-heading">Results</h2>
        {error && <p className="error" role="alert">{error}</p>}
        {!error && places.length === 0 && <p className="empty-state">Search for a destination to discover some spotz.</p>}
        <div className="result-list">
          {places.map((place) => (
            <article className="place-card" key={`${place.name}-${place.lat}-${place.lng}`}>
              <h3>{place.name}</h3>
              <p>{place.blurb}</p>
              <small>{place.lat}, {place.lng}</small>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
