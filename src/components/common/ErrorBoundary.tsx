import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  language?: "en" | "ar";
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ReFocus ErrorBoundary] Caught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isAr = this.props.language === "ar";
      const isDynamicImportError =
        this.state.error?.message?.includes("dynamically imported module") ||
        this.state.error?.message?.includes("Failed to fetch");

      return (
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-[#363B46] bg-[#222630] p-8 text-center shadow-sm dark:border-[#3A404C] dark:bg-[#222630]">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#292D37] text-[#F4CE25] dark:bg-[#292D37]">
            <AlertCircle className="h-7 w-7 text-[#F4CE25]" />
          </div>

          <h2 className="mt-4 font-display text-lg font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
            {isAr
              ? isDynamicImportError
                ? "تحديث الواجهة مطلوب"
                : "حدث خطأ غير متوقع"
              : isDynamicImportError
                ? "Interface update needed"
                : "Something went wrong"}
          </h2>

          <p className="mt-2 max-w-sm text-xs leading-relaxed text-[#A6AAB4] dark:text-[#A6AAB4]">
            {isAr
              ? "تم الحفاظ على بياناتك وجلساتك بأمان. اضغط أدناه لإعادة تحميل الصفحة واستئناف العمل فوراً."
              : "Your focus logs and habits are safe. Click below to reload and resume seamlessly."}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 rounded-xl bg-[#F4CE25] px-5 py-2.5 text-xs font-semibold text-[#191B20] shadow-sm transition hover:bg-[#DDB816]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{isAr ? "إعادة المحاولة" : "Reload Screen"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = "/";
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-[#363B46] bg-[#151820] px-4 py-2.5 text-xs font-medium text-[#F3F4F6] hover:bg-[#292D37] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
            >
              <Home className="h-3.5 w-3.5" />
              <span>{isAr ? "الرئيسية" : "Home"}</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
