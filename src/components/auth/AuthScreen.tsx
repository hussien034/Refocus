import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Mail,
  Lock,
  User,
  CheckCircle2,
  AlertCircle,
  Globe,
} from "lucide-react";
import { getCopy } from "../../i18n/translations";
import {
  loginAccount,
  resetAccountPassword,
  signupAccount,
} from "../../services/storageService";
import { AppState, Language } from "../../types/refocus";
import { ReFocusMark } from "../common/PWAWidgets";

export type AuthMode = "login" | "signup" | "forgot";

interface AuthScreenProps {
  language: Language;
  initialMode: AuthMode;
  onToggleLanguage: () => void;
  onBack: () => void;
  onAuthSuccess: (payload: { token: string; state: AppState; isNewUser: boolean }) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  language,
  initialMode,
  onToggleLanguage,
  onBack,
  onAuthSuccess,
}) => {
  const t = getCopy(language);
  const isRtl = language === "ar";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetMessage(null);

    if (mode === "signup" && !name.trim()) {
      setError(t.auth.errors.nameRequired);
      return;
    }
    if (!validateEmail(email)) {
      setError(t.auth.errors.emailInvalid);
      return;
    }
    if (password.length < 6) {
      setError(t.auth.errors.passwordShort);
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const res = await signupAccount({
          name: name.trim(),
          email: email.trim(),
          password,
          language,
        });
        onAuthSuccess({ token: res.token, state: res.state, isNewUser: true });
      } else if (mode === "login") {
        const res = await loginAccount({
          email: email.trim(),
          password,
          language,
        });
        onAuthSuccess({
          token: res.token,
          state: res.state,
          isNewUser: !res.state.onboarding.completed,
        });
      } else {
        await resetAccountPassword({
          email: email.trim(),
          newPassword: password,
          language,
        });
        setResetMessage(t.auth.resetSent);
        setPassword("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const heading =
    mode === "login"
      ? t.auth.signInTitle
      : mode === "signup"
        ? t.auth.signUpTitle
        : t.auth.forgotTitle;

  const subtitle =
    mode === "login"
      ? t.auth.signInSubtitle
      : mode === "signup"
        ? t.auth.signUpSubtitle
        : t.auth.forgotSubtitle;

  return (
    <div className="flex min-h-screen flex-col justify-center bg-[#151820] px-4 py-8 text-[#F3F4F6] dark:bg-[#151820] dark:text-[#F3F4F6]">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-2 text-sm font-medium text-[#A6AAB4] hover:text-[#F3F4F6] dark:text-[#A6AAB4] dark:hover:text-[#F3F4F6]"
          >
            <BackIcon className="h-4 w-4" />
            <span>{t.brand}</span>
          </button>

          <button
            type="button"
            onClick={onToggleLanguage}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#363B46] bg-[#222630] px-3 py-1.5 text-xs font-medium text-[#F3F4F6] hover:bg-[#292D37] dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#F3F4F6]"
          >
            <Globe className="h-3.5 w-3.5 text-[#F4CE25]" />
            <span>{language === "en" ? "العربية" : "English"}</span>
          </button>
        </div>

        <div className="rounded-3xl border border-[#363B46] bg-[#222630] p-6 shadow-sm sm:p-8 dark:border-[#3A404C] dark:bg-[#222630]">
          <div className="flex items-center gap-3">
            <ReFocusMark size={36} />
            <h1 className="font-display text-2xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
              {heading}
            </h1>
          </div>

          <p className="mt-2 text-sm text-[#A6AAB4] dark:text-[#A6AAB4]">{subtitle}</p>

          {error && (
            <div
              role="alert"
              className="mt-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/60 dark:text-red-200"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {resetMessage && (
            <div
              role="status"
              className="mt-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-[#292D37] px-3.5 py-2.5 text-sm text-[#F3F4F6] dark:border-[#3A404C] dark:bg-[#292D37] dark:text-[#F3F4F6]"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#F4CE25]" />
              <span>{resetMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            {mode === "signup" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#F3F4F6] dark:text-[#F3F4F6]">
                  {t.auth.nameLabel}
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute top-1/2 start-3.5 h-4 w-4 -translate-y-1/2 text-[#A6AAB4]" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.auth.namePlaceholder}
                    className="min-h-[48px] w-full rounded-xl border border-[#363B46] bg-[#151820] ps-10 pe-4 text-sm text-[#F3F4F6] outline-none focus:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#F3F4F6] dark:text-[#F3F4F6]">
                {t.auth.emailLabel}
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 start-3.5 h-4 w-4 -translate-y-1/2 text-[#A6AAB4]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.auth.emailPlaceholder}
                  className="min-h-[48px] w-full rounded-xl border border-[#363B46] bg-[#151820] ps-10 pe-4 text-sm text-[#F3F4F6] outline-none focus:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium text-[#F3F4F6] dark:text-[#F3F4F6]">
                  {mode === "forgot" ? t.auth.newPasswordLabel : t.auth.passwordLabel}
                </label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setResetMessage(null);
                      setPassword("");
                      setMode("forgot");
                    }}
                    className="text-xs font-medium text-[#F4CE25] hover:underline"
                  >
                    {t.auth.forgotLink}
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 start-3.5 h-4 w-4 -translate-y-1/2 text-[#A6AAB4]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    mode === "forgot"
                      ? t.auth.newPasswordPlaceholder
                      : t.auth.passwordPlaceholder
                  }
                  className="min-h-[48px] w-full rounded-xl border border-[#363B46] bg-[#151820] ps-10 pe-4 text-sm text-[#F3F4F6] outline-none focus:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#F4CE25] px-4 py-3 text-sm font-semibold text-[#191B20] hover:bg-[#DDB816] transition-colors disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>
                {mode === "login"
                  ? t.auth.submitLogin
                  : mode === "signup"
                    ? t.auth.submitSignUp
                    : t.auth.submitForgot}
              </span>
            </button>
          </form>

          <div className="mt-5 text-center">
            {mode === "forgot" ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setResetMessage(null);
                  setMode("login");
                }}
                className="min-h-[44px] text-sm font-medium text-[#F4CE25] hover:underline"
              >
                {t.auth.backToLogin}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setResetMessage(null);
                  setMode(mode === "login" ? "signup" : "login");
                }}
                className="min-h-[44px] text-sm font-medium text-[#F4CE25] hover:underline"
              >
                {mode === "login" ? t.auth.switchToSignUp : t.auth.switchToLogin}
              </button>
            )}
          </div>

          <p className="mt-4 border-t border-[#363B46] pt-4 text-center text-xs text-[#A6AAB4] dark:border-[#3A404C] dark:text-[#A6AAB4]">
            {t.auth.localJsonNote}
          </p>
        </div>
      </div>
    </div>
  );
};
