
import { memo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./TournamentCard.css";

/* ==========================================
   API CONFIGURATION
========================================== */

const isLocalhost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

const API_URL = isLocalhost
  ? "http://localhost:5002"
  : "https://deposit-and-join-tournament-server-5002.onrender.com";

const getProfileId = () => {
  try {
    const storedUser = JSON.parse(
      localStorage.getItem("bgmi_user") || "null"
    );

    return (
      storedUser?.profile_id ||
      storedUser?.user?.profile_id ||
      ""
    );
  } catch (error) {
    console.error("Profile ID read failed:", error);
    return "";
  }
};

const readJson = async (response) => {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data.message || data.error || `HTTP ${response.status}`
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
};

// Sirf actual missing tournament ko deleted maana jayega
const isTournamentNotFound = (error) => {
  const message = String(error?.message || "").toLowerCase();

  return (
    error?.status === 404 ||
    message.includes("tournament not found")
  );
};

/* ==========================================
   SHARED STATUS STORE
========================================== */

const statusCache = new Map();
const inFlight = new Map();
const listeners = new Map();
const activeEntries = new Map();

// Deleted tournament IDs ko dobara API call nahi bhejni
const deletedTournamentIds = new Set();

let totalRefs = 0;
let channel = null;
let pollTimer = null;
let debounceTimer = null;

const makeKey = (id, date, time, profileId) =>
  `${id}|${date}|${time}|${profileId || "guest"}`;

const notify = (key, value) => {
  listeners.get(key)?.forEach((listener) => listener(value));
};

/* ==========================================
   MARK TOURNAMENT AS DELETED
========================================== */

const markTournamentDeleted = (entry) => {
  const { id, key } = entry;

  if (!id) return;

  deletedTournamentIds.add(id);

  const deletedStatus = {
    deleted: true,
    registered: 0,
    max: 0,
    joined: false,
  };

  statusCache.set(key, deletedStatus);

  // Future polling/realtime requests ke liye active list se remove
  activeEntries.delete(key);

  // Currently mounted card ko hide karne ke liye notify
  notify(key, deletedStatus);

  console.info(
    `Tournament ${id} no longer exists. Status polling stopped.`
  );
};

/* ==========================================
   FETCH TOURNAMENT STATUS
========================================== */

const fetchStatus = (entry) => {
  const { key, id } = entry;

  // Deleted tournament ke liye API call mat karo
  if (deletedTournamentIds.has(id)) {
    const deletedStatus = {
      deleted: true,
      registered: 0,
      max: 0,
      joined: false,
    };

    statusCache.set(key, deletedStatus);
    notify(key, deletedStatus);

    return Promise.resolve();
  }

  // Same request already running hai
  if (inFlight.has(key)) {
    return inFlight.get(key);
  }

  const promise = (async () => {
    const slotsParams = new URLSearchParams({
      date: entry.date,
      time: entry.time,
    });

    const slotsRequest = fetch(
      `${API_URL}/api/tournament-slots-count/${encodeURIComponent(
        id
      )}?${slotsParams.toString()}`
    ).then(readJson);

    const joinRequest = entry.profileId
      ? fetch(
          `${API_URL}/api/check-join/${encodeURIComponent(
            id
          )}?${new URLSearchParams({
            profileId: entry.profileId,
            date: entry.date,
            time: entry.time,
          }).toString()}`
        ).then(readJson)
      : Promise.resolve(null);

    const [slotsResult, joinResult] = await Promise.allSettled([
      slotsRequest,
      joinRequest,
    ]);

    // Slots endpoint ne confirm kiya ki tournament exist nahi karta
    if (slotsResult.status === "rejected") {
      const slotsError = slotsResult.reason;

      if (isTournamentNotFound(slotsError)) {
        markTournamentDeleted(entry);
        return;
      }

      console.error(
        `Slots check failed (${id}):`,
        slotsError
      );
    }

    // Join request ka result
    if (
      deletedTournamentIds.has(id) ||
      slotsResult.status !== "fulfilled"
    ) {
      return;
    }

    const previous = statusCache.get(key);
    if (
  slotsResult.status === "fulfilled" &&
  slotsResult.value?.deleted === true
) {
  markTournamentDeleted(entry);
  return;
}

    let registered = previous?.registered ?? 0;
    let max = previous?.max ?? entry.fallbackMax;
    let joined = previous?.joined ?? false;

    const slotsData = slotsResult.value;

    const count = Number(slotsData?.registered ?? 0);
    const maxValue = Number(
      slotsData?.max ?? entry.fallbackMax
    );

    registered =
      Number.isFinite(count) && count >= 0
        ? count
        : 0;

    max =
      Number.isFinite(maxValue) && maxValue > 0
        ? maxValue
        : entry.fallbackMax;

    if (joinResult.status === "fulfilled") {
      joined = Boolean(joinResult.value?.joined);
    } else {
      console.error(
        `Join check failed (${id}):`,
        joinResult.reason
      );
    }

    // Tournament delete ho chuka ho to update mat karo
    if (deletedTournamentIds.has(id)) return;

    const changed =
      !previous ||
      previous.registered !== registered ||
      previous.max !== max ||
      previous.joined !== joined;

    if (changed) {
      const next = {
        deleted: false,
        registered,
        max,
        joined,
      };

      statusCache.set(key, next);
      notify(key, next);
    }
  })()
    .catch((error) => {
      console.error(
        `Tournament status error (${id}):`,
        error
      );
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);

  return promise;
};

/* ==========================================
   GLOBAL REFRESH
========================================== */

const refreshAll = () => {
  activeEntries.forEach((entry) => {
    if (!deletedTournamentIds.has(entry.id)) {
      fetchStatus(entry);
    }
  });
};

const scheduleRefresh = () => {
  clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    refreshAll();
  }, 500);
};

const onVisibilityChange = () => {
  if (document.visibilityState === "visible") {
    refreshAll();
  }
};

/* ==========================================
   GLOBAL REALTIME + POLLING
========================================== */

const startGlobalUpdates = () => {
  // Realtime updates
  channel = supabase
    .channel("tournament-cards-live")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "tournament_joins",
      },
      scheduleRefresh
    )
    .subscribe();

  // Backup polling: every 20 seconds
  pollTimer = setInterval(() => {
    if (document.visibilityState === "visible") {
      refreshAll();
    }
  }, 20000);

  // Tab visible hone par refresh
  document.addEventListener(
    "visibilitychange",
    onVisibilityChange
  );
};

const stopGlobalUpdates = () => {
  clearTimeout(debounceTimer);
  clearInterval(pollTimer);

  debounceTimer = null;
  pollTimer = null;

  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }

  document.removeEventListener(
    "visibilitychange",
    onVisibilityChange
  );
};

/* ==========================================
   SUBSCRIBE STATUS
========================================== */

const subscribeStatus = (entry, listener) => {
  const { key, id } = entry;

  // Listener register karo
  if (!listeners.has(key)) {
    listeners.set(key, new Set());
  }

  listeners.get(key).add(listener);

  // Tournament pehle se deleted hai
  if (deletedTournamentIds.has(id)) {
    listener({
      deleted: true,
      registered: 0,
      max: 0,
      joined: false,
    });

    return () => {
      listeners.get(key)?.delete(listener);

      if (listeners.get(key)?.size === 0) {
        listeners.delete(key);
      }
    };
  }

  let active = activeEntries.get(key);

  if (!active) {
    active = {
      ...entry,
      refs: 0,
    };

    activeEntries.set(key, active);
  }

  active.refs += 1;
  totalRefs += 1;

  if (totalRefs === 1) {
    startGlobalUpdates();
  }

  // Initial status request
  fetchStatus(active);

  return () => {
    listeners.get(key)?.delete(listener);

    if (listeners.get(key)?.size === 0) {
      listeners.delete(key);
    }

    const current = activeEntries.get(key);

    if (current) {
      current.refs -= 1;

      if (current.refs <= 0) {
        activeEntries.delete(key);
      }
    }

    totalRefs -= 1;

    if (totalRefs <= 0) {
      totalRefs = 0;
      stopGlobalUpdates();
    }
  };
};

/* ==========================================
   MAP BACKGROUND
========================================== */

const getTournamentBackground = (id, map, type) => {
  const normalizedMap = String(map || "")
    .trim()
    .toLowerCase();

  const normalizedType = String(type || "")
    .trim()
    .toLowerCase();

  if (normalizedType === "tdm") {
    const tdmBackgrounds = {
      warehouse: "/assets/tournaments/warehouse.webp",
      hangar: "/assets/tournaments/hangar.webp",
      ruins: "/assets/tournaments/ruins.webp",
      library: "/assets/tournaments/library.webp",
      santorini: "/assets/tournaments/santorini.webp",
      town: "/assets/tournaments/town.webp",
    };

    return tdmBackgrounds[normalizedMap] || "";
  }

  const backgrounds = {
    GYJHYTU: "/assets/tournaments/livik.webp",
    CVGFDC5: "/assets/tournaments/livik.webp",
    KFHU41R: "/assets/tournaments/erangel.webp",
    LOIUJ77: "/assets/tournaments/Miramar.webp",
    ASDFG65: "/assets/tournaments/erangel.webp",
  };

  if (backgrounds[id]) {
    return backgrounds[id];
  }

  if (normalizedMap.includes("livik")) {
    return "/assets/tournaments/livik.webp";
  }

  if (normalizedMap.includes("erangel")) {
    return "/assets/tournaments/erangel.webp";
  }

  if (normalizedMap.includes("miramar")) {
    return "/assets/tournaments/Miramar.webp";
  }

  if (normalizedMap.includes("sanhok")) {
    return "/assets/tournaments/sanhok.webp";
  }

  if (normalizedMap.includes("vikendi")) {
    return "/assets/tournaments/vikendi.webp";
  }

  return "";
};

/* ==========================================
   TOURNAMENT CARD COMPONENT
========================================== */

const TournamentCard = ({ t }) => {
  // Tournament details
  const tournamentId = String(
    t?.id || t?.tournament_id || ""
  );

  const tournamentDate = t?.date || "";
  const tournamentTime = t?.time || "";

  const tournamentName =
    t?.name ||
    t?.tournament_name ||
    "BGMI Tournament";

  const tournamentMode =
    t?.mode ||
    t?.game_mode ||
    "Classic";

  const tournamentType =
    t?.type ||
    t?.match_type ||
    "";

  const entryFee =
    t?.entryFee ??
    t?.entry_fee ??
    0;

  const perKill =
    t?.perKill ??
    t?.per_kill;

  const winnerPrize =
    t?.winnerPrize ??
    t?.prizePool ??
    t?.prize_pool;

  const teamType =
    t?.teamType ||
    t?.team_type ||
    "";

  const rawMax = Number(
    t?.totalSlots ??
    t?.slots ??
    50
  );

  const fallbackMax =
    Number.isFinite(rawMax) && rawMax > 0
      ? rawMax
      : 50;

  // User profile
  const [profileId] = useState(() => getProfileId());

  const key = makeKey(
    tournamentId,
    tournamentDate,
    tournamentTime,
    profileId
  );

  // Initial status
  const [status, setStatus] = useState(
    () => statusCache.get(key) || null
  );

  // Subscribe to shared status store
  useEffect(() => {
    if (!tournamentId) {
      return undefined;
    }

    const cachedStatus = statusCache.get(key);

    setStatus(cachedStatus || null);

    return subscribeStatus(
      {
        key,
        id: tournamentId,
        date: tournamentDate,
        time: tournamentTime,
        profileId,
        fallbackMax,
      },
      setStatus
    );
  }, [
    key,
    tournamentId,
    tournamentDate,
    tournamentTime,
    profileId,
    fallbackMax,
  ]);

  // Deleted tournament ko render nahi karna
  if (status?.deleted || deletedTournamentIds.has(tournamentId)) {
    return null;
  }

  const isInitialLoading = !status;

  const registeredSlots =
    status?.registered ?? 0;

  const maxSlots =
    status?.max ?? fallbackMax;

  const isJoined =
    Boolean(status?.joined);

  const isFull =
    status
      ? registeredSlots >= maxSlots
      : false;

  // Slots progress
  const filledPercent =
    maxSlots > 0
      ? Math.min(
          100,
          Math.round(
            (registeredSlots / maxSlots) * 100
          )
        )
      : 0;

  // Map background
  const mapBackground = getTournamentBackground(
    tournamentId,
    t?.map,
    tournamentType
  );

  /* ==========================================
     UI
  ========================================== */

  return (
    <div
      className={`tour-card ${
        String(tournamentType).toLowerCase() === "tdm"
          ? "tdm-card"
          : ""
      }`}
      style={{
        "--map-bg": mapBackground
          ? `url("${mapBackground}")`
          : "none",
      }}
    >
      {/* TOURNAMENT TITLE */}

      <h3 className="tour-title">
        {tournamentName}
      </h3>

      {/* TOURNAMENT ID */}

      {(t?.tournamentId || t?.tournament_id) && (
        <p className="tour-meta tour-meta-id">
          <span className="meta-label">
            Tournament ID
          </span>

          <span className="meta-value">
            {t.tournamentId || t.tournament_id}
          </span>
        </p>
      )}

      {/* TEAM TYPE */}

      {teamType && (
        <p className="tour-meta">
          <span className="meta-label">
            Team Type
          </span>

          <span className="meta-value">
            {teamType}
          </span>
        </p>
      )}

      {/* MAP */}

      {t?.map && (
        <p className="tour-meta map-line">
          <span className="meta-label">
            Map
          </span>

          <span className="meta-value map-highlight">
            {t.map}
          </span>
        </p>
      )}

      {/* MODE */}

      <p className="tour-meta">
        <span className="meta-label">
          Mode
        </span>

        <span className="meta-value">
          {tournamentMode}
        </span>
      </p>

      {/* DATE */}

      {tournamentDate && (
        <p className="tour-meta">
          <span className="meta-label">
            Date
          </span>

          <span className="meta-value">
            {tournamentDate}
          </span>
        </p>
      )}

      {/* TIME */}

      <p className="tour-meta time-line">
        <span className="meta-label">
          Time
        </span>

        <span className="meta-value time-highlight">
          {tournamentTime || "Not specified"}
        </span>
      </p>

      {/* ENTRY FEE */}

      <p className="tour-meta">
        <span className="meta-label">
          Entry
        </span>

        <span className="meta-value highlight-money">
          ₹{entryFee}
        </span>
      </p>

      {/* PER KILL */}

      {perKill !== undefined && perKill !== null && (
        <p className="tour-meta">
          <span className="meta-label">
            Per Kill
          </span>

          <span className="meta-value highlight-money">
            ₹{perKill}
          </span>
        </p>
      )}

      {/* WINNER PRIZE */}

      {winnerPrize !== undefined &&
        winnerPrize !== null && (
          <p className="tour-meta">
            <span className="meta-label">
              Winner Prize
            </span>

            <span className="meta-value highlight-prize">
              ₹{winnerPrize}
            </span>
          </p>
        )}

      {/* FOOTER */}

      <div className="tour-footer">
        {/* SLOTS */}

        <div className="tour-slots-wrap">
          <span
            className={`tour-slots ${
              isFull ? "slots-full" : ""
            }`}
          >
            <span className="meta-label">
              Slots
            </span>

            <span className="meta-value live-slots">
              {isInitialLoading
                ? "⏳"
                : `${registeredSlots}/${maxSlots}`}

              {isFull && !isInitialLoading && (
                <span className="full-badge">
                  🔴 FULL
                </span>
              )}
            </span>
          </span>

          <div className="slots-progress-wrap">
            <div
              className="slots-progress-track"
              role="progressbar"
              aria-valuenow={filledPercent}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-label="Tournament slots progress"
            >
              <div
                className={`slots-progress-fill ${
                  isFull ? "full" : ""
                }`}
                style={{
                  width: isInitialLoading
                    ? "0%"
                    : `${filledPercent}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* BUTTON STATES */}

        {isInitialLoading ? (
          <button
            type="button"
            className="btn-tour btn-loading"
            disabled
            aria-live="polite"
          >
            <span className="tour-btn-spinner" />

            <span className="tour-btn-loading-text">
              CHECKING STATUS
            </span>
          </button>
        ) : isFull ? (
          <button
            type="button"
            className="btn-tour btn-full"
            disabled
          >
            <span className="tour-btn-icon">
              ✕
            </span>

            TOURNAMENT FULL
          </button>
        ) : isJoined ? (
          <button
            type="button"
            className="btn-tour btn-joined"
            disabled
          >
            <span className="tour-btn-icon">
              ✓
            </span>

            ALREADY JOINED
          </button>
        ) : (
          <Link
            to={`/tournaments/${tournamentId}`}
            className="btn-tour btn-active"
          >
            <span>JOIN TOURNAMENT</span>

            <span className="tour-btn-arrow">
              ↗
            </span>
          </Link>
        )}
      </div>
    </div>
  );
};

/* ==========================================
   MEMOIZATION
========================================== */

export default memo(
  TournamentCard,
  (previous, next) => {
    if (previous.t === next.t) {
      return true;
    }

    try {
      return (
        JSON.stringify(previous.t) ===
        JSON.stringify(next.t)
      );
    } catch {
      return false;
    }
  }
);
