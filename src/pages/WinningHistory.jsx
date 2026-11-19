
import React, { useEffect, useState, useCallback } from "react";
import "./WinningHistory.css";

// ==========================================
// API CONFIGURATION
// ==========================================

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

// ==========================================
// GET LOGGED-IN USER PROFILE ID
// ==========================================

const getProfileId = () => {
  try {
    const storedUser = JSON.parse(
      localStorage.getItem("bgmi_user") || "null"
    );

    const profileId =
      storedUser?.profile_id ||
      storedUser?.user?.profile_id ||
      "";

    if (profileId) {
      return String(profileId).trim();
    }

    const directProfileId =
      localStorage.getItem("profile_id") ||
      localStorage.getItem("profileId");

    if (directProfileId) {
      return directProfileId;
    }

    const otherUser =
      localStorage.getItem("user") ||
      localStorage.getItem("userData") ||
      localStorage.getItem("player");

    if (otherUser) {
      const user = JSON.parse(otherUser);

      return String(
        user?.profile_id ||
        user?.profileId ||
        user?.user?.profile_id ||
        ""
      ).trim();
    }

    return "";
  } catch (error) {
    console.error("Profile ID read error:", error);
    return "";
  }
};

// ==========================================
// GET WINNING AMOUNT
// ==========================================

const getAmount = (item) =>
  Number(
    item.total_winning ??
      item.winner_prize ??
      item.totalWinning ??
      0
  );

// ==========================================
// WINNING HISTORY COMPONENT
// ==========================================

const WinningHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ==========================================
  // FETCH WINNING HISTORY
  // ==========================================

  const fetchWinningHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      // Check API URL
      if (!TOURNAMENT_API) {
        throw new Error("Tournament API URL is not configured.");
      }

      // Get logged-in profile ID
      const profileId = getProfileId();

      if (!profileId) {
        throw new Error(
          "Profile ID not found. Please log out and log in again."
        );
      }

      // API request
      const response = await fetch(
        `${TOURNAMENT_API}/api/my-winning-history?profileId=${encodeURIComponent(
          profileId
        )}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.message ||
            `Winning History API failed (${response.status})`
        );
      }

      // Handle different response formats
      const records = Array.isArray(data)
        ? data
        : Array.isArray(data.history)
        ? data.history
        : Array.isArray(data.data)
        ? data.data
        : [];

      setHistory(records);
    } catch (err) {
      console.error("Winning History Error:", err);

      setError(
        err.message || "Unable to load winning history."
      );

      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ==========================================
  // INITIAL LOAD
  // ==========================================

  useEffect(() => {
    fetchWinningHistory();
  }, [fetchWinningHistory]);

  // ==========================================
  // TOTAL WINNING
  // ==========================================

  const totalWinning = history.reduce((total, item) => {
    const amount = getAmount(item);

    return total + (
      Number.isFinite(amount) ? amount : 0
    );
  }, 0);

  // ==========================================
  // WINNING MATCHES
  // ==========================================

  const winningMatches = history.filter(
    (item) => getAmount(item) > 0
  ).length;

  // ==========================================
  // STATUS
  // ==========================================

  const getStatus = (item) =>
    String(
      item.payout_status ||
      item.status ||
      "Pending"
    ).toLowerCase();

  // ==========================================
  // FORMAT DATE
  // ==========================================

  const formatDate = (date) => {
    if (!date) {
      return "Date unavailable";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return date;
    }

    return parsedDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // ==========================================
  // LOADING SCREEN
  // ==========================================

  if (loading) {
    return (
      <div className="winning-page">
        <div className="winning-loader">
          <div className="winning-spinner"></div>
          <p>Loading Winning History...</p>
        </div>
      </div>
    );
  }

  // ==========================================
  // MAIN UI
  // ==========================================

  return (
    <div className="winning-page">
      <div className="winning-container">

        {/* HEADER */}

        <div className="winning-header">
          <div>
            <span className="winning-subtitle">
              YOUR PERFORMANCE
            </span>

            <h1>🏆 My Winning History</h1>

            <p>
              Track your tournament results and earnings.
            </p>
          </div>

          <button
            className="winning-refresh"
            onClick={fetchWinningHistory}
            disabled={loading}
          >
            ↻ Refresh
          </button>
        </div>

        {/* ERROR */}

        {error && (
          <div className="winning-error">
            <span>⚠️ {error}</span>

            <button onClick={fetchWinningHistory}>
              Retry
            </button>
          </div>
        )}

        {/* SUMMARY */}

        <div className="winning-stats">

          <div className="winning-stat-card total">
            <div className="winning-stat-icon">
              💰
            </div>

            <div>
              <span>Total Winning</span>
              <h2>₹{totalWinning.toFixed(2)}</h2>
            </div>
          </div>

          <div className="winning-stat-card">
            <div className="winning-stat-icon">
              🎮
            </div>

            <div>
              <span>Total Matches</span>
              <h2>{history.length}</h2>
            </div>
          </div>

          <div className="winning-stat-card">
            <div className="winning-stat-icon">
              🏆
            </div>

            <div>
              <span>Winning Matches</span>
              <h2>{winningMatches}</h2>
            </div>
          </div>

        </div>

        {/* HISTORY TITLE */}

        <div className="winning-section-title">
          <div>
            <h2>Match History</h2>
            <p>Your tournament earnings and results</p>
          </div>

          <span className="winning-count">
            {history.length} Records
          </span>
        </div>

        {/* EMPTY STATE */}

        {!error && history.length === 0 && (
          <div className="winning-empty">
            <div>🏆</div>

            <h3>No Winning History Yet</h3>

            <p>
              Your tournament results and winnings will appear here
              after the admin publishes results.
            </p>
          </div>
        )}

        {/* HISTORY CARDS */}

        <div className="winning-list">
          {history.map((item, index) => {
            const prize = getAmount(item);
            const status = getStatus(item);

            return (
              <div
                className="winning-match-card"
                key={item.id || item.result_id || index}
              >

                <div className="winning-card-top">

                  <div className="winning-tournament-info">
                    <div className="winning-trophy">
                      🏆
                    </div>

                    <div>
                      <h3>
                        {item.tournament_name ||
                          item.name ||
                          "Tournament"}
                      </h3>

                      <span>
                        {item.mode || item.type || "Match"}
                        {item.map ? ` • ${item.map}` : ""}
                      </span>
                    </div>
                  </div>

                  <div className={`winning-status ${status}`}>
                    {status === "paid"
                      ? "✓ Paid"
                      : status === "pending"
                      ? "◷ Pending"
                      : status}
                  </div>

                </div>

                <div className="winning-match-details">

                  <div>
                    <span>Match Date</span>

                    <strong>
                      {formatDate(
                        item.tournament_date ||
                        item.date ||
                        item.created_at
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Kills</span>

                    <strong>
                      {item.kills ?? 0}
                    </strong>
                  </div>

                  <div>
                    <span>Rank</span>

                    <strong>
                      {item.rank_position
                        ? `#${item.rank_position}`
                        : "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Winning</span>

                    <strong className="winning-amount">
                      ₹{prize.toFixed(2)}
                    </strong>
                  </div>

                </div>

                {(item.transaction_id || item.transactionId) && (
                  <div className="winning-transaction">
                    <span>Transaction ID</span>

                    <strong>
                      {item.transaction_id ||
                        item.transactionId}
                    </strong>
                  </div>
                )}

              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};

export default WinningHistory;
