/**
 * ReFocus Typography System
 * 
 * Centralized typography scale, tokens, and font-family standards.
 * English: Inter (clean, geometric, human-centered)
 * Arabic: IBM Plex Sans Arabic (natural, modern, highly legible)
 * Monospace / Tabular: JetBrains Mono with tabular-nums
 */

export const FONT_STACKS = {
  en: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  ar: "'IBM Plex Sans Arabic', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
};

export const TYPOGRAPHY = {
  // Major hero headlines
  display: "font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#F3F4F6] dark:text-[#F3F4F6]",
  
  // Page titles
  h1: "font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#F3F4F6] dark:text-[#F3F4F6]",
  
  // Section headers
  h2: "font-display text-xl sm:text-2xl font-semibold tracking-tight text-[#F3F4F6] dark:text-[#F3F4F6]",
  
  // Card headings / widget titles
  h3: "font-display text-base sm:text-lg font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]",
  
  // Standard body copy
  body: "text-sm sm:text-base leading-relaxed text-[#F3F4F6] dark:text-[#F3F4F6]",
  
  // Secondary / supporting descriptions
  small: "text-xs sm:text-sm leading-normal text-[#A6AAB4] dark:text-[#A6AAB4]",
  
  // Metadata, timestamps, quiet indicators
  caption: "text-[11px] sm:text-xs font-medium text-[#A6AAB4] dark:text-[#A6AAB4]",
  
  // Numerical values, timers, stats, tabular data
  tabular: "font-mono-tabular tabular-nums font-semibold",
  
  // Interactive button labels
  button: "text-xs sm:text-sm font-semibold tracking-normal",
} as const;
