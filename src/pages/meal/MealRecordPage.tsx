import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import { judgeMealPhoto, MAX_MEAL_PHOTOS } from "@/api/judgeMeal";
import RecordHeader from "@/components/RecordHeader";
import RecordSaveFooter from "@/components/RecordSaveFooter";
import { IconPlus, IconSparkle } from "@/components/icons";
import { MEAL_TYPE_META, isMealType } from "@/components/mealTypeMeta";
import { addFoodMasterItem, getAllFoodMasterItems } from "@/db/foodMaster";
import {
  getMealRecordsForDateAndType,
  replaceMealRecordsForDateAndType,
  type MealItemInput,
} from "@/db/mealRecords";
import { formatMonthDay, nearestMealType, toDatetimeLocalValue, todayDateString } from "@/lib/date";
import { accent, fontRounded, tokens } from "@/theme";
import type { FoodMasterItem } from "@/types";
import FoodMasterPicker from "./FoodMasterPicker";
import MealItemCard, { emptyMealItem, type MealItemDraft } from "./MealItemCard";
import PhotoJudgeCard from "./PhotoJudgeCard";

const isEmptyItem = (item: MealItemDraft) =>
  item.name.trim() === "" && item.kcal === "" && item.proteinG === "" && item.fatG === "" && item.carbsG === "";

// 合計サマリの系列色(theme.tsのaccent注記参照)
const SUMMARY_MACROS = [
  { key: "protein", label: "P", color: "#FF6B4A" },
  { key: "fat", label: "F", color: accent.main },
  { key: "carbs", label: "C", color: "#2EC4B6" },
] as const;

export default function MealRecordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const today = todayDateString();
  // ホーム・履歴から ?type=<区分>&date=<日付> 付きで遷移してくる(dateは省略時=当日。筋トレのStrengthRecordPageと同じ考え方)
  const dateParam = searchParams.get("date");
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const isToday = date === today;
  const typeParam = searchParams.get("type");
  const mealType = isMealType(typeParam) ? typeParam : nearestMealType();
  const meta = MEAL_TYPE_META[mealType];

  // 過去日を開いたときだけ戻り先を履歴タブ(食事)にする(体重・筋トレ記録画面と同じ考え方)
  const backTo = () =>
    isToday ? navigate("/") : navigate("/trends", { state: { viewMode: "history", historyKind: "meal" } });

  const [isLoading, setLoading] = useState(true);
  const [dateTime, setDateTime] = useState("");
  const [items, setItems] = useState<MealItemDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 写真AIによる解析(選択→備考→解析の流れ。Issue #71)
  const [photos, setPhotos] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [isJudging, setJudging] = useState(false);
  const [judgeError, setJudgeError] = useState<string | null>(null);
  // 直近の解析結果の情報(反映件数・自信の低さ)。写真解析後の確認表示に使う
  const [judgeInfo, setJudgeInfo] = useState<{ count: number; uncertain: boolean } | null>(null);

  const foodMasterItems = useLiveQuery(() => getAllFoodMasterItems(), []);

  // その日のその区分の記録を下書きとして読み込む(新規/編集で画面を分けない。画面設計書4章)
  useEffect(() => {
    let cancelled = false;
    void getMealRecordsForDateAndType(date, mealType).then((records) => {
      if (cancelled) return;
      if (records.length > 0) {
        setItems(
          records.map((record) => ({
            name: record.confirmedName,
            kcal: String(record.confirmedKcal),
            proteinG: String(record.confirmedProteinG),
            fatG: String(record.confirmedFatG),
            carbsG: String(record.confirmedCarbsG),
            registerToMaster: false,
            ai:
              record.aiEstimatedName !== undefined
                ? {
                    name: record.aiEstimatedName,
                    kcal: record.aiEstimatedKcal ?? 0,
                    proteinG: record.aiEstimatedProteinG ?? 0,
                    fatG: record.aiEstimatedFatG ?? 0,
                    carbsG: record.aiEstimatedCarbsG ?? 0,
                  }
                : undefined,
          })),
        );
        setDateTime(toDatetimeLocalValue(records[0].timestamp));
      } else {
        setItems([emptyMealItem()]);
        // 新規時の日時: 当日は現在時刻、過去日はその日の12:00を初期値にする
        setDateTime(isToday ? toDatetimeLocalValue(new Date().toISOString()) : `${date}T12:00`);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [date, mealType, isToday]);

  const updateItem = (index: number, patch: Partial<MealItemDraft>) => {
    setError(null);
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeItem = (index: number) => {
    setError(null);
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // 写真AI・マスタ選択で得た品目を末尾に足す。最初の空カード1枚だけの状態なら置き換える(空カードが残らないように)
  const appendItems = (newItems: MealItemDraft[]) => {
    setError(null);
    setItems((prev) => (prev.length === 1 && isEmptyItem(prev[0]) ? newItems : [...prev, ...newItems]));
  };

  const handlePhotosSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setPhotos((prev) => [...prev, ...files].slice(0, MAX_MEAL_PHOTOS));
    setJudgeError(null);
  };

  const handleJudge = async () => {
    if (photos.length === 0) return;
    setJudging(true);
    setJudgeError(null);
    try {
      const result = await judgeMealPhoto(photos, mealType, note);
      appendItems(
        result.items.map((detected) => ({
          name: detected.dishName,
          kcal: String(Math.round(detected.kcal)),
          proteinG: String(Math.round(detected.proteinG)),
          fatG: String(Math.round(detected.fatG)),
          carbsG: String(Math.round(detected.carbsG)),
          registerToMaster: false,
          ai: {
            name: detected.dishName,
            kcal: detected.kcal,
            proteinG: detected.proteinG,
            fatG: detected.fatG,
            carbsG: detected.carbsG,
          },
        })),
      );
      setJudgeInfo({ count: result.items.length, uncertain: result.isUncertain });
      // 同じ写真を再解析して二重に反映されないよう、解析後は選択をクリアする(備考は残す)
      setPhotos([]);
    } catch (err) {
      setJudgeError(err instanceof Error ? err.message : "食事の判定に失敗しました");
    } finally {
      setJudging(false);
    }
  };

  const handleSelectMaster = (item: FoodMasterItem) => {
    appendItems([
      {
        name: item.name,
        kcal: String(item.kcal),
        proteinG: String(item.proteinG),
        fatG: String(item.fatG),
        carbsG: String(item.carbsG),
        registerToMaster: false,
      },
    ]);
  };

  const totals = useMemo(
    () =>
      items.reduce(
        (acc, item) => ({
          kcal: acc.kcal + (Number(item.kcal) || 0),
          protein: acc.protein + (Number(item.proteinG) || 0),
          fat: acc.fat + (Number(item.fatG) || 0),
          carbs: acc.carbs + (Number(item.carbsG) || 0),
        }),
        { kcal: 0, protein: 0, fat: 0, carbs: 0 },
      ),
    [items],
  );

  const filledCount = items.filter((item) => item.name.trim() !== "").length;

  const handleSave = async () => {
    // 完全に空のカードは除外して当区分の当日分を置き換える(画面設計書4章)
    const cleaned = items
      .map((item) => ({ ...item, name: item.name.trim() }))
      .filter((item) => !isEmptyItem(item));
    // 名前だけ空で数値が入っている品目は保存できない(何の記録か分からないため)。ブロックする
    const nameless = cleaned.find((item) => item.name === "");
    if (nameless) {
      setError("料理名が空の品目があります。名前を入れるか、その品目を削除してください");
      return;
    }
    const inputs: MealItemInput[] = cleaned.map((item) => ({
      confirmedName: item.name,
      confirmedKcal: Number(item.kcal) || 0,
      confirmedProteinG: Number(item.proteinG) || 0,
      confirmedFatG: Number(item.fatG) || 0,
      confirmedCarbsG: Number(item.carbsG) || 0,
      aiEstimatedName: item.ai?.name,
      aiEstimatedKcal: item.ai?.kcal,
      aiEstimatedProteinG: item.ai?.proteinG,
      aiEstimatedFatG: item.ai?.fatG,
      aiEstimatedCarbsG: item.ai?.carbsG,
    }));
    // 保存先の日付は入り口で確定した date に固定し、日時フィールドからは時刻だけを採る。
    // これにより「置き換える対象(date・区分)」と「保存するレコードの日付」が必ず一致し、
    // 日付部分を変えても別日へ取り違えて重複・取り残しが起きないようにする。
    const picked = new Date(dateTime);
    const [year, month, day] = date.split("-").map(Number);
    picked.setFullYear(year, month - 1, day);
    const timestamp = picked.toISOString();
    await replaceMealRecordsForDateAndType(date, mealType, timestamp, inputs);
    for (const item of cleaned.filter((item) => item.registerToMaster)) {
      await addFoodMasterItem({
        name: item.name,
        kcal: Number(item.kcal) || 0,
        proteinG: Number(item.proteinG) || 0,
        fatG: Number(item.fatG) || 0,
        carbsG: Number(item.carbsG) || 0,
      });
    }
    backTo();
  };

  if (isLoading) {
    return <Typography sx={{ p: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>読み込み中...</Typography>;
  }

  return (
    <Box sx={{ mx: "auto", maxWidth: 448, px: "20px", pt: "16px", pb: "120px" }}>
      <RecordHeader
        title={isToday ? `${meta.label}を記録` : `${formatMonthDay(date)}の${meta.label}を記録`}
        onBack={backTo}
      />

      <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary", mb: "7px", ml: "2px" }}>日時</Typography>
      <TextField
        fullWidth
        type="datetime-local"
        value={dateTime}
        onChange={(e) => setDateTime(e.target.value)}
        sx={{ mb: "16px" }}
      />

      {/* 入力手段は「画像解析→マスタ選択→品目カード」(画面設計書4章) */}
      <PhotoJudgeCard
        isJudging={isJudging}
        photos={photos}
        note={note}
        onNoteChange={setNote}
        onPhotosSelected={handlePhotosSelected}
        onRemovePhoto={(index) => setPhotos((prev) => prev.filter((_, i) => i !== index))}
        onJudge={handleJudge}
        judgeError={judgeError}
        showUncertainWarning={judgeInfo?.uncertain === true}
      />

      {judgeInfo && (
        <Box sx={{ display: "flex", alignItems: "center", gap: "8px", bgcolor: tokens.secondarySoft, borderRadius: "12px", p: "10px 13px", mb: "14px" }}>
          <Box sx={{ color: tokens.secondaryDeep, display: "flex" }}>
            <IconSparkle />
          </Box>
          <Typography sx={{ fontSize: 12, fontWeight: 500, color: tokens.secondaryDeep }}>
            写真AIが{judgeInfo.count}件を品目に反映しました。内容を確認して修正できます
          </Typography>
        </Box>
      )}

      <Card sx={{ p: "15px", mb: "16px", borderRadius: "18px", boxShadow: tokens.rowCardShadow }}>
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13, mb: "12px" }}>
          よく食べるものから選ぶ
        </Typography>
        <FoodMasterPicker items={foodMasterItems ?? []} onSelect={handleSelectMaster} />
      </Card>

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "10px", px: "2px" }}>
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13 }}>品目</Typography>
        <Typography sx={{ fontSize: 11, fontWeight: 500, color: "text.secondary" }}>カロリー・PFC</Typography>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {items.map((item, index) => (
          <MealItemCard
            key={index}
            index={index}
            item={item}
            onChange={(patch) => updateItem(index, patch)}
            onRemove={() => removeItem(index)}
          />
        ))}
      </Box>

      <ButtonBase
        onClick={() => setItems((prev) => [...prev, emptyMealItem()])}
        sx={{ width: "100%", height: 48, mt: "12px", border: "1.5px dashed #E0B7A8", borderRadius: "14px", gap: "7px", color: "primary.main" }}
      >
        <IconPlus size={16} />
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13, color: "primary.main" }}>
          品目を追加
        </Typography>
      </ButtonBase>

      {filledCount > 0 && (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: "16px", bgcolor: tokens.primarySoft, borderRadius: "16px", p: "13px 16px" }}>
          <Box>
            <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13, color: "primary.dark" }}>
              {meta.label}の合計
            </Typography>
            <Box sx={{ display: "flex", gap: "12px", mt: "3px" }}>
              {SUMMARY_MACROS.map(({ key, label, color }) => (
                <Typography key={key} sx={{ fontSize: 11, fontWeight: 700, color }}>
                  {label} {Math.round(totals[key])}g
                </Typography>
              ))}
            </Box>
          </Box>
          <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 22, color: "primary.dark" }}>
            {Math.round(totals.kcal).toLocaleString()}
            <Box component="span" sx={{ fontSize: 11, fontWeight: 700, ml: "2px" }}>
              kcal
            </Box>
          </Typography>
        </Box>
      )}

      {error && <Typography sx={{ mt: "12px", fontSize: 13, color: "primary.main" }}>{error}</Typography>}

      <RecordSaveFooter onClick={handleSave} label={filledCount > 0 ? `保存する(${filledCount}品)` : "保存する"} />
    </Box>
  );
}
