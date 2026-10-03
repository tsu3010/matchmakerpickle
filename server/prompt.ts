export const EXTRACT_PROMPT = `You are reading screenshots of the "Participants" tab of a pickleball meet in the Reclub app.

Each player appears as a round photo with, underneath it:
- the player's name (long names WRAP onto a second line, sometimes mid-word, e.g. "Christophe" / "r" is one name "Christopher", "jordanle" / "e" is "jordanlee"; real two-word names like "Maya" / "Fernandez" keep the space: "Maya Fernandez")
- a DOUBLES rating next to a two-person icon (e.g. 3.466) — this is the one we want
- a SINGLES rating next to a one-person icon (often "NR") — IGNORE this
- sometimes badges or chips such as "Admin", "Paid", "Checked In", "September Champion" — these are NOT names

Players are listed under section headers such as "CONFIRMED • 24/24" and "WAITLISTED • 6".
The screenshots were taken while scrolling, so the same player may appear in more than one screenshot — list each player only once.

Return ONLY a JSON object, no markdown, in exactly this shape:
{"players":[{"name":"Maya Fernandez","doubles":3.412,"section":"confirmed","checked_in":false}]}

Rules:
- "doubles": the number next to the two-person icon, as a number. Use null if it shows "NR", is blank, or the player shows no rating.
- "section": "confirmed" or "waitlisted" depending on which header the player is under.
- "checked_in": true only if a "Checked In" chip is shown under that player.
- Keep the name's spelling and capitalisation as displayed (just join wrapped lines).
- Include every player whose name is at least partly visible; skip a tile only if the name is completely cut off.`;
