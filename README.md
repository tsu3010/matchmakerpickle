# MatchMakerPickle

*Balanced DUPR doubles, rotated for you.*

A phone-first web app for running DUPR pickleball doubles sessions. Upload the Reclub participant screenshots, check the list, and get a round-by-round schedule. It handles late arrivals, early leavers and manual swaps courtside.

## What it does

1. **Import.** Upload 1–6 Reclub *Participants* screenshots. A vision model reads each name and **doubles** DUPR. It joins wrapped names, ignores badges and singles ratings, and removes duplicates from overlapping screenshots. You can also paste a list instead.
2. **Check players.** Edit names and ratings, and untick anyone who hasn't arrived yet. Unrated players use the group median.
3. **Setup.** Enter start time, courts, minutes per round, session length and the max team rating gap. The app shows the number of rounds and games per player before you build.
4. **Play.**
   - **Live:** the current round with a countdown, the next round, and a **Start round** button. Starting a round locks it.
   - **＋ Arrived / − Left:** rebuilds every round that hasn't started yet. Locked rounds never change.
   - **Rounds:** tap two players in a round to swap them. Swaps are re-checked against the rules.
   - **Stats:** games, sit-outs, distinct partners and distinct opponents per player, plus a flag for every rule that isn't fully met.

A **How it works** guide (the **?** button, or Menu → How it works) explains why the app exists and walks through a session in 6 steps. It opens automatically the first time someone uses the app.

The session is saved on your phone, so a refresh or closed tab doesn't lose it. Use **Menu → New session** to start fresh.

### Scheduling rules, in priority order

1. Equal games: everyone within ±1.
2. Fair sit-outs: no one sits out more than 2 rounds in a row.
3. Balanced courts: team combined DUPR within the max gap (default 0.30).
4. Variety: no repeat partners, and the same opponent at most twice.
5. Mixed levels: the strongest players are never stacked on one team.

The scheduler runs **in the browser**, so rebuilds work on a weak court signal. Only screenshot import needs the server. For each round it picks who plays (fewest games first, and anyone who has sat out 2 rounds must play). It then finds the best split of those players into courts and teams. The whole schedule is built hundreds of times with different tie-breaks in under a second, and the best one is kept.

On your Oct 2 roster (22 players, 3 courts, 11 rounds), 20 out of 20 test runs give 6 games each, no repeat partners, and every court within 0.30.

---

## Deploy on Vercel (free)

You need a **GitHub** account, a **Vercel** account (sign in with GitHub) and a **Gemini API key**.

### 1. Get a Gemini API key
Go to <https://aistudio.google.com/apikey>, then **Create API key** and copy it.
> The free tier is plenty (a few screenshots per session). Google may use free-tier requests to improve its products. If your group minds that for names and photos, enable billing on the key; each import then costs a fraction of a cent.

### 2. Put the code on GitHub
```bash
cd matchmakerpickle
git init && git add . && git commit -m "MatchMakerPickle"
# create an empty repo on github.com, then:
git remote add origin https://github.com/<you>/matchmakerpickle.git
git push -u origin main
```

### 3. Import into Vercel
1. Go to <https://vercel.com/new>, then **Import** your repo.
2. The framework preset should say **Vite**. Leave the build settings at their defaults.
3. Open **Environment Variables** and add:
   | Name | Value |
   |---|---|
   | `GEMINI_API_KEY` | your key |
   | `APP_PASSCODE` | *(optional)* e.g. `4821`. Asked once per phone, it stops strangers using your quota. |
4. Click **Deploy**. After about a minute you get a URL like `matchmakerpickle.vercel.app`.

### 4. Add it to your phone
Open the URL in your phone's browser.
- **iPhone (Safari):** Share → **Add to Home Screen**.
- **Android (Chrome):** ⋮ → **Add to Home screen**.

To update later, edit the code and run `git push`. Vercel redeploys automatically. If you change an environment variable, redeploy (**Deployments → ⋯ → Redeploy**).

---

## Run locally

Requires Node 20+.
```bash
npm install
cp .env.example .env      # put your GEMINI_API_KEY in it
npm run dev               # http://localhost:5173 (the /api/extract route works locally too)
npm run dev -- --host     # to open it from your phone on the same Wi-Fi
npm test                  # scheduler + import tests
npm run typecheck
```

## Switching the vision provider

The screenshot reader is behind one setting, `VISION_PROVIDER`.

- `gemini` (default): `GEMINI_API_KEY`, optional `GEMINI_MODEL` (default `gemini-3.8-flash`).
- `openai`: any **OpenAI-compatible** chat API that accepts images, such as OpenAI, Groq, OpenRouter or Cloudflare Workers AI. Set `OPENAI_API_KEY`, `OPENAI_MODEL` and `OPENAI_BASE_URL`.

To add a different API, write a file in `server/providers/` that implements `VisionProvider` (`check` + `run`, which returns the model's text). Then register it in `server/providers/index.ts`. The prompt lives in `server/prompt.ts`.

## Project layout
```
api/extract.ts              Vercel serverless function → server/extract.ts
server/extract.ts           validation, provider call, JSON clean-up (shared with local dev)
server/prompt.ts            instructions for reading Reclub screenshots
server/providers/           gemini.ts, openai.ts, index.ts (registry)
src/lib/scheduler.ts        schedule generation, rebuild, swap, stats/flags
src/lib/roster.ts           merge/dedupe imported players, paste parser, median
src/screens/                Import → Players → Setup → Play (Live / Rounds / Stats), plus GuideScreen
vite.config.mts             Vite + local /api/extract for `npm run dev`
```

## Troubleshooting

- **"GEMINI_API_KEY is not set"**: add the variable in Vercel, then redeploy.
- **"Gemini error 404 … model not found"**: Google renames models over time. Set `GEMINI_MODEL` to a current Flash model from <https://ai.google.dev/gemini-api/docs/models>.
- **"Gemini error 429"**: you've hit the free-tier rate limit. Wait a minute, or enable billing.
- **Names or ratings slightly off**: fix them on the *Check players* screen. A clearer, less-scrolled screenshot helps.
- **No signal courtside**: once the app is open, the schedule, rebuilds and swaps keep working without signal. Only screenshot import needs the server, and you can paste a list instead. Reloading the page with no signal won't work, so keep the tab open.
