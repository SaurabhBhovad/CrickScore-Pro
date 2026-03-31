export type PlayerRole = 'Batsman' | 'Bowler' | 'All-rounder' | 'Wicketkeeper';

export interface PlayerStats {
  matches: number;
  runs: number;
  wickets: number;
  bestScore: number;
  bestBowling: string;
  strikeRate: number;
  economy: number;
}

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  teamId: string;
  stats: PlayerStats;
}

export interface Team {
  id: string;
  name: string;
  logoUrl?: string;
  playerIds: string[];
  stats: {
    played: number;
    won: number;
    lost: number;
    nrr: number;
  };
}

export type MatchStatus = 'upcoming' | 'live' | 'completed';
export type TossDecision = 'bat' | 'bowl';

export interface Match {
  id: string;
  tournamentId?: string;
  teamAId: string;
  teamBId: string;
  status: MatchStatus;
  tossWinnerId?: string;
  tossDecision?: TossDecision;
  currentInnings: 1 | 2;
  innings: {
    1: InningsData;
    2: InningsData;
  };
  winnerId?: string;
  createdAt: number;
}

export interface InningsData {
  battingTeamId: string;
  bowlingTeamId: string;
  runs: number;
  wickets: number;
  balls: number;
  extras: {
    wides: number;
    noBalls: number;
    byes: number;
    legByes: number;
  };
}

export interface BallRecord {
  id: string;
  matchId: string;
  innings: 1 | 2;
  over: number;
  ball: number;
  runs: number;
  isWicket: boolean;
  wicketType?: string;
  extraType?: 'wide' | 'no-ball' | 'bye' | 'leg-bye';
  batsmanId: string;
  bowlerId: string;
  timestamp: number;
}

export interface Tournament {
  id: string;
  name: string;
  teamIds: string[];
  matchIds: string[];
  status: 'upcoming' | 'ongoing' | 'completed';
  pointsTable: {
    [teamId: string]: {
      played: number;
      won: number;
      lost: number;
      tied: number;
      points: number;
      nrr: number;
    };
  };
}
