import {
  useParams,
  useNavigate,
} from "react-router-dom";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

import "./TournamentDetails.css";

/* ============================================================
   API CONFIG
   ============================================================ */

const isLocalhost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "::1" ||
  window.location.hostname === "[::1]";

const TOURNAMENT_API = isLocalhost
  ? "http://localhost:5005"
  : import.meta.env.VITE_TOURNAMENT_API_URL ||
    "https://create-tournament-server-5005.onrender.com";

const JOIN_API = isLocalhost
  ? "http://localhost:5002"
  : "https://deposit-and-join-tournament-server-5002.onrender.com";

const USER_API = isLocalhost
  ? "http://localhost:5001"
  : "https://user-register-server-5001.onrender.com";

/* Home page isi key me tournaments cache karta hai */
const HOME_CACHE_KEY = "bgmi_home_tournaments_v1";

/* ============================================================
   HELPERS
   ============================================================ */

const getJson = async (response) => {
  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
      data?.message ||
      `HTTP ${response.status}`
    );
  }

  return data;
};

const normalizeTournament = (item) => {
  if (!item) return null;

  return {
    ...item,

    id:
      item.id ||
      item.tournament_id,

    name:
      item.name ||
      item.tournament_name ||
      "Untitled Tournament",

    mode:
      item.mode ||
      item.game_mode ||
      "Solo",

    type:
      item.type ||
      item.match_type ||
      "Classic",

    rulesShort:
      item.rulesShort ||
      item.description ||
      item.rules ||
      item.match_type ||
      "",

    entryFee: Number(
      item.entryFee ??
      item.entry_fee ??
      0
    ),

    prizePool: Number(
      item.prizePool ??
      item.prize_pool ??
      0
    ),

    perKill: Number(
      item.perKill ??
      item.per_kill ??
      0
    ),

    maxSlots: Number(
      item.maxSlots ??
      item.totalSlots ??
      item.total_slots ??
      item.slots ??
      50
    ),

    joinedPlayers: Number(
      item.joinedPlayers ??
      item.registered ??
      item.joined_players ??
      0
    ),

    date:
      item.date ||
      item.tournament_date ||
      item.match_date ||
      item.scheduled_date ||
      "",

    time:
      item.time ||
      item.tournament_time ||
      item.match_time ||
      item.scheduled_time ||
      "",

    image:
      item.image ||
      item.image_url ||
      "",

    status:
      item.status ||
      item.tournament_status ||
      "Upcoming",
  };
};

/* Server response se tournaments ki list nikalta hai */
const extractTournamentList = (data) => {
  if (Array.isArray(data)) return data;

  return [
    ...(Array.isArray(data?.tournaments) ? data.tournaments : []),
    ...(Array.isArray(data?.history) ? data.history : []),
    ...(Array.isArray(data?.matches) ? data.matches : []),
    ...(Array.isArray(data?.data) ? data.data : []),
    ...(Array.isArray(data?.results) ? data.results : []),
  ];
};

const matchesId = (item, id) =>
  String(item?.id || item?.tournament_id) === String(id);

/* Home page ke cache se tournament turant nikalo (spinner bachane ke liye) */
const readCachedTournament = (id) => {
  try {
    const raw = localStorage.getItem(HOME_CACHE_KEY);
    const list = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(list)) return null;

    const found = list.find((item) => matchesId(item, id));

    return found ? normalizeTournament(found) : null;
  } catch {
    return null;
  }
};

/*
  Teeno endpoints ek saath bulao.
  Jo pehle tournament dhoond de, wahi use ho jayega
  (baaki ka wait nahi hoga).
*/
const fetchTournamentFromServer = async (id) => {
  const endpoints = [
    `${TOURNAMENT_API}/api/tournaments`,
    `${TOURNAMENT_API}/api/live-tournaments`,
    `${TOURNAMENT_API}/api/tournament-history`,
  ];

  const attempts = endpoints.map(async (url) => {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });

    const data = await getJson(response);

    const found = extractTournamentList(data).find((item) =>
      matchesId(item, id)
    );

    if (!found) {
      const notFound = new Error(
        "Tournament not found. Please check whether it has been published."
      );
      notFound.code = "NOT_FOUND";
      throw notFound;
    }

    return found;
  });

  try {
    return await Promise.any(attempts);
  } catch (aggregateError) {
    const errors = aggregateError?.errors || [];

    // Koi server ne bola "nahi mila" => tournament sach me nahi hai
    const notFoundError = errors.find(
      (item) => item?.code === "NOT_FOUND"
    );

    if (notFoundError) throw notFoundError;

    // Teeno requests fail (network/server problem)
    throw errors[errors.length - 1] ||
      new Error("Unable to load tournament.");
  }
};

/* ============================================================
   COMPONENT
   ============================================================ */

const TournamentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  /* Cache se turant tournament (agar Home page pehle khula tha) */
  const [initialCached] = useState(() => readCachedTournament(id));

  /* ============================================================
     STATES
     ============================================================ */

  const [tournament, setTournament] = useState(initialCached);

  const [isTournamentLoading, setIsTournamentLoading] =
    useState(!initialCached);

  const [isJoined, setIsJoined] = useState(false);

  const [isFull, setIsFull] = useState(false);

  const [isInitialLoading, setIsInitialLoading] =
    useState(true);

  const [statusReady, setStatusReady] = useState(false);

  const [balanceLoading, setBalanceLoading] = useState(true);

  const [liveSlots, setLiveSlots] = useState(
    initialCached?.joinedPlayers || 0
  );

  const [maxSlots, setMaxSlots] = useState(
    initialCached?.maxSlots > 0 ? initialCached.maxSlots : 50
  );

  const [isLoading, setIsLoading] = useState(false);

  const [balance, setBalance] = useState(0);

  const [user, setUser] = useState(null);

  const [errorMsg, setErrorMsg] = useState("");

  const isMountedRef = useRef(true);

  // slots-count endpoint se asli count aa chuka hai ya nahi
  const slotsLoadedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /* ============================================================
     GET LOGGED-IN USER
     ============================================================ */

  const getStoredUser = useCallback(() => {
    try {
      const stored = localStorage.getItem("bgmi_user");

      if (!stored) return null;

      return JSON.parse(stored);
    } catch (error) {
      console.error("Failed to read user data:", error);
      return null;
    }
  }, []);

  /* ============================================================
     GET PROFILE ID
     ============================================================ */

  const getProfileId = useCallback(() => {
    const storedUser = getStoredUser();

    return (
      storedUser?.profile_id ||
      storedUser?.user?.profile_id ||
      ""
    );
  }, [getStoredUser]);

  /* ============================================================
     LOAD BALANCE FROM BACKEND
     ============================================================ */

  const loadBalance = useCallback(async () => {
    try {
      const storedUser = getStoredUser();

      const profileId =
        storedUser?.profile_id ||
        storedUser?.user?.profile_id ||
        "";

      if (!profileId) {
        if (isMountedRef.current) {
          setBalance(0);
        }

        return;
      }

      const response = await fetch(
        `${USER_API}/api/my-balance?profileId=${encodeURIComponent(
          profileId
        )}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await getJson(response);

      const currentBalance = Number(data?.balance || 0);

      if (isMountedRef.current) {
        setBalance(
          Number.isFinite(currentBalance)
            ? currentBalance
            : 0
        );

        setUser({
          ...storedUser,

          username:
            data?.username ||
            storedUser?.username ||
            storedUser?.user?.username ||
            "",
        });
      }
    } catch (error) {
      console.error("Balance load error:", error);

      if (isMountedRef.current) {
        setBalance(0);
      }
    } finally {
      if (isMountedRef.current) {
        setBalanceLoading(false);
      }
    }
  }, [getStoredUser]);

  /* ============================================================
     BALANCE: PAGE KHULTE HI LOAD (tournament ka wait nahi)
     ============================================================ */

  useEffect(() => {
    if (!getProfileId()) {
      setBalanceLoading(false);
      navigate("/login");
      return;
    }

    loadBalance();
  }, [getProfileId, loadBalance, navigate]);

  /* ============================================================
     LOAD TOURNAMENT (cache turant, fresh data background me)
     ============================================================ */

  useEffect(() => {
    let active = true;

    const cached = readCachedTournament(id);

    setTournament((previous) =>
      previous && String(previous.id) === String(id)
        ? previous
        : cached
    );

    setIsTournamentLoading(!cached);
    setIsInitialLoading(true);
    setStatusReady(false);
    setIsJoined(false);
    setIsFull(false);
    setLiveSlots(cached?.joinedPlayers || 0);
    setMaxSlots(cached?.maxSlots > 0 ? cached.maxSlots : 50);
    setErrorMsg("");

    slotsLoadedRef.current = false;

    const fetchFresh = async () => {
      try {
        const found = await fetchTournamentFromServer(id);

        const normalized = normalizeTournament(found);

        if (!normalized || !normalized.id) {
          throw new Error(
            "Invalid tournament data received from server."
          );
        }

        if (!active || !isMountedRef.current) return;

        // Data same ho to purana object rakho (extra re-render nahi)
        setTournament((previous) =>
          previous &&
          JSON.stringify(previous) === JSON.stringify(normalized)
            ? previous
            : normalized
        );

        if (!slotsLoadedRef.current) {
          setMaxSlots(
            normalized.maxSlots > 0 ? normalized.maxSlots : 50
          );

          setLiveSlots(normalized.joinedPlayers || 0);
        }
      } catch (error) {
        console.error("Tournament load failed:", error);

        if (!active || !isMountedRef.current) return;

        // Cache se page dikh raha ho aur sirf network fail hua ho
        // to page chalne do. Warna error dikhao.
        if (error?.code === "NOT_FOUND" || !cached) {
          setTournament(null);

          setErrorMsg(
            error?.message ||
            "Unable to load tournament."
          );
        }
      } finally {
        if (active && isMountedRef.current) {
          setIsTournamentLoading(false);
        }
      }
    };

    fetchFresh();

    return () => {
      active = false;
    };
  }, [id]);

  /* ============================================================
     TOURNAMENT KE PRIMITIVE VALUES
     (object badalne par effects dobara na chalein)
     ============================================================ */

  const tId = tournament?.id;
  const tDate = tournament?.date;
  const tTime = tournament?.time;
  const tMax = tournament?.maxSlots;

  /* ============================================================
     CHECK JOIN STATUS
     ============================================================ */

  const checkJoinStatus = useCallback(async () => {
    const profileId = getProfileId();

    const matchDate = String(tDate || "").trim();
    const matchTime = String(tTime || "").trim();

    if (!tId || !profileId) return;

    if (!matchDate || !matchTime) {
      console.error("Tournament date/time missing:", {
        tournamentId: id,
        date: matchDate,
        time: matchTime,
      });

      return;
    }

    try {
      const joinParams = new URLSearchParams({
        profileId,
        date: matchDate,
        time: matchTime,
      });

      const joinRes = await fetch(
        `${JOIN_API}/api/check-join/${encodeURIComponent(
          id
        )}?${joinParams.toString()}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const joinData = await getJson(joinRes);

      if (isMountedRef.current) {
        setIsJoined(Boolean(joinData?.joined));
      }
    } catch (error) {
      console.error("Join status check failed:", error);
    }
  }, [id, tId, tDate, tTime, getProfileId]);

  /* ============================================================
     CHECK SLOTS COUNT
     ============================================================ */

  const checkSlots = useCallback(async () => {
    const matchDate = String(tDate || "").trim();
    const matchTime = String(tTime || "").trim();

    if (!tId || !matchDate || !matchTime) return;

    try {
      const slotsParams = new URLSearchParams({
        date: matchDate,
        time: matchTime,
      });

      const slotsRes = await fetch(
        `${JOIN_API}/api/tournament-slots-count/${encodeURIComponent(
          id
        )}?${slotsParams.toString()}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const slotsData = await getJson(slotsRes);

      const count = Number(slotsData?.registered ?? 0);

      const max = Number(
        slotsData?.max ??
        tMax ??
        50
      );

      const safeCount =
        Number.isFinite(count) && count >= 0
          ? count
          : 0;

      const safeMax =
        Number.isFinite(max) && max > 0
          ? max
          : 50;

      if (isMountedRef.current) {
        slotsLoadedRef.current = true;

        setLiveSlots(safeCount);
        setMaxSlots(safeMax);
        setIsFull(safeCount >= safeMax);
      }
    } catch (error) {
      console.error("Slots check failed:", error);
    }
  }, [id, tId, tDate, tTime, tMax]);

  /* ============================================================
     INITIAL STATUS: join + slots ek SAATH (parallel)
     ============================================================ */

  useEffect(() => {
    if (!tId) return;

    let active = true;

    const run = async () => {
      if (!getProfileId()) {
        if (active) setIsInitialLoading(false);
        return;
      }

      await Promise.all([checkJoinStatus(), checkSlots()]);

      if (active) {
        setStatusReady(true);
        setIsInitialLoading(false);
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [tId, getProfileId, checkJoinStatus, checkSlots]);

  /* ============================================================
     LIVE SLOTS REFRESH (10 sec, sirf jab tab visible ho)
     ============================================================ */

  useEffect(() => {
    if (!statusReady) return;

    const refreshSlots = () => {
      if (document.visibilityState === "visible") {
        checkSlots();
      }
    };

    const interval = setInterval(refreshSlots, 10000);

    document.addEventListener("visibilitychange", refreshSlots);

    return () => {
      clearInterval(interval);

      document.removeEventListener(
        "visibilitychange",
        refreshSlots
      );
    };
  }, [statusReady, checkSlots]);

  /* ============================================================
     PEACE TOURNAMENT LOADING UI
     ============================================================ */

  if (isTournamentLoading) {
    return (
      <div className="tdm-page">
        <div className="tdm-container">

          <div className="tdm-loading-screen">

            <div className="tdm-loader-card">

              <div className="tdm-loader-top">
                <span className="tdm-live-indicator"></span>
                <span>TOURNAMENT SYSTEM</span>
              </div>

              <div className="tdm-loader-visual">

                <div className="tdm-loader-ring tdm-ring-one"></div>

                <div className="tdm-loader-ring tdm-ring-two"></div>

                <div className="tdm-loader-ring tdm-ring-three"></div>

                <div className="tdm-loader-center">
                  <span className="tdm-loader-vs">VS</span>
                  <span className="tdm-loader-logo">PEACE</span>
                </div>

              </div>

              <div className="tdm-loader-content">

                <h2>LOADING TOURNAMENT</h2>

                <p>
                  Preparing your battlefield...
                </p>

              </div>

              <div className="tdm-loader-progress">

                <div className="tdm-loader-progress-track">
                  <div className="tdm-loader-progress-fill"></div>
                </div>

              </div>

              <div className="tdm-loader-status">
                <span>CONNECTING TO SERVER</span>

                <div className="tdm-loader-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>

              <div className="tdm-loader-footer">
                <span>PEACE ESPORTS</span>
                <span>BGMI TOURNAMENT PLATFORM</span>
              </div>

              <div className="tdm-loader-scan"></div>

            </div>

          </div>

        </div>
      </div>
    );
  }

  /* ============================================================
     TOURNAMENT NOT FOUND
     ============================================================ */

  if (!tournament) {
    return (
      <div className="tdm-page">
        <div className="tdm-container">

          <div className="status-card error">

            <h1>Tournament Not Found</h1>

            <p>
              {errorMsg ||
                "Tournament is unavailable or has not been published."}
            </p>

            <button
              type="button"
              className="submit-btn"
              onClick={() => navigate("/tournaments")}
            >
              Back to Tournaments
            </button>

          </div>

        </div>
      </div>
    );
  }

  /* ============================================================
     TOURNAMENT VALUES
     ============================================================ */

  // status + balance dono aane tak "checking" dikhao
  const pageLoading = isInitialLoading || balanceLoading;

  const tournamentEntryFee =
    Number(tournament.entryFee || 0);

  const tournamentPrize =
    Number(tournament.prizePool || 0);

  const tournamentMaxSlots =
    Number(
      tournament.maxSlots ||
      maxSlots ||
      50
    );

  /* ============================================================
     HANDLE TOURNAMENT JOIN  (logic bilkul same)
     ============================================================ */

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isLoading) return;

    /* PLAYER INPUT */

    const playerName = String(
      e.target.bgmiIdName?.value || ""
    ).trim();

    const bgmiId = String(
      e.target.bgmiIdNumber?.value || ""
    ).trim();

    if (!playerName || !bgmiId) {
      setErrorMsg(
        "❌ Please enter your BGMI Name and ID!"
      );
      return;
    }

    /* PLAYER NAME VALIDATION */

    if (playerName.length > 20) {
      setErrorMsg(
        "❌ BGMI Name must be 20 characters or fewer!"
      );
      return;
    }

    /* BGMI ID VALIDATION */

    if (!/^\d+$/.test(bgmiId)) {
      setErrorMsg(
        "❌ BGMI ID must contain numbers only!"
      );
      return;
    }

    if (
      bgmiId.length < 5 ||
      bgmiId.length > 12
    ) {
      setErrorMsg("❌ Invalid BGMI ID!");
      return;
    }

    /* USER CHECK */

    const profileId = getProfileId();

    if (!profileId) {
      setErrorMsg("❌ Please log in first!");
      navigate("/login");
      return;
    }

    /* DATE/TIME CHECK */

    if (!tournament.date || !tournament.time) {
      setErrorMsg(
        "❌ Tournament date/time is missing. Please refresh."
      );
      return;
    }

    /* ENTRY FEE */

    const entryFee = tournamentEntryFee;

    /* BALANCE CHECK */

    if (
      entryFee > 0 &&
      balance < entryFee
    ) {
      setErrorMsg(
        `❌ Insufficient balance!\n💰 Required: ₹${entryFee}\n💳 Available: ₹${balance}`
      );
      return;
    }

    /* FULL CHECK */

    if (liveSlots >= maxSlots) {
      setIsFull(true);
      setErrorMsg("🔴 Tournament is full!");
      return;
    }

    if (isJoined) {
      setErrorMsg(
        "❌ Already joined this tournament!"
      );
      return;
    }

    setErrorMsg("");
    setIsLoading(true);

    try {
      /* JOIN PAYLOAD */

      const joinedMatch = {
        tournamentId: tournament.id,

        tournamentName: tournament.name,

        playerName,

        bgmiId,

        profileName:
          user?.username ||
          user?.user?.username ||
          "",

        profileId,

        mode:
          tournament.mode ||
          "Classic",

        rulesShort:
          tournament.rulesShort ||
          "",

        map:
          tournament.map ||
          "Erangel",

        date:
          tournament.date,

        time:
          tournament.time,

        entryFee,

        prizePool: tournamentPrize,

        slots: tournamentMaxSlots,
      };

      /* BACKEND JOIN */

      const response = await fetch(
        `${JOIN_API}/api/join-tournament`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify(joinedMatch),
        }
      );

      const result = await getJson(response);

      /* SUCCESS */

      if (
        response.ok &&
        result?.success === true
      ) {
        /* UPDATE LOCAL CACHE */

        try {
          const oldJoins = JSON.parse(
            localStorage.getItem("tournamentJoins") || "[]"
          );

          const newJoin = {
            tournamentId: tournament.id,

            tournamentName: tournament.name,

            bgmiId,

            playerName,

            profileId,

            mode:
              tournament.mode ||
              "Classic",

            map:
              tournament.map ||
              "Erangel",

            date:
              tournament.date,

            time:
              tournament.time,

            entryFee,

            prizePool: tournamentPrize,

            timestamp: Date.now(),
          };

          const updatedJoins = oldJoins
            .filter(
              (join) =>
                !(
                  String(
                    join?.tournamentId || ""
                  ) === String(tournament.id) &&
                  String(
                    join?.profileId || ""
                  ) === String(profileId)
                )
            )
            .concat(newJoin);

          localStorage.setItem(
            "tournamentJoins",
            JSON.stringify(updatedJoins)
          );
        } catch (storageError) {
          console.warn(
            "Local join cache update skipped:",
            storageError
          );
        }

        /* REFRESH BALANCE */

        await loadBalance();

        /* GO TO MY MATCHES */

        navigate("/my-matches", {
          replace: true,
        });

        return;
      }

      /* INSUFFICIENT BALANCE */

      if (result?.insufficientBalance === true) {
        setErrorMsg(
          result?.message ||
          "❌ Wallet balance insufficient."
        );

        if (
          Number.isFinite(Number(result?.balance))
        ) {
          setBalance(Number(result.balance));
        }

        return;
      }

      /* ALREADY JOINED */

      if (result?.alreadyJoined === true) {
        setIsJoined(true);

        setErrorMsg(
          result?.message ||
          "❌ Already joined this tournament!"
        );

        return;
      }

      /* TOURNAMENT FULL */

      if (
        String(result?.message || "")
          .toLowerCase()
          .includes("full")
      ) {
        setIsFull(true);

        setErrorMsg(
          result?.message ||
          "🔴 Tournament is full!"
        );

        return;
      }

      /* SERVER REJECTED JOIN */

      console.error("Server rejected join:", result);

      setErrorMsg(
        result?.message ||
        result?.error ||
        "Tournament join failed"
      );
    } catch (error) {
      console.error("Complete join failed:", error);

      setErrorMsg(
        error?.message ||
        "Join failed"
      );
    } finally {
      setIsLoading(false);
    }
  };

  /* ============================================================
     MAIN UI
     ============================================================ */

  return (
    <div className="tdm-page">
      <div className="tdm-container">

        {/* HEADER */}

        <div className="tdm-header">

          <h1 className="tdm-title">
            {tournament.name}
          </h1>

          <p className="tdm-subtitle">
            Mode:{" "}
            {tournament.mode}
            {" • "}
            {tournament.rulesShort}
          </p>

        </div>

        {/* TOURNAMENT INFO */}

        <div className="tournament-info">

          {/* ENTRY FEE */}

          <div className="info-card">

            <div className="info-label">
              💰 Entry Fee
            </div>

            <div className="info-value">
              ₹{tournamentEntryFee}
            </div>

          </div>

          {/* WALLET */}

          <div className="info-card">

            <div className="info-label">
              💳 Wallet
            </div>

            <div
              className={`info-value ${
                balanceLoading
                  ? ""
                  : balance >= tournamentEntryFee
                    ? "success"
                    : "warning"
              }`}
            >
              {balanceLoading ? (
                "⏳"
              ) : (
                <>
                  ₹{balance.toLocaleString("en-IN")}

                  {balance < tournamentEntryFee && (
                    <span className="insufficient">
                      {" "}❌ Add Funds
                    </span>
                  )}
                </>
              )}

            </div>

          </div>

          {/* PRIZE */}

          <div className="info-card">

            <div className="info-label">
              🏆 Prize
            </div>

            <div className="info-value prize">
              ₹{tournamentPrize}
            </div>

          </div>

          {/* SLOTS */}

          <div className="info-card">

            <div className="info-label">
              📊 Slots
            </div>

            <div
              className={`info-value slots ${
                isFull ? "full-slots" : ""
              }`}
            >
              {isInitialLoading
                ? "⏳"
                : `${liveSlots}/${maxSlots}`}

              {isFull && !isInitialLoading && (
                <span className="full-badge">
                  FULL
                </span>
              )}

            </div>

          </div>

        </div>

        {/* REGISTER SECTION */}

        <div className="register-section">

          {pageLoading ? (

            <div className="status-card loading">
              <h3>⏳ Checking Status...</h3>

              <p>
                Loading tournament data...
              </p>
            </div>

          ) : isFull ? (

            <div className="status-card full">
              <h3>🔴 Tournament FULL</h3>
            </div>

          ) : isJoined ? (

            <div className="status-card joined">
              <h3>✅ Already Joined!</h3>
            </div>

          ) : (

            <>
              {errorMsg && (
                <div className="status-card error">
                  <h3>{errorMsg}</h3>
                </div>
              )}

              <form
                className="register-form"
                onSubmit={handleSubmit}
              >

                {/* PLAYER NAME */}

                <div className="form-group">

                  <label className="form-label">
                    🎮 BGMI ID NAME
                  </label>

                  <input
                    name="bgmiIdName"
                    type="text"
                    className="form-input"
                    required
                    placeholder="BGMI Player Name"
                    maxLength={20}
                    autoComplete="off"
                    disabled={isLoading}
                  />

                </div>

                {/* PLAYER ID */}

                <div className="form-group">

                  <label className="form-label">
                    📱 BGMI ID NUMBER
                  </label>

                  <input
                    name="bgmiIdNumber"
                    type="text"
                    className="form-input"
                    required
                    placeholder="Enter BGMI ID"
                    maxLength={12}
                    inputMode="numeric"
                    autoComplete="off"
                    onChange={(e) => {
                      e.target.value =
                        e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 12);
                    }}
                    disabled={isLoading}
                  />

                </div>

                {/* JOIN BUTTON */}

                <button
                  type="submit"
                  className={`submit-btn ${
                    isLoading ||
                    balance < tournamentEntryFee
                      ? "disabled"
                      : ""
                  }`}
                  disabled={
                    isLoading ||
                    balance < tournamentEntryFee
                  }
                >
                  {isLoading
                    ? "⏳ Processing..."
                    : `✅ JOIN (₹${tournamentEntryFee})`}
                </button>

              </form>
            </>

          )}

        </div>

      </div>
    </div>
  );
};

export default TournamentDetails;