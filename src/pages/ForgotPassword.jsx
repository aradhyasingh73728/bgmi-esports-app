import React, { useState } from "react";
import "./ForgotPassword.css";

const isLocalhost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "[::1]";

const API_URL = isLocalhost
  ? "http://localhost:5001"
  : import.meta.env.VITE_API_URL ||
    "https://user-register-server.onrender.com";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [step, setStep] = useState(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      setStep(2);
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

      setSuccess("✅ Password reset successfully! You can now login.");
      setStep(3);

      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
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
    setError("");
    setSuccess("");
    setLoading(true);

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
      setSuccess("✅ New reset OTP sent to your email.");
    } catch (err) {
      setError(err.message || "Could not resend OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-wrapper">
      <div className="forgot-container">
        <div className="forgot-header">
          <div className="forgot-logo"></div>

          <h2 className="forgot-title">
            {step === 1 && "FORGOT PASSWORD"}
            {step === 2 && "RESET PASSWORD"}
            {step === 3 && "PASSWORD UPDATED"}
          </h2>

          <p className="forgot-subtitle">
            {step === 1 && "Enter your registered email address"}
            {step === 2 && "Verify OTP and create your new password"}
            {step === 3 && "Your password has been changed"}
          </p>
        </div>

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
                type="email"
                className="forgot-input"
                placeholder="📧 Registered Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <button
              type="submit"
              className="forgot-button"
              disabled={loading}
            >
              {loading ? "SENDING OTP..." : "📩 SEND RESET OTP"}
            </button>
          </form>
        )}

        {/* STEP 2: OTP + NEW PASSWORD */}

        {step === 2 && (
          <form onSubmit={handleResetPassword}>
            <div className="forgot-email-display">
              OTP sent to:
              <strong>{email}</strong>
            </div>

            <div className="forgot-input-group">
              <input
                type="text"
                className="forgot-input"
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

            <div className="forgot-input-group">
              <input
                type="password"
                className="forgot-input"
                placeholder="🔒 New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>

            <div className="forgot-input-group">
              <input
                type="password"
                className="forgot-input"
                placeholder="🔐 Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>

            <button
              type="submit"
              className="forgot-button"
              disabled={loading}
            >
              {loading ? "RESETTING PASSWORD..." : "🔐 RESET PASSWORD"}
            </button>

            <button
              type="button"
              className="forgot-secondary-button"
              onClick={handleResendOtp}
              disabled={loading}
            >
              {loading ? "PLEASE WAIT..." : "🔄 RESEND OTP"}
            </button>

            <button
              type="button"
              className="forgot-text-button"
              onClick={() => {
                setStep(1);
                setOtp("");
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

            <p>
              Your new password has been saved.
            </p>

            <a href="/login" className="forgot-button forgot-login-button">
              🚀 BACK TO LOGIN
            </a>
          </div>
        )}

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