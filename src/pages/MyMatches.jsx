import {
  memo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

import { supabase } from "../supabaseClient";

import "./MyMatches.css";

/* ============================================================
   API
   ============================================================ */

const API_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:5002"
    : "https://deposit-and-join-tournament-server-5002.onrender.com";

/* ============================================================
   HELPERS (component ke bahar, baar baar nahi bante)
   ============================================================ */

const getProfileId = () => {
  try {
    const user = JSON.parse(
      localStorage.getItem("bgmi_user") || "null"
    );

    return (
      user?.profile_id ||
      user?.user?.profile_id ||
      ""
    );
  } catch (error) {
    console.error("Failed to read user:", error);
    return "";
  }
};

const cacheKeyFor = (profileId) =>
  `bgmi_my_matches_v1_${profileId}`;

const readCache = (profileId) => {
  if (!profileId) return [];

  try {
    const raw = localStorage.getItem(cacheKeyFor(profileId));
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeCache = (profileId, list) => {
  if (!profileId) return;

  try {
    localStorage.setItem(
      cacheKeyFor(profileId),
      JSON.stringify(list)
    );
  } catch {
    /* storage full ya blocked ho to ignore */
  }
};

const removeDuplicateMatches = (matches) => {
  const uniqueMap = new Map();

  matches.forEach((match) => {
    const tournamentId =
      match.tournament_id ??
      match.tournamentId ??
      "";

    const bgmiId =
      match.bgmi_id ??
      match.bgmiId ??
      "";

    const profileId =
      match.profile_id ??
      match.profileId ??
      "";

    const matchId = match.id ?? "";

    const uniqueKey = matchId
      ? `id-${matchId}`
      : `${profileId}-${tournamentId}-${bgmiId}`;

    if (!uniqueMap.has(uniqueKey)) {
      uniqueMap.set(uniqueKey, match);
    }
  });

  return Array.from(uniqueMap.values());
};

const sortMatches = (matches) =>
  [...matches].sort(
    (a, b) =>
      new Date(b.joined_at || b.joinedAt || 0) -
      new Date(a.joined_at || a.joinedAt || 0)
  );

const formatTeamType = (teamType) => {
  const types = {
    solo: "Solo",
    duo: "Duo",
    squad: "Squad",
  };

  return (
    types[teamType?.toLowerCase()] ||
    teamType ||
    "-"
  );
};

/* ============================================================
   MATCH CARD (memo: data na badle to dobara render nahi hota)
   ============================================================ */

const MatchCard = memo(({ match, index }) => {
  const fee =
    match.entry_fee ??
    match.entryFee ??
    match.entry ??
    null;

  const prize =
    match.prize_pool ??
    match.prizePool ??
    match.winnerPrize ??
    null;

  const perKill =
    match.per_kill ??
    match.perKill ??
    null;

  const teamType =
    match.team_type ??
    match.teamType ??
    null;

  const mode = match.mode ?? null;

  const map = match.map ?? null;

  const rulesShort =
    match.rules_short ??
    match.rulesShort ??
    null;

  const gun = match.gun ?? null;

  const tournamentId =
    match.tournament_id ??
    match.tournamentId ??
    null;

  const gameName =
    match.player_name ??
    match.game_name ??
    match.playerName ??
    "-";

  const tournamentName =
    match.tournament_name ??
    match.tournamentName ??
    "Tournament";

  const matchDate = match.date ?? "-";

  const matchTime = match.time ?? "-";

  const bgmiId =
    match.bgmi_id ??
    match.bgmiId ??
    "-";

  const roomId =
    match.room_id ??
    match.roomId ??
    "";

  const roomPassword =
    match.room_password ??
    match.roomPassword ??
    "";

  return (
    <div className="ak-my-matches-card">

      {/* CARD HEADER */}

      <div className="ak-my-matches-card-header">

        <h3>{tournamentName}</h3>

        <span className="ak-my-matches-status">
          Registered
        </span>

      </div>

      {/* MATCH DETAILS */}

      <div className="ak-my-matches-details">

        {tournamentId && (

          <div className="ak-my-matches-row">

            <span>Tournament ID:</span>

            <span className="ak-my-matches-highlight">
              {tournamentId}
            </span>

          </div>

        )}

        <div className="ak-my-matches-row">

          <span>Game Name:</span>

          <span className="ak-my-matches-highlight">
            {gameName}
          </span>

        </div>

        <div className="ak-my-matches-row">

          <span>Game ID:</span>

          <span className="ak-my-matches-highlight">
            {bgmiId}
          </span>

        </div>

        {teamType && (

          <div className="ak-my-matches-row">

            <span>Team Type:</span>

            <span>
              {formatTeamType(teamType)}
            </span>

          </div>

        )}

        {mode && (

          <div className="ak-my-matches-row">

            <span>Mode:</span>

            <span>{mode}</span>

          </div>

        )}

        {map && (

          <div className="ak-my-matches-row">

            <span>Map:</span>

            <span>{map}</span>

          </div>

        )}

        {gun && (

          <div className="ak-my-matches-row">

            <span>Gun:</span>

            <span>{gun}</span>

          </div>

        )}

        {rulesShort && (

          <div className="ak-my-matches-row">

            <span>Rules:</span>

            <span>{rulesShort}</span>

          </div>

        )}

        <div className="ak-my-matches-row">

          <span>Entry:</span>

          <span>
            {fee !== null && fee !== ""
              ? `₹${fee}`
              : "-"}
          </span>

        </div>

        {perKill !== null && perKill !== "" && (

          <div className="ak-my-matches-row">

            <span>Per Kill:</span>

            <span className="ak-my-matches-highlight">
              ₹{perKill}
            </span>

          </div>

        )}

        {prize !== null && prize !== "" && (

          <div className="ak-my-matches-row">

            <span>Prize:</span>

            <span className="ak-my-matches-prize">
              ₹{prize}
            </span>

          </div>

        )}

        <div className="ak-my-matches-row">

          <span>Date:</span>

          <span>{matchDate}</span>

        </div>

        <div className="ak-my-matches-row">

          <span>Time:</span>

          <span>{matchTime}</span>

        </div>

        {/* ROOM DETAILS */}

        {roomId ? (

          <div className="ak-my-matches-room">

            <div className="ak-my-matches-row">

              <span>Custom ID:</span>

              <strong>{roomId}</strong>

            </div>

            <div className="ak-my-matches-row">

              <span>Custom Password:</span>

              <strong>
                {roomPassword || "-"}
              </strong>

            </div>

          </div>

        ) : (

          <div className="ak-my-matches-pending">
            ⏳ Room details coming soon
          </div>

        )}

      </div>

    </div>
  );
});

/* ============================================================
   COMPONENT
   ============================================================ */

const MyMatches = () => {
  const [profileId] = useState(() => getProfileId());

  // Cache se turant list dikhao, phir background me fresh data lao
  const [allMatches, setAllMatches] = useState(() =>
    readCache(getProfileId())
  );

  const [isInitialLoading, setIsInitialLoading] = useState(
    () => readCache(getProfileId()).length === 0
  );

  const requestIdRef = useRef(0);

  /* ============================================================
     FETCH MATCHES
     silent = true => loader nahi dikhata, fail ho to purani list rakhta hai
     ============================================================ */

  const fetchMatches = useCallback(
    async (silent = false) => {
      if (!profileId) {
        console.error("No profileId found");

        setAllMatches([]);
        setIsInitialLoading(false);

        return;
      }

      const currentRequestId = ++requestIdRef.current;

      try {
        const res = await fetch(
          `${API_URL}/api/my-matches?profileId=${encodeURIComponent(
            profileId
          )}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data?.message ||
            data?.error ||
            `HTTP ${res.status}`
          );
        }

        // Purana response ignore karo
        if (currentRequestId !== requestIdRef.current) return;

        const matches = Array.isArray(data.matches)
          ? data.matches
          : [];

        const nextList = sortMatches(
          removeDuplicateMatches(matches)
        );

        // Data same ho to re-render hi nahi
        setAllMatches((previous) =>
          JSON.stringify(previous) === JSON.stringify(nextList)
            ? previous
            : nextList
        );

        writeCache(profileId, nextList);
      } catch (error) {
        if (currentRequestId !== requestIdRef.current) return;

        console.error(
          silent ? "Silent fetch error:" : "Initial fetch error:",
          error
        );

        // Background refresh fail ho to purani list dikhti rahe
        if (!silent) {
          setAllMatches((previous) =>
            previous.length > 0 ? previous : []
          );
        }
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setIsInitialLoading(false);
        }
      }
    },
    [profileId]
  );

  /* ============================================================
     INITIAL LOAD
     ============================================================ */

  useEffect(() => {
    fetchMatches(false);

    return () => {
      // Pending responses ko invalidate karo
      requestIdRef.current += 1;
    };
  }, [fetchMatches]);

  /* ============================================================
     LIVE UPDATES
     1) Supabase realtime (room id/password aate hi turant update)
     2) Tab wapas khule/internet aaye to refresh
     3) 30 sec backup polling (sirf jab tab visible ho)
     ============================================================ */

  useEffect(() => {
    if (!profileId) return undefined;

    let timer;

    const scheduleRefresh = () => {
      clearTimeout(timer);

      timer = setTimeout(() => fetchMatches(true), 400);
    };

    const channel = supabase
      .channel(`my-matches-live-${profileId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tournament_joins",
          filter: `profile_id=eq.${profileId}`,
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "create_tournament",
        },
        scheduleRefresh
      )
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        fetchMatches(true);
      }
    };

    const onOnline = () => fetchMatches(true);

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    const poll = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchMatches(true);
      }
    }, 30000);

    return () => {
      clearTimeout(timer);
      clearInterval(poll);

      supabase.removeChannel(channel);

      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [profileId, fetchMatches]);

  /* ============================================================
     PEACE LOADING SCREEN (sirf jab cache khali ho)
     ============================================================ */

  if (isInitialLoading && allMatches.length === 0) {
    return (
      <div className="ak-my-matches-page">

        <div className="ak-my-matches-container">

          <div className="ak-matches-loading-screen">

            <div className="ak-matches-loader-card">

              <div className="ak-matches-loader-top">
                <span className="ak-matches-live-dot"></span>
                <span>PEACE ESPORTS SYSTEM</span>
              </div>

              <div className="ak-matches-loader-visual">

                <div className="ak-matches-ring ak-matches-ring-one"></div>

                <div className="ak-matches-ring ak-matches-ring-two"></div>

                <div className="ak-matches-ring ak-matches-ring-three"></div>

                <div className="ak-matches-loader-center">
                  <span className="ak-matches-loader-vs">
                    VS
                  </span>

                  <span className="ak-matches-loader-logo">
                    PEACE
                  </span>
                </div>

              </div>

              <div className="ak-matches-loader-content">

                <h2>LOADING MY MATCHES</h2>

                <p>
                  Fetching your tournament registrations...
                </p>

              </div>

              <div className="ak-matches-progress">

                <div className="ak-matches-progress-track">
                  <div className="ak-matches-progress-fill"></div>
                </div>

              </div>

              <div className="ak-matches-loader-status">

                <span>CONNECTING TO MATCH SERVER</span>

                <div className="ak-matches-loader-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>

              </div>

              <div className="ak-matches-loader-footer">
                <span>PEACE ESPORTS</span>
                <span>MY MATCHES</span>
              </div>

              <div className="ak-matches-loader-scan"></div>

            </div>

          </div>

        </div>

      </div>
    );
  }

  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <div className="ak-my-matches-page">

      <div className="ak-my-matches-container">

        {/* HEADER */}

        <div className="ak-my-matches-header">

          <h1>My Matches</h1>

          <p>
            Total:{" "}
            <strong>{allMatches.length}</strong>{" "}
            matches found
          </p>

        </div>

        {/* MATCH LIST */}

        {allMatches.length > 0 ? (

          <div className="ak-my-matches-list">

            {allMatches.map((match, index) => {
              const cardKey =
                match.id ??
                `${match.tournament_id ?? match.tournamentId ?? ""}-${
                  match.bgmi_id ?? match.bgmiId ?? ""
                }-${index}`;

              return (
                <MatchCard
                  key={cardKey}
                  match={match}
                  index={index}
                />
              );
            })}

          </div>

        ) : (

          <div className="ak-my-matches-empty">

            <h2>No Matches Found</h2>

            <p>
              No matches found for your account
            </p>

          </div>

        )}

      </div>

    </div>
  );
};

export default MyMatches;