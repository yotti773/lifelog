import { useEffect, useState, type SubmitEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import RecordHeader from "@/components/RecordHeader";
import RecordSaveFooter from "@/components/RecordSaveFooter";
import {
  deleteBloodPressureRecord,
  getBloodPressureRecord,
  saveBloodPressureRecord,
} from "@/db/bloodPressureRecords";
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

/**
 * 血圧記録画面(Issue #117)。体重記録画面と同じ単一ファイル構成。
 * 家庭血圧の基準に合わせ「朝の測定値」を記録する運用を想定する。
 * アプリは医療機器ではないため、値の医学的判断はしない(注記のみ)。
 */
export default function BloodPressureRecordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editDate = searchParams.get("date");
  const isTodayParam = editDate === todayDateString();
  // 履歴確認画面の「記録を追加」から、入れ忘れた過去日を明示的に新規追加する場合に付く(Issue #141)
  const createParam = searchParams.get("create") === "1";
  const [loadStatus, setLoadStatus] = useState<LoadStatus>(editDate ? "loading" : "idle");
  const [dateTime, setDateTime] = useState(() => toDatetimeLocalValue(new Date().toISOString()));
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [pulse, setPulse] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editDate) {
      setLoadStatus("idle");
      return;
    }
    let cancelled = false;
    setLoadStatus("loading");
    void getBloodPressureRecord(editDate).then((record) => {
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
      setSystolic(String(record.systolic));
      setDiastolic(String(record.diastolic));
      setPulse(record.pulse !== undefined ? String(record.pulse) : "");
      setNote(record.note ?? "");
      setLoadStatus("loaded");
    });
    return () => {
      cancelled = true;
    };
  }, [editDate]);

  const isEditing = loadStatus === "loaded";
  const selectedDate = dateTime.slice(0, 10);

  const parsedSystolic = Number(systolic);
  const parsedDiastolic = Number(diastolic);
  const parsedPulse = Number(pulse);

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (systolic === "" || Number.isNaN(parsedSystolic)) {
      setError("最高血圧を入力してください");
      return;
    }
    if (diastolic === "" || Number.isNaN(parsedDiastolic)) {
      setError("最低血圧を入力してください");
      return;
    }
    if (pulse !== "" && Number.isNaN(parsedPulse)) {
      setError("脈拍は数値で入力してください");
      return;
    }
    await saveBloodPressureRecord({
      date: selectedDate,
      systolic: parsedSystolic,
      diastolic: parsedDiastolic,
      pulse: pulse !== "" ? parsedPulse : undefined,
      note: note.trim() || undefined,
      timestamp: new Date(dateTime).toISOString(),
    });
    const cameFromHistory = editDate !== null && !isTodayParam;
    navigate(
      cameFromHistory ? "/trends" : "/",
      cameFromHistory ? { state: { viewMode: "history", historyKind: "bloodPressure" } } : undefined,
    );
  };

  const handleDelete = async () => {
    if (!isEditing) return;
    await deleteBloodPressureRecord(selectedDate);
    navigate("/trends", { state: { viewMode: "history", historyKind: "bloodPressure" } });
  };

  if (loadStatus === "loading") {
    return <Typography sx={{ p: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>読み込み中...</Typography>;
  }

  if (loadStatus === "not-found") {
    return (
      <Box sx={{ mx: "auto", maxWidth: 448, px: "20px", pt: "16px", pb: "40px" }}>
        <RecordHeader title="記録が見つかりません" onBack={() => navigate("/trends", { state: { viewMode: "history", historyKind: "bloodPressure" } })} />
        <Card sx={{ p: "16px", mb: "16px" }}>
          <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
            指定された日付の血圧記録は見つかりませんでした。別の端末で削除された可能性があります。
          </Typography>
        </Card>
        <Button
          fullWidth
          variant="contained"
          onClick={() => navigate("/trends", { state: { viewMode: "history", historyKind: "bloodPressure" } })}
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
        title={isEditing ? "血圧を編集" : !isTodayParam && editDate ? `${formatMonthDay(selectedDate)}の血圧を記録` : "血圧を記録"}
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
          helperText={isEditing ? "日時は編集できません" : "起床後・朝の測定値の記録をおすすめします"}
          sx={{ mb: "14px" }}
        />

        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <Box>
            <FieldLabel>最高血圧</FieldLabel>
            <TextField
              fullWidth
              type="number"
              value={systolic}
              onChange={(e) => setSystolic(e.target.value)}
              placeholder="120"
              slotProps={{
                htmlInput: { step: "1", inputMode: "numeric", style: { fontFamily: fontRounded, fontWeight: 800, fontSize: 28 } },
                input: {
                  endAdornment: (
                    <Typography sx={{ fontFamily: fontRounded, fontWeight: 500, fontSize: 13, color: "text.secondary", ml: "4px" }}>
                      mmHg
                    </Typography>
                  ),
                },
              }}
            />
          </Box>
          <Box>
            <FieldLabel>最低血圧</FieldLabel>
            <TextField
              fullWidth
              type="number"
              value={diastolic}
              onChange={(e) => setDiastolic(e.target.value)}
              placeholder="80"
              slotProps={{
                htmlInput: { step: "1", inputMode: "numeric", style: { fontFamily: fontRounded, fontWeight: 800, fontSize: 28 } },
                input: {
                  endAdornment: (
                    <Typography sx={{ fontFamily: fontRounded, fontWeight: 500, fontSize: 13, color: "text.secondary", ml: "4px" }}>
                      mmHg
                    </Typography>
                  ),
                },
              }}
            />
          </Box>
        </Box>

        <Box sx={{ mt: "14px" }}>
          <FieldLabel optional>脈拍</FieldLabel>
          <TextField
            fullWidth
            type="number"
            value={pulse}
            onChange={(e) => setPulse(e.target.value)}
            placeholder="65"
            slotProps={{
              htmlInput: { step: "1", inputMode: "numeric", style: { fontFamily: fontRounded, fontWeight: 700, fontSize: 18 } },
              input: {
                endAdornment: <Typography sx={{ fontWeight: 500, color: "text.secondary" }}>bpm</Typography>,
              },
            }}
            sx={{ mb: "14px" }}
          />
        </Box>

        <FieldLabel optional>メモ</FieldLabel>
        <TextField
          fullWidth
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="測定前の体調 など"
        />

        {error && <Typography sx={{ mt: "12px", fontSize: 13, color: "primary.main" }}>{error}</Typography>}

        <RecordSaveFooter type="submit">
          {isEditing && (
            <Button
              fullWidth
              variant="text"
              onClick={handleDelete}
              sx={{ color: tokens.errorText, fontSize: 13 }}
            >
              この記録を削除
            </Button>
          )}
        </RecordSaveFooter>
      </Box>
    </Box>
  );
}
