import React, { useState, useEffect } from "react";
import "./ForgotPassword.css";

// ==========================================
// API URL - LOCAL + LIVE (Create React App)
// ==========================================

const isLocalhost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "[::1]";

const API_URL = isLocalhost
  ? "http://localhost:5001"
  : process.env.REACT_APP_API_URL ||
    "https://user-register-server-5001.onrender.com";

const RESEND_SECONDS = 60;

// ==========================================
// EMAIL HINT (shared with Login page)
// Only the email is remembered, never the password.
// sessionStorage clears when the tab is closed.
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
    // Storage blocked: ignore, autofill is only a convenience
  }
};

// ==========================================
// FORGOT PASSWORD COMPONENT
// ==========================================

const ForgotPassword = () => {
  // Email is pre-filled if the user already typed it on the Login page
  const [email, setEmail] = useState(() => getEmailHint());
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [step, setStep] = useState(1);

  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ==========================================
  // RESEND COUNTDOWN
  // ==========================================

  useEffect(() => {
    if (resendTimer <= 0) return undefined;

    const timer = setTimeout(() => {
      setResendTimer((seconds) => seconds - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [resendTimer]);

  // ==========================================
  // EMAIL INPUT CHANGE (also remembers the email)
  // ==========================================

  const handleEmailChange = (e) => {
    const value = e.target.value;

    setEmail(value);
    saveEmailHint(value);
  };

  // ==========================================
  // SEND RESET OTP
  // ==========================================

  const handleSendOtp = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    const cleanEmail = email.toLowerCase().trim();

    try {
      const res = await fetch(`${API_URL}/api/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: cleanEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Could not send OTP");
      }

      setEmail(cleanEmail);
      saveEmailHint(cleanEmail);
      setStep(2);
      setResendTimer(RESEND_SECONDS);
      setSuccess(`✅ Reset OTP sent to ${cleanEmail}`);
    } catch (err) {
      setError(err.message || "Could not send reset OTP");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // RESET PASSWORD
  // ==========================================

  const handleResetPassword = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (otp.length !== 6) {
      setError("❌ Please enter the 6-digit OTP.");
      return;
    }

    if (newPassword.length < 8) {
      setError("❌ Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("❌ Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          otp: otp.trim(),
          newPassword: newPassword.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Password reset failed");
      }

      // Email hint stays saved, so the Login page opens with the email filled
      saveEmailHint(email);

      setSuccess("✅ Password reset successfully! You can now login.");
      setStep(3);

      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPassword(false);
    } catch (err) {
      setError(err.message || "Password reset failed");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // RESEND OTP
  // ==========================================

  const handleResendOtp = async () => {
    if (resendTimer > 0 || resendLoading) return;

    setError("");
    setSuccess("");
    setResendLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Could not resend OTP");
      }

      setOtp("");
      setResendTimer(RESEND_SECONDS);
      setSuccess("✅ New reset OTP sent to your email.");
    } catch (err) {
      setError(err.message || "Could not resend OTP");
    } finally {
      setResendLoading(false);
    }
  };

  // ==========================================
  // PASSWORD HINT
  // ==========================================

  const passwordTooShort =
    newPassword.length > 0 && newPassword.length < 8;

  const passwordsMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword;

  const passwordsDiffer =
    confirmPassword.length > 0 && newPassword !== confirmPassword;

  // ==========================================
  // UI
  // ==========================================

  return (
    <div className="forgot-wrapper">
      <div className="forgot-container">

        {/* HEADER */}

        <div className="forgot-header">
          <div className="forgot-logo">
            {step === 3 ? "✅" : "🔑"}
          </div>

          <h2 className="forgot-title">
            {step === 1 && "Forgot Password"}
            {step === 2 && "Reset Password"}
            {step === 3 && "Password Updated"}
          </h2>

          <p className="forgot-subtitle">
            {step === 1 && "Enter your registered email address"}
            {step === 2 && "Verify the OTP and create a new password"}
            {step === 3 && "Your password has been changed"}
          </p>
        </div>

        {/* STEP PROGRESS */}

        <div className="forgot-steps" aria-hidden="true">
          {[1, 2, 3].map((number) => (
            <React.Fragment key={number}>
              <div
                className={`forgot-step-dot ${
                  step === number ? "active" : ""
                } ${step > number ? "done" : ""}`}
              >
                {step > number ? "✓" : number}
              </div>

              {number < 3 && (
                <div
                  className={`forgot-step-line ${
                    step > number ? "done" : ""
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* MESSAGES */}

        {error && (
          <div className="forgot-error" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="forgot-success" role="status">
            {success}
          </div>
        )}

        {/* STEP 1: EMAIL */}

        {step === 1 && (
          <form onSubmit={handleSendOtp}>
            <div className="forgot-input-group">
              <input
                id="forgot-email"
                name="email"
                type="email"
                className="forgot-input"
                placeholder="📧 Registered Email"
                value={email}
                onChange={handleEmailChange}
                autoComplete="email"
                required
              />
            </div>

            <button
              type="submit"
              className="forgot-button"
              disabled={loading}
            >
              {loading ? "Sending OTP..." : "📩 Send Reset OTP"}
            </button>
          </form>
        )}

        {/* STEP 2: OTP + NEW PASSWORD */}

        {step === 2 && (
          <form onSubmit={handleResetPassword}>
            {/* Hidden username so the browser can offer to save the new password */}
            <input
              type="text"
              name="username"
              value={email}
              autoComplete="username"
              readOnly
              tabIndex={-1}
              aria-hidden="true"
              style={{
                position: "absolute",
                width: 0,
                height: 0,
                opacity: 0,
                pointerEvents: "none",
              }}
            />

            <div className="forgot-email-display">
              OTP sent to
              <strong>{email}</strong>
            </div>

            <div className="forgot-input-group">
              <input
                type="text"
                name="otp"
                className="forgot-input forgot-otp-input"
                placeholder="🔢 6-Digit OTP"
                value={otp}
                onChange={(e) =>
                  setOtp(
                    e.target.value.replace(/\D/g, "").slice(0, 6)
                  )
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
              />
            </div>

            <div className="forgot-input-group forgot-password-field">
              <input
                type={showPassword ? "text" : "password"}
                name="new-password"
                className="forgot-input"
                placeholder="🔒 New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />

              <button
                type="button"
                className="forgot-eye-button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={
                  showPassword ? "Hide password" : "Show password"
                }
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>

            {passwordTooShort && (
              <p className="forgot-hint forgot-hint-bad">
                Use at least 8 characters
              </p>
            )}

            <div className="forgot-input-group">
              <input
                type={showPassword ? "text" : "password"}
                name="confirm-new-password"
                className="forgot-input"
                placeholder="🔐 Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>

            {passwordsMatch && (
              <p className="forgot-hint forgot-hint-good">
                ✓ Passwords match
              </p>
            )}

            {passwordsDiffer && (
              <p className="forgot-hint forgot-hint-bad">
                Passwords do not match
              </p>
            )}

            <button
              type="submit"
              className="forgot-button"
              disabled={loading}
            >
              {loading ? "Resetting Password..." : "🔐 Reset Password"}
            </button>

            <button
              type="button"
              className="forgot-secondary-button"
              onClick={handleResendOtp}
              disabled={resendLoading || resendTimer > 0}
            >
              {resendLoading
                ? "Sending..."
                : resendTimer > 0
                ? `Resend OTP in ${resendTimer}s`
                : "🔄 Resend OTP"}
            </button>

            <button
              type="button"
              className="forgot-text-button"
              onClick={() => {
                setStep(1);
                setOtp("");
                setNewPassword("");
                setConfirmPassword("");
                setShowPassword(false);
                setResendTimer(0);
                setError("");
                setSuccess("");
              }}
            >
              Change Email
            </button>
          </form>
        )}

        {/* STEP 3: SUCCESS */}

        {step === 3 && (
          <div className="forgot-complete">
            <div className="forgot-success-icon">✓</div>

            <p>Your new password has been saved.</p>

            <a
              href="/login"
              className="forgot-button forgot-login-button"
            >
              🚀 Back to Login
            </a>
          </div>
        )}

        {/* FOOTER */}

        {step !== 3 && (
          <div className="forgot-footer">
            <a href="/login">← Back to Login</a>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;