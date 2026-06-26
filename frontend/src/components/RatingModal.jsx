import { useState } from "react";
import React from "react";

export default function RatingModal({ open, onClose, onSubmit, existingRating, ticketRef }) {
  const [rating, setRating] = useState(existingRating?.rating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState(existingRating?.comment || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async () => {
    if (!rating) { setError("Please select a star rating"); return; }
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({ rating, comment });
      onClose();
    } catch (e) {
      setError(e.response?.data?.message || "Failed to submit rating");
    } finally {
      setSubmitting(false);
    }
  };

  const displayRating = hoverRating || rating;

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <button style={s.closeBtn} onClick={onClose}>✕</button>

        <div style={s.icon}>✅</div>
        <h2 style={s.title}>Ticket Resolved</h2>
        <p style={s.sub}>
          {ticketRef ? `How was your experience with ${ticketRef}?` : "How was your experience with this ticket?"}
        </p>

        <div style={s.stars}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              style={s.starBtn}
              onMouseEnter={() => setHoverRating(n)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => { setRating(n); setError(""); }}
            >
              <span style={{ ...s.star, color: n <= displayRating ? "#f59e0b" : "#2a2a3a" }}>★</span>
            </button>
          ))}
        </div>

        {displayRating > 0 && (
          <div style={s.ratingLabel}>
            {["", "Very dissatisfied", "Dissatisfied", "Okay", "Satisfied", "Very satisfied"][displayRating]}
          </div>
        )}

        <textarea
          style={s.textarea}
          placeholder="Anything you'd like to add? (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        {error && <div style={s.error}>⚠️ {error}</div>}

        <div style={s.actions}>
          <button style={s.skipBtn} onClick={onClose}>Maybe later</button>
          <button style={s.submitBtn} disabled={submitting} onClick={handleSubmit}>
            {submitting ? "Submitting..." : existingRating ? "Update rating" : "Submit rating"}
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 2000,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
  },
  modal: {
    position: "relative", width: "100%", maxWidth: 380, background: "#13131f",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18, padding: "32px 28px",
    boxShadow: "0 24px 64px rgba(0,0,0,.5)", textAlign: "center",
    fontFamily: "'DM Sans','Segoe UI',sans-serif",
  },
  closeBtn: {
    position: "absolute", top: 14, right: 14, background: "none", border: "none",
    color: "#5555aa", fontSize: 14, cursor: "pointer", padding: 4,
  },
  icon: { fontSize: 36, marginBottom: 10 },
  title: { fontSize: 19, fontWeight: 800, color: "#fff", marginBottom: 6, letterSpacing: "-0.02em" },
  sub: { fontSize: 13, color: "#6666aa", marginBottom: 22, lineHeight: 1.5 },
  stars: { display: "flex", justifyContent: "center", gap: 4, marginBottom: 8 },
  starBtn: { background: "none", border: "none", cursor: "pointer", padding: 4 },
  star: { fontSize: 32, transition: "color .12s", lineHeight: 1 },
  ratingLabel: { fontSize: 12, fontWeight: 600, color: "#f59e0b", marginBottom: 16, height: 16 },
  textarea: {
    width: "100%", minHeight: 70, background: "#16161f", border: "1.5px solid #2a2a3a",
    borderRadius: 10, padding: "10px 13px", color: "#e0e0f0", fontSize: 13, outline: "none",
    fontFamily: "inherit", resize: "vertical", marginBottom: 14, boxSizing: "border-box",
  },
  error: { fontSize: 12, color: "#fca5a5", marginBottom: 12 },
  actions: { display: "flex", gap: 10, justifyContent: "center" },
  skipBtn: {
    background: "none", border: "1px solid #2a2a3a", borderRadius: 9, padding: "10px 18px",
    color: "#6666aa", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
  },
  submitBtn: {
    background: "linear-gradient(135deg,#3b82f6,#6366f1)", border: "none", borderRadius: 9,
    padding: "10px 20px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  },
};