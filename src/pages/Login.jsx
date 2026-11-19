
import React, { useState, useEffect, useRef } from "react";
import "./Login.css";

// ==========================================
// API URL - LOCAL + LIVE
// ==========================================

const isLocalhost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "[::1]";

const API_URL = isLocalhost
  ? "http://localhost:5001"
  : process.env.REACT_APP_API_URL ||
    "https://user-register-server-5001.onrender.com";

// ==========================================
// DEVICE INSTALLATION ID
// SAME KEY AS Register.jsx
// ==========================================

const getInstallationId = () => {
  try {
    let installationId = localStorage.getItem(
      "bgmi_installation_id"
    );

    if (!installationId) {
      if (
        window.crypto &&
        typeof window.crypto.randomUUID === "function"
      ) {
        installationId = window.crypto.randomUUID();
      } else {
        installationId =
          "bgmi-" +
          Date.now().toString(36) +
          "-" +
          Math.random().toString(36).substring(2) +
          Math.random().toString(36).substring(2);
      }

      localStorage.setItem(
        "bgmi_installation_id",
        installationId
      );
    }

    return installationId;
  } catch (error) {
    console.error("DEVICE ID ERROR:", error);

    throw new Error(
      "Device identification failed. Please enable browser storage."
    );
  }
};

// ==========================================
// DEVICE INFORMATION
// SAME FORMAT AS Register.jsx
// ==========================================

const getDeviceDetails = () => {
  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "Unknown";

  let deviceName = "Unknown Device";
  let operatingSystem = "Unknown OS";
  let osVersion = "Unknown";
  let browserName = "Unknown Browser";
  let browserVersion = "Unknown";
  let deviceType = "Desktop";

  // OPERATING SYSTEM

  if (/Windows NT 10\.0/i.test(userAgent)) {
    operatingSystem = "Windows";
    osVersion = "10 or 11";
    deviceName = "Windows PC";
  } else if (/Windows NT 6\.3/i.test(userAgent)) {
    operatingSystem = "Windows";
    osVersion = "8.1";
    deviceName = "Windows PC";
  } else if (/Windows NT 6\.2/i.test(userAgent)) {
    operatingSystem = "Windows";
    osVersion = "8";
    deviceName = "Windows PC";
  } else if (/Android/i.test(userAgent)) {
    operatingSystem = "Android";

    const androidMatch = userAgent.match(/Android\s([\d.]+)/i);
    osVersion = androidMatch ? androidMatch[1] : "Unknown";

    deviceName = "Android Device";
  } else if (/iPhone|iPad|iPod/i.test(userAgent)) {
    operatingSystem = "iOS";

    const iosMatch = userAgent.match(/OS\s([\d\_]+)/i);
    osVersion = iosMatch
      ? iosMatch[1].replace(/\_/g, ".")
      : "Unknown";

    deviceName = /iPad/i.test(userAgent)
      ? "Apple iPad"
      : "Apple iPhone";
  } else if (/Mac OS X/i.test(userAgent)) {
    operatingSystem = "macOS";

    const macMatch = userAgent.match(/Mac OS X\s([\d\_]+)/i);
    osVersion = macMatch
      ? macMatch[1].replace(/\_/g, ".")
      : "Unknown";

    deviceName = "Mac";
  } else if (/Linux/i.test(userAgent)) {
    operatingSystem = "Linux";
    osVersion = "Unknown";
    deviceName = "Linux Device";
  }

  // DEVICE TYPE

  if (/iPad|Tablet/i.test(userAgent)) {
    deviceType = "Tablet";
  } else if (/Mobile|Android|iPhone|iPod/i.test(userAgent)) {
    deviceType = "Mobile";
  } else {
    deviceType = "Desktop";
  }

  // BROWSER NAME AND VERSION

  let browserMatch = null;

  if (/Edg\//i.test(userAgent)) {
    browserName = "Microsoft Edge";
    browserMatch = userAgent.match(/Edg\/([\d.]+)/i);
  } else if (/OPR\//i.test(userAgent)) {
    browserName = "Opera";
    browserMatch = userAgent.match(/OPR\/([\d.]+)/i);
  } else if (/SamsungBrowser\//i.test(userAgent)) {
    browserName = "Samsung Internet";
    browserMatch = userAgent.match(/SamsungBrowser\/([\d.]+)/i);
  } else if (/Firefox\//i.test(userAgent)) {
    browserName = "Firefox";
    browserMatch = userAgent.match(/Firefox\/([\d.]+)/i);
  } else if (/Chrome\//i.test(userAgent)) {
    browserName = "Google Chrome";
    browserMatch = userAgent.match(/Chrome\/([\d.]+)/i);
  } else if (/Safari\//i.test(userAgent)) {
    browserName = "Safari";
    browserMatch = userAgent.match(/Version\/([\d.]+)/i);
  }

  browserVersion = browserMatch
    ? browserMatch[1]
    : "Unknown";

  // TIMEZONE

  let timezone = "Unknown";

  try {
    timezone =
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "Unknown";
  } catch (error) {
    timezone = "Unknown";
  }

  return {
    installationId: getInstallationId(),

    deviceName,
    operatingSystem,
    osVersion,

    browserName,
    browserVersion,

    deviceType,

    screenWidth: window.screen?.width || null,
    screenHeight: window.screen?.height || null,

    language: navigator.language || "Unknown",
    timezone,

    platform,
  };
};

// ==========================================
// LOGIN COMPONENT
// ==========================================

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [error, setError] = useState("");
  const [showRegisteredMsg, setShowRegisteredMsg] = useState(false);

  const googleButtonRef = useRef(null);

  // ==========================================
  // PAGE LOAD
  // ==========================================

  useEffect(() => {
    const savedEmail = sessionStorage.getItem(
      "auto_login_email"
    );

    const savedPassword = sessionStorage.getItem(
      "auto_login_password"
    );

    const urlParams = new URLSearchParams(
      window.location.search
    );

    const registeredParam = urlParams.get("registered");

    if (savedEmail) {
      setEmail(savedEmail);
    }

    if (savedPassword) {
      setPassword(savedPassword);
    }

    if (registeredParam === "1") {
      setShowRegisteredMsg(true);

      const timer = setTimeout(() => {
        setShowRegisteredMsg(false);
      }, 5000);

      try {
        getInstallationId();
      } catch (error) {
        console.error(error);
      }

      return () => clearTimeout(timer);
    }

    try {
      getInstallationId();
    } catch (error) {
      console.error(error);
      setError(error.message);
    }
  }, []);

  // ==========================================
  // COMMON SAVE USER SESSION
  // ==========================================

  const saveUserSession = (freshUser) => {
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
  };

  // ==========================================
  // NORMAL EMAIL + PASSWORD LOGIN
  // ==========================================

  const handleLogin = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const deviceDetails = getDeviceDetails();

      const payload = {
        email: email.toLowerCase().trim(),
        password: password.trim(),

        ...deviceDetails,
      };

      console.log("LOGIN DEVICE INFO:", deviceDetails);

      const loginRes = await fetch(`${API_URL}/api/login`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(payload),
      });

      const serverData = await loginRes.json();

      if (!loginRes.ok || !serverData.success) {
        throw new Error(
          serverData.error || "Login failed. Please try again."
        );
      }

      saveUserSession(serverData.user);

    } catch (err) {
      console.error("LOGIN ERROR:", err);

      setError(
        err.message || "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // GOOGLE LOGIN
  // ==========================================

  const handleGoogleCredential = async (response) => {
    setError("");
    setGoogleLoading(true);

    try {
      if (!response?.credential) {
        throw new Error("Google credential not received.");
      }

      const deviceDetails = getDeviceDetails();

      console.log("GOOGLE LOGIN DEVICE INFO:", deviceDetails);

      const res = await fetch(`${API_URL}/api/google-login`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          credential: response.credential,
          ...deviceDetails,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(
          data.error || "Google login failed. Please try again."
        );
      }

      console.log("GOOGLE LOGIN SUCCESS:", data.user.profile_id);

      saveUserSession(data.user);

    } catch (err) {
      console.error("GOOGLE LOGIN ERROR:", err);

      setError(
        err.message || "Google login failed. Please try again."
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  // ==========================================
  // GOOGLE IDENTITY SERVICES
  // ==========================================

  useEffect(() => {
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

    if (!clientId) {
      console.error("VITE_GOOGLE_CLIENT_ID is missing.");
      setError("Google Login configuration is missing.");
      return;
    }

    let script = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]'
    );

    let createdScript = false;

    const initializeGoogle = () => {
      if (
        !window.google?.accounts?.id ||
        !googleButtonRef.current
      ) {
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredential,
      });

      googleButtonRef.current.innerHTML = "";

      window.google.accounts.id.renderButton(
        googleButtonRef.current,
        {
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text: "continue_with",
          width: 300,
        }
      );
    };

    const handleScriptError = () => {
      setError(
        "Could not load Google Login. Please try again."
      );
    };

    if (script) {
      if (window.google?.accounts?.id) {
        initializeGoogle();
      } else {
        script.addEventListener("load", initializeGoogle);
        script.addEventListener("error", handleScriptError);
      }
    } else {
      script = document.createElement("script");

      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;

      script.onload = initializeGoogle;
      script.onerror = handleScriptError;

      document.head.appendChild(script);
      createdScript = true;
    }

    return () => {
      script?.removeEventListener("load", initializeGoogle);
      script?.removeEventListener("error", handleScriptError);

      // Keep the shared Google script available for other pages.
      if (createdScript) {
        script.onload = null;
        script.onerror = null;
      }
    };
  }, []);

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
            ✅ Account created successfully! Login now.
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
            disabled={loading || googleLoading}
            className="login-button"
          >
            {loading ? "Logging In..." : "🚀 Login"}
          </button>

        </form>

        {/* GOOGLE LOGIN */}

        <div className="google-login-section">

          <div className="google-login-divider">
            OR
          </div>

          <div
            ref={googleButtonRef}
            className="google-login-button"
          ></div>

          {googleLoading && (
            <p className="google-loading-message">
              Google login processing...
            </p>
          )}

        </div>

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
