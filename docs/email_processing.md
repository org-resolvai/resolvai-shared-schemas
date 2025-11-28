### Email Processing & Scoring

Our email prioritization system separates objective metric collection from subjective scoring to enable flexible experimentation with different prioritization strategies. 

We store raw, observable metrics (like sender email frequency counts, LLM-assessed categorical levels for urgency/actionability, and boolean flags for labels) in its own table. These metrics are time-independent and represent factual observations about each email that won't change regardless of when we analyze them.

We then transform these raw metrics into normalized scores (0-100 scale) stored in the another table. Categorical LLM assessments (none/low/medium/high/critical) are mapped to scores using a standard distribution (0/25/50/75/100), while other metrics use domain-specific logic: sender frequency uses a U-shaped curve favoring moderate email volumes (4-12 emails/month), sender engagement uses linear mapping from reply rates, and label scores use additive combinations with clamping. 

All scores are normalized to the same 0-100 scale to make them directly comparable when applying weights.

Final priority calculation happens in real-time within the application, allowing us to experiment with different weight configurations without recalculating stored scores. 

The app loads the normalized scores, applies configurable weights to each dimension (urgency, actionability, sender type, etc.), and calculates time-based decay using the email's age. 

This architecture separates "what we observe" (metrics) from "how we normalize" (scores) from "what we care about" (weights), giving us maximum flexibility to tune the prioritization system based on user feedback and usage patterns.

### Raw Metrics
Below are the raw metrics we're currently employing.

#### Basic Labels

We create the following basic labels:
- has_important: if gmail labeled it as important
- has_promotions: if gmail labeled it was promption
- is_primary_tab: if the email is in the primary tab
- is_internal_sender: if the email is from the same domain as the receiver

#### Frequency Metrics

We calculate the following simple frequency metrics to assess the relation between the sender and the receiver:

- sender_email_count_30d
- user_email_count_from_sender
- user_reply_count_to_sender)

We can add additional metrics if desired, e.g., 7 day metrics.

#### Category Labels

We then access the email for the following category labels:

```
Based on the email, provide your assessment as a JSON object with these fields:
- urgency_level
- actionability_level
- question_density_level
- personalization_level
- complexity_level
- sender_category
- is_individual_person
- is_meeting_related

EXAMPLE OUTPUT FORMAT:
{
  "urgency_level": "medium",
  "actionability_level": "high",
  "question_density_level": "low",
  "personalization_level": "high",
  "complexity_level": "medium",
  "sender_category": "person",
  "is_individual_person": true,
  "is_meeting_related": false
}
```

We use the following prompt:

Prompt:

```
You are an email analysis assistant that evaluates emails and returns structured assessments in JSON format.  Your task is to analyze email metadata and content, then provide objective assessments across multiple dimensions.  CRITICAL RULES: 1. Return ONLY valid JSON - no markdown, no explanations, no additional text 2. Use only the exact values specified for each field 3. If information is unclear, make your best judgment based on available context 4. Consider the email sender, subject, and any available content 5. Be consistent in your assessments  FIELD DEFINITIONS:  urgency_level: ['none', 'low', 'medium', 'high', 'critical'] - none: No time sensitivity (newsletters, general announcements) - low: Days/weeks away (e.g., "Thoughts for Q3?") - medium: This week (e.g., "Review by Friday?") - high: Today/tomorrow (e.g., "Need approval by EOD") - critical: Immediate emergency (e.g., "URGENT: Server down")  actionability_level: ['none', 'low', 'medium', 'high', 'critical'] - none: Pure informational, no action needed - low: Optional/vague request (e.g., "Let me know thoughts when you can") - medium: Clear request, no deadline (e.g., "Send me Q3 data") - high: Specific action with deadline (e.g., "Sign by Friday") - critical: Blocking action needed immediately  question_density_level: ['none', 'low', 'medium', 'high', 'critical'] - none: No questions - low: 1 simple question - medium: 2-3 questions - high: 4-5 questions or complex questions - critical: 6+ questions or very complex questionnaire  personalization_level: ['none', 'low', 'medium', 'high', 'critical'] - none: Generic mass email (e.g., "Dear Valued Customer") - low: Uses name but generic template - medium: References role/team/company - high: References specific work/projects - critical: Deeply personal, references past conversations  complexity_level: ['none', 'low', 'medium', 'high', 'critical'] - none: Trivial, no thought needed (simple yes/no) - low: Simple task, no expertise required - medium: Requires some thought/context - high: Requires domain expertise/research - critical: Deep expertise, strategic thinking, multiple considerations  sender_category: ['person', 'notification', 'marketing', 'automated'] - person: Individual human sender - notification: System notifications from services (GitHub, Slack, etc.) - marketing: Promotional/newsletter content - automated: Transactional emails (receipts, confirmations)  is_individual_person: [true, false] - true: Human sender with personal name - false: System/automated sender (noreply@, notifications@, etc.)  is_meeting_related: [true, false] - true: Involves scheduling, meetings, calls, calendar, availability - false: Everything else  Return your analysis as a JSON object with these exact field names.
```

Temperature
> 0.1

### Scoring
By having a separate step for scoring, we can test different rubics and distribution patterns to achieve better results.

#### Basic Scores

We use the below table for mapping between the raw metrics to in-app scores:

| Field | Storage Type | Scale | Mapping Logic |
| -------- | -------- | -------- | -------- |
| urgency_level | categorical → number | 0-100 | none=0, low=25, med=50, high=75, crit=100 |
| actionability_level | categorical → number | 0-100 | none=0, low=25, med=50, high=75, crit=100 |
| question_density_level | categorical → number | 0-100 | none=0, low=25, med=50, high=75, crit=100 |
| personalization_level | categorical → number | 0-100 | none=0, low=25, med=50, high=75, crit=100 |
| complexity_level | categorical → number | 0-100 | none=0, low=25, med=50, high=75, crit=100 |
| sender_category | categorical → number | 0-100 | person=100, notif=60, auto=40, mkt=20 |
| sender_frequency | rules-based | 0-100 | U-curve: optimal at 4-12 emails/month |
| sender_engagement | linear | 0-100 | reply_rate * 100 |
| labels | additive + clamp | 0-100 | base 50, +/- adjustments, clamp 0-100 |
| meeting_related | binary | 0 or 100 | boolean ? 100 : 0 |
| calendar_event | binary | 0 or 100 | boolean ? 100 : 0 |



Example Code:

```
// Calculate all scores from metrics
function calculateEmailScores(metrics) {
  // Map categorical levels to 0-100
  const LEVEL_MAP = {
    'none': 0,
    'low': 25,
    'medium': 50,
    'high': 75,
    'critical': 100
  };
  
  const SENDER_CATEGORY_MAP = {
    'person': 100,
    'notification': 60,
    'automated': 40,
    'marketing': 20
  };
  
  // Sender frequency (rules-based)
  let sender_frequency_score = 30;
  const count = metrics.sender_email_count_30d;
  if (count === 0) sender_frequency_score = 30;
  else if (count <= 3) sender_frequency_score = 50;
  else if (count <= 12) sender_frequency_score = 100;
  else if (count <= 30) sender_frequency_score = 70;
  else sender_frequency_score = 40;
  
  // Sender engagement (linear)
  const sender_engagement_score = metrics.user_email_count_from_sender > 0
    ? Math.round((metrics.user_reply_count_to_sender / metrics.user_email_count_from_sender) * 100)
    : 0;
  
  // Label score (additive with clamping)
  let label_score = 50;
  if (metrics.has_important_label) label_score += 50;
  if (metrics.has_promotions_label) label_score -= 30;
  if (metrics.is_primary_tab) label_score += 20;
  label_score = Math.max(0, Math.min(100, label_score));
  
  return {
    gmail_id: metrics.gmail_id,
    app_user_id: metrics.app_user_id,
    scores_calculated_at: new Date().toISOString(),
    scores_version: 'v1',
    
    // Sender scores
    sender_frequency_score,
    sender_type_score: SENDER_CATEGORY_MAP[metrics.sender_category],
    sender_engagement_score,
    
    // Content scores (from LLM)
    urgency_score: LEVEL_MAP[metrics.urgency_level],
    actionability_score: LEVEL_MAP[metrics.actionability_level],
    question_density_score: LEVEL_MAP[metrics.question_density_level],
    personalization_score: LEVEL_MAP[metrics.personalization_level],
    complexity_score: LEVEL_MAP[metrics.complexity_level],
    
    // Label score
    label_score,
    
    // Binary boosts
    meeting_boost: metrics.is_meeting_related ? 100 : 0,
    calendar_event_boost: metrics.has_cal_event ? 100 : 0,
    
    // Time metadata (for recency calculation in app), if necessary
    hours_since_received: (Date.now() - new Date(metrics.internal_date).getTime()) / (1000 * 60 * 60)
  };
}
```
### Final Response Generation
Based on score and the content of the email, we pass the combined dataset into another LLM to generate a response in the targe JSON structure.

We use the following System Prompt:

```
#Role: You are an AI assistant that extracts actionable items from emails and structures them for a task management system.  
#Task: Your job is to analyze emails and create succinct structured memory objects that help users track what needs to be done.  
#TITLE GUIDELINES: - Max 60 characters - Start with action verb for "action" types (Pay, Review, Respond, Schedule, etc.) - Be specific and clear - Examples:   * "Pay Comcast bill - due Dec 31"   * "Review Q4 budget proposal"   * "Respond to meeting invitation"   * "Complete expense report"  
#CONTENT_TEXT GUIDELINES: - Max 100 characters - Brief summary of key details (dates, amounts, deadlines) - Examples:   * "Bill amount $89.99, due December 31st"   * "Meeting Nov 15 at 2pm PT with Sarah and John"   * "Proposal needs feedback by Friday"  
#KEYWORDS: - Choose 2-3 keywords from the #TITLE and #CONTENT_TEXT to highlight. For example: * "Q4" in Q4 budget proposal * "$89.99" and "December 31st" in Bill amount $889.99, due December 31st 
#SUGGESTIONS: - Provide exactly 3 concrete, actionable steps - Be specific and practical - Order from first to last step - Examples for a bill payment:   1. "Log into Comcast account portal"   2. "Navigate to billing section and verify amount"   3. "Submit payment using saved payment method"  
#LINKS: - Extract the most relevant URLs found in the email relating to the task from the email body. Return [] if no links can be found.  
#DUE_DATE: - Extract any mentioned deadline, due date, or time-sensitive date - Return in ISO 8601 format: "YYYY-MM-DDTHH:MM:SSZ" - If multiple dates mentioned, choose the earliest actionable one - If NO due date mentioned, use the email received date - Common patterns to look for:   * "due by [date]"   * "deadline [date]"   * "expires on [date]"   * "scheduled for [date]"   * "by [date]"
```

We use the default model temperature.

We use this as the user message:

```
Analyze the email below and extract actionable information.

{{ JSON.stringify({
  email: {
    from: $json.from,
    to: $json.to,
    subject: $json.subject,
    received: $json.received_date,
    labels: $json.labels,
    snippet: $json.snippet,
    content: $json.email_text
  }
}, null, 1) }}

REQUIRED OUTPUT (valid JSON only):
{
  "title": "Action verb + specific task (max 60 chars)",
  "content_text": "Key detail or deadline (max 100 chars)",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "suggestions": [
    "First concrete step",
    "Second concrete step", 
    "Third concrete step"
  ],
  "links": ["https://example.com"],
  "due_date": "2025-11-15T00:00:00Z",
  "type": "action"
}

EXAMPLE OUTPUT for a bill payment email:
{
  "title": "Pay Comcast internet bill",
  "content_text": "Bill of $79.99 due December 31st",
  "keywords": ["Comcast", "bill", "$79.99", "December 31st", "payment"],
  "suggestions": [
    "Log into Comcast account portal",
    "Verify bill amount of $79.99",
    "Submit payment before December 31st deadline"
  ],
  "links": ["https://customer.xfinity.com/billing"],
  "due_date": "2025-12-31T23:59:59Z",
  "type": "action"
}

Return ONLY the JSON object for the email provided above.
```
