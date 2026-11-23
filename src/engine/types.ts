// ============================================================================
// Rocket League Manager — core data model
// All entities are stored in id-indexed tables (normalised, relational style)
// so the persistence layer can later be mapped 1:1 onto SQLite/PostgreSQL.
// ============================================================================

export type Region = 'EU' | 'NA' | 'SAM' | 'MENA' | 'OCE' | 'APAC' | 'SSA';
export const REGIONS: Region[] = ['EU', 'NA', 'SAM', 'MENA', 'OCE', 'APAC', 'SSA'];

export type Difficulty = 'easy' | 'normal' | 'hard' | 'hardcore';

export const MECH_KEYS = [
  'carControl', 'aerial', 'flipResets', 'airDribble', 'shooting', 'power',
  'ground', 'recoveries', 'firstTouch', 'ballControl', 'mechConsistency',
] as const;
export const IQ_KEYS = [
  'positioning', 'rotation', 'decisions', 'reading', 'boost',
  'defAwareness', 'offAwareness', 'challenge', 'adaptability',
] as const;
export const MENTAL_KEYS = [
  'composure', 'confidence', 'consistency', 'clutch', 'pressure',
  'motivation', 'professionalism', 'leadership', 'discipline',
] as const;
export type MechKey = (typeof MECH_KEYS)[number];
export type IqKey = (typeof IQ_KEYS)[number];
export type MentalKey = (typeof MENTAL_KEYS)[number];
export type AttrKey = MechKey | IqKey | MentalKey;
export type Attributes = Record<AttrKey, number>; // floats 1..99, displayed rounded

export type Personality =
  | 'Leader' | 'Calme' | 'Perfectionniste' | 'Explosif' | 'Discret'
  | 'Compétiteur' | 'Mercenaire' | 'Loyal' | 'Fêtard' | 'Professionnel';

export interface Hidden {
  potential: number;          // potential ability (same scale as CA, 1..99)
  ambition: number;           // 1..20
  loyalty: number;            // 1..20
  personality: Personality;
  pressureSensitivity: number; // 1..20 (high = crumbles)
  injuryProneness: number;     // 1..20
  profCeiling: number;         // 1..20
}

export type Position = 1 | 2 | 3; // first / second / third man
export type Playstyle = 'Agressif' | 'Playmaker' | 'Mécanique' | 'Support' | 'Ancre défensive';
export const PLAYSTYLES: Playstyle[] = ['Agressif', 'Playmaker', 'Mécanique', 'Support', 'Ancre défensive'];

export type Archetype =
  | 'Superstar' | 'Prospect élite' | 'Prodige mécanique' | 'Spécialiste tactique'
  | 'Spécialiste défensif' | 'Vétéran' | 'Irrégulier à haut plafond'
  | 'Agent libre sous-coté' | 'Talent régional' | 'Joueur de rotation';

export interface Contract {
  salary: number;        // monthly, USD
  start: string;         // ISO date
  end: string;           // ISO date (always Dec 31 of a year)
  buyout: number;        // release clause (0 = none)
  signingBonus: number;
  winBonus: number;      // bonus per tournament won
  prizeShare: number;    // share of prize money going to the player (0..1, split by the roster)
}

export interface StatLine {
  games: number; wins: number; goals: number; assists: number; saves: number;
  shots: number; demos: number; mvps: number; ratingSum: number; score: number;
}

export interface Condition {
  fatigue: number;   // 0..100 (high = tired)
  form: number;      // 0..100 (50 = neutral)
  morale: number;    // 0..100
  burnout: number;   // 0..100 accumulated risk
  injuredUntil: string | null; // wrist/back issues, burnout breaks
}

export type SquadRole = 'starter' | 'sub' | 'academy';

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  tag: string;
  nationality: string;
  region: Region;
  birth: string;
  orgId: string | null;
  squadRole: SquadRole | null;
  position: Position;          // preferred position
  playstyle: Playstyle;
  archetype: Archetype;
  attrs: Attributes;
  hidden: Hidden;
  cond: Condition;
  contract: Contract | null;
  value: number;
  reputation: number;     // 0..100
  popularity: number;     // 0..100
  followers: number;
  careerEarnings: number;
  achievements: string[];
  season: StatLine;
  career: StatLine;
  recentRatings: number[]; // last 15 game ratings
  retired: boolean;
  history: { season: number; orgId: string | null; orgName: string }[];
  joinedOrgDate: string | null;
  askingOffer?: number;   // transfer listed by own org
  unhappy?: number;       // days unhappy (wants out)
}

export type StaffRole = 'Head coach' | 'Assistant coach' | 'Analyste' | 'Performance coach' | 'Mental coach' | 'Academy coach' | 'Recruteur';
export const STAFF_ROLES: StaffRole[] = ['Head coach', 'Assistant coach', 'Analyste', 'Performance coach', 'Mental coach', 'Academy coach', 'Recruteur'];

export interface Staff {
  id: string;
  name: string;
  nationality: string;
  region: Region;
  role: StaffRole;
  age: number;
  attrs: { mechanics: number; tactics: number; mental: number; fitness: number; youth: number; analysis: number; motivation: number }; // 1..20
  reputation: number;
  salary: number;
  orgId: string | null;
  contractEnd: string | null;
  scoutRegion?: Region | null;
}

export type Tactic = {
  pressure: number;      // -2 (very defensive) .. +2 (very aggressive)
  tempo: number;         // -2 (slow, controlled) .. +2 (fast)
  boostControl: number;  // 0..2 priority on boost denial/steal
  demos: number;         // 0..2 demo focus
  challenges: number;    // -2 (patient) .. +2 (challenge everything)
  rotation: 'standard' | 'tight' | 'loose';
};

export interface Org {
  id: string;
  name: string;
  tag: string;
  region: Region;
  country: string;
  hq: string;
  colors: [string, string];
  founded: number;
  reputation: number;     // 0..100
  fans: number;           // core fanbase
  balance: number;
  debt: number;
  isUser: boolean;
  philosophy: 'Moneyball' | 'Galactique' | 'Formation' | 'Stable' | 'Agressif';
  ambition: number;       // 1..20
  facilities: number;     // 1..5
  academyLevel: number;   // 1..5
  tactic: Tactic;
  positions: Record<string, Position>; // playerId -> assigned position
  captainId: string | null;
  chemistry: Record<string, number>; // "pidA|pidB" sorted -> 0..100
  social: Social;
  elo: number;
  sponsorIds: string[];
  trophies: { season: number; tournament: string; tier: string }[];
  boardConfidence: number; // 0..100 (user org)
  objective: string;
  disbanded: boolean;
  negativeMonths: number;
  trainingFocus: TeamTraining;
  individualTraining: Record<string, IndividualFocus>;
  marketingBudget: number; // monthly
  bootcampUntil?: string | null;
  managerVacancy?: boolean;
  lastTacticChange?: string;
}

export interface Social {
  x: number; tiktok: number; youtube: number; twitch: number; discord: number;
  sentiment: number;      // 0..100
  engagement: number;     // 0..100 (recent activity)
  postsThisMonth: number;
  history: { date: string; total: number }[];
}

export type TeamFocus = 'Équilibré' | 'Mécanique' | 'Tactique' | 'Défense' | 'Attaque' | 'Cohésion' | 'Mental' | 'Récupération';
export const TEAM_FOCUSES: TeamFocus[] = ['Équilibré', 'Mécanique', 'Tactique', 'Défense', 'Attaque', 'Cohésion', 'Mental', 'Récupération'];
export interface TeamTraining { focus: TeamFocus; intensity: 0 | 1 | 2 | 3 }  // 0 = rest
export type IndividualFocus = 'Aucun' | 'Aérien' | 'Tirs' | 'Contrôle' | 'Rotations' | 'Lecture du jeu' | 'Mental' | 'Boost' | 'Récupérations';
export const INDIVIDUAL_FOCUSES: IndividualFocus[] = ['Aucun', 'Aérien', 'Tirs', 'Contrôle', 'Rotations', 'Lecture du jeu', 'Mental', 'Boost', 'Récupérations'];

export type SponsorIndustry = 'Périphériques' | 'Boisson énergisante' | 'Chaises gaming' | 'Tech' | 'Vêtements' | 'Services financiers' | 'Hardware PC' | 'Télécom' | 'Automobile' | 'Alimentation';

export interface Sponsor {
  id: string;
  name: string;
  industry: SponsorIndustry;
  reputation: number;     // brand prestige 0..100
  budget: number;         // max monthly amount for a deal
  regions: Region[] | 'GLOBAL';
  minReputation: number;
  audience: 'Hardcore' | 'Casual' | 'Mainstream';
  style: 'Exigeant' | 'Patient' | 'Opportuniste';
}

export interface SponsorDeal {
  id: string;
  sponsorId: string;
  orgId: string;
  monthly: number;
  start: string;
  end: string;
  objective: { kind: 'placement' | 'followers' | 'posts'; target: number; bonus: number; label: string };
  objectiveMet: boolean;
  postsRequired: number;  // promotional posts per month
  postsDone: number;
  satisfaction: number;   // 0..100
  active: boolean;
}

export type TournamentKind = 'regional' | 'major' | 'worlds' | 'invitational';
export type StageFormat = 'swiss' | 'single' | 'groups';

export interface Standing { teamId: string; w: number; l: number; gw: number; gl: number; eliminated: boolean; qualified: boolean; group?: number }

export interface Stage {
  name: string;
  format: StageFormat;
  bestOf: number;
  teamIds: string[];
  standings: Standing[];
  round: number;           // current round index
  matchIds: string[];
  done: boolean;
  advance: number;         // how many advance
}

export interface Tournament {
  id: string;
  season: number;
  name: string;
  short: string;
  kind: TournamentKind;
  region: Region | 'INTL';
  split: number;            // 1,2 (0 for worlds/invitational)
  start: string;
  end: string;
  lan: boolean;
  prizePool: number;
  teamIds: string[];
  stages: Stage[];
  stageIdx: number;
  status: 'upcoming' | 'live' | 'done';
  placements: { teamId: string; place: string; rank: number; prize: number; points: number }[];
  mvpId?: string;
  registrationDeadline: string;
}

export interface PlayerGameStats { pid: string; goals: number; assists: number; saves: number; shots: number; demos: number; score: number; rating: number; touches: number }

export interface GameResult {
  scoreA: number; scoreB: number; ot: boolean; otSeconds: number;
  statsA: PlayerGameStats[]; statsB: PlayerGameStats[];
  possessionA: number; // 0..1
  events?: MatchEvent[];
}

export interface Match {
  id: string;
  tournamentId: string;
  stageIdx: number;
  round: number;
  label: string;
  date: string;
  teamA: string;
  teamB: string;
  bestOf: number;
  games: GameResult[];
  winner: string | null;
  played: boolean;
  rosterA?: string[];
  rosterB?: string[];
}

export interface MatchEvent {
  t: number;           // seconds elapsed (300 = end of regulation, >300 = OT)
  kind: 'goal' | 'save' | 'shot' | 'demo' | 'kickoff' | 'pressure' | 'info' | 'end' | 'tactic';
  team: 0 | 1;
  pid?: string;
  pid2?: string;
  text: string;
}

export interface NewsItem {
  id: string;
  date: string;
  title: string;
  body: string;
  kind: 'transfer' | 'result' | 'rumor' | 'finance' | 'club' | 'player' | 'sponsor' | 'board' | 'world';
  orgIds: string[];
  playerIds: string[];
  important: boolean;
  read: boolean;
}

export interface TransferOffer {
  id: string;
  date: string;
  playerId: string;
  fromOrgId: string;    // buying org
  toOrgId: string | null; // selling org (null = free agent)
  fee: number;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'withdrawn' | 'negotiating';
  counterFee?: number;
  incoming: boolean;    // offer for a user's player
  expires: string;
}

export interface Negotiation {
  playerId: string;
  orgId: string;
  fee: number;
  patience: number;
  lastDemand: ContractTerms;
  mood: string;
  renewal: boolean;
}

export interface ContractTerms { salary: number; years: number; signingBonus: number; winBonus: number; prizeShare: number; buyout: number; role: SquadRole }

export interface LedgerEntry { date: string; orgId: string; category: FinanceCategory; amount: number; label: string }
export type FinanceCategory =
  | 'Sponsors' | 'Prize money' | 'Merchandising' | 'Contenu & streaming' | 'Transferts (ventes)' | 'Autres revenus'
  | 'Salaires joueurs' | 'Salaires staff' | 'Transferts (achats)' | 'Primes' | 'Voyages' | 'Bootcamps'
  | 'Infrastructures' | 'Marketing' | 'Équipement' | 'Frais opérationnels' | 'Intérêts';
export const INCOME_CATS: FinanceCategory[] = ['Sponsors', 'Prize money', 'Merchandising', 'Contenu & streaming', 'Transferts (ventes)', 'Autres revenus'];

export interface Manager {
  name: string;
  nationality: string;
  reputation: number;   // 0..100
  experience: number;   // seasons
  orgId: string | null;
  trophies: string[];
  history: { season: number; orgName: string; result: string }[];
  applications: { orgId: string; date: string; status: 'pending' | 'accepted' | 'rejected' }[];
  hiredDate: string | null;
  founderOrgId?: string | null;
}

export interface Records {
  transferFee: { value: number; label: string; date: string } | null;
  seriesGoals: { value: number; label: string; date: string } | null;
  gameScore: { value: number; label: string; date: string } | null;
  biggestPrize: { value: number; label: string; date: string } | null;
}

export interface SeasonHistory {
  season: number;
  champions: { tournament: string; kind: TournamentKind; region: string; winnerId: string; winnerName: string; runnerUpName: string; mvp?: string }[];
  topTeams: { orgId: string; name: string; elo: number; points: number }[];
  topPlayers: { pid: string; tag: string; orgName: string; rating: number }[];
  userSummary?: string;
}

export interface GameState {
  version: number;
  saveId: string;
  saveName: string;
  createdAt: string;
  seed: number;
  rngState: number;
  date: string;
  season: number;
  difficulty: Difficulty;
  manager: Manager;
  userOrgId: string | null;
  players: Record<string, Player>;
  orgs: Record<string, Org>;
  staff: Record<string, Staff>;
  sponsors: Record<string, Sponsor>;
  deals: Record<string, SponsorDeal>;
  tournaments: Record<string, Tournament>;
  matches: Record<string, Match>;
  news: NewsItem[];
  offers: Record<string, TransferOffer>;
  negotiation: Negotiation | null;
  ledger: LedgerEntry[];
  monthly: { month: string; orgId: string; income: number; expense: number; balance: number }[];
  circuitPoints: Record<string, Record<string, number>>; // season -> orgId -> points
  splitPoints: Record<string, Record<string, number>>;   // "season-split" -> orgId -> pts
  transfersLog: { date: string; playerId: string; tag: string; from: string; to: string; fee: number }[];
  history: SeasonHistory[];
  records: Records;
  scout: Record<string, number>; // playerId -> knowledge 0..100 (user)
  shortlist: string[];
  pendingUserMatch: string | null;
  inbox: { id: string; date: string; title: string; body: string; read: boolean; action?: { kind: 'offer' | 'screen'; id: string } }[];
  idCounter: number;
  gameOver: boolean;
  settings: { autosave: boolean; liveSpeed: number };
  eloHistory: Record<string, { d: string; e: number }[]>;
  campaignsUsed: Record<string, string>;
  rankingHistory: { date: string; top: { orgId: string; elo: number }[] }[];
}
