/* ============================= UPI CONFIG ============================= */

export const UPI_ID = "surajkunarakash-1@okaxis";
export const UPI_PAYEE_NAME = "BGMI Esports"; // apna naam yahan likho

/* ============================= BUILD UPI URI ============================= */

export const buildUpiUri = (amount) => {
  const value = Number(amount);

  if (!Number.isFinite(value) || value <= 0) return "";

  if (!/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z0-9]{2,64}$/.test(UPI_ID)) return "";

  // upi://pay?pa=UPI_ID&pn=NAME&am=100.00&cu=INR
  return (
    `upi://pay?pa=${UPI_ID}` +
    `&pn=${encodeURIComponent(UPI_PAYEE_NAME)}` +
    `&am=${value.toFixed(2)}` +
    `&cu=INR`
  );
};