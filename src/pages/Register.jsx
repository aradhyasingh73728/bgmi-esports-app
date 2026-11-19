
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";

import "./Register.css";

// ==========================================
// API URL - CREATE REACT APP
// ==========================================

const isLocalhost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "[::1]";

const API_URL = isLocalhost
  ? "http://localhost:5001"
  : process.env.REACT_APP_API_URL ||
    "https://user-register-server-5001.onrender.com";

const GOOGLE_CLIENT_ID =
  process.env.REACT_APP_GOOGLE_CLIENT_ID;

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
// REGISTER COMPONENT
// ==========================================

const Register = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const googleButtonRef = useRef(null);

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
  // GOOGLE LOGIN / REGISTER
  // ==========================================

  const handleGoogleCredential = useCallback(async (response) => {
    setError("");
    setSuccess("");
    setGoogleLoading(true);

    try {
      if (!response?.credential) {
        throw new Error("Google credential not received.");
      }

      const deviceDetails = getDeviceDetails();

      console.log(
        "GOOGLE REGISTER DEVICE INFO:",
        deviceDetails
      );

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
          data.error || "Google registration failed."
        );
      }

      console.log(
        "GOOGLE REGISTER SUCCESS:",
        data.user.profile_id
      );

      saveUserSession(data.user);

    } catch (err) {
      console.error("GOOGLE REGISTER ERROR:", err);

      setError(
        err.message || "Google registration failed."
      );
    } finally {
      setGoogleLoading(false);
    }
  }, [saveUserSession]);

  // ==========================================
  // GOOGLE IDENTITY SERVICES
  // ==========================================

  useEffect(() => {
    if (otpSent) return;

    if (!GOOGLE_CLIENT_ID) {
      console.error(
        "REACT_APP_GOOGLE_CLIENT_ID is missing."
      );
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
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        auto_select: false,
      });

      googleButtonRef.current.innerHTML = "";

      window.google.accounts.id.renderButton(
        googleButtonRef.current,
        {
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text: "continue_with",
          width: 280,
        }
      );
    };

    const handleScriptError = () => {
      console.error("GOOGLE SCRIPT LOAD FAILED");

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

      if (createdScript) {
        script.onload = null;
        script.onerror = null;
      }
    };
  }, [otpSent, handleGoogleCredential]);

  // ==========================================
  // NORMAL REGISTRATION
  // ==========================================

  const handleRegister = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    if (
      !username.trim() ||
      !email.trim() ||
      !password ||
      !confirmPassword
    ) {
      setError("❌ Please fill in all fields!");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("❌ Passwords do not match!");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError(
        "The password must be at least 6 characters long ⚠️"
      );
      setLoading(false);
      return;
    }

    try {
      const cleanEmail = email.toLowerCase().trim();
      const deviceDetails = getDeviceDetails();

      const payload = {
        username: username.trim(),
        email: cleanEmail,
        password: password.trim(),

        ...deviceDetails,
      };

      console.log(
        "REGISTER DEVICE INFO:",
        deviceDetails
      );

      const res = await fetch(`${API_URL}/api/register`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(
          data.error || data.message || "Registration failed"
        );
      }

      setOtpSent(true);
      setSuccess("✅ OTP has been sent successfully.");

    } catch (err) {
      console.error("REGISTER ERROR:", err);

      setError(
        err.message || "Registration failed"
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // VERIFY OTP
  // ==========================================

  const handleVerifyOtp = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");
    setOtpLoading(true);

    if (!otp || otp.length !== 6) {
      setError("❌ Please enter a 6-digit OTP!");
      setOtpLoading(false);
      return;
    }

    try {
      const deviceDetails = getDeviceDetails();

      const payload = {
        email: email.toLowerCase().trim(),
        otp: otp.trim(),

        ...deviceDetails,
      };

      console.log(
        "OTP VERIFICATION DEVICE INFO:",
        deviceDetails
      );

      const res = await fetch(
        `${API_URL}/api/verify-otp`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(
          data.error ||
            data.message ||
            "OTP verification failed"
        );
      }

      const freshUser = data.user;

      const userData = {
        id: freshUser.id,
        username: freshUser.username,
        email: freshUser.email,
        profile_id: freshUser.profile_id,
        verified: true,
        balance: freshUser.balance || 0,
        backend_token: freshUser.token || "",
      };

      localStorage.setItem(
        "bgmi_user",
        JSON.stringify(userData)
      );

      setSuccess(
        "✅ Email verified successfully! Redirecting..."
      );

      setTimeout(() => {
        window.location.href = "/profile";
      }, 1000);

    } catch (err) {
      console.error(
        "OTP VERIFICATION ERROR:",
        err
      );

      setError(
        err.message || "OTP verification failed"
      );
    } finally {
      setOtpLoading(false);
    }
  };

  // ==========================================
  // RESEND OTP
  // ==========================================

  const handleResendOtp = async () => {
    setError("");
    setSuccess("");
    setResendLoading(true);

    try {
      const deviceDetails = getDeviceDetails();

      const payload = {
        email: email.toLowerCase().trim(),

        ...deviceDetails,
      };

      console.log(
        "RESEND OTP DEVICE INFO:",
        deviceDetails
      );

      const res = await fetch(
        `${API_URL}/api/resend-otp`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(
          data.error ||
            data.message ||
            "Could not resend OTP"
        );
      }

      setOtp("");

      setSuccess(
        "✅ A new OTP has been sent to your email."
      );

    } catch (err) {
      console.error("RESEND OTP ERROR:", err);

      setError(
        err.message || "Could not resend OTP"
      );
    } finally {
      setResendLoading(false);
    }
  };

  // ==========================================
  // REGISTER PAGE UI
  // ==========================================

  return (
    <div className="register-wrapper">
      <div className="register-container">

        {!otpSent ? (
          <>
            <h2 className="register-title">
              Register
            </h2>

            <p className="register-subtitle">
              Create your gaming account
            </p>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {success && (
              <div className="success-message">
                {success}
              </div>
            )}

            {/* NORMAL REGISTRATION */}

            <form onSubmit={handleRegister}>
              <div className="input-group">
                <input
                  className="input-field"
                  type="text"
                  placeholder="🎮 Username"
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value)
                  }
                  autoComplete="username"
                  required
                />
              </div>

              <div className="input-group">
                <input
                  className="input-field"
                  type="email"
                  placeholder="📧 Email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  autoComplete="email"
                  required
                />
              </div>

              <div className="input-group">
                <input
                  className="input-field"
                  type="password"
                  placeholder="🔒 Password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="input-group">
                <input
                  className="input-field"
                  type="password"
                  placeholder="🔐 Confirm Password"
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value)
                  }
                  autoComplete="new-password"
                  required
                />
              </div>

              <button
                className="register-button"
                type="submit"
                disabled={loading || googleLoading}
              >
                {loading
                  ? "Sending OTP..."
                  : "🔥 Create Account"}
              </button>
            </form>

            {/* GOOGLE REGISTRATION */}

            <div className="google-register-section">
              <div className="google-register-divider">
                OR
              </div>

              <div
                ref={googleButtonRef}
                className="google-register-button"
              />

              {googleLoading && (
                <p className="google-loading-message">
                  Google registration processing...
                </p>
              )}
            </div>

            {/* LOGIN LINK */}

            <div className="login-link">
              Already registered?{" "}
              <a
                href="/login"
                className="login-btn"
              >
                Login
              </a>
            </div>
          </>
        ) : (
          <>
            <h2 className="register-title">
              Verify Email
            </h2>

            <p className="register-subtitle">
              OTP sent to
              <br />
              <strong>
                {email.toLowerCase().trim()}
              </strong>
            </p>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {success && (
              <div className="success-message">
                {success}
              </div>
            )}

            <form onSubmit={handleVerifyOtp}>
              <div className="input-group">
                <input
                  className="input-field"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="🔢 Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) =>
                    setOtp(
                      e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 6)
                    )
                  }
                  autoComplete="one-time-code"
                  required
                />
              </div>

              <button
                className="register-button"
                type="submit"
                disabled={otpLoading}
              >
                {otpLoading
                  ? "Verifying..."
                  : "✅ Verify Email"}
              </button>
            </form>

            <button
              type="button"
              className="login-btn"
              onClick={handleResendOtp}
              disabled={resendLoading}
              style={{
                marginTop: "15px",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              {resendLoading
                ? "Sending..."
                : "🔄 Resend OTP"}
            </button>

            <div className="login-link">
              Entered the wrong email?{" "}

              <button
                type="button"
                onClick={() => {
                  setOtpSent(false);
                  setOtp("");
                  setError("");
                  setSuccess("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Go Back
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
};

export default Register;
