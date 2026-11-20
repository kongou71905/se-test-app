import {
  DEFAULT_RULE_CONFIG,
  DailyRecord,
  GameDetail,
  POINTS_PATTERNS,
  Player,
  PointsPatternKey,
  RuleConfig,
  SessionDraft,
  SettingRow,
  UMA_PATTERNS,
  UmaPatternKey,
  WINDS,
  Wind,
} from '../types/mahjong';

export function normalizeZero(value: number): number {
  return Object.is(value, -0) || value === 0 ? 0 : value;
}

export function formatPoint(value: number): string {
  const n = normalizeZero(value);
  if (n > 0) return `+${n}`;
  return String(n);
}

export function formatNumber(value: number): string {
  return value.toLocaleString('ja-JP');
}

export function getTodayYYYYMMDD(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

export function toInputDateValue(slashDate: string): string {
  return slashDate.replaceAll('/', '-');
}

export function toSlashDateValue(inputDate: string): string {
  return inputDate.replaceAll('-', '/');
}

export function getNowTimestamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${y}/${m}/${d} ${hh}:${mm}:${ss}`;
}

export function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `S-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 半角文字=1、全角文字=2 でカウントし、最大16（全角8文字/半角16文字）を検証する
 */
export function getHalfWidthLength(text: string): number {
  let len = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    // ASCII printable or half-width katakana (FF61-FF9F)
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xff61 && code <= 0xff9f)) {
      len += 1;
    } else {
      len += 2;
    }
  }
  return len;
}

export function validatePlayerName(
  rawName: string,
  allPlayers: Player[],
  editingPlayerId?: string
): string | null {
  const name = (rawName ?? '').trim();
  if (!name) {
    return '対局者名を入力してください。';
  }
  if (getHalfWidthLength(name) > 16) {
    return '対局者名は全角8文字（半角16文字）以内で入力してください。';
  }
  const duplicate = allPlayers.find(
    (p) => p.name === name && p.player_id !== editingPlayerId
  );
  if (duplicate) {
    return duplicate.is_active
      ? '同じ名前の対局者がすでに登録されています。'
      : '論理削除済みの対局者と同じ名前は登録できません。';
  }
  return null;
}

export function validatePositiveInteger(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const num = Number(trimmed);
  if (!Number.isSafeInteger(num) || num <= 0) return null;
  return num;
}

export function validateNegativeInteger(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!/^-\d+$/.test(trimmed)) return null;
  const num = Number(trimmed);
  if (!Number.isSafeInteger(num) || num >= 0) return null;
  return num;
}

export function sanitizeRuleConfig(
  partial: Partial<Record<keyof RuleConfig, string>>,
  fallback: RuleConfig = DEFAULT_RULE_CONFIG
): RuleConfig {
  const game_type =
    partial.game_type === 'hanchan' || partial.game_type === 'tonpuu'
      ? partial.game_type
      : fallback.game_type;

  const pointsKey = `${partial.starting_points ?? ''}-${partial.return_points ?? ''}` as PointsPatternKey;
  const matchedPoints = POINTS_PATTERNS.find((p) => p.key === pointsKey);
  const starting_points = matchedPoints
    ? matchedPoints.starting_points
    : fallback.starting_points;
  const return_points = matchedPoints
    ? matchedPoints.return_points
    : fallback.return_points;

  const matchedUma = UMA_PATTERNS.find((u) => u.key === partial.uma_pattern);
  const uma_pattern: UmaPatternKey = matchedUma
    ? matchedUma.key
    : fallback.uma_pattern;

  const parseBoolStr = (
    val: string | undefined,
    fb: 'true' | 'false'
  ): 'true' | 'false' => (val === 'true' || val === 'false' ? val : fb);

  const parsedTobiBusted = validateNegativeInteger(partial.tobi_busted_point);
  const validTobiBustedPoint =
    parsedTobiBusted !== null
      ? String(parsedTobiBusted)
      : fallback.tobi_busted_point;

  const parsedTobiFlyer = validatePositiveInteger(partial.tobi_flyer_point);
  const validTobiFlyerPoint =
    parsedTobiFlyer !== null
      ? String(parsedTobiFlyer)
      : fallback.tobi_flyer_point;

  const parsedChipRate = validatePositiveInteger(partial.chip_rate);
  const validChipRate =
    parsedChipRate !== null ? String(parsedChipRate) : fallback.chip_rate;

  const parsedRate = validatePositiveInteger(partial.settlement_rate);
  const validRate =
    parsedRate !== null ? String(parsedRate) : fallback.settlement_rate;

  return {
    game_type,
    starting_points,
    return_points,
    uma_pattern,
    use_tobi: parseBoolStr(partial.use_tobi, fallback.use_tobi),
    tobi_busted_point: validTobiBustedPoint,
    tobi_flyer_point: validTobiFlyerPoint,
    use_yakitori: parseBoolStr(partial.use_yakitori, fallback.use_yakitori),
    use_chip: parseBoolStr(partial.use_chip, fallback.use_chip),
    chip_rate: validChipRate,
    use_settlement: parseBoolStr(partial.use_settlement, fallback.use_settlement),
    settlement_rate: validRate,
  };
}

export function getTobiBustedPoint(rules: RuleConfig): number {
  return validateNegativeInteger(rules.tobi_busted_point) ?? -5;
}

export function getTobiFlyerPoint(rules: RuleConfig): number {
  return validatePositiveInteger(rules.tobi_flyer_point) ?? 5;
}

export function getChipRate(rules: RuleConfig): number {
  return validatePositiveInteger(rules.chip_rate) ?? 2;
}

export function getYakitoriPoints(yakitoriCount: number): {
  penalty: number;
  bonus: number;
} {
  if (yakitoriCount === 1) return { penalty: -15, bonus: 5 };
  if (yakitoriCount === 2) return { penalty: -7, bonus: 7 };
  if (yakitoriCount === 3) return { penalty: -5, bonus: 15 };
  return { penalty: 0, bonus: 0 };
}

export function parseSettingsRowsToRuleConfig(rows: SettingRow[]): RuleConfig {
  const map: Partial<Record<keyof RuleConfig, string>> = {};
  for (const row of rows) {
    if (row.setting_key in DEFAULT_RULE_CONFIG) {
      map[row.setting_key as keyof RuleConfig] = String(row.setting_value);
    }
  }
  return sanitizeRuleConfig(map, DEFAULT_RULE_CONFIG);
}

export function ruleConfigToSettingsRows(
  config: RuleConfig,
  updatedAt = getNowTimestamp()
): SettingRow[] {
  return (Object.keys(DEFAULT_RULE_CONFIG) as (keyof RuleConfig)[]).map((key) => ({
    setting_key: key,
    setting_value: String(config[key]),
    updated_at: updatedAt,
  }));
}

export function parseRuleSnapshot(
  snapshotStr: string | undefined,
  currentSettings: RuleConfig
): RuleConfig {
  if (!snapshotStr || !snapshotStr.trim()) {
    return { ...currentSettings };
  }
  try {
    const parsed = JSON.parse(snapshotStr) as Partial<Record<keyof RuleConfig, string>>;
    // Preserve original defaults (-5/+5 tobi, x2 chip) for older snapshots created before these fields existed
    const snapshotFallback: RuleConfig = {
      ...currentSettings,
      tobi_busted_point: DEFAULT_RULE_CONFIG.tobi_busted_point,
      tobi_flyer_point: DEFAULT_RULE_CONFIG.tobi_flyer_point,
      chip_rate: DEFAULT_RULE_CONFIG.chip_rate,
    };
    return sanitizeRuleConfig(parsed, snapshotFallback);
  } catch {
    return { ...currentSettings };
  }
}

export function getRuleSummaryText(rules: RuleConfig): string {
  const typeLabel = rules.game_type === 'hanchan' ? '半荘' : '東風';
  const startLabel = Number(rules.starting_points).toLocaleString('ja-JP');
  const retLabel = Number(rules.return_points).toLocaleString('ja-JP');
  const umaLabel = rules.uma_pattern === '0-0' ? 'ウマなし' : `ウマ${rules.uma_pattern}`;
  const extras: string[] = [];
  if (rules.use_tobi === 'true') {
    extras.push(
      `飛び(${getTobiBustedPoint(rules)}/${formatPoint(getTobiFlyerPoint(rules))})`
    );
  }
  if (rules.use_yakitori === 'true') extras.push('焼き鳥');
  if (rules.use_chip === 'true') extras.push(`チップ(${getChipRate(rules)}pt)`);
  const extrasText = extras.length > 0 ? extras.join('・') : '特殊なし';
  return `${typeLabel} · ${startLabel}/${retLabel} · ${umaLabel} · ${extrasText}`;
}

export interface GameScoreEntryInput {
  player_id: string;
  player_name: string;
  wind: Wind;
  raw_score: number;
}

export interface TobiInput {
  enabled: boolean;
  flyer_id: string | null;
  busted_ids: string[];
}

export function calculateGameDetails(params: {
  session_id: string;
  date: string;
  game_number: number;
  entries: GameScoreEntryInput[];
  rules: RuleConfig;
  tobi: TobiInput;
  yakitori_ids: string[];
}): GameDetail[] {
  const { session_id, date, game_number, entries, rules, tobi, yakitori_ids } = params;
  if (entries.length !== 4) {
    throw new Error('1試合には4人の対局者が必要です。');
  }

  const returnPoints = Number(rules.return_points);
  const umaConfig =
    UMA_PATTERNS.find((u) => u.key === rules.uma_pattern) ?? UMA_PATTERNS[2];
  const umaValues = umaConfig.values;

  // Sort by raw_score desc, tie-break by wind order (東 < 南 < 西 < 北)
  const sorted = [...entries].sort((a, b) => {
    if (b.raw_score !== a.raw_score) {
      return b.raw_score - a.raw_score;
    }
    return WINDS.indexOf(a.wind) - WINDS.indexOf(b.wind);
  });

  // Base + Uma for ranks 2, 3, 4
  const basePointsByPlayer = new Map<string, number>();
  let sum234 = 0;
  for (let i = 1; i < 4; i++) {
    const item = sorted[i];
    const diff = normalizeZero(Math.ceil((item.raw_score - returnPoints) / 1000));
    const pt = normalizeZero(diff + umaValues[i]);
    basePointsByPlayer.set(item.player_id, pt);
    sum234 += pt;
  }
  // Rank 1 gets -(sum of ranks 2, 3, 4) to guarantee zero-sum including Oka & riichi sticks
  basePointsByPlayer.set(sorted[0].player_id, normalizeZero(-sum234));

  // Tobi calculation
  const tobiBustedPoint = getTobiBustedPoint(rules);
  const tobiFlyerPoint = getTobiFlyerPoint(rules);
  const tobiEnabled =
    rules.use_tobi === 'true' &&
    tobi.enabled &&
    Boolean(tobi.flyer_id) &&
    tobi.busted_ids.length > 0;

  // Yakitori calculation
  const yakitoriSet = new Set(
    rules.use_yakitori === 'true' ? yakitori_ids : []
  );
  const yakitoriCount = yakitoriSet.size;
  const { penalty: yakitoriPenalty, bonus: yakitoriBonus } =
    rules.use_yakitori === 'true'
      ? getYakitoriPoints(yakitoriCount)
      : { penalty: 0, bonus: 0 };

  const rankByPlayer = new Map<string, number>();
  sorted.forEach((item, idx) => {
    rankByPlayer.set(item.player_id, idx + 1);
  });

  // Return ordered by wind (東 -> 南 -> 西 -> 北) for consistent display/storage
  return [...entries]
    .sort((a, b) => WINDS.indexOf(a.wind) - WINDS.indexOf(b.wind))
    .map((entry) => {
      const rank = rankByPlayer.get(entry.player_id) ?? 4;
      const base = basePointsByPlayer.get(entry.player_id) ?? 0;

      let is_tobi = false;
      let tobi_count = 0;
      let tobiPoint = 0;
      if (tobiEnabled) {
        if (tobi.busted_ids.includes(entry.player_id)) {
          is_tobi = true;
          tobiPoint = tobiBustedPoint;
        } else if (tobi.flyer_id === entry.player_id) {
          tobi_count = tobi.busted_ids.length;
          tobiPoint = tobiFlyerPoint * tobi_count;
        }
      }

      const is_yakitori =
        rules.use_yakitori === 'true' && yakitoriSet.has(entry.player_id);
      const yakitoriPoint =
        rules.use_yakitori === 'true' && yakitoriCount >= 1 && yakitoriCount <= 3
          ? is_yakitori
            ? yakitoriPenalty
            : yakitoriBonus
          : 0;

      const final_point = normalizeZero(base + tobiPoint + yakitoriPoint);

      return {
        session_id,
        date,
        game_number,
        player_id: entry.player_id,
        player_name: entry.player_name,
        wind: entry.wind,
        raw_score: entry.raw_score,
        rank,
        is_tobi,
        tobi_count,
        is_yakitori,
        final_point,
      };
    });
}

export function buildSessionSavePayload(
  draft: SessionDraft,
  players: Player[]
): {
  session_id: string;
  daily_records: DailyRecord[];
  game_details: GameDetail[];
} {
  const playerMap = new Map(players.map((p) => [p.player_id, p]));
  const ruleSnapshotJson = JSON.stringify(draft.rule_snapshot);
  const useChip = draft.rule_snapshot.use_chip === 'true';

  const gameDetails: GameDetail[] = [];
  const gameCountMap = new Map<string, number>();
  const gameSumMap = new Map<string, number>();

  draft.games.forEach((g, idx) => {
    const gameNum = idx + 1;
    g.details.forEach((d) => {
      const currentPlayerName =
        playerMap.get(d.player_id)?.name ?? d.player_name;
      gameDetails.push({
        ...d,
        session_id: draft.session_id,
        date: draft.date,
        game_number: gameNum,
        player_name: currentPlayerName,
        is_tobi: draft.rule_snapshot.use_tobi === 'true' ? d.is_tobi : false,
        tobi_count: draft.rule_snapshot.use_tobi === 'true' ? d.tobi_count : 0,
        is_yakitori:
          draft.rule_snapshot.use_yakitori === 'true' ? d.is_yakitori : false,
      });
      gameCountMap.set(d.player_id, (gameCountMap.get(d.player_id) ?? 0) + 1);
      gameSumMap.set(
        d.player_id,
        (gameSumMap.get(d.player_id) ?? 0) + d.final_point
      );
    });
  });

  const dailyRecords: DailyRecord[] = [];
  const chipRate = getChipRate(draft.rule_snapshot);
  for (const pid of draft.participant_ids) {
    const game_count = gameCountMap.get(pid) ?? 0;
    const chip_diff = useChip ? normalizeZero(draft.chips[pid] ?? 0) : 0;
    // Exclude 0-game and 0-chip participants per spec 3.1-2 / 3.2
    if (game_count === 0 && chip_diff === 0) {
      continue;
    }
    const chip_point = useChip ? normalizeZero(chip_diff * chipRate) : 0;
    const gameSum = gameSumMap.get(pid) ?? 0;
    const total_point = normalizeZero(gameSum + chip_point);
    const player_name = playerMap.get(pid)?.name ?? pid;

    dailyRecords.push({
      session_id: draft.session_id,
      date: draft.date,
      player_id: pid,
      player_name,
      game_count,
      chip_diff,
      chip_point,
      total_point,
      rule_snapshot: ruleSnapshotJson,
    });
  }

  return {
    session_id: draft.session_id,
    daily_records: dailyRecords,
    game_details: gameDetails,
  };
}
