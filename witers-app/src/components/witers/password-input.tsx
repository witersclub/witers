import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { useLanguage } from "../../lib/i18n";

// Every real account-password field (login, signup, reset, change-password
// in "Mi perfil") shares this exact look — baked in here instead of taking
// a className prop, since there's never been a second style to support.
// Deliberately NOT used for the admin's temporary-designer-password fields
// (those are plain type="text" on purpose — the admin has to read it back
// to hand it to the designer) or the payment CVC field (not a password).
export function PasswordInput({
  id,
  value,
  onChange,
  required,
  minLength,
  autoComplete,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  placeholder?: string;
}) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-xl border border-wit-ink/15 bg-white px-4 py-3 pr-11 text-base text-wit-ink outline-none transition-colors focus:border-wit-blue"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={
          visible
            ? t("Ocultar contraseña", "Hide password")
            : t("Mostrar contraseña", "Show password")
        }
        className="absolute right-3 top-1/2 -translate-y-1/2 text-wit-gray transition-colors hover:text-wit-ink"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
