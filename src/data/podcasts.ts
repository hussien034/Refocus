import { PodcastEpisode } from "../types/refocus";

export const OFFICIAL_YOUTUBE_SEARCH_URL = "https://www.youtube.com/results?search_query=%D8%A7%D9%84%D8%AA%D8%B9%D9%81%D9%86+%D8%A7%D9%84%D8%AF%D9%85%D8%A7%D8%BA%D9%8A";

export const CURATED_PODCAST_EPISODES: PodcastEpisode[] = [
  {
    id: "pod_verified_1",
    title: "انقذ نفسك من تعفن الدماغ | د. منعم | بودكاست عقلية",
    titleAr: "انقذ نفسك من تعفن الدماغ | د. منعم | بودكاست عقلية",
    channelName: "بودكاست عقلية",
    description: "حلقة استكشافية متعمقة مع د. منعم حول ظاهرة تعفن الدماغ وتأثير المحتوى السريع على التركيز وطرق التعافي.",
    descriptionAr: "حلقة استكشافية متعمقة مع د. منعم حول ظاهرة تعفن الدماغ وتأثير المحتوى السريع على التركيز وطرق التعافي.",
    youtubeVideoId: "aN8yDfHVUTQ",
    categories: ["brain_rot", "focus_attention", "social_media_overuse"],
    duration: "28:10",
    publishedAt: "2024-04-12",
    featured: true,
  },
  {
    id: "pod_verified_2",
    title: "إيه اللي العلم بيقوله عن تعفن الدماغ؟ وإيه العلاج؟",
    titleAr: "إيه اللي العلم بيقوله عن تعفن الدماغ؟ وإيه العلاج؟",
    channelName: "بودكاست عقلية",
    description: "نظرة علمية بحتة على تأثير الإفراط في استخدام السوشيال ميديا على خلايا الدماغ وكيفية استعادة الأداء الذهني.",
    descriptionAr: "نظرة علمية بحتة على تأثير الإفراط في استخدام السوشيال ميديا على خلايا الدماغ وكيفية استعادة الأداء الذهني.",
    youtubeVideoId: "eZFiu8EXW8o",
    categories: ["brain_rot", "digital_wellness", "dopamine"],
    duration: "22:45",
    publishedAt: "2024-05-01",
    featured: false,
  },
  {
    id: "pod_verified_3",
    title: "هل فعلًا دماغنا قاعد يتعفن؟ | Brain Rot | SYNAPSE #01",
    titleAr: "هل فعلًا دماغنا قاعد يتعفن؟ | تعفن الدماغ",
    channelName: "Synapse Podcast",
    description: "حلقة استكشافية عميقة حول ظاهرة تعفن الدماغ وتأثير التصفح العشوائي والفيديوهات القصيرة على بنية الانتباه والتركيز.",
    descriptionAr: "حلقة استكشافية عميقة حول ظاهرة تعفن الدماغ وتأثير التصفح العشوائي والفيديوهات القصيرة على بنية الانتباه والتركيز.",
    youtubeVideoId: "tZBhNi6tsCQ",
    categories: ["brain_rot", "focus_attention", "social_media_overuse"],
    duration: "14:20",
    publishedAt: "2024-03-10",
    featured: false,
  },
  {
    id: "pod_verified_4",
    title: "تعفن الدماغ | هل وسائل التواصل بتبوّظ دماغنا؟",
    titleAr: "تعفن الدماغ | هل وسائل التواصل بتبوّظ دماغنا؟",
    channelName: "Zee Acadmy",
    description: "تحليل علمي ونفسي مبسط لكيف تؤثر منصات التواصل الاجتماعي على نظام المكافأة في الدماغ وتسبب التشتت المستمر.",
    descriptionAr: "تحليل علمي ونفسي مبسط لكيف تؤثر منصات التواصل الاجتماعي على نظام المكافأة في الدماغ وتسبب التشتت المستمر.",
    youtubeVideoId: "_Qmdlgoq2Uk",
    categories: ["brain_rot", "focus_attention", "digital_wellness"],
    duration: "18:45",
    publishedAt: "2024-05-12",
    featured: false,
  },
  {
    id: "pod_verified_5",
    title: "حلقة إضافية مختارة حول التركيز والوعي الرقمي",
    titleAr: "حلقة إضافية مختارة حول التركيز والوعي الرقمي",
    channelName: "يوتيوب بودكاست",
    description: "حلقة مختارة بعناية تدعم بناء عادات التركيز والانتباه والتعافي من المشتتات.",
    descriptionAr: "حلقة مختارة بعناية تدعم بناء عادات التركيز والانتباه والتعافي من المشتتات.",
    youtubeVideoId: "1hWbccrddAI",
    categories: ["focus_attention", "digital_wellness"],
    duration: "25:00",
    publishedAt: "2024-06-15",
    featured: false,
  },
];

export function validateYouTubeVideoId(videoId: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}

export function getYouTubeEmbedUrl(videoId: string): string {
  if (!validateYouTubeVideoId(videoId)) return "";
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
}

export function getYouTubeThumbnailUrl(videoId: string): string {
  if (!validateYouTubeVideoId(videoId)) return "";
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
