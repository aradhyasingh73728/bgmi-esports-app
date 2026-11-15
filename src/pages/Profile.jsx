
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

// User data jis storage me hai usi me update karne ke liye
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

// Login page token ko "backend_token" naam se save karta hai
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

        // User ya token nahi hai to login pe bhejo
        if (!parsedUser || !token) {
          navigate("/login");
          return;
        }

        // Pehle stored data se turant profile dikha do
        setProfile({
          id: parsedUser.profile_id || "BGMI-Loading...",
          name: parsedUser.username || "User",
          avatar:
            parsedUser.avatar ||
            getFallbackAvatar(parsedUser.username),
          email: parsedUser.email,
        });

        // Fresh data from server (token se)
        const serverRes = await fetch(
          `${API_URL}/api/my-profile`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        // Token expire ho gaya ya invalid hai
        if (
          serverRes.status === 401 ||
          serverRes.status === 403
        ) {
          clearSession();
          navigate("/login");
          return;
        }

        // Route na mile ya server error ho to stored data se hi chalne do
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

          // Token wapas merge karo
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

  // Preview ka memory leak band karne ke liye
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

  // File select + validation
  const handleFileChange = (e) => {
    const file = e.target.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Sirf image file select karo");
      e.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert("Image 2MB se choti honi chahiye");
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // Handle Avatar Update (Default or Custom Upload)
  const handleUpdateAvatar = async (avatarSource) => {
    setLoading(true);

    try {
      const storedUser = getStoredUser();
      const token = getToken(storedUser);

      if (!storedUser || !token) {
        alert("Session expire ho gaya, dobara login karo");
        navigate("/login");
        return;
      }

      let bodyData;
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      if (typeof avatarSource === "string") {
        // Default gaming avatar select kiya hai
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

      // Token expire / invalid
      if (res.status === 401 || res.status === 403) {
        clearSession();
        alert("Session expire ho gaya, dobara login karo");
        navigate("/login");
        return;
      }

      const data = await res.json();

      if (data.success) {
        setProfile((prev) => ({
          ...prev,
          avatar: data.avatar,
        }));

        // Storage update karein
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
            "Profile picture update nahi ho paayi"
        );
      }
    } catch (err) {
      console.error("Avatar update failed", err);
      alert("Server error, thodi der baad try karo");
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
