export type Wind = '東' | '南' | '西' | '北';

export type GameType = 'hanchan' | 'tonpuu';

export type PointsPatternKey =
  | '25000-30000'
  | '25000-25000'
  | '30000-30000'
  | '30000-35000';

export type UmaPatternKey = '0-0' | '5-15' | '10-20' | '10-30';

export interface Player {
  player_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface DailyRecord {
  session_id: string;
  date: string; // YYYY/MM/DD
  player_id: string;
  player_name: string;
  game_count: number;
  chip_diff: number;
  chip_point: number;
  total_point: number;
  rule_snapshot: string;
}

export interface GameDetail {
  session_id: string;
  date: string; // YYYY/MM/DD
  game_number: number;
  player_id: string;
  player_name: string;
  wind: Wind;
  raw_score: number;
  rank: number;
  is_tobi: boolean;
  tobi_count: number;
  is_yakitori: boolean;
  final_point: number;
}

export interface SettingRow {
  setting_key: string;
  setting_value: string;
  updated_at: string;
}

export interface RuleConfig {
  game_type: GameType;
  starting_points: '25000' | '30000';
  return_points: '25000' | '30000' | '35000';
  uma_pattern: UmaPatternKey;
  use_tobi: 'true' | 'false';
  tobi_busted_point: string; // negative integer string, default "-5"
  tobi_flyer_point: string; // positive integer string, default "5"
  use_yakitori: 'true' | 'false';
  use_chip: 'true' | 'false';
  chip_rate: string; // positive integer string, default "2"
  use_settlement: 'true' | 'false';
  settlement_rate: string; // positive integer string, default "50"
}

export interface DraftGame {
  game_number: number;
  details: GameDetail[];
}

export interface SessionDraft {
  mode: 'new' | 'edit' | 'view';
  session_id: string;
  date: string; // YYYY/MM/DD
  participant_ids: string[];
  rule_snapshot: RuleConfig;
  games: DraftGame[];
  chips: Record<string, number>; // player_id -> chip_diff
}

export interface InitialDataPayload {
  players: Player[];
  daily_records: DailyRecord[];
  game_details: GameDetail[];
  settings: SettingRow[];
}

export type StorageMode = 'gas' | 'local';

export type AppView =
  | 'connection'
  | 'top'
  | 'rules'
  | 'players'
  | 'setup'
  | 'scoreboard'
  | 'history';

export const WINDS: Wind[] = ['東', '南', '西', '北'];

export const POINTS_PATTERNS: {
  key: PointsPatternKey;
  label: string;
  starting_points: '25000' | '30000';
  return_points: '25000' | '30000' | '35000';
  oka: number;
}[] = [
  {
    key: '25000-30000',
    label: '25,000点持ち / 30,000点返し（オカ +20）',
    starting_points: '25000',
    return_points: '30000',
    oka: 20,
  },
  {
    key: '25000-25000',
    label: '25,000点持ち / 25,000点返し（オカ 0）',
    starting_points: '25000',
    return_points: '25000',
    oka: 0,
  },
  {
    key: '30000-30000',
    label: '30,000点持ち / 30,000点返し（オカ 0）',
    starting_points: '30000',
    return_points: '30000',
    oka: 0,
  },
  {
    key: '30000-35000',
    label: '30,000点持ち / 35,000点返し（オカ +20）',
    starting_points: '30000',
    return_points: '35000',
    oka: 20,
  },
];

export const UMA_PATTERNS: {
  key: UmaPatternKey;
  label: string;
  values: [number, number, number, number];
}[] = [
  { key: '0-0', label: 'なし（0-0）', values: [0, 0, 0, 0] },
  { key: '5-15', label: '5-15（+15 / +5 / -5 / -15）', values: [15, 5, -5, -15] },
  { key: '10-20', label: '10-20（+20 / +10 / -10 / -20）', values: [20, 10, -10, -20] },
  { key: '10-30', label: '10-30（+30 / +10 / -10 / -30）', values: [30, 10, -10, -30] },
];

export const DEFAULT_RULE_CONFIG: RuleConfig = {
  game_type: 'hanchan',
  starting_points: '25000',
  return_points: '30000',
  uma_pattern: '10-20',
  use_tobi: 'true',
  tobi_busted_point: '-5',
  tobi_flyer_point: '5',
  use_yakitori: 'true',
  use_chip: 'true',
  chip_rate: '2',
  use_settlement: 'true',
  settlement_rate: '50',
};
