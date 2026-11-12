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
  const describedBy = error ? `${id}-error` : undefined;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="control"
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
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
