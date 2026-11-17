import React, { useState } from 'react';
import {
  POINTS_PATTERNS,
  PointsPatternKey,
  RuleConfig,
  UMA_PATTERNS,
  UmaPatternKey,
} from '../types/mahjong';
import { validatePositiveInteger } from '../utils/mahjongCalc';

interface RuleSettingsViewProps {
  initialRules: RuleConfig;
  onSave: (nextRules: RuleConfig) => Promise<void>;
  onCancel: () => void;
}

export const RuleSettingsView: React.FC<RuleSettingsViewProps> = ({
  initialRules,
  onSave,
  onCancel,
}) => {
  const [form, setForm] = useState<RuleConfig>({ ...initialRules });
  const [rateInput, setRateInput] = useState(initialRules.settlement_rate);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedPointsKey =
    `${form.starting_points}-${form.return_points}` as PointsPatternKey;

  const handlePointsChange = (key: PointsPatternKey) => {
    const matched = POINTS_PATTERNS.find((p) => p.key === key);
    if (!matched) return;
    setForm((prev) => ({
      ...prev,
      starting_points: matched.starting_points,
      return_points: matched.return_points,
    }));
  };

  const handleToggle = (
    field: 'use_tobi' | 'use_yakitori' | 'use_chip' | 'use_settlement'
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field] === 'true' ? 'false' : 'true',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const validRate = validatePositiveInteger(rateInput);
    if (validRate === null) {
      setError('精算係数は1以上の正の整数を入力してください。');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        ...form,
        settlement_rate: String(validRate),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'ルール設定の保存に失敗しました。'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="surface-card p-6 flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-bold">ルール設定</h2>
          <p
            className="mt-1 text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            設定内容は保存先のシートに記録され、次回以降も自動で読み込まれます。
          </p>
        </div>

        {/* 1試合の形式 */}
        <div>
          <span className="block text-sm font-semibold mb-2">1試合の形式</span>
          <div
            className="grid grid-cols-2 gap-2 p-1 rounded-xl"
            style={{ backgroundColor: 'var(--color-surface-subtle)' }}
          >
            {(
              [
                { key: 'hanchan', label: '半荘' },
                { key: 'tonpuu', label: '東風' },
              ] as const
            ).map((opt) => {
              const active = form.game_type === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, game_type: opt.key }))
                  }
                  className="btn h-11 rounded-lg"
                  style={{
                    backgroundColor: active
                      ? 'var(--color-surface)'
                      : 'transparent',
                    color: active
                      ? 'var(--color-text)'
                      : 'var(--color-text-secondary)',
                    borderColor: active ? 'var(--color-border)' : 'transparent',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 持ち点・返し点 */}
        <div>
          <label
            htmlFor="points-pattern"
            className="block text-sm font-semibold mb-2"
          >
            持ち点・返し点（固定パターン）
          </label>
          <select
            id="points-pattern"
            className="input-field"
            value={selectedPointsKey}
            onChange={(e) =>
              handlePointsChange(e.target.value as PointsPatternKey)
            }
          >
            {POINTS_PATTERNS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* ウマ */}
        <div>
          <label
            htmlFor="uma-pattern"
            className="block text-sm font-semibold mb-2"
          >
            順位点（ウマ・固定パターン）
          </label>
          <select
            id="uma-pattern"
            className="input-field"
            value={form.uma_pattern}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                uma_pattern: e.target.value as UmaPatternKey,
              }))
            }
          >
            {UMA_PATTERNS.map((u) => (
              <option key={u.key} value={u.key}>
                {u.label}
              </option>
            ))}
          </select>
        </div>

        {/* 特殊ルール採用トグル */}
        <div>
          <span className="block text-sm font-semibold mb-2">
            特殊ルール・表示設定
          </span>
          <div
            className="rounded-xl border divide-y"
            style={{ borderColor: 'var(--color-border)' }}
          >
            {(
              [
                {
                  key: 'use_tobi',
                  title: '飛び（トビ）',
                  desc: '飛ばされた人 -5 / 飛ばした人 +5 × 人数',
                },
                {
                  key: 'use_yakitori',
                  title: '焼き鳥',
                  desc: '対象者が合計15pt相当を支払い非対象者へ均等分配',
                },
                {
                  key: 'use_chip',
                  title: 'チップ',
                  desc: '初期20枚からの増減 × 2pt を最終成績へ加算',
                },
                {
                  key: 'use_settlement',
                  title: '精算集計ポップアップ',
                  desc: '成績画面に「集計」ボタンを表示し係数を乗算表示',
                },
              ] as const
            ).map((item) => {
              const enabled = form[item.key] === 'true';
              return (
                <div
                  key={item.key}
                  className="px-4 py-3.5 flex items-center justify-between gap-4"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div>
                    <div className="text-sm font-semibold">{item.title}</div>
                    <div
                      className="text-xs mt-0.5"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {item.desc}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    onClick={() => handleToggle(item.key)}
                    className="btn min-w-[84px] h-10 px-3 text-xs"
                    style={{
                      backgroundColor: enabled
                        ? 'var(--color-accent)'
                        : 'var(--color-surface-subtle)',
                      color: enabled ? '#ffffff' : 'var(--color-text-secondary)',
                      borderColor: enabled
                        ? 'var(--color-accent)'
                        : 'var(--color-border-strong)',
                    }}
                  >
                    {enabled ? '採用' : '不採用'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* 精算係数 */}
        <div>
          <label
            htmlFor="settlement-rate"
            className="block text-sm font-semibold mb-2"
          >
            精算係数（正の整数）
          </label>
          <input
            id="settlement-rate"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            className="input-field tabular-nums max-w-[200px]"
            value={rateInput}
            onChange={(e) => setRateInput(e.target.value)}
          />
          <p
            className="mt-1.5 text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            集計ポップアップ表示時に各対局者の成績へこの整数を乗算します（初期値: 50）。
          </p>
        </div>

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

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={saving}
            onClick={onCancel}
          >
            キャンセル
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </form>
  );
};
