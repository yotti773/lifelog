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
import { judgeMealPhoto, MAX_MEAL_PHOTOS, type MealJudgmentItem } from "@/api/judgeMeal";
import RecordHeader from "@/components/RecordHeader";
import RecordSaveFooter from "@/components/RecordSaveFooter";
import SegmentedControl from "@/components/SegmentedControl";
import { IconPlus, IconSparkle } from "@/components/icons";
import { addFoodMasterItem, getAllFoodMasterItems } from "@/db/foodMaster";
import { addMealRecord, deleteMealRecord, getMealRecord, updateMealRecord } from "@/db/mealRecords";
import { formatDateTime, nearestMealType, toDatetimeLocalValue } from "@/lib/date";
import { accent, fontRounded, tokens } from "@/theme";
import type { FoodMasterItem, MealType } from "@/types";
import DetectedItemsCard from "./DetectedItemsCard";
import FoodMasterPicker from "./FoodMasterPicker";
import ManualMealItemAdder from "./ManualMealItemAdder";
import PendingItemsCard, { type PendingMealItem } from "./PendingItemsCard";
import PhotoJudgeCard from "./PhotoJudgeCard";

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
  // 解析対象の写真(複数枚可、最大MAX_MEAL_PHOTOS枚。Issue #110)。
  // 選択と解析を分離し、備考入力後に「AIで解析する」で実行する(Issue #71)
  const [photos, setPhotos] = useState<File[]>([]);
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

  const handlePhotosSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    // 既存の選択に追加する(上限を超えた分は切り捨て)。撮影→ライブラリの混在も可
    setPhotos((prev) => [...prev, ...files].slice(0, MAX_MEAL_PHOTOS));
    setJudgeError(null);
  };

  const handleJudge = async () => {
    if (photos.length === 0) return;
    setJudging(true);
    setJudgeError(null);
    // 解析が失敗しても前回の写真の検出品目リストが残らないよう、先にクリアする
    setJudge(null);
    try {
      const result = await judgeMealPhoto(photos, mealType, note);
      // 編集時は検出品目でフォーム(=編集対象レコード)を勝手に上書きせず、
      // 検出リストから選んで「追加で記録する品目」に積んでもらう(Issue #71)
      setJudge({
        items: result.items,
        isUncertain: result.isUncertain,
        activeIndex: isEditing ? null : 0,
        addedIndexes: new Set(),
      });
      // 前の写真由来の品目とindexで対応づかないよう、pendingItems側の紐づけは切っておく
      setPendingItems((prev) => prev.map(({ detectedIndex: _detectedIndex, ...rest }) => rest));
      if (!isEditing) {
        const first = result.items[0];
        fillItemForm(first.dishName, first.kcal, first.proteinG, first.fatG, first.carbsG, { round: true });
      }
    } catch (err) {
      setJudgeError(err instanceof Error ? err.message : "食事の判定に失敗しました");
    } finally {
      setJudging(false);
    }
  };

  const handleSelectDetected = (index: number) => {
    if (!judge || judge.addedIndexes.has(index)) return;
    const item = judge.items[index];
    if (isEditing) {
      // 編集対象のフォームには触れず、同じ区分・日時の新規レコード候補として直接積む(Issue #71)
      setPendingItems((prev) => [
        ...prev,
        {
          name: item.dishName,
          kcal: Math.round(item.kcal),
          proteinG: Math.round(item.proteinG),
          fatG: Math.round(item.fatG),
          carbsG: Math.round(item.carbsG),
          aiEstimatedName: item.dishName,
          aiEstimatedKcal: item.kcal,
          aiEstimatedProteinG: item.proteinG,
          aiEstimatedFatG: item.fatG,
          aiEstimatedCarbsG: item.carbsG,
          registerToMaster: false,
          detectedIndex: index,
        },
      ]);
      const added = new Set(judge.addedIndexes);
      added.add(index);
      setJudge({ ...judge, addedIndexes: added });
      return;
    }
    setJudge({ ...judge, activeIndex: index });
    fillItemForm(item.dishName, item.kcal, item.proteinG, item.fatG, item.carbsG, { round: true });
  };

  const handleSelectMaster = (item: FoodMasterItem) => {
    if (isEditing) {
      // 編集時のマスタ選択は「追加で記録する品目」への直接追加(Issue #71)
      setPendingItems((prev) => [
        ...prev,
        { name: item.name, kcal: item.kcal, proteinG: item.proteinG, fatG: item.fatG, carbsG: item.carbsG, registerToMaster: false },
      ]);
      return;
    }
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
    // 備考(note)は写真解析用の入力なので、品目をリストに追加してもクリアしない(Issue #71)
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
    // 次の品目の入力手段(画像解析・マスタ選択)は画面上部にあるため、追加後はトップへ戻す
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      // 検出したのに追加していない品目が残っていれば、新規保存時と同様に確認を挟む
      if (judge !== null) {
        const unaddedCount = judge.items.filter((_, i) => !judge.addedIndexes.has(i)).length;
        if (unaddedCount > 0) {
          setSaveConfirm({ items: pendingItems, unaddedCount });
          return;
        }
      }
      await finalizeSave(pendingItems);
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

    await finalizeSave(items);
  };

  /**
   * 保存の最終処理。編集時はフォームの内容で編集対象レコードを上書きしたうえで、
   * itemsを同じ区分・日時の新規レコードとして追加する(Issue #71。新規時はitemsが全品目)
   */
  const finalizeSave = async (items: PendingMealItem[]) => {
    if (isEditing && editId) {
      await updateMealRecord(editId, {
        mealType,
        confirmedName: name.trim(),
        confirmedKcal: parsedKcal,
        confirmedProteinG: parsedProteinG,
        confirmedFatG: parsedFatG,
        confirmedCarbsG: parsedCarbsG,
        timestamp: new Date(dateTime).toISOString(),
      });
      if (registerToMaster) {
        await addFoodMasterItem({
          name: name.trim(),
          kcal: parsedKcal,
          proteinG: parsedProteinG,
          fatG: parsedFatG,
          carbsG: parsedCarbsG,
        });
      }
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
    <Box sx={{ mx: "auto", maxWidth: 448, px: "20px", pt: "16px", pb: isEditing ? "240px" : "190px" }}>
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

        {/* 並びは「画像解析→マスタ選択→手入力」(Issue #71)。手入力フォームは反映先なので最後に置く */}
        <PhotoJudgeCard
          isJudging={isJudging}
          photos={photos}
          note={note}
          onNoteChange={setNote}
          onPhotosSelected={handlePhotosSelected}
          onRemovePhoto={(index) => setPhotos((prev) => prev.filter((_, i) => i !== index))}
          onJudge={handleJudge}
          judgeError={judgeError}
          showUncertainWarning={judge?.isUncertain === true && (isEditing || aiJudgment !== null)}
        />

        {/* 編集時は1品だけの検出でもリストとして出す(タップで「追加で記録する品目」へ入れるため) */}
        {judge !== null && (isEditing ? judge.items.length > 0 : judge.items.length > 1) && (
          <DetectedItemsCard
            items={judge.items}
            activeIndex={judge.activeIndex}
            addedIndexes={judge.addedIndexes}
            onSelect={handleSelectDetected}
          />
        )}

        <Card sx={{ p: "15px", mb: "14px", borderRadius: "18px", boxShadow: tokens.rowCardShadow }}>
          <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13, mb: isEditing ? "4px" : "12px" }}>
            よく食べるものから選ぶ
          </Typography>
          {isEditing && (
            <Typography sx={{ fontSize: 11, color: "text.secondary", mb: "10px" }}>
              選ぶと「追加で記録する品目」に入ります(編集中の内容は変わりません)
            </Typography>
          )}
          <FoodMasterPicker items={foodMasterItems ?? []} onSelect={handleSelectMaster} />
        </Card>

        {/* 編集時は写真判定・マスタ選択に加えて、手入力でも「追加で記録する品目」に積めるようにする(Issue #99)。
            編集フォーム本体(下の料理名〜PFC欄)は編集対象レコードを指すため、追加用の入力欄を分けている */}
        {isEditing && <ManualMealItemAdder onAdd={(item) => setPendingItems((prev) => [...prev, item])} />}

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
              {/* 3桁入力でも数値と単位「g」が別行に折り返さないよう1行固定にする(Issue #93) */}
              <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "2px", whiteSpace: "nowrap" }}>
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

        {pendingItems.length > 0 && (
          <PendingItemsCard
            items={pendingItems}
            onRemove={handleRemovePending}
            title={isEditing ? "追加で記録する品目" : undefined}
            footnote={isEditing ? "追加分は編集中の記録と同じ区分・日時の新しい記録として保存されます" : undefined}
          />
        )}

        {registerToMaster && (
          <Typography sx={{ fontSize: 11, color: "text.secondary", px: "2px", mb: "10px" }}>
            「マスタに登録」にチェック中: 保存時に入力中の内容が食事マスタへ登録されます。外食チェーン・コンビニの商品は「【モス】モスバーガー」のように店名を含めておくと、食事マスタ一覧で見分けやすくなります
          </Typography>
        )}

        {isEditing && (
          <Typography sx={{ bgcolor: tokens.beigeSoft, borderRadius: "11px", p: "10px 12px", fontSize: 11, color: "text.secondary" }}>
            更新すると同期状態は「未同期」に戻り、次回の同期対象になります
          </Typography>
        )}
        {error && <Typography sx={{ mt: "12px", fontSize: 13, color: "primary.main" }}>{error}</Typography>}

        <RecordSaveFooter
          type="submit"
          label={
            isEditing
              ? pendingItems.length > 0
                ? `更新する(+${pendingItems.length}件追加)`
                : "更新する"
              : pendingItems.length > 0
                ? `まとめて保存する(${pendingItems.length + (isCurrentItemFilled ? 1 : 0)}件)`
                : "保存する"
          }
          topAccessory={
            <Box sx={{ display: "flex", gap: "8px" }}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={registerToMaster}
                    onChange={(e) => setRegisterToMaster(e.target.checked)}
                    sx={{ py: "6px", "&.Mui-checked": { color: "primary.main" } }}
                  />
                }
                label={<Typography sx={{ fontSize: 12, fontWeight: 500 }}>マスタに登録</Typography>}
                sx={{
                  flex: 1,
                  m: 0,
                  bgcolor: "background.paper",
                  border: `1.5px solid ${tokens.border}`,
                  borderRadius: "12px",
                  pl: "4px",
                  boxShadow: tokens.fieldShadow,
                }}
              />
              {/* 編集時の追加はマスタ選択・検出品目タップから直接行うため、このボタンは新規時のみ */}
              {!isEditing && (
                <ButtonBase
                  onClick={handleAddToList}
                  sx={{
                    border: "1.5px dashed #E0B7A8",
                    borderRadius: "12px",
                    px: "13px",
                    color: "primary.main",
                    gap: "5px",
                    bgcolor: "background.default",
                  }}
                >
                  <IconPlus size={14} />
                  <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 12 }}>もう1品追加</Typography>
                </ButtonBase>
              )}
            </Box>
          }
        >
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
        </RecordSaveFooter>
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
              void finalizeSave(items);
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
