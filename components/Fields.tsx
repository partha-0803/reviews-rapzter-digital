"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent as KeyEvent } from "react";

export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  type = "text",
  maxLength,
  autoComplete,
  placeholder,
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  type?: string;
  maxLength?: number;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
        {required ? <span className="req">Required</span> : null}
      </label>
      <input
        id={id}
        className="control"
        type={type}
        value={value}
        maxLength={maxLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-required={required}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <p id={`${id}-error`} className="field-error">{error}</p> : null}
      {!error && hint ? <p id={`${id}-hint`} className="hint">{hint}</p> : null}
    </div>
  );
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  error,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  error?: string;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const describedBy = error ? `${id}-error` : undefined;
  const selectedIndex = Math.max(0, options.indexOf(value));

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: { key: string }) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  function choose(next: string) {
    onChange(next);
    setOpen(false);
    document.getElementById(id)?.focus();
  }

  function onTriggerKey(event: KeyEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setActive(value ? selectedIndex : 0);
      setOpen(true);
    }
  }

  function onListKey(event: KeyEvent<HTMLUListElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (current + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (current - 1 + options.length) % options.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(options.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const next = options[active];
      if (next) choose(next);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      document.getElementById(id)?.focus();
    }
  }

  return (
    <div className="field menu" ref={rootRef}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="menu-anchor">
        <button
          id={id}
          className={value ? "control menu-trigger" : "control menu-trigger placeholder"}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onClick={() => {
            setActive(value ? selectedIndex : 0);
            setOpen((current) => !current);
          }}
          onKeyDown={onTriggerKey}
        >
          <span>{value || placeholder}</span>
          <span className="menu-caret" aria-hidden="true" />
        </button>
        {open ? (
          <ul
            id={listId}
            className="menu-panel"
            role="listbox"
            tabIndex={-1}
            aria-labelledby={id}
            ref={listRef}
            onKeyDown={onListKey}
          >
            {options.map((option, index) => (
              <li key={option} role="presentation">
                <button
                  className={index === active ? "menu-option active" : "menu-option"}
                  type="button"
                  role="option"
                  aria-selected={option === value}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(option)}
                >
                  {option}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {error ? <p id={`${id}-error`} className="field-error">{error}</p> : null}
    </div>
  );
}

export function AreaField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  maxLength,
  placeholder,
  rows = 5,
  required = false,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  maxLength?: number;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  disabled?: boolean;
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
        {required ? <span className="req">Required</span> : null}
      </label>
      <textarea
        id={id}
        className="control"
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-required={required}
        aria-describedby={describedBy}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <p id={`${id}-error`} className="field-error">{error}</p> : null}
      {!error && hint ? <p id={`${id}-hint`} className="hint">{hint}</p> : null}
    </div>
  );
}
