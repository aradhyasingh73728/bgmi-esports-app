
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLoading } from "../context/LoadingContext";
import "./Profile.css";

const isLocalhost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "[::1]";

const API_URL = isLocalhost
  ? "http://localhost:5001"
  : import.meta.env.VITE_API_URL ||
    "https://user-register-server-5001.onrender.com";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

// Built-in gaming avatars: public/avatars/avatar1.svg ... avatar12.svg
const gamingAvatars = Array.from(
  { length: 12 },
  (_, i) => `/avatars/avatar${i + 1}.svg`
);

const getFallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "User"
  )}&background=1e40af&color=fff&size=512`;

// Update user data in the same storage where it is currently saved
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

// The login page saves the token using the "backend_token" key
const getToken = (user) =>
  user?.backend_token || user?.token || null;

const clearSession = () => {
  localStorage.removeItem("bgmi_user");
  sessionStorage.removeItem("bgmi_user");
};

const Profile = () => {
  const navigate = useNavigate();
  const { setLoading } = useLoading();

  const [profile, setProfile] = useState(null);
  const [isEditingAvatar, setIsEditingAvatar] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);

      try {
        const parsedUser = getStoredUser();
        const token = getToken(parsedUser);

        // Redirect to login if user data or token is missing
        if (!parsedUser || !token) {
          navigate("/login");
          return;
        }

        // Display the profile immediately using stored data
        setProfile({
          id: parsedUser.profile_id || "BGMI-Loading...",
          name: parsedUser.username || "User",
          avatar:
            parsedUser.avatar ||
            getFallbackAvatar(parsedUser.username),
          email: parsedUser.email,
        });

        // Fetch fresh profile data from the server using the token
        const serverRes = await fetch(
          `${API_URL}/api/my-profile`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        // Check whether the token has expired or is invalid
        if (
          serverRes.status === 401 ||
          serverRes.status === 403
        ) {
          clearSession();
          navigate("/login");
          return;
        }

        // Continue using stored data if the route is unavailable or the server returns an error
        if (!serverRes.ok) {
          console.warn(
            "⚠️ my-profile failed:",
            serverRes.status
          );
          return;
        }

        const serverData = await serverRes.json();

        if (serverData.success) {
          const freshUser = serverData.user;

          // Merge the token back into the updated user data
          getStorage().setItem(
            "bgmi_user",
            JSON.stringify({
              ...freshUser,
              backend_token: token,
            })
          );

          setProfile({
            id: freshUser.profile_id,
            name: freshUser.username,
            avatar:
              freshUser.avatar ||
              getFallbackAvatar(freshUser.username),
            email: freshUser.email,
          });
        }
      } catch (error) {
        console.error("🚨 Profile error:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [navigate, setLoading]);

  // Prevent memory leaks by revoking the preview URL
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const resetAvatarModal = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsEditingAvatar(false);
  };

  // Handle file selection and validation
  const handleFileChange = (e) => {
    const file = e.target.files[0];

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

  // Handle avatar update (default avatar or custom upload)
  const handleUpdateAvatar = async (avatarSource) => {
    setLoading(true);

    try {
      const storedUser = getStoredUser();
      const token = getToken(storedUser);

      if (!storedUser || !token) {
        alert("Your session has expired. Please log in again.");
        navigate("/login");
        return;
      }

      let bodyData;
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      if (typeof avatarSource === "string") {
        // A default gaming avatar has been selected
        bodyData = JSON.stringify({
          avatarUrl: avatarSource,
        });

        headers["Content-Type"] = "application/json";
      } else {
        // Custom file upload
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

      // Handle expired or invalid tokens
      if (res.status === 401 || res.status === 403) {
        clearSession();
        alert("Your session has expired. Please log in again.");
        navigate("/login");
        return;
      }

      const data = await res.json();

      if (data.success) {
        setProfile((prev) => ({
          ...prev,
          avatar: data.avatar,
        }));

        // Update user data in storage
        const storage = getStorage();

        const userData = JSON.parse(
          storage.getItem("bgmi_user") || "{}"
        );

        userData.avatar = data.avatar;

        storage.setItem(
          "bgmi_user",
          JSON.stringify(userData)
        );

        resetAvatarModal();
      } else {
        alert(
          data.message ||
            "Unable to update profile picture."
        );
      }
    } catch (err) {
      console.error("Avatar update failed", err);
      alert("Server error. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const goToBankDetails = () => {
    navigate("/bank-details");
  };

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

  return (
    <div className="esports-profile">
      <div className="profile-container">

        <header className="profile-header">
          <div className="player-card">

            <div
              className="avatar-container"
              onClick={() => setIsEditingAvatar(true)}
            >
              <div className="avatar-circle">
                <img
                  src={profile.avatar}
                  alt="Avatar"
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

        {/* Avatar Selection Modal */}
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

              {/* Default Gaming Avatars */}
              <p>Select Default Gaming Avatar:</p>

              <div className="default-avatars-grid">
                {gamingAvatars.map((url, index) => (
                  <img
                    key={index}
                    src={url}
                    alt={`Gaming Avatar ${index + 1}`}
                    onClick={() => handleUpdateAvatar(url)}
                    className={`selectable-avatar ${
                      profile.avatar === url
                        ? "active"
                        : ""
                    }`}
                  />
                ))}
              </div>

              {/* Custom Upload */}
              <div className="custom-upload-section">
                <p>Or Upload Custom Picture:</p>

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                />

                {previewUrl && (
                  <div className="upload-preview">
                    <img
                      src={previewUrl}
                      alt="Preview"
                    />

                    <button
                      className="upload-confirm-btn"
                      onClick={() =>
                        handleUpdateAvatar(selectedFile)
                      }
                    >
                      Upload & Save
                    </button>
                  </div>
                )}
              </div>

              <button
                className="close-modal-btn"
                onClick={resetAvatarModal}
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
