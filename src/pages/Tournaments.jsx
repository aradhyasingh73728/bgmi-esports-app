
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";

import { useSearchParams } from "react-router-dom";
import TournamentCard from "../components/TournamentCard";
import "./Tournaments.css";

// HOME PAGE BACKGROUND IMAGES
import homeDesktop from "../assets/bg/home-desktop.webp";
import homeMobile from "../assets/bg/home-mobile.webp";

// ============================================================
// API CONFIGURATION
// ============================================================

const isLocalhost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "::1" ||
  window.location.hostname === "[::1]";

const TOURNAMENT_API = (
  isLocalhost
    ? "http://localhost:5005"
    : import.meta.env.VITE_TOURNAMENT_API_URL ||
      "https://create-tournament-server-5005.onrender.com"
).replace(/\/+$/, "");

// ============================================================
// COMMON HELPERS
// ============================================================

const getJson = async (response) => {
  const text = await response.text();

  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Server returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
      data.error ||
      `Server error: ${response.status}`
    );
  }

  return data;
};

const getTournamentList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.tournaments)) return data.tournaments;
  if (Array.isArray(data.data)) return data.data;

  return [];
};

// ============================================================
// NORMALIZE TOURNAMENT
// ============================================================

const normalizeTournament = (t) => {
  const entryFee = Number(
    t.entryFee ?? t.entry_fee ?? 0
  );

  const prizePool = Number(
    t.prizePool ?? t.prize_pool ?? 0
  );

  const perKill = Number(
    t.perKill ?? t.per_kill ?? 0
  );

  const totalSlots = Number(
    t.totalSlots ??
    t.slots ??
    t.maxSlots ??
    0
  );

  const joinedPlayers = Array.isArray(t.joinedPlayers)
    ? t.joinedPlayers.length
    : Number(
        t.joinedPlayers ??
        t.registered ??
        0
      );

  return {
    ...t,

    id: t.id || t.tournament_id,
    tournament_id: t.tournament_id || t.id,

    name:
      t.name ||
      t.tournament_name ||
      "Untitled Tournament",

    tournament_name:
      t.tournament_name ||
      t.name ||
      "Untitled Tournament",

    mode: t.mode || t.game_mode || "",
    game_mode: t.game_mode || t.mode || "",

    type: t.type || t.match_type || "",
    match_type: t.match_type || t.type || "",

    map:
      t.map ||
      t.map_name ||
      t.tournament_map ||
      t.mapName ||
      "Erangel",

    date: t.date || "",
    time: t.time || "",

    entryFee,
    entry_fee: entryFee,

    prizePool,
    prize_pool: prizePool,

    perKill,
    per_kill: perKill,

    totalSlots,
    slots: totalSlots,
    maxSlots: totalSlots,

    joinedPlayers,
    registered: joinedPlayers,

    description: t.description || "",
    rules: t.rules || t.description || "",

    rulesShort:
      t.rulesShort ||
      t.description ||
      t.rules ||
      t.match_type ||
      "",

    image: t.image || t.image_url || "",
    image_url: t.image_url || t.image || "",

    status:
      t.status ||
      t.tournament_status ||
      "Upcoming",

    tournament_status:
      t.tournament_status ||
      t.status ||
      "Upcoming",

    published: t.published,
    is_visible: t.is_visible,
    is_hidden: t.is_hidden,

    created_at: t.created_at || null,
  };
};

// ============================================================
// CATEGORY HELPERS
// SAME LOGIC AS HOME PAGE
// ============================================================

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

  const tdmMatch = combined.match(
    /\b(1v1|2v2|4v4)\b/i
  );

  const isTDM =
    /tdm/i.test(combined) ||
    Boolean(tdmMatch);

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

// ============================================================
// COMPONENT
// ============================================================

const Tournaments = () => {
  const [searchParams] = useSearchParams();

  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ==========================================================
  // READ URL FILTER
  // ==========================================================

  const category = (
    searchParams.get("category") || ""
  ).trim().toLowerCase();

  // OLD MODE URL SUPPORT

  const rawMode = (
    searchParams.get("mode") || "all"
  ).trim().toLowerCase();

  // ==========================================================
  // FETCH TOURNAMENTS
  // ==========================================================

  const fetchTournaments = useCallback(async () => {
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
        }
      );

      const data = await getJson(response);

      const list = getTournamentList(data);

      const normalized = list
        .map(normalizeTournament)
        .filter((t) => t.id);

      setTournaments(normalized);

    } catch (err) {
      console.error("Tournament Fetch Error:", err);

      setError(
        err.message ||
        "Unable to load tournaments. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // ==========================================================
  // INITIAL LOAD + AUTO REFRESH
  // ==========================================================

  useEffect(() => {
    fetchTournaments();

    const interval = setInterval(() => {
      fetchTournaments();
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [fetchTournaments]);

  // ==========================================================
  // FILTER TOURNAMENTS
  // ==========================================================

  const filteredTournaments = useMemo(() => {
    return tournaments.filter((t) => {

      // ALL TOURNAMENTS

      if (!category || category === "all") {
        if (rawMode === "all") return true;

        // OLD MODE URL SUPPORT

        const combined = `${t.game_mode} ${t.match_type}`
          .toLowerCase()
          .replace(/\s+/g, "");

        if (rawMode.includes("1v1")) {
          return combined.includes("1v1");
        }

        if (rawMode.includes("2v2")) {
          return combined.includes("2v2");
        }

        if (rawMode.includes("4v4")) {
          return combined.includes("4v4");
        }

        return true;
      }

      // CATEGORY MATCHING

      const tournamentCategories =
        getTournamentCategories(t);

      return tournamentCategories.some(
        (item) => item.value.toLowerCase() === category
      );
    });
  }, [tournaments, category, rawMode]);

  // ==========================================================
  // PAGE TITLE
  // ==========================================================

  const getPageTitle = () => {

    if (!category || category === "all") {
      if (rawMode === "all") {
        return "All Tournaments";
      }

      if (rawMode.includes("1v1")) return "1v1 TDM";
      if (rawMode.includes("2v2")) return "2v2 TDM";
      if (rawMode.includes("4v4")) return "4v4 TDM";

      return "All Tournaments";
    }

    if (category.startsWith("map:")) {
      const mapSlug = category.replace("map:", "");

      const tournament = tournaments.find((t) =>
        getTournamentCategories(t).some(
          (item) => item.value === category
        )
      );

      if (tournament) {
        return (
          tournament.map ||
          tournament.map_name ||
          tournament.tournament_map ||
          mapSlug
        );
      }

      return mapSlug
        .split("-")
        .map(
          (word) =>
            word.charAt(0).toUpperCase() + word.slice(1)
        )
        .join(" ");
    }

    if (category === "mode:tdm-1v1") return "1v1 TDM";
    if (category === "mode:tdm-2v2") return "2v2 TDM";
    if (category === "mode:tdm-4v4") return "4v4 TDM";
    if (category === "mode:tdm") return "TDM";

    return "All Tournaments";
  };

  // ==========================================================
  // RETRY
  // ==========================================================

  const handleRetry = () => {
    setLoading(true);
    setError("");
    fetchTournaments();
  };

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div
      className="tournaments-page"
      style={{
        "--home-desktop": `url("${homeDesktop}")`,
        "--home-mobile": `url("${homeMobile}")`,
      }}
    >
      <div className="tournaments-container">

        {/* PAGE HEADER */}

        <header className="page-header">
          <h1>{getPageTitle()}</h1>

          <p className="tournaments-count">
            ({loading ? "..." : filteredTournaments.length})
          </p>
        </header>

        {/* TOURNAMENT SECTION */}

        <div className="tournaments-section">
          <div className="tour-grid-wrapper">
            <div className="tour-grid">

              {/* LOADING */}

              {loading && (
                <div className="no-tournaments">
                  <h3>Loading Tournaments...</h3>
                  <p>
                    Please wait while we fetch tournaments.
                  </p>
                </div>
              )}

              {/* ERROR */}

              {!loading && error && (
                <div className="no-tournaments">
                  <h3>Unable to Load Tournaments</h3>
                  <p>{error}</p>

                  <button
                    type="button"
                    onClick={handleRetry}
                    className="retry-button"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* TOURNAMENT CARDS */}

              {!loading &&
                !error &&
                filteredTournaments.length > 0 &&
                filteredTournaments.map((t) => (
                  <TournamentCard
                    key={t.id}
                    t={t}
                  />
                ))}

              {/* EMPTY STATE */}

              {!loading &&
                !error &&
                filteredTournaments.length === 0 && (
                  <div className="no-tournaments">
                    <h3>No Tournament Found</h3>
                    <p>
                      No tournaments available for this category.
                    </p>
                  </div>
                )}

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Tournaments;
