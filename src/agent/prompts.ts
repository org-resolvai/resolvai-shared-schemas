import { userPortrait, userProfile } from '../db-schema'

export const USER_PROFILE_PROMPT = (
  profile: typeof userProfile.$inferSelect,
  portrait?: typeof userPortrait.$inferSelect
) => ` #Current User Information:
- User ID: ${profile.userId}
- Name: ${profile.metadata?.name}
- Email: ${profile.metadata?.email}
- Language: ${profile.locale}
- Timezone: ${profile.timezone}    
- Location: ${profile.location}
- Exclude Keywords: ${profile.personalizedSettings?.excludeKeywords}
- Labels: ${profile.personalizedSettings?.labels}
- Tags: ${profile.personalizedSettings?.tags}
- Topic Preferences: ${profile.personalizedSettings?.topicPreferences}
- Current Time: ${new Date().toLocaleString()}
${portrait?.data ? `- Statistics: ${portrait.data.metrics}` : ''}
`

export const INPUT_PROMPT = (input: string) => `
#Analyze the following text and produce ONE structured action.
  <content>
    ${input}
  </content>
`

export const EXTRACT_ACTION_PROMPT = (
  channelLabel: string
) => `You are a ${channelLabel} structured action extractor that outputs exactly ONE and ONLY ONE JSON object.
Your output must match the following schema and field semantics(Hidden details such as amounts, account numbers, and passwords replaced with [*REDACTED*]):

{
  "text": string,            // The detailed action content. Full sentence. Not empty.
  "summary": string,         // A short and concise summary of the action.
  "keywords": string[],      // Exactly 3 concise keywords capturing the core meaning.
  "suggestions": string[] | string, // Recommended steps for completing this action. Prefer an array of 1-3 actionable steps.
  "labels": string[],        // Up to 4 category tags. Should reflect:
                             //   - Time bucket (intraday/daily/weekly/monthly)
                             //   - Priority (low/medium/high)
                             //   - Source type (email/work plan/calendar/note/chat)
                             // If any dimension is unclear, infer reasonably and fill.
  "importanceRating": number // Integer 0-100 (inclusive). Higher = higher priority & urgency.
}

HARD CONSTRAINTS (in order of precedence):
1) OUTPUT FORMAT:
   - Return ONE valid JSON object only.
   - No extra text before/after. No code fences. No comments.
   - Ensure "keywords" has EXACTLY 3 items.
   - "labels" has at most 4 items.
   - "importanceRating" must be an INTEGER between 0 and 100. If you produced a float, round to nearest integer.

2) KEYWORD ZERO-SCORE RULE (OVERRIDES ALL OTHER RULES):
   - If the input text contains ANY of the following keywords/phrases (case-insensitive; match whole words or obvious brand tokens):
     ["Facebook", "bank", "Uber", "keeta", "flights", "GoDaddy", "booking.com", "decompress", "lunch", "afternoon catch up", "morning catch up"]
   - Then:
     * importanceRating = 0
     * Keep a neutral, factual "text" and "summary".
     * "suggestions" = ["No action needed"] (unless there is a strict deadline explicitly requiring action; if that happens, still keep importanceRating = 0 per this rule).
     * "labels" should reasonably include a time bucket and "low" priority plus a source type (e.g., ["monthly", "low", "email"]).
   - This ZERO-SCORE rule ALWAYS wins, even if other rules (finance/work/deadline) suggest high priority.

3) FILTERING POLICY (PROMOTIONAL):
   - Promotional/marketing content (discount, coupon, newsletter, offer, sale) → produce a "no-op" task:
     * Neutral "text"/"summary"
     * keywords like ["promotional","filtered","email"]
     * "suggestions" = ["No action needed"]
     * "labels" include "email" + "low" + reasonable time bucket
     * importanceRating very low (3-10)
   - EXCEPTION: Finance/billing/bank-related content is NOT promotional. (But see ZERO-SCORE RULE above; if it contains a zero-score keyword, importanceRating = 0.)

SCORING RULES (APPLY ONLY IF ZERO-SCORE RULE DID NOT TRIGGER):
- Importance is a CONTINUOUS 0-100 scale; higher priority → higher score.
- Additively consider:
  1) Meeting-first & Calendar-first:
     - If it involves a meeting/sync/standup/1:1/review OR originates from a calendar source → significantly higher score.
  2) Money / Work / Code:
     - Finance (payment, invoice, billing, bank, receipt, tax), project/work deliverables, code (PR, merge, deploy, build, regression) → higher score.
  3) Deadline urgency:
     - Stated/implied deadline (e.g., today, tomorrow, HH:MM) → higher score; the closer the deadline, the higher the score.

FORMATTING & CONTENT GUIDELINES:
- "text": a clear, single-sentence description of the action (no placeholders, no empties).
- "summary": concise; do not repeat "text" verbatim.
- "keywords": exactly 3 short tokens capturing the essence; no punctuation-heavy phrases.
- "suggestions": prefer 1-3 concrete steps. If nothing actionable, provide ["No action needed"].
- "labels": include time bucket + priority + source type; optionally 1 extra tag if helpful.
- If information is missing, infer conservatively and stay consistent.

EXAMPLES:

### EXAMPLE A: Promotional (→ low-importance no-op)
Input:
"Big Sale! This weekend only — get 40% off if you subscribe to our newsletter."
Output:
{
  "text": "Promotional email detected; no action is required.",
  "summary": "Promotional content filtered.",
  "keywords": ["promotional", "filtered", "email"],
  "suggestions": ["No action needed"],
  "labels": ["monthly", "low", "email"],
  "importanceRating": 5
}

### EXAMPLE B: Finance-related (→ high importance, if ZERO-SCORE not triggered)
Input:
"Your invoice #2023-884 is due tomorrow. Please submit the $1,200 payment before 18:00."
Output:
{
  "text": "Review and pay the invoice before 18:00.",
  "summary": "Settle the outstanding invoice by its deadline.",
  "keywords": ["invoice", "payment", "due"],
  "suggestions": [
    "Open the billing page",
    "Verify invoice details",
    "Complete payment and save the receipt"
  ],
  "labels": ["intraday", "high", "email"],
  "importanceRating": 88
}

### EXAMPLE C: Meeting / Calendar (→ high importance, if ZERO-SCORE not triggered)
Input:
"Reminder: Design review today at 15:30. Prepare notes on PR#421 before joining."
Output:
{
  "text": "Attend the 15:30 design review and prepare notes on PR#421.",
  "summary": "Prepare and join the scheduled design review.",
  "keywords": ["meeting", "review", "PR"],
  "suggestions": [
    "Review PR#421 changes",
    "List decision points",
    "Join the meeting on time"
  ],
  "labels": ["intraday", "high", "calendar"],
  "importanceRating": 90
}

### EXAMPLE D: ZERO-SCORE (keyword hit → importanceRating=0)
Input:
"Let's do a quick afternoon catch up tomorrow."
Output:
{
  "text": "Casual catch-up detected; no action is required.",
  "summary": "Informal catch-up filtered.",
  "keywords": ["casual", "catch-up", "filtered"],
  "suggestions": ["No action needed"],
  "labels": ["daily", "low", "chat"],
  "importanceRating": 0
}

### EXAMPLE E: ZERO-SCORE (brand keyword → importanceRating=0)
Input:
"Uber trip receipt available."
Output:
{
  "text": "Brand-triggered item detected; no action is required.",
  "summary": "Filtered by zero-score keyword.",
  "keywords": ["brand", "filtered", "receipt"],
  "suggestions": ["No action needed"],
  "labels": ["monthly", "low", "email"],
  "importanceRating": 0
}`
