import { useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import { feature } from 'topojson-client';
import countriesTopology from 'world-atlas/countries-110m.json';

const countries = feature(countriesTopology, countriesTopology.objects.countries).features;
const RESULTS_BATCH_SIZE = 6;

function placeKey(place) {
  return `${place.name}-${place.lat}-${place.lng}`;
}

function layoutMarkers(places) {
  const closeDistance = 0.12;

  return places.map((place) => {
    const cluster = places
      .filter((candidate) => (
        Math.hypot(candidate.lat - place.lat, candidate.lng - place.lng) < closeDistance
      ))
      .sort((left, right) => placeKey(left).localeCompare(placeKey(right)));

    if (cluster.length === 1) {
      return { ...place, markerLat: place.lat, markerLng: place.lng };
    }

    const position = cluster.findIndex((candidate) => placeKey(candidate) === placeKey(place));
    const angle = (2 * Math.PI * position) / cluster.length;
    const radius = 0.2 + Math.floor(position / 6) * 0.08;
    const longitudeScale = Math.max(Math.cos((place.lat * Math.PI) / 180), 0.2);

    return {
      ...place,
      // Fan close points around their true location without changing the search result itself.
      markerLat: place.lat + Math.sin(angle) * radius,
      markerLng: place.lng + (Math.cos(angle) * radius) / longitudeScale,
    };
  });
}

function PlaceCard({ place, className = '', isExpanded, onToggle }) {
  const sources = place.sources || [];

  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggle();
    }
  }

  return (
    <div className={`place-card-stack ${className}`}>
      <article
        className="place-card"
        role="button"
        tabIndex="0"
        aria-expanded={isExpanded}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        onKeyDown={handleKeyDown}
      >
        <h3>{place.name}</h3>
        <p>{place.blurb}</p>
        {sources.length > 0 && <small className="evidence-hint">View sources ({sources.length})</small>}
      </article>
      <a
        className="maps-link"
        href={place.googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => event.stopPropagation()}
      >
        View on Google Maps ↗
      </a>
      <div className={`source-cards ${isExpanded ? 'is-expanded' : ''}`}>
        {sources.map((source, index) => (
          <article
            className="source-card"
            key={`${source.url}-${index}`}
            style={{ '--source-index': index }}
            onClick={(event) => event.stopPropagation()}
          >
            <h4>{source.title}</h4>
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              Open source ↗
            </a>
          </article>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const globeRef = useRef();
  const globeContainerRef = useRef();
  const previewLocationRef = useRef(null);
  const [destination, setDestination] = useState('');
  const [category, setCategory] = useState('');
  const [places, setPlaces] = useState([]);
  const [relevanceNotice, setRelevanceNotice] = useState('');
  const [correctionNotice, setCorrectionNotice] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [globeReady, setGlobeReady] = useState(false);
  const [globeDimensions, setGlobeDimensions] = useState({ width: 0, height: 0 });
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [selectedCardPosition, setSelectedCardPosition] = useState({ x: 16, y: 160 });
  const [expandedPlaceKey, setExpandedPlaceKey] = useState(null);
  const [visibleCount, setVisibleCount] = useState(RESULTS_BATCH_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const totalCount = places.length;
  const displayedCount = Math.min(visibleCount, totalCount);
  const visiblePlaces = places.slice(0, displayedCount);
  const hasMoreResults = displayedCount < totalCount;
  const markerPlaces = useMemo(() => layoutMarkers(visiblePlaces), [visiblePlaces]);

  useEffect(() => {
    const container = globeContainerRef.current;
    if (!container) return undefined;

    const updateDimensions = () => {
      setGlobeDimensions({ width: container.clientWidth, height: container.clientHeight });
    };

    updateDimensions();
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const focusPlace = places[0];
    if (!globeReady || !focusPlace) return;

    const controls = globeRef.current?.controls();
    if (controls) controls.autoRotate = false;

    const previewLocation = previewLocationRef.current;
    const previewIsNearby = previewLocation
      && Math.hypot(previewLocation.lat - focusPlace.lat, previewLocation.lng - focusPlace.lng) < 0.3;

    globeRef.current?.pointOfView(
      { lat: focusPlace.lat, lng: focusPlace.lng, altitude: 0.08 },
      previewIsNearby ? 500 : 1600,
    );
  }, [globeReady, places]);

  useEffect(() => {
    const query = destination.trim();
    previewLocationRef.current = null;
    if (!globeReady || query.length < 3) return undefined;

    const controller = new AbortController();
    const debounceTimer = setTimeout(async () => {
      try {
        const response = await fetch('/api/location-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ destination: query }),
          signal: controller.signal,
        });

        if (!response.ok) return;
        const { location } = await response.json();
        if (!location) return;

        previewLocationRef.current = location;
        const controls = globeRef.current?.controls();
        if (controls) controls.autoRotate = false;
        globeRef.current?.pointOfView(
          { lat: location.lat, lng: location.lng, altitude: 0.08 },
          1200,
        );
      } catch (previewError) {
        if (previewError.name !== 'AbortError') {
          console.warn('Destination preview unavailable.', previewError);
        }
      }
    }, 450);

    return () => {
      clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [destination, globeReady]);

  function handleGlobeReady() {
    const controls = globeRef.current?.controls();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.3;
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
    }
    setGlobeReady(true);
  }

  function closeSelectedPlace() {
    setSelectedPlace(null);
    setExpandedPlaceKey(null);
  }

  function closeExpandedPlace() {
    setExpandedPlaceKey(null);
  }

  function togglePlaceSources(place) {
    const key = placeKey(place);
    setExpandedPlaceKey((currentKey) => (currentKey === key ? null : key));
  }

  function handleMarkerClick(place, event) {
    if (selectedPlace && placeKey(selectedPlace) === placeKey(place)) {
      closeSelectedPlace();
      return;
    }

    const bounds = globeContainerRef.current?.getBoundingClientRect();
    if (bounds) {
      const markerX = event.clientX - bounds.left;
      const markerY = event.clientY - bounds.top;
      setSelectedCardPosition({
        x: Math.min(Math.max(16, markerX + 16), Math.max(16, bounds.width - 300)),
        y: Math.min(Math.max(120, markerY + 16), Math.max(120, bounds.height - 220)),
      });
    }

    setSelectedPlace(place);
    setExpandedPlaceKey(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsLoading(true);
    setError('');
    setRelevanceNotice('');
    setCorrectionNotice(null);
    closeSelectedPlace();

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

      const searchResult = await response.json();
      setPlaces(searchResult.places || []);
      setVisibleCount(RESULTS_BATCH_SIZE);
      setIsLoadingMore(false);
      setRelevanceNotice(searchResult.relevanceNote || '');
      setCorrectionNotice(searchResult.interpretation?.corrected ? searchResult.interpretation : null);
    } catch (requestError) {
      setError(requestError.message);
      setPlaces([]);
      setVisibleCount(RESULTS_BATCH_SIZE);
      setIsLoadingMore(false);
      setRelevanceNotice('');
      setCorrectionNotice(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function showMoreResults() {
    setIsLoadingMore(true);
    // Results are already loaded; keep a short transition so the batch reveal is visible.
    await new Promise((resolve) => setTimeout(resolve, 350));
    setVisibleCount((currentCount) => Math.min(currentCount + RESULTS_BATCH_SIZE, totalCount));
    setIsLoadingMore(false);
  }

  return (
    <main className="app-shell" onClick={closeExpandedPlace}>
      <section className="globe-section" aria-label="Interactive globe">
        <div ref={globeContainerRef} className="globe-canvas">
          {globeDimensions.width > 0 && (
            <Globe
              ref={globeRef}
              width={globeDimensions.width}
              height={globeDimensions.height}
              backgroundColor="#000000"
              globeImageUrl={null}
              showGlobe={false}
              showAtmosphere={false}
              showGraticules={false}
              polygonsData={countries}
              polygonAltitude={0.005}
              polygonCapColor={() => 'rgba(0, 0, 0, 0)'}
              polygonSideColor={() => 'rgba(0, 0, 0, 0)'}
              polygonStrokeColor={() => 'rgba(225, 230, 235, 0.8)'}
              polygonsTransitionDuration={0}
              ringsData={visiblePlaces.slice(0, 1)}
              ringLat="lat"
              ringLng="lng"
              ringAltitude={0.01}
              ringMaxRadius={0.35}
              ringPropagationSpeed={0.7}
              ringRepeatPeriod={900}
              ringColor={() => ['rgba(230, 235, 240, 0.7)', 'rgba(230, 235, 240, 0)']}
              pointsData={markerPlaces}
              pointLat="markerLat"
              pointLng="markerLng"
              pointAltitude={0.02}
              pointRadius={0.06}
              pointColor={() => '#77f1ff'}
              pointResolution={12}
              onPointClick={handleMarkerClick}
              onGlobeClick={closeSelectedPlace}
              onPolygonClick={closeSelectedPlace}
              onGlobeReady={handleGlobeReady}
            />
          )}
        </div>

        <div className="globe-overlay">
          <header className="globe-header">
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
              <input
                type="text"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="e.g. cheap sushi, late-night snacks, quiet cafes with wifi"
              />
            </label>

            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Searching…' : 'Search'}
            </button>
          </form>
        </div>

        {selectedPlace && (
          <div
            className="globe-place-card-wrapper"
            style={{ left: selectedCardPosition.x, top: selectedCardPosition.y }}
          >
            <PlaceCard
              place={selectedPlace}
              className="globe-place-card"
              isExpanded={expandedPlaceKey === placeKey(selectedPlace)}
              onToggle={() => togglePlaceSources(selectedPlace)}
            />
          </div>
        )}
      </section>

      <section className="results" aria-labelledby="results-heading">
        <h2 id="results-heading">Results</h2>
        {error && <p className="error" role="alert">{error}</p>}
        {correctionNotice && (
          <p className="correction-notice">
            Showing results for: {correctionNotice.destination}
            {correctionNotice.category && ` · ${correctionNotice.category}`}
          </p>
        )}
        {relevanceNotice && <p className="relevance-notice">{relevanceNotice}</p>}
        {!error && places.length === 0 && <p className="empty-state">Search for a destination to discover some spotz.</p>}
        <div className="result-list">
          {visiblePlaces.map((place) => (
            <PlaceCard
              place={place}
              key={placeKey(place)}
              isExpanded={expandedPlaceKey === placeKey(place)}
              onToggle={() => togglePlaceSources(place)}
            />
          ))}
        </div>
      </section>
      {!isLoading && !error && hasMoreResults && (
        <div className="show-more-bar">
          <button
            className={`show-more-button ${isLoadingMore ? 'is-loading' : ''}`}
            type="button"
            onClick={showMoreResults}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? 'Loading more results…' : 'Show more'}
            {isLoadingMore && <span className="show-more-progress" aria-hidden="true" />}
          </button>
        </div>
      )}
    </main>
  );
}
