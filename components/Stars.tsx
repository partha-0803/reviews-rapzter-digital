"use client";

import { useState } from "react";

const LABELS = ["Select a rating", "Poor", "Fair", "Good", "Great", "Excellent"];

export default function Stars({
  value,
  onChange,
  readOnly = false,
  labelledBy,
}: {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  labelledBy?: string;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  if (readOnly) {
    return (
      <div className="stars readonly" role="img" aria-label={`${value} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((score) => (
          <span key={score} className={score <= value ? "star on" : "star"} aria-hidden="true">
            ★
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="rating-row">
      <div
        id="rating"
        className="stars"
        role="radiogroup"
        aria-required="true"
        aria-labelledby={labelledBy}
        onMouseLeave={() => setHover(0)}
        onKeyDown={(event) => {
          if (!onChange) return;
          if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            onChange(Math.min(5, (value || 0) + 1));
          }
          if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            onChange(Math.max(1, (value || 1) - 1));
          }
        }}
      >
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            role="radio"
            aria-checked={value === score}
            aria-label={`${score} star${score > 1 ? "s" : ""}`}
            className={score <= shown ? "star on" : "star"}
            onMouseEnter={() => setHover(score)}
            onFocus={() => setHover(score)}
            onBlur={() => setHover(0)}
            onClick={() => onChange?.(score)}
          >
            ★
          </button>
        ))}
      </div>
      <span className="star-label">{LABELS[shown]}</span>
    </div>
  );
}
