import type { ReactNode } from "react";

export const INPUT = "border border-ink/40 bg-white px-3 py-2 focus:outline-2 focus:outline-wine";
export const BUTTON = "justify-self-start bg-wine px-6 py-3 font-medium text-ivory hover:bg-ink disabled:opacity-60";

type TextFieldProps = {
  id: string;
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  defaultValue?: string;
  required?: boolean;
  error?: string;
  hint?: string;
};

/** A labelled input with its optional hint and error wired to it for screen readers. */
export function TextField({ id, name, label, type = "text", autoComplete, defaultValue, required = true, error, hint }: TextFieldProps) {
  const described = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  const props = { id, name, autoComplete, required, defaultValue, "aria-invalid": error ? true : undefined, "aria-describedby": described, className: INPUT };
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {type === "textarea" ? <textarea rows={3} {...props} /> : <input type={type} {...props} />}
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-wine">
          {error}
        </p>
      )}
    </div>
  );
}

/** A required, unticked consent checkbox; `children` is the label text (it may hold a link). */
export function Consent({ id, name, error, children }: { id: string; name: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="flex items-start gap-3">
        <input type="checkbox" id={id} name={name} required aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} className="mt-1 accent-wine" />
        <span>{children}</span>
      </label>
      {error && (
        <p id={`${id}-error`} className="ml-7 text-sm text-wine">
          {error}
        </p>
      )}
    </div>
  );
}
