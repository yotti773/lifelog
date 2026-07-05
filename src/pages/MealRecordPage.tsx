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
import { judgeMealPhoto, type MealJudgment } from "@/api/judgeMeal";
import FoodMasterPicker from "@/components/FoodMasterPicker";
import RecordHeader from "@/components/RecordHeader";
import SegmentedControl from "@/components/SegmentedControl";
import { IconCamera, IconLibrary, IconPlus } from "@/components/icons";
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
}

type LoadStatus = "idle" | "loading" | "loaded" | "not-found";

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
  const [aiJudgment, setAiJudgment] = useState<MealJudgment | null>(null);
  const [registerToMaster, setRegisterToMaster] = useState(false);
  const [pendingItems, setPendingItems] = useState<PendingMealItem[]>([]);

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

  const handlePhotoSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setJudging(true);
    setJudgeError(null);
    try {
      const judgment = await judgeMealPhoto(file, mealType, note);
      setAiJudgment(judgment);
      setName(judgment.dishName);
      setKcal(String(Math.round(judgment.kcal)));
      setProteinG(String(Math.round(judgment.proteinG)));
      setFatG(String(Math.round(judgment.fatG)));
      setCarbsG(String(Math.round(judgment.carbsG)));
    } catch (err) {
      setJudgeError(err instanceof Error ? err.message : "食事の判定に失敗しました");
    } finally {
      setJudging(false);
    }
  };

  const handleSelectMaster = (item: FoodMasterItem) => {
    setAiJudgment(null);
    setName(item.name);
    setKcal(String(item.kcal));
    setProteinG(String(item.proteinG));
    setFatG(String(item.fatG));
    setCarbsG(String(item.carbsG));
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
    };
  };

  const resetItemFields = () => {
    setName("");
    setKcal("");
    setProteinG("");
    setFatG("");
    setCarbsG("");
    setNote("");
    setAiJudgment(null);
    setRegisterToMaster(false);
  };

  const handleAddToList = () => {
    const item = buildCurrentItem();
    if (!item) {
      setError("料理名・カロリー・PFC(たんぱく質/脂質/炭水化物)を入力してください");
      return;
    }
    setPendingItems((prev) => [...prev, item]);
    resetItemFields();
    setError(null);
  };

  const handleRemovePending = (index: number) => {
    setPendingItems((prev) => prev.filter((_, i) => i !== index));
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
            <Typography sx={{ fontSize: 15 }}>✨</Typography>
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
              {aiJudgment?.isMixedOrUncertain && (
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: "7px", mt: "10px", bgcolor: tokens.warnBg, borderRadius: "10px", p: "9px 11px" }}>
                  <Typography sx={{ fontSize: 13, lineHeight: 1.4 }}>⚠️</Typography>
                  <Typography sx={{ fontSize: 11, fontWeight: 500, color: "#B07E1E", lineHeight: 1.5 }}>
                    複数の料理が写っている、または判定の自信が低いため、誤差が大きい場合があります。上の内容を確認・修正してください
                  </Typography>
                </Box>
              )}
            </Card>

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
                    <Typography sx={{ fontSize: 13, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.name}({item.kcal}kcal)
                    </Typography>
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
