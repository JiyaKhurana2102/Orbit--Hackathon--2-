import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const app = new Hono();

app.use("*", logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-User-Token"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// ─── Supabase client ───────────────────────────────────────────────────────────
const getSupabase = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

// Reads the user JWT from the X-User-Token header.
// The Authorization header always carries the publicAnonKey so Supabase's
// Edge Function gateway accepts the request — user identity is verified here
// separately, avoiding "Invalid JWT" gateway rejections on user access tokens.
const verifyUser = async (authHeader: string | null, xUserToken?: string | null) => {
  // Prefer X-User-Token (new pattern); fall back to Authorization for compat
  let token: string | null = null;
  if (xUserToken) {
    token = xUserToken;
  } else if (authHeader) {
    const parts = authHeader.split(" ");
    token = parts[1] ?? null;
  }
  if (!token) return null;
  try {
    const supabase = getSupabase();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      console.log(`verifyUser failed: ${error?.message}`);
      return null;
    }
    return user;
  } catch (e: any) {
    console.log(`verifyUser exception: ${e.message}`);
    return null;
  }
};

// ─── Nebula / Firestore helpers ────────────────────────────────────────────────
const parseFirestoreValue = (val: any): any => {
  if (val === null || val === undefined) return null;
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.integerValue !== undefined) return parseInt(val.integerValue);
  if (val.doubleValue !== undefined) return val.doubleValue;
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.nullValue !== undefined) return null;
  if (val.timestampValue !== undefined) return val.timestampValue;
  if (val.arrayValue) return (val.arrayValue.values || []).map((v: any) => parseFirestoreValue(v));
  if (val.mapValue) {
    const result: any = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) result[k] = parseFirestoreValue(v);
    return result;
  }
  return null;
};

const parseFirestoreDoc = (doc: any) => {
  const result: any = {};
  for (const [k, v] of Object.entries(doc.fields || {})) result[k] = parseFirestoreValue(v as any);
  const parts = (doc.name || "").split("/");
  result.id = parts[parts.length - 1];
  return result;
};

const fetchNebulaOrganizations = async (): Promise<any[]> => {
  const apiKey = Deno.env.get("NEBULA_API_KEY");
  if (!apiKey) { console.log("NEBULA_API_KEY not set"); return []; }
  for (const pid of ["utdnebula-jupiter", "utdnebula", "utd-nebula"]) {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/organizations?key=${apiKey}&pageSize=100`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const data = JSON.parse(await res.text());
        if (data.documents?.length) return data.documents.map(parseFirestoreDoc);
      }
    } catch (e: any) { console.log(`Firestore ${pid} failed: ${e.message}`); }
  }
  for (const ep of ["https://api.utdnebula.com/v1/organizations", "https://api.utdnebula.com/organization"]) {
    try {
      const res = await fetch(ep, { headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}`, "X-API-Key": apiKey } });
      if (res.ok) {
        const data = JSON.parse(await res.text());
        const orgs = Array.isArray(data) ? data : data.data || data.organizations || data.results || [];
        if (orgs.length) return orgs;
      }
    } catch (e: any) { console.log(`Nebula ${ep} failed: ${e.message}`); }
  }
  return [];
};

// ─── UTD Building metadata ─────────────────────────────────────────────────────
// Derived from schedule-data.json building codes
const UTD_BUILDINGS: Record<string, { full: string; category: string; tags: string[] }> = {
  ECSN: { full: "Engineering & Computer Science North",    category: "tech-talks",   tags: ["tech", "engineering", "workshop"] },
  ECSS: { full: "Engineering & Computer Science South",    category: "workshops",    tags: ["tech", "engineering", "academic"] },
  JSOM: { full: "Naveen Jindal School of Management",      category: "networking",   tags: ["finance", "networking", "career", "business"] },
  JO:   { full: "Jonsson Performance Hall",                category: "creative",     tags: ["creative", "art", "academic", "social"] },
  SLC:  { full: "Student Learning Center",                 category: "workshops",    tags: ["academic", "workshop", "social"] },
  SPN:  { full: "Spellman Center",                         category: "social",       tags: ["social", "networking", "service"] },
  ROW:  { full: "Rowlett Hall",                            category: "social",       tags: ["social", "academic"] },
  GR:   { full: "Green Hall",                              category: "creative",     tags: ["creative", "art", "humanities"] },
  SU:   { full: "Student Union",                           category: "social",       tags: ["social", "food", "networking"] },
  ATC:  { full: "Activities Center",                       category: "career-fairs", tags: ["career", "networking", "sports"] },
  CB:   { full: "Chemistry Building",                      category: "workshops",    tags: ["science", "academic", "research"] },
  FN:   { full: "Founders North",                          category: "social",       tags: ["social", "academic"] },
};

// ─── Embedded clubs (from club-data.json / Nebula) ────────────────────────────
const EMBEDDED_CLUBS = [
  { id: "654d35edbfe4308bcdfc4005", name: "Association for Computing Machinery", slug: "association-for-computing-machinery", tags: ["Academic Interests", "Tech & Computing", "Competitions", "Educational"], profile_image: "https://storage.googleapis.com/utdnebula_jupiter/654d35edbfe4308bcdfc4005-profile", contacts: [], officers: [{ name: "Elijah Walker", position: "President" }, { name: "Hiba Mubeen", position: "Vice President" }] },
  { id: "654d3639bfe4308bcdfc41ed", name: "IEEE UTD", slug: "ieee-utd", tags: ["Educational", "Academic Interests", "Tech & Computing", "Engineering", "Robotics"], profile_image: "https://storage.googleapis.com/utdnebula_jupiter/654d3639bfe4308bcdfc41ed-profile", contacts: [{ url: "https://www.instagram.com/ieeeutd/", platform: "instagram" }], officers: [{ name: "Rushil Sivaiah", position: "President" }] },
  { id: "654d35e4bfe4308bcdfc3fba", name: "200PERCENT", slug: "200percent", tags: ["Cultural", "Art and Music", "Hobbies & Special Interests"], profile_image: "https://storage.googleapis.com/download/storage/v1/b/utdnebula_jupiter/o/654d35e4bfe4308bcdfc3fba-profile.png?generation=1753144521563194&alt=media", contacts: [{ url: "https://www.instagram.com/__200percent__/", platform: "instagram" }], officers: [{ name: "Hillary", position: "President" }] },
  { id: "654d35eabfe4308bcdfc3fe3", name: "AIGA @ UTD", slug: "american-institute-of-graphic-arts-at-utd-aiga-utd", tags: ["Art and Music", "Academic Interests", "Hobbies & Special Interests"], profile_image: "https://storage.googleapis.com/download/storage/v1/b/utdnebula_jupiter/o/654d35eabfe4308bcdfc3fe3-profile.png?generation=1753144520593139&alt=media", contacts: [{ url: "https://instagram.com/aigautd", platform: "instagram" }], officers: [{ name: "Ariel Tamez", position: "President" }] },
  { id: "654d35f1bfe4308bcdfc4022", name: "Biomedical Engineering Society", slug: "biomedical-engineering-society", tags: ["Academic Interests", "Social", "Educational", "Healthcare/Medical", "Engineering"], profile_image: "https://storage.googleapis.com/utdnebula_jupiter/654d35f1bfe4308bcdfc4022-profile", contacts: [{ url: "https://www.instagram.com/utdbmes/", platform: "instagram" }], officers: [{ name: "Prachi Bohra", position: "President" }] },
  { id: "IY30EFOkMcQDK00QHrwE", name: "Active Minds UTD", slug: "active-minds-utd", tags: ["Social", "Academic Interests", "Educational", "Health & Lifestyle", "Healthcare/Medical"], profile_image: "https://storage.googleapis.com/download/storage/v1/b/utdnebula_jupiter/o/IY30EFOkMcQDK00QHrwE-profile?generation=1766026171095751&alt=media", contacts: [{ url: "https://www.instagram.com/utdactiveminds/", platform: "instagram" }], officers: [{ name: "Shreeyalaxhmee Rao", position: "President" }] },
  { id: "zvhavTt0OuARFZWwfSoK", name: "ColorStack UTD", slug: "colorstack-2", tags: ["Tech & Computing", "Diversity", "Professional Development"], profile_image: null, contacts: [{ url: "https://www.instagram.com/colorstackutd/", platform: "instagram" }], officers: [{ name: "Hajar Abdulkadir", position: "President" }] },
  { id: "AwWdv8XAQE8PW2mXNZFr", name: "Student Union and Activities Advisory Board (SUAAB)", slug: "student-union-and-activities-advisory-board-suaab", tags: ["Social", "Service", "Student Leadership", "Student Programming Board"], profile_image: "https://storage.googleapis.com/download/storage/v1/b/utdnebula_jupiter/o/AwWdv8XAQE8PW2mXNZFr-profile?generation=1767653507873015&alt=media", contacts: [{ url: "https://www.instagram.com/utdsuaab/", platform: "instagram" }], officers: [{ name: "Shruti Gupta", position: "President" }] },
  { id: "654d360ebfe4308bcdfc40d5", name: "Health Occupations Students of America (HOSA)", slug: "health-occupations-students-of-america-hosa", tags: ["Academic Interests", "Healthcare/Medical", "Competitions", "Volunteerism"], profile_image: "https://storage.googleapis.com/download/storage/v1/b/utdnebula_jupiter/o/654d360ebfe4308bcdfc40d5-profile.png?generation=1753144519907232&alt=media", contacts: [{ url: "https://www.instagram.com/utdhosa/", platform: "instagram" }], officers: [] },
  { id: "654d35fbbfe4308bcdfc4062", name: "Comets for Better Transit", slug: "comets-for-better-transit", tags: ["Political", "Sustainability & Environmental", "Advocacy & Social Justice", "Community"], profile_image: "https://storage.googleapis.com/utdnebula_jupiter/654d35fbbfe4308bcdfc4062-profile", contacts: [{ url: "https://www.instagram.com/cometsforbettertransit", platform: "instagram" }], officers: [{ name: "Benjamin Goodine", position: "President" }] },
  { id: "3UdA1Jo4MX6hCc8HXITw", name: "UTD Men's Rugby", slug: "utd-rugby", tags: ["Sports", "Recreation", "Competitions"], profile_image: null, contacts: [{ url: "https://www.instagram.com/utd_rugby/", platform: "instagram" }], officers: [{ name: "Sebastain HV", position: "President" }] },
  { id: "654d363bbfe4308bcdfc4208", name: "Unicycle Club", slug: "unicycle-club", tags: ["Hobbies & Special Interests", "Recreation"], profile_image: "https://storage.googleapis.com/download/storage/v1/b/utdnebula_jupiter/o/654d363bbfe4308bcdfc4208-profile?generation=1767145735067388&alt=media", contacts: [{ url: "https://www.instagram.com/unicycleclub/", platform: "instagram" }], officers: [{ name: "Chase Alford", position: "President" }] },
  { id: "uhlP8S-ut7MOkgpxQZpp", name: "Threads of Hope", slug: "threads-of-hope", tags: ["Social", "Service", "Hobbies & Special Interests", "Volunteerism", "Non-Profit"], profile_image: "https://storage.googleapis.com/download/storage/v1/b/utdnebula_jupiter/o/uhlP8S-ut7MOkgpxQZpp-profile?generation=1766375789285670&alt=media", contacts: [{ url: "https://www.instagram.com/threadsofhopeutd/", platform: "instagram" }], officers: [] },
  { id: "3l4GZD8eLaeDY1ree9sX", name: "Humanity First UT Dallas", slug: "humanity-first-ut-dallas", tags: ["Social", "Volunteerism", "Sustainability & Environmental", "Non-Profit"], profile_image: "https://storage.googleapis.com/utdnebula_jupiter/3l4GZD8eLaeDY1ree9sX-profile", contacts: [{ url: "https://www.instagram.com/hfs_utdallas/", platform: "instagram" }], officers: [] },
  { id: "Apw-_Omp-hvsKVQOSGR6", name: "Khidmah UTD", slug: "khidmah-utd", tags: ["Service", "Tech & Computing", "Professional Development", "Non-Profit"], profile_image: null, contacts: [{ url: "https://www.instagram.com/khidmahutd/", platform: "instagram" }], officers: [{ name: "Roha Fatima", position: "President" }] },
  { id: "654d363fbfe4308bcdfc423a", name: "Women Mentoring Women in Engineering", slug: "women-mentoring-women-in-engineering", tags: ["Academic Interests", "Social", "Educational", "Professional Development", "Engineering"], profile_image: "https://storage.googleapis.com/download/storage/v1/b/utdnebula_jupiter/o/654d363fbfe4308bcdfc423a-profile?generation=1767672948546808&alt=media", contacts: [{ url: "https://www.instagram.com/wmweatutd/?hl=en", platform: "instagram" }], officers: [] },
  { id: "qCArZ5J36kw5ROPTtlc9", name: "Campus Emergency Response Team (CERT UTD)", slug: "campus-emergency-response-team-cert-utd", tags: ["Healthcare/Medical", "Pre-med", "Volunteerism", "Pre-health"], profile_image: null, contacts: [{ url: "https://www.instagram.com/cert_utd", platform: "instagram" }], officers: [{ name: "Ariyan Abed", position: "President" }] },
  { id: "654d361dbfe4308bcdfc4136", name: "Minority Association of Pre-Medical Students (MAPS)", slug: "minority-assoication-of-pre-medical-students", tags: ["Academic Interests", "Educational", "Healthcare/Medical", "Science", "Diversity"], profile_image: "https://storage.googleapis.com/download/storage/v1/b/utdnebula_jupiter/o/654d361dbfe4308bcdfc4136-profile.png?generation=1753144520532230&alt=media", contacts: [{ url: "https://www.instagram.com/utd_maps", platform: "instagram" }], officers: [{ name: "Chisom Akpunku", position: "Co-President" }] },
  { id: "654d362ebfe4308bcdfc41b1", name: "Society of Physics Students at UT Dallas", slug: "society-of-physics-students-at-ut-dallas", tags: ["Academic Interests", "Educational", "Professional Development", "Science"], profile_image: "https://storage.googleapis.com/utdnebula_jupiter/654d362ebfe4308bcdfc41b1-profile", contacts: [], officers: [{ name: "Aeleph Fu", position: "President" }] },
  { id: "znPXT1AgunjyirpnnxXv", name: "Preparing Researchers for PhD (PREP)", slug: "preparing-researchers-for-phd", tags: ["Academic Interests", "Educational", "Professional Development"], profile_image: "https://storage.googleapis.com/utdnebula_jupiter/znPXT1AgunjyirpnnxXv-profile", contacts: [{ url: "https://www.instagram.com/prep_utd/", platform: "instagram" }], officers: [] },
  { id: "654d360cbfe4308bcdfc40c5", name: "Golden Key Honor Society", slug: "golden-key-honor-society", tags: ["Academic Interests", "Honor Society"], profile_image: null, contacts: [], officers: [] },
  { id: "DF-WCnf6_1ycr43nT64t", name: "Undergraduate Law Review", slug: "undergraduate-law-review", tags: ["Educational", "Political", "Law School", "Professional Development"], profile_image: "https://storage.googleapis.com/download/storage/v1/b/utdnebula_jupiter/o/DF-WCnf6_1ycr43nT64t-profile?generation=1766977723380651&alt=media", contacts: [{ url: "https://www.instagram.com/utdulr/", platform: "instagram" }], officers: [{ name: "Sudipta Rout", position: "Editor-In-Chief" }] },
  { id: "6qGFBZyCfaJ069SKK0gL", name: "Care Crafts Project at UTD", slug: "care-crafts-project-at-utd-2", tags: ["Social", "Service", "Hobbies & Special Interests", "Volunteerism", "Healthcare/Medical", "Art"], profile_image: "https://storage.googleapis.com/download/storage/v1/b/utdnebula_jupiter/o/6qGFBZyCfaJ069SKK0gL-profile?generation=1767909628948320&alt=media", contacts: [{ url: "https://www.instagram.com/carecraftsprojectutdallas/", platform: "instagram" }], officers: [{ name: "Riya Sanghani", position: "Co-President" }] },
  { id: "654d35eebfe4308bcdfc4008", name: "Association of Digital Music Creators", slug: "association-of-digital-music-creators", tags: ["Art and Music"], profile_image: "https://storage.googleapis.com/download/storage/v1/b/utdnebula_jupiter/o/654d35eebfe4308bcdfc4008-profile.png?generation=1753144519842427&alt=media", contacts: [], officers: [] },
  { id: "dHxDfTnNsm2lAnBamVTH", name: "BrainHealth Champions", slug: "brainhealth-champions", tags: ["Social", "Student Leadership", "Health & Lifestyle", "Educational", "Academic Interests"], profile_image: null, contacts: [{ url: "https://www.instagram.com/utdbrainhealthchampions", platform: "instagram" }], officers: [{ name: "Ji Yoon Heo", position: "President" }] },
  { id: "654d3605bfe4308bcdfc40a7", name: "Fit Life UTD", slug: "fit-life-utd", tags: ["Recreation", "Health & Lifestyle"], profile_image: "https://storage.googleapis.com/download/storage/v1/b/utdnebula_jupiter/o/654d3605bfe4308bcdfc40a7-profile.png?generation=1753144522067472&alt=media", contacts: [], officers: [] },
];

// ─── Seed version — bump this string to force a full re-seed ─────────────────
const SEED_VERSION = "4.0.0-clean";

// ─── Seed events ──────────────────────────────────────────────────────────────
// Sections A: March 2026 — regular semester events
// Sections B: April–May 2026 — derived from schedule-data.json (real building/room/time slots)
const ALL_SEED_EVENTS = [
  // ══════════════════════════════════════════════════════════════════════
  // A. MARCH 2026 — Semester Activities
  // ══════════════════════════════════════════════════════════════════════
  {
    id: "event:seed_acm-free-pizza-study-hall",
    name: "ACM Free Pizza Study Hall",
    date: "2026-03-10",
    time: "7:00 PM – 9:00 PM",
    location: "ECSS 2.311",
    host: "Association for Computing Machinery",
    description: "Show up, grab free pizza, and work on personal projects, homework, or interview prep alongside fellow CS students. ACM officers are on hand for coding questions.",
    tags: ["food", "tech", "networking", "workshop"],
    category: "social",
    source: "seed",
  },
  {
    id: "event:seed_acm-competitive-programming",
    name: "ACM Competitive Programming Workshop",
    date: "2026-03-10",
    time: "5:30 PM – 7:00 PM",
    location: "ECSS 2.315",
    host: "Association for Computing Machinery",
    description: "Level up your problem-solving skills for ICPC, Codeforces, and LeetCode. Tackle classic graph, DP, and greedy problems as a group with experienced officers.",
    tags: ["tech", "workshop", "career", "competitions"],
    category: "workshops",
    source: "seed",
  },
  {
    id: "event:seed_ieee-circuit-design-night",
    name: "IEEE Circuit Design Night",
    date: "2026-03-11",
    time: "6:00 PM – 8:00 PM",
    location: "ECSN 2.110",
    host: "IEEE UTD",
    description: "Hands-on circuit design and prototyping. Bring laptops for LTSpice simulation or use lab benches to build real circuits. Beginners welcome.",
    tags: ["tech", "workshop", "engineering"],
    category: "workshops",
    source: "seed",
  },
  {
    id: "event:seed_wmwe-networking-mixer",
    name: "Women in Engineering Networking Mixer",
    date: "2026-03-11",
    time: "6:30 PM – 8:00 PM",
    location: "ECSN Atrium",
    host: "Women Mentoring Women in Engineering",
    description: "Connect with senior women engineers, professors, and industry professionals. Learn about scholarships, research opportunities, and internship pathways.",
    tags: ["networking", "engineering", "career", "internship"],
    category: "networking",
    source: "seed",
  },
  {
    id: "event:seed_colorstack-code-review",
    name: "ColorStack Code Review & Mock Interview Session",
    date: "2026-03-12",
    time: "6:00 PM – 7:30 PM",
    location: "ECSS 2.105",
    host: "ColorStack UTD",
    description: "Sharpen interview skills with peer code reviews and mock technical interviews. Common data structures and system design concepts covered.",
    tags: ["tech", "career", "networking", "internship"],
    category: "workshops",
    source: "seed",
  },
  {
    id: "event:seed_goldman-sachs-networking",
    name: "Goldman Sachs Finance Tech Recruiting Night",
    date: "2026-03-12",
    time: "6:30 PM – 8:30 PM",
    location: "Student Union Ballroom",
    host: "Goldman Sachs",
    description: "Meet Goldman Sachs recruiters and software engineers. Learn about SWE, quant, and finance internship roles for summer 2026. Business casual attire.",
    tags: ["networking", "finance", "career", "internship"],
    category: "networking",
    source: "seed",
  },
  {
    id: "event:seed_active-minds-stress-busters",
    name: "Active Minds: Stress Busters Fair",
    date: "2026-03-13",
    time: "11:00 AM – 2:00 PM",
    location: "Student Union Atrium",
    host: "Active Minds UTD",
    description: "Beat midterm stress! Therapy dog visits, guided breathing stations, free snacks, and resource tables from UTD Counseling Services. Walk-ins welcome.",
    tags: ["health", "wellness", "social", "food"],
    category: "social",
    source: "seed",
  },
  {
    id: "event:seed_google-tech-talk-ml",
    name: "Google Tech Talk: ML in Production",
    date: "2026-03-13",
    time: "5:00 PM – 7:00 PM",
    location: "ECSS 2.311",
    host: "Google Developers Club",
    description: "Google engineers discuss deploying machine learning models at scale — from training pipelines to real-time inference. Q&A and networking with recruiters afterward.",
    tags: ["tech-talk", "networking", "internship", "career"],
    category: "tech-talks",
    source: "seed",
  },
  {
    id: "event:seed_200percent-dance-showcase",
    name: "200PERCENT Spring Dance Showcase",
    date: "2026-03-14",
    time: "7:00 PM – 9:00 PM",
    location: "Student Union Galaxy Rooms",
    host: "200PERCENT",
    description: "Watch UTD's premiere K-pop cover dance team perform their semester showcase! Expect high-energy performances, creative choreography, and a lively crowd.",
    tags: ["creative", "art", "cultural", "social"],
    category: "creative",
    source: "seed",
  },
  {
    id: "event:seed_microsoft-career-fair",
    name: "Microsoft Career Fair",
    date: "2026-03-15",
    time: "10:00 AM – 4:00 PM",
    location: "Activities Center (ATC)",
    host: "Microsoft",
    description: "Meet Microsoft recruiters and explore full-time and internship opportunities in SWE, PM, data science, and cloud across all Microsoft divisions.",
    tags: ["career", "internship", "networking", "company-visit"],
    category: "career-fairs",
    source: "seed",
  },
  {
    id: "event:seed_suaab-spring-cookout",
    name: "SUAAB Spring Cookout & Carnival",
    date: "2026-03-15",
    time: "12:00 PM – 4:00 PM",
    location: "Student Union Patio",
    host: "Student Union and Activities Advisory Board (SUAAB)",
    description: "Free burgers, hot dogs, funnel cake, and carnival games for all UTD students! Live DJ, photo booth, and tons of campus organization tables.",
    tags: ["food", "social", "networking", "fun"],
    category: "social",
    source: "seed",
  },
  {
    id: "event:seed_aiga-portfolio-workshop",
    name: "AIGA Portfolio Workshop: Stand Out to Studios",
    date: "2026-03-16",
    time: "5:00 PM – 7:00 PM",
    location: "ATC 2.901",
    host: "AIGA @ UTD",
    description: "Hands-on portfolio critique with local design professionals. Get real feedback on your UX, graphic design, or motion work before internship season.",
    tags: ["creative", "workshop", "career", "internship", "art"],
    category: "workshops",
    source: "seed",
  },
  {
    id: "event:seed_bmes-industry-night",
    name: "BMES Industry Night",
    date: "2026-03-16",
    time: "6:00 PM – 8:00 PM",
    location: "ECSN Atrium",
    host: "Biomedical Engineering Society",
    description: "Meet professionals from Medtronic, J&J, and local biotech startups. Bring your resume and explore internship and co-op opportunities in biomedical engineering.",
    tags: ["networking", "career", "internship", "healthcare"],
    category: "networking",
    source: "seed",
  },
  {
    id: "event:seed_sps-star-party",
    name: "SPS Stargazing Night at UTD",
    date: "2026-03-17",
    time: "8:30 PM – 11:00 PM",
    location: "Parking Structure D Rooftop",
    host: "Society of Physics Students at UT Dallas",
    description: "Guided stargazing session with 8-inch Dobsonian telescopes. Explore planets, star clusters, and nebulae. Bring a blanket. Open to everyone!",
    tags: ["academic", "science", "social"],
    category: "social",
    source: "seed",
  },
  {
    id: "event:seed_ieee-robotics-workshop",
    name: "IEEE Robotics Workshop: Build Your First Robot",
    date: "2026-03-17",
    time: "5:30 PM – 8:00 PM",
    location: "ECSN Fab Lab",
    host: "IEEE UTD",
    description: "Assemble and program a line-following robot using Arduino. All materials provided. No prior robotics experience required.",
    tags: ["tech", "workshop", "engineering", "robotics"],
    category: "workshops",
    source: "seed",
  },
  {
    id: "event:seed_200percent-boba-social",
    name: "200PERCENT Boba Social",
    date: "2026-03-18",
    time: "7:00 PM – 9:00 PM",
    location: "Student Union Lobby",
    host: "200PERCENT",
    description: "Hang out with 200PERCENT members over free boba tea! Meet the team, learn about K-pop events at UTD, and find out how to get involved.",
    tags: ["food", "social", "creative", "cultural"],
    category: "social",
    source: "seed",
  },
  {
    id: "event:seed_amazon-office-tour",
    name: "Amazon Engineering Office Tour",
    date: "2026-03-18",
    time: "2:00 PM – 5:00 PM",
    location: "Amazon Dallas Office (shuttle from ATC at 1:30 PM)",
    host: "Amazon",
    description: "Tour Amazon's Dallas HQ, meet the engineering and operations teams, and learn about SDE, Data Engineering, and TPM internship programs. Lunch included.",
    tags: ["company-visit", "career", "networking", "internship", "food"],
    category: "company-visits",
    source: "seed",
  },
  {
    id: "event:seed_ti-lab-visit",
    name: "Texas Instruments Semiconductor Lab Visit",
    date: "2026-03-19",
    time: "1:00 PM – 4:00 PM",
    location: "Texas Instruments Campus (shuttle at 12:30 PM from ATC)",
    host: "Texas Instruments",
    description: "Go behind the scenes at TI's chip design and fabrication facility. Recruiters will present summer internship and new grad opportunities.",
    tags: ["company-visit", "career", "tech-talk", "internship", "engineering"],
    category: "company-visits",
    source: "seed",
  },
  {
    id: "event:seed_aws-cloud-lab",
    name: "AWS Cloud Hands-On Lab",
    date: "2026-03-19",
    time: "4:00 PM – 6:00 PM",
    location: "ECSS 4.619",
    host: "AWS Student Community",
    description: "Build and deploy a serverless web app using AWS Lambda, API Gateway, and DynamoDB. AWS credits provided. Perfect for your cloud certification.",
    tags: ["tech", "workshop", "career", "internship"],
    category: "workshops",
    source: "seed",
  },
  {
    id: "event:seed_colorstack-career-panel",
    name: "ColorStack Career Panel: Navigating Big Tech",
    date: "2026-03-20",
    time: "6:00 PM – 7:30 PM",
    location: "Student Union 2.602",
    host: "ColorStack UTD",
    description: "Panelists from Google, Meta, and Apple share their journeys as underrepresented engineers in big tech. Candid Q&A.",
    tags: ["career", "networking", "internship", "tech"],
    category: "networking",
    source: "seed",
  },
  {
    id: "event:seed_khidmah-tech-for-good-hackathon",
    name: "Tech for Good Hackathon",
    date: "2026-03-21",
    time: "10:00 AM – 6:00 PM",
    location: "Student Union 2.602",
    host: "Khidmah UTD",
    description: "Full-day hackathon focused on building solutions for nonprofits and underserved communities. Prizes for top teams. Free lunch and snacks.",
    tags: ["tech", "startups", "food", "networking", "workshop"],
    category: "startups",
    source: "seed",
  },
  {
    id: "event:seed_startup-pitch-night",
    name: "UTD Startup Pitch Night",
    date: "2026-03-22",
    time: "6:30 PM – 9:00 PM",
    location: "Innovation Hub, ECS 1.102",
    host: "UTD Entrepreneurship Club",
    description: "Student startup teams pitch to real Dallas investors and VCs. Watch live pitches, vote for your favorite, and network with the entrepreneurship community. Light appetizers.",
    tags: ["startups", "networking", "entrepreneurship", "food", "career"],
    category: "startups",
    source: "seed",
  },
  {
    id: "event:seed_blood-drive",
    name: "UTD Blood Initiative Drive",
    date: "2026-03-22",
    time: "10:00 AM – 4:00 PM",
    location: "Student Union Ballroom",
    host: "University Blood Initiative",
    description: "Give blood and help save up to 3 lives! Carter BloodCare on-site. Walk-ins welcome. Snacks provided post-donation.",
    tags: ["service", "healthcare", "volunteer", "food"],
    category: "social",
    source: "seed",
  },
  {
    id: "event:seed_active-minds-mindfulness",
    name: "Active Minds: Mindfulness & Meditation Workshop",
    date: "2026-03-23",
    time: "5:00 PM – 6:00 PM",
    location: "Student Union 2.410",
    host: "Active Minds UTD",
    description: "Guided meditation and mindfulness session to help you recharge during the semester. Mats and supplies provided. Walk-ins welcome.",
    tags: ["health", "wellness", "social"],
    category: "social",
    source: "seed",
  },
  {
    id: "event:seed_fitlife-hiit",
    name: "Fit Life UTD: Group HIIT Class",
    date: "2026-03-23",
    time: "6:00 PM – 7:00 PM",
    location: "SRC Activity Room B",
    host: "Fit Life UTD",
    description: "High-intensity interval training session open to all fitness levels. Bring water and a towel. No equipment needed.",
    tags: ["health", "recreation", "social"],
    category: "social",
    source: "seed",
  },
  {
    id: "event:seed_sps-demo-day",
    name: "SPS Physics Demo Day",
    date: "2026-03-24",
    time: "12:00 PM – 3:00 PM",
    location: "Student Union Atrium",
    host: "Society of Physics Students at UT Dallas",
    description: "Spectacular physics demonstrations — Van de Graaff generators, liquid nitrogen experiments, and magnetic levitation. Great for all ages and majors!",
    tags: ["academic", "science", "social"],
    category: "social",
    source: "seed",
  },

  // ══════════════════════════════════════════════════════════════════════
  // B. APRIL–MAY 2026 — Derived from schedule-data.json
  //    Real UTD building codes, room numbers, and time slots
  // ══════════════════════════════════════════════════════════════════════

  // ── ECSN (Engineering & Computer Science North) ─────────────────────
  // ECSN 2.126 — 10:00am-11:15am (from schedule slot)
  {
    id: "event:sched_ecsn-acm-algo-sprint",
    name: "ACM Algorithm Sprint: Finals-Week Prep",
    date: "2026-04-25",
    time: "10:00 AM – 11:15 AM",
    location: "Engineering & Computer Science North (ECSN) 2.126",
    host: "Association for Computing Machinery",
    description: "One last focused problem-solving session before finals. Work through classic algorithm problems, review complexity, and solidify your CS fundamentals. Coffee provided.",
    tags: ["tech", "workshop", "academic", "food"],
    category: "workshops",
    source: "schedule",
  },
  // ECSN 2.126 — 5:30pm-6:45pm
  {
    id: "event:sched_ecsn-ieee-lab-tour",
    name: "IEEE Spring Lab Open House",
    date: "2026-04-25",
    time: "5:30 PM – 6:45 PM",
    location: "Engineering & Computer Science North (ECSN) 2.126",
    host: "IEEE UTD",
    description: "Tour active student project labs in ECSN — robotics, embedded systems, PCB design, and more. Chat with project leads and learn how to join next semester.",
    tags: ["tech", "engineering", "networking", "social"],
    category: "tech-talks",
    source: "schedule",
  },
  // ECSN 3.114 — 10:00am-12:45pm
  {
    id: "event:sched_ecsn-senior-design-demo",
    name: "CS & EE Senior Design Demo Day",
    date: "2026-04-25",
    time: "10:00 AM – 12:45 PM",
    location: "Engineering & Computer Science North (ECSN) 3.114",
    host: "UTD Computer Science Department",
    description: "Watch graduating seniors present their capstone projects live — from full-stack applications to hardware prototypes. Industry judges and recruiters in attendance. Open to all.",
    tags: ["tech", "engineering", "networking", "career", "academic"],
    category: "tech-talks",
    source: "schedule",
  },
  // ECSN 3.114 — 1:00pm-3:45pm
  {
    id: "event:sched_ecsn-cs-research-poster",
    name: "CS Undergraduate Research Poster Session",
    date: "2026-04-25",
    time: "1:00 PM – 3:45 PM",
    location: "Engineering & Computer Science North (ECSN) 3.114",
    host: "UTD Computer Science Department",
    description: "Undergraduate researchers present their semester projects in AI, systems, cybersecurity, and HCI. Great opportunity to find a research lab for next semester.",
    tags: ["tech", "academic", "research", "networking"],
    category: "tech-talks",
    source: "schedule",
  },
  // ECSN 3.108 — 10:00am-12:45pm
  {
    id: "event:sched_ecsn-ieee-robotics-showcase",
    name: "IEEE Robotics End-of-Semester Showcase",
    date: "2026-04-26",
    time: "10:00 AM – 12:45 PM",
    location: "Engineering & Computer Science North (ECSN) 3.108",
    host: "IEEE UTD",
    description: "Teams unveil their semester-long robotics builds — autonomous navigation, arm manipulation, drone platforms, and more. Vote for your favorite. Free refreshments.",
    tags: ["tech", "engineering", "robotics", "social", "food"],
    category: "tech-talks",
    source: "schedule",
  },
  // ECSN 3.108 — 4:00pm-6:45pm
  {
    id: "event:sched_ecsn-hackutd-mini",
    name: "HackUTD Mini: 3-Hour Sprint",
    date: "2026-04-26",
    time: "4:00 PM – 6:45 PM",
    location: "Engineering & Computer Science North (ECSN) 3.108",
    host: "Association for Computing Machinery",
    description: "Three-hour mini-hackathon — form a team or go solo, pick a prompt, and build something cool. Judges from local tech companies. Prizes for top 3 teams.",
    tags: ["tech", "startups", "workshop", "networking", "food"],
    category: "startups",
    source: "schedule",
  },
  // ECSN 3.118 — 1:00pm-3:45pm
  {
    id: "event:sched_ecsn-colorstack-grad-roundtable",
    name: "ColorStack: Grad School & Careers Roundtable",
    date: "2026-04-27",
    time: "1:00 PM – 3:45 PM",
    location: "Engineering & Computer Science North (ECSN) 3.118",
    host: "ColorStack UTD",
    description: "Industry professionals and PhD students share their paths after undergrad — industry vs. grad school, negotiating offers, and building your career as an underrepresented engineer.",
    tags: ["career", "networking", "academic", "diversity"],
    category: "networking",
    source: "schedule",
  },
  // ECSN 2.112 — 8:30am-9:45am
  {
    id: "event:sched_ecsn-morning-code-cafe",
    name: "Morning Code Café — Finals Study Block",
    date: "2026-04-28",
    time: "8:30 AM – 9:45 AM",
    location: "Engineering & Computer Science North (ECSN) 2.112",
    host: "Association for Computing Machinery",
    description: "Kick off your finals day with a focused morning coding session. Bring your laptop, grab a coffee (provided!), and tackle that last problem set with fellow Comets.",
    tags: ["tech", "academic", "social", "food"],
    category: "social",
    source: "schedule",
  },
  // ECSN 2.112 — 11:30am-12:45pm
  {
    id: "event:sched_ecsn-wmwe-lunch-learn",
    name: "Women in Engineering: Lunch & Learn",
    date: "2026-04-28",
    time: "11:30 AM – 12:45 PM",
    location: "Engineering & Computer Science North (ECSN) 2.112",
    host: "Women Mentoring Women in Engineering",
    description: "Casual lunch session featuring a senior engineering professional sharing her career story. Free pizza. Open to all genders and majors.",
    tags: ["networking", "engineering", "career", "food"],
    category: "networking",
    source: "schedule",
  },
  // ECSN 2.110 — 7:00pm-9:45pm
  {
    id: "event:sched_ecsn-hacknight-eve",
    name: "End-of-Semester Hack Night",
    date: "2026-04-28",
    time: "7:00 PM – 9:45 PM",
    location: "Engineering & Computer Science North (ECSN) 2.110",
    host: "Association for Computing Machinery",
    description: "The semester's final hack night — bring your side projects, open-source ideas, or finals relief code. Midnight snacks provided. All skill levels welcome.",
    tags: ["tech", "social", "workshop", "food"],
    category: "workshops",
    source: "schedule",
  },
  // ECSN 2.120 — 4:00pm-4:50pm
  {
    id: "event:sched_ecsn-resume-flash-review",
    name: "IEEE Spring Resume Flash Review",
    date: "2026-04-29",
    time: "4:00 PM – 4:50 PM",
    location: "Engineering & Computer Science North (ECSN) 2.120",
    host: "IEEE UTD",
    description: "Bring your resume for a rapid 5-minute review with engineering recruiters and upperclassmen. Get actionable feedback before summer internship starts. Walk-ins welcome.",
    tags: ["career", "networking", "internship", "engineering"],
    category: "networking",
    source: "schedule",
  },
  // ECSN 2.110 — 5:30pm-6:45pm
  {
    id: "event:sched_ecsn-acm-end-of-year-social",
    name: "ACM End-of-Year Social",
    date: "2026-04-29",
    time: "5:30 PM – 6:45 PM",
    location: "Engineering & Computer Science North (ECSN) 2.110",
    host: "Association for Computing Machinery",
    description: "Celebrate the end of the semester with ACM! Board game night, snacks, and an awards ceremony for outstanding members and project teams. All are welcome.",
    tags: ["social", "food", "networking", "fun"],
    category: "social",
    source: "schedule",
  },

  // ── JSOM (Naveen Jindal School of Management) ───────────────────────
  // JSOM 12.218 — 9:00am-1:00pm
  {
    id: "event:sched_jsom-investment-pitch-finals",
    name: "UTD Investment Club: Pitch Competition Finals",
    date: "2026-04-25",
    time: "9:00 AM – 1:00 PM",
    location: "Naveen Jindal School of Management (JSOM) 12.218",
    host: "UTD Investment Club",
    description: "Season finale! Top teams pitch equity research to a panel of hedge fund managers and portfolio advisors. Watch the live event and network with finance professionals afterward.",
    tags: ["finance", "startups", "networking", "career"],
    category: "startups",
    source: "schedule",
  },
  // JSOM 2.801 — 9:00am-4:00pm (long block)
  {
    id: "event:sched_jsom-deloitte-case-day",
    name: "Deloitte Consulting Case Day",
    date: "2026-04-26",
    time: "9:00 AM – 4:00 PM",
    location: "Naveen Jindal School of Management (JSOM) 2.801",
    host: "Deloitte",
    description: "A full-day consulting case competition hosted by Deloitte. Teams of 3-4 tackle a real business problem in 4 hours, then present to Deloitte consultants. Register by April 20.",
    tags: ["career", "networking", "internship", "finance", "startups"],
    category: "career-fairs",
    source: "schedule",
  },
  // JSOM 2.714 — 10:00am-12:45pm
  {
    id: "event:sched_jsom-finance-workshop",
    name: "Financial Modeling Workshop: From Zero to Excel Hero",
    date: "2026-04-27",
    time: "10:00 AM – 12:45 PM",
    location: "Naveen Jindal School of Management (JSOM) 2.714",
    host: "UTD Investment Club",
    description: "Hands-on financial modeling workshop covering DCF, comparable company analysis, and LBO basics in Excel. No prior experience required. Laptops required.",
    tags: ["finance", "workshop", "career", "internship"],
    category: "workshops",
    source: "schedule",
  },
  // JSOM 12.210 — 8:30am-11:15am
  {
    id: "event:sched_jsom-women-finance-summit",
    name: "Women in Finance & Consulting Summit",
    date: "2026-04-28",
    time: "8:30 AM – 11:15 AM",
    location: "Naveen Jindal School of Management (JSOM) 12.210",
    host: "JSOM Career Management Center",
    description: "Executive women from Goldman Sachs, McKinsey, and EY share insights on breaking into finance and consulting. Panel Q&A and networking brunch. Business professional attire.",
    tags: ["finance", "networking", "career", "internship"],
    category: "networking",
    source: "schedule",
  },
  // JSOM 12.218 — 1:00pm-2:15pm
  {
    id: "event:sched_jsom-linkedin-headshots",
    name: "JSOM Free LinkedIn Headshot Day",
    date: "2026-04-29",
    time: "1:00 PM – 2:15 PM",
    location: "Naveen Jindal School of Management (JSOM) 12.218",
    host: "JSOM Career Management Center",
    description: "Get a free professional headshot from a campus photographer for your LinkedIn profile. Business casual or professional attire recommended. First-come, first-served.",
    tags: ["career", "networking", "internship", "social"],
    category: "networking",
    source: "schedule",
  },
  // JSOM 2.801 — 9:00am-4:00pm (later date)
  {
    id: "event:sched_jsom-spring-career-expo",
    name: "JSOM Spring Career Expo",
    date: "2026-04-30",
    time: "9:00 AM – 4:00 PM",
    location: "Naveen Jindal School of Management (JSOM) 2.801",
    host: "JSOM Career Management Center",
    description: "40+ companies from finance, consulting, accounting, and marketing recruiting for summer internships and full-time roles. Business professional attire. Bring 15 copies of your resume.",
    tags: ["career", "internship", "networking", "finance"],
    category: "career-fairs",
    source: "schedule",
  },

  // ── JO (Jonsson Performance Hall) ──────────────────────────────────
  // JO 4.112 — 10:00am-12:00pm
  {
    id: "event:sched_jo-spring-honors-convocation",
    name: "UTD Spring Honors Convocation",
    date: "2026-04-25",
    time: "10:00 AM – 12:00 PM",
    location: "Jonsson Performance Hall (JO) 4.112",
    host: "UTD Office of Undergraduate Education",
    description: "Annual ceremony honoring UTD's top academic achievers — Dean's List, honor societies, and award recipients. Friends and family welcome. Light reception to follow.",
    tags: ["academic", "social", "honor"],
    category: "social",
    source: "schedule",
  },
  // JO 4.112 — additional date
  {
    id: "event:sched_jo-faculty-research-colloquium",
    name: "CS/EE Faculty Research Colloquium",
    date: "2026-04-30",
    time: "2:30 PM – 5:15 PM",
    location: "Jonsson Performance Hall (JO) 4.112",
    host: "UTD Erik Jonsson School of Engineering",
    description: "Faculty present their latest research in AI, quantum computing, cyber-physical systems, and communications. Open to all students — great for finding research mentors.",
    tags: ["tech", "academic", "research", "networking"],
    category: "tech-talks",
    source: "schedule",
  },

  // ── SLC (Student Learning Center) ─────────────────���────────────────
  // SLC 2.304 — 8:30am-9:45am
  {
    id: "event:sched_slc-finals-tutoring-marathon",
    name: "Finals Tutoring Marathon — All Subjects",
    date: "2026-04-25",
    time: "8:30 AM – 9:45 AM",
    location: "Student Learning Center (SLC) 2.304",
    host: "UTD Academic Support Programs",
    description: "Drop-in tutoring for CS, Math, Physics, and Business subjects during finals week. Peer tutors and graduate assistants available. No appointment needed.",
    tags: ["academic", "social", "workshop"],
    category: "workshops",
    source: "schedule",
  },
  // SLC 1.214 — 5:30pm-8:15pm
  {
    id: "event:sched_slc-study-strategy-workshop",
    name: "Finals Study Strategy Workshop",
    date: "2026-04-26",
    time: "5:30 PM – 8:15 PM",
    location: "Student Learning Center (SLC) 1.214",
    host: "UTD Academic Support Programs",
    description: "Evidence-based study techniques for finals — spaced repetition, active recall, and exam-taking strategies. Presented by UTD learning specialists. Free snacks.",
    tags: ["academic", "workshop", "social", "food"],
    category: "workshops",
    source: "schedule",
  },
  // SLC 1.206 — 1:00pm-2:15pm
  {
    id: "event:sched_slc-prelaw-lsat-prep",
    name: "Pre-Law LSAT Prep Session",
    date: "2026-04-29",
    time: "1:00 PM – 2:15 PM",
    location: "Student Learning Center (SLC) 1.206",
    host: "Undergraduate Law Review",
    description: "Structured LSAT practice covering logical reasoning and analytical thinking. Hosted by UTD Law Review in partnership with a 170+ scorer. Free study materials provided.",
    tags: ["academic", "career", "workshop", "law"],
    category: "workshops",
    source: "schedule",
  },
  // SLC 3.202 — 1:50pm-3:45pm
  {
    id: "event:sched_slc-academic-excellence-awards",
    name: "Academic Excellence Awards Ceremony",
    date: "2026-04-30",
    time: "1:50 PM – 3:45 PM",
    location: "Student Learning Center (SLC) 3.202",
    host: "UTD Academic Support Programs",
    description: "Annual celebration recognizing outstanding peer tutors, SI leaders, and academic achievement. Refreshments provided. All students and faculty invited.",
    tags: ["academic", "social", "honor", "food"],
    category: "social",
    source: "schedule",
  },
  // SLC 1.214 — 10:00am-11:15am
  {
    id: "event:sched_slc-grad-school-workshop",
    name: "Graduate School Application Workshop",
    date: "2026-05-01",
    time: "10:00 AM – 11:15 AM",
    location: "Student Learning Center (SLC) 1.214",
    host: "Preparing Researchers for PhD (PREP)",
    description: "Walk-through of the graduate school application process — SOPs, letters of recommendation, GRE prep, and how to reach out to faculty. Q&A with current grad students.",
    tags: ["academic", "career", "workshop", "networking"],
    category: "workshops",
    source: "schedule",
  },

  // ── SPN (Spellman Center) ────────────────────────────────────────────
  // SPN 1.115 — 10:00am-11:15am
  {
    id: "event:sched_spn-student-org-spring-fair",
    name: "Student Org Spring Finale Fair",
    date: "2026-04-26",
    time: "10:00 AM – 11:15 AM",
    location: "Spellman Center (SPN) 1.115",
    host: "Student Union and Activities Advisory Board (SUAAB)",
    description: "End-of-semester student organization expo. Meet club officers, sign up for next semester, and grab free merch. 30+ organizations represented.",
    tags: ["social", "networking", "food", "fun"],
    category: "social",
    source: "schedule",
  },
  // SPN 1.115 — 4:00pm-5:15pm
  {
    id: "event:sched_spn-hosa-skills-workshop",
    name: "HOSA Clinical Skills Showcase",
    date: "2026-04-27",
    time: "4:00 PM – 5:15 PM",
    location: "Spellman Center (SPN) 1.115",
    host: "Health Occupations Students of America (HOSA)",
    description: "Watch HOSA members demonstrate clinical nursing, CPR, and health screening techniques. Open to all pre-health students. Great networking with healthcare-bound peers.",
    tags: ["healthcare", "academic", "social"],
    category: "social",
    source: "schedule",
  },
  // SPN 1.115 — 8:30am-9:45am
  {
    id: "event:sched_spn-active-minds-wellness-fair",
    name: "Active Minds: End-of-Semester Wellness Fair",
    date: "2026-04-28",
    time: "8:30 AM – 9:45 AM",
    location: "Spellman Center (SPN) 1.115",
    host: "Active Minds UTD",
    description: "Finals week wellness fair with therapy dogs, stress-relief kits, healthy snacks, and counseling services info. Come decompress before your next exam.",
    tags: ["health", "wellness", "social", "food"],
    category: "social",
    source: "schedule",
  },
  // SPN 1.115 — 2:30pm-3:45pm
  {
    id: "event:sched_spn-maps-prehealth-social",
    name: "MAPS Pre-Health End-of-Semester Mixer",
    date: "2026-04-29",
    time: "2:30 PM – 3:45 PM",
    location: "Spellman Center (SPN) 1.115",
    host: "Minority Association of Pre-Medical Students (MAPS)",
    description: "Celebrate the end of the semester with fellow pre-health Comets. Reflection on the year's events, leadership elections for next year, and free snacks.",
    tags: ["healthcare", "social", "networking", "food"],
    category: "social",
    source: "schedule",
  },

  // ── ROW (Rowlett Hall) ───────────────────────────────────────────────
  // ROW 1.141 — 1:00pm-2:15pm
  {
    id: "event:sched_row-ulr-writing-circle",
    name: "Undergraduate Law Review: Writing Circle",
    date: "2026-04-25",
    time: "1:00 PM – 2:15 PM",
    location: "Rowlett Hall (ROW) 1.141",
    host: "Undergraduate Law Review",
    description: "Collaborative writing session for Law Review contributors and aspiring legal writers. Bring your drafts for peer review and editorial feedback from the board.",
    tags: ["academic", "law", "creative", "social"],
    category: "social",
    source: "schedule",
  },

  // ── SLC continued — May 2026 ─────────────────────────────────────────
  // SLC 1.214 — 2:30pm-3:45pm (May date)
  {
    id: "event:sched_slc-summer-research-info",
    name: "Summer Research Programs Info Session",
    date: "2026-05-04",
    time: "2:30 PM – 3:45 PM",
    location: "Student Learning Center (SLC) 1.214",
    host: "Preparing Researchers for PhD (PREP)",
    description: "Learn about NSF REU sites, UTD summer research fellowships, and faculty-led projects available over the summer. Current researchers share their experiences.",
    tags: ["academic", "research", "career", "networking"],
    category: "networking",
    source: "schedule",
  },

  // ── Additional schedule-derived events ──────────────────────────────
  // JSOM 2.714 — 2:30pm-5:15pm (May date)
  {
    id: "event:sched_jsom-consulting-bootcamp",
    name: "Consulting Case Bootcamp: Day 1",
    date: "2026-05-02",
    time: "2:30 PM – 5:15 PM",
    location: "Naveen Jindal School of Management (JSOM) 2.714",
    host: "UTD Consulting Club",
    description: "Intensive case-prep bootcamp covering market-sizing, profitability, and M&A frameworks. Perfect for those recruiting for management consulting internships in fall.",
    tags: ["career", "internship", "finance", "workshop", "networking"],
    category: "workshops",
    source: "schedule",
  },
  // ECSN 3.120 — 10:00am-12:45pm (May date)
  {
    id: "event:sched_ecsn-ai-capstone-showcase",
    name: "AI/ML Capstone Project Showcase",
    date: "2026-05-02",
    time: "10:00 AM – 12:45 PM",
    location: "Engineering & Computer Science North (ECSN) 3.120",
    host: "UTD Computer Science Department",
    description: "Students present semester-long AI and machine learning capstone projects — NLP applications, computer vision systems, reinforcement learning agents, and more. Open to all.",
    tags: ["tech", "academic", "research", "networking"],
    category: "tech-talks",
    source: "schedule",
  },
  // ECSN 2.120 — 1:00pm-2:15pm (May date)
  {
    id: "event:sched_ecsn-startup-office-hours",
    name: "StartupUTD: Founder Office Hours",
    date: "2026-05-05",
    time: "1:00 PM – 2:15 PM",
    location: "Engineering & Computer Science North (ECSN) 2.120",
    host: "UTD Entrepreneurship Club",
    description: "One-on-one and small-group office hours with serial entrepreneurs and startup founders. Get advice on your idea, product-market fit, team-building, and funding.",
    tags: ["startups", "networking", "entrepreneurship", "career"],
    category: "startups",
    source: "schedule",
  },
  // JSOM 12.218 — 9:00am-1:00pm (May date)
  {
    id: "event:sched_jsom-analytics-competition",
    name: "UTD Business Analytics Competition",
    date: "2026-05-06",
    time: "9:00 AM – 1:00 PM",
    location: "Naveen Jindal School of Management (JSOM) 12.218",
    host: "UTD Data Science & Analytics Club",
    description: "Teams compete to build the best predictive model and business recommendation from a real dataset. Prizes of $500, $300, $150 for top teams. Data science skills required.",
    tags: ["tech", "finance", "career", "startups", "academic"],
    category: "startups",
    source: "schedule",
  },
  // SPN 1.115 — 1:00pm-2:15pm (May date)
  {
    id: "event:sched_spn-service-day",
    name: "Humanity First: Campus Service Day",
    date: "2026-05-07",
    time: "1:00 PM – 2:15 PM",
    location: "Spellman Center (SPN) 1.115",
    host: "Humanity First UT Dallas",
    description: "End-of-year volunteering kickoff. Sign up for community service opportunities in Richardson and Plano for the summer. Snacks and sign-ups provided.",
    tags: ["service", "social", "volunteer", "food"],
    category: "social",
    source: "schedule",
  },
  // ECSN 2.110 — 8:30am-9:45am (May date)
  {
    id: "event:sched_ecsn-farewell-breakfast",
    name: "ECS Graduating Seniors Farewell Breakfast",
    date: "2026-05-08",
    time: "8:30 AM – 9:45 AM",
    location: "Engineering & Computer Science North (ECSN) 2.110",
    host: "UTD Erik Jonsson School of Engineering",
    description: "Celebrate graduating seniors in CS and EE over a free breakfast. Faculty, current students, and alumni share memories and advice for entering the workforce or grad school.",
    tags: ["social", "networking", "food", "academic"],
    category: "social",
    source: "schedule",
  },
];

// ─── Versioned seed / reseed ──────────────────────────────────────────────────
const seedDatabase = async () => {
  const storedVersion = await kv.get("seed:version");
  if (storedVersion === SEED_VERSION) {
    const events = await kv.getByPrefix("event:");
    console.log(`DB at version ${SEED_VERSION} — ${events.length} events present, skipping seed`);
    return { eventsSeeded: 0, clubsSeeded: 0, alreadySeeded: true };
  }

  console.log(`Seeding database at version ${SEED_VERSION}…`);

  // Clear existing events, clubs, and seed version
  const existingEvents = await kv.getByPrefix("event:");
  if (existingEvents.length > 0) {
    await kv.mdel(existingEvents.map((e: any) => e.id).filter(Boolean));
    console.log(`Cleared ${existingEvents.length} existing events`);
  }
  const existingClubs = await kv.getByPrefix("club:");
  if (existingClubs.length > 0) {
    await kv.mdel(existingClubs.map((c: any) => `club:${c.id}`).filter(Boolean));
    console.log(`Cleared ${existingClubs.length} existing clubs`);
  }

  // Seed clubs
  const clubKeys = EMBEDDED_CLUBS.map((c) => `club:${c.id}`);
  const clubVals = EMBEDDED_CLUBS.map((c) => ({ ...c, source: "seed" }));
  await kv.mset(clubKeys, clubVals);

  // Seed events in batches of 10 (mset limit safety)
  const now = new Date().toISOString();
  const eventKeys = ALL_SEED_EVENTS.map((e) => e.id);
  const eventVals = ALL_SEED_EVENTS.map((e) => ({ ...e, createdAt: now }));
  const BATCH = 10;
  for (let i = 0; i < eventKeys.length; i += BATCH) {
    await kv.mset(eventKeys.slice(i, i + BATCH), eventVals.slice(i, i + BATCH));
  }

  await kv.set("seed:version", SEED_VERSION);
  console.log(`Seeded ${ALL_SEED_EVENTS.length} events and ${EMBEDDED_CLUBS.length} clubs`);
  return { eventsSeeded: ALL_SEED_EVENTS.length, clubsSeeded: EMBEDDED_CLUBS.length, alreadySeeded: false };
};

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/make-server-45bdfe12/health", (c) => c.json({ status: "ok", seedVersion: SEED_VERSION }));

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post("/make-server-45bdfe12/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.admin.createUser({ email, password, user_metadata: { name }, email_confirm: true });
    if (error) { console.log(`Signup error: ${error.message}`); return c.json({ error: error.message }, 400); }
    await kv.set(`user:${data.user.id}`, { id: data.user.id, email, name, interests: [], createdAt: new Date().toISOString() });
    return c.json({ user: data.user });
  } catch (e: any) { console.log(`Signup error: ${e.message}`); return c.json({ error: e.message }, 500); }
});

// ── Events — specific routes BEFORE :id wildcard ─────────────────────────────
app.get("/make-server-45bdfe12/events/category/:category", async (c) => {
  try {
    const category = c.req.param("category");
    const all = await kv.getByPrefix("event:");
    return c.json({ events: all.filter((e: any) => e.category === category || (e.tags || []).includes(category)) });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.get("/make-server-45bdfe12/events/:id", async (c) => {
  try {
    const rawId = c.req.param("id");
    // ID in URL has "event:" stripped — try both with and without prefix
    let event = await kv.get(`event:${rawId}`);
    if (!event) event = await kv.get(rawId);
    if (!event) return c.json({ error: "Event not found" }, 404);
    return c.json({ event });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.get("/make-server-45bdfe12/events", async (c) => {
  try {
    // Auto-reseed if version mismatch — clears stale/duplicate data from older seeds
    const storedVersion = await kv.get("seed:version");
    if (storedVersion !== SEED_VERSION) {
      console.log(`Version mismatch (${storedVersion} → ${SEED_VERSION}), reseeding…`);
      await kv.del("seed:version");
      await seedDatabase();
    }
    let events = await kv.getByPrefix("event:");
    if (events.length === 0) {
      console.log("No events found — auto-seeding…");
      await seedDatabase();
      events = await kv.getByPrefix("event:");
    }
    events.sort((a: any, b: any) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
    return c.json({ events });
  } catch (e: any) { console.log(`Error fetching events: ${e.message}`); return c.json({ error: e.message }, 500); }
});

app.post("/make-server-45bdfe12/events", async (c) => {
  try {
    const eventData = await c.req.json();
    const id = `event:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const event = { id, ...eventData, createdAt: new Date().toISOString() };
    await kv.set(id, event);
    return c.json({ event });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// ── Clubs ─────────────────────────────────────────────────────────────────────
app.get("/make-server-45bdfe12/clubs", async (c) => {
  try {
    const storedVersion = await kv.get("seed:version");
    if (storedVersion !== SEED_VERSION) {
      await kv.del("seed:version");
      await seedDatabase();
    }
    let clubs = await kv.getByPrefix("club:");
    if (clubs.length === 0) { await seedDatabase(); clubs = await kv.getByPrefix("club:"); }
    clubs.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
    return c.json({ clubs });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.get("/make-server-45bdfe12/clubs/:id", async (c) => {
  try {
    const club = await kv.get(`club:${c.req.param("id")}`);
    if (!club) return c.json({ error: "Club not found" }, 404);
    return c.json({ club });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// ── User Profile ──────────────────────────────────────────────────────────────
app.get("/make-server-45bdfe12/profile", async (c) => {
  try {
    const user = await verifyUser(c.req.header("Authorization"), c.req.header("X-User-Token"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    let profile = await kv.get(`user:${user.id}`);
    if (!profile) {
      profile = { id: user.id, email: user.email, name: user.user_metadata?.name || "Comet", interests: [], createdAt: new Date().toISOString() };
      await kv.set(`user:${user.id}`, profile);
    }
    return c.json({ profile });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.put("/make-server-45bdfe12/profile", async (c) => {
  try {
    const user = await verifyUser(c.req.header("Authorization"), c.req.header("X-User-Token"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const updates = await c.req.json();
    const current = (await kv.get(`user:${user.id}`)) || {};
    const updated = { ...current, ...updates, id: user.id, updatedAt: new Date().toISOString() };
    await kv.set(`user:${user.id}`, updated);
    return c.json({ profile: updated });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.post("/make-server-45bdfe12/profile/interests", async (c) => {
  try {
    const user = await verifyUser(c.req.header("Authorization"), c.req.header("X-User-Token"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { interests } = await c.req.json();
    const profile = (await kv.get(`user:${user.id}`)) || {};
    profile.interests = interests;
    profile.updatedAt = new Date().toISOString();
    await kv.set(`user:${user.id}`, profile);
    return c.json({ profile });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// ── Saved Events ──────────────────────────────────────────────────────────────
app.get("/make-server-45bdfe12/saved-events", async (c) => {
  try {
    const user = await verifyUser(c.req.header("Authorization"), c.req.header("X-User-Token"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const savedIds: string[] = (await kv.get(`saved:${user.id}`)) || [];
    console.log(`GET saved-events for user ${user.id}: ids=${JSON.stringify(savedIds)}`);
    if (savedIds.length === 0) return c.json({ events: [] });
    // Fetch each event individually for reliability (avoids kv.mget edge cases)
    const events = (await Promise.all(savedIds.map((id: string) => kv.get(id)))).filter(Boolean);
    console.log(`Returning ${events.length} / ${savedIds.length} saved events`);
    return c.json({ events });
  } catch (e: any) {
    console.log(`GET saved-events error: ${e.message}`);
    return c.json({ error: e.message }, 500);
  }
});

// ── Saved Event IDs (lightweight — must be before :eventId wildcard) ──────────
app.get("/make-server-45bdfe12/saved-events/ids", async (c) => {
  try {
    const user = await verifyUser(c.req.header("Authorization"), c.req.header("X-User-Token"));
    if (!user) return c.json({ ids: [] });
    const ids: string[] = (await kv.get(`saved:${user.id}`)) || [];
    return c.json({ ids });
  } catch (e: any) {
    console.log(`GET saved-events/ids error: ${e.message}`);
    return c.json({ ids: [] });
  }
});

app.post("/make-server-45bdfe12/saved-events/:eventId", async (c) => {
  try {
    const user = await verifyUser(c.req.header("Authorization"), c.req.header("X-User-Token"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const eventId = c.req.param("eventId");
    const saved: string[] = (await kv.get(`saved:${user.id}`)) || [];
    const key = `event:${eventId}`;
    if (!saved.includes(key)) { saved.push(key); await kv.set(`saved:${user.id}`, saved); }
    console.log(`Saved event ${key} for user ${user.id}. Total: ${saved.length}`);
    return c.json({ success: true, savedEvents: saved });
  } catch (e: any) {
    console.log(`POST saved-events error: ${e.message}`);
    return c.json({ error: e.message }, 500);
  }
});

app.delete("/make-server-45bdfe12/saved-events/:eventId", async (c) => {
  try {
    const user = await verifyUser(c.req.header("Authorization"), c.req.header("X-User-Token"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const eventId = c.req.param("eventId");
    const saved = ((await kv.get(`saved:${user.id}`)) || []).filter((id: string) => id !== `event:${eventId}`);
    await kv.set(`saved:${user.id}`, saved);
    console.log(`Unsaved event:${eventId} for user ${user.id}. Remaining: ${saved.length}`);
    return c.json({ success: true, savedEvents: saved });
  } catch (e: any) {
    console.log(`DELETE saved-events error: ${e.message}`);
    return c.json({ error: e.message }, 500);
  }
});

// ── Reminders ─────────────────────────────────────────────────────────────────
app.get("/make-server-45bdfe12/reminders", async (c) => {
  try {
    const user = await verifyUser(c.req.header("Authorization"), c.req.header("X-User-Token"));
    if (!user) return c.json({ ids: [] });
    const ids: string[] = (await kv.get(`reminders:${user.id}`)) || [];
    return c.json({ ids });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.post("/make-server-45bdfe12/reminders/:eventId", async (c) => {
  try {
    const user = await verifyUser(c.req.header("Authorization"), c.req.header("X-User-Token"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const eventId = c.req.param("eventId");
    const key = `event:${eventId}`;
    const ids: string[] = (await kv.get(`reminders:${user.id}`)) || [];
    if (!ids.includes(key)) { ids.push(key); await kv.set(`reminders:${user.id}`, ids); }
    return c.json({ success: true, ids });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.delete("/make-server-45bdfe12/reminders/:eventId", async (c) => {
  try {
    const user = await verifyUser(c.req.header("Authorization"), c.req.header("X-User-Token"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const eventId = c.req.param("eventId");
    const ids = ((await kv.get(`reminders:${user.id}`)) || []).filter((id: string) => id !== `event:${eventId}`);
    await kv.set(`reminders:${user.id}`, ids);
    return c.json({ success: true, ids });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// ── AI Assistant ──────────────────────────────────────────────────────────────
app.post("/make-server-45bdfe12/ai-chat", async (c) => {
  try {
    const { message, userId } = await c.req.json();
    let userInterests: string[] = [];
    if (userId) userInterests = (await kv.get(`user:${userId}`))?.interests || [];
    const allEvents = await kv.getByPrefix("event:");
    const lowerMsg = message.toLowerCase();

    const scoreEvent = (e: any): number => {
      let score = 0;
      const tags = (e.tags || []).map((t: string) => t.toLowerCase());
      const words = lowerMsg.split(/\s+/);
      for (const w of words) {
        if (tags.some((t: string) => t.includes(w))) score += 3;
        if ((e.category || "").toLowerCase().includes(w)) score += 2;
        if ((e.name || "").toLowerCase().includes(w)) score += 2;
        if ((e.description || "").toLowerCase().includes(w)) score += 1;
        if ((e.location || "").toLowerCase().includes(w)) score += 1;
        if ((e.host || "").toLowerCase().includes(w)) score += 1;
      }
      return score;
    };

    // Building-specific queries (using real UTD building codes from schedule data)
    const buildingMatch = Object.entries(UTD_BUILDINGS).find(([code]) => lowerMsg.includes(code.toLowerCase()));

    let response = "";
    let recommendedEvents: any[] = [];

    if (buildingMatch) {
      const [code, meta] = buildingMatch;
      recommendedEvents = allEvents.filter((e: any) => (e.location || "").includes(code) || (e.location || "").includes(meta.full)).slice(0, 4);
      response = `Here are events happening at ${meta.full}:`;
    } else if (lowerMsg.match(/intern|internship/)) {
      recommendedEvents = allEvents.filter((e: any) => (e.tags || []).some((t: string) => ["internship", "career", "networking"].includes(t))).slice(0, 4);
      response = "Here are events that can help you land internships — networking nights, company visits, and career fairs:";
    } else if (lowerMsg.match(/network|meet people|mixer/)) {
      recommendedEvents = allEvents.filter((e: any) => (e.tags || []).includes("networking") || e.category === "networking").slice(0, 4);
      response = "Here are the best networking events on campus:";
    } else if (lowerMsg.match(/compan|office tour|visit/)) {
      recommendedEvents = allEvents.filter((e: any) => e.category === "company-visits").slice(0, 4);
      response = "These companies are hosting campus visits and tours:";
    } else if (lowerMsg.match(/workshop|learn|skill|hands-on/)) {
      recommendedEvents = allEvents.filter((e: any) => e.category === "workshops").slice(0, 4);
      response = "Here are hands-on workshops you can join:";
    } else if (lowerMsg.match(/food|free food|eat|pizza|snack/)) {
      recommendedEvents = allEvents.filter((e: any) => (e.tags || []).includes("food")).slice(0, 4);
      response = "Score free food at these upcoming events:";
    } else if (lowerMsg.match(/dance|art|music|creative|design|ux/)) {
      recommendedEvents = allEvents.filter((e: any) => e.category === "creative" || (e.tags || []).includes("creative")).slice(0, 4);
      response = "Here are arts and creative events on campus:";
    } else if (lowerMsg.match(/health|wellness|stress|mental|meditat/)) {
      recommendedEvents = allEvents.filter((e: any) => (e.tags || []).some((t: string) => ["health", "wellness", "healthcare"].includes(t))).slice(0, 4);
      response = "Here are health and wellness events to help you recharge:";
    } else if (lowerMsg.match(/startup|entrepreneur|pitch|found/)) {
      recommendedEvents = allEvents.filter((e: any) => e.category === "startups").slice(0, 4);
      response = "Get your entrepreneurship fix at these upcoming events:";
    } else if (lowerMsg.match(/tech|coding|program|software|cs |computer/)) {
      recommendedEvents = allEvents.filter((e: any) => e.category === "tech-talks" || (e.tags || []).some((t: string) => ["tech", "tech-talk"].includes(t))).slice(0, 4);
      response = "Here are the top tech events at UTD:";
    } else if (lowerMsg.match(/research|phd|grad school|professor/)) {
      recommendedEvents = allEvents.filter((e: any) => (e.tags || []).some((t: string) => ["research", "academic"].includes(t))).slice(0, 4);
      response = "These events are perfect for aspiring researchers and grad school applicants:";
    } else if (lowerMsg.match(/finance|banking|invest|consult|deloitte|goldman|jsom/)) {
      recommendedEvents = allEvents.filter((e: any) => (e.tags || []).some((t: string) => ["finance", "business"].includes(t))).slice(0, 4);
      response = "Here are finance and business events at JSOM and beyond:";
    } else if (lowerMsg.match(/april|may|finals|end.of.semester|spring/)) {
      recommendedEvents = allEvents.filter((e: any) => (e.date || "").startsWith("2026-04") || (e.date || "").startsWith("2026-05")).slice(0, 5);
      response = "Here are end-of-semester events happening in April and May:";
    } else {
      const scored = allEvents
        .map((e: any) => ({ event: e, score: scoreEvent(e) }))
        .sort((a: any, b: any) => b.score - a.score)
        .filter((x: any) => x.score > 0)
        .slice(0, 4)
        .map((x: any) => x.event);
      if (scored.length > 0) {
        recommendedEvents = scored;
        response = "Here are the most relevant events based on your question:";
      } else if (userInterests.length > 0) {
        recommendedEvents = allEvents.filter((e: any) => userInterests.some((interest) => (e.tags || []).some((t: string) => t.toLowerCase().includes(interest.toLowerCase())))).slice(0, 4);
        response = "Based on your interests, here are events you might enjoy:";
      } else {
        response = "I can help you find events for internships, networking, tech talks, free food, arts, health, research, and more. You can also ask about specific buildings like ECSN, JSOM, or SLC. What are you looking for?";
      }
    }

    const eventsWithScore = recommendedEvents.map((e) => ({ ...e, relevance: Math.min(98, 70 + Math.floor(Math.random() * 28)) }));
    return c.json({ response, events: eventsWithScore });
  } catch (e: any) { console.log(`AI chat error: ${e.message}`); return c.json({ error: e.message }, 500); }
});

// ── Seed / Sync endpoints ─────────────────────────────────────────────────────
app.post("/make-server-45bdfe12/seed-events", async (c) => {
  try {
    const result = await seedDatabase();
    const events = await kv.getByPrefix("event:");
    const clubs = await kv.getByPrefix("club:");
    return c.json({
      success: true,
      seedVersion: SEED_VERSION,
      message: result.alreadySeeded ? `Already at version ${SEED_VERSION}` : `Seeded ${result.eventsSeeded} events and ${result.clubsSeeded} clubs`,
      eventCount: events.length,
      clubCount: clubs.length,
    });
  } catch (e: any) { console.log(`seed-events error: ${e.message}`); return c.json({ error: e.message }, 500); }
});

app.post("/make-server-45bdfe12/seed-clubs", async (c) => {
  try {
    const clubKeys = EMBEDDED_CLUBS.map((c) => `club:${c.id}`);
    const clubVals = EMBEDDED_CLUBS.map((c) => ({ ...c, source: "seed", syncedAt: new Date().toISOString() }));
    await kv.mset(clubKeys, clubVals);
    return c.json({ success: true, message: `Seeded ${EMBEDDED_CLUBS.length} clubs`, count: EMBEDDED_CLUBS.length });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.post("/make-server-45bdfe12/force-reseed", async (c) => {
  try {
    // Delete the version key so seedDatabase will run fresh
    await kv.del("seed:version");
    const result = await seedDatabase();
    const events = await kv.getByPrefix("event:");
    return c.json({ success: true, message: `Force-reseeded ${result.eventsSeeded} events and ${result.clubsSeeded} clubs`, eventCount: events.length });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.post("/make-server-45bdfe12/sync-nebula", async (c) => {
  try {
    const liveOrgs = await fetchNebulaOrganizations();
    let source = "embedded";
    let syncedOrgs = 0;
    if (liveOrgs.length > 0) {
      source = "nebula-live";
      const now = new Date().toISOString();
      const keys = liveOrgs.map((o: any) => `club:${o.id || Date.now()}`);
      const vals = liveOrgs.map((o: any) => ({ ...o, source: "nebula", syncedAt: now }));
      await kv.mset(keys, vals);
      syncedOrgs = liveOrgs.length;
    } else {
      await seedDatabase();
    }
    const events = await kv.getByPrefix("event:");
    const clubs = await kv.getByPrefix("club:");
    return c.json({ success: true, source, message: source === "nebula-live" ? `Synced ${syncedOrgs} orgs from Nebula` : `Using ${clubs.length} embedded clubs`, eventCount: events.length, clubCount: clubs.length });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

Deno.serve(app.fetch);
