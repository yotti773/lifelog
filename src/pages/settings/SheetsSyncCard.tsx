import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import { IconDownload, IconSync, IconWarning } from "@/components/icons";
import { getUnsyncedDiaryRecords } from "@/db/diaryRecords";
import { getUnsyncedMealRecords } from "@/db/mealRecords";
import { getPendingDeletionIds } from "@/db/syncDeletions";
import { getUnsyncedWaterRecords } from "@/db/waterRecords";
import { getUnsyncedWeightRecords } from "@/db/weightRecords";
import { getUnsyncedWorkoutRecords } from "@/db/workoutRecords";
import { formatDateTime } from "@/lib/date";
import { runImport, type ImportOutcome } from "@/sync/importEngine";
import { runSync, type SyncOutcome } from "@/sync/syncEngine";
import { workerSheetsTransport } from "@/sync/workerSheetsTransport";
import { fontRounded, tokens } from "@/theme";

function syncOutcomeMessage(outcome: SyncOutcome): string {
  switch (outcome.status) {
    case "success":
      return `${outcome.syncedCount}件を同期しました`;
    case "skipped-offline":
      return "オフラインのため同期できませんでした";
    case "skipped-nothing-to-sync":
      return "同期する記録はありません";
    case "error":
      return outcome.message;
  }
}

function importOutcomeMessage(outcome: ImportOutcome): string {
  switch (outcome.status) {
    case "success": {
      const {
        importedWeightCount,
        importedMealCount,
        importedWaterCount,
        importedWorkoutCount,
        importedDiaryCount,
        importedActivityCount,
        skippedExistingCount,
        skippedRowCount,
      } = outcome;
      const totalImported =
        importedWeightCount +
        importedMealCount +
        importedWaterCount +
        importedWorkoutCount +
        importedDiaryCount +
        importedActivityCount;
      let message: string;
      if (totalImported === 0) {
        message =
          skippedExistingCount > 0
            ? "新しく取り込む記録はありませんでした(すべて取り込み済みです)"
            : "取り込める記録がシートにありませんでした";
      } else {
        message =
          `体重${importedWeightCount}件・食事${importedMealCount}件・水分${importedWaterCount}件・` +
          `筋トレ${importedWorkoutCount}件・日記${importedDiaryCount}件・活動${importedActivityCount}件を取り込みました`;
        if (skippedExistingCount > 0) {
          message += `(既にある${skippedExistingCount}件はスキップ)`;
        }
      }
      if (skippedRowCount > 0) {
        message += `。読み取れなかった${skippedRowCount}行は対象外です`;
      }
      return message;
    }
    case "skipped-offline":
      return "オフラインのため取り込みできませんでした";
    case "error":
      return outcome.message;
  }
}

interface SheetsSyncCardProps {
  /** 最終同期日時(ISO)。一度も同期していなければundefined */
  lastSyncedAt: string | undefined;
}

/** 設定画面の「データ同期・バックアップ」カード。同期・取り込みの実行と結果表示までを自己完結で持つ */
export default function SheetsSyncCard({ lastSyncedAt }: SheetsSyncCardProps) {
  // 未同期件数には未送信レコードに加え、削除待ちのトゥームストーンも含める(Issue #30・#72)
  const unsyncedCount = useLiveQuery(async () => {
    const [
      weights,
      meals,
      waters,
      workouts,
      diaries,
      weightDeletions,
      mealDeletions,
      waterDeletions,
      workoutDeletions,
      diaryDeletions,
    ] = await Promise.all([
      getUnsyncedWeightRecords(),
      getUnsyncedMealRecords(),
      getUnsyncedWaterRecords(),
      getUnsyncedWorkoutRecords(),
      getUnsyncedDiaryRecords(),
      getPendingDeletionIds("weight"),
      getPendingDeletionIds("meal"),
      getPendingDeletionIds("water"),
      getPendingDeletionIds("workout"),
      getPendingDeletionIds("diary"),
    ]);
    return (
      weights.length +
      meals.length +
      waters.length +
      workouts.length +
      diaries.length +
      weightDeletions.length +
      mealDeletions.length +
      waterDeletions.length +
      workoutDeletions.length +
      diaryDeletions.length
    );
  }, []);

  const [isSyncing, setSyncing] = useState(false);
  const [syncOutcome, setSyncOutcome] = useState<SyncOutcome | null>(null);
  const [isImporting, setImporting] = useState(false);
  const [importOutcome, setImportOutcome] = useState<ImportOutcome | null>(null);

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncOutcome(null);
    try {
      const outcome = await runSync({ transport: workerSheetsTransport });
      setSyncOutcome(outcome);
    } finally {
      setSyncing(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setImportOutcome(null);
    try {
      const outcome = await runImport({ transport: workerSheetsTransport });
      setImportOutcome(outcome);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card sx={{ p: "16px", mb: "18px" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "14px" }}>
        <Box>
          <Typography sx={{ fontSize: 12, fontWeight: 500, color: "text.secondary" }}>最終同期</Typography>
          <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 14, mt: "2px" }}>
            {lastSyncedAt ? formatDateTime(lastSyncedAt) : "未同期"}
          </Typography>
        </Box>
        <Typography
          sx={{
            fontFamily: fontRounded,
            fontWeight: 700,
            fontSize: 11,
            color: unsyncedCount ? tokens.warnText : "text.secondary",
            bgcolor: unsyncedCount ? tokens.warnBg : tokens.beigeSoft,
            px: "10px",
            py: "5px",
            borderRadius: "20px",
          }}
        >
          未同期 {unsyncedCount ?? "-"}件
        </Typography>
      </Box>
      <Button
        fullWidth
        variant="contained"
        color="secondary"
        onClick={handleSyncNow}
        disabled={isSyncing || isImporting}
        startIcon={<IconSync />}
        sx={{ height: 46, borderRadius: "13px", fontSize: 14, boxShadow: tokens.secondaryButtonShadow }}
      >
        {isSyncing ? "同期中..." : "今すぐ同期"}
      </Button>
      {syncOutcome &&
        (syncOutcome.status === "error" ? (
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: "7px", mt: "12px", bgcolor: tokens.errorBg, borderRadius: "11px", p: "10px 12px" }}>
            <Box sx={{ color: tokens.errorText, display: "flex", mt: "1px" }}>
              <IconWarning />
            </Box>
            <Typography sx={{ fontSize: 11, fontWeight: 500, color: tokens.errorText, lineHeight: 1.5 }}>
              {syncOutcomeMessage(syncOutcome)}。記録は保持され、次回に再試行します
            </Typography>
          </Box>
        ) : (
          <Typography sx={{ mt: "12px", fontSize: 12, color: "text.secondary" }}>{syncOutcomeMessage(syncOutcome)}</Typography>
        ))}
      <Button
        fullWidth
        variant="outlined"
        color="secondary"
        onClick={handleImport}
        disabled={isImporting || isSyncing}
        startIcon={<IconDownload />}
        sx={{ height: 46, borderRadius: "13px", fontSize: 14, mt: "10px" }}
      >
        {isImporting ? "取り込み中..." : "シートから取り込み(復元)"}
      </Button>
      <Typography sx={{ mt: "8px", fontSize: 11, color: "text.secondary", lineHeight: 1.6 }}>
        スプレッドシートの記録をアプリに取り込みます。ローカルに既にある記録はそのまま残ります(機種変更時の復元・過去データの移行用)
      </Typography>
      {importOutcome &&
        (importOutcome.status === "error" ? (
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: "7px", mt: "12px", bgcolor: tokens.errorBg, borderRadius: "11px", p: "10px 12px" }}>
            <Box sx={{ color: tokens.errorText, display: "flex", mt: "1px" }}>
              <IconWarning />
            </Box>
            <Typography sx={{ fontSize: 11, fontWeight: 500, color: tokens.errorText, lineHeight: 1.5 }}>
              {importOutcomeMessage(importOutcome)}。ローカルの記録は変更されていません
            </Typography>
          </Box>
        ) : (
          <Typography sx={{ mt: "12px", fontSize: 12, color: "text.secondary" }}>{importOutcomeMessage(importOutcome)}</Typography>
        ))}
    </Card>
  );
}
