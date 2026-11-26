
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
          mode: "register",
          ...deviceDetails,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.code === "ACCOUNT_EXISTS") {
          setError("Already registered with this Gmail. Please login.");
          return;
        }

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
  // CUSTOM GOOGLE SIGN-UP BUTTON HANDLER
  // ==========================================

  const handleCustomGoogleSignUp = useCallback(() => {
    if (!window.google?.accounts?.id) {
      setError("Google Sign-Up is not ready. Please try again.");
      return;
    }

    setGoogleLoading(true);
    setError("");
    setSuccess("");

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

              <button
                type="button"
                ref={googleButtonRef}
                className="google-register-button"
                aria-label="Sign up with Google"
                disabled={googleLoading}
                onClick={handleCustomGoogleSignUp}
              >
                <svg className="google-icon" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.16v2.85A11 11 0 0 0 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.36-2.11V7.04H2.16A11 11 0 0 0 1 12c0 1.78.43 3.46 1.16 4.96l3.68-2.87z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.08.56 4.23 1.66l3.17-3.17C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.16 7.04l3.68 2.87C6.71 7.3 9.14 5.38 12 5.38z"
                    fill="#EA4335"
                  />
                </svg>

                <span>Sign up with Google</span>
              </button>

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
