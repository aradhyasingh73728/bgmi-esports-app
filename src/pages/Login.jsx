
import React, { useState, useEffect } from "react";
import "./Login.css";

// ==========================================
// LIVE BACK4APP API
// ==========================================

const API_URL = "https://userregisterserver-ix3941s5.back4.app";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showRegisteredMsg, setShowRegisteredMsg] = useState(false);

  useEffect(() => {
    const savedEmail = sessionStorage.getItem("auto_login_email");
    const savedPassword = sessionStorage.getItem("auto_login_password");

    const urlParams = new URLSearchParams(window.location.search);
    const registeredParam = urlParams.get("registered");

    if (savedEmail) setEmail(savedEmail);
    if (savedPassword) setPassword(savedPassword);

    if (registeredParam === "1") {
      setShowRegisteredMsg(true);

      const timer = setTimeout(() => {
        setShowRegisteredMsg(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, []);

  // ==========================================
  // LOGIN
  // ==========================================

  const handleLogin = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const loginRes = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password: password.trim(),
        }),
      });

      const serverData = await loginRes.json();

      if (!loginRes.ok || !serverData.success) {
        throw new Error(serverData.error || "❌ Login failed!");
      }

      const freshUser = serverData.user;

      const userData = {
        id: freshUser.id,
        username: freshUser.username,
        email: freshUser.email,
        profile_id: freshUser.profile_id,
        verified: Boolean(freshUser.verified),
        balance: freshUser.balance || 0,
        backend_token: freshUser.token || "",
      };

      localStorage.setItem(
        "bgmi_user",
        JSON.stringify(userData)
      );

      sessionStorage.removeItem("auto_login_email");
      sessionStorage.removeItem("auto_login_password");

      window.location.href = "/profile";

    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "❌ Login failed!");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // LOGIN PAGE UI
  // ==========================================

  return (
    <div className="login-wrapper">
      <div className="login-container">

        {/* HEADER */}

        <div className="login-header">
          <div className="bgmi-logo">🔐</div>

          <h2 className="login-title">
            Login
          </h2>
        </div>

        {/* REGISTRATION SUCCESS */}

        {showRegisteredMsg && (
          <div className="success-message">
            ✅ Account created successfully! Login Now.
          </div>
        )}

        {/* ERROR MESSAGE */}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* LOGIN FORM */}

        <form
          onSubmit={handleLogin}
          className="login-form"
        >

          {/* EMAIL */}

          <div className="input-group">
            <input
              type="email"
              placeholder="📧 Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-field"
              autoComplete="email"
            />
          </div>

          {/* PASSWORD */}

          <div className="input-group">
            <input
              type="password"
              placeholder="🔒 Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-field"
              autoComplete="current-password"
            />
          </div>

          {/* FORGOT PASSWORD */}

          <div className="forgot-password-link">
            <a href="/forgot-password">
              Forgot Password?
            </a>
          </div>

          {/* LOGIN BUTTON */}

          <button
            type="submit"
            disabled={loading}
            className="login-button"
          >
            {loading ? "Logging In..." : "🚀 Login"}
          </button>

        </form>

        {/* FOOTER */}

        <div className="login-footer">
          <p className="register-link">
            New player?{" "}

            <a
              href="/register"
              className="register-btn"
            >
              Register Now
            </a>
          </p>
        </div>

      </div>
    </div>
  );
};

export default Login;
