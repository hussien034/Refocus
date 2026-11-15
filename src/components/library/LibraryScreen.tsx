import React, { useState } from "react";
import {
  Search,
  Bookmark,
  BookmarkCheck,
  Play,
  ExternalLink,
  Clock,
  Calendar,
  Sparkles,
  X,
  Tv,
  CheckCircle2,
} from "lucide-react";
import { AppState, PodcastCategory, PodcastEpisode } from "../../types/refocus";
import { CURATED_PODCAST_EPISODES, OFFICIAL_YOUTUBE_SEARCH_URL, getYouTubeEmbedUrl, getYouTubeThumbnailUrl, validateYouTubeVideoId } from "../../data/podcasts";
import { getCopy } from "../../i18n/translations";

interface LibraryScreenProps {
  state: AppState;
  onUpdateState: (updates: Partial<AppState>, nextState: AppState, actionDesc: string) => void;
}

export const LibraryScreen: React.FC<LibraryScreenProps> = ({ state, onUpdateState }) => {
  const t = getCopy(state.language);
  const isAr = state.language === "ar";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<PodcastCategory | "all">("all");
  const [activeTab, setActiveTab] = useState<"all" | "bookmarks">("all");
  const [selectedEpisode, setSelectedEpisode] = useState<PodcastEpisode | null>(null);

  const categories: Array<{ id: PodcastCategory | "all"; label: string }> = [
    { id: "all", label: t.library.allCategories },
    { id: "brain_rot", label: t.library.categories.brain_rot },
    { id: "focus_attention", label: t.library.categories.focus_attention },
    { id: "social_media_overuse", label: t.library.categories.social_media_overuse },
    { id: "dopamine", label: t.library.categories.dopamine },
    { id: "digital_wellness", label: t.library.categories.digital_wellness },
    { id: "deep_work_reading", label: t.library.categories.deep_work_reading },
    { id: "digital_habits", label: t.library.categories.digital_habits },
  ];

  const bookmarkedIds = state.bookmarkedPodcastIds || [];

  const handleToggleBookmark = (episodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isBookmarked = bookmarkedIds.includes(episodeId);
    const nextBookmarks = isBookmarked
      ? bookmarkedIds.filter((id) => id !== episodeId)
      : [...bookmarkedIds, episodeId];

    const nextState: AppState = {
      ...state,
      bookmarkedPodcastIds: nextBookmarks,
    };
    onUpdateState({ bookmarkedPodcastIds: nextBookmarks }, nextState, "bookmark_podcast");
  };

  const filteredEpisodes = CURATED_PODCAST_EPISODES.filter((ep) => {
    const matchesTab = activeTab === "all" || bookmarkedIds.includes(ep.id);
    const matchesCategory = selectedCategory === "all" || ep.categories.includes(selectedCategory);
    const query = searchQuery.toLowerCase().trim();
    const titleText = (isAr ? ep.titleAr || ep.title : ep.title).toLowerCase();
    const channelText = ep.channelName.toLowerCase();
    const descText = (isAr ? ep.descriptionAr || ep.description : ep.description).toLowerCase();
    const matchesSearch = !query || titleText.includes(query) || channelText.includes(query) || descText.includes(query);
    return matchesTab && matchesCategory && matchesSearch;
  });

  const featuredEpisode = CURATED_PODCAST_EPISODES.find((ep) => ep.featured) || CURATED_PODCAST_EPISODES[0];
  const relatedEpisodes = selectedEpisode
    ? CURATED_PODCAST_EPISODES.filter(
        (ep) => ep.id !== selectedEpisode.id && ep.categories.some((c) => selectedEpisode.categories.includes(c))
      ).slice(0, 3)
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      {/* Hero Header */}
      <a
        href={OFFICIAL_YOUTUBE_SEARCH_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={isAr ? "ابحث عن التعفن الدماغي على يوتيوب" : "Search YouTube for brain rot"}
        className="group relative block overflow-hidden rounded-3xl border border-[#363B46] bg-[#20232B] bg-cover bg-center p-6 text-white shadow-xl transition duration-300 hover:border-[#F4CE25]/50 hover:shadow-[0_20px_56px_rgba(0,0,0,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4CE25] focus-visible:ring-offset-2 focus-visible:ring-offset-[#191B20] sm:p-10"
        style={{ backgroundImage: `url('${import.meta.env.BASE_URL}library-hero.svg')` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#191B20]/95 via-[#191B20]/75 to-[#191B20]/15 transition-colors group-hover:from-[#191B20]/90 group-hover:via-[#191B20]/65 group-hover:to-[#191B20]/10" />
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#222630]/10 px-3.5 py-1 text-xs font-medium backdrop-blur-md">
            <Tv className="h-3.5 w-3.5 text-[#F4CE25]" />
            <span>{t.library.title}</span>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-4xl">
            {t.library.title}
          </h1>
          <p className="text-sm leading-relaxed text-[#E1E3E8]/90 sm:text-base">
            {t.library.subtitle}
          </p>
          <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white shadow-sm backdrop-blur-md transition group-hover:border-[#F4CE25]/35 group-hover:bg-[#F4CE25]/15">
            <ExternalLink className="h-4 w-4 text-[#F4CE25]" />
            <span>{isAr ? "البحث على يوتيوب (تعفن الدماغ)" : "Search YouTube for brain rot"}</span>
          </div>
        </div>
      </a>

      {/* Search & Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A6AAB4] dark:text-[#A6AAB4]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.library.searchPlaceholder}
            className="w-full rounded-2xl border border-[#363B46] bg-[#222630] py-3 ps-10 pe-4 text-sm text-[#F3F4F6] shadow-sm outline-none transition focus:border-[#F4CE25] focus:ring-2 focus:ring-[#F4CE25]/20 dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#F3F4F6]"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === "all"
                ? "bg-[#292D37] text-white shadow-md dark:bg-[#F4CE25]"
                : "bg-[#222630] text-[#A6AAB4] hover:bg-[#292D37] dark:bg-[#222630] dark:text-[#A6AAB4] dark:hover:bg-[#292D37]"
            }`}
          >
            {t.library.allEpisodesTab}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("bookmarks")}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === "bookmarks"
                ? "bg-[#292D37] text-white shadow-md dark:bg-[#F4CE25]"
                : "bg-[#222630] text-[#A6AAB4] hover:bg-[#292D37] dark:bg-[#222630] dark:text-[#A6AAB4] dark:hover:bg-[#292D37]"
            }`}
          >
            <Bookmark className="h-3.5 w-3.5" />
            <span>{t.library.bookmarkedTab.replace("{count}", String(bookmarkedIds.length))}</span>
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={`shrink-0 rounded-xl px-4 py-2 text-xs font-medium transition-colors ${
              selectedCategory === cat.id
                ? "bg-[#F4CE25] text-[#191B20] shadow-sm"
                : "bg-[#222630] text-[#A6AAB4] border border-[#363B46] hover:bg-[#292D37] dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#A6AAB4] dark:hover:bg-[#292D37]"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Featured Episode (shown on 'all' tab with no search query) */}
      {activeTab === "all" && !searchQuery && selectedCategory === "all" && featuredEpisode && (
        <section className="overflow-hidden rounded-3xl border border-[#363B46] bg-[#222630] shadow-sm dark:border-[#3A404C] dark:bg-[#222630]">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            <div className="relative aspect-video bg-black lg:col-span-5">
              <img
                src={getYouTubeThumbnailUrl(featuredEpisode.youtubeVideoId)}
                alt={isAr ? featuredEpisode.titleAr || featuredEpisode.title : featuredEpisode.title}
                className="h-full w-full object-cover opacity-90 transition hover:opacity-100"
                loading="lazy"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px] transition hover:bg-black/10">
                <button
                  type="button"
                  onClick={() => setSelectedEpisode(featuredEpisode)}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F4CE25] text-[#191B20] shadow-lg transition hover:scale-105"
                  aria-label={t.library.watchNow}
                >
                  <Play className="ms-0.5 h-6 w-6 fill-[#191B20]" />
                </button>
              </div>
              <span className="absolute start-3 top-3 rounded-lg bg-[#292D37]/90 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                {t.library.featuredBadge}
              </span>
            </div>

            <div className="flex flex-col justify-between p-6 lg:col-span-7 lg:p-8">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#F4CE25]">{featuredEpisode.channelName}</span>
                  <button
                    type="button"
                    onClick={(e) => handleToggleBookmark(featuredEpisode.id, e)}
                    className="rounded-full p-2 text-[#A6AAB4] hover:bg-[#292D37] dark:text-[#A6AAB4] dark:hover:bg-[#292D37]"
                    aria-label="Bookmark"
                  >
                    {bookmarkedIds.includes(featuredEpisode.id) ? (
                      <BookmarkCheck className="h-5 w-5 fill-[#F4CE25] text-[#F4CE25]" />
                    ) : (
                      <Bookmark className="h-5 w-5" />
                    )}
                  </button>
                </div>
                <h2 className="font-display text-xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                  {isAr ? featuredEpisode.titleAr || featuredEpisode.title : featuredEpisode.title}
                </h2>
                <p className="line-clamp-3 text-sm text-[#A6AAB4] dark:text-[#A6AAB4]">
                  {isAr ? featuredEpisode.descriptionAr || featuredEpisode.description : featuredEpisode.description}
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#363B46] dark:border-[#3A404C]">
                <div className="flex items-center gap-3 text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
                  {featuredEpisode.duration && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {featuredEpisode.duration}
                    </span>
                  )}
                  {featuredEpisode.publishedAt && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {featuredEpisode.publishedAt}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedEpisode(featuredEpisode)}
                  className="flex items-center gap-2 rounded-xl bg-[#292D37] px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#303541] dark:bg-[#F4CE25] dark:hover:bg-[#DDB816]"
                >
                  <Play className="h-3.5 w-3.5 fill-white" />
                  <span>{t.library.watchNow}</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Episodes Grid */}
      <section className="space-y-4">
        {filteredEpisodes.length === 0 ? (
          <div className="rounded-3xl border border-[#363B46] bg-[#222630] p-12 text-center shadow-sm dark:border-[#3A404C] dark:bg-[#222630]">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#292D37] text-[#F4CE25] dark:bg-[#292D37]">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="font-display text-base font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
              {activeTab === "bookmarks" ? t.library.emptyBookmarks : t.library.emptySearch}
            </h3>
            <p className="mt-1 text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
              {activeTab === "bookmarks" ? "" : "Try adjusting your search query or category filters."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEpisodes.map((ep) => {
              const isBookmarked = bookmarkedIds.includes(ep.id);
              return (
                <div
                  key={ep.id}
                  onClick={() => setSelectedEpisode(ep)}
                  className="group flex flex-col justify-between overflow-hidden rounded-3xl border border-[#363B46] bg-[#222630] shadow-sm transition hover:shadow-md cursor-pointer dark:border-[#3A404C] dark:bg-[#222630]"
                >
                  <div>
                    <div className="relative aspect-video bg-black">
                      <img
                        src={getYouTubeThumbnailUrl(ep.youtubeVideoId)}
                        alt={isAr ? ep.titleAr || ep.title : ep.title}
                        className="h-full w-full object-cover opacity-90 transition group-hover:scale-105 group-hover:opacity-100"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition group-hover:opacity-100">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F4CE25] text-[#191B20] shadow-lg">
                          <Play className="ms-0.5 h-5 w-5 fill-white" />
                        </div>
                      </div>
                      {ep.duration && (
                        <span className="absolute bottom-3 end-3 rounded-md bg-black/80 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
                          {ep.duration}
                        </span>
                      )}
                    </div>

                    <div className="p-5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-[#F4CE25]">{ep.channelName}</span>
                        <button
                          type="button"
                          onClick={(e) => handleToggleBookmark(ep.id, e)}
                          className="rounded-full p-1.5 text-[#A6AAB4] hover:bg-[#292D37] dark:text-[#A6AAB4] dark:hover:bg-[#292D37]"
                          aria-label="Bookmark"
                        >
                          {isBookmarked ? (
                            <BookmarkCheck className="h-4 w-4 fill-[#F4CE25] text-[#F4CE25]" />
                          ) : (
                            <Bookmark className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      <h3 className="font-display text-sm font-bold text-[#F3F4F6] line-clamp-2 dark:text-[#F3F4F6]">
                        {isAr ? ep.titleAr || ep.title : ep.title}
                      </h3>

                      <p className="text-xs text-[#A6AAB4] line-clamp-2 dark:text-[#A6AAB4]">
                        {isAr ? ep.descriptionAr || ep.description : ep.description}
                      </p>
                    </div>
                  </div>

                  <div className="p-5 pt-0 flex items-center justify-between text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
                    <div className="flex flex-wrap gap-1">
                      {ep.categories.slice(0, 1).map((cat) => (
                        <span
                          key={cat}
                          className="rounded-md bg-[#292D37] px-2 py-0.5 text-[10px] font-medium text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]"
                        >
                          {t.library.categories[cat] || cat}
                        </span>
                      ))}
                    </div>
                    <span className="font-medium text-[#F4CE25] flex items-center gap-1 group-hover:underline">
                      <Play className="h-3 w-3 fill-current" />
                      {t.library.watchNow}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Video Player Modal */}
      {selectedEpisode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto"
          onClick={() => setSelectedEpisode(null)}
        >
          <div
            className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-[#222630] shadow-2xl dark:bg-[#222630]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#363B46] px-6 py-4 dark:border-[#3A404C]">
              <div>
                <span className="text-xs font-semibold text-[#F4CE25]">{selectedEpisode.channelName}</span>
                <h2 className="font-display text-base font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                  {isAr ? selectedEpisode.titleAr || selectedEpisode.title : selectedEpisode.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEpisode(null)}
                className="rounded-full p-2 text-[#A6AAB4] hover:bg-[#292D37] dark:text-[#A6AAB4] dark:hover:bg-[#292D37]"
                aria-label={t.common.close}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Responsive 16:9 Privacy-Enhanced YouTube Player */}
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-lg">
                {validateYouTubeVideoId(selectedEpisode.youtubeVideoId) ? (
                  <iframe
                    src={getYouTubeEmbedUrl(selectedEpisode.youtubeVideoId)}
                    title={isAr ? selectedEpisode.titleAr || selectedEpisode.title : selectedEpisode.title}
                    className="absolute inset-0 h-full w-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center text-white">
                    <p className="text-sm">Video embedding is unavailable.</p>
                    <a
                      href={`https://www.youtube.com/watch?v=${selectedEpisode.youtubeVideoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex items-center gap-2 rounded-xl bg-[#F4CE25] px-4 py-2 text-xs font-semibold text-[#191B20]"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>{t.library.openYouTube}</span>
                    </a>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  {selectedEpisode.categories.map((cat) => (
                    <span
                      key={cat}
                      className="rounded-lg bg-[#292D37] px-3 py-1 text-xs font-medium text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]"
                    >
                      {t.library.categories[cat] || cat}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <a
                    href={`https://www.youtube.com/watch?v=${selectedEpisode.youtubeVideoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-xl border border-[#363B46] bg-[#222630] px-4 py-2 text-xs font-semibold text-[#F3F4F6] shadow-sm transition hover:bg-[#292D37] dark:border-[#3A404C] dark:bg-[#292D37] dark:text-[#F3F4F6]"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>{t.library.openYouTube}</span>
                  </a>

                  <button
                    type="button"
                    onClick={(e) => handleToggleBookmark(selectedEpisode.id, e)}
                    className="flex items-center gap-2 rounded-xl bg-[#292D37] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#303541] dark:bg-[#F4CE25]"
                  >
                    {bookmarkedIds.includes(selectedEpisode.id) ? (
                      <>
                        <BookmarkCheck className="h-4 w-4 fill-white" />
                        <span>Saved</span>
                      </>
                    ) : (
                      <>
                        <Bookmark className="h-4 w-4" />
                        <span>Save</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <p className="text-sm leading-relaxed text-[#A6AAB4] dark:text-[#A6AAB4]">
                {isAr ? selectedEpisode.descriptionAr || selectedEpisode.description : selectedEpisode.description}
              </p>

              {/* Related Episodes */}
              {relatedEpisodes.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-[#363B46] dark:border-[#3A404C]">
                  <h4 className="font-display text-sm font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                    {t.library.relatedEpisodes}
                  </h4>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {relatedEpisodes.map((rel) => (
                      <div
                        key={rel.id}
                        onClick={() => setSelectedEpisode(rel)}
                        className="group flex gap-3 rounded-2xl border border-[#363B46] bg-[#222630] p-3 cursor-pointer transition hover:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#151820]"
                      >
                        <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-xl bg-black">
                          <img
                            src={getYouTubeThumbnailUrl(rel.youtubeVideoId)}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <div className="flex flex-col justify-center">
                          <span className="text-[10px] font-semibold text-[#F4CE25]">{rel.channelName}</span>
                          <h5 className="font-display text-xs font-bold text-[#F3F4F6] line-clamp-2 dark:text-[#F3F4F6]">
                            {isAr ? rel.titleAr || rel.title : rel.title}
                          </h5>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
