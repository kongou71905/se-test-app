import {
  DEFAULT_RULE_CONFIG,
  DailyRecord,
  GameDetail,
  InitialDataPayload,
  Player,
  SessionDraft,
  SettingRow,
  StorageMode,
} from '../types/mahjong';
import {
  getNowTimestamp,
  parseSettingsRowsToRuleConfig,
  ruleConfigToSettingsRows,
} from '../utils/mahjongCalc';

export const REQUIRED_API_VERSION = '1.0';

const LS_GAS_URL = 'mj_gas_url';
const LS_STORAGE_MODE = 'mj_storage_mode';
const LS_DRAFT_NEW = 'mj_draft_new';
const LS_DRAFT_EDIT = 'mj_draft_edit';
const LS_LOCAL_DB = 'mj_local_db';

export function validateGasUrl(rawUrl: string): {
  valid: boolean;
  message?: string;
} {
  const url = rawUrl.trim();
  if (!url) {
    return { valid: false, message: 'GAS WebアプリURLを入力してください。' };
  }
  if (url.includes('docs.google.com/spreadsheets')) {
    return {
      valid: false,
      message:
        'スプレッドシートのURLが入力されています。Apps ScriptでデプロイしたWebアプリURL（/exec）を入力してください。',
    };
  }
  if (/\/dev(\?.*)?$/.test(url)) {
    return {
      valid: false,
      message:
        'テストデプロイURL（/dev）が入力されています。本番デプロイの末尾が /exec のURLを入力してください。',
    };
  }
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(\?.*)?$/.test(url)) {
    return {
      valid: false,
      message:
        'URL形式が正しくありません。https://script.google.com/macros/s/.../exec の形式で入力してください。',
    };
  }
  return { valid: true };
}

export function getSavedGasUrl(): string {
  return localStorage.getItem(LS_GAS_URL) ?? '';
}

export function setSavedGasUrl(url: string): void {
  localStorage.setItem(LS_GAS_URL, url.trim());
  localStorage.setItem(LS_STORAGE_MODE, 'gas');
}

export function getStorageMode(): StorageMode | null {
  const mode = localStorage.getItem(LS_STORAGE_MODE);
  if (mode === 'gas' || mode === 'local') return mode;
  if (getSavedGasUrl()) return 'gas';
  return null;
}

export function setStorageMode(mode: StorageMode): void {
  localStorage.setItem(LS_STORAGE_MODE, mode);
}

export function getNewSessionDraft(): SessionDraft | null {
  try {
    const raw = localStorage.getItem(LS_DRAFT_NEW);
    return raw ? (JSON.parse(raw) as SessionDraft) : null;
  } catch {
    return null;
  }
}

export function saveNewSessionDraft(draft: SessionDraft): void {
  localStorage.setItem(LS_DRAFT_NEW, JSON.stringify(draft));
}

export function clearNewSessionDraft(): void {
  localStorage.removeItem(LS_DRAFT_NEW);
}

export function getEditSessionDraft(): SessionDraft | null {
  try {
    const raw = localStorage.getItem(LS_DRAFT_EDIT);
    return raw ? (JSON.parse(raw) as SessionDraft) : null;
  } catch {
    return null;
  }
}

export function saveEditSessionDraft(draft: SessionDraft): void {
  localStorage.setItem(LS_DRAFT_EDIT, JSON.stringify(draft));
}

export function clearEditSessionDraft(): void {
  localStorage.removeItem(LS_DRAFT_EDIT);
}

/**
 * Spec 3.3:
 * ?gasUrl=... が付いている場合、既存URLと異なれば警告なしで上書きし、
 * 旧接続先で入力中だった未確定データ（一時バックアップ）を自動削除する。
 */
export function applyQueryGasUrlOnStartup(): {
  applied: boolean;
  error?: string;
} {
  const params = new URLSearchParams(window.location.search);
  const queryGasUrl = params.get('gasUrl');
  if (!queryGasUrl) {
    return { applied: false };
  }
  const trimmed = queryGasUrl.trim();
  const check = validateGasUrl(trimmed);
  if (!check.valid) {
    return { applied: false, error: check.message };
  }
  const prevUrl = getSavedGasUrl();
  if (prevUrl !== trimmed) {
    clearNewSessionDraft();
    clearEditSessionDraft();
  }
  setSavedGasUrl(trimmed);
  return { applied: true };
}

export function buildShareLink(gasUrl: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?gasUrl=${encodeURIComponent(gasUrl.trim())}`;
}

function isCompatibleApiVersion(
  serverVersion: string | undefined,
  requiredVersion: string
): boolean {
  if (!serverVersion) return false;
  const [sMajor, sMinor = 0] = serverVersion.split('.').map(Number);
  const [rMajor, rMinor = 0] = requiredVersion.split('.').map(Number);
  if (Number.isNaN(sMajor) || Number.isNaN(rMajor)) return false;
  return sMajor === rMajor && sMinor >= rMinor;
}

async function postGas<T>(
  gasUrl: string,
  payload: Record<string, unknown>
): Promise<T & { status: string; apiVersion?: string; message?: string }> {
  const res = await fetch(gasUrl.trim(), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`通信エラーが発生しました（HTTP ${res.status}）。`);
  }

  const json = (await res.json()) as T & {
    status: string;
    apiVersion?: string;
    message?: string;
  };

  if (!json.apiVersion) {
    throw new Error(
      'APIバージョン情報が取得できません。正しいGAS WebアプリURLか確認してください。'
    );
  }
  if (!isCompatibleApiVersion(json.apiVersion, REQUIRED_API_VERSION)) {
    throw new Error(
      `GASのバージョンが一致しません（アプリ要求: v${REQUIRED_API_VERSION} / 接続先GAS: v${json.apiVersion}）。GASコードの更新をお願いします。`
    );
  }
  if (json.status !== 'ok') {
    throw new Error(json.message || 'GAS側でエラーが発生しました。');
  }

  return json;
}

// Local Browser Persistence Datastore (used when Google Sheets is unavailable)
function readLocalDb(): InitialDataPayload {
  try {
    const raw = localStorage.getItem(LS_LOCAL_DB);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<InitialDataPayload>;
      const settings =
        Array.isArray(parsed.settings) && parsed.settings.length > 0
          ? parsed.settings
          : ruleConfigToSettingsRows(DEFAULT_RULE_CONFIG);
      return {
        players: Array.isArray(parsed.players) ? parsed.players : [],
        daily_records: Array.isArray(parsed.daily_records)
          ? parsed.daily_records
          : [],
        game_details: Array.isArray(parsed.game_details)
          ? parsed.game_details
          : [],
        settings,
      };
    }
  } catch {
    // Fall through to clean initial state
  }
  const initial: InitialDataPayload = {
    players: [],
    daily_records: [],
    game_details: [],
    settings: ruleConfigToSettingsRows(DEFAULT_RULE_CONFIG),
  };
  localStorage.setItem(LS_LOCAL_DB, JSON.stringify(initial));
  return initial;
}

function writeLocalDb(db: InitialDataPayload): void {
  localStorage.setItem(LS_LOCAL_DB, JSON.stringify(db));
}

export async function testGasConnection(
  gasUrl: string
): Promise<{ apiVersion: string }> {
  const check = validateGasUrl(gasUrl);
  if (!check.valid) {
    throw new Error(check.message);
  }
  const res = await postGas<{ status: string }>(gasUrl, {
    action: 'testConnection',
  });
  return { apiVersion: res.apiVersion ?? REQUIRED_API_VERSION };
}

export async function fetchInitialData(
  mode: StorageMode,
  gasUrl: string
): Promise<InitialDataPayload> {
  if (mode === 'local') {
    const db = readLocalDb();
    // Ensure missing/invalid settings fallback
    const config = parseSettingsRowsToRuleConfig(db.settings);
    return {
      ...db,
      settings: ruleConfigToSettingsRows(config),
    };
  }
  const res = await postGas<InitialDataPayload>(gasUrl, {
    action: 'getInitialData',
  });
  const config = parseSettingsRowsToRuleConfig(res.settings ?? []);
  return {
    players: res.players ?? [],
    daily_records: res.daily_records ?? [],
    game_details: res.game_details ?? [],
    settings: ruleConfigToSettingsRows(config),
  };
}

export async function saveSettingsApi(
  mode: StorageMode,
  gasUrl: string,
  settings: SettingRow[]
): Promise<SettingRow[]> {
  if (mode === 'local') {
    const db = readLocalDb();
    const now = getNowTimestamp();
    const updated = settings.map((s) => ({ ...s, updated_at: now }));
    db.settings = updated;
    writeLocalDb(db);
    return updated;
  }
  const res = await postGas<{ settings: SettingRow[] }>(gasUrl, {
    action: 'saveSettings',
    settings: settings.map((s) => ({
      setting_key: s.setting_key,
      setting_value: s.setting_value,
    })),
  });
  return res.settings;
}

export async function savePlayersApi(
  mode: StorageMode,
  gasUrl: string,
  playersPayload: { player_id: string; name: string; is_active: boolean }[]
): Promise<Player[]> {
  if (mode === 'local') {
    const db = readLocalDb();
    const now = getNowTimestamp();
    const map = new Map(db.players.map((p) => [p.player_id, { ...p }]));

    let maxNum = db.players.reduce((max, p) => {
      const m = /^P(\d+)$/.exec(p.player_id);
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0);

    for (const item of playersPayload) {
      if (!item.player_id) {
        maxNum += 1;
        const newId = `P${String(maxNum).padStart(3, '0')}`;
        map.set(newId, {
          player_id: newId,
          name: item.name,
          is_active: item.is_active,
          created_at: now,
        });
      } else {
        const existing = map.get(item.player_id);
        if (existing) {
          existing.name = item.name;
          existing.is_active = item.is_active;
        }
      }
    }
    const nextPlayers = Array.from(map.values());
    db.players = nextPlayers;
    writeLocalDb(db);
    return nextPlayers;
  }

  const res = await postGas<{ players: Player[] }>(gasUrl, {
    action: 'savePlayers',
    players: playersPayload,
  });
  return res.players;
}

export async function saveSessionApi(
  mode: StorageMode,
  gasUrl: string,
  payload: {
    session_id: string;
    daily_records: DailyRecord[];
    game_details: GameDetail[];
  }
): Promise<{ skipped: boolean }> {
  const filteredDaily = payload.daily_records.filter(
    (r) => !(r.game_count === 0 && r.chip_diff === 0)
  );
  if (mode === 'local') {
    const db = readLocalDb();
    const exists =
      db.daily_records.some((r) => r.session_id === payload.session_id) ||
      db.game_details.some((g) => g.session_id === payload.session_id);
    if (exists) {
      return { skipped: true };
    }
    db.daily_records.push(...filteredDaily);
    db.game_details.push(...payload.game_details);
    writeLocalDb(db);
    return { skipped: false };
  }

  const res = await postGas<{ skipped?: boolean }>(gasUrl, {
    action: 'saveSession',
    session_id: payload.session_id,
    daily_records: filteredDaily,
    game_details: payload.game_details,
  });
  return { skipped: Boolean(res.skipped) };
}

export async function updateSessionApi(
  mode: StorageMode,
  gasUrl: string,
  payload: {
    session_id: string;
    daily_records: DailyRecord[];
    game_details: GameDetail[];
  }
): Promise<void> {
  const filteredDaily = payload.daily_records.filter(
    (r) => !(r.game_count === 0 && r.chip_diff === 0)
  );
  if (mode === 'local') {
    const db = readLocalDb();
    db.daily_records = db.daily_records.filter(
      (r) => r.session_id !== payload.session_id
    );
    db.game_details = db.game_details.filter(
      (g) => g.session_id !== payload.session_id
    );
    db.daily_records.push(...filteredDaily);
    db.game_details.push(...payload.game_details);
    writeLocalDb(db);
    return;
  }

  await postGas(gasUrl, {
    action: 'updateSession',
    session_id: payload.session_id,
    daily_records: filteredDaily,
    game_details: payload.game_details,
  });
}

export async function deleteSessionApi(
  mode: StorageMode,
  gasUrl: string,
  sessionId: string
): Promise<void> {
  if (mode === 'local') {
    const db = readLocalDb();
    db.daily_records = db.daily_records.filter(
      (r) => r.session_id !== sessionId
    );
    db.game_details = db.game_details.filter((g) => g.session_id !== sessionId);
    writeLocalDb(db);
    return;
  }

  await postGas(gasUrl, {
    action: 'deleteSession',
    session_id: sessionId,
  });
}
