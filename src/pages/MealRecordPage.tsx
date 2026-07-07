import { useEffect, useState, type ChangeEvent, type SubmitEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { judgeMealPhoto, type MealJudgmentItem } from "@/api/judgeMeal";
import FoodMasterPicker from "@/components/FoodMasterPicker";
import RecordHeader from "@/components/RecordHeader";
import SegmentedControl from "@/components/SegmentedControl";
import { IconCamera, IconLibrary, IconPlus, IconSparkle, IconWarning } from "@/components/icons";
import { addFoodMasterItem, getAllFoodMasterItems } from "@/db/foodMaster";
import { addMealRecord, deleteMealRecord, getMealRecord, updateMealRecord } from "@/db/mealRecords";
import { formatDateTime, nearestMealType, toDatetimeLocalValue } from "@/lib/date";
import { accent, fontRounded, tokens } from "@/theme";
import type { FoodMasterItem, MealType } from "@/types";

const MEAL_OPTIONS = [
  { value: "breakfast", label: "朝食" },
  { value: "lunch", label: "昼食" },
  { value: "dinner", label: "夕食" },
  { value: "snack", label: "間食" },
] as const;

const MEAL_TYPES = MEAL_OPTIONS.map((option) => option.value);
function isMealType(value: string | null): value is MealType {
  return value !== null && (MEAL_TYPES as readonly string[]).includes(value);
}

// PFC入力欄のラベル色(ハンドオフモックの系列色。theme.tsのaccent注記参照)
const PFC_FIELDS = [
  { key: "protein", label: "P", color: "#FF6B4A" },
  { key: "fat", label: "F", color: accent.main },
  { key: "carbs", label: "C", color: "#2EC4B6" },
] as const;

interface PendingMealItem {
  name: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  aiEstimatedName?: string;
  aiEstimatedKcal?: number;
  aiEstimatedProteinG?: number;
  aiEstimatedFatG?: number;
  aiEstimatedCarbsG?: number;
  registerToMaster: boolean;
  // 由来が写真判定の場合、PhotoJudgeState.items内のindex。リストから削除したときに
  // 検出品目の「追加済み」を解除して再選択できるようにするために持つ
  detectedIndex?: number;
}

// 写真AI判定の結果一式。リセット(撮り直し・失敗時)を1代入で済ませるため、
// 判定に属する状態は個別のuseStateに分けずこのオブジェクトにまとめて持つ
interface PhotoJudgeState {
  items: MealJudgmentItem[];
  isUncertain: boolean;
  // フォームに反映中の品目のindex(手入力・マスタ選択に切り替えたらnull)
  activeIndex: number | null;
  // 「まとめて記録リスト」に追加済みの品目のindex
  addedIndexes: ReadonlySet<number>;
}

type LoadStatus = "idle" | "loading" | "loaded" | "not-found";

// 検出品目リストと「まとめて記録する品目」リストで共通の品目名表示
function ItemRowLabel({ name, kcal }: { name: string; kcal: number }) {
  return (
    <Typography sx={{ fontSize: 13, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
      {name}({Math.round(kcal)}kcal)
    </Typography>
  );
}

function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary", mb: "6px", mt: "4px" }}>
      {children}
      {optional && (
        <Box component="span" sx={{ color: tokens.faint2, fontWeight: 400 }}>
          (任意)
        </Box>
      )}
    </Typography>
  );
}

export default function MealRecordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // ホーム画面の品目タップから ?id=<MealRecord.id> 付きで遷移してきた場合は編集モードになる
  const editId = searchParams.get("id");
  // ホーム画面の食事区分ラベルタップから ?type=<MealType> 付きで遷移してきた場合、
  // その区分をプリセットした状態で新規記録を開く(編集時はレコードの区分を優先するため無視する)
  const presetType = searchParams.get("type");
  const [loadStatus, setLoadStatus] = useState<LoadStatus>(editId ? "loading" : "idle");
  const [mealType, setMealType] = useState<MealType>(() =>
    !editId && isMealType(presetType) ? presetType : nearestMealType(),
  );
  const [dateTime, setDateTime] = useState(() => toDatetimeLocalValue(new Date().toISOString()));
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [proteinG, setProteinG] = useState("");
  const [fatG, setFatG] = useState("");
  const [carbsG, setCarbsG] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [note, setNote] = useState("");
  const [isJudging, setJudging] = useState(false);
  const [judgeError, setJudgeError] = useState<string | null>(null);
  const [judge, setJudge] = useState<PhotoJudgeState | null>(null);
  const [registerToMaster, setRegisterToMaster] = useState(false);
  const [pendingItems, setPendingItems] = useState<PendingMealItem[]>([]);
  // 保存時に未追加の検出品目が残っていた場合の確認ダイアログ(保存対象を保持)
  const [saveConfirm, setSaveConfirm] = useState<{ items: PendingMealItem[]; unaddedCount: number } | null>(null);

  // フォームに反映中のAI判定品目(judgeから導出。独立したstateにすると同期漏れの温床になる)
  const aiJudgment: MealJudgmentItem | null =
    judge !== null && judge.activeIndex !== null ? judge.items[judge.activeIndex] : null;

  const foodMasterItems = useLiveQuery(() => getAllFoodMasterItems(), []);

  useEffect(() => {
    if (!editId) {
      setLoadStatus("idle");
      return;
    }
    let cancelled = false;
    setLoadStatus("loading");
    void getMealRecord(editId).then((record) => {
      if (cancelled) return;
      if (!record) {
        setLoadStatus("not-found");
        return;
      }
      setMealType(record.mealType);
      setDateTime(toDatetimeLocalValue(record.timestamp));
      setName(record.confirmedName);
      setKcal(String(record.confirmedKcal));
      setProteinG(String(record.confirmedProteinG));
      setFatG(String(record.confirmedFatG));
      setCarbsG(String(record.confirmedCarbsG));
      setLoadStatus("loaded");
    });
    return () => {
      cancelled = true;
    };
  }, [editId]);

  const isEditing = loadStatus === "loaded";

  const parsedKcal = Number(kcal);
  const parsedProteinG = Number(proteinG);
  const parsedFatG = Number(fatG);
  const parsedCarbsG = Number(carbsG);

  const pfcValues = { protein: proteinG, fat: fatG, carbs: carbsG };
  const pfcSetters = { protein: setProteinG, fat: setFatG, carbs: setCarbsG };

  // フォームの5項目(料理名・kcal・PFC)を埋める共通処理。AI推定値は丸めて表示する
  const fillItemForm = (
    itemName: string,
    itemKcal: number,
    itemProteinG: number,
    itemFatG: number,
    itemCarbsG: number,
    options?: { round?: boolean },
  ) => {
    const format = (value: number) => String(options?.round ? Math.round(value) : value);
    setName(itemName);
    setKcal(format(itemKcal));
    setProteinG(format(itemProteinG));
    setFatG(format(itemFatG));
    setCarbsG(format(itemCarbsG));
  };

  const handlePhotoSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setJudging(true);
    setJudgeError(null);
    // 判定が失敗しても前回の写真の検出品目リストが残らないよう、先にクリアする
    setJudge(null);
    try {
      const result = await judgeMealPhoto(file, mealType, note);
      setJudge({ items: result.items, isUncertain: result.isUncertain, activeIndex: 0, addedIndexes: new Set() });
      // 前の写真由来の品目とindexで対応づかないよう、pendingItems側の紐づけは切っておく
      setPendingItems((prev) => prev.map(({ detectedIndex: _detectedIndex, ...rest }) => rest));
      const first = result.items[0];
      fillItemForm(first.dishName, first.kcal, first.proteinG, first.fatG, first.carbsG, { round: true });
    } catch (err) {
      setJudgeError(err instanceof Error ? err.message : "食事の判定に失敗しました");
    } finally {
      setJudging(false);
    }
  };

  const handleSelectDetected = (index: number) => {
    if (!judge || judge.addedIndexes.has(index)) return;
    setJudge({ ...judge, activeIndex: index });
    const item = judge.items[index];
    fillItemForm(item.dishName, item.kcal, item.proteinG, item.fatG, item.carbsG, { round: true });
  };

  const handleSelectMaster = (item: FoodMasterItem) => {
    setJudge((prev) => (prev ? { ...prev, activeIndex: null } : prev));
    fillItemForm(item.name, item.kcal, item.proteinG, item.fatG, item.carbsG);
  };

  const isCurrentItemFilled =
    name.trim() !== "" && kcal !== "" && proteinG !== "" && fatG !== "" && carbsG !== "";

  const buildCurrentItem = (): PendingMealItem | null => {
    if (
      !isCurrentItemFilled ||
      Number.isNaN(parsedKcal) ||
      Number.isNaN(parsedProteinG) ||
      Number.isNaN(parsedFatG) ||
      Number.isNaN(parsedCarbsG)
    ) {
      return null;
    }
    return {
      name: name.trim(),
      kcal: parsedKcal,
      proteinG: parsedProteinG,
      fatG: parsedFatG,
      carbsG: parsedCarbsG,
      aiEstimatedName: aiJudgment?.dishName,
      aiEstimatedKcal: aiJudgment?.kcal,
      aiEstimatedProteinG: aiJudgment?.proteinG,
      aiEstimatedFatG: aiJudgment?.fatG,
      aiEstimatedCarbsG: aiJudgment?.carbsG,
      registerToMaster,
      detectedIndex: judge !== null && judge.activeIndex !== null ? judge.activeIndex : undefined,
    };
  };

  const resetItemFields = () => {
    setName("");
    setKcal("");
    setProteinG("");
    setFatG("");
    setCarbsG("");
    setNote("");
    setRegisterToMaster(false);
    setJudge((prev) => (prev ? { ...prev, activeIndex: null } : prev));
  };

  const handleAddToList = () => {
    const item = buildCurrentItem();
    if (!item) {
      setError("料理名・カロリー・PFC(たんぱく質/脂質/炭水化物)を入力してください");
      return;
    }
    setPendingItems((prev) => [...prev, item]);
    if (judge !== null && judge.activeIndex !== null) {
      const added = new Set(judge.addedIndexes);
      added.add(judge.activeIndex);
      setJudge({ ...judge, activeIndex: null, addedIndexes: added });
    }
    resetItemFields();
    setError(null);
  };

  const handleRemovePending = (index: number) => {
    const removed = pendingItems[index];
    setPendingItems((prev) => prev.filter((_, i) => i !== index));
    // 写真判定由来の品目なら「追加済み」を解除し、検出リストから選び直せるようにする
    if (removed?.detectedIndex !== undefined) {
      setJudge((prev) => {
        if (!prev) return prev;
        const added = new Set(prev.addedIndexes);
        added.delete(removed.detectedIndex!);
        return { ...prev, addedIndexes: added };
      });
    }
  };

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isEditing && editId) {
      if (!isCurrentItemFilled || Number.isNaN(parsedKcal) || Number.isNaN(parsedProteinG) || Number.isNaN(parsedFatG) || Number.isNaN(parsedCarbsG)) {
        setError("料理名・カロリー・PFC(たんぱく質/脂質/炭水化物)を入力してください");
        return;
      }
      await updateMealRecord(editId, {
        mealType,
        confirmedName: name.trim(),
        confirmedKcal: parsedKcal,
        confirmedProteinG: parsedProteinG,
        confirmedFatG: parsedFatG,
        confirmedCarbsG: parsedCarbsG,
        timestamp: new Date(dateTime).toISOString(),
      });
      navigate("/");
      return;
    }

    const currentItem = buildCurrentItem();
    const items = currentItem ? [...pendingItems, currentItem] : pendingItems;
    if (items.length === 0) {
      setError("料理名・カロリー・PFC(たんぱく質/脂質/炭水化物)を入力してください");
      return;
    }

    // 複数品目を検出したのに未追加のまま保存しようとしたら、記録漏れでないか確認を挟む
    // (旧挙動では全品目の合計値が記録されていたため、気づかないと黙って過小記録になる)
    if (judge !== null && judge.items.length > 1) {
      const savedActiveIndex = currentItem !== null ? judge.activeIndex : null;
      const unaddedCount = judge.items.filter(
        (_, i) => !judge.addedIndexes.has(i) && i !== savedActiveIndex,
      ).length;
      if (unaddedCount > 0) {
        setSaveConfirm({ items, unaddedCount });
        return;
      }
    }

    await saveItems(items);
  };

  const saveItems = async (items: PendingMealItem[]) => {
    for (const item of items) {
      await addMealRecord({
        mealType,
        confirmedName: item.name,
        confirmedKcal: item.kcal,
        confirmedProteinG: item.proteinG,
        confirmedFatG: item.fatG,
        confirmedCarbsG: item.carbsG,
        timestamp: new Date(dateTime).toISOString(),
        aiEstimatedName: item.aiEstimatedName,
        aiEstimatedKcal: item.aiEstimatedKcal,
        aiEstimatedProteinG: item.aiEstimatedProteinG,
        aiEstimatedFatG: item.aiEstimatedFatG,
        aiEstimatedCarbsG: item.aiEstimatedCarbsG,
      });
      if (item.registerToMaster) {
        await addFoodMasterItem({
          name: item.name,
          kcal: item.kcal,
          proteinG: item.proteinG,
          fatG: item.fatG,
          carbsG: item.carbsG,
        });
      }
    }
    navigate("/");
  };

  const handleDelete = async () => {
    if (!editId) return;
    await deleteMealRecord(editId);
    navigate("/");
  };

  if (loadStatus === "loading") {
    return <Typography sx={{ p: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>読み込み中...</Typography>;
  }

  if (loadStatus === "not-found") {
    return (
      <Box sx={{ mx: "auto", maxWidth: 448, px: "20px", pt: "16px", pb: "40px" }}>
        <RecordHeader title="記録が見つかりません" onBack={() => navigate("/")} />
        <Card sx={{ p: "16px", mb: "16px" }}>
          <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
            指定された食事記録は見つかりませんでした。別の端末で削除された可能性があります。
          </Typography>
        </Card>
        <Button
          fullWidth
          variant="contained"
          onClick={() => navigate("/")}
          sx={{ height: 50, borderRadius: "14px", boxShadow: tokens.primaryButtonShadow }}
        >
          ホームに戻る
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ mx: "auto", maxWidth: 448, px: "20px", pt: "16px", pb: isEditing ? "180px" : "120px" }}>
      <RecordHeader title={isEditing ? "食事を編集" : "食事を記録"} onBack={() => navigate(-1)} />

      <Box component="form" onSubmit={handleSubmit}>
        <FieldLabel>区分</FieldLabel>
        <Box sx={{ mb: "16px" }}>
          <SegmentedControl options={MEAL_OPTIONS} value={mealType} onChange={setMealType} activeVariant="primary" />
        </Box>

        {aiJudgment && (
          <Box sx={{ display: "flex", alignItems: "center", gap: "8px", bgcolor: tokens.secondarySoft, borderRadius: "12px", p: "10px 13px", mb: "16px" }}>
            <Box sx={{ color: tokens.secondaryDeep, display: "flex" }}>
              <IconSparkle />
            </Box>
            <Typography sx={{ fontSize: 12, fontWeight: 500, color: tokens.secondaryDeep }}>
              写真AIの判定結果を反映しました。確認して修正できます
            </Typography>
          </Box>
        )}

        <FieldLabel>日時</FieldLabel>
        <TextField
          fullWidth
          type="datetime-local"
          value={dateTime}
          onChange={(e) => setDateTime(e.target.value)}
          sx={{ mb: "14px" }}
        />

        <FieldLabel>料理名</FieldLabel>
        <TextField
          fullWidth
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: 鶏肉と野菜炒め"
          sx={{ mb: "14px" }}
        />

        <FieldLabel>カロリー</FieldLabel>
        <TextField
          fullWidth
          type="number"
          value={kcal}
          onChange={(e) => setKcal(e.target.value)}
          placeholder="580"
          slotProps={{
            htmlInput: { inputMode: "numeric", style: { fontFamily: fontRounded, fontWeight: 700, fontSize: 18 } },
            input: {
              endAdornment: <Typography sx={{ fontWeight: 500, color: "text.secondary" }}>kcal</Typography>,
            },
          }}
          sx={{ mb: "14px" }}
        />

        <FieldLabel>PFC(たんぱく質 / 脂質 / 炭水化物)</FieldLabel>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", mb: "18px" }}>
          {PFC_FIELDS.map(({ key, label, color }) => (
            <Box
              key={key}
              sx={{
                bgcolor: "background.paper",
                border: `1.5px solid ${tokens.border}`,
                borderRadius: "14px",
                p: "11px 10px 8px",
                textAlign: "center",
                boxShadow: tokens.fieldShadow,
              }}
            >
              <Typography sx={{ fontSize: 10, fontWeight: 700, color, mb: "2px" }}>{label}</Typography>
              <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "2px" }}>
                <TextField
                  variant="standard"
                  type="number"
                  value={pfcValues[key]}
                  onChange={(e) => pfcSetters[key](e.target.value)}
                  placeholder="0"
                  slotProps={{
                    htmlInput: {
                      inputMode: "numeric",
                      style: { fontFamily: fontRounded, fontWeight: 700, fontSize: 18, textAlign: "center" },
                      "aria-label": `${label}(g)`,
                    },
                    input: { disableUnderline: true },
                  }}
                  sx={{ width: 56 }}
                />
                <Typography sx={{ fontSize: 11, fontWeight: 500, color: "text.secondary" }}>g</Typography>
              </Box>
            </Box>
          ))}
        </Box>

        {!isEditing && (
          <>
            <Card sx={{ p: "15px", mb: "14px", borderRadius: "18px", boxShadow: tokens.rowCardShadow }}>
              <Typography sx={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: fontRounded, fontWeight: 700, fontSize: 13, mb: "12px" }}>
                <Box component="span" sx={{ color: "primary.main", display: "flex" }}>
                  <IconCamera size={16} />
                </Box>
                写真から記録する
              </Typography>
              <Box sx={{ display: "flex", gap: "8px", mb: "12px" }}>
                <Button
                  component="label"
                  disabled={isJudging}
                  startIcon={<IconCamera />}
                  sx={{ flex: 1, height: 44, borderRadius: "11px", bgcolor: tokens.primarySoft, color: "primary.main", fontSize: 12, "&:hover": { bgcolor: tokens.primarySoft } }}
                >
                  {isJudging ? "判定中..." : "撮影"}
                  <input type="file" accept="image/*" capture="environment" onChange={handlePhotoSelected} disabled={isJudging} hidden />
                </Button>
                <Button
                  component="label"
                  disabled={isJudging}
                  startIcon={<IconLibrary />}
                  sx={{ flex: 1, height: 44, borderRadius: "11px", bgcolor: tokens.beigeSoft, color: "text.secondary", fontSize: 12, "&:hover": { bgcolor: tokens.beigeSoft } }}
                >
                  {isJudging ? "判定中..." : "ライブラリ"}
                  <input type="file" accept="image/*" onChange={handlePhotoSelected} disabled={isJudging} hidden />
                </Button>
              </Box>
              <TextField
                fullWidth
                size="small"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="補足(任意): 唐揚げ弁当、ご飯少なめ など"
              />
              {judgeError && <Typography sx={{ mt: "10px", fontSize: 12, color: "primary.main" }}>{judgeError}</Typography>}
              {judge?.isUncertain && aiJudgment !== null && (
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: "7px", mt: "10px", bgcolor: tokens.warnBg, borderRadius: "10px", p: "9px 11px" }}>
                  <Box sx={{ color: "#B07E1E", display: "flex", mt: "1px" }}>
                    <IconWarning />
                  </Box>
                  <Typography sx={{ fontSize: 11, fontWeight: 500, color: "#B07E1E", lineHeight: 1.5 }}>
                    量や内容の判定の自信が低いため、誤差が大きい場合があります。内容を確認・修正してください
                  </Typography>
                </Box>
              )}
            </Card>

            {judge !== null && judge.items.length > 1 && (
              <Card sx={{ p: "15px", mb: "14px", borderRadius: "18px", boxShadow: tokens.rowCardShadow }}>
                <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13, mb: "4px" }}>
                  検出した品目({judge.items.length}件)
                </Typography>
                <Typography sx={{ fontSize: 11, color: "text.secondary", mb: "10px" }}>
                  タップしてフォームに反映し、内容を確認してから下の「この品目を追加してもう1品記録」でリストに入れてください
                </Typography>
                {judge.items.map((item, index) => {
                  const isAdded = judge.addedIndexes.has(index);
                  const isActive = judge.activeIndex === index;
                  return (
                    <ButtonBase
                      key={index}
                      onClick={() => handleSelectDetected(index)}
                      disabled={isAdded}
                      sx={{
                        width: "100%",
                        justifyContent: "space-between",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        py: "9px",
                        px: "8px",
                        borderRadius: "10px",
                        bgcolor: isActive ? tokens.secondarySoft : "transparent",
                        opacity: isAdded ? 0.5 : 1,
                        borderBottom: index < judge.items.length - 1 ? `1px solid ${tokens.divider}` : "none",
                      }}
                    >
                      <ItemRowLabel name={item.dishName} kcal={item.kcal} />
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: isAdded ? "text.secondary" : "primary.main", flexShrink: 0 }}>
                        {isAdded ? "追加済み" : isActive ? "選択中" : "選ぶ"}
                      </Typography>
                    </ButtonBase>
                  );
                })}
              </Card>
            )}

            <Card sx={{ p: "15px", mb: "14px", borderRadius: "18px", boxShadow: tokens.rowCardShadow }}>
              <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13, mb: "12px" }}>
                よく食べるものから選ぶ
              </Typography>
              <FoodMasterPicker items={foodMasterItems ?? []} onSelect={handleSelectMaster} />
            </Card>

            {pendingItems.length > 0 && (
              <Card sx={{ p: "15px", mb: "14px", borderRadius: "18px", boxShadow: tokens.rowCardShadow }}>
                <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13, mb: "8px" }}>
                  今回まとめて記録する品目({pendingItems.length}件)
                </Typography>
                {pendingItems.map((item, index) => (
                  <Box
                    key={index}
                    sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", py: "6px", borderBottom: index < pendingItems.length - 1 ? `1px solid ${tokens.divider}` : "none" }}
                  >
                    <ItemRowLabel name={item.name} kcal={item.kcal} />
                    <Button size="small" onClick={() => handleRemovePending(index)} sx={{ fontSize: 12, color: "primary.main", flexShrink: 0 }}>
                      削除
                    </Button>
                  </Box>
                ))}
              </Card>
            )}

            <ButtonBase
              onClick={handleAddToList}
              sx={{
                width: "100%",
                height: 48,
                border: "1.5px dashed #E0B7A8",
                borderRadius: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "7px",
                color: "primary.main",
                mb: "8px",
              }}
            >
              <IconPlus size={16} />
              <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13 }}>
                この品目を追加してもう1品記録
              </Typography>
            </ButtonBase>

            <FormControlLabel
              control={
                <Checkbox
                  checked={registerToMaster}
                  onChange={(e) => setRegisterToMaster(e.target.checked)}
                  sx={{ "&.Mui-checked": { color: "primary.main" } }}
                />
              }
              label={
                <Typography sx={{ fontSize: 13 }}>
                  この内容をマスタに登録する(次回から選んで入力できるようになります)
                </Typography>
              }
              sx={{ px: "2px", alignItems: "flex-start", "& .MuiCheckbox-root": { pt: 0 } }}
            />
            {registerToMaster && (
              <Typography sx={{ fontSize: 11, color: "text.secondary", px: "2px", mt: "4px" }}>
                外食チェーン・コンビニの商品は「【モス】モスバーガー」のように店名を含めておくと、食事マスタ一覧で見分けやすくなります
              </Typography>
            )}
          </>
        )}

        {isEditing && (
          <Typography sx={{ bgcolor: tokens.beigeSoft, borderRadius: "11px", p: "10px 12px", fontSize: 11, color: "text.secondary" }}>
            更新すると同期状態は「未同期」に戻り、次回の同期対象になります
          </Typography>
        )}
        {error && <Typography sx={{ mt: "12px", fontSize: 13, color: "primary.main" }}>{error}</Typography>}

        {/* 下部固定の保存ボタン */}
        <Box
          sx={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            p: "14px 20px 26px",
            background: "linear-gradient(180deg,rgba(255,248,240,0),#FFF8F0 34%)",
            zIndex: 10,
          }}
        >
          <Box sx={{ mx: "auto", maxWidth: 408, display: "flex", flexDirection: "column", gap: "8px" }}>
            <Button
              fullWidth
              type="submit"
              variant="contained"
              sx={{ height: 54, borderRadius: "16px", fontSize: 16, boxShadow: tokens.primaryButtonShadow }}
            >
              {isEditing
                ? "更新する"
                : pendingItems.length > 0
                  ? `まとめて保存する(${pendingItems.length + (isCurrentItemFilled ? 1 : 0)}件)`
                  : "保存する"}
            </Button>
            {isEditing && (
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setDeleteConfirmOpen(true)}
                sx={{ height: 44, borderRadius: "14px", fontSize: 14, color: "primary.main", borderColor: "primary.main", bgcolor: "background.default" }}
              >
                この記録を削除する
              </Button>
            )}
          </Box>
        </Box>
      </Box>

      <Dialog open={saveConfirm !== null} onClose={() => setSaveConfirm(null)}>
        <DialogTitle sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16 }}>
          追加していない検出品目があります
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: 14 }}>
            写真から検出した品目のうち{saveConfirm?.unaddedCount}件がまだリストに追加されていません。追加していない品目は記録されませんが、このまま保存しますか?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button fullWidth variant="outlined" onClick={() => setSaveConfirm(null)} sx={{ color: "text.secondary", borderColor: tokens.border }}>
            戻る
          </Button>
          <Button
            fullWidth
            variant="contained"
            onClick={() => {
              if (!saveConfirm) return;
              const { items } = saveConfirm;
              setSaveConfirm(null);
              void saveItems(items);
            }}
          >
            このまま保存する
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16 }}>この記録を削除しますか?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: 14 }}>
            {name}({kcal}kcal・{MEAL_OPTIONS.find((option) => option.value === mealType)?.label}{" "}
            {formatDateTime(new Date(dateTime).toISOString())})を削除します。この操作は取り消せません。
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button fullWidth variant="outlined" onClick={() => setDeleteConfirmOpen(false)} sx={{ color: "text.secondary", borderColor: tokens.border }}>
            キャンセル
          </Button>
          <Button fullWidth variant="contained" onClick={handleDelete}>
            削除する
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
