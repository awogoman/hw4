// index.mjs
import express from "express";
import fetch from "node-fetch";
import { faker } from "@faker-js/faker";

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.use(express.static("public"));

/* API helpers – MLB Stats API */
async function getMlbTeams() {
  const url = "https://statsapi.mlb.com/api/v1/teams?sportId=1";

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`MLB API error: ${response.status}`);
  }

  const data = await response.json();

  return data.teams.map((t) => ({
    id: t.id,
    name: t.name,
    abbr: t.abbreviation,
    location: t.locationName,
    league: t.league?.name || "N/A",
    division: t.division?.name || "N/A",
  }));
}

/* “Player of the Day” from MLB Stats API */
async function getRealPlayerOfTheDay() {
  // teams
  const teams = await getMlbTeams();
  const randomTeam = teams[Math.floor(Math.random() * teams.length)];

  // roster for that team
  const rosterRes = await fetch(
    `https://statsapi.mlb.com/api/v1/teams/${randomTeam.id}/roster`
  );
  if (!rosterRes.ok) {
    throw new Error(`Roster error: ${rosterRes.status}`);
  }
  const rosterData = await rosterRes.json();
  const roster = rosterData.roster || [];
  if (roster.length === 0) {
    throw new Error("No roster found for team");
  }

  const randomPlayerEntry = roster[Math.floor(Math.random() * roster.length)];
  const playerId = randomPlayerEntry.person.id;

  // player info w/ stats
  const playerRes = await fetch(
    `https://statsapi.mlb.com/api/v1/people/${playerId}?hydrate=stats(group=[hitting],type=[season])`
  );
  if (!playerRes.ok) {
    throw new Error(`Player error: ${playerRes.status}`);
  }
  const playerData = await playerRes.json();
  const person = (playerData.people && playerData.people[0]) || {};

  const statsGroups = person.stats || [];
  let avg = "N/A";
  let hr = "N/A";
  let season = "N/A";

  if (statsGroups.length > 0) {
    const hitting = statsGroups[0]; // hitting stats
    if (hitting.splits && hitting.splits.length > 0) {
      const lastSplit = hitting.splits[hitting.splits.length - 1];
      const s = lastSplit.stat || {};
      avg = s.avg || "N/A";
      hr = typeof s.homeRuns !== "undefined" ? s.homeRuns : "N/A";
      season = lastSplit.season || "N/A";
    }
  }

  return {
    name: person.fullName || randomPlayerEntry.person.fullName,
    position:
      randomPlayerEntry.position?.abbreviation ||
      randomPlayerEntry.position?.name ||
      "N/A",
    teamName: randomTeam.name,
    jerseyNumber: person.primaryNumber || "N/A",
    battingAverage: avg,
    homeRuns: hr,
    season,
    mlbId: playerId,
  };
}

/* Node package helper – used for sample scorecard */
function getFakePlayerOfTheDay() {
  return {
    name: faker.person.fullName(),
    position: faker.helpers.arrayElement([
      "Pitcher",
      "Catcher",
      "First Base",
      "Second Base",
      "Third Base",
      "Shortstop",
      "Left Field",
      "Center Field",
      "Right Field",
      "Designated Hitter",
    ]),
    battingAverage: faker.number
      .float({ min: 0.2, max: 0.35, precision: 0.001 })
      .toFixed(3),
    homeRuns: faker.number.int({ min: 0, max: 50 }),
    jerseyNumber: faker.number.int({ min: 0, max: 99 }),
    teamName: "Sample City Sluggers",
    season: "N/A",
    mlbId: null,
  };
}

/* Routes */
// Home
app.get("/", async (req, res) => {
  try {
    const player = await getRealPlayerOfTheDay();
    res.render("index", {
      title: "Home",
      player,
      fromApi: true,
    });
  } catch (err) {
    console.error("Error loading real player:", err.message);
    const player = getFakePlayerOfTheDay();
    res.render("index", {
      title: "Home",
      player,
      fromApi: false,
    });
  }
});

// Teams
app.get("/teams", async (req, res) => {
  try {
    const teams = await getMlbTeams();
    res.render("teams", {
      title: "Teams",
      teams,
      error: null,
    });
  } catch (err) {
    console.error(err);
    res.render("teams", {
      title: "Teams",
      teams: [],
      error: "Sorry, we couldn't load MLB team data right now.",
    });
  }
});

// 3) Scorecard
app.get("/scorecard", async (req, res) => {
  try {
    // list of all MLB teams
    const teams = await getMlbTeams();

    // 2 random different teams
    let awayTeam = teams[Math.floor(Math.random() * teams.length)];
    let homeTeam = teams[Math.floor(Math.random() * teams.length)];

    // check not the same team
    while (homeTeam.id === awayTeam.id) {
      homeTeam = teams[Math.floor(Math.random() * teams.length)];
    }

    // fake inning-by-inning scores
    const scoreByInning = [];
    let homeTotal = 0;
    let awayTotal = 0;

    for (let i = 1; i <= 9; i++) {
      const homeRuns = faker.number.int({ min: 0, max: 3 });
      const awayRuns = faker.number.int({ min: 0, max: 3 });
      homeTotal += homeRuns;
      awayTotal += awayRuns;
      scoreByInning.push({ inning: i, homeRuns, awayRuns });
    }

    res.render("scorecard", {
      title: "Scorecard",
      homeTeam: homeTeam.name,
      awayTeam: awayTeam.name,
      scoreByInning,
      homeTotal,
      awayTotal
    });

  } catch (err) {
    console.error("Scorecard error:", err.message);

    // if API fails
    const homeTeam = faker.location.city() + " Sluggers";
    const awayTeam = faker.location.city() + " Aces";

    const scoreByInning = [];
    let homeTotal = 0;
    let awayTotal = 0;

    for (let i = 1; i <= 9; i++) {
      const homeRuns = faker.number.int({ min: 0, max: 3 });
      const awayRuns = faker.number.int({ min: 0, max: 3 });
      homeTotal += homeRuns;
      awayTotal += awayRuns;
      scoreByInning.push({ inning: i, homeRuns, awayRuns });
    }

    res.render("scorecard", {
      title: "Scorecard",
      homeTeam,
      awayTeam,
      scoreByInning,
      homeTotal,
      awayTotal
    });
  }
});

// Sources
app.get("/sources", (req, res) => {
  res.render("sources", { title: "Sources" });
});

// About
app.get("/about", (req, res) => {
  res.render("about", { title: "About" });
});

// Fallback 404
app.get("*", (req, res) => {
  res.status(404).render("index", {
    title: "Not Found",
    player: getFakePlayerOfTheDay(),
    fromApi: false,
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
