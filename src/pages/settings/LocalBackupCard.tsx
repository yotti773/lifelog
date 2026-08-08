import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import { IconDownload, IconUpload, IconWarning } from "@/components/icons";
import {
  BACKUP_TABLES,
  BACKUP_TABLE_LABELS,
  countBackupRows,
  exportBackupData,
  importBackupData,
  parseBackupData,
  type BackupData,
  type BackupTableName,
} from "@/db/backup";
import { fontRounded, tokens } from "@/theme";

/**
 * 復元は取り消せないため、年まで出して取り違えを防ぐ。
 * 共通の `formatDateTime` は `M/D HH:mm` 形式で、別年の同月同日を区別できない
 */
function formatBackupTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 0件のテーブルは省いて「体重93件・食事80件…」の形にする */
function summarize(counts: Record<BackupTableName, number>): string {
  const parts = BACKUP_TABLES.filter((name) => counts[name] > 0).map(
    (name) => `${BACKUP_TABLE_LABELS[name]}${counts[name]}件`,
  );
  return parts.length > 0 ? parts.join("・") : "データがありません";
}

type Status =
  | { kind: "idle" }
  | { kind: "exported"; summary: string }
  | { kind: "confirm"; data: BackupData; summary: string }
  | { kind: "restored"; summary: string }
  | { kind: "error"; message: string };

/**
 * 設定画面の「端末内データの書き出し・復元」カード(Issue #164)。
 *
 * シート同期では戻せないもの(設定、食事のAI推定値と写真参照)まで含めてまるごと退避・復元する。
 * **復元は既存データを全て置き換える**ため、ファイルを読んだ時点では実行せず、
 * 中身の件数を見せて確認してから実行する。
 */
export default function LocalBackupCard() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [isBusy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    setStatus({ kind: "idle" });
    try {
      const data = await exportBackupData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `karadalog-backup-${data.exportedAt.slice(0, 10)}.json`;
      anchor.click();
      // click() 直後に同期的にrevokeすると、ブラウザがblobを取りに行く前にURLが無効化され、
      // ダウンロードが失敗しうる(UIは成功表示のままになるため気づけない)
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setStatus({ kind: "exported", summary: summarize(countBackupRows(data)) });
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "書き出しに失敗しました" });
    } finally {
      setBusy(false);
    }
  };

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setStatus({ kind: "idle" });
    try {
      const data = parseBackupData(JSON.parse(await file.text()));
      setStatus({ kind: "confirm", data, summary: summarize(countBackupRows(data)) });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "ファイルを読み込めませんでした",
      });
    } finally {
      setBusy(false);
      // 同じファイルを選び直せるように値をクリアする
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRestore = async (data: BackupData) => {
    setBusy(true);
    try {
      const restored = await importBackupData(data);
      setStatus({ kind: "restored", summary: summarize(restored) });
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "復元に失敗しました" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card sx={{ p: "16px", mb: "18px" }}>
      <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 14, mb: "4px" }}>
        端末内データの書き出し・復元
      </Typography>
      <Typography sx={{ fontSize: 11, color: "text.secondary", lineHeight: 1.6, mb: "14px" }}>
        記録・設定・AIコメントはシート同期で戻せます。シートから戻らないのは食事のAI推定値と写真参照だけなので、これは移行前の保険(断面のまるごと退避)です
      </Typography>
      <Typography sx={{ fontSize: 11, color: tokens.warnText, lineHeight: 1.6, mb: "14px" }}>
        書き出したファイルにはAPIトークンがそのまま入ります。共有ストレージには置かないでください
      </Typography>

      <Button
        fullWidth
        variant="contained"
        color="secondary"
        onClick={handleExport}
        disabled={isBusy}
        startIcon={<IconUpload />}
        sx={{ height: 46, borderRadius: "13px", fontSize: 14, boxShadow: tokens.secondaryButtonShadow }}
      >
        JSONファイルに書き出す
      </Button>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => void handleFileSelected(event.target.files?.[0])}
      />
      <Button
        fullWidth
        variant="outlined"
        color="secondary"
        onClick={() => fileInputRef.current?.click()}
        disabled={isBusy}
        startIcon={<IconDownload />}
        sx={{ height: 46, borderRadius: "13px", fontSize: 14, mt: "10px" }}
      >
        JSONファイルから復元
      </Button>

      {status.kind === "exported" && (
        <Typography sx={{ mt: "12px", fontSize: 12, color: "text.secondary", lineHeight: 1.6 }}>
          書き出しました({status.summary})
        </Typography>
      )}

      {status.kind === "confirm" && (
        <Box sx={{ mt: "12px", bgcolor: tokens.warnBg, borderRadius: "11px", p: "12px" }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: "7px" }}>
            <Box sx={{ color: tokens.warnText, display: "flex", mt: "1px" }}>
              <IconWarning />
            </Box>
            <Typography sx={{ fontSize: 11, fontWeight: 500, color: tokens.warnText, lineHeight: 1.5 }}>
              いまの端末のデータを全て消して、この内容に置き換えます。取り消せません
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 11, color: "text.secondary", lineHeight: 1.6, mt: "8px" }}>
            書き出し日時: {formatBackupTimestamp(status.data.exportedAt)}
            {status.data.origin ? ` / 取得元: ${status.data.origin}` : ""}
            <br />
            {status.summary}
          </Typography>
          <Box sx={{ display: "flex", gap: "8px", mt: "10px" }}>
            <Button
              variant="contained"
              color="primary"
              disabled={isBusy}
              onClick={() => void handleRestore(status.data)}
              sx={{ flex: 1, height: 40, borderRadius: "11px", fontSize: 13, whiteSpace: "nowrap" }}
            >
              {isBusy ? "復元中..." : "置き換える"}
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              disabled={isBusy}
              onClick={() => setStatus({ kind: "idle" })}
              sx={{ flex: 1, height: 40, borderRadius: "11px", fontSize: 13 }}
            >
              やめる
            </Button>
          </Box>
        </Box>
      )}

      {status.kind === "restored" && (
        <Typography sx={{ mt: "12px", fontSize: 12, color: "text.secondary", lineHeight: 1.6 }}>
          復元しました({status.summary})
        </Typography>
      )}

      {status.kind === "error" && (
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: "7px", mt: "12px", bgcolor: tokens.errorBg, borderRadius: "11px", p: "10px 12px" }}>
          <Box sx={{ color: tokens.errorText, display: "flex", mt: "1px" }}>
            <IconWarning />
          </Box>
          <Typography sx={{ fontSize: 11, fontWeight: 500, color: tokens.errorText, lineHeight: 1.5 }}>
            {status.message}。端末のデータは変更されていません
          </Typography>
        </Box>
      )}
    </Card>
  );
}
