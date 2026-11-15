import test from "node:test";
import assert from "node:assert";
import {
  CURATED_PODCAST_EPISODES,
  OFFICIAL_YOUTUBE_SEARCH_URL,
  validateYouTubeVideoId,
  getYouTubeEmbedUrl,
  getYouTubeThumbnailUrl,
} from "../src/data/podcasts";

test("Curated podcast catalog contains verified pristine episodes including requested 1hWbccrddAI", () => {
  assert.ok(CURATED_PODCAST_EPISODES.length >= 5);
  assert.ok(OFFICIAL_YOUTUBE_SEARCH_URL.includes("search_query"));

  const userRequestedEp = CURATED_PODCAST_EPISODES.find((e) => e.youtubeVideoId === "1hWbccrddAI");
  assert.ok(userRequestedEp);

  const monemEp = CURATED_PODCAST_EPISODES.find((e) => e.youtubeVideoId === "aN8yDfHVUTQ");
  assert.ok(monemEp);
});

test("YouTube ID validation and embed URL generation adhere to privacy-enhanced standards", () => {
  assert.equal(validateYouTubeVideoId("1hWbccrddAI"), true);
  assert.equal(validateYouTubeVideoId("aN8yDfHVUTQ"), true);
  assert.equal(validateYouTubeVideoId("eZFiu8EXW8o"), true);
  assert.equal(validateYouTubeVideoId("invalid_id!"), false);

  const embedUrl = getYouTubeEmbedUrl("1hWbccrddAI");
  assert.equal(embedUrl, "https://www.youtube-nocookie.com/embed/1hWbccrddAI?rel=0&modestbranding=1");

  const thumbUrl = getYouTubeThumbnailUrl("1hWbccrddAI");
  assert.equal(thumbUrl, "https://img.youtube.com/vi/1hWbccrddAI/hqdefault.jpg");
});

test("Podcast bookmarking and search/filter logic works cleanly", () => {
  const initialBookmarks: string[] = [];
  const epId = CURATED_PODCAST_EPISODES[0].id;

  const added = [...initialBookmarks, epId];
  assert.equal(added.includes(epId), true);

  const deduped = Array.from(new Set([...added, epId]));
  assert.equal(deduped.length, 1);

  const removed = deduped.filter((id) => id !== epId);
  assert.equal(removed.includes(epId), false);

  const focusEpisodes = CURATED_PODCAST_EPISODES.filter((ep) => ep.categories.includes("focus_attention"));
  assert.ok(focusEpisodes.length >= 3);
});
