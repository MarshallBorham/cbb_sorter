/**
 * Conference → set of school names as used in Bart Torvik / player `team` field.
 * The portal & depth-chart dropdowns list Object.keys(PORTAL_CONFERENCE_MAP).
 * Add or fix team strings if they differ from your trank CSV spelling.
 */
function t(...names) {
  return new Set(names);
}

export const PORTAL_CONFERENCE_MAP = {
  ACC: t(
    "California", "Clemson", "Duke", "Florida State", "Georgia Tech", "Louisville", "Miami",
    "North Carolina", "NC State", "Notre Dame", "Pittsburgh", "SMU", "Stanford", "Syracuse",
    "Virginia", "Virginia Tech", "Wake Forest", "Boston College",
  ),
  "America East": t(
    "Albany", "Binghamton", "Bryant", "Maine", "NJIT", "New Hampshire", "UMass Lowell", "Vermont",
  ),
  AAC: t(
    "Charlotte", "East Carolina", "Florida Atlantic", "Memphis", "North Texas", "Rice",
    "South Florida", "Temple", "Tulane", "Tulsa", "UAB", "UTSA", "Wichita State",
  ),
  ASUN: t(
    "Austin Peay", "Bellarmine", "Central Arkansas", "Eastern Kentucky", "Florida Gulf Coast",
    "Jacksonville", "Lipscomb", "North Alabama", "North Florida", "Queens", "Stetson", "West Georgia",
  ),
  "Atlantic 10": t(
    "Davidson", "Dayton", "Duquesne", "Fordham", "George Mason", "George Washington", "La Salle",
    "Loyola Chicago", "Massachusetts", "Rhode Island", "Richmond", "Saint Joseph's", "Saint Louis", "VCU",
  ),
  "Big 12": t(
    "Arizona", "Arizona State", "Baylor", "BYU", "Cincinnati", "Colorado", "Houston", "Iowa State",
    "Kansas", "Kansas State", "Oklahoma State", "TCU", "Texas Tech", "UCF", "Utah", "West Virginia", "Texas",
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
    "Campbell", "Charleston", "Delaware", "Drexel", "Elon", "Hampton", "Hofstra", "Monmouth",
    "North Carolina A&T", "North Carolina Wilmington", "Northeastern", "Stony Brook", "Towson",
    "William & Mary",
  ),
  CUSA: t(
    "FIU", "Jacksonville State", "Kennesaw State", "Liberty", "Louisiana Tech", "Middle Tennessee",
    "New Mexico State", "Sam Houston", "UTEP", "Western Kentucky",
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
    "Kent State", "Miami OH", "Northern Illinois", "Ohio", "Toledo", "Western Michigan",
  ),
  MEAC: t(
    "Coppin State", "Delaware State", "Howard", "Maryland Eastern Shore", "Morgan State", "Norfolk State",
    "North Carolina Central", "South Carolina State",
  ),
  "Mountain West": t(
    "Air Force", "Boise State", "Colorado State", "Fresno State", "Hawaii", "Nevada", "New Mexico",
    "San Diego State", "San Jose State", "UNLV", "Utah State", "Wyoming",
  ),
  MVC: t(
    "Bradley", "Drake", "Evansville", "Illinois State", "Indiana State", "Missouri State", "Northern Iowa",
    "Southern Illinois", "UIC", "Valparaiso",
  ),
  NEC: t(
    "Central Connecticut", "Chicago State", "Fairleigh Dickinson", "Le Moyne", "LIU", "Mercyhurst",
    "Saint Francis", "Stonehill", "Wagner",
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
    "Missouri", "Oklahoma", "Ole Miss", "South Carolina", "Tennessee", "Texas A&M", "Vanderbilt",
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
    "Abilene Christian", "California Baptist", "Grand Canyon", "Seattle U", "Southern Utah", "Tarleton",
    "UT Arlington", "Utah Tech", "Utah Valley",
  ),
  WCC: t(
    "Gonzaga", "Loyola Marymount", "Pacific", "Pepperdine", "Portland", "Saint Mary's", "San Diego",
    "San Francisco", "Santa Clara",
  ),
};
