/**
 * Conference → set of school names (canonical labels in the UI).
 * Depth chart / portal match `Player.team` using resolveCanonicalTeamName + expandQueryTeamNames
 * so Torvik spellings like "Miami FL" and "Ohio St." still bucket correctly.
 *
 * Membership counts should match current NCAA all-sports lineups; update annually.
 */
function t(...names) {
  return new Set(names);
}

export const PORTAL_CONFERENCE_MAP = {
  ACC: t(
    "California", "Clemson", "Duke", "Florida State", "Georgia Tech", "Louisville", "Miami FL",
    "North Carolina", "NC State", "Notre Dame", "Pittsburgh", "SMU", "Stanford", "Syracuse",
    "Virginia", "Virginia Tech", "Wake Forest", "Boston College",
  ),
  "America East": t(
    "Albany", "Binghamton", "Bryant", "Maine", "UMBC", "NJIT", "New Hampshire", "UMass Lowell",
    "Vermont",
  ),
  AAC: t(
    "Charlotte", "East Carolina", "Florida Atlantic", "Memphis", "North Texas", "Rice",
    "South Florida", "Temple", "Tulane", "Tulsa", "UAB", "UTSA", "Wichita State",
  ),
  ASUN: t(
    "Austin Peay", "Bellarmine", "Central Arkansas", "Eastern Kentucky", "Florida Gulf Coast",
    "Jacksonville", "Lipscomb", "North Alabama", "North Florida", "Queens", "Stetson", "West Georgia",
  ),
  // 14 basketball members (2025–26). If your source lists 15, name the school to add.
  "Atlantic 10": t(
    "Davidson", "Dayton", "Duquesne", "Fordham", "George Mason", "George Washington", "La Salle",
    "Loyola Chicago", "Rhode Island", "Richmond", "St. Bonaventure", "Saint Joseph's", "Saint Louis", "VCU",
  ),
  "Big 12": t(
    "Arizona", "Arizona State", "Baylor", "BYU", "Cincinnati", "Colorado", "Houston", "Iowa State",
    "Kansas", "Kansas State", "Oklahoma State", "TCU", "Texas Tech", "UCF", "Utah", "West Virginia",
  ),
  "Big East": t(
    "Butler", "UConn", "Creighton", "DePaul", "Georgetown", "Marquette", "Providence", "St. John's",
    "Seton Hall", "Villanova", "Xavier",
  ),
  "Big Ten": t(
    "Illinois", "Indiana", "Iowa", "Maryland", "Michigan", "Michigan State", "Minnesota", "Nebraska",
    "Northwestern", "Ohio State", "Oregon", "Penn State", "Purdue", "Rutgers", "UCLA", "USC", "Washington",
    "Wisconsin",
  ),
  "Big Sky": t(
    "Eastern Washington", "Idaho", "Idaho State", "Montana", "Montana State", "Northern Arizona",
    "Northern Colorado", "Portland State", "Sacramento State", "Weber State",
  ),
  "Big South": t(
    "Charleston Southern", "Gardner-Webb", "High Point", "Longwood", "Presbyterian", "Radford",
    "UNC Asheville", "USC Upstate", "Winthrop",
  ),
  "Big West": t(
    "Cal Poly", "Cal State Bakersfield", "Cal State Fullerton", "Cal State Northridge", "Hawaii",
    "Long Beach State", "UC Davis", "UC Irvine", "UC Riverside", "UC San Diego", "UC Santa Barbara",
  ),
  CAA: t(
    "Campbell", "Charleston", "Drexel", "Elon", "Hampton", "Hofstra", "Monmouth",
    "North Carolina A&T", "North Carolina Wilmington", "Northeastern", "Stony Brook", "Towson",
    "William & Mary",
  ),
  CUSA: t(
    "Delaware", "FIU", "Jacksonville State", "Kennesaw State", "Liberty", "Louisiana Tech",
    "Middle Tennessee", "Missouri State", "New Mexico State", "Sam Houston", "UTEP", "Western Kentucky",
  ),
  Horizon: t(
    "Cleveland State", "Detroit Mercy", "Green Bay", "IU Indy", "Milwaukee", "Northern Kentucky",
    "Oakland", "Purdue Fort Wayne", "Robert Morris", "Wright State", "Youngstown State",
  ),
  Ivy: t(
    "Brown", "Columbia", "Cornell", "Dartmouth", "Harvard", "Penn", "Princeton", "Yale",
  ),
  MAAC: t(
    "Canisius", "Fairfield", "Iona", "Manhattan", "Marist", "Merrimack", "Mount St. Mary's", "Niagara",
    "Quinnipiac", "Rider", "Sacred Heart", "Saint Peter's", "Siena",
  ),
  MAC: t(
    "Akron", "Ball State", "Bowling Green", "Buffalo", "Central Michigan", "Eastern Michigan",
    "Kent State", "Massachusetts", "Miami OH", "Northern Illinois", "Ohio", "Toledo", "Western Michigan",
  ),
  MEAC: t(
    "Coppin State", "Delaware State", "Howard", "Maryland Eastern Shore", "Morgan State", "Norfolk State",
    "North Carolina Central", "South Carolina State",
  ),
  "Mountain West": t(
    "Air Force", "Boise State", "Colorado State", "Fresno State", "Grand Canyon", "Hawaii", "Nevada", "New Mexico",
    "San Diego State", "San Jose State", "UNLV", "Utah State", "Wyoming",
  ),
  MVC: t(
    "Belmont", "Bradley", "Drake", "Evansville", "Illinois State", "Indiana State", "Murray State",
    "Northern Iowa", "Southern Illinois", "UIC", "Valparaiso",
  ),
  NEC: t(
    "Central Connecticut", "Chicago State", "Fairleigh Dickinson", "Le Moyne", "LIU", "Mercyhurst",
    "New Haven", "Saint Francis", "Stonehill", "Wagner",
  ),
  OVC: t(
    "Eastern Illinois", "Lindenwood", "Little Rock", "Morehead State", "SIUE", "Southeast Missouri State",
    "Southern Indiana", "Tennessee State", "Tennessee Tech", "UT Martin", "Western Illinois",
  ),
  Patriot: t(
    "American", "Army", "Boston University", "Bucknell", "Colgate", "Holy Cross", "Lafayette", "Lehigh",
    "Loyola Maryland", "Navy",
  ),
  SEC: t(
    "Alabama", "Arkansas", "Auburn", "Florida", "Georgia", "Kentucky", "LSU", "Mississippi State",
    "Missouri", "Oklahoma", "Ole Miss", "South Carolina", "Tennessee", "Texas", "Texas A&M", "Vanderbilt",
  ),
  Southern: t(
    "Chattanooga", "The Citadel", "East Tennessee State", "Furman", "Mercer", "Samford", "UNC Greensboro",
    "VMI", "Western Carolina", "Wofford",
  ),
  Southland: t(
    "East Texas A&M", "Houston Christian", "Incarnate Word", "Lamar", "McNeese", "New Orleans", "Nicholls",
    "Northwestern State", "Southeastern Louisiana", "Stephen F. Austin", "Texas A&M-Corpus Christi",
    "UT Rio Grande Valley",
  ),
  "Sun Belt": t(
    "App State", "Arkansas State", "Coastal Carolina", "Georgia Southern", "Georgia State", "James Madison",
    "Louisiana", "Marshall", "Old Dominion", "South Alabama", "Southern Miss", "Texas State", "Troy", "ULM",
  ),
  SWAC: t(
    "Alabama A&M", "Alabama State", "Alcorn State", "Arkansas-Pine Bluff", "Bethune-Cookman", "Florida A&M",
    "Grambling", "Jackson State", "Mississippi Valley", "Prairie View", "Southern", "Texas Southern",
  ),
  Summit: t(
    "Denver", "Kansas City", "North Dakota", "North Dakota State", "Oral Roberts", "Omaha", "South Dakota",
    "South Dakota State", "St. Thomas",
  ),
  WAC: t(
    "Abilene Christian", "California Baptist", "Southern Utah", "Tarleton",
    "UT Arlington", "Utah Tech", "Utah Valley",
  ),
  WCC: t(
    "Gonzaga", "Loyola Marymount", "Oregon State", "Pacific", "Pepperdine", "Portland", "Saint Mary's",
    "San Diego", "San Francisco", "Santa Clara", "Seattle U", "Washington State",
  ),
};

/**
 * Raw `Player.team` from Torvik/DB → canonical string used in PORTAL_CONFERENCE_MAP.
 * Torvik uses "Miami FL"; this map uses that spelling. Legacy "Miami" rows still match via alias.
 * "Foo St." in CSV maps to "Foo State" via resolveCanonicalTeamName.
 */
export const TEAM_DB_ALIASES = {
  Miami: "Miami FL",
  "Miami (OH)": "Miami OH",
  UMass: "Massachusetts",
  FDU: "Fairleigh Dickinson",
  // Bart Torvik / DB spellings → PORTAL_CONFERENCE_MAP labels
  "N.C. State": "NC State",
  Connecticut: "UConn",
  "Gardner Webb": "Gardner-Webb",
  "Cal St. Bakersfield": "Cal State Bakersfield",
  "Cal St. Fullerton": "Cal State Fullerton",
  "Cal St. Northridge": "Cal State Northridge",
  "UNC Wilmington": "North Carolina Wilmington",
  "Sam Houston St.": "Sam Houston",
  "Illinois Chicago": "UIC",
  "SIU Edwardsville": "SIUE",
  "Tennessee Martin": "UT Martin",
  "Loyola MD": "Loyola Maryland",
  /** Ole Miss — distinct from Mississippi St. in Torvik */
  Mississippi: "Ole Miss",
  "McNeese St.": "McNeese",
  "Nicholls St.": "Nicholls",
  "Texas A&M Corpus Chris": "Texas A&M-Corpus Christi",
  "Appalachian St.": "App State",
  "Louisiana Monroe": "ULM",
  "Arkansas Pine Bluff": "Arkansas-Pine Bluff",
  "Bethune Cookman": "Bethune-Cookman",
  "Grambling St.": "Grambling",
  "Mississippi Valley St.": "Mississippi Valley",
  "Prairie View A&M": "Prairie View",
  UMKC: "Kansas City",
  "Nebraska Omaha": "Omaha",
  "Cal Baptist": "California Baptist",
  "Tarleton St.": "Tarleton",
  Seattle: "Seattle U",
  GCU: "Grand Canyon",
  "Grand Canyon University": "Grand Canyon",
  // ESPN displayName → canonical PORTAL_CONFERENCE_MAP name
  "UAlbany": "Albany",
  "Hawai\u02bbi": "Hawaii",                 // okina character in ESPN name
  "IU Indianapolis": "IU Indy",
  "Pennsylvania": "Penn",
  "San Jos\u00e9 State": "San Jose State",  // é accent in ESPN name
  "Long Island University": "LIU",
  "SE Louisiana": "Southeastern Louisiana",
  "St. Thomas-Minnesota": "St. Thomas",
  "UL Monroe": "ULM",
};

/** @param {string|null|undefined} dbTeam @param {Set<string>} canonicalSet */
export function resolveCanonicalTeamName(dbTeam, canonicalSet) {
  if (dbTeam == null || typeof dbTeam !== "string") return null;
  if (canonicalSet.has(dbTeam)) return dbTeam;
  if (dbTeam.endsWith(" St.")) {
    const longForm = dbTeam.replace(/ St\.$/, " State");
    if (canonicalSet.has(longForm)) return longForm;
  }
  const viaAlias = TEAM_DB_ALIASES[dbTeam];
  if (viaAlias && canonicalSet.has(viaAlias)) return viaAlias;
  return null;
}

/** Team strings to include in Mongo `{ team: { $in } }` for a conference. */
export function expandQueryTeamNames(canonicalSet) {
  const out = new Set(canonicalSet);
  for (const name of canonicalSet) {
    if (name.endsWith(" State")) out.add(name.replace(/ State$/, " St."));
  }
  for (const [alt, canon] of Object.entries(TEAM_DB_ALIASES)) {
    if (canonicalSet.has(canon)) out.add(alt);
  }
  return [...out];
}
