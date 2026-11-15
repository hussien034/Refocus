import React from "react";

interface EmptyStateCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryNote?: string;
  className?: string;
}

export const EmptyStateCard: React.FC<EmptyStateCardProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryNote,
  className = "",
}) => {
  return (
    <section className={`flex flex-col items-center justify-center rounded-3xl border border-[#363B46] bg-[#222630] px-6 py-10 text-center dark:border-[#3A404C] dark:bg-[#222630] ${className}`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#292D37] text-[#F4CE25] dark:bg-[#292D37]">
        {icon}
      </div>
      <h2 className="mt-4 font-display text-lg font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
        {title}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-[#A6AAB4] dark:text-[#A6AAB4]">
        {description}
      </p>
      {secondaryNote && (
        <p className="mt-2 max-w-md text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
          {secondaryNote}
        </p>
      )}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-[#F4CE25] px-5 py-2.5 text-sm font-semibold text-[#191B20] transition-colors hover:bg-[#DDB816]"
        >
          {actionLabel}
        </button>
      )}
    </section>
  );
};
