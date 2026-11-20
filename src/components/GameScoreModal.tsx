import React, { useMemo, useState } from 'react';
import { ArrowLeft, Calculator, Check, Delete, Trash2, X } from 'lucide-react';
import {
  DraftGame,
  GameDetail,
  Player,
  RuleConfig,
  WINDS,
  Wind,
} from '../types/mahjong';
import {
  calculateGameDetails,
  formatNumber,
  formatPoint,
  getTobiBustedPoint,
  getTobiFlyerPoint,
  getYakitoriPoints,
} from '../utils/mahjongCalc';
import { ConfirmModal } from './ConfirmModal';

interface GameScoreModalProps {
  open: boolean;
  sessionId: string;
  date: string;
  gameNumber: number;
  participants: Player[];
  rules: RuleConfig;
  initialGame: DraftGame | null;
  onSave: (details: GameDetail[]) => void;
  onDelete?: () => void;
  onClose: () => void;
}

interface SeatState {
  player_id: string;
  wind: Wind;
  scoreText: string;
}

function buildInitialSeats(
  participants: Player[],
  initialGame: DraftGame | null
): SeatState[] {
  if (initialGame && initialGame.details.length === 4) {
    const ordered = [...initialGame.details].sort(
      (a, b) => WINDS.indexOf(a.wind) - WINDS.indexOf(b.wind)
    );
    return ordered.map((d) => ({
      player_id: d.player_id,
      wind: d.wind,
      scoreText: String(d.raw_score),
    }));
  }
  const firstFour = participants.slice(0, 4);
  return WINDS.map((wind, idx) => ({
    player_id: firstFour[idx]?.player_id ?? '',
    wind,
    scoreText: '',
  }));
}

export const GameScoreModal: React.FC<GameScoreModalProps> = ({
  open,
  sessionId,
  date,
  gameNumber,
  participants,
  rules,
  initialGame,
  onSave,
  onDelete,
  onClose,
}) => {
  const [seats, setSeats] = useState<SeatState[]>(() =>
    buildInitialSeats(participants, initialGame)
  );
  const [activeSeatIndex, setActiveSeatIndex] = useState<number>(0);
  const tobiBustedPt = getTobiBustedPoint(rules);
  const tobiFlyerPt = getTobiFlyerPoint(rules);

  const [tobiEnabled, setTobiEnabled] = useState<boolean>(() => {
    if (!initialGame) return false;
    return initialGame.details.some((d) => d.is_tobi || d.tobi_count > 0);
  });
  const [flyerId, setFlyerId] = useState<string>(() => {
    if (!initialGame) return '';
    return initialGame.details.find((d) => d.tobi_count > 0)?.player_id ?? '';
  });
  const [bustedIds, setBustedIds] = useState<string[]>(() => {
    if (!initialGame) return [];
    return initialGame.details
      .filter((d) => d.is_tobi)
      .map((d) => d.player_id);
  });

  const [yakitoriIds, setYakitoriIds] = useState<string[]>(() => {
    if (!initialGame) return [];
    return initialGame.details
      .filter((d) => d.is_yakitori)
      .map((d) => d.player_id);
  });

  const [error, setError] = useState<string | null>(null);
  const [confirmPreviewDetails, setConfirmPreviewDetails] = useState<
    GameDetail[] | null
  >(null);
  const [confirmSumPayload, setConfirmSumPayload] = useState<{
    details: GameDetail[];
    sum: number;
    expected: number;
  } | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const participantMap = useMemo(
    () => new Map(participants.map((p) => [p.player_id, p])),
    [participants]
  );

  const expectedSum = Number(rules.starting_points) * 4;

  // Toggle participant in/out when >4 participants
  const selectedPlayerIds = seats.map((s) => s.player_id);

  const handleToggleGameParticipant = (playerId: string) => {
    setError(null);
    const existingIdx = seats.findIndex((s) => s.player_id === playerId);
    if (existingIdx !== -1) {
      // Clear that seat's player_id
      setSeats((prev) =>
        prev.map((s, idx) =>
          idx === existingIdx ? { ...s, player_id: '' } : s
        )
      );
      if (flyerId === playerId) setFlyerId('');
      setBustedIds((prev) => prev.filter((id) => id !== playerId));
      setYakitoriIds((prev) => prev.filter((id) => id !== playerId));
      setActiveSeatIndex(existingIdx);
    } else {
      const emptyIdx = seats.findIndex((s) => !s.player_id);
      if (emptyIdx === -1) {
        setError('4名すでに選択されています。外したい対局者をタップしてから選択してください。');
        return;
      }
      setSeats((prev) =>
        prev.map((s, idx) =>
          idx === emptyIdx ? { ...s, player_id: playerId } : s
        )
      );
      setActiveSeatIndex(emptyIdx);
    }
  };

  const handleChangeWind = (seatIdx: number, nextWind: Wind) => {
    setError(null);
    setSeats((prev) => {
      const currentWind = prev[seatIdx].wind;
      if (currentWind === nextWind) return prev;
      return prev.map((s, idx) => {
        if (idx === seatIdx) return { ...s, wind: nextWind };
        if (s.wind === nextWind) return { ...s, wind: currentWind };
        return s;
      });
    });
  };

  // Custom Numpad Handlers
  const updateActiveScore = (updater: (cur: string) => string) => {
    setError(null);
    setSeats((prev) =>
      prev.map((s, idx) =>
        idx === activeSeatIndex ? { ...s, scoreText: updater(s.scoreText) } : s
      )
    );
  };

  const handleDigit = (digits: string) => {
    updateActiveScore((cur) => {
      if (cur === '' || cur === '0') {
        if (digits === '00' || digits === '0') return '0';
        return digits;
      }
      if (cur === '-0') {
        if (digits === '00' || digits === '0') return '-0';
        return `-${digits}`;
      }
      if (cur.replace('-', '').length >= 7) return cur;
      return `${cur}${digits}`;
    });
  };

  const handleBackspace = () => {
    updateActiveScore((cur) => {
      if (cur.length <= 1) return '';
      if (cur === '-0' || (cur.startsWith('-') && cur.length === 2)) return '';
      return cur.slice(0, -1);
    });
  };

  const handleClearScore = () => {
    updateActiveScore(() => '');
  };

  const handleToggleSign = () => {
    updateActiveScore((cur) => {
      if (cur === '') return '-';
      if (cur === '-') return '';
      if (cur.startsWith('-')) return cur.slice(1);
      return `-${cur}`;
    });
  };

  const parsedScores = seats.map((s) =>
    /^-?\d+$/.test(s.scoreText) ? Number(s.scoreText) : null
  );
  const emptyIndices = parsedScores
    .map((val, idx) => (val === null ? idx : -1))
    .filter((idx) => idx !== -1);
  const canAutoCalcRemaining = emptyIndices.length === 1;

  const handleAutoCalcRemaining = () => {
    if (!canAutoCalcRemaining) return;
    setError(null);
    const targetIdx = emptyIndices[0];
    const sumOfThree = parsedScores.reduce<number>(
      (acc, val) => acc + (val ?? 0),
      0
    );
    const remaining = expectedSum - sumOfThree;
    setSeats((prev) =>
      prev.map((s, idx) =>
        idx === targetIdx ? { ...s, scoreText: String(remaining) } : s
      )
    );
    setActiveSeatIndex(targetIdx);
  };

  // Live preview of ranks & points when all 4 players & scores are valid
  const previewByPlayer = useMemo(() => {
    const allPlayersOk =
      seats.every((s) => Boolean(s.player_id)) &&
      new Set(seats.map((s) => s.player_id)).size === 4;
    const allScoresOk = parsedScores.every((n) => n !== null);
    if (!allPlayersOk || !allScoresOk) return null;
    try {
      const details = calculateGameDetails({
        session_id: sessionId,
        date,
        game_number: gameNumber,
        entries: seats.map((s, idx) => ({
          player_id: s.player_id,
          player_name: participantMap.get(s.player_id)?.name ?? s.player_id,
          wind: s.wind,
          raw_score: parsedScores[idx] as number,
        })),
        rules,
        tobi: {
          enabled: tobiEnabled,
          flyer_id: flyerId || null,
          busted_ids: bustedIds,
        },
        yakitori_ids: yakitoriIds,
      });
      return new Map(details.map((d) => [d.player_id, d]));
    } catch {
      return null;
    }
  }, [
    seats,
    parsedScores,
    sessionId,
    date,
    gameNumber,
    participantMap,
    rules,
    tobiEnabled,
    flyerId,
    bustedIds,
    yakitoriIds,
  ]);

  const currentScoreSum = parsedScores.reduce<number>(
    (acc, val) => acc + (val ?? 0),
    0
  );
  const allScoresEntered = parsedScores.every((n) => n !== null);

  const handleSubmit = () => {
    setError(null);

    if (seats.some((s) => !s.player_id)) {
      setError('この試合の出場者4名をすべて選択してください。');
      return;
    }
    if (new Set(seats.map((s) => s.player_id)).size !== 4) {
      setError('同じ対局者が重複しています。4名の異なる対局者を選択してください。');
      return;
    }
    if (new Set(seats.map((s) => s.wind)).size !== 4) {
      setError('席風（東・南・西・北）が重複しないように設定してください。');
      return;
    }
    if (!allScoresEntered) {
      setError('4名全員の素点を入力してください。');
      return;
    }

    if (rules.use_tobi === 'true' && tobiEnabled) {
      if (!flyerId) {
        setError('トビありの場合は「飛ばした人」を選択してください。');
        return;
      }
      if (bustedIds.length === 0) {
        setError('トビありの場合は「飛んだ人」を1〜3名選択してください。');
        return;
      }
      if (bustedIds.includes(flyerId)) {
        setError('飛ばした人と飛んだ人に同じ対局者は選択できません。');
        return;
      }
    }

    const details = calculateGameDetails({
      session_id: sessionId,
      date,
      game_number: gameNumber,
      entries: seats.map((s, idx) => ({
        player_id: s.player_id,
        player_name: participantMap.get(s.player_id)?.name ?? s.player_id,
        wind: s.wind,
        raw_score: parsedScores[idx] as number,
      })),
      rules,
      tobi: {
        enabled: tobiEnabled,
        flyer_id: flyerId || null,
        busted_ids: bustedIds,
      },
      yakitori_ids: yakitoriIds,
    });

    setConfirmPreviewDetails(details);
  };

  const handleConfirmPreview = () => {
    if (!confirmPreviewDetails) return;
    if (currentScoreSum !== expectedSum) {
      setConfirmSumPayload({
        details: confirmPreviewDetails,
        sum: currentScoreSum,
        expected: expectedSum,
      });
      return;
    }
    onSave(confirmPreviewDetails);
  };

  if (!open) return null;

  const activeSeatPlayers = seats
    .filter((s) => Boolean(s.player_id))
    .map((s) => ({
      player_id: s.player_id,
      name: participantMap.get(s.player_id)?.name ?? s.player_id,
      wind: s.wind,
    }));

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center sm:p-4"
      style={{ backgroundColor: 'rgba(26, 27, 25, 0.5)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-score-modal-title"
    >
      <div
        className="surface-card w-full max-w-2xl max-h-[94dvh] flex flex-col overflow-hidden rounded-b-none sm:rounded-b-2xl shadow-2xl"
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
        {/* Header */}
        <div
          className="px-5 py-3.5 border-b flex items-center justify-between gap-3 shrink-0"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div>
            <h3 id="game-score-modal-title" className="text-lg font-bold">
              {rules.game_type === 'hanchan' ? '半荘' : '東風'} 第{gameNumber}戦{' '}
              {confirmPreviewDetails
                ? '入力内容の確認'
                : initialGame
                  ? '編集'
                  : '入力'}
            </h3>
            <p
              className="text-xs tabular-nums"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {confirmPreviewDetails ? (
                <>1位〜4位の順位と入力内容を確認してください</>
              ) : (
                <>
                  基準合計 {formatNumber(expectedSum)}点
                  {allScoresEntered && (
                    <>
                      {' · '}現在合計 {formatNumber(currentScoreSum)}点
                      {currentScoreSum !== expectedSum
                        ? `（差 ${formatPoint(currentScoreSum - expectedSum)}）`
                        : '（一致）'}
                    </>
                  )}
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            aria-label="閉じる"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {confirmPreviewDetails ? (
            <>
              {/* Summary Bar */}
              <div
                className="surface-card px-4 py-3 flex flex-wrap items-center justify-between gap-2"
                style={{
                  backgroundColor:
                    currentScoreSum === expectedSum
                      ? 'var(--color-accent-soft)'
                      : 'var(--color-warning-soft)',
                  borderColor:
                    currentScoreSum === expectedSum
                      ? 'var(--color-accent)'
                      : '#eab308',
                }}
              >
                <div className="text-sm font-bold tabular-nums">
                  素点合計：{formatNumber(currentScoreSum)}点
                </div>
                <div
                  className="text-xs font-semibold tabular-nums"
                  style={{
                    color:
                      currentScoreSum === expectedSum
                        ? 'var(--color-accent)'
                        : 'var(--color-warning)',
                  }}
                >
                  {currentScoreSum === expectedSum
                    ? `基準合計（${formatNumber(expectedSum)}点）と一致`
                    : `基準合計（${formatNumber(expectedSum)}点）と ${formatNumber(
                        Math.abs(currentScoreSum - expectedSum)
                      )}点差（${formatPoint(currentScoreSum - expectedSum)}）`}
                </div>
              </div>

              {/* Ranked 1st -> 4th Confirmation Cards */}
              {(() => {
                const hasSpecialCols =
                  rules.use_tobi === 'true' || rules.use_yakitori === 'true';
                const previewYakitoriCount = confirmPreviewDetails.filter(
                  (d) => d.is_yakitori
                ).length;
                const { penalty: yakitoriPenalty, bonus: yakitoriBonus } =
                  rules.use_yakitori === 'true'
                    ? getYakitoriPoints(previewYakitoriCount)
                    : { penalty: 0, bonus: 0 };

                return (
                  <div className="surface-card overflow-hidden">
                    <div
                      className="hidden sm:grid items-center gap-3 px-4 py-2.5 text-xs font-bold border-b"
                      style={{
                        backgroundColor: 'var(--color-surface-subtle)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-secondary)',
                        gridTemplateColumns: 'minmax(0, 1fr) 118px minmax(0, 1fr)',
                      }}
                    >
                      <div
                        className="grid items-center gap-3.5"
                        style={{
                          gridTemplateColumns: '50px 42px minmax(0, 1fr)',
                        }}
                      >
                        <span className="text-center">順位</span>
                        <span className="text-center">方角</span>
                        <span>対局者</span>
                      </div>
                      <span className="text-right">素点</span>
                      <div
                        className="grid items-center gap-3"
                        style={{
                          gridTemplateColumns: hasSpecialCols
                            ? 'minmax(0, 1fr) 68px'
                            : 'minmax(0, 1fr)',
                        }}
                      >
                        {hasSpecialCols && (
                          <span className="text-center">
                            {[
                              rules.use_tobi === 'true' ? '飛び' : null,
                              rules.use_yakitori === 'true' ? '鳥' : null,
                            ]
                              .filter(Boolean)
                              .join('・')}
                          </span>
                        )}
                        <span className="text-right">結果pt</span>
                      </div>
                    </div>

                    <div
                      className="divide-y"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      {[...confirmPreviewDetails]
                        .sort((a, b) => a.rank - b.rank)
                        .map((detail) => {
                          const yakitoriPt =
                            rules.use_yakitori === 'true' &&
                            previewYakitoriCount >= 1 &&
                            previewYakitoriCount <= 3
                              ? detail.is_yakitori
                                ? yakitoriPenalty
                                : yakitoriBonus
                              : 0;
                          const hasTobiBadge =
                            rules.use_tobi === 'true' &&
                            (detail.tobi_count > 0 || detail.is_tobi);
                          const hasYakitoriBadge =
                            rules.use_yakitori === 'true' &&
                            (detail.is_yakitori || yakitoriPt > 0);
                          const ptColor =
                            detail.final_point > 0
                              ? 'var(--color-positive)'
                              : detail.final_point < 0
                                ? 'var(--color-negative)'
                                : 'var(--color-text-secondary)';

                          return (
                            <div
                              key={detail.player_id}
                              className="flex flex-col gap-2 px-4 py-3 sm:grid sm:items-center sm:gap-3"
                              style={{
                                borderColor: 'var(--color-border)',
                                backgroundColor:
                                  detail.rank === 1
                                    ? 'rgba(22, 101, 52, 0.04)'
                                    : 'var(--color-surface)',
                                gridTemplateColumns:
                                  'minmax(0, 1fr) 118px minmax(0, 1fr)',
                              }}
                            >
                              {/* Left: Rank + Wind + Name (+ Raw Score on <640px) */}
                              <div className="flex items-center justify-between gap-3 min-w-0 sm:contents">
                                <div
                                  className="flex items-center gap-3 min-w-0 flex-1 sm:grid sm:items-center sm:gap-3.5"
                                  style={{
                                    gridTemplateColumns:
                                      '50px 42px minmax(0, 1fr)',
                                  }}
                                >
                                  {/* Rank */}
                                  <div className="flex justify-center shrink-0">
                                    <span
                                      className="inline-flex items-center justify-center w-11 h-8 rounded-lg text-sm font-extrabold tabular-nums"
                                      style={{
                                        backgroundColor:
                                          detail.rank === 1
                                            ? 'var(--color-accent)'
                                            : 'var(--color-surface-subtle)',
                                        color:
                                          detail.rank === 1
                                            ? '#ffffff'
                                            : 'var(--color-text)',
                                      }}
                                    >
                                      {detail.rank}位
                                    </span>
                                  </div>

                                  {/* Wind */}
                                  <div className="flex justify-center shrink-0">
                                    <span
                                      className="inline-flex items-center justify-center w-9 h-8 rounded-lg border text-sm font-bold"
                                      style={{
                                        backgroundColor: 'var(--color-surface)',
                                        borderColor:
                                          'var(--color-border-strong)',
                                        color: 'var(--color-text)',
                                      }}
                                    >
                                      {detail.wind}
                                    </span>
                                  </div>

                                  {/* Player Name */}
                                  <div className="min-w-0 font-bold text-[15px] truncate">
                                    {detail.player_name}
                                  </div>
                                </div>

                                {/* Center: Raw Score */}
                                <div
                                  className="text-right font-bold text-base tabular-nums whitespace-nowrap shrink-0 min-w-[84px] sm:min-w-0"
                                  style={{
                                    color:
                                      detail.raw_score < 0
                                        ? 'var(--color-negative)'
                                        : 'var(--color-text)',
                                  }}
                                >
                                  {formatNumber(detail.raw_score)}
                                  <span
                                    className="text-xs font-normal ml-0.5"
                                    style={{
                                      color:
                                        detail.raw_score < 0
                                          ? 'var(--color-negative)'
                                          : 'var(--color-text-muted)',
                                    }}
                                  >
                                    点
                                  </span>
                                </div>
                              </div>

                              {/* Right: Tobi & Yakitori + Final Point */}
                              <div
                                className="flex items-center justify-between gap-3 pl-[104px] sm:pl-0 sm:grid sm:items-center sm:gap-3"
                                style={{
                                  gridTemplateColumns: hasSpecialCols
                                    ? 'minmax(0, 1fr) 68px'
                                    : 'minmax(0, 1fr)',
                                }}
                              >
                                {hasSpecialCols && (
                                  <div className="flex flex-wrap items-center sm:justify-center gap-1.5">
                                    {rules.use_tobi === 'true' &&
                                      detail.tobi_count > 0 && (
                                        <span
                                          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md border text-xs font-extrabold tabular-nums whitespace-nowrap"
                                          style={{
                                            backgroundColor:
                                              'var(--color-accent-soft)',
                                            borderColor: '#bbf7d0',
                                            color: 'var(--color-positive)',
                                          }}
                                          title={`飛ばした人数: ${detail.tobi_count}人`}
                                        >
                                          <span>飛</span>
                                          <span>
                                            {formatPoint(
                                              tobiFlyerPt * detail.tobi_count
                                            )}
                                          </span>
                                        </span>
                                      )}
                                    {rules.use_tobi === 'true' &&
                                      detail.is_tobi && (
                                        <span
                                          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md border text-xs font-extrabold tabular-nums whitespace-nowrap"
                                          style={{
                                            backgroundColor:
                                              'var(--color-danger-soft)',
                                            borderColor: '#fecaca',
                                            color: 'var(--color-negative)',
                                          }}
                                          title="飛ばされた"
                                        >
                                          <span>飛</span>
                                          <span>{tobiBustedPt}</span>
                                        </span>
                                      )}
                                    {rules.use_yakitori === 'true' &&
                                      detail.is_yakitori && (
                                        <span
                                          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md border text-xs font-extrabold tabular-nums whitespace-nowrap"
                                          style={{
                                            backgroundColor:
                                              'var(--color-danger-soft)',
                                            borderColor: '#fecaca',
                                            color: 'var(--color-negative)',
                                          }}
                                          title="焼き鳥"
                                        >
                                          <span>鳥</span>
                                          <span>{formatPoint(yakitoriPt)}</span>
                                        </span>
                                      )}
                                    {rules.use_yakitori === 'true' &&
                                      !detail.is_yakitori &&
                                      yakitoriPt > 0 && (
                                        <span
                                          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md border text-xs font-extrabold tabular-nums whitespace-nowrap"
                                          style={{
                                            backgroundColor:
                                              'var(--color-accent-soft)',
                                            borderColor: '#bbf7d0',
                                            color: 'var(--color-positive)',
                                          }}
                                          title="焼き鳥受取"
                                        >
                                          <span>鳥</span>
                                          <span>{formatPoint(yakitoriPt)}</span>
                                        </span>
                                      )}
                                    {!hasTobiBadge && !hasYakitoriBadge && (
                                      <span
                                        className="text-xs"
                                        style={{
                                          color: 'var(--color-text-muted)',
                                        }}
                                      >
                                        ー
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Final Point */}
                                <div
                                  className="text-right font-extrabold text-base tabular-nums whitespace-nowrap ml-auto sm:ml-0"
                                  style={{ color: ptColor }}
                                >
                                  {formatPoint(detail.final_point)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            <>
          {/* 4-player chooser when session has 5+ participants */}
          {participants.length > 4 && (
            <section className="surface-card p-3.5">
              <div
                className="text-xs font-bold mb-2"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                この試合の出場者（4名選択 ·{' '}
                {selectedPlayerIds.filter(Boolean).length}/4名）
              </div>
              <div className="flex flex-wrap gap-2">
                {participants.map((p) => {
                  const selected = selectedPlayerIds.includes(p.player_id);
                  return (
                    <button
                      key={p.player_id}
                      type="button"
                      onClick={() => handleToggleGameParticipant(p.player_id)}
                      className="px-3 py-2 rounded-lg border text-sm font-semibold flex items-center gap-1.5 cursor-pointer"
                      style={{
                        minHeight: '44px',
                        backgroundColor: selected
                          ? 'var(--color-accent-soft)'
                          : 'var(--color-surface)',
                        borderColor: selected
                          ? 'var(--color-accent)'
                          : 'var(--color-border-strong)',
                        color: selected
                          ? 'var(--color-accent)'
                          : 'var(--color-text)',
                      }}
                    >
                      <span>{p.name}</span>
                      {selected && <Check size={14} />}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* 4 Seat Score Rows */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {seats.map((seat, idx) => {
              const isActive = idx === activeSeatIndex;
              const player = participantMap.get(seat.player_id);
              const preview = seat.player_id
                ? previewByPlayer?.get(seat.player_id)
                : undefined;
              const numericVal = /^-?\d+$/.test(seat.scoreText)
                ? Number(seat.scoreText)
                : null;

              return (
                <div
                  key={idx}
                  className="surface-card p-3 flex items-center justify-between gap-2 transition-colors"
                  style={{
                    borderColor: isActive
                      ? 'var(--color-accent)'
                      : 'var(--color-border)',
                    backgroundColor: isActive
                      ? '#f8fcf9'
                      : 'var(--color-surface)',
                    boxShadow: isActive
                      ? '0 0 0 1px var(--color-accent)'
                      : 'none',
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <select
                      aria-label={`座席${idx + 1}の風`}
                      value={seat.wind}
                      onChange={(e) =>
                        handleChangeWind(idx, e.target.value as Wind)
                      }
                      className="rounded-lg border font-bold text-sm px-2 text-center shrink-0"
                      style={{
                        minHeight: '44px',
                        minWidth: '48px',
                        borderColor: 'var(--color-border-strong)',
                        backgroundColor: 'var(--color-surface-subtle)',
                      }}
                    >
                      {WINDS.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">
                        {player ? player.name : '未選択'}
                      </div>
                      {preview && (
                        <div
                          className="text-xs tabular-nums font-semibold"
                          style={{
                            color:
                              preview.final_point > 0
                                ? 'var(--color-positive)'
                                : preview.final_point < 0
                                  ? 'var(--color-negative)'
                                  : 'var(--color-text-secondary)',
                          }}
                        >
                          {preview.rank}着 · {formatPoint(preview.final_point)}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveSeatIndex(idx)}
                    className="px-3 py-2 rounded-lg border text-right tabular-nums font-bold text-base min-w-[110px] shrink-0 cursor-pointer"
                    style={{
                      minHeight: '44px',
                      borderColor: isActive
                        ? 'var(--color-accent)'
                        : 'var(--color-border-strong)',
                      backgroundColor: isActive
                        ? 'var(--color-surface)'
                        : 'var(--color-surface-subtle)',
                      color:
                        seat.scoreText === ''
                          ? 'var(--color-text-muted)'
                          : 'var(--color-text)',
                    }}
                  >
                    {seat.scoreText === ''
                      ? '素点入力'
                      : numericVal !== null
                        ? formatNumber(numericVal)
                        : seat.scoreText}
                  </button>
                </div>
              );
            })}
          </section>

          {/* Custom Numeric Keypad (No OS keyboard popup) */}
          <section className="surface-card p-3">
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-xs font-bold"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                入力中: {seats[activeSeatIndex]?.wind}家{' '}
                {participantMap.get(seats[activeSeatIndex]?.player_id)?.name ??
                  '未選択'}
              </span>
              <span
                className="text-xs tabular-nums"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {seats[activeSeatIndex]?.scoreText || '未入力'}
              </span>
            </div>
            <div className="numpad-grid">
              {['7', '8', '9'].map((d) => (
                <button
                  key={d}
                  type="button"
                  className="numpad-key"
                  onClick={() => handleDigit(d)}
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                className="numpad-key numpad-key-action"
                aria-label="1文字削除"
                onClick={handleBackspace}
              >
                <Delete size={18} />
              </button>

              {['4', '5', '6'].map((d) => (
                <button
                  key={d}
                  type="button"
                  className="numpad-key"
                  onClick={() => handleDigit(d)}
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                className="numpad-key numpad-key-action"
                onClick={handleClearScore}
              >
                クリア
              </button>

              {['1', '2', '3'].map((d) => (
                <button
                  key={d}
                  type="button"
                  className="numpad-key"
                  onClick={() => handleDigit(d)}
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                className="numpad-key numpad-key-action"
                onClick={handleToggleSign}
              >
                +/-
              </button>

              <button
                type="button"
                className="numpad-key"
                onClick={() => handleDigit('0')}
              >
                0
              </button>
              <button
                type="button"
                className="numpad-key"
                onClick={() => handleDigit('00')}
              >
                00
              </button>
              <button
                type="button"
                className="numpad-key numpad-key-primary col-span-2 gap-1.5"
                disabled={!canAutoCalcRemaining}
                onClick={handleAutoCalcRemaining}
                style={{
                  opacity: canAutoCalcRemaining ? 1 : 0.45,
                  cursor: canAutoCalcRemaining ? 'pointer' : 'not-allowed',
                }}
              >
                <Calculator size={16} />
                <span>残り1人を自動計算</span>
              </button>
            </div>
          </section>

          {/* Tobi UI (Conditional) */}
          {rules.use_tobi === 'true' && (
            <section className="surface-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold">
                    トビ賞（{tobiBustedPt} / {formatPoint(tobiFlyerPt)}）
                  </div>
                    <div
                      className="text-xs tabular-nums"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      飛んだ人 {tobiBustedPt}pt / 飛ばした人 {formatPoint(tobiFlyerPt)}pt × 飛ばし人数
                    </div>
                  </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !tobiEnabled;
                    setTobiEnabled(next);
                    if (!next) {
                      setFlyerId('');
                      setBustedIds([]);
                    }
                  }}
                  className="btn"
                  style={{
                    backgroundColor: tobiEnabled
                      ? 'var(--color-accent-soft)'
                      : 'var(--color-surface-subtle)',
                    borderColor: tobiEnabled
                      ? 'var(--color-accent)'
                      : 'var(--color-border-strong)',
                    color: tobiEnabled
                      ? 'var(--color-accent)'
                      : 'var(--color-text-secondary)',
                  }}
                >
                  {tobiEnabled ? 'トビあり' : 'トビなし'}
                </button>
              </div>

              {tobiEnabled && (
                <div className="mt-4 flex flex-col gap-3">
                  <div>
                    <div
                      className="text-xs font-bold mb-1.5"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      飛ばした人（1名選択）
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {activeSeatPlayers.map((p) => {
                        const selected = flyerId === p.player_id;
                        return (
                          <button
                            key={p.player_id}
                            type="button"
                            onClick={() => {
                              setFlyerId(p.player_id);
                              setBustedIds((prev) =>
                                prev.filter((id) => id !== p.player_id)
                              );
                            }}
                            className="px-3 py-2 rounded-lg border text-xs font-bold truncate cursor-pointer"
                            style={{
                              minHeight: '44px',
                              backgroundColor: selected
                                ? 'var(--color-accent-soft)'
                                : 'var(--color-surface)',
                              borderColor: selected
                                ? 'var(--color-accent)'
                                : 'var(--color-border-strong)',
                              color: selected
                                ? 'var(--color-accent)'
                                : 'var(--color-text)',
                            }}
                          >
                            {p.wind} · {p.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div
                      className="text-xs font-bold mb-1.5"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      飛んだ人（1〜3名選択）
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {activeSeatPlayers.map((p) => {
                        const isFlyer = flyerId === p.player_id;
                        const selected = bustedIds.includes(p.player_id);
                        return (
                          <button
                            key={p.player_id}
                            type="button"
                            disabled={isFlyer}
                            onClick={() =>
                              setBustedIds((prev) =>
                                prev.includes(p.player_id)
                                  ? prev.filter((id) => id !== p.player_id)
                                  : [...prev, p.player_id]
                              )
                            }
                            className="px-3 py-2 rounded-lg border text-xs font-bold truncate cursor-pointer"
                            style={{
                              minHeight: '44px',
                              opacity: isFlyer ? 0.35 : 1,
                              backgroundColor: selected
                                ? 'var(--color-danger-soft)'
                                : 'var(--color-surface)',
                              borderColor: selected
                                ? 'var(--color-danger)'
                                : 'var(--color-border-strong)',
                              color: selected
                                ? 'var(--color-danger)'
                                : 'var(--color-text)',
                            }}
                          >
                            {p.wind} · {p.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Yakitori UI (Conditional) */}
          {rules.use_yakitori === 'true' && (
            <section className="surface-card p-4">
              <div className="text-sm font-bold">焼き鳥</div>
              <div
                className="text-xs mt-0.5 mb-2.5"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                焼き鳥となった対局者を選択してください（0名・4名時は0pt）
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {activeSeatPlayers.map((p) => {
                  const selected = yakitoriIds.includes(p.player_id);
                  return (
                    <button
                      key={p.player_id}
                      type="button"
                      onClick={() =>
                        setYakitoriIds((prev) =>
                          prev.includes(p.player_id)
                            ? prev.filter((id) => id !== p.player_id)
                            : [...prev, p.player_id]
                        )
                      }
                      className="px-3 py-2 rounded-lg border text-xs font-bold truncate cursor-pointer"
                      style={{
                        minHeight: '44px',
                        backgroundColor: selected
                          ? 'var(--color-warning-soft)'
                          : 'var(--color-surface)',
                        borderColor: selected
                          ? 'var(--color-warning)'
                          : 'var(--color-border-strong)',
                        color: selected
                          ? 'var(--color-warning)'
                          : 'var(--color-text)',
                      }}
                    >
                      {p.wind} · {p.name}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {error && (
            <div
              className="rounded-xl border p-3 text-sm font-medium"
              style={{
                backgroundColor: 'var(--color-danger-soft)',
                borderColor: '#fecaca',
                color: 'var(--color-danger)',
              }}
            >
              {error}
            </div>
          )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3.5 border-t flex items-center justify-between gap-3 shrink-0"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          {confirmPreviewDetails ? (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmPreviewDetails(null)}
              >
                <ArrowLeft size={16} />
                <span>戻って修正</span>
              </button>
              <button
                type="button"
                className="btn btn-primary min-w-[140px]"
                onClick={handleConfirmPreview}
              >
                <Check size={16} />
                <span>{initialGame ? '確定して更新' : '確定して登録'}</span>
              </button>
            </>
          ) : (
            <>
              <div>
                {initialGame && onDelete && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => setConfirmDeleteOpen(true)}
                  >
                    <Trash2 size={16} />
                    <span>削除</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  className="btn btn-primary min-w-[120px]"
                  onClick={handleSubmit}
                >
                  <Check size={16} />
                  <span>{initialGame ? '更新' : '登録'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sum Mismatch Confirmation */}
      <ConfirmModal
        open={Boolean(confirmSumPayload)}
        title="合計点数の確認"
        message={
          confirmSumPayload
            ? `全員の点数合計が${formatNumber(
                confirmSumPayload.sum
              )}点です。\n供託リーチ棒の残と一致する場合はトップ者に自動加算されるため問題ありません。\nこのまま成績を確定しますか？`
            : ''
        }
        confirmLabel="このまま確定"
        onConfirm={() => {
          if (confirmSumPayload) {
            onSave(confirmSumPayload.details);
          }
          setConfirmSumPayload(null);
        }}
        onCancel={() => setConfirmSumPayload(null)}
      />

      {/* Delete Game Confirmation */}
      <ConfirmModal
        open={confirmDeleteOpen}
        title="試合を削除"
        message={`第${gameNumber}戦の記録を削除しますか？`}
        confirmLabel="削除する"
        confirmTone="danger"
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          onDelete?.();
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
};
