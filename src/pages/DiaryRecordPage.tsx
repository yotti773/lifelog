import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MoodIcon, { MOOD_DEFS, MOOD_ORDER } from "@/components/MoodIcon";
import RecordHeader from "@/components/RecordHeader";
import RecordSaveFooter from "@/components/RecordSaveFooter";
import SectionLabel from "@/components/SectionLabel";
import { deleteDiaryRecord, getDiaryRecord, saveDiaryRecord } from "@/db/diaryRecords";
import { formatMonthDay, todayDateString } from "@/lib/date";
import { tokens } from "@/theme";
import type { DiaryMood } from "@/types";

export default function DiaryRecordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const today = todayDateString();
  // 履歴確認画面から ?date=YYYY-MM-DD 付きで遷移してきた場合、その日付の日記を開く(Issue #73)
  const dateParam = searchParams.get("date");
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const isToday = date === today;
  // 過去日を開いたときだけ、戻り先を履歴タブ(日記)にする(体重記録画面と同じ考え方)
  const backToHistory = () =>
    isToday ? navigate("/") : navigate("/trends", { state: { viewMode: "history", historyKind: "diary" } });

  const [isLoading, setLoading] = useState(true);
  const [mood, setMood] = useState<DiaryMood | null>(null);
  const [text, setText] = useState("");

  // 日記は日付キーの1日1件(後勝ち)。その日の分があればドラフトとして読み込む(画面設計書6章)
  useEffect(() => {
    let cancelled = false;
    void getDiaryRecord(date).then((record) => {
      if (cancelled) return;
      if (record) {
        setMood(record.mood ?? null);
        setText(record.text);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const handleSave = async () => {
    // 本文・気分の両方が空なら「未記録に戻す」扱いで当日分を削除する(画面設計書6章)。
    // 判定と保存でtrim済みの本文をそろえ、空白のみの本文が「記録あり」として残らないようにする
    const trimmedText = text.trim();
    if (trimmedText === "" && mood === null) {
      await deleteDiaryRecord(date);
    } else {
      await saveDiaryRecord({ date, text: trimmedText, mood: mood ?? undefined });
    }
    backToHistory();
  };

  if (isLoading) {
    return <Typography sx={{ p: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>読み込み中...</Typography>;
  }

  return (
    <Box sx={{ mx: "auto", maxWidth: 448, px: "20px", pt: "16px", pb: "110px" }}>
      <RecordHeader title={isToday ? "日記" : `${formatMonthDay(date)}の日記`} onBack={backToHistory} />

      <SectionLabel>{isToday ? "今日の気分" : "この日の気分"}</SectionLabel>
      <Box sx={{ display: "flex", gap: "8px", mb: "20px" }}>
        {MOOD_ORDER.map((key) => {
          const selected = mood === key;
          return (
            <ButtonBase
              key={key}
              // 気分タグは任意のため、選択中のタイルをもう一度タップすると解除できる
              onClick={() => setMood(selected ? null : key)}
              aria-label={`気分: ${MOOD_DEFS[key].label}`}
              aria-pressed={selected}
              sx={{
                flex: 1,
                aspectRatio: "1",
                flexDirection: "column",
                gap: "3px",
                borderRadius: "14px",
                bgcolor: selected ? tokens.moodSelectedBg : "background.paper",
                border: `2px solid ${selected ? tokens.moodBorder : tokens.border}`,
              }}
            >
              <MoodIcon mood={key} />
              <Typography sx={{ fontSize: 9, fontWeight: 600, color: tokens.moodLabel }}>
                {MOOD_DEFS[key].label}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>

      <SectionLabel>ひとこと日記</SectionLabel>
      <TextField
        fullWidth
        multiline
        minRows={7}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="今日はどんな一日でしたか？"
        slotProps={{ htmlInput: { style: { fontSize: 14, lineHeight: 1.7 } } }}
      />

      <RecordSaveFooter onClick={handleSave} />
    </Box>
  );
}
