import { useEffect, useState, type SubmitEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import RecordHeader from "@/components/RecordHeader";
import RecordSaveFooter from "@/components/RecordSaveFooter";
import { IconArrow } from "@/components/icons";
import { db } from "@/db/db";
import { getWeightRecord, saveWeightRecord } from "@/db/weightRecords";
import { formatMonthDay, toDatetimeLocalValue, todayDateString } from "@/lib/date";
import { fontRounded, tokens } from "@/theme";

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

export default function WeightRecordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // 履歴確認画面(Trends)の行タップ、またはホーム画面の体重/体脂肪率カードタップから
  // ?date=YYYY-MM-DD 付きで遷移してきた場合、その日付の既存記録があれば編集モードになる
  const editDate = searchParams.get("date");
  // ホームからは当日の日付が渡ってくるが、当日分がまだ未記録のこともあるため、
  // その場合は「見つかりません」ではなく新規入力として扱う
  const isTodayParam = editDate === todayDateString();
  // 履歴確認画面の「記録を追加」から、入れ忘れた過去日を明示的に新規追加する場合に付く(Issue #141)。
  // これが無いのに未記録日を開いた場合は、タップ後に別端末で削除された可能性があるとみなし「見つかりません」を出す
  const createParam = searchParams.get("create") === "1";
  const [loadStatus, setLoadStatus] = useState<LoadStatus>(editDate ? "loading" : "idle");
  const [dateTime, setDateTime] = useState(() => toDatetimeLocalValue(new Date().toISOString()));
  const [weightKg, setWeightKg] = useState("");
  const [bodyFatPercent, setBodyFatPercent] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editDate) {
      setLoadStatus("idle");
      return;
    }
    let cancelled = false;
    setLoadStatus("loading");
    void getWeightRecord(editDate).then((record) => {
      if (cancelled) return;
      if (!record) {
        if (!isTodayParam && !createParam) {
          setLoadStatus("not-found");
          return;
        }
        // 過去日への新規追加は時刻が分からないため正午固定にする(当日は現在時刻のまま)
        if (!isTodayParam) {
          setDateTime(toDatetimeLocalValue(new Date(`${editDate}T12:00:00`).toISOString()));
        }
        setLoadStatus("idle");
        return;
      }
      setDateTime(toDatetimeLocalValue(record.timestamp));
      setWeightKg(String(record.weightKg));
      setBodyFatPercent(record.bodyFatPercent !== undefined ? String(record.bodyFatPercent) : "");
      setNote(record.note ?? "");
      setLoadStatus("loaded");
    });
    return () => {
      cancelled = true;
    };
  }, [editDate]);

  const isEditing = loadStatus === "loaded";
  const selectedDate = dateTime.slice(0, 10);
  const previous = useLiveQuery(
    () => db.weightRecords.where("date").below(selectedDate).last(),
    [selectedDate],
  );

  const parsedWeight = Number(weightKg);
  const diff =
    previous && weightKg !== "" && !Number.isNaN(parsedWeight) ? parsedWeight - previous.weightKg : null;

  const parsedBodyFatPercent = Number(bodyFatPercent);

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (weightKg === "" || Number.isNaN(parsedWeight)) {
      setError("体重を入力してください");
      return;
    }
    if (bodyFatPercent !== "" && Number.isNaN(parsedBodyFatPercent)) {
      setError("体脂肪率は数値で入力してください");
      return;
    }
    await saveWeightRecord({
      date: selectedDate,
      weightKg: parsedWeight,
      bodyFatPercent: bodyFatPercent !== "" ? parsedBodyFatPercent : undefined,
      note: note.trim() || undefined,
      timestamp: new Date(dateTime).toISOString(),
    });
    // 履歴確認画面からの編集(今日より前の日付)のみ、保存後は履歴タブに戻す。
    // ホームからの遷移(当日分の新規/編集)は今まで通りホームに戻る
    const cameFromHistory = editDate !== null && !isTodayParam;
    navigate(cameFromHistory ? "/trends" : "/", cameFromHistory ? { state: { viewMode: "history" } } : undefined);
  };

  if (loadStatus === "loading") {
    return <Typography sx={{ p: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>読み込み中...</Typography>;
  }

  if (loadStatus === "not-found") {
    return (
      <Box sx={{ mx: "auto", maxWidth: 448, px: "20px", pt: "16px", pb: "40px" }}>
        <RecordHeader title="記録が見つかりません" onBack={() => navigate("/trends", { state: { viewMode: "history" } })} />
        <Card sx={{ p: "16px", mb: "16px" }}>
          <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
            指定された日付の体重記録は見つかりませんでした。別の端末で削除された可能性があります。
          </Typography>
        </Card>
        <Button
          fullWidth
          variant="contained"
          onClick={() => navigate("/trends", { state: { viewMode: "history" } })}
          sx={{ height: 50, borderRadius: "14px", boxShadow: tokens.primaryButtonShadow }}
        >
          履歴に戻る
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ mx: "auto", maxWidth: 448, px: "20px", pt: "16px", pb: "110px" }}>
      <RecordHeader
        title={isEditing ? "体重を編集" : !isTodayParam && editDate ? `${formatMonthDay(selectedDate)}の体重を記録` : "体重を記録"}
        onBack={() => navigate(-1)}
      />

      <Box component="form" onSubmit={handleSubmit}>
        <FieldLabel>日時</FieldLabel>
        <TextField
          fullWidth
          type="datetime-local"
          value={dateTime}
          onChange={(e) => setDateTime(e.target.value)}
          disabled={isEditing}
          helperText={isEditing ? "日時は編集できません" : undefined}
          sx={{ mb: "14px" }}
        />

        <FieldLabel>体重</FieldLabel>
        <TextField
          fullWidth
          type="number"
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
          placeholder="72.0"
          slotProps={{
            htmlInput: { step: "0.1", inputMode: "decimal", style: { fontFamily: fontRounded, fontWeight: 800, fontSize: 34 } },
            input: {
              endAdornment: (
                <Typography sx={{ fontFamily: fontRounded, fontWeight: 500, fontSize: 18, color: "text.secondary", ml: "8px" }}>
                  kg
                </Typography>
              ),
            },
          }}
          sx={{ mb: "8px" }}
        />
        {diff !== null && (
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              color: diff <= 0 ? "secondary.main" : "primary.main",
              mb: "6px",
            }}
          >
            <IconArrow up={diff > 0} size={12} />
            <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13 }}>
              前回比 {Math.abs(diff).toFixed(1)}kg
            </Typography>
          </Box>
        )}

        <FieldLabel optional>体脂肪率</FieldLabel>
        <TextField
          fullWidth
          type="number"
          value={bodyFatPercent}
          onChange={(e) => setBodyFatPercent(e.target.value)}
          placeholder="24.5"
          slotProps={{
            htmlInput: { step: "0.1", inputMode: "decimal", style: { fontFamily: fontRounded, fontWeight: 700, fontSize: 18 } },
            input: {
              endAdornment: <Typography sx={{ fontWeight: 500, color: "text.secondary" }}>%</Typography>,
            },
          }}
          sx={{ mb: "14px" }}
        />

        <FieldLabel optional>メモ</FieldLabel>
        <TextField
          fullWidth
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="筋トレ後 / 飲み会翌日 など"
        />

        {error && <Typography sx={{ mt: "12px", fontSize: 13, color: "primary.main" }}>{error}</Typography>}

        <RecordSaveFooter type="submit" />
      </Box>
    </Box>
  );
}
