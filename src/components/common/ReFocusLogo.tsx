import React from "react";

export type LogoVariant = "primary" | "horizontal" | "symbol" | "app-icon";
export type LogoTheme = "auto" | "light" | "dark" | "monochrome";

interface ReFocusLogoProps {
  variant?: LogoVariant;
  theme?: LogoTheme;
  size?: number;
  showTagline?: boolean;
  taglineText?: string;
  className?: string;
  onClick?: () => void;
}

/**
 * ReFocus Symbol — The "Aperture of Clarity"
 * An optical focal aperture with four balanced calibration axes and a centered core of mindfulness.
 */
export const ReFocusSymbol: React.FC<{
  size?: number;
  theme?: LogoTheme;
  className?: string;
}> = ({ size = 32, theme = "auto", className = "" }) => {
  // Theme color mapping for the SVG paths
  const getColors = () => {
    switch (theme) {
      case "light":
        return {
          core: "#F4CE25",
          arcs: "#F3F4F6",
          ring: "#F4CE25",
          ticks: "#F3F4F6",
        };
      case "dark":
        return {
          core: "#F4CE25",
          arcs: "#F3F4F6",
          ring: "#F4CE25",
          ticks: "#F3F4F6",
        };
      case "monochrome":
        return {
          core: "currentColor",
          arcs: "currentColor",
          ring: "currentColor",
          ticks: "currentColor",
        };
      case "auto":
      default:
        return {
          core: "var(--rf-primary, #F4CE25)",
          arcs: "var(--rf-primary-dark, #F3F4F6)",
          ring: "var(--rf-primary, #F4CE25)",
          ticks: "var(--rf-primary-dark, #F3F4F6)",
        };
    }
  };

  const colors = getColors();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-colors ${className}`}
      aria-hidden="true"
    >
      {/* 4 Cardinal Calibration Focus Ticks */}
      <path
        d="M32 6V10.5 M58 32H53.5 M32 58V53.5 M6 32H10.5"
        stroke={colors.ticks}
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Outer Precision Focus Ring */}
      <circle
        cx="32"
        cy="32"
        r="21.5"
        stroke={colors.ring}
        strokeWidth="2.2"
        strokeDasharray="26 7.5"
        strokeLinecap="round"
        opacity="0.85"
      />

      {/* 4 Converging Aperture Blades (Focus & Attention) */}
      <path
        d="M18 21C23.5 17 33.5 19.5 38.5 25.5"
        stroke={colors.arcs}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M43 18C47 23.5 44.5 33.5 38.5 38.5"
        stroke={colors.arcs}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M46 43C40.5 47 30.5 44.5 25.5 38.5"
        stroke={colors.arcs}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M21 46C17 40.5 19.5 30.5 25.5 25.5"
        stroke={colors.arcs}
        strokeWidth="3.2"
        strokeLinecap="round"
      />

      {/* Inner Halo & Center of Stillness */}
      <circle
        cx="32"
        cy="32"
        r="9"
        stroke={colors.ring}
        strokeWidth="1.2"
        strokeDasharray="3 3"
        opacity="0.5"
      />
      <circle cx="32" cy="32" r="5" fill={colors.core} />
    </svg>
  );
};

/**
 * ReFocus App Icon (Squircle container with aperture mark)
 * Optimized for mobile home screens, PWA icons, splash screens, and auth headers.
 */
export const ReFocusAppIcon: React.FC<{
  size?: number;
  theme?: LogoTheme;
  className?: string;
}> = ({ size = 48, theme = "auto", className = "" }) => {
  const getBackground = () => {
    switch (theme) {
      case "light":
        return "#151820";
      case "dark":
        return "#151820";
      case "monochrome":
        return "currentColor";
      case "auto":
      default:
        return "#151820";
    }
  };

  return (
    <div
      style={{ width: size, height: size }}
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-[26%] shadow-sm shrink-0 ${className}`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        aria-hidden="true"
      >
        <rect width="64" height="64" rx="17" fill={getBackground()} />
        <path
          d="M32 7V11 M57 32H53 M32 57V53 M7 32H11"
          stroke="#F3F4F6"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.9"
        />
        <circle
          cx="32"
          cy="32"
          r="21.5"
          stroke="#F4CE25"
          strokeWidth="2.2"
          strokeDasharray="26 7.5"
          strokeLinecap="round"
        />
        <path
          d="M18 21C23.5 17 33.5 19.5 38.5 25.5"
          stroke="#F3F4F6"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M43 18C47 23.5 44.5 33.5 38.5 38.5"
          stroke="#F3F4F6"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M46 43C40.5 47 30.5 44.5 25.5 38.5"
          stroke="#F3F4F6"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M21 46C17 40.5 19.5 30.5 25.5 25.5"
          stroke="#292D37"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <circle cx="32" cy="32" r="9" stroke="#F4CE25" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.6" />
        <circle cx="32" cy="32" r="5" fill="#F4CE25" />
      </svg>
    </div>
  );
};

/**
 * ReFocus Full Logo Family Component
 * Supports: Primary, Horizontal, Symbol-only, and App Icon variations.
 */
export const ReFocusLogo: React.FC<ReFocusLogoProps> = ({
  variant = "horizontal",
  theme = "auto",
  size = 32,
  showTagline = false,
  taglineText = "Take Back Your Attention",
  className = "",
  onClick,
}) => {
  if (variant === "symbol") {
    return <ReFocusSymbol size={size} theme={theme} className={className} />;
  }

  if (variant === "app-icon") {
    return <ReFocusAppIcon size={size} theme={theme} className={className} />;
  }

  const textColorClass = () => {
    switch (theme) {
      case "light":
        return "text-[#F3F4F6]";
      case "dark":
        return "text-[#F3F4F6]";
      case "monochrome":
        return "text-current";
      case "auto":
      default:
        return "text-[#F3F4F6] dark:text-[#F3F4F6]";
    }
  };

  const isVertical = variant === "primary";

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2.5 ${isVertical ? "flex-col text-center" : "flex-row"} ${
        onClick ? "cursor-pointer" : ""
      } ${className}`}
    >
      <ReFocusAppIcon size={size} theme={theme} />
      <div className="flex flex-col leading-none">
        <span
          className={`font-display font-bold tracking-tight ${
            size >= 40 ? "text-2xl" : size >= 32 ? "text-xl" : "text-base"
          } ${textColorClass()}`}
        >
          <span className="text-[#F4CE25] font-semibold">Re</span>Focus
        </span>
        {showTagline && (
          <span className="mt-1 text-[11px] font-medium tracking-normal text-[#A6AAB4] dark:text-[#A6AAB4]">
            {taglineText}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Backward-compatible ReFocusMark export (used widely across existing screens).
 */
export const ReFocusMark: React.FC<{ size?: number; className?: string }> = ({
  size = 32,
  className = "",
}) => <ReFocusAppIcon size={size} className={className} />;
