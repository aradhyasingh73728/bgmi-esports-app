import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "../supabaseClient";
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
// CACHE (page turant dikhane ke liye)
// ==========================================

const CACHE_KEY = "bgmi_home_tournaments_v1";

const readCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeCache = (list) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(list));
  } catch {
    /* storage full ya blocked ho to ignore */
  }
};

// ==========================================
// COMMON HELPERS
// ==========================================

const isTrue = (value) =>
  value === true ||
  value === "true" ||
  value === 1 ||
  value === "1";

const isFalse = (value) =>
  value === false ||
  value === "false" ||
  value === 0 ||
  value === "0";

const getTournamentList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.tournaments)) return data.tournaments;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

// ==========================================
// TOURNAMENT VISIBILITY FILTER
// ==========================================

const filterPublishedTournaments = (tournaments) => {
  return tournaments.filter((t) => {
    if (!t || typeof t !== "object") return false;

    const publishedValue = t.published;
    const hiddenValue = t.is_hidden;
    const visibleValue = t.is_visible;

    const status = String(t.tournament_status || t.status || "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "");

    if (isTrue(hiddenValue)) return false;
    if (isFalse(visibleValue)) return false;

    if (
      publishedValue !== undefined &&
      publishedValue !== null &&
      !isTrue(publishedValue)
    ) {
      return false;
    }

    const upcomingStatuses = [
      "upcoming",
      "published",
      "open",
      "registrationopen",
      "scheduled",
      "active",
    ];

    if (status && !upcomingStatuses.includes(status)) {
      return false;
    }

    return true;
  });
};

// ==========================================
// REMOVE DUPLICATE TOURNAMENTS
// ==========================================

const deduplicateTournaments = (tournaments) => {
  const uniqueTournaments = new Map();

  tournaments.forEach((t, index) => {
    const name = String(t.tournament_name || t.name || "")
      .trim()
      .toLowerCase();

    const date = String(t.date || "").trim();
    const time = String(t.time || "").trim();

    const gameMode = String(t.game_mode || t.mode || "")
      .trim()
      .toLowerCase();

    const matchType = String(t.match_type || t.type || "")
      .trim()
      .toLowerCase();

    const mapName = String(
      t.map || t.map_name || t.tournament_map || ""
    )
      .trim()
      .toLowerCase();

    const tournamentId = t.tournament_id || t.id || "";

    const duplicateKey =
      name && date && time && gameMode && matchType
        ? [name, date, time, gameMode, matchType, mapName].join("|")
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
      return Number(item.joinedPlayers || item.registered || 0);
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

  const mapName = String(
    t.map || t.map_name || t.tournament_map || t.mapName || ""
  ).trim();

  if (mapName) {
    categories.push({
      value: `map:${slugify(mapName)}`,
      label: mapName,
      type: "map",
    });
  }

  const gameMode = String(t.game_mode || t.mode || "").trim();
  const matchType = String(t.match_type || t.type || "").trim();

  const combined = `${gameMode} ${matchType}`;

  const tdmMatch = combined.match(/\b(1v1|2v2|4v4)\b/i);
  const isTDM = /tdm/i.test(combined) || Boolean(tdmMatch);

  if (isTDM) {
    const matchSize = tdmMatch ? tdmMatch[1].toUpperCase() : "";
    const label = matchSize ? `TDM ${matchSize}` : "TDM";

    categories.push({
      value: `mode:${slugify(label)}`,
      label,
      type: "mode",
    });
  }

  return categories;
};

// categories + unka count ek hi baar me nikalta hai
const buildTournamentCategories = (tournaments) => {
  const categoryMap = new Map();

  tournaments.forEach((t) => {
    getTournamentCategories(t).forEach((category) => {
      const existing = categoryMap.get(category.value);

      if (existing) {
        existing.count += 1;
      } else {
        categoryMap.set(category.value, { ...category, count: 1 });
      }
    });
  });

  return Array.from(categoryMap.values());
};

// ==========================================
// HOME COMPONENT
// ==========================================

const Home = () => {
  // Cache se turant list dikhao, phir background me fresh data lao
  const [featured, setFeatured] = useState(() => readCache());
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(() => readCache().length === 0);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const requestIdRef = useRef(0);

  const categories = useMemo(
    () => buildTournamentCategories(featured),
    [featured]
  );

  // ==========================================
  // FETCH TOURNAMENTS
  // silent = true => loader/error nahi dikhata (background refresh)
  // ==========================================

  const fetchTournaments = useCallback(async (silent = false) => {
    const currentRequestId = ++requestIdRef.current;

    try {
      if (!silent) setError("");

      const response = await fetch(`${TOURNAMENT_API}/api/tournaments`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      const responseText = await response.text();

      let data;

      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error("Server returned invalid JSON response.");
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            `Unable to load tournaments (${response.status}).`
        );
      }

      if (currentRequestId !== requestIdRef.current) return;

      const tournamentList = getTournamentList(data);
      const publishedList = filterPublishedTournaments(tournamentList);
      const uniqueList = deduplicateTournaments(publishedList);

      setFeatured(uniqueList);
      writeCache(uniqueList);
      setError("");
    } catch (err) {
      if (currentRequestId !== requestIdRef.current) return;

      console.error("HOME TOURNAMENT FETCH ERROR:", err);

      // Background refresh fail ho to purani list hi dikhti rahe
      if (!silent) {
        setError(
          err.message ||
            "Something went wrong while loading tournaments."
        );
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // ==========================================
  // INITIAL FETCH
  // ==========================================

  useEffect(() => {
    fetchTournaments(false);

    return () => {
      requestIdRef.current += 1;
    };
  }, [fetchTournaments]);

  // ==========================================
  // REAL-TIME UPDATES (bina refresh ke)
  // ==========================================

  useEffect(() => {
    let timer;

    // Ek saath kai events aaye to sirf ek baar fetch ho
    const scheduleRefresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => fetchTournaments(true), 400);
    };

    // 1) Supabase realtime: admin publish/edit/delete kare to turant update
    const channel = supabase
      .channel("home-tournaments-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "create_tournament" },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_joins" },
        scheduleRefresh
      )
      .subscribe();

    // 2) Tab wapas khule ya internet wapas aaye to refresh
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        fetchTournaments(true);
      }
    };

    const onOnline = () => fetchTournaments(true);

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    // 3) Safety backup: realtime band ho jaye to bhi 30 sec me update
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchTournaments(true);
      }
    }, 30000);

    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
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
    fetchTournaments(false);
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
            <span className="hero-title-main">BGMI</span>
            <span className="hero-title-accent">ESPORTS</span>
          </h1>

          <div className="hero-actions">
            <div className="all-tour-wrapper">
              <button
                type="button"
                className="hero-btn-primary all-tour-btn all-tour-btn-red"
                onClick={() => setOpen((previous) => !previous)}
                aria-expanded={open}
              >
                <span>All Tournaments ({featured.length})</span>

                <span
                  className={`all-tour-arrow ${open ? "open" : ""}`}
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

                  {categories.map((category) => (
                    <button
                      key={category.value}
                      type="button"
                      className="all-tour-item"
                      onClick={() => handleCategoryClick(category.value)}
                    >
                      {category.label} ({category.count})
                    </button>
                  ))}

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
          {loading && featured.length === 0 && (
            <div className="home-loading">
              <div className="home-loader" />
              <p>Loading tournaments...</p>
            </div>
          )}

          {!loading && error && featured.length === 0 && (
            <div className="home-error">
              <h3>Unable to Load Tournaments</h3>
              <p>{error}</p>

              <button type="button" onClick={handleRetry}>
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && featured.length === 0 && (
            <div className="home-empty">
              <h3>No Tournaments Available</h3>
              <p>
                New tournaments will appear here once they are
                published by the admin.
              </p>
            </div>
          )}

          {featured.length > 0 && (
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