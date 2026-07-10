import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  IconBarbell,
  IconCalendar,
  IconChevronRight,
  IconClock,
  IconDrop,
  IconFork,
  IconDownload,
  IconFlame,
  IconPerson,
  IconRuler,
  IconSparkle,
  IconSun,
  IconSync,
  IconWarning,
} from "@/components/icons";
import { db } from "@/db/db";
import { getAllExerciseMasterItems } from "@/db/exerciseMaster";
import { getAllFoodMasterItems, bulkAddFoodMasterItems } from "@/db/foodMaster";
import { foodMasterSeedData } from "@/db/foodMasterSeedData";
import { getUnsyncedMealRecords } from "@/db/mealRecords";
import { getSettings, updateSettings } from "@/db/settings";
import { getPendingDeletionIds } from "@/db/syncDeletions";
import { getUnsyncedWeightRecords } from "@/db/weightRecords";
import { getMeasuredTdeeAsOfWeek } from "@/db/weeklyNutrition";
import { daysBetween, formatDateTime, todayDateString, weekStartOf } from "@/lib/date";
import {
  ACTIVITY_LEVELS,
  activityLevelLabel,
  calcBmr,
  calcFormulaTdee,
  suggestCalorieTarget,
  suggestPfcTargets,
  type CalorieTargetSuggestion,
  type PfcTargetSuggestion,
} from "@/lib/nutritionCalc";
import { runImport, type ImportOutcome } from "@/sync/importEngine";
import { runSync, type SyncOutcome } from "@/sync/syncEngine";
import { workerSheetsTransport } from "@/sync/workerSheetsTransport";
import { fontRounded, tokens } from "@/theme";
import type { Sex } from "@/types";

type EditTarget =
  | "weight"
  | "goalDate"
  | "baseline"
  | "calories"
  | "waterGoal"
  | "height"
  | "birthYear"
  | "sex"
  | "activityLevel";

const EDIT_LABELS: Record<EditTarget, string> = {
  weight: "目標体重",
  goalDate: "目標日",
  baseline: "基準日",
  calories: "1日の目標カロリー",
  waterGoal: "1日の目標水分摂取量",
  height: "身長",
  birthYear: "生年",
  sex: "性別",
  activityLevel: "活動レベル",
};

const NUMBER_EDIT_UNITS: Partial<Record<EditTarget, string>> = {
  weight: "kg",
  calories: "kcal",
  waterGoal: "ml",
  height: "cm",
  birthYear: "年",
};

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: "male", label: "男性" },
  { value: "female", label: "女性" },
];

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
      const { importedWeightCount, importedMealCount, skippedExistingCount, skippedRowCount } = outcome;
      let message: string;
      if (importedWeightCount + importedMealCount === 0) {
        message =
          skippedExistingCount > 0
            ? "新しく取り込む記録はありませんでした(すべて取り込み済みです)"
            : "取り込める記録がシートにありませんでした";
      } else {
        message = `体重${importedWeightCount}件・食事${importedMealCount}件を取り込みました`;
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

/** YYYY-MM-DD を 2026/10/31 形式で表示する */
function formatSlashDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${y}/${Number(m)}/${Number(d)}`;
}

interface SettingRowProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value?: string;
  divider?: boolean;
  onClick: () => void;
}

function SettingRow({ icon, iconBg, iconColor, label, value, divider, onClick }: SettingRowProps) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: "13px",
        width: "100%",
        p: "15px 16px",
        textAlign: "left",
        borderBottom: divider ? `1px solid ${tokens.divider}` : "none",
      }}
    >
      <Box
        sx={{
          width: 34,
          height: 34,
          borderRadius: "11px",
          bgcolor: iconBg,
          color: iconColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Typography sx={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{label}</Typography>
      {value && (
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 14, color: "text.secondary" }}>{value}</Typography>
      )}
      <Box sx={{ color: "#D0C3AF", display: "flex" }}>
        <IconChevronRight />
      </Box>
    </ButtonBase>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary", m: "6px 4px 8px" }}>{children}</Typography>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const settings = useLiveQuery(() => getSettings(), []);
  // 未同期件数には未送信レコードに加え、削除待ちのトゥームストーンも含める(Issue #30)
  const unsyncedCount = useLiveQuery(async () => {
    const [weights, meals, weightDeletions, mealDeletions] = await Promise.all([
      getUnsyncedWeightRecords(),
      getUnsyncedMealRecords(),
      getPendingDeletionIds("weight"),
      getPendingDeletionIds("meal"),
    ]);
    return weights.length + meals.length + weightDeletions.length + mealDeletions.length;
  }, []);
  const foodMasterCount = useLiveQuery(async () => (await getAllFoodMasterItems()).length, []);
  const exerciseMasterCount = useLiveQuery(async () => (await getAllExerciseMasterItems()).length, []);
  // 自動計算(Issue #43)は直近の体重記録を使う。「記録なし」とロード中を区別するためnullに正規化する
  const latestWeightRecord = useLiveQuery(
    () => db.weightRecords.orderBy("date").last().then((v) => v ?? null),
    [],
  );

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [draft, setDraft] = useState("");
  // 目標カロリーの自動計算シート内の提案(提案→確定の2段階。自動では反映しない。Issue #43)
  const [calorieSuggestion, setCalorieSuggestion] = useState<CalorieTargetSuggestion | null>(null);
  // PFC目標の編集シート(3項目セットのため単一値の編集シートとは別に持つ。Issue #47)
  const [pfcEditorOpen, setPfcEditorOpen] = useState(false);
  const [pfcDraft, setPfcDraft] = useState({ protein: "", fat: "", carbs: "" });
  const [pfcSuggestion, setPfcSuggestion] = useState<PfcTargetSuggestion | null>(null);
  // 目標カロリー変更後にPFC目標の再計算を提案するバナー(自動では上書きしない。Issue #47)
  const [showPfcRecalcHint, setShowPfcRecalcHint] = useState(false);
  const [isSyncing, setSyncing] = useState(false);
  const [syncOutcome, setSyncOutcome] = useState<SyncOutcome | null>(null);
  const [isImporting, setImporting] = useState(false);
  const [importOutcome, setImportOutcome] = useState<ImportOutcome | null>(null);
  const [isSeeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  if (settings === undefined) {
    return <Typography sx={{ p: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>読み込み中...</Typography>;
  }

  const openEditor = (target: EditTarget) => {
    setEditTarget(target);
    setCalorieSuggestion(null);
    switch (target) {
      case "weight":
        setDraft(String(settings.goalWeightKg));
        break;
      case "goalDate":
        setDraft(settings.goalDate);
        break;
      case "baseline":
        setDraft(settings.baselineDate ?? "");
        break;
      case "calories":
        setDraft(String(settings.dailyCalorieTarget));
        break;
      case "waterGoal":
        setDraft(settings.dailyWaterTargetMl !== undefined ? String(settings.dailyWaterTargetMl) : "");
        break;
      case "height":
        setDraft(settings.heightCm !== undefined ? String(settings.heightCm) : "");
        break;
      case "birthYear":
        setDraft(settings.birthYear !== undefined ? String(settings.birthYear) : "");
        break;
      case "sex":
        setDraft(settings.sex ?? "");
        break;
      case "activityLevel":
        setDraft(settings.activityLevel !== undefined ? String(settings.activityLevel) : "");
        break;
    }
  };

  const isChoiceEdit = editTarget === "sex" || editTarget === "activityLevel";
  const isNumberEdit =
    editTarget === "weight" ||
    editTarget === "calories" ||
    editTarget === "waterGoal" ||
    editTarget === "height" ||
    editTarget === "birthYear";
  const draftNumber = Number(draft);
  const canSave =
    editTarget === "baseline" ||
    // 目標水分摂取量は「未設定にする」(空欄での保存)を許容する(画面設計書9章)
    (editTarget === "waterGoal"
      ? draft === "" || (!Number.isNaN(draftNumber) && draftNumber > 0)
      : editTarget === "birthYear"
        ? !Number.isNaN(draftNumber) && draftNumber >= 1900 && draftNumber <= new Date().getFullYear()
        : isNumberEdit
          ? draft !== "" && !Number.isNaN(draftNumber) && draftNumber > 0
          : draft !== "");

  const stepDraft = (direction: 1 | -1) => {
    const step =
      editTarget === "weight" ? 0.1 : editTarget === "waterGoal" ? 100 : editTarget === "height" ? 0.5 : editTarget === "birthYear" ? 1 : 50;
    const base = Number.isNaN(draftNumber) ? 0 : draftNumber;
    const next = Math.max(0, base + direction * step);
    setDraft(editTarget === "weight" ? next.toFixed(1) : String(next));
  };

  const handleSaveEdit = async () => {
    if (!editTarget || !canSave) return;
    switch (editTarget) {
      case "weight":
        await updateSettings({ goalWeightKg: draftNumber });
        break;
      case "goalDate":
        await updateSettings({ goalDate: draft });
        break;
      case "baseline":
        await updateSettings({ baselineDate: draft || undefined });
        break;
      case "calories":
        await updateSettings({ dailyCalorieTarget: draftNumber });
        // PFC目標を設定済みなら、目標カロリー変更に合わせた再計算を提案する(自動では上書きしない。Issue #47)
        if (draftNumber !== settings.dailyCalorieTarget && settings.dailyProteinTargetG !== undefined) {
          setShowPfcRecalcHint(true);
        }
        break;
      case "waterGoal":
        await updateSettings({ dailyWaterTargetMl: draft !== "" ? draftNumber : undefined });
        break;
      case "height":
        await updateSettings({ heightCm: draftNumber });
        break;
      case "birthYear":
        await updateSettings({ birthYear: draftNumber });
        break;
      case "sex":
        await updateSettings({ sex: draft as Sex });
        break;
      case "activityLevel":
        await updateSettings({ activityLevel: draftNumber });
        break;
    }
    setEditTarget(null);
  };

  // 目標カロリーの自動計算(Issue #43)。身体プロフィール・体重記録・残り日数が揃って初めて使える
  const today = todayDateString();
  const hasProfile =
    settings.heightCm !== undefined &&
    settings.birthYear !== undefined &&
    settings.sex !== undefined &&
    settings.activityLevel !== undefined;
  const remainingDays = daysBetween(today, settings.goalDate);
  const calorieAutoCalcHint = !hasProfile
    ? "「あなたのプロフィール」をすべて入力すると自動計算できます"
    : !latestWeightRecord
      ? "体重を記録すると自動計算できます"
      : remainingDays <= 0
        ? "目標日を過ぎているため自動計算できません(目標日を見直してください)"
        : null;

  const handleAutoCalcCalories = async () => {
    if (!hasProfile || !latestWeightRecord || remainingDays <= 0) return;
    const profile = {
      heightCm: settings.heightCm!,
      birthYear: settings.birthYear!,
      sex: settings.sex!,
    };
    const bmrKcal = calcBmr(profile, latestWeightRecord.weightKg, today);
    // 実測TDEE(Issue #44)が得られていれば計算式ベースより実測を優先する(画面設計書9章)
    const measuredTdeeKcal = await getMeasuredTdeeAsOfWeek(weekStartOf(today));
    const suggestion = suggestCalorieTarget({
      bmrKcal,
      tdeeKcal: measuredTdeeKcal ?? calcFormulaTdee(bmrKcal, settings.activityLevel!),
      tdeeSource: measuredTdeeKcal !== null ? "measured" : "formula",
      currentWeightKg: latestWeightRecord.weightKg,
      goalWeightKg: settings.goalWeightKg,
      remainingDays,
    });
    setCalorieSuggestion(suggestion);
  };

  const handleAdoptCalorieSuggestion = async () => {
    if (!calorieSuggestion) return;
    // 「この値を目標にする」が確定操作。ここまで設定値は一切書き換えない(要件定義書4.7章)
    await updateSettings({ dailyCalorieTarget: calorieSuggestion.suggestedKcal });
    if (calorieSuggestion.suggestedKcal !== settings.dailyCalorieTarget && settings.dailyProteinTargetG !== undefined) {
      setShowPfcRecalcHint(true);
    }
    setEditTarget(null);
  };

  // --- PFC目標(Issue #47) ---
  const hasPfcTargets =
    settings.dailyProteinTargetG !== undefined &&
    settings.dailyFatTargetG !== undefined &&
    settings.dailyCarbsTargetG !== undefined;

  const openPfcEditor = (withSuggestion = false) => {
    setShowPfcRecalcHint(false);
    setPfcDraft({
      protein: settings.dailyProteinTargetG !== undefined ? String(settings.dailyProteinTargetG) : "",
      fat: settings.dailyFatTargetG !== undefined ? String(settings.dailyFatTargetG) : "",
      carbs: settings.dailyCarbsTargetG !== undefined ? String(settings.dailyCarbsTargetG) : "",
    });
    setPfcSuggestion(
      withSuggestion && latestWeightRecord
        ? suggestPfcTargets(latestWeightRecord.weightKg, settings.dailyCalorieTarget)
        : null,
    );
    setPfcEditorOpen(true);
  };

  // たんぱく質の提案は直近体重を使うため、体重記録が1件も無い場合は自動計算できない(手動入力は可能。Issue #47)
  const handleAutoCalcPfc = () => {
    if (!latestWeightRecord) return;
    setPfcSuggestion(suggestPfcTargets(latestWeightRecord.weightKg, settings.dailyCalorieTarget));
  };

  // 提案値は入力欄へ転記するだけに留め、保存(確定操作)はユーザーに委ねる。転記後の手動調整も可能
  const handleAdoptPfcSuggestion = () => {
    if (!pfcSuggestion) return;
    setPfcDraft({
      protein: String(pfcSuggestion.proteinG),
      fat: String(pfcSuggestion.fatG),
      carbs: String(pfcSuggestion.carbsG),
    });
    setPfcSuggestion(null);
  };

  const pfcDraftNumbers = [pfcDraft.protein, pfcDraft.fat, pfcDraft.carbs].map(Number);
  const pfcAllEmpty = pfcDraft.protein === "" && pfcDraft.fat === "" && pfcDraft.carbs === "";
  // 3項目セットで持つ(#7の決着): 全部入力して保存するか、全部空にして未設定に戻すかのどちらか
  const canSavePfc =
    pfcAllEmpty ||
    ([pfcDraft.protein, pfcDraft.fat, pfcDraft.carbs].every((v) => v !== "") &&
      pfcDraftNumbers.every((n) => !Number.isNaN(n) && n >= 0));

  const handleSavePfc = async () => {
    if (!canSavePfc) return;
    if (pfcAllEmpty) {
      await updateSettings({
        dailyProteinTargetG: undefined,
        dailyFatTargetG: undefined,
        dailyCarbsTargetG: undefined,
      });
    } else {
      await updateSettings({
        dailyProteinTargetG: pfcDraftNumbers[0],
        dailyFatTargetG: pfcDraftNumbers[1],
        dailyCarbsTargetG: pfcDraftNumbers[2],
      });
    }
    setPfcEditorOpen(false);
  };

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

  const handleSeedMaster = async () => {
    setSeeding(true);
    setSeedMessage(null);
    try {
      const count = await bulkAddFoodMasterItems(foodMasterSeedData);
      setSeedMessage(
        count > 0 ? `${count}件を登録しました` : "追加できる新しい品目はありませんでした(すべて登録済みです)",
      );
    } finally {
      setSeeding(false);
    }
  };

  return (
    <Box sx={{ mx: "auto", maxWidth: 448, px: "20px", pt: "24px", pb: "130px" }}>
      <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 22, mb: "14px" }}>設定</Typography>

      <SectionLabel>あなたのプロフィール</SectionLabel>
      <Card sx={{ overflow: "hidden", mb: "8px" }}>
        <SettingRow
          icon={<IconRuler />}
          iconBg={tokens.secondarySoft}
          iconColor="#2EC4B6"
          label="身長"
          value={settings.heightCm !== undefined ? `${settings.heightCm} cm` : "未設定"}
          divider
          onClick={() => openEditor("height")}
        />
        <SettingRow
          icon={<IconCalendar />}
          iconBg={tokens.warnBg}
          iconColor={tokens.warnIcon}
          label="生年"
          value={settings.birthYear !== undefined ? `${settings.birthYear}年` : "未設定"}
          divider
          onClick={() => openEditor("birthYear")}
        />
        <SettingRow
          icon={<IconPerson />}
          iconBg={tokens.primarySoft}
          iconColor="#FF6B4A"
          label="性別"
          value={SEX_OPTIONS.find((o) => o.value === settings.sex)?.label ?? "未設定"}
          divider
          onClick={() => openEditor("sex")}
        />
        <SettingRow
          icon={<IconBarbell size={18} />}
          iconBg={tokens.strengthBg}
          iconColor="#FF6B4A"
          label="活動レベル"
          value={settings.activityLevel !== undefined ? activityLevelLabel(settings.activityLevel) : "未設定"}
          onClick={() => openEditor("activityLevel")}
        />
      </Card>
      <Typography sx={{ fontSize: 11, color: "text.secondary", mb: "18px", px: "4px", lineHeight: 1.6 }}>
        目標カロリー・PFC目標の自動計算にのみ使います。未入力でも各目標値の手動入力はできます
      </Typography>

      <SectionLabel>目標</SectionLabel>
      <Card sx={{ overflow: "hidden", mb: "18px" }}>
        <SettingRow
          icon={<IconClock />}
          iconBg={tokens.secondarySoft}
          iconColor="#2EC4B6"
          label="目標体重"
          value={`${settings.goalWeightKg.toFixed(1)} kg`}
          divider
          onClick={() => openEditor("weight")}
        />
        <SettingRow
          icon={<IconCalendar />}
          iconBg={tokens.primarySoft}
          iconColor="#FF6B4A"
          label="目標日"
          value={formatSlashDate(settings.goalDate)}
          divider
          onClick={() => openEditor("goalDate")}
        />
        <SettingRow
          icon={<IconSun />}
          iconBg={tokens.warnBg}
          iconColor={tokens.warnIcon}
          label="基準日"
          value={settings.baselineDate ? formatSlashDate(settings.baselineDate) : "未設定(自動)"}
          divider
          onClick={() => openEditor("baseline")}
        />
        <SettingRow
          icon={<IconPerson />}
          iconBg={tokens.primarySoft}
          iconColor="#FF6B4A"
          label="1日の目標カロリー"
          value={`${settings.dailyCalorieTarget.toLocaleString()} kcal`}
          divider
          onClick={() => openEditor("calories")}
        />
        <SettingRow
          icon={<IconFork size={18} />}
          iconBg={tokens.secondarySoft}
          iconColor="#2EC4B6"
          label="PFC目標"
          value={
            hasPfcTargets
              ? `P${settings.dailyProteinTargetG} / F${settings.dailyFatTargetG} / C${settings.dailyCarbsTargetG} g`
              : "未設定"
          }
          divider
          onClick={() => openPfcEditor()}
        />
        <SettingRow
          icon={<IconDrop size={18} />}
          iconBg={tokens.waterSoft}
          iconColor={tokens.waterMain}
          label="1日の目標水分摂取量"
          value={settings.dailyWaterTargetMl !== undefined ? `${settings.dailyWaterTargetMl.toLocaleString()} ml` : "未設定"}
          onClick={() => openEditor("waterGoal")}
        />
      </Card>
      {showPfcRecalcHint && hasPfcTargets && (
        <Box sx={{ display: "flex", alignItems: "center", gap: "10px", bgcolor: tokens.secondarySoft, borderRadius: "14px", p: "10px 14px", mt: "-8px", mb: "18px" }}>
          <Typography sx={{ flex: 1, fontSize: 11, color: tokens.secondaryDeep, lineHeight: 1.6 }}>
            目標カロリーを変更しました。PFC目標の再計算もおすすめします
          </Typography>
          <Button
            size="small"
            color="secondary"
            onClick={() => openPfcEditor(true)}
            sx={{ flexShrink: 0, fontSize: 12 }}
          >
            再計算する
          </Button>
        </Box>
      )}

      <SectionLabel>データ同期・バックアップ(スプレッドシート)</SectionLabel>
      <Card sx={{ p: "16px", mb: "18px" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "14px" }}>
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 500, color: "text.secondary" }}>最終同期</Typography>
            <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 14, mt: "2px" }}>
              {settings.lastSyncedAt ? formatDateTime(settings.lastSyncedAt) : "未同期"}
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
              <Typography sx={{ fontSize: 13, lineHeight: 1.4 }}>⚠️</Typography>
              <Typography sx={{ fontSize: 11, fontWeight: 500, color: tokens.errorText, lineHeight: 1.5 }}>
                {importOutcomeMessage(importOutcome)}。ローカルの記録は変更されていません
              </Typography>
            </Box>
          ) : (
            <Typography sx={{ mt: "12px", fontSize: 12, color: "text.secondary" }}>{importOutcomeMessage(importOutcome)}</Typography>
          ))}
      </Card>

      <SectionLabel>食事マスタ</SectionLabel>
      <Card sx={{ overflow: "hidden", mb: "18px" }}>
        <SettingRow
          icon={<IconFork size={18} />}
          iconBg={tokens.primarySoft}
          iconColor="#FF6B4A"
          label="よく食べるものを管理"
          value={foodMasterCount !== undefined ? `${foodMasterCount}件` : ""}
          divider
          onClick={() => navigate("/settings/food-master")}
        />
        <SettingRow
          icon={<IconDownload />}
          iconBg={tokens.secondarySoft}
          iconColor="#2EC4B6"
          label={isSeeding ? "登録中..." : "定番メニューを一括登録"}
          onClick={handleSeedMaster}
        />
      </Card>
      {seedMessage && (
        <Typography sx={{ fontSize: 12, color: "text.secondary", mt: "-10px", mb: "18px", px: "4px" }}>{seedMessage}</Typography>
      )}

      <SectionLabel>種目マスタ</SectionLabel>
      <Card sx={{ overflow: "hidden", mb: "18px" }}>
        <SettingRow
          icon={<IconBarbell size={18} />}
          iconBg={tokens.strengthBg}
          iconColor="#FF6B4A"
          label="よく行う種目を管理"
          value={exerciseMasterCount !== undefined ? `${exerciseMasterCount}件` : ""}
          onClick={() => navigate("/settings/exercise-master")}
        />
      </Card>

      {/* 目標値の編集ボトムシート */}
      <Drawer
        anchor="bottom"
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        slotProps={{
          paper: {
            sx: { bgcolor: "background.default", borderRadius: "28px 28px 0 0", p: "12px 20px 30px", mx: "auto", maxWidth: 448, width: "100%" },
          },
        }}
      >
        {editTarget && (
          <>
            <Box sx={{ width: 40, height: 5, borderRadius: "3px", bgcolor: "#E2D8C9", mx: "auto", mb: "18px" }} />
            <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16, textAlign: "center", mb: "18px" }}>
              {EDIT_LABELS[editTarget]}
            </Typography>
            {isChoiceEdit ? (
              // 性別・活動レベルは選択式(画面設計書9章)。選択中はコーラルの枠で示す
              <Box sx={{ display: "flex", flexDirection: "column", gap: "8px", mb: "18px" }}>
                {(editTarget === "sex"
                  ? SEX_OPTIONS
                  : ACTIVITY_LEVELS.map((level) => ({ value: String(level.factor), label: level.label }))
                ).map((option) => {
                  const active = draft === option.value;
                  return (
                    <ButtonBase
                      key={option.value}
                      onClick={() => setDraft(option.value)}
                      sx={{
                        p: "13px 16px",
                        borderRadius: "14px",
                        bgcolor: active ? tokens.primarySoft : "background.paper",
                        border: `1.5px solid ${active ? "#FF6B4A" : tokens.border}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        textAlign: "left",
                      }}
                    >
                      <Typography sx={{ fontSize: 14, fontWeight: active ? 700 : 500 }}>{option.label}</Typography>
                      {editTarget === "activityLevel" && (
                        <Typography sx={{ fontFamily: fontRounded, fontSize: 12, color: "text.secondary" }}>
                          ×{option.value}
                        </Typography>
                      )}
                    </ButtonBase>
                  );
                })}
              </Box>
            ) : isNumberEdit ? (
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", mb: "18px" }}>
                <IconButton
                  onClick={() => stepDraft(-1)}
                  sx={{ width: 44, height: 44, bgcolor: "background.paper", boxShadow: tokens.fieldShadow, fontFamily: fontRounded, fontWeight: 700, fontSize: 22, color: "text.primary" }}
                >
                  −
                </IconButton>
                <TextField
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  type="text"
                  slotProps={{
                    htmlInput: {
                      inputMode: editTarget === "weight" || editTarget === "height" ? "decimal" : "numeric",
                      style: { textAlign: "center", fontFamily: fontRounded, fontWeight: 800, fontSize: 28 },
                    },
                    input: {
                      endAdornment: (
                        <Typography sx={{ fontFamily: fontRounded, color: "text.secondary", fontSize: 14, ml: "4px" }}>
                          {NUMBER_EDIT_UNITS[editTarget]}
                        </Typography>
                      ),
                    },
                  }}
                  sx={{ width: 190 }}
                />
                <IconButton
                  onClick={() => stepDraft(1)}
                  sx={{ width: 44, height: 44, bgcolor: "background.paper", boxShadow: tokens.fieldShadow, fontFamily: fontRounded, fontWeight: 700, fontSize: 22, color: "text.primary" }}
                >
                  ＋
                </IconButton>
              </Box>
            ) : (
              <TextField
                type="date"
                fullWidth
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                sx={{ mb: "18px" }}
              />
            )}
            {editTarget === "calories" && (
              // 目標カロリーの自動計算(Issue #43)。計算根拠を行で見せ、確定操作を経て初めて反映する(画面設計書9章)
              <Box sx={{ mb: "18px" }}>
                {calorieSuggestion === null ? (
                  <>
                    <Button
                      fullWidth
                      variant="outlined"
                      color="secondary"
                      onClick={handleAutoCalcCalories}
                      disabled={calorieAutoCalcHint !== null}
                      startIcon={<IconSparkle />}
                      sx={{ height: 44, borderRadius: "13px", fontSize: 13 }}
                    >
                      プロフィールから自動計算
                    </Button>
                    {calorieAutoCalcHint && (
                      <Typography sx={{ mt: "8px", fontSize: 11, color: "text.secondary", textAlign: "center", lineHeight: 1.6 }}>
                        {calorieAutoCalcHint}
                      </Typography>
                    )}
                  </>
                ) : (
                  <Box sx={{ bgcolor: tokens.secondarySoft, borderRadius: "16px", p: "14px 16px" }}>
                    {[
                      { label: "基礎代謝(Mifflin-St Jeor)", value: `${calorieSuggestion.bmrKcal.toLocaleString()} kcal` },
                      {
                        label:
                          calorieSuggestion.tdeeSource === "measured"
                            ? "消費カロリー(実測TDEE)"
                            : `消費カロリー(基礎代謝×${settings.activityLevel})`,
                        value: `${calorieSuggestion.tdeeKcal.toLocaleString()} kcal`,
                      },
                      {
                        label: `必要ペース(残り${remainingDays}日)`,
                        value: `-${calorieSuggestion.requiredWeeklyLossKg.toFixed(2)} kg/週`,
                      },
                      { label: "必要日次赤字", value: `${calorieSuggestion.requiredDailyDeficitKcal.toLocaleString()} kcal/日` },
                    ].map((row) => (
                      <Box key={row.label} sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: "6px" }}>
                        <Typography sx={{ fontSize: 11, color: tokens.secondaryDeep }}>{row.label}</Typography>
                        <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 12, color: tokens.secondaryDeep }}>
                          {row.value}
                        </Typography>
                      </Box>
                    ))}
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", pt: "8px", borderTop: `1px solid rgba(27,139,128,.18)` }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: "5px", color: tokens.secondaryDeep }}>
                        <IconFlame size={15} />
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.secondaryDeep }}>提案目標カロリー</Typography>
                      </Box>
                      <Typography sx={{ fontFamily: fontRounded, fontWeight: 800, fontSize: 20, color: tokens.secondaryDeep }}>
                        {calorieSuggestion.suggestedKcal.toLocaleString()} kcal
                      </Typography>
                    </Box>
                    {calorieSuggestion.clampedToBmr && (
                      <Box sx={{ display: "flex", alignItems: "flex-start", gap: "6px", mt: "10px", bgcolor: tokens.warnBg, borderRadius: "10px", p: "8px 10px" }}>
                        <Box sx={{ color: tokens.warnIcon, display: "flex", mt: "1px" }}>
                          <IconWarning size={13} />
                        </Box>
                        <Typography sx={{ fontSize: 11, color: tokens.warnText, lineHeight: 1.5 }}>
                          計算上の値が基礎代謝を下回るため、基礎代謝を下限として提案しています
                        </Typography>
                      </Box>
                    )}
                    {calorieSuggestion.paceTooFast && (
                      <Box sx={{ display: "flex", alignItems: "flex-start", gap: "6px", mt: "10px", bgcolor: tokens.errorBg, borderRadius: "10px", p: "8px 10px" }}>
                        <Box sx={{ color: tokens.errorText, display: "flex", mt: "1px" }}>
                          <IconWarning size={13} />
                        </Box>
                        <Typography sx={{ fontSize: 11, color: tokens.errorText, lineHeight: 1.5 }}>
                          必要ペースが週あたり体重の1%を超えています。目標日または目標体重の見直しをおすすめします
                        </Typography>
                      </Box>
                    )}
                    <Button
                      fullWidth
                      variant="contained"
                      color="secondary"
                      onClick={handleAdoptCalorieSuggestion}
                      sx={{ mt: "12px", height: 44, borderRadius: "13px", fontSize: 13, boxShadow: tokens.secondaryButtonShadow }}
                    >
                      この値を目標にする
                    </Button>
                  </Box>
                )}
              </Box>
            )}
            {editTarget === "baseline" && (
              <>
                <Typography sx={{ fontSize: 11, color: "text.secondary", mb: "12px", textAlign: "center" }}>
                  未設定の場合、一番古い体重記録を起点にします
                </Typography>
                {draft && (
                  <Button
                    fullWidth
                    variant="text"
                    onClick={() => setDraft("")}
                    sx={{ mb: "6px", color: "text.secondary" }}
                  >
                    未設定にする
                  </Button>
                )}
              </>
            )}
            {editTarget === "waterGoal" && (
              <>
                <Typography sx={{ fontSize: 11, color: "text.secondary", mb: "12px", textAlign: "center" }}>
                  未設定の間はホーム・水分記録画面で合計mlのみ表示します
                </Typography>
                {draft && (
                  <Button
                    fullWidth
                    variant="text"
                    onClick={() => setDraft("")}
                    sx={{ mb: "6px", color: "text.secondary" }}
                  >
                    未設定にする
                  </Button>
                )}
              </>
            )}
            <Button
              fullWidth
              variant="contained"
              onClick={handleSaveEdit}
              disabled={!canSave}
              sx={{ height: 50, borderRadius: "14px", fontSize: 15, boxShadow: tokens.primaryButtonShadow }}
            >
              保存する
            </Button>
            <Button fullWidth variant="text" onClick={() => setEditTarget(null)} sx={{ mt: "6px", color: "text.secondary" }}>
              キャンセル
            </Button>
          </>
        )}
      </Drawer>

      {/* PFC目標の編集ボトムシート(3項目セット+自動計算。Issue #47) */}
      <Drawer
        anchor="bottom"
        open={pfcEditorOpen}
        onClose={() => setPfcEditorOpen(false)}
        slotProps={{
          paper: {
            sx: { bgcolor: "background.default", borderRadius: "28px 28px 0 0", p: "12px 20px 30px", mx: "auto", maxWidth: 448, width: "100%" },
          },
        }}
      >
        <Box sx={{ width: 40, height: 5, borderRadius: "3px", bgcolor: "#E2D8C9", mx: "auto", mb: "18px" }} />
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16, textAlign: "center", mb: "6px" }}>
          PFC目標
        </Typography>
        <Typography sx={{ fontSize: 11, color: "text.secondary", textAlign: "center", mb: "16px", lineHeight: 1.6 }}>
          1日のたんぱく質・脂質・炭水化物の目標量(g)
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", mb: "16px" }}>
          {(
            [
              { key: "protein", label: "P たんぱく質" },
              { key: "fat", label: "F 脂質" },
              { key: "carbs", label: "C 炭水化物" },
            ] as const
          ).map(({ key, label }) => (
            <Box key={key}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: "text.secondary", mb: "5px", px: "2px" }}>
                {label}
              </Typography>
              <TextField
                value={pfcDraft[key]}
                onChange={(e) => setPfcDraft({ ...pfcDraft, [key]: e.target.value })}
                type="text"
                slotProps={{
                  htmlInput: {
                    inputMode: "numeric",
                    style: { textAlign: "center", fontFamily: fontRounded, fontWeight: 800, fontSize: 20 },
                  },
                  input: {
                    endAdornment: (
                      <Typography sx={{ fontFamily: fontRounded, color: "text.secondary", fontSize: 12 }}>g</Typography>
                    ),
                  },
                }}
              />
            </Box>
          ))}
        </Box>
        {pfcSuggestion === null ? (
          <>
            <Button
              fullWidth
              variant="outlined"
              color="secondary"
              onClick={handleAutoCalcPfc}
              disabled={!latestWeightRecord}
              startIcon={<IconSparkle />}
              sx={{ height: 44, borderRadius: "13px", fontSize: 13, mb: "16px" }}
            >
              体重と目標カロリーから自動計算
            </Button>
            {!latestWeightRecord && (
              <Typography sx={{ mt: "-8px", mb: "16px", fontSize: 11, color: "text.secondary", textAlign: "center" }}>
                体重を記録すると自動計算できます(手動入力は可能です)
              </Typography>
            )}
          </>
        ) : (
          <Box sx={{ bgcolor: tokens.secondarySoft, borderRadius: "16px", p: "14px 16px", mb: "16px" }}>
            <Typography sx={{ fontSize: 11, color: tokens.secondaryDeep, mb: "8px", lineHeight: 1.6 }}>
              提案: たんぱく質 = 体重×2.0g、脂質 = 目標カロリーの25%、炭水化物 = 残余
            </Typography>
            <Box sx={{ display: "flex", justifyContent: "space-around", mb: "12px" }}>
              {(
                [
                  ["P", pfcSuggestion.proteinG],
                  ["F", pfcSuggestion.fatG],
                  ["C", pfcSuggestion.carbsG],
                ] as const
              ).map(([label, grams]) => (
                <Box key={label} sx={{ textAlign: "center" }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: tokens.secondaryDeep }}>{label}</Typography>
                  <Typography sx={{ fontFamily: fontRounded, fontWeight: 800, fontSize: 20, color: tokens.secondaryDeep }}>
                    {grams}
                    <Box component="span" sx={{ fontSize: 12, fontWeight: 500, ml: "1px" }}>
                      g
                    </Box>
                  </Typography>
                </Box>
              ))}
            </Box>
            <Button
              fullWidth
              variant="contained"
              color="secondary"
              onClick={handleAdoptPfcSuggestion}
              sx={{ height: 42, borderRadius: "13px", fontSize: 13, boxShadow: tokens.secondaryButtonShadow }}
            >
              この値で入力する(調整できます)
            </Button>
          </Box>
        )}
        {!pfcAllEmpty && (
          <Button
            fullWidth
            variant="text"
            onClick={() => setPfcDraft({ protein: "", fat: "", carbs: "" })}
            sx={{ mb: "6px", color: "text.secondary" }}
          >
            未設定にする(3項目とも空にする)
          </Button>
        )}
        <Button
          fullWidth
          variant="contained"
          onClick={handleSavePfc}
          disabled={!canSavePfc}
          sx={{ height: 50, borderRadius: "14px", fontSize: 15, boxShadow: tokens.primaryButtonShadow }}
        >
          保存する
        </Button>
        <Button fullWidth variant="text" onClick={() => setPfcEditorOpen(false)} sx={{ mt: "6px", color: "text.secondary" }}>
          キャンセル
        </Button>
      </Drawer>
    </Box>
  );
}
