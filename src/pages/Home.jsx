
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import TournamentCard from "../components/TournamentCard";
import "./Home.css";

import homeDesktop from "../assets/bg/home-desktop.webp";
import homeMobile from "../assets/bg/home-mobile.webp";

// ==========================================
// TOURNAMENT API CONFIGURATION
// ==========================================


const isLocalhost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "[::1]";

const TOURNAMENT_API = isLocalhost
  ? "http://localhost:5005"
  : process.env.REACT_APP_TOURNAMENT_API_URL ||
    "https://create-tournament-server-5005.onrender.com";


// ==========================================
// CHECK WHETHER VALUE IS TRUE
// ==========================================

const isTrue = (value) => {
  return value === true || value === "true";
};

// ==========================================
// FILTER PUBLISHED TOURNAMENTS
// ==========================================

const filterPublishedTournaments = (tournaments) => {
  return tournaments.filter((t) => {
    const published = isTrue(t.published);

    const hidden = isTrue(t.is_hidden);

    const visible = !(
      t.is_visible === false ||
      t.is_visible === "false"
    );

    const status = String(
      t.tournament_status || t.status || ""
    )
      .trim()
      .toLowerCase();

    return (
      published &&
      !hidden &&
      visible &&
      status === "upcoming"
    );
  });
};

// ==========================================
// REMOVE DUPLICATE TOURNAMENTS
// ==========================================

const deduplicateTournaments = (tournaments) => {
  const uniqueTournaments = new Map();

  tournaments.forEach((t) => {
    const name = String(
      t.tournament_name || t.name || ""
    )
      .trim()
      .toLowerCase();

    const date = String(t.date || "").trim();

    const time = String(t.time || "").trim();

    const gameMode = String(
      t.game_mode || t.mode || ""
    )
      .trim()
      .toLowerCase();

    const matchType = String(
      t.match_type || t.type || ""
    )
      .trim()
      .toLowerCase();

    const mapName = String(t.map || "")
      .trim()
      .toLowerCase();

    const tournamentId =
      t.tournament_id || t.id || "";

    const duplicateKey =
      name && date && time && gameMode && matchType
        ? [
            name,
            date,
            time,
            gameMode,
            matchType,
            mapName,
          ].join("|")
        : `id:${tournamentId}`;

    const existing = uniqueTournaments.get(duplicateKey);

    if (!existing) {
      uniqueTournaments.set(duplicateKey, t);
      return;
    }

    // Prefer the record with more joined players.

    const getJoinedCount = (item) => {
      if (Array.isArray(item.joinedPlayers)) {
        return item.joinedPlayers.length;
      }

      return Number(item.joinedPlayers || 0);
    };

    const existingCount = getJoinedCount(existing);
    const newCount = getJoinedCount(t);

    if (newCount > existingCount) {
      uniqueTournaments.set(duplicateKey, t);
    }
  });

  return Array.from(uniqueTournaments.values());
};

// ==========================================
// HOME COMPONENT
// ==========================================

const Home = () => {
  const [featured, setFeatured] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const activeController = useRef(null);

  // ==========================================
  // FETCH TOURNAMENTS
  // ==========================================

  const fetchTournaments = useCallback(async () => {
    // Stop previous request if one is running.

    if (activeController.current) {
      activeController.current.abort();
    }

    const controller = new AbortController();

    activeController.current = controller;

    try {
      setError("");

      if (!TOURNAMENT_API) {
        throw new Error(
          "Tournament API URL is not configured. Please check your environment variables."
        );
      }

      const response = await fetch(
        `${TOURNAMENT_API}/api/tournaments`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Unable to load tournaments. Please try again."
        );
      }

      // Get tournament array from API response.

      const tournamentList = Array.isArray(data)
        ? data
        : Array.isArray(data.tournaments)
        ? data.tournaments
        : Array.isArray(data.data)
        ? data.data
        : [];

      // STEP 1: Only published, visible Upcoming tournaments.

      const publishedList =
        filterPublishedTournaments(tournamentList);

      // STEP 2: Remove duplicate tournaments.

      const uniqueList =
        deduplicateTournaments(publishedList);

      // STEP 3: Update Home Page.

      if (!controller.signal.aborted) {
        setFeatured(uniqueList);
      }
    } catch (err) {
      if (err.name === "AbortError") {
        return;
      }

      console.error(
        "HOME TOURNAMENT FETCH ERROR:",
        err
      );

      if (!controller.signal.aborted) {
        setError(
          err.message ||
            "Something went wrong while loading tournaments."
        );
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  // ==========================================
  // INITIAL FETCH
  // ==========================================

  useEffect(() => {
    fetchTournaments();

    return () => {
      if (activeController.current) {
        activeController.current.abort();
      }
    };
  }, [fetchTournaments]);

  // ==========================================
  // MOBILE VIEWPORT FIX
  // ==========================================

  useEffect(() => {
    const setVH = () => {
      document.documentElement.style.setProperty(
        "--vh",
        `${window.innerHeight * 0.01}px`
      );
    };

    setVH();

    window.addEventListener("resize", setVH);

    return () => {
      window.removeEventListener("resize", setVH);
    };
  }, []);

  // ==========================================
  // CATEGORY NAVIGATION
  // ==========================================

  const handleCategoryClick = (cat) => {
    const params = new URLSearchParams();

    if (cat !== "All") {
      params.set("mode", cat);
    }

    navigate(`/tournaments?${params.toString()}`);

    setOpen(false);
  };

  // ==========================================
  // RETRY FETCH
  // ==========================================

  const handleRetry = () => {
    setLoading(true);
    setError("");

    fetchTournaments();
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div
      className="page-esports"
      style={{
        "--home-desktop": `url("${homeDesktop}")`,
        "--home-mobile": `url("${homeMobile}")`,
      }}
    >
      {/* =====================================
          HERO SECTION
      ===================================== */}

      <section className="hero">
        <div className="hero-left">
          <h1 className="hero-title">
            <span className="hero-title-main">
              BGMI
            </span>

            <span className="hero-title-accent">
              ESPORTS
            </span>
          </h1>

          <div className="hero-actions">
            <div className="all-tour-wrapper">
              <button
                type="button"
                className="hero-btn-primary all-tour-btn all-tour-btn-red"
                onClick={() => setOpen((o) => !o)}
              >
                <span>
                  All Tournaments ({featured.length})
                </span>

                <span
                  className={`all-tour-arrow ${
                    open ? "open" : ""
                  }`}
                >
                  ▼
                </span>
              </button>

              {open && (
                <div className="all-tour-dropdown">
                  {[
                    "All",
                    "1v1 TDM",
                    "2v2 TDM",
                    "4v4 TDM",
                  ].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className="all-tour-item"
                      onClick={() =>
                        handleCategoryClick(cat)
                      }
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="hero-right">
          <div className="hero-glow" />
        </div>
      </section>

      {/* =====================================
          TOURNAMENT SECTION
      ===================================== */}

      <section className="tournaments-section">
        <div className="tour-grid-wrapper">
          {/* LOADING STATE */}

          {loading && (
            <div className="home-loading">
              <div className="home-loader" />
              <p>Loading tournaments...</p>
            </div>
          )}

          {/* ERROR STATE */}

          {!loading && error && (
            <div className="home-error">
              <h3>Unable to Load Tournaments</h3>

              <p>{error}</p>

              <button
                type="button"
                onClick={handleRetry}
              >
                Try Again
              </button>
            </div>
          )}

          {/* EMPTY STATE */}

          {!loading &&
            !error &&
            featured.length === 0 && (
              <div className="home-empty">
                <h3>No Tournaments Available</h3>

                <p>
                  New tournaments will appear here once
                  they are published by the admin.
                </p>
              </div>
            )}

          {/* TOURNAMENT CARDS */}

          {!loading &&
            !error &&
            featured.length > 0 && (
              <div className="tour-grid">
                {featured.map((t) => (
                  <TournamentCard
                    key={t.tournament_id || t.id}
                    t={t}
                  />
                ))}
              </div>
            )}
        </div>
      </section>
    </div>
  );
};

export default Home;