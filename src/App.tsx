import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Settings2 } from 'lucide-react';
import { ConnectionView } from './components/ConnectionView';
import { HistoryView } from './components/HistoryView';
import { PlayersView } from './components/PlayersView';
import { RuleSettingsView } from './components/RuleSettingsView';
import { ScoreboardView } from './components/ScoreboardView';
import { SessionSetupView } from './components/SessionSetupView';
import { TopView } from './components/TopView';
import {
  applyQueryGasUrlOnStartup,
  clearEditSessionDraft,
  clearNewSessionDraft,
  deleteSessionApi,
  fetchInitialData,
  getEditSessionDraft,
  getNewSessionDraft,
  getSavedGasUrl,
  getStorageMode,
  saveEditSessionDraft,
  saveNewSessionDraft,
  savePlayersApi,
  saveSessionApi,
  saveSettingsApi,
  setSavedGasUrl,
  setStorageMode,
  updateSessionApi,
} from './services/api';
import {
  AppView,
  DEFAULT_RULE_CONFIG,
  DailyRecord,
  GameDetail,
  Player,
  RuleConfig,
  SessionDraft,
  StorageMode,
} from './types/mahjong';
import {
  buildSessionSavePayload,
  parseSettingsRowsToRuleConfig,
  ruleConfigToSettingsRows,
} from './utils/mahjongCalc';

export default function App() {
  const [view, setView] = useState<AppView>('top');
  const [storageMode, setModeState] = useState<StorageMode | null>(null);
  const [gasUrl, setGasUrlState] = useState<string>('');

  const [players, setPlayers] = useState<Player[]>([]);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
  const [gameDetails, setGameDetails] = useState<GameDetail[]>([]);
  const [rules, setRules] = useState<RuleConfig>(DEFAULT_RULE_CONFIG);
  const [activeDraft, setActiveDraft] = useState<SessionDraft | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [queryNotice, setQueryNotice] = useState<string | null>(null);

  const loadData = useCallback(
    async (mode: StorageMode, url: string, restoreDraftOnLoad: boolean) => {
      setLoading(true);
      setBootError(null);
      try {
        const data = await fetchInitialData(mode, url);
        setPlayers(data.players);
        setDailyRecords(data.daily_records);
        setGameDetails(data.game_details);
        setRules(parseSettingsRowsToRuleConfig(data.settings));

        if (restoreDraftOnLoad) {
          const newDraft = getNewSessionDraft();
          if (newDraft) {
            setActiveDraft(newDraft);
            setView('scoreboard');
            return;
          }
          const editDraft = getEditSessionDraft();
          if (editDraft) {
            setActiveDraft(editDraft);
            setView('scoreboard');
            return;
          }
        }
        setView('top');
      } catch (err) {
        setBootError(
          err instanceof Error
            ? err.message
            : '初期データの読み込みに失敗しました。'
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const queryResult = applyQueryGasUrlOnStartup();
    if (queryResult.error) {
      setQueryNotice(queryResult.error);
    }
    const mode = getStorageMode();
    const savedUrl = getSavedGasUrl();
    setModeState(mode);
    setGasUrlState(savedUrl);

    if (!mode || (mode === 'gas' && !savedUrl)) {
      setLoading(false);
      setView('connection');
      return;
    }

    void loadData(mode, savedUrl, true);
  }, [loadData]);

  const handleSaveGasConnection = async (nextUrl: string) => {
    const prevUrl = getSavedGasUrl();
    if (prevUrl !== nextUrl) {
      clearNewSessionDraft();
      clearEditSessionDraft();
      setActiveDraft(null);
    }
    setSavedGasUrl(nextUrl);
    setGasUrlState(nextUrl);
    setModeState('gas');
    setQueryNotice(null);
    await loadData('gas', nextUrl, true);
  };

  const handleUseLocalMode = async () => {
    setStorageMode('local');
    setModeState('local');
    setQueryNotice(null);
    await loadData('local', '', true);
  };

  const handleSaveRules = async (nextRules: RuleConfig) => {
    if (!storageMode) return;
    const rows = ruleConfigToSettingsRows(nextRules);
    const savedRows = await saveSettingsApi(storageMode, gasUrl, rows);
    setRules(parseSettingsRowsToRuleConfig(savedRows));
    setView('top');
  };

  const handleSavePlayers = async (
    payload: { player_id: string; name: string; is_active: boolean }[]
  ) => {
    if (!storageMode) return;
    const updated = await savePlayersApi(storageMode, gasUrl, payload);
    setPlayers(updated);
  };

  const handleStartSession = (draft: SessionDraft) => {
    saveNewSessionDraft(draft);
    setActiveDraft(draft);
    setView('scoreboard');
  };

  const handleUpdateDraft = (nextDraft: SessionDraft) => {
    setActiveDraft(nextDraft);
    if (nextDraft.mode === 'edit') {
      saveEditSessionDraft(nextDraft);
    } else if (nextDraft.mode === 'new') {
      saveNewSessionDraft(nextDraft);
    }
  };

  const handleFinalizeSession = async (draft: SessionDraft) => {
    if (!storageMode) return;
    const payload = buildSessionSavePayload(draft, players);
    if (draft.mode === 'edit') {
      await updateSessionApi(storageMode, gasUrl, payload);
      clearEditSessionDraft();
    } else {
      await saveSessionApi(storageMode, gasUrl, payload);
      clearNewSessionDraft();
    }
    const refreshed = await fetchInitialData(storageMode, gasUrl);
    setPlayers(refreshed.players);
    setDailyRecords(refreshed.daily_records);
    setGameDetails(refreshed.game_details);
    setRules(parseSettingsRowsToRuleConfig(refreshed.settings));
    setActiveDraft(null);
    setView(draft.mode === 'edit' ? 'history' : 'top');
  };

  const handleDiscardDraft = () => {
    if (activeDraft?.mode === 'edit') {
      clearEditSessionDraft();
      setActiveDraft(null);
      setView('history');
    } else {
      clearNewSessionDraft();
      setActiveDraft(null);
      setView('top');
    }
  };

  const handleViewHistorySession = (viewDraft: SessionDraft) => {
    setActiveDraft(viewDraft);
    setView('scoreboard');
  };

  const handleEnterEditMode = () => {
    if (!activeDraft || activeDraft.mode !== 'view') return;
    const editDraft: SessionDraft = {
      ...activeDraft,
      mode: 'edit',
    };
    saveEditSessionDraft(editDraft);
    setActiveDraft(editDraft);
  };

  const handleBackFromView = () => {
    setActiveDraft(null);
    setView('history');
  };

  const handleDeleteHistorySession = async (sessionId: string) => {
    if (!storageMode) return;
    await deleteSessionApi(storageMode, gasUrl, sessionId);
    clearEditSessionDraft();
    const refreshed = await fetchInitialData(storageMode, gasUrl);
    setPlayers(refreshed.players);
    setDailyRecords(refreshed.daily_records);
    setGameDetails(refreshed.game_details);
    setRules(parseSettingsRowsToRuleConfig(refreshed.settings));
    setActiveDraft(null);
    setView('history');
  };

  const activePlayerCount = useMemo(
    () => players.filter((p) => p.is_active).length,
    [players]
  );

  const sessionCount = useMemo(
    () => new Set(dailyRecords.map((r) => r.session_id)).size,
    [dailyRecords]
  );

  const isLockedTableLayout = view === 'scoreboard' || view === 'history';

  return (
    <div className="app-shell">
      {/* Sticky App Header */}
      <header className="app-header">
        <div className="app-header-inner">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-base sm:text-lg font-bold tracking-tight truncate">
              麻雀成績管理
            </h1>
            {storageMode && (
              <span
                className="text-xs font-medium whitespace-nowrap"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {storageMode === 'gas' ? 'GAS連携' : 'ブラウザ保存'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {storageMode && view === 'top' && (
              <button
                type="button"
                className="btn btn-ghost px-3 text-xs"
                onClick={() => void loadData(storageMode, gasUrl, false)}
                disabled={loading}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                <span>再読込</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className={isLockedTableLayout ? 'app-main-locked' : 'app-main'}>
        {queryNotice && view === 'connection' && (
          <div
            className="mb-4 rounded-xl border p-3.5 text-sm font-medium"
            style={{
              backgroundColor: 'var(--color-danger-soft)',
              borderColor: '#fecaca',
              color: 'var(--color-danger)',
            }}
          >
            URLパラメータのGAS URLが不正なため反映できませんでした: {queryNotice}
          </div>
        )}

        {loading ? (
          <div className="surface-card p-10 text-center flex flex-col items-center justify-center gap-3 my-auto">
            <RefreshCw
              size={24}
              className="animate-spin"
              style={{ color: 'var(--color-accent)' }}
            />
            <p
              className="text-sm font-semibold"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              データを読み込んでいます...
            </p>
          </div>
        ) : bootError ? (
          <div className="surface-card p-6 max-w-lg mx-auto my-8">
            <h2
              className="text-lg font-bold"
              style={{ color: 'var(--color-danger)' }}
            >
              データの読み込みに失敗しました
            </h2>
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {bootError}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {storageMode && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void loadData(storageMode, gasUrl, true)}
                >
                  <RefreshCw size={16} />
                  <span>再試行</span>
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setBootError(null);
                  setView('connection');
                }}
              >
                <Settings2 size={16} />
                <span>接続設定を開く</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {view === 'connection' && (
              <ConnectionView
                initialGasUrl={gasUrl}
                currentMode={storageMode}
                hasBack={Boolean(storageMode)}
                onBack={() => setView('top')}
                onSaveGas={handleSaveGasConnection}
                onUseLocalMode={handleUseLocalMode}
              />
            )}

            {view === 'top' && storageMode && (
              <TopView
                rules={rules}
                activePlayerCount={activePlayerCount}
                sessionCount={sessionCount}
                storageMode={storageMode}
                onNavigate={(nextView) => setView(nextView)}
              />
            )}

            {view === 'rules' && (
              <RuleSettingsView
                initialRules={rules}
                onSave={handleSaveRules}
                onCancel={() => setView('top')}
              />
            )}

            {view === 'players' && (
              <PlayersView
                players={players}
                onSavePlayers={handleSavePlayers}
                onBack={() => setView('top')}
              />
            )}

            {view === 'setup' && (
              <SessionSetupView
                players={players}
                rules={rules}
                onStartSession={handleStartSession}
                onBack={() => setView('top')}
                onGoToPlayers={() => setView('players')}
              />
            )}

            {view === 'scoreboard' && activeDraft && (
              <ScoreboardView
                draft={activeDraft}
                players={players}
                onUpdateDraft={handleUpdateDraft}
                onEnterEditMode={handleEnterEditMode}
                onBackFromView={handleBackFromView}
                onFinalizeSession={handleFinalizeSession}
                onDeleteSession={handleDeleteHistorySession}
                onDiscardDraft={handleDiscardDraft}
              />
            )}

            {view === 'history' && (
              <HistoryView
                players={players}
                dailyRecords={dailyRecords}
                gameDetails={gameDetails}
                currentRules={rules}
                onViewSession={handleViewHistorySession}
                onBack={() => setView('top')}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
