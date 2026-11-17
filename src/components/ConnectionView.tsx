import React, { useMemo, useState } from 'react';
import { Check, Copy, Link2, Smartphone } from 'lucide-react';
import {
  buildShareLink,
  testGasConnection,
  validateGasUrl,
} from '../services/api';
import { StorageMode } from '../types/mahjong';

interface ConnectionViewProps {
  initialGasUrl: string;
  currentMode: StorageMode | null;
  hasBack: boolean;
  onBack: () => void;
  onSaveGas: (gasUrl: string) => Promise<void>;
  onUseLocalMode: () => Promise<void>;
}

export const ConnectionView: React.FC<ConnectionViewProps> = ({
  initialGasUrl,
  currentMode,
  hasBack,
  onBack,
  onSaveGas,
  onUseLocalMode,
}) => {
  const [url, setUrl] = useState(initialGasUrl);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const urlCheck = useMemo(() => {
    if (!url.trim()) return { valid: false, message: '' };
    return validateGasUrl(url);
  }, [url]);

  const handleTest = async () => {
    setTestResult(null);
    const check = validateGasUrl(url);
    if (!check.valid) {
      setTestResult({
        ok: false,
        message: check.message ?? 'URL形式を確認してください。',
      });
      return;
    }
    setTesting(true);
    try {
      const res = await testGasConnection(url);
      setTestResult({
        ok: true,
        message: `接続テスト成功（APIバージョン: v${res.apiVersion}）`,
      });
    } catch (err) {
      setTestResult({
        ok: false,
        message:
          err instanceof Error ? err.message : '接続テストに失敗しました。',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveGas = async () => {
    const check = validateGasUrl(url);
    if (!check.valid) {
      setTestResult({
        ok: false,
        message: check.message ?? 'URL形式を確認してください。',
      });
      return;
    }
    setSaving(true);
    setTestResult(null);
    try {
      await testGasConnection(url);
      await onSaveGas(url.trim());
    } catch (err) {
      setTestResult({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : '接続先への保存・読み込みに失敗しました。',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = async () => {
    const check = validateGasUrl(url);
    if (!check.valid) return;
    const shareUrl = buildShareLink(url);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setTestResult({
        ok: false,
        message: `コピーに失敗しました。手動でコピーしてください: ${shareUrl}`,
      });
    }
  };

  const handleLocalStart = async () => {
    setSaving(true);
    try {
      await onUseLocalMode();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="surface-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">接続設定</h2>
            <p
              className="mt-1 text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              データ保存先となる Google Apps Script（GAS）WebアプリのURLを設定します。
            </p>
          </div>
          {currentMode && (
            <span
              className="text-xs font-medium"
              style={{ color: 'var(--color-text-muted)' }}
            >
              現在: {currentMode === 'gas' ? 'GASスプレッドシート連携' : 'ブラウザ内ローカル保存'}
            </span>
          )}
        </div>

        <div className="mt-5">
          <label
            htmlFor="gas-url-input"
            className="block text-sm font-semibold mb-2"
          >
            GAS WebアプリURL
          </label>
          <input
            id="gas-url-input"
            type="url"
            inputMode="url"
            className="input-field"
            placeholder="https://script.google.com/macros/s/.../exec"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setTestResult(null);
            }}
          />
          {url.trim() && !urlCheck.valid && urlCheck.message && (
            <p
              className="mt-2 text-xs font-medium"
              style={{ color: 'var(--color-danger)' }}
            >
              {urlCheck.message}
            </p>
          )}
        </div>

        {testResult && (
          <div
            className="mt-4 rounded-xl border p-3 text-sm font-medium"
            style={{
              backgroundColor: testResult.ok
                ? 'var(--color-accent-soft)'
                : 'var(--color-danger-soft)',
              borderColor: testResult.ok ? '#bbf7d0' : '#fecaca',
              color: testResult.ok
                ? 'var(--color-positive)'
                : 'var(--color-danger)',
            }}
          >
            {testResult.message}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={testing || saving || !url.trim()}
            onClick={handleTest}
          >
            {testing ? '確認中...' : '接続テスト'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={testing || saving || !urlCheck.valid}
            onClick={handleSaveGas}
          >
            {saving ? '接続中...' : '保存して開始'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!urlCheck.valid}
            onClick={handleCopyLink}
          >
            {copied ? (
              <>
                <Check size={16} />
                <span>コピーしました</span>
              </>
            ) : (
              <>
                <Copy size={16} />
                <span>設定済みリンクをコピー</span>
              </>
            )}
          </button>
          {hasBack && (
            <button
              type="button"
              className="btn btn-ghost ml-auto"
              onClick={onBack}
            >
              戻る
            </button>
          )}
        </div>
      </div>

      {/* GAS未接続時のブラウザ内ローカル動作確認用 */}
      <div className="surface-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <Link2 size={18} />
              <span>スプレッドシート未設定で画面・計算をテストする場合</span>
            </h3>
            <p
              className="mt-1 text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              GASをデプロイする前でも、お使いのブラウザ（localStorage）にデータを保存して全機能をそのまま確認できます。後からGAS URLを登録して切り替えることも可能です。
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary shrink-0"
            disabled={saving}
            onClick={handleLocalStart}
          >
            ブラウザ保存で開始
          </button>
        </div>
      </div>

      {/* iPad Safari ホーム画面追加の運用案内 */}
      <div className="surface-card p-6">
        <h3 className="text-base font-bold flex items-center gap-2">
          <Smartphone size={18} />
          <span>iPad Safari でのご利用手順（ITP対策・ホーム画面追加）</span>
        </h3>
        <ol
          className="mt-3 list-decimal pl-5 space-y-1.5 text-sm leading-relaxed"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <li>
            通常のSafariと「ホーム画面に追加」したアプリでは保存領域（localStorage）が別々に管理されます。
          </li>
          <li>
            上の「設定済みリンクをコピー」で取得した{' '}
            <code className="font-mono text-xs">?gasUrl=...</code>{' '}
            付きのURLをSafariで開いた状態から、共有ボタンの「ホーム画面に追加」を実行してください。
          </li>
          <li>
            7日間以上アプリを開かずSafariの保存情報が消去された場合も、設定済みリンクまたはホーム画面アイコンから再入力なしで接続先を自動復元できます。
          </li>
        </ol>
      </div>
    </div>
  );
};
