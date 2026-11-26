import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Profile.css";

const isLocalhost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "[::1]";

const API_URL = (
  isLocalhost
    ? "http://localhost:5001"
    : import.meta.env.VITE_API_URL ||
      "https://user-register-server-5001.onrender.com"
).replace(/\/+$/, "");

const MAX_FILE_SIZE = 2 * 1024 * 1024;

// Built-in gaming avatars
const gamingAvatars = Array.from(
  { length: 12 },
  (_, i) => `/avatars/avatar${i + 1}.svg`
);

const getFallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "User"
  )}&background=1e40af&color=fff&size=512`;

const getStorage = () =>
  localStorage.getItem("bgmi_user") ? localStorage : sessionStorage;

const getStoredUser = () => {
  try {
    return JSON.parse(
      localStorage.getItem("bgmi_user") ||
        sessionStorage.getItem("bgmi_user") ||
        "null"
    );
  } catch {
    return null;
  }
};

const getToken = (user) =>
  user?.backend_token || user?.token || null;

const clearSession = () => {
  localStorage.removeItem("bgmi_user");
  sessionStorage.removeItem("bgmi_user");
};

const Profile = () => {
  const navigate = useNavigate();

  // Local loading states — no global LoadingContext
  const [profile, setProfile] = useState(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isAvatarUpdating, setIsAvatarUpdating] = useState(false);

  const [isEditingAvatar, setIsEditingAvatar] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // ============================================================
  // LOAD PROFILE
  // ============================================================

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        const parsedUser = getStoredUser();
        const token = getToken(parsedUser);

        if (!parsedUser || !token) {
          navigate("/login");
          return;
        }

        // Show locally stored profile immediately
        if (isMounted) {
          setProfile({
            id: parsedUser.profile_id || "BGMI-Loading...",
            name: parsedUser.username || "User",
            avatar:
              parsedUser.avatar ||
              getFallbackAvatar(parsedUser.username),
            email: parsedUser.email,
          });
        }

        // Fetch fresh profile data
        const serverRes = await fetch(
          `${API_URL}/api/my-profile`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (
          serverRes.status === 401 ||
          serverRes.status === 403
        ) {
          clearSession();
          navigate("/login");
          return;
        }

        if (!serverRes.ok) {
          console.warn(
            "my-profile failed:",
            serverRes.status
          );
          return;
        }

        const serverData = await serverRes.json();

        if (serverData.success && serverData.user && isMounted) {
          const freshUser = serverData.user;

          // Preserve token when updating stored user data
          getStorage().setItem(
            "bgmi_user",
            JSON.stringify({
              ...freshUser,
              backend_token: token,
            })
          );

          setProfile({
            id: freshUser.profile_id || parsedUser.profile_id,
            name: freshUser.username || parsedUser.username || "User",
            avatar:
              freshUser.avatar ||
              getFallbackAvatar(freshUser.username),
            email: freshUser.email || parsedUser.email,
          });
        }
      } catch (error) {
        console.error("Profile loading error:", error);
      } finally {
        if (isMounted) {
          setIsInitialLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  // ============================================================
  // PREVIEW URL CLEANUP
  // ============================================================

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // ============================================================
  // RESET AVATAR MODAL
  // ============================================================

  const resetAvatarModal = () => {
    if (isAvatarUpdating) return;

    setSelectedFile(null);
    setPreviewUrl(null);
    setIsEditingAvatar(false);
  };

  // ============================================================
  // FILE VALIDATION
  // ============================================================

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      e.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert("Image size must be less than 2MB.");
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // ============================================================
  // UPDATE AVATAR
  // ============================================================

  const handleUpdateAvatar = async (avatarSource) => {
    if (!avatarSource || isAvatarUpdating) return;

    setIsAvatarUpdating(true);

    try {
      const storedUser = getStoredUser();
      const token = getToken(storedUser);

      if (!storedUser || !token) {
        alert("Your session has expired. Please log in again.");
        clearSession();
        navigate("/login");
        return;
      }

      let bodyData;

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      if (typeof avatarSource === "string") {
        // Default gaming avatar
        bodyData = JSON.stringify({
          avatarUrl: avatarSource,
        });

        headers["Content-Type"] = "application/json";
      } else {
        // Custom image upload
        const formData = new FormData();
        formData.append("avatar", avatarSource);
        bodyData = formData;
      }

      const res = await fetch(
        `${API_URL}/api/update-profile-pic`,
        {
          method: "POST",
          headers,
          body: bodyData,
        }
      );

      if (res.status === 401 || res.status === 403) {
        clearSession();
        alert("Your session has expired. Please log in again.");
        navigate("/login");
        return;
      }

      const data = await res.json();

      if (data.success) {
        const updatedAvatar = data.avatar;

        setProfile((prev) =>
          prev
            ? {
                ...prev,
                avatar: updatedAvatar,
              }
            : prev
        );

        // Update the same storage where the user is logged in
        const storage = getStorage();

        let userData = {};

        try {
          userData = JSON.parse(
            storage.getItem("bgmi_user") || "{}"
          );
        } catch {
          userData = {};
        }

        userData.avatar = updatedAvatar;

        storage.setItem(
          "bgmi_user",
          JSON.stringify(userData)
        );

        setSelectedFile(null);
        setPreviewUrl(null);
        setIsEditingAvatar(false);
      } else {
        alert(
          data.message || "Unable to update profile picture."
        );
      }
    } catch (error) {
      console.error("Avatar update failed:", error);
      alert("Server error. Please try again later.");
    } finally {
      setIsAvatarUpdating(false);
    }
  };

  const goToBankDetails = () => {
    navigate("/bank-details");
  };

  // ============================================================
  // LOCAL PROFILE LOADER
  // ============================================================

  if (!profile && isInitialLoading) {
    return (
      <div className="esports-profile">
        <div className="profile-local-loader">
          <div className="profile-loader-orbit">
            <div className="profile-loader-core">
              <span>P</span>
            </div>
          </div>

          <div className="profile-loader-brand">
            PEACE<span>.</span>
          </div>

          <h2>LOADING PROFILE</h2>

          <p>Preparing your player identity...</p>

          <div className="profile-loader-progress">
            <span />
          </div>

          <div className="profile-loader-status">
            <span className="profile-loader-dot" />
            CONNECTING TO SERVER
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // NO PROFILE FALLBACK
  // ============================================================

  if (!profile) {
    return (
      <div className="esports-profile">
        <div className="profile-container">
          <div className="no-profile">
            ❌ No profile data.{" "}
            <a href="/login">Go to Login</a>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // PROFILE UI
  // ============================================================

  return (
    <div className="esports-profile">
      <div className="profile-container">

        <header className="profile-header">
          <div className="player-card">

            <div
              className={`avatar-container ${
                isAvatarUpdating ? "avatar-updating" : ""
              }`}
              onClick={() => {
                if (!isAvatarUpdating) {
                  setIsEditingAvatar(true);
                }
              }}
            >
              <div className="avatar-circle">
                <img
                  src={profile.avatar}
                  alt="Profile Avatar"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = getFallbackAvatar(
                      profile.name
                    );
                  }}
                />
              </div>

              <div className="edit-overlay">
                ✏️ Edit
              </div>
            </div>

            <div className="player-details">
              <h1 className="gamer-name">
                {profile.name}
              </h1>

              <div className="id-row">
                <span>ID:</span>{" "}
                <strong>
                  {profile.id?.replace(/^FF-/, "BGMI-")}
                </strong>
              </div>
            </div>

          </div>
        </header>

        {/* AVATAR SELECTION MODAL */}

        {isEditingAvatar && (
          <div
            className="avatar-modal"
            onClick={resetAvatarModal}
          >
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <h3>Choose Profile Picture</h3>

              {/* DEFAULT GAMING AVATARS */}

              <p>Select Default Gaming Avatar:</p>

              <div className="default-avatars-grid">
                {gamingAvatars.map((url, index) => (
                  <img
                    key={index}
                    src={url}
                    alt={`Gaming Avatar ${index + 1}`}
                    onClick={() => handleUpdateAvatar(url)}
                    className={`selectable-avatar ${
                      profile.avatar === url ? "active" : ""
                    } ${
                      isAvatarUpdating ? "avatar-option-disabled" : ""
                    }`}
                  />
                ))}
              </div>

              {/* CUSTOM UPLOAD */}

              <div className="custom-upload-section">
                <p>Or Upload Custom Picture:</p>

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={isAvatarUpdating}
                />

                {previewUrl && (
                  <div className="upload-preview">
                    <img
                      src={previewUrl}
                      alt="Selected Avatar Preview"
                    />

                    <button
                      className="upload-confirm-btn"
                      onClick={() =>
                        handleUpdateAvatar(selectedFile)
                      }
                      disabled={
                        isAvatarUpdating || !selectedFile
                      }
                    >
                      {isAvatarUpdating
                        ? "Saving..."
                        : "Upload & Save"}
                    </button>
                  </div>
                )}
              </div>

              {isAvatarUpdating && (
                <div className="avatar-saving-status">
                  <span className="avatar-saving-spinner" />
                  Updating your profile picture...
                </div>
              )}

              <button
                className="close-modal-btn"
                onClick={resetAvatarModal}
                disabled={isAvatarUpdating}
              >
                Cancel
              </button>

            </div>
          </div>
        )}

        <div className="profile-action">
          <button
            className="bank-btn"
            onClick={goToBankDetails}
          >
            🏦 Add Bank Details
          </button>
        </div>

      </div>
    </div>
  );
};

export default Profile;