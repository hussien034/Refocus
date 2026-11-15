import { GoogleGenAI } from "@google/genai";
import { CoachActionCard, ScreenTimePeriod } from "../src/types/refocus";
import {
  parseCoachModelPayload,
  validateCoachActionCard,
} from "../src/services/coachActionValidator";

export interface CoachContextPayload {
  userName: string;
  language: "en" | "ar";
  dailyFocusTarget: number;
  dailyScreenTimeGoalMinutes?: number;
  todayFocusMinutes: number;
  todayScreenTimeMinutes: number;
  completedHabitsCount: number;
  totalHabitsCount: number;
  streakDays: number;
  recentHabits: Array<{ title: string; streak: number; completedToday: boolean }>;
  recentScreenTime: Array<{
    appName: string;
    category: string;
    durationMinutes: number;
    date: string;
    periodOfDay?: ScreenTimePeriod;
  }>;
  latestCheckIn?: {
    focusRating: number;
    phoneCheckingFrequency: string;
    topDistraction: string;
    achievedGoal: string;
    note?: string;
  } | null;
  goals: string[];
  challenges: string[];
  habitInterests?: string[];
}

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

const AI_SYSTEM_ROLE = `You are ReFocus AI Coach, a thoughtful, realistic, supportive digital wellness coach.

Your mission is to help users develop healthier digital habits, improve focus routines, and reduce mindless scrolling.

Guidelines:
1. Be genuinely logical, practical, conversational, and specific to what the user just asked — never give generic canned templates or rigid report card blocks in response to casual greetings like "عامل ايه" or "ازيك".
2. When the user greets you or asks how you are (e.g. "عامل ايه", "ازيك", "hi"), respond warmly, naturally, and conversationally like a real human coach, without immediately dumping numerical statistics unless the user asks for their progress or stats.
3. Directly reference the user's real recorded data (their focus minutes, logged apps/screen-time, habits, streaks, check-in notes, goals, and challenges) when discussing focus or habits.
3. Match the user's language and tone naturally:
   - If the user writes in Arabic (including Egyptian/regional Arabic or Modern Standard Arabic) or their preferred language is 'ar', reply in clear, warm, natural Arabic.
   - Otherwise reply in clear, supportive English.
4. Give concrete, realistic next steps rather than vague clichés.
5. Never shame or judge the user.
6. Never diagnose ADHD or any neurological/psychological condition, never claim the user's brain is damaged, never provide medical diagnoses or promise medical treatment. Gently suggest professional support if persistent struggles seriously affect daily life.
7. Prioritize sustainable offline habits over spending time inside apps.

Structured Action Card Format:
When recommending one concrete action the user can save or start inside ReFocus, you MAY reply with a JSON object (no surrounding prose) matching:
{
  "reply": "<your full supportive coaching reply in the user's language>",
  "actionCard": {
    "type": "focus_session" | "new_habit" | "daily_challenge" | "screen_time_goal" | "wellness_tip",
    "title": "<short action title>",
    "explanation": "<1-2 concise sentences explaining what this action does>",
    "relevanceReason": "<1 short sentence linking this to their actual data or prompt>",
    "durationMinutes": <optional integer 5..120 for focus_session>,
    "intention": "<optional focus intention for focus_session>",
    "habitTitle": "<required for new_habit>",
    "habitCategory": "reading" | "movement" | "mindfulness" | "learning" | "sleep" | "digital_wellness" | "personal_growth",
    "habitFrequencyType": "daily" | "weekdays" | "days_per_week" | "custom_weekly",
    "habitTargetPerWeek": <optional integer 1..7 for new_habit>,
    "challengeTitle": "<required for daily_challenge>",
    "screenTimeGoalMinutes": <optional integer 10..480 for screen_time_goal>
  }
}
If no structured card is needed, omit "actionCard" or respond in plain text.`;

export function hasValidGeminiKey(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key !== "MY_GEMINI_API_KEY" && key.length > 10);
}

export function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

export function buildContextSummary(ctx: CoachContextPayload, replyInArabic: boolean): string {
  const habitsSummary = ctx.recentHabits
    .slice(0, 8)
    .map(
      (h) =>
        `- ${h.title} (${h.completedToday ? "completed today" : "not done yet today"}, streak: ${h.streak}d)`
    )
    .join("\n");

  const screenSummary = ctx.recentScreenTime
    .slice(0, 8)
    .map(
      (s) =>
        `- ${s.appName} (${s.category}${s.periodOfDay ? `, ${s.periodOfDay}` : ""}): ${s.durationMinutes} min on ${s.date}`
    )
    .join("\n");

  const checkInSummary = ctx.latestCheckIn
    ? `Focus rating: ${ctx.latestCheckIn.focusRating}/5, Unintentional phone checks: ${ctx.latestCheckIn.phoneCheckingFrequency}, Top distraction: ${ctx.latestCheckIn.topDistraction}, Goal achieved: ${ctx.latestCheckIn.achievedGoal}${ctx.latestCheckIn.note ? `, Reflection note: "${ctx.latestCheckIn.note}"` : ""}`
    : "No daily check-in recorded yet.";

  return `User Behavioral Context (Real Logged Data):
- Name: ${ctx.userName}
- Preferred Reply Language: ${replyInArabic ? "Arabic (natural, practical, empathetic)" : "English"}
- Daily Focus Target: ${ctx.dailyFocusTarget} min
- Daily Screen-Time Goal: ${ctx.dailyScreenTimeGoalMinutes ? `${ctx.dailyScreenTimeGoalMinutes} min` : "Not set yet"}
- Today's Focus Logged: ${ctx.todayFocusMinutes} min
- Today's Self-Reported Screen Time: ${ctx.todayScreenTimeMinutes} min
- Habits Completed Today: ${ctx.completedHabitsCount}/${ctx.totalHabitsCount}
- Focus Streak: ${ctx.streakDays} days
- Stated Goals: ${ctx.goals.join(", ") || "None set yet"}
- Stated Challenges: ${ctx.challenges.join(", ") || "None set yet"}
- Habit Interests: ${ctx.habitInterests?.join(", ") || "None set yet"}
- User Habits:
${habitsSummary || "No habits created yet."}
- Self-Reported Screen Time Logs:
${screenSummary || "No screen-time logs entered yet."}
- Latest Check-In: ${checkInSummary}`;
}

function summarizeTopApps(ctx: CoachContextPayload): {
  topApp?: string;
  topMins: number;
  totalRecentMins: number;
} {
  if (!ctx.recentScreenTime.length) return { topMins: 0, totalRecentMins: 0 };
  const totals = new Map<string, number>();
  let totalRecentMins = 0;
  for (const item of ctx.recentScreenTime) {
    totals.set(item.appName, (totals.get(item.appName) || 0) + item.durationMinutes);
    totalRecentMins += item.durationMinutes;
  }
  let topApp: string | undefined;
  let topMins = 0;
  for (const [app, mins] of totals.entries()) {
    if (mins > topMins) {
      topApp = app;
      topMins = mins;
    }
  }
  return { topApp, topMins, totalRecentMins };
}

function formatArabicHabitList(habits: Array<{ title: string }>): string {
  return habits
    .slice(0, 3)
    .map((h) => `"${h.title}"`)
    .join(" و");
}

function detectPreviousTopic(
  lastAssistantMsg: string
):
  | "sleep"
  | "study"
  | "social"
  | "routine"
  | "morning"
  | "habits"
  | "alternatives"
  | "stats"
  | "general" {
  const lower = lastAssistantMsg.toLowerCase();
  if (/(نوم|السرير|الشاحن|bedtime|sleep|charger)/i.test(lower)) return "sleep";
  if (/(مذاكرة|الشغل|تأجل|study|focus block|task)/i.test(lower)) return "study";
  if (/(تصفح|سوشيال|تطبيقات|تيك|انستا|scrolling|feeds|social)/i.test(lower)) return "social";
  if (/(صبح|الصباح|الصحيان|morning)/i.test(lower)) return "morning";
  if (/(7 أيام|خطة|روتين|7-day|routine)/i.test(lower)) return "routine";
  if (/(عادة|عادات|habit|streak)/i.test(lower)) return "habits";
  if (/(بدائل|ملل|alternative|offline swap)/i.test(lower)) return "alternatives";
  if (/(دقائق التركيز|ملخص وضعك|logged progress)/i.test(lower)) return "stats";
  return "general";
}

function makeCard(raw: Omit<CoachActionCard, "id" | "status">): CoachActionCard | undefined {
  const validated = validateCoachActionCard({
    ...raw,
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    status: "pending",
  });
  return validated || undefined;
}

export function buildSmartLocalReply(
  message: string,
  history: ChatHistoryMessage[],
  ctx: CoachContextPayload,
  replyInArabic: boolean
): { reply: string; actionCard?: CoachActionCard } {
  const msg = message.trim();
  const remaining = Math.max(0, ctx.dailyFocusTarget - ctx.todayFocusMinutes);
  const { topApp, topMins } = summarizeTopApps(ctx);
  const pendingHabits = ctx.recentHabits.filter((h) => !h.completedToday);
  const checkIn = ctx.latestCheckIn;
  const lastAssistantMsg = [...history].reverse().find((h) => h.role === "assistant")?.content || "";
  const assistantTurnCount = history.filter((h) => h.role === "assistant").length;
  const firstGoal = ctx.goals[0];
  const firstChallenge = ctx.challenges[0];

  const targetFocusBlock = Math.min(25, Math.max(15, remaining || 20));
  const suggestedGoalMins =
    ctx.todayScreenTimeMinutes > 30
      ? Math.max(30, Math.round((ctx.todayScreenTimeMinutes * 0.8) / 5) * 5)
      : Math.max(30, Math.min(120, ctx.dailyScreenTimeGoalMinutes || 60));

  if (replyInArabic) {
    // 1. Meta / User complaining about repeated, robotic, or generic replies
    if (
      /(تكرار|بتكرر|متكرر|نفس الرد|نفس الكلام|الاجابة كدا|الإجابة كدا|كلام ثابت|رد ثابت|مش منطق|روبوت|ردود جاهزة|اسطمبة|بتقول نفس)/i.test(
        msg
      )
    ) {
      const realDataParts: string[] = [];
      realDataParts.push(
        `• تركيزك المسجّل اليوم: ${ctx.todayFocusMinutes} من ${ctx.dailyFocusTarget} دقيقة`
      );
      if (ctx.totalHabitsCount > 0) {
        realDataParts.push(
          `• العادات: أنجزت ${ctx.completedHabitsCount}/${ctx.totalHabitsCount}${pendingHabits.length ? ` (المتبقي: ${formatArabicHabitList(pendingHabits)})` : ""}`
        );
      }
      if (topApp) {
        realDataParts.push(`• أكثر تطبيق مسجل مؤخراً: ${topApp} (${topMins} دقيقة)`);
      }
      if (firstChallenge) {
        realDataParts.push(`• التحدي الذي اخترته في ملفك: ${firstChallenge}`);
      }

      return {
        reply: `معك حق تماماً يا ${ctx.userName}، والاعتراض في محله. عندما يظهر رد مكرر فهذا يعني أن المساعد الذكي لم يلتقط تفاصيل سؤالك بالشكل الكافي أو أن الاتصال بالنموذج التوليدي غير مفعّل بعد.\n\nدعنا نتكلم بشكل عملي ومباشر بناءً على وضعك الحقيقي الآن:\n${realDataParts.join("\n")}\n\nاكتب لي الموقف المحدد الذي تواجهه الآن في سطر واحد (مثلاً: "بفتح تيك توك أول ما أصحى"، أو "مش عارف أبدأ مذاكرة دلوقتي"، أو "بسهر على الموبايل بالليل") وسأرد عليك بخطوة مفصّلة لهذا الموقف تحديداً.`,
      };
    }

    // 2. Greetings / Casual opener
    if (
      /^(اهلا|أهلا|مرحبا|السلام|هاي|ازيك|عامل ايه|اخبارك|صباح|مساء|هلو|hi|hello|hey)/i.test(
        msg
      ) &&
      msg.length < 40
    ) {
      return {
        reply: `أهلاً بك يا ${ctx.userName}! أنا تمام الحمد لله، وموجود هنا عشان نشتغل سوا بهدوء وبدون ضغط.\n\nطمنّي عنك، عامل إيه اليوم وطاقتك أخبارها إيه؟ حابب نركز على حاجة معينة النهاردة؟`,
      };
    }

    // 3. Follow-ups referencing previous assistant message
    if (
      msg.length < 42 &&
      /(ازاي|إزاي|كيف|وبعدين|اعمل ايه|أعمل إيه|الخطوة|مثال|طب|ايوة|أيوة|تمام|فعلا|فعلاً|صح|وضح|اشرح)/i.test(
        msg
      )
    ) {
      const prevTopic = detectPreviousTopic(lastAssistantMsg);
      if (prevTopic === "sleep") {
        return {
          reply: `لتنفيذ خطوة النوم الليلة بدون تعقيد يا ${ctx.userName}:\n1. قبل ميعاد نومك بـ 30 دقيقة، وصّل الشاحن في مكان بعيد عن السرير (عند الباب أو مكتب بعيد).\n2. فعّل وضع "عدم الإزعاج" ما عدا المكالمات الطارئة.\n3. جهّز بديلاً ملموساً بجانب السرير من الآن (كتاب ورقي، أو دفتر تكتب فيه 3 سطور عن يومك) حتى لا تشعر بفراغ لحظة الاستلقاء.`,
          actionCard: makeCard({
            type: "new_habit",
            title: "عادة تهدئة قبل النوم",
            explanation: "شحن الهاتف بعيداً عن السرير 30 دقيقة قبل النوم لحماية جودة راحتك.",
            relevanceReason: "تحول نصيحة الليل لخطوة عملية قابلة للتتبع في عاداتك.",
            habitTitle: "ترك الهاتف خارج السرير قبل النوم 30د",
            habitCategory: "sleep",
            habitFrequencyType: "days_per_week",
            habitTargetPerWeek: 5,
          }),
        };
      }
      if (prevTopic === "study") {
        return {
          reply: `الخطوة الفورية خلال الدقيقتين الجايين:\n1. اختر مهمة واحدة صغيرة جداً تقدر تنجز أول جزء منها في 15 دقيقة فقط.\n2. ضع الهاتف في غرفة أخرى أو داخل شنطة مغلقة.\n3. افتح تبويب "التركيز" في ReFocus، اكتب اسم المهمة في خانة النية، واضغط "بدء" على مؤقت 15 دقيقة فقط.`,
          actionCard: makeCard({
            type: "focus_session",
            title: "جلسة انطلاق سريعة (15 د)",
            explanation: "مؤقت 15 دقيقة بنية مهمة واحدة لكسر حاجز البداية بدون ضغط.",
            relevanceReason: `مرتبط بمتابعتك لخطوة البدء الفوري (${ctx.todayFocusMinutes}/${ctx.dailyFocusTarget} د اليوم).`,
            durationMinutes: 15,
            intention: "أول خطوة صغيرة لمدة 15 دقيقة",
          }),
        };
      }
      if (prevTopic === "social") {
        return {
          reply: `تطبيق عملي سريع على ${topApp || "تطبيقات التصفح"} اليوم:\n• فعّل مؤقت التطبيق من إعدادات الهاتف كحد يومي واقعي.\n• انقل أيقونة ${topApp || "التطبيق"} لآخر صفحة في شاشة الهاتف حتى لا تفتحه تلقائياً.\n• ضع هدفاً يومياً لوقت الشاشة في ReFocus للمراقبة الهادئة.`,
          actionCard: makeCard({
            type: "screen_time_goal",
            title: `ضبط هدف شاشة يومي (${suggestedGoalMins} د)`,
            explanation: "تحديد سقف واقعي لاستخدام التواصل الاجتماعي داخل متتبع وقت الشاشة.",
            relevanceReason: topApp
              ? `مقترح بناءً على نشاطك المسجل على ${topApp} (${topMins} د).`
              : "يساعدك على مراقبة استهلاكك الذاتي بوضوح.",
            screenTimeGoalMinutes: suggestedGoalMins,
          }),
        };
      }
      if (prevTopic === "morning") {
        return {
          reply: `لتنجح في أول 20 دقيقة صباحاً:\n• استخدم منبهاً عادياً أو ضع الهاتف بعيداً عن السرير بحيث تضطر للقيام لإيقافه.\n• لا تفتح أي رسائل أو أخبار قبل أن تشرب كوب ماء وتنجز شيئاً واقعياً صغيراً.`,
          actionCard: makeCard({
            type: "new_habit",
            title: "20 دقيقة صباحاً بدون تصفح",
            explanation: "بدء اليوم بكوب ماء وأولوية واحدة قبل فتح وسائل التواصل.",
            relevanceReason: "يدعم حماية انتباهك في الساعات الأولى من اليوم.",
            habitTitle: "أول 20 دقيقة صباحاً بدون تصفح",
            habitCategory: "digital_wellness",
            habitFrequencyType: "days_per_week",
            habitTargetPerWeek: 5,
          }),
        };
      }
      return {
        reply: `لتطبيق الكلام الآن بخطوة واحدة واضحة:\n• حدد أكبر مشتت تراه أمامك في هذه اللحظة${topApp ? ` (هل هو ${topApp} أم شيء آخر؟)` : ""}.\n• أبعده عن متناول يدك لمدة 15 دقيقة فقط${pendingHabits.length ? ` وابدأ بعادة "${pendingHabits[0].title}"` : " وابدأ جلسة تركيز قصيرة"}.`,
        actionCard: makeCard({
          type: "focus_session",
          title: "جلسة حماية الانتباه (15 د)",
          explanation: "تهيئة مؤقت تركيز قصير مع إبعاد الهاتف مؤقتاً.",
          relevanceReason: `مناسب لوضعك الحالي (${ctx.todayFocusMinutes}/${ctx.dailyFocusTarget} د).`,
          durationMinutes: 15,
          intention: "التركيز على خطوة واحدة بدون هاتف",
        }),
      };
    }

    // 4. Stats / progress
    if (
      /(تقدم|احصائ|إحصائ|بيانات|عملت|ملخص|سجلت|وضعي|اخباري|تقيمي|تقييمي|تحليل|progress|stats|summary)/i.test(
        msg
      )
    ) {
      const parts = [
        `ملخص بياناتك الحقيقية المسجّلة حتى الآن يا ${ctx.userName}:`,
        `• دقائق التركيز اليوم: ${ctx.todayFocusMinutes} من أصل ${ctx.dailyFocusTarget} دقيقة${remaining > 0 ? ` (يتبقى ${remaining} دقيقة)` : " (حققت هدفك اليومي!)"}.`,
        ctx.totalHabitsCount > 0
          ? `• العادات اليوم: أنجزت ${ctx.completedHabitsCount} من ${ctx.totalHabitsCount}${pendingHabits.length ? ` — المتبقي اليوم: ${formatArabicHabitList(pendingHabits)}` : " — أنجزت كل عادات اليوم!"}.`
          : `• قسم العادات ما زال فارغاً — إضافة عادة واحدة صغيرة ستبني لك سلسلة التزام واضحة.`,
        ctx.todayScreenTimeMinutes > 0
          ? `• وقت الشاشة المسجل اليوم: ${ctx.todayScreenTimeMinutes} دقيقة${topApp ? ` (أكثرها على ${topApp}: ${topMins} دقيقة)` : ""}.`
          : `• لم تسجل وقت شاشة لليوم بعد — إدخال 30 ثانية من بياناتك في "وقت الشاشة" يساعدنا نرى أين يضيع الوقت فعلاً.`,
      ];
      if (checkIn) {
        parts.push(
          `• آخر متابعة يومية: تقييم التركيز ${checkIn.focusRating}/5، وأكبر مشتت كان "${checkIn.topDistraction}".`
        );
      }
      if (firstGoal) {
        parts.push(`• هدفك الرئيسي: ${firstGoal}.`);
      }
      return {
        reply: parts.join("\n"),
        actionCard:
          remaining > 0
            ? makeCard({
                type: "focus_session",
                title: `إغلاق فجوة اليوم (${targetFocusBlock} د)`,
                explanation: `تجهيز جلسة تركيز لمدة ${targetFocusBlock} دقيقة لتقريبك من هدفك اليومي.`,
                relevanceReason: `متبقي لك ${remaining} دقيقة من هدف ${ctx.dailyFocusTarget} د اليوم.`,
                durationMinutes: targetFocusBlock,
                intention: "إتمام جلسة التركيز اليومية",
              })
            : undefined,
      };
    }

    // 5. Morning scrolling
    if (/(صبح|الصبح|اصحى|بصحى|الصباح|الاستيقاظ|morning|wake up)/i.test(msg)) {
      return {
        reply: `التصفح أول ما تصحى من النوم يا ${ctx.userName} بيضبط المخ من أول دقيقة على البحث عن التنبيهات السريعة، فباقي اليوم يكون التركيز أثقل.\n\nتعديل بسيط وواقعي لصبح بكرة:\n1. اجعل القاعدة: "لا تصفح في أول 20 دقيقة بعد الاستيقاظ".\n2. شغّل المنبه وضع الهاتف خارج متناول ذراعك من السرير.\n3. جهّز أول فعل صباحي قبل النوم (كوب ماء أو كتابة أولوية واحدة لليوم).`,
        actionCard: makeCard({
          type: "daily_challenge",
          title: "تحدي الصباح الهادئ",
          explanation: "تطبيق تحدي أول 20 دقيقة صباحاً بدون فتح منصات التواصل.",
          relevanceReason: "يتماشى مباشرة مع تحسين بداية يومك بعيداً عن التنبيهات.",
          challengeTitle: "أول 20 دقيقة بعد الاستيقاظ بدون سوشيال ميديا",
        }),
      };
    }

    // 6. Bedtime / night scrolling / sleep
    if (/(نوم|ليل|مساء|سهر|بنوم|السرير|انام|أنام|bedtime|sleep|night)/i.test(msg)) {
      return {
        reply: `السهر والتصفح بالليل مترابطين جداً؛ لأن العقل آخر اليوم بيكون تعبان ومش عايز مجهود، فالمقاطع السريعة تبقى أسهل هروب حتى لو انت عارف إنك محتاج تنام.\n\nخطة عملية لليلة دي يا ${ctx.userName}:\n1. حدد وقتاً لإبعاد الشاشة قبل النوم بـ 30 دقيقة، واشحن الهاتف بعيداً عن السرير.\n2. ضع بديلاً سهلاً بجانب السرير من الآن: كتاب خفيف أو دفتر تفرّغ فيه أفكار بكرة في 3 سطور.\n3. لو فتحت ${topApp || "الموبايل"} وانت في السرير، اقفل الشاشة بهدوء وضع الهاتف على الطاولة.`,
        actionCard: makeCard({
          type: "new_habit",
          title: "تجنب الشاشات قبل النوم",
          explanation: "إضافة عادة يومية أو شبه يومية لإيقاف المقاطع القصيرة قبل النوم بـ 30 دقيقة.",
          relevanceReason: topApp
            ? `تساعد في تقليل السكرول الليلي على ${topApp}.`
            : "تساعد ذهنك على الانتقال الهادئ للنوم.",
          habitTitle: "إبعاد الهاتف قبل النوم بـ 30 دقيقة",
          habitCategory: "sleep",
          habitFrequencyType: "days_per_week",
          habitTargetPerWeek: 5,
        }),
      };
    }

    // 7. Notifications / constant checking / phone reflex
    if (
      /(اشعار|إشعار|بمسك|افتح|كل شوية|تفقد|تشيك|تلقائي|لا إرادي|reflex|notification|check)/i.test(
        msg
      )
    ) {
      return {
        reply: `مسك الموبايل كل كام دقيقة غالباً بيكون "حركة يد تلقائية" وقت التوقف بين المهام أو عند أول لحظة ملل.\n\nلتقليل هذه العادة تدريجياً:\n• اقفل الإشعارات غير البشرية واترك المكالمات والرسائل المهمة فقط.\n• فعّل الشاشة بالألوان الرمادية أثناء ساعات الشغل أو المذاكرة.\n• اسأل نفسك قبل فتح القفل: "أنا داخل أعمل إيه؟"${checkIn ? ` (خاصة أنك ذكرت أن تفقّد الهاتف عندك "${checkIn.phoneCheckingFrequency}")` : ""}.`,
        actionCard: makeCard({
          type: "wellness_tip",
          title: "قاعدة التوقف 10 ثوانٍ قبل الفتح",
          explanation: "اسأل نفسك: ما الهدف المحدد من فتح الهاتف الآن؟ قبل فتح أي تطبيق تصفح.",
          relevanceReason: checkIn
            ? `بناءً على ملاحظة تفقد الهاتف (${checkIn.phoneCheckingFrequency}) في متابعتك.`
            : "يكسر حركة اليد التلقائية دون حرمان متشدد.",
        }),
      };
    }

    // 8. Stress / boredom / tired / overwhelmed
    if (
      /(زهق|ملل|تعب|مرهق|مضغوط|ضغط|قلق|متوتر|مخنوق|حاسس بذنب|فشل|محبط|طاقتي|bored|stress|tired|anxious|overwhelm|guilt)/i.test(
        msg
      )
    ) {
      return {
        reply: `الاعتراف بالتعب أو الملل مهم جداً يا ${ctx.userName}. كثير من أوقات السكرول الطويلة ليست كسلاً — هي محاولة من الذهن للراحة أو الهروب من الضغط.\n\nبدل جلد الذات:\n• خذ راحة حقيقية بدون شاشة لمدة 10 دقائق (مشي، تمدد، أو الجلوس في هدوء).\n• اخفض سقف اليوم لهدف واقعي جداً: مؤقت 10 دقائق واحدة أو إتمام أصغر خطوة ممكنة.\n• وإذا استمر الضغط النفسي أو القلق بشكل يؤثر على حياتك اليومية، فاستشارة مختص خطوة صحية ومفيدة.`,
        actionCard: makeCard({
          type: "focus_session",
          title: "جلسة هادئة جداً (10 دقائق)",
          explanation: "خفض سقف البداية إلى 10 دقائق مريحة عندما تكون طاقتك منخفضة.",
          relevanceReason: "يحمي استمراريتك دون إجهاد أو مقارنة قاسية.",
          durationMinutes: 10,
          intention: "خطوة خفيفة لمدة 10 دقائق فقط",
        }),
      };
    }

    // 9. Studying / work / procrastination
    if (
      /(دراسة|مذاكرة|امتحان|شغل|عمل|تسويف|بأجل|مكسل|مش قادر|تشتت|تركيز|انتباه|study|procrastinat|focus|work)/i.test(
        msg
      )
    ) {
      return {
        reply: `التأجيل والتشتت أثناء ${/(دراسة|مذاكرة|امتحان)/.test(msg) ? "المذاكرة" : "الشغل"} بيحصل غالباً لأن المهمة بتبان في دماغنا كبيرة وغامضة، فالعقل بيهرب لأسهل مصدر مكافأة سريعة زي ${topApp || "الموبايل"}.\n\nجرّب الخطة العملية دي الآن:\n1. حوّل المهمة لخطوة صغيرة محددة (مثلاً: "حل 5 مسائل" أو "قراءة 4 صفحات").\n2. أبعد الهاتف عن مجال نظرك تماماً.\n3. شغّل مؤقت ReFocus لمدة ${targetFocusBlock} دقيقة فقط بنية واضحة.`,
        actionCard: makeCard({
          type: "focus_session",
          title: `مؤقت تركيز (${targetFocusBlock} د)`,
          explanation: `تهيئة مؤقت تركيز ${targetFocusBlock} دقيقة بنية خطوة واحدة واضحة بدون بدء تلقائي.`,
          relevanceReason: `مبني على هدفك اليومي (${ctx.todayFocusMinutes}/${ctx.dailyFocusTarget} د) وسؤالك عن التركيز.`,
          durationMinutes: targetFocusBlock,
          intention: /(دراسة|مذاكرة|امتحان)/.test(msg)
            ? "مذاكرة جزء واحد محدد بدون هاتف"
            : "إنجاز مهمة واحدة لمدة قصيرة",
        }),
      };
    }

    // 10. Specific social media apps / screen time goal
    if (
      /(تواصل|سوشيال|انست|فيس|تيك|يوتيوب|شورت|رييلز|موبايل|تلفون|هاتف|شاشة|ادمان|إدمان|scrolling|social|tiktok|instagram|youtube|reels)/i.test(
        msg
      )
    ) {
      return {
        reply: `التعامل مع ${topApp || "منصات المقاطع القصيرة"} يحتاج "تغيير بيئة الاستخدام" أكثر من الاعتماد على قوة الإرادة.\n\n3 خطوات واقعية تبدأ بها اليوم:\n• أزل التطبيق من الشاشة الرئيسية لأن إزالة الخطوة التلقائية تقلل الفتح اللاواعي.\n• ضع قاعدة "المكان والوقت": لا تصفح داخل السرير أو أثناء المذاكرة.\n• حدد هدفاً يومياً لوقت الشاشة${topApp ? ` (سجلاتك تظهر ${topMins} دقيقة على ${topApp} مؤخراً)` : ""}.`,
        actionCard: makeCard({
          type: "screen_time_goal",
          title: `تحديد هدف وقت الشاشة (${suggestedGoalMins} د)`,
          explanation: "تعديل سقف الاستخدام اليومي المقصود في متتبع وقت الشاشة.",
          relevanceReason: topApp
            ? `استجابة لاستهلاك ${topApp} (${topMins} د) وتقليل التصفح العشوائي.`
            : "يساعد في قياس تقدمك مقارنة بهدف واضح.",
          screenTimeGoalMinutes: suggestedGoalMins,
        }),
      };
    }

    // 11. 7-day challenge / plan / routine
    if (/(تحدي|خطة|جدول|روتين|اسبوع|أسبوع|7|يوم|challenge|routine|plan)/i.test(msg)) {
      return {
        reply: `إليك خطة عملية متدرجة لمدة 7 أيام تناسب هدفك (${ctx.dailyFocusTarget} دقيقة تركيز يومياً):\n\n• اليوم 1–2: حماية أول 20 دقيقة بعد الاستيقاظ بدون سوشيال ميديا.\n• اليوم 3–4: جلسة تركيز واحدة يومياً والموبايل في غرفة ثانية (${Math.min(25, ctx.dailyFocusTarget)} دقيقة).\n• اليوم 5–6: استبدال تصفح المساء بنشاط واقعي${pendingHabits[0] ? ` مثل "${pendingHabits[0].title}"` : " كالمشي أو القراءة"}.\n• اليوم 7: مراجعة المراجعة الأسبوعية في التطبيق لتقييم أكثر وقت نجح معاك.`,
        actionCard: makeCard({
          type: "daily_challenge",
          title: "تحدي اليوم الواقعي",
          explanation: "تثبيت تحدي اليوم في لوحتك الرئيسية: 20 دقيقة قراءة أو تركيز بدون تفقد الهاتف.",
          relevanceReason: "يحول الخطة الأسبوعية إلى خطوة يومية تبدأ بها اليوم.",
          challengeTitle: "20 دقيقة تركيز أو قراءة اليوم والموبايل في غرفة أخرى",
        }),
      };
    }

    // 12. Habits / Offline alternatives
    if (/(عادة|عادات|سلسلة|التزام|وقعت|كسرت|بدائل|بديل|فراغ|اقترح|اقتراح|نشاط|habit|streak|alternative)/i.test(msg)) {
      const interest = ctx.habitInterests?.[0];
      const suggestedHabitTitle =
        interest === "movement"
          ? "المشي 15 دقيقة بدون هاتف"
          : interest === "mindfulness"
            ? "تنفس وهدوء 10 دقائق بعيداً عن الشاشات"
            : "قراءة 10 صفحات بدون هاتف";
      const suggestedCat =
        interest === "movement" || interest === "mindfulness" || interest === "reading"
          ? interest
          : "reading";

      return {
        reply: `بناء العادات والبدائل الواقعية لا يعتمد على الكمال — الأهم أن تكون الخطوة صغيرة وسهلة البدء:\n• 10 دقائق مشي في الهواء الطلق بدون تصفح.\n• قراءة 8–10 صفحات من كتاب ورقي.\n• تدوين 3 أسطر في دفتر عن يومك.\n\nتقدر تضيف عادة صغيرة متوازنة (مثلاً 4 أيام في الأسبوع) حتى لا تشعر بضغط المثالية.`,
        actionCard: makeCard({
          type: "new_habit",
          title: `إضافة عادة: ${suggestedHabitTitle}`,
          explanation: "إنشاء عادة واقعية متوازنة (4 أيام/أسبوع) قابلة للتعديل قبل الحفظ.",
          relevanceReason: pendingHabits.length
            ? `تكمّل عاداتك الحالية (${ctx.completedHabitsCount}/${ctx.totalHabitsCount} اليوم).`
            : "أول عادة واقعية تملأ وقت الفراغ بدل التصفح.",
          habitTitle: suggestedHabitTitle,
          habitCategory: suggestedCat,
          habitFrequencyType: "days_per_week",
          habitTargetPerWeek: 4,
        }),
      };
    }

    // 13. General Arabic fallback
    const dataLine = [
      `تركيزك اليوم ${ctx.todayFocusMinutes}/${ctx.dailyFocusTarget} د`,
      ctx.totalHabitsCount > 0 ? `والعادات ${ctx.completedHabitsCount}/${ctx.totalHabitsCount}` : null,
      topApp ? `وأكثر تطبيق مسجل ${topApp} (${topMins} د)` : null,
    ]
      .filter(Boolean)
      .join("، ");

    const variants = [
      `فهمت رسالتك يا ${ctx.userName} ("${msg.slice(0, 70)}${msg.length > 70 ? "..." : ""}").\n\nبناءً على بياناتك الحالية (${dataLine}): عشان أديك حل عملي يفيدك فعلاً دلوقتي، قولي إيه أكتر وقت في يومك بتحس إن الموبايل بيسحبك فيه غصب عنك — أول ما تصحى، وقت الشغل/المذاكرة، ولا بالليل قبل النوم؟`,
      `أهلاً بك يا ${ctx.userName}. أرقامك اليوم (${dataLine})${firstGoal ? ` وهدفك ("${firstGoal}")` : ""} بتوضح إن أفضل نقطة نبدأ منها هي الموقف نفسه مش النصائح العامة.\n\nجرّب تحكي لي بالتفصيل: إيه اللي حصل في آخر مرة مسكت فيها الموبايل وضاع منك وقت؟`,
      `نقطة مهمة يا ${ctx.userName}. بدل ما نتكلم في العموم، خلينا نشتغل على خطوة ملموسة في الساعات الجاية:\n• ${remaining > 0 ? `باقي لك ${remaining} دقيقة للوصول لهدف التركيز اليومي (${ctx.dailyFocusTarget} د)` : "أنت أنجزت هدف التركيز اليومي بالفعل!"}\n• ${pendingHabits.length ? `أقرب عادة متبقية لك اليوم هي "${pendingHabits[0].title}"` : "تقدر تبدأ بتسجيل استهلاك الشاشة اليومي في تبويب وقت الشاشة لمتابعة نمطك بدقة"}`,
    ];
    const pick = variants[assistantTurnCount % variants.length];
    return { reply: pick };
  }

  // --- English smart context-aware responses with validated Action Cards ---
  if (/(repeat|same answer|generic|bot|robotic|why always)/i.test(msg)) {
    return {
      reply: `You are right to call that out, ${ctx.userName}. Let's look directly at your actual numbers instead of giving generic advice:\n• Focus logged today: ${ctx.todayFocusMinutes}/${ctx.dailyFocusTarget} min\n• Habits completed: ${ctx.completedHabitsCount}/${ctx.totalHabitsCount}${pendingHabits.length ? ` (next pending: "${pendingHabits[0].title}")` : ""}\n${topApp ? `• Top recently logged app: ${topApp} (${topMins} min)\n` : ""}\nTell me the exact moment you are struggling with right now (e.g., "scrolling in bed", "procrastinating on studying", or "checking my phone every 10 minutes") and we will tackle that specific trigger.`,
    };
  }

  if (/^(hi|hello|hey|how are you)/i.test(msg) && msg.length < 35) {
    return {
      reply: `Hi ${ctx.userName}! I'm doing well and glad to work alongside you calmly and realistically.\n\nHow are you feeling today, and what's on your mind?`,
    };
  }

  if (msg.length < 35 && /(how|what now|example|why|next step)/i.test(msg)) {
    const prevTopic = detectPreviousTopic(lastAssistantMsg);
    if (prevTopic === "sleep") {
      return {
        reply: `To make tonight's wind-down concrete:\n1. Plug your charger in across the room 30 minutes before bed.\n2. Put a book or paper notebook on your nightstand right now.\n3. Enable Do Not Disturb for non-urgent apps.`,
        actionCard: makeCard({
          type: "new_habit",
          title: "Add bedtime phone-away habit",
          explanation: "Charge your phone away from the bed 30 minutes before sleep.",
          relevanceReason: "Turns tonight's sleep wind-down into a trackable habit.",
          habitTitle: "Phone away 30m before sleep",
          habitCategory: "sleep",
          habitFrequencyType: "days_per_week",
          habitTargetPerWeek: 5,
        }),
      };
    }
    return {
      reply: `Your immediate 2-minute step: pick one small sub-task, put your phone in another room, and prefill a 15-minute focus timer.`,
      actionCard: makeCard({
        type: "focus_session",
        title: "Prefill a 15m starter session",
        explanation: "Opens Focus Sanctuary ready for 15 minutes of single-tasking.",
        relevanceReason: `Matches your current pace (${ctx.todayFocusMinutes}/${ctx.dailyFocusTarget}m today).`,
        durationMinutes: 15,
        intention: pendingHabits[0]?.title || "One clear 15-minute step",
      }),
    };
  }

  if (/(progress|stats|summary|how am i doing)/i.test(msg)) {
    return {
      reply: `Here is your real logged progress today, ${ctx.userName}:\n• Focus time: ${ctx.todayFocusMinutes}/${ctx.dailyFocusTarget} min (${remaining > 0 ? `${remaining} min left` : "daily target reached"}).\n• Habits: ${ctx.completedHabitsCount}/${ctx.totalHabitsCount} completed.\n• Self-reported screen time today: ${ctx.todayScreenTimeMinutes} min${topApp ? ` (${topApp} is your most logged app recently at ${topMins} min)` : ""}.`,
      actionCard:
        remaining > 0
          ? makeCard({
              type: "focus_session",
              title: `Close today's gap (${targetFocusBlock}m)`,
              explanation: `Prepare a ${targetFocusBlock}-minute focus session to finish strong without rushing.`,
              relevanceReason: `You have ${remaining}m remaining toward your ${ctx.dailyFocusTarget}m target.`,
              durationMinutes: targetFocusBlock,
              intention: "Finish daily focus target",
            })
          : undefined,
    };
  }

  if (/(morning|wake up)/i.test(msg)) {
    return {
      reply: `Scrolling first thing in the morning trains your brain to crave rapid stimulation all day.\n• Keep your first 20 waking minutes feed-free.\n• Charge your phone away from the bed so turning off the alarm gets you standing up.\n• Pair waking up with one physical anchor (water, sunlight, or writing today's #1 priority).`,
      actionCard: makeCard({
        type: "daily_challenge",
        title: "Morning feed-free challenge",
        explanation: "Set today's offline challenge to protect your first 20 minutes after waking.",
        relevanceReason: "Directly addresses morning phone reflex.",
        challengeTitle: "Keep the first 20 waking minutes free of social feeds",
      }),
    };
  }

  if (/(bedtime|sleep|night)/i.test(msg)) {
    return {
      reply: `Late-night scrolling usually sticks because your brain is tired and passive feeds take zero effort.\n\n• Place your charger across the room 30 minutes before bed.\n• Put a physical book or notebook within reach so the cue has an easy offline replacement.\n• Silence non-urgent notifications before bedtime.`,
      actionCard: makeCard({
        type: "new_habit",
        title: "Add 30m screen-free wind-down",
        explanation: "Track keeping screens away 30 minutes before bedtime, 5 nights a week.",
        relevanceReason: topApp
          ? `Helps reduce late-evening pull toward ${topApp}.`
          : "Protects rest quality without strict rules.",
        habitTitle: "Screens off 30m before sleep",
        habitCategory: "sleep",
        habitFrequencyType: "days_per_week",
        habitTargetPerWeek: 5,
      }),
    };
  }

  if (/(studying|study|work|focus|procrastinat)/i.test(msg)) {
    return {
      reply: `When focus drops during work or study, friction at the start is usually the culprit.\n\n• Pick one concrete task and shrink the first commit to ${targetFocusBlock} minutes.\n• Put your phone out of sight${topApp ? ` so ${topApp} does not pull your attention` : ""}.\n• ${remaining > 0 ? `You have ${remaining} minutes left toward today's target.` : "You already hit today's target — keep it calm and steady."}`,
      actionCard: makeCard({
        type: "focus_session",
        title: `Start a ${targetFocusBlock}-min study/work block`,
        explanation: "Prefills Focus Sanctuary with a single-task intention so you can start cleanly.",
        relevanceReason: `Based on your ${ctx.todayFocusMinutes}/${ctx.dailyFocusTarget}m focus log today.`,
        durationMinutes: targetFocusBlock,
        intention: "Single-task study or deep work block",
      }),
    };
  }

  if (/(stress|bored|tired|anxious|overwhelm|guilt)/i.test(msg)) {
    return {
      reply: `Mindless scrolling often spikes when you feel tired, stressed, or overwhelmed — it is a quick escape, not a character flaw.\n• Take a genuine 10-minute screen-free break (water, stretch, fresh air) because feeds don't actually rest your brain.\n• Lower today's bar to one 10-minute focus block or "${pendingHabits[0]?.title || "a short offline habit"}".\n• If persistent focus or stress struggles deeply affect daily life, speaking with a qualified professional can help.`,
      actionCard: makeCard({
        type: "focus_session",
        title: "Gentle 10-minute reset block",
        explanation: "Shrinks the commitment to 10 low-pressure minutes when energy is low.",
        relevanceReason: "Keeps momentum gentle without adding guilt.",
        durationMinutes: 10,
        intention: "Gentle 10-minute low-pressure start",
      }),
    };
  }

  if (/(routine|challenge|7-day|plan)/i.test(msg)) {
    return {
      reply: `Here is a grounded 7-day plan around your ${ctx.dailyFocusTarget}-minute focus goal:\n1. Days 1–2: Keep the first 20 minutes of your morning screen-free.\n2. Days 3–4: Run one focused session daily with your phone in another room.\n3. Days 5–6: Replace one evening scroll block with ${pendingHabits[0]?.title || "a 15-minute walk or reading"}.\n4. Day 7: Check your Weekly Review to adjust one friction point.`,
      actionCard: makeCard({
        type: "daily_challenge",
        title: "Set today's offline challenge",
        explanation: "Adds a practical 1-day phone-in-another-room challenge to your Dashboard.",
        relevanceReason: `Matches your ${ctx.dailyFocusTarget}m daily focus commitment.`,
        challengeTitle: "Complete one focus block with your phone in another room",
      }),
    };
  }

  if (/(social media|scroll|tiktok|instagram|youtube|screen time|limit|goal)/i.test(msg)) {
    return {
      reply: `Managing ${topApp || "short-form feeds"} works best through environment friction rather than willpower alone.\n• Move ${topApp || "social apps"} off your home screen and turn off non-human notifications.\n• Set a realistic daily screen-time goal so self-reported logs have clear context.`,
      actionCard: makeCard({
        type: "screen_time_goal",
        title: `Set ${suggestedGoalMins}m daily screen-time goal`,
        explanation: "Updates your daily self-reported social/screen awareness goal in Screen Time.",
        relevanceReason: topApp
          ? `Tailored around your recent ${topApp} (${topMins}m) logs.`
          : "Gives a calm daily ceiling for awareness.",
        screenTimeGoalMinutes: suggestedGoalMins,
      }),
    };
  }

  if (/(alternative|habit|read|walk|hobby|offline)/i.test(msg)) {
    const interest = ctx.habitInterests?.[0];
    const habitTitle =
      interest === "movement"
        ? "Walk 15 minutes phone-free"
        : interest === "mindfulness"
          ? "10 minutes quiet breathing"
          : "Read 10 pages before checking feeds";
    const habitCat =
      interest === "movement" || interest === "mindfulness" || interest === "reading"
        ? interest
        : "reading";
    return {
      reply: `Offline swaps stick best when they feel restorative rather than like chores:\n• A 10–15 minute walk without headphones.\n• 10 pages of a physical book or 3 lines of journaling.\n• Tea or stretching away from screens.`,
      actionCard: makeCard({
        type: "new_habit",
        title: `Create habit: ${habitTitle}`,
        explanation: "Opens the Habit form prefilled at 4 days/week so you can review and save it.",
        relevanceReason: "Replaces automatic scrolling with an offline anchor.",
        habitTitle,
        habitCategory: habitCat,
        habitFrequencyType: "days_per_week",
        habitTargetPerWeek: 4,
      }),
    };
  }

  return {
    reply: `I hear you, ${ctx.userName}. Looking at your real logs (${ctx.todayFocusMinutes}/${ctx.dailyFocusTarget} focus minutes${topApp ? `, ${topMins}m recently logged on ${topApp}` : ""}, ${ctx.completedHabitsCount}/${ctx.totalHabitsCount} habits done today):\n\nWhat part of your day feels most vulnerable to distraction — morning startup, mid-day work/study, or late evening? Tell me a bit more about that moment and we can design a specific, realistic adjustment.`,
  };
}

export async function generateCoachReply(params: {
  message: string;
  history: ChatHistoryMessage[];
  context: CoachContextPayload;
}): Promise<{ reply: string; source: "gemini" | "local-coach"; actionCard?: CoachActionCard }> {
  const { message, history = [], context } = params;
  const replyInArabic = context?.language === "ar" || containsArabic(message);

  if (!hasValidGeminiKey()) {
    return {
      ...buildSmartLocalReply(message, history, context, replyInArabic),
      source: "local-coach",
    };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const contextBlock = buildContextSummary(context, replyInArabic);
    const chatHistory = history.slice(-10).map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.content }],
    }));

    const chat = ai.chats.create({
      model: "gemini-4-hydrogen",
      history: chatHistory,
      config: {
        systemInstruction: `${AI_SYSTEM_ROLE}\n\n${contextBlock}`,
      },
    });

    const response = await chat.sendMessage({
      message: message.trim(),
    });

    const parsed = response.text ? parseCoachModelPayload(response.text) : null;
    if (!parsed) {
      return {
        ...buildSmartLocalReply(message, history, context, replyInArabic),
        source: "local-coach",
      };
    }

    return {
      reply: parsed.reply,
      ...(parsed.actionCard ? { actionCard: parsed.actionCard } : {}),
      source: "gemini",
    };
  } catch (err) {
    console.error("[coachEngine] Gemini API error:", err);
    return {
      ...buildSmartLocalReply(message, history, context, replyInArabic),
      source: "local-coach",
    };
  }
}

export async function generateWeeklyCoachInsight(
  context: CoachContextPayload
): Promise<{ report: string; source: "gemini" | "local-coach" }> {
  const replyInArabic = context.language === "ar";
  const { topApp, topMins } = summarizeTopApps(context);

  if (!hasValidGeminiKey()) {
    const report = replyInArabic
      ? `ملخصك السلوكي يا ${context.userName}:\n• حافظت على سلسلة التزام لمدة ${context.streakDays} أيام وسجّلت ${context.todayFocusMinutes} دقيقة تركيز اليوم (${context.completedHabitsCount} من ${context.totalHabitsCount} عادات مكتملة).${topApp ? `\n• الملاحظة الأهم: ${topApp} استهلك ${topMins} دقيقة في سجلاتك الأخيرة — تقليل 15 دقيقة منه يومياً سيمنحك مساحة ممتازة لعاداتك.` : ""}\n• تحدي الأسبوع القادم: احمِ أول 20 دقيقة من صباحك قبل فتح أي تطبيق تواصل.`
      : `Weekly Behavioral Summary for ${context.userName}:\n• You are maintaining a ${context.streakDays}-day streak with ${context.todayFocusMinutes} focus minutes today (${context.completedHabitsCount}/${context.totalHabitsCount} habits completed).${topApp ? `\n• Key observation: ${topApp} accounted for ${topMins} logged minutes recently — shifting 15 minutes away from it creates easy room for offline habits.` : ""}\n• Next week's micro-challenge: keep your first 20 morning minutes free of social feeds.`;
    return { report, source: "local-coach" };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const prompt = `${buildContextSummary(context, replyInArabic)}

Generate a concise, encouraging Weekly Digital Wellness Report (3 short bullet points: 1 positive pattern from their real logged numbers, 1 gentle observation, 1 realistic next-week micro-challenge). Respond strictly in ${replyInArabic ? "Arabic (العربية)" : "English"}.`;

    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: prompt,
      config: {
        systemInstruction: AI_SYSTEM_ROLE,
      },
    });

    return {
      report:
        response.text?.trim() ||
        (replyInArabic
          ? "استمر في بناء عادات تركيز هادئة ومستدامة يوماً بعد يوم."
          : "Keep building calm, steady focus routines one day at a time."),
      source: "gemini",
    };
  } catch (err) {
    console.error("[coachEngine] Weekly insight error:", err);
    return {
      report: replyInArabic
        ? "تعذر الاتصال بمحرك Gemini حالياً. استمر في متابعة دقائق تركيزك وعاداتك اليومية."
        : "Unable to reach Gemini right now. Keep tracking your focus minutes and daily habits.",
      source: "local-coach",
    };
  }
}
