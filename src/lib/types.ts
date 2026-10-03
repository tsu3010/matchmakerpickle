export type PlayerId = string;

export interface Player {
  id: PlayerId;
  name: string;
  /** Doubles DUPR. null = unrated (uses the group median). */
  rating: number | null;
  /** At the venue and available to play. Unticked = expected later. */
  present: boolean;
  /** Left the session early. Excluded from future rounds. */
  left: boolean;
}

export interface Game {
  team1: [PlayerId, PlayerId];
  team2: [PlayerId, PlayerId];
}

export interface Round {
  games: Game[];
  /** Available players sitting out this round. */
  out: PlayerId[];
}

export interface Settings {
  /** "19:00" (24h). */
  startTime: string;
  courts: number;
  roundMinutes: number;
  sessionMinutes: number;
  /** Max combined-DUPR gap between two teams on a court. */
  maxGap: number;
}

export interface Session {
  version: 1;
  players: Player[];
  settings: Settings;
  rounds: Round[];
  /** Number of rounds started (locked). Rounds [0, locked) never change on rebuild. */
  locked: number;
  /** Epoch ms when the current (last locked) round was started. */
  roundStartedAt: number | null;
}

export const DEFAULT_SETTINGS: Settings = {
  startTime: "19:00",
  courts: 3,
  roundMinutes: 13,
  sessionMinutes: 150,
  maxGap: 0.3,
};
