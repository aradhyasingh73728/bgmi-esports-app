
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./BankDetails.css";

const BankDetails = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [notice, setNotice] = useState({
    show: false,
    type: "success",
    title: "",
    message: "",
  });

  const [bankData, setBankData] = useState({
    account_holder: "",
    account_number: "",
    bank_name: "",
    upi_id: "",
    ifsc_code: "",
  });

  const [userId, setUserId] = useState("");
  const [realProfileName, setRealProfileName] = useState("");

  // ================= CUSTOM MESSAGE =================

  const showNotice = (type, title, message) => {
    setNotice({
      show: true,
      type,
      title,
      message,
    });
  };

  const closeNotice = () => {
    setNotice((prev) => ({
      ...prev,
      show: false,
    }));
  };

  // ================= GET STORED USER =================

  const getStoredUser = () => {
    try {
      let userData = localStorage.getItem("bgmi_user");

      if (!userData) {
        userData = sessionStorage.getItem("bgmi_user");
      }

      if (!userData) return null;

      return JSON.parse(userData);
    } catch (error) {
      console.error("Stored user error:", error);
      return null;
    }
  };

  // ================= INITIALIZE BANK DETAILS =================

  useEffect(() => {
    const initBankDetails = async () => {
      try {
        const user = getStoredUser();

        if (!user?.profile_id) {
          navigate("/login");
          return;
        }

        setUserId(user.profile_id);

        // Fetch profile name
        const { data: profile, error: profileErr } = await supabase
          .from("registeruser")
          .select("username, profile_id")
          .eq("profile_id", user.profile_id)
          .maybeSingle();

        if (profileErr) {
          console.log("Profile fetch error:", profileErr.message);
        }

        const finalName =
          profile?.username?.trim() ||
          user?.username?.trim() ||
          user?.name?.trim() ||
          "Unknown Player";

        setRealProfileName(finalName);

        // Fetch existing bank details
        const { data: existing, error } = await supabase
          .from("user_bank_details")
          .select("*")
          .eq("user_id", user.profile_id)
          .maybeSingle();

        if (error) {
          console.log("Bank fetch error:", error.message);
          return;
        }

        if (existing) {
          setBankData({
            account_holder: existing.account_holder || "",
            account_number: existing.account_number || "",
            bank_name: existing.bank_name || "",
            upi_id: existing.upi_id || "",
            ifsc_code: existing.ifsc_code || "",
          });

          setSuccess(existing.is_verified === true);
        }
      } catch (error) {
        console.error("Initialization error:", error);
      }
    };

    initBankDetails();
  }, [navigate]);

  // ================= SUBMIT BANK DETAILS =================

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!userId) {
      showNotice(
        "error",
        "User Not Found",
        "Your account session could not be verified. Please log in again."
      );
      return;
    }

    if (success) {
      showNotice(
        "info",
        "Already Verified",
        "Your bank details are already verified. You can continue to the withdrawal page."
      );
      return;
    }

    const cleanAccountHolder = bankData.account_holder.trim();
    const cleanAccountNumber = bankData.account_number.trim();
    const cleanBankName = bankData.bank_name.trim();
    const cleanUpi = bankData.upi_id.trim()
      ? bankData.upi_id.trim()
      : null;
    const cleanIfsc = bankData.ifsc_code.trim().toUpperCase();

    // Validation
    if (
      !cleanAccountHolder ||
      !cleanAccountNumber ||
      !cleanBankName ||
      !cleanIfsc
    ) {
      showNotice(
        "error",
        "Missing Information",
        "Please complete all required bank details before submitting."
      );
      return;
    }

    if (cleanAccountNumber.length < 9 || cleanAccountNumber.length > 18) {
      showNotice(
        "error",
        "Invalid Account Number",
        "Please enter a valid bank account number."
      );
      return;
    }

    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
      showNotice(
        "error",
        "Invalid IFSC Code",
        "Please enter a valid 11-character IFSC code."
      );
      return;
    }

    setLoading(true);

    try {
      const profileName = realProfileName?.trim() || "Unknown Player";

      const firstName = cleanAccountHolder.split(" ")[0] || "";

      const searchTags = [
        cleanBankName,
        firstName,
        profileName,
      ].filter(Boolean);

      const payload = {
        user_id: userId,
        profile_name: profileName,
        account_holder: cleanAccountHolder,
        account_number: cleanAccountNumber,
        bank_name: cleanBankName,
        upi_id: cleanUpi,
        ifsc_code: cleanIfsc,
        is_active: true,
        is_verified: true,
        search_tags: searchTags,
      };

      console.log("BANK DETAILS PAYLOAD:", payload);

      // Check existing record
      const { data: existing, error: existErr } = await supabase
        .from("user_bank_details")
        .select("id, is_verified")
        .eq("user_id", userId)
        .maybeSingle();

      if (existErr) {
        throw new Error(existErr.message);
      }

      if (existing?.is_verified === true) {
        setSuccess(true);

        showNotice(
          "info",
          "Already Verified",
          "Your bank details are already verified. You can proceed to withdrawals."
        );

        return;
      }

      let result;

      if (existing?.id) {
        // Update existing record
        result = await supabase
          .from("user_bank_details")
          .update(payload)
          .eq("user_id", userId)
          .select()
          .maybeSingle();
      } else {
        // Insert new record
        result = await supabase
          .from("user_bank_details")
          .insert([payload])
          .select()
          .maybeSingle();
      }

      if (result.error) {
        throw new Error(result.error.message);
      }

      if (!result.data) {
        throw new Error("Bank details could not be saved. Please try again.");
      }

      console.log("BANK DETAILS SAVED:", result.data);

      setSuccess(true);

      showNotice(
        "success",
        "Bank Details Saved!",
        "Your bank details have been saved successfully. You can now continue to the withdrawal page."
      );

    } catch (error) {
      console.error("BANK SAVE ERROR:", error);

      showNotice(
        "error",
        "Submission Failed",
        error.message || "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ================= POPUP ACTION =================

  const handleNoticeAction = () => {
    const isSuccess = notice.type === "success" || notice.type === "info";

    closeNotice();

    if (isSuccess && success) {
      navigate("/withdraw");
    }
  };

  // ================= UI =================

  return (
    <>
      <div className="bank-container">
        <div className="bank-card">
          <div className="bank-inner-card">

            <div className="card-header">
              <div className="icon-circle">
                <span className="bank-icon">🏦</span>
              </div>

              <h1 className="card-title">Bank Details</h1>

              <p className="card-subtitle">
                Profile: <b>{realProfileName || "Loading..."}</b>

                <span style={{ fontSize: "0.9em", opacity: 0.8 }}>
                  {" "} (ID: {userId || "Loading..."})
                </span>
              </p>
            </div>

            <form className="bank-form" onSubmit={handleSubmit}>

              {/* ACCOUNT HOLDER */}
              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">👤</span>
                  Account Holder
                </label>

                <input
                  type="text"
                  value={bankData.account_holder}
                  onChange={(e) =>
                    setBankData({
                      ...bankData,
                      account_holder: e.target.value,
                    })
                  }
                  className="form-input"
                  placeholder="Full name as per bank"
                  required={!success}
                  disabled={success || loading}
                />
              </div>

              {/* ACCOUNT NUMBER */}
              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">🔢</span>
                  Account Number
                </label>

                <input
                  type="text"
                  inputMode="numeric"
                  value={bankData.account_number}
                  onChange={(e) =>
                    setBankData({
                      ...bankData,
                      account_number: e.target.value.replace(/[^0-9]/g, ""),
                    })
                  }
                  className="form-input"
                  placeholder="Enter bank account number"
                  maxLength={18}
                  required={!success}
                  disabled={success || loading}
                />
              </div>

              {/* BANK NAME */}
              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">🏦</span>
                  Bank Name
                </label>

                <select
                  value={bankData.bank_name}
                  onChange={(e) =>
                    setBankData({
                      ...bankData,
                      bank_name: e.target.value,
                    })
                  }
                  className="form-input"
                  required={!success}
                  disabled={success || loading}
                >
                  <option value="">Select Bank</option>
                  <option value="SBI">SBI</option>
                  <option value="HDFC">HDFC</option>
                  <option value="ICICI">ICICI</option>
                  <option value="Axis Bank">Axis Bank</option>
                  <option value="PNB">PNB</option>
                  <option value="Bank of Baroda">Bank of Baroda</option>
                </select>
              </div>

              {/* UPI */}
              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">📱</span>
                  UPI ID (Optional)
                </label>

                <input
                  type="text"
                  value={bankData.upi_id}
                  onChange={(e) =>
                    setBankData({
                      ...bankData,
                      upi_id: e.target.value,
                    })
                  }
                  className="form-input"
                  placeholder="username@ybl"
                  disabled={success || loading}
                />
              </div>

              {/* IFSC */}
              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">🔑</span>
                  IFSC Code
                </label>

                <input
                  type="text"
                  value={bankData.ifsc_code}
                  onChange={(e) =>
                    setBankData({
                      ...bankData,
                      ifsc_code: e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, ""),
                    })
                  }
                  className="form-input"
                  placeholder="SBIN0001234"
                  maxLength={11}
                  required={!success}
                  disabled={success || loading}
                />
              </div>

              {/* FOOTER MESSAGE */}
              <div className="form-footer">
                <p>
                  {success
                    ? "Bank details saved successfully."
                    : "Complete your bank details to continue."}
                </p>
              </div>

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                className={`submit-btn ${loading ? "loading" : ""}`}
                disabled={success || loading}
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    Saving...
                  </>
                ) : success ? (
                  "✓ BANK DETAILS SAVED"
                ) : (
                  "SAVE BANK DETAILS"
                )}
              </button>

            </form>
          </div>
        </div>
      </div>

      {/* ================= CUSTOM POPUP ================= */}

      {notice.show && (
        <div
          className="bank-notice-overlay"
          onClick={closeNotice}
        >
          <div
            className={`bank-notice-box ${notice.type}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bank-notice-title"
          >
            <div className="bank-notice-icon">
              {notice.type === "success"
                ? "✓"
                : notice.type === "error"
                ? "!"
                : "ℹ"}
            </div>

            <h2 id="bank-notice-title">
              {notice.title}
            </h2>

            <p>{notice.message}</p>

            <button
              type="button"
              className="bank-notice-button"
              onClick={handleNoticeAction}
            >
              {notice.type === "success" || (notice.type === "info" && success)
                ? "CONTINUE TO WITHDRAW"
                : "OK, GOT IT"}
            </button>
          </div>
        </div>
      )}

      {/* ================= POPUP STYLES ================= */}

      <style>{`
        .bank-notice-overlay {
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: rgba(0, 0, 0, 0.82);
          backdrop-filter: blur(7px);
          -webkit-backdrop-filter: blur(7px);
          animation: bankOverlayIn 0.2s ease;
        }

        .bank-notice-box {
          position: relative;
          width: 100%;
          max-width: 360px;
          padding: 28px 22px 22px;
          text-align: center;
          color: #fff;
          background: linear-gradient(145deg, #211215, #100d0e);
          border: 1px solid rgba(255, 48, 79, 0.45);
          border-radius: 17px;
          box-shadow: 0 15px 50px rgba(0, 0, 0, 0.65),
                      0 0 25px rgba(255, 48, 79, 0.12);
          animation: bankPopupIn 0.25s ease;
        }

        .bank-notice-box::before {
          content: "";
          position: absolute;
          top: 0;
          left: 12%;
          right: 12%;
          height: 2px;
          border-radius: 10px;
          background: linear-gradient(90deg, transparent, #ff304f, transparent);
          box-shadow: 0 0 12px #ff304f;
        }

        .bank-notice-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 58px;
          height: 58px;
          margin: 0 auto 15px;
          border-radius: 50%;
          font-size: 30px;
          font-weight: 900;
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.45);
          color: #10b981;
        }

        .bank-notice-box.error .bank-notice-icon {
          background: rgba(255, 48, 79, 0.12);
          border-color: rgba(255, 48, 79, 0.5);
          color: #ff526b;
        }

        .bank-notice-box.info .bank-notice-icon {
          background: rgba(255, 189, 87, 0.12);
          border-color: rgba(255, 189, 87, 0.4);
          color: #ffbd57;
        }

        .bank-notice-box h2 {
          margin: 0 0 10px;
          color: #fff;
          font-size: 21px;
          font-weight: 900;
        }

        .bank-notice-box p {
          margin: 0 0 22px;
          color: #c7bfc1;
          font-size: 13px;
          line-height: 1.6;
        }

        .bank-notice-button {
          width: 100%;
          min-height: 45px;
          padding: 12px 15px;
          border: 1px solid rgba(255, 100, 120, 0.35);
          border-radius: 9px;
          background: linear-gradient(135deg, #e51d3d, #a90020);
          color: #fff;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .bank-notice-button:hover {
          filter: brightness(1.15);
          box-shadow: 0 5px 18px rgba(255, 48, 79, 0.2);
        }

        .bank-notice-button:active {
          transform: scale(0.97);
        }

        @keyframes bankOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes bankPopupIn {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (max-width: 380px) {
          .bank-notice-box {
            padding: 24px 17px 18px;
          }

          .bank-notice-box h2 {
            font-size: 19px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .bank-notice-overlay,
          .bank-notice-box {
            animation: none;
          }
        }
      `}</style>
    </>
  );
};

export default BankDetails;
