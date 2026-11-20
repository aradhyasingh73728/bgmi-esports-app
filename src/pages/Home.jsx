
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  window.location.hostname === "::1" ||
  window.location.hostname === "[::1]";

const TOURNAMENT_API = (
  isLocalhost
    ? "http://localhost:5005"
    : (typeof process !== "undefined"
        ? process.env.REACT_APP_TOURNAMENT_API_URL
        : "") ||
      "https://create-tournament-server-5005.onrender.com"
).replace(/\/+$/, "");

// ==========================================
// COMMON HELPERS
// ==========================================

const isTrue = (value) =>
  value === true ||
  value === "true" ||
  value === 1 ||
  value === "1";

const getTournamentList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.tournaments)) return data.tournaments;
  if (Array.isArray(data.data)) return data.data;
  return [];
};

const filterPublishedTournaments = (tournaments) => {
  return tournaments.filter((t) => {
    const published = isTrue(t.published);
    const hidden = isTrue(t.is_hidden);

    const visible = !(
      t.is_visible === false ||
      t.is_visible === "false" ||
      t.is_visible === 0 ||
      t.is_visible === "0"
    );

    const status = String(
      t.tournament_status || t.status || ""
    )
      .trim()
      .toLowerCase();

    return published && !hidden && visible && status === "upcoming";
  });
};

// ==========================================
// REMOVE DUPLICATE TOURNAMENTS
// ==========================================

const deduplicateTournaments = (tournaments) => {
  const uniqueTournaments = new Map();

  tournaments.forEach((t, index) => {
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

    const mapName = String(
      t.map || t.map_name || t.tournament_map || ""
    )
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
        : tournamentId
          ? `id:${tournamentId}`
          : `record:${index}`;

    const existing = uniqueTournaments.get(duplicateKey);

    if (!existing) {
      uniqueTournaments.set(duplicateKey, t);
      return;
    }

    const getJoinedCount = (item) => {
      if (Array.isArray(item.joinedPlayers)) {
        return item.joinedPlayers.length;
      }

      return Number(
        item.joinedPlayers || item.registered || 0
      );
    };

    if (getJoinedCount(t) > getJoinedCount(existing)) {
      uniqueTournaments.set(duplicateKey, t);
    }
  });

  return Array.from(uniqueTournaments.values());
};

// ==========================================
// CATEGORY HELPERS
// ==========================================

const slugify = (value) =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const getTournamentCategories = (t) => {
  const categories = [];

  // MAP CATEGORY
  const mapName = String(
    t.map ||
      t.map_name ||
      t.tournament_map ||
      t.mapName ||
      ""
  ).trim();

  if (mapName) {
    categories.push({
      value: `map:${slugify(mapName)}`,
      label: mapName,
      type: "map",
    });
  }

  // TDM / MATCH CATEGORY
  const gameMode = String(
    t.game_mode || t.mode || ""
  ).trim();

  const matchType = String(
    t.match_type || t.type || ""
  ).trim();

  const combined = `${gameMode} ${matchType}`;

  const tdmMatch = combined.match(/\b(1v1|2v2|4v4)\b/i);
  const isTDM = /tdm/i.test(combined) || Boolean(tdmMatch);

  if (isTDM) {
    const matchSize = tdmMatch
      ? tdmMatch[1].toUpperCase()
      : "";

    const label = matchSize
      ? `TDM ${matchSize}`
      : "TDM";

    categories.push({
      value: `mode:${slugify(label)}`,
      label,
      type: "mode",
    });
  }

  return categories;
};

const buildTournamentCategories = (tournaments) => {
  const categoryMap = new Map();

  tournaments.forEach((t) => {
    getTournamentCategories(t).forEach((category) => {
      if (!categoryMap.has(category.value)) {
        categoryMap.set(category.value, category);
      }
    });
  });

  return Array.from(categoryMap.values());
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
  // DYNAMIC CATEGORIES
  // ==========================================

  const categories = useMemo(
    () => buildTournamentCategories(featured),
    [featured]
  );

  // ==========================================
  // FETCH TOURNAMENTS
  // ==========================================

  const fetchTournaments = useCallback(async () => {
    if (activeController.current) {
      activeController.current.abort();
    }

    const controller = new AbortController();
    activeController.current = controller;

    try {
      setError("");

      const response = await fetch(
        `${TOURNAMENT_API}/api/tournaments`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
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

      const tournamentList = getTournamentList(data);

      const publishedList =
        filterPublishedTournaments(tournamentList);

      const uniqueList =
        deduplicateTournaments(publishedList);

      if (!controller.signal.aborted) {
        setFeatured(uniqueList);
      }
    } catch (err) {
      if (err.name === "AbortError") return;

      console.error("HOME TOURNAMENT FETCH ERROR:", err);

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
  // INITIAL FETCH + AUTO REFRESH
  // ==========================================

  useEffect(() => {
    fetchTournaments();

    const interval = setInterval(() => {
      fetchTournaments();
    }, 30000);

    return () => {
      clearInterval(interval);

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

  const handleCategoryClick = (categoryValue = "all") => {
    const params = new URLSearchParams();

    if (categoryValue !== "all") {
      params.set("category", categoryValue);
    }

    navigate(`/tournaments?${params.toString()}`);

    setOpen(false);
  };

  // ==========================================
  // RETRY
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
      {/* HERO SECTION */}

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
                onClick={() => setOpen((previous) => !previous)}
                aria-expanded={open}
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
                  <button
                    type="button"
                    className="all-tour-item"
                    onClick={() => handleCategoryClick("all")}
                  >
                    All Tournaments ({featured.length})
                  </button>

                  {categories.map((category) => {
                    const count = featured.filter((t) =>
                      getTournamentCategories(t).some(
                        (item) => item.value === category.value
                      )
                    ).length;

                    return (
                      <button
                        key={category.value}
                        type="button"
                        className="all-tour-item"
                        onClick={() =>
                          handleCategoryClick(category.value)
                        }
                      >
                        {category.label} ({count})
                      </button>
                    );
                  })}

                  {!loading && categories.length === 0 && (
                    <div className="all-tour-item">
                      No categories available
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="hero-right">
          <div className="hero-glow" />
        </div>
      </section>

      {/* TOURNAMENT SECTION */}

      <section className="tournaments-section">
        <div className="tour-grid-wrapper">
          {loading && (
            <div className="home-loading">
              <div className="home-loader" />
              <p>Loading tournaments...</p>
            </div>
          )}

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

          {!loading && !error && featured.length === 0 && (
            <div className="home-empty">
              <h3>No Tournaments Available</h3>
              <p>
                New tournaments will appear here once
                they are published by the admin.
              </p>
            </div>
          )}

          {!loading && !error && featured.length > 0 && (
            <div className="tour-grid">
              {featured.map((t, index) => (
                <TournamentCard
                  key={t.tournament_id || t.id || index}
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
