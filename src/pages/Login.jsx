
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";

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
// EMAIL HINT
// ==========================================

const EMAIL_HINT_KEY = "bgmi_email_hint";

const getEmailHint = () => {
  try {
    return sessionStorage.getItem(EMAIL_HINT_KEY) || "";
  } catch (error) {
    return "";
  }
};

const saveEmailHint = (value) => {
  try {
    const clean = String(value || "").toLowerCase().trim();

    if (clean) {
      sessionStorage.setItem(EMAIL_HINT_KEY, clean);
    } else {
      sessionStorage.removeItem(EMAIL_HINT_KEY);
    }
  } catch (error) {
    // Storage blocked: ignore
  }
};

// ==========================================
// DEVICE INSTALLATION ID
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

    const iosMatch = userAgent.match(/OS\s([\d_]+)/i);

    osVersion = iosMatch
      ? iosMatch[1].replace(/_/g, ".")
      : "Unknown";

    deviceName = /iPad/i.test(userAgent)
      ? "Apple iPad"
      : "Apple iPhone";
  } else if (/Mac OS X/i.test(userAgent)) {
    operatingSystem = "macOS";

    const macMatch = userAgent.match(/Mac OS X\s([\d_]+)/i);

    osVersion = macMatch
      ? macMatch[1].replace(/_/g, ".")
      : "Unknown";

    deviceName = "Mac";
  } else if (/Linux/i.test(userAgent)) {
    operatingSystem = "Linux";
    osVersion = "Unknown";
    deviceName = "Linux Device";
  }

  if (/iPad|Tablet/i.test(userAgent)) {
    deviceType = "Tablet";
  } else if (/Mobile|Android|iPhone|iPod/i.test(userAgent)) {
    deviceType = "Mobile";
  } else {
    deviceType = "Desktop";
  }

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
  // MOBILE KEYBOARD AUTO SCROLL FIX
  // ==========================================

  useEffect(() => {
    const scrollToFocusedInput = () => {
      const activeElement = document.activeElement;

      if (
        activeElement &&
        activeElement.matches("input, textarea")
      ) {
        setTimeout(() => {
          activeElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
          });
        }, 150);
      }
    };

    document.addEventListener(
      "focusin",
      scrollToFocusedInput
    );

    window.visualViewport?.addEventListener(
      "resize",
      scrollToFocusedInput
    );

    return () => {
      document.removeEventListener(
        "focusin",
        scrollToFocusedInput
      );

      window.visualViewport?.removeEventListener(
        "resize",
        scrollToFocusedInput
      );
    };
  }, []);

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
    } else {
      const hint = getEmailHint();

      if (hint) {
        setEmail(hint);
      }
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

  const saveUserSession = useCallback((freshUser) => {
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
  }, []);

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

  const handleGoogleCredential = useCallback(async (response) => {
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
          mode: "login",
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
  }, [saveUserSession]);

  // ==========================================
  // GOOGLE IDENTITY SERVICES
  // ==========================================

  useEffect(() => {
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

    if (!clientId) {
      console.error("REACT_APP_GOOGLE_CLIENT_ID is missing.");
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
    }

    return () => {
      script?.removeEventListener("load", initializeGoogle);
      script?.removeEventListener("error", handleScriptError);
    };
  }, [handleGoogleCredential]);

  // ==========================================
  // CUSTOM GOOGLE LOGIN BUTTON HANDLER
  // ==========================================

  const handleCustomGoogleLogin = useCallback(() => {
    if (!window.google?.accounts?.id) {
      setError("Google Login is not ready. Please try again.");
      return;
    }

    setGoogleLoading(true);
    setError("");

    window.google.accounts.id.prompt((notification) => {
      if (notification.isDisplayed?.()) return;

      if (notification.isDismissedMoment?.()) {
        if (notification.getDismissedReason?.() === "credential_returned") {
          return;
        }

        setGoogleLoading(false);
        return;
      }

      if (
        notification.isNotDisplayed?.() ||
        notification.isSkippedMoment?.()
      ) {
        setGoogleLoading(false);
        setError("Google popup could not open. Please try again.");
      }
    });
  }, []);

  // ==========================================
  // LOGIN PAGE UI
  // ==========================================

  return (
    <div className="login-wrapper">
      <div className="login-container">

        <div className="login-header">
          <div className="bgmi-logo">🔐</div>

          <h2 className="login-title">
            Login
          </h2>
        </div>

        {showRegisteredMsg && (
          <div className="success-message">
            ✅ Account created successfully! Login now.
          </div>
        )}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form
          onSubmit={handleLogin}
          className="login-form"
        >
          <div className="input-group">
            <input
              id="login-email"
              name="email"
              type="email"
              placeholder="📧 Email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                saveEmailHint(e.target.value);
              }}
              required
              className="input-field"
              autoComplete="email"
            />
          </div>

          <div className="input-group">
            <input
              id="login-password"
              name="password"
              type="password"
              placeholder="🔒 Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-field"
              autoComplete="current-password"
            />
          </div>

          <div className="forgot-password-link">
            <a href="/forgot-password">
              Forgot Password?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="login-button"
          >
            {loading ? "Logging In..." : "🚀 Login"}
          </button>
        </form>

        <div className="google-login-section">
          <div className="google-login-divider">
            OR
          </div>

          <button
            type="button"
            ref={googleButtonRef}
            className="google-login-button"
            aria-label="Login With Google"
            disabled={googleLoading}
            onClick={handleCustomGoogleLogin}
          >
            <svg
              className="google-icon"
              viewBox="0 0 48 48"
              focusable="false"
              aria-hidden="true"
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.72 7.18l7.27 5.64c4.25-3.92 7.49-9.72 7.49-17.29z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.91-5.81l-7.27-5.64c-2.02 1.35-4.61 2.15-8.64 2.15-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>

            <span>Login With Google</span>
          </button>
        </div>

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
