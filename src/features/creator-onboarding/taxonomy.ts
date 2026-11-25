// Maintainable Creator taxonomies. Codes mirror aura_creator.*_ref seed rows (drift is test-checked).
export const niches = [
  ["fashion", "Fashion"],
  ["beauty_skincare", "Beauty and skincare"],
  ["fitness", "Fitness"],
  ["food", "Food"],
  ["travel", "Travel"],
  ["technology", "Technology"],
  ["education", "Education"],
  ["finance", "Finance"],
  ["gaming", "Gaming"],
  ["entertainment", "Entertainment"],
  ["lifestyle", "Lifestyle"],
  ["photography", "Photography"],
  ["personal_development", "Personal development"],
  ["business", "Business and entrepreneurship"],
  ["art_design", "Art and design"],
  ["other", "Other"],
] as const;
export const nicheCodes = [...niches.map(([c]) => c), "custom"] as string[];
export const industries = [
  ["fashion_apparel", "Fashion and apparel"],
  ["beauty_personal_care", "Beauty and personal care"],
  ["food_beverage", "Food and beverage"],
  ["health_wellness", "Health and wellness"],
  ["fitness_sports", "Fitness and sports"],
  ["travel_hospitality", "Travel and hospitality"],
  ["technology_apps", "Technology and apps"],
  ["education_edtech", "Education and edtech"],
  ["finance_fintech", "Finance and fintech"],
  ["gaming", "Gaming"],
  ["entertainment_media", "Entertainment and media"],
  ["home_living", "Home and living"],
  ["automotive", "Automotive"],
  ["alcohol", "Alcohol"],
  ["tobacco_vaping", "Tobacco and vaping"],
  ["gambling_betting", "Gambling and betting"],
  ["cryptocurrency", "Cryptocurrency"],
  ["political", "Political"],
  ["adult", "Adult"],
  ["other", "Other"],
] as const;
export const industryCodes = industries.map(([c]) => c) as string[];
export const challenges = [
  ["content_ideas", "Finding content ideas"],
  ["choosing_niche", "Selecting a niche"],
  ["scripts_captions", "Writing scripts and captions"],
  ["hooks", "Creating engaging hooks"],
  ["consistency", "Maintaining consistency"],
  ["analytics", "Understanding analytics"],
  ["content_quality", "Improving content quality"],
  ["engagement", "Improving audience engagement"],
  ["confidence", "Building confidence"],
  ["time", "Managing available time"],
  ["finding_brands", "Finding Brand collaborations"],
  ["negotiation", "Negotiating compensation"],
  ["commercial_workflow", "Understanding commercial workflows"],
  ["portfolio", "Building a portfolio"],
  ["monetization", "Monetizing content"],
  ["other", "Something else"],
] as const;
export const challengeCodes = challenges.map(([c]) => c) as string[];
export const stages = [
  [
    "aspiring",
    "Aspiring Creator",
    "Just starting, or still deciding what to make.",
  ],
  ["emerging", "Emerging Creator", "Posting, with a small or early audience."],
  ["growing", "Growing Creator", "A steady audience and a regular rhythm."],
  ["established", "Established Creator", "A strong audience and experience."],
  [
    "ugc_focused",
    "UGC-focused Creator",
    "Making content for Brands rather than for an audience.",
  ],
] as const;
export const goalCategories = [
  ["audience_growth", "Audience growth", "follower_count"],
  ["engagement", "Engagement", "engagement_rate"],
  ["consistency", "Content consistency", "posts_per_week"],
  ["content_quality", "Content quality", null],
  ["personal_brand", "Personal branding", null],
  ["professional_profile", "Professional profile", null],
  ["brand_collaborations", "Brand collaborations", null],
  ["ugc", "UGC opportunities", "posts_per_month"],
  ["monetization", "Monetization", "monthly_income"],
  ["skill_development", "Creative skill development", null],
] as const;
export const metricLabels: Record<string, string> = {
  follower_count: "Followers",
  engagement_rate: "Engagement rate (%)",
  posts_per_week: "Posts per week",
  posts_per_month: "Posts per month",
  monthly_income: "Monthly income",
};
export const platforms = [
  ["instagram", "Instagram"],
  ["youtube", "YouTube"],
  ["facebook", "Facebook"],
  ["linkedin", "LinkedIn"],
  ["threads", "Threads"],
  ["other", "Other link"],
] as const;
export const accountTypes = [
  ["personal", "Personal"],
  ["creator", "Creator"],
  ["business", "Business"],
] as const;
// Operational availability follows the approved release sequencing. Preferences are stored for all six.
export const collaborationCategories = [
  ["paid_influencer", "Paid influencer", "initial"],
  ["ugc", "UGC", "initial"],
  ["barter", "Barter", "initial"],
  ["event", "Events", "later"],
  ["ambassador", "Ambassador partnerships", "later"],
  ["affiliate", "Affiliate", "attribution_dependent"],
] as const;
export const availabilityText = {
  initial: "Planned for the first release",
  later: "Planned for a later release",
  attribution_dependent: "Depends on attribution readiness",
} as const;
export const rateFormats = [
  ["short_video", "Short-form video"],
  ["long_video", "Long-form video"],
  ["static_post", "Static post"],
  ["story", "Story"],
  ["carousel", "Carousel"],
  ["ugc_video", "UGC video"],
  ["product_photography", "Product photography"],
  ["other", "Other format"],
] as const;
export const equipment = [
  ["smartphone", "Smartphone"],
  ["camera", "Camera"],
  ["microphone", "Microphone"],
  ["lighting", "Lighting"],
  ["editing_tools", "Editing tools"],
  ["production_support", "Production help"],
] as const;
export const currencies = [
  "INR",
  "USD",
  "EUR",
  "GBP",
  "AED",
  "SGD",
  "AUD",
  "CAD",
] as const;
export const languages = [
  ["en", "English"],
  ["hi", "Hindi"],
  ["bn", "Bengali"],
  ["ta", "Tamil"],
  ["te", "Telugu"],
  ["mr", "Marathi"],
  ["gu", "Gujarati"],
  ["kn", "Kannada"],
  ["ml", "Malayalam"],
  ["pa", "Punjabi"],
  ["ur", "Urdu"],
  ["es", "Spanish"],
  ["fr", "French"],
  ["de", "German"],
  ["pt", "Portuguese"],
  ["ar", "Arabic"],
  ["id", "Indonesian"],
] as const;
export const countries = [
  ["IN", "India"],
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["AE", "United Arab Emirates"],
  ["SG", "Singapore"],
  ["AU", "Australia"],
  ["CA", "Canada"],
  ["DE", "Germany"],
  ["FR", "France"],
  ["ID", "Indonesia"],
  ["BD", "Bangladesh"],
  ["NP", "Nepal"],
  ["LK", "Sri Lanka"],
  ["PK", "Pakistan"],
  ["PH", "Philippines"],
  ["MY", "Malaysia"],
  ["ZA", "South Africa"],
  ["NG", "Nigeria"],
  ["BR", "Brazil"],
  ["MX", "Mexico"],
] as const;
export const label = (
  list: readonly (readonly [string, string, ...unknown[]])[],
  code: string,
) => list.find(([c]) => c === code)?.[1] ?? code;
