import { useLiveQuery } from "dexie-react-hooks";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import { IconCheck } from "@/components/icons";
import { getActiveHabitMasterItems } from "@/db/habitMaster";
import {
  getHabitRecordsByDateRange,
  getHabitRecordsForDate,
  markHabitDone,
  unmarkHabitDone,
} from "@/db/habitRecords";
import { addDaysToDateString, dateStringDaysAgo } from "@/lib/date";
import { currentStreakDays } from "@/lib/recording";
import { fontRounded, tokens } from "@/theme";

interface HabitChecklistProps {
  today: string;
}

const RECENT_WINDOW_DAYS = 27; // 直近28日(達成率・連続日数の集計窓)

/**
 * ホームの習慣チェックリスト(Issue #113)。アクティブな習慣を今日のチェック状態とともに表示し、
 * タップで記録のON/OFFを切り替える。習慣ごとに連続日数と直近7日の達成状況を可視化する(#46の考え方を流用)。
 */
export default function HabitChecklist({ today }: HabitChecklistProps) {
  const habits = useLiveQuery(() => getActiveHabitMasterItems(), []);
  const todayRecords = useLiveQuery(() => getHabitRecordsForDate(today), [today]);
  const recentRecords = useLiveQuery(
    () => getHabitRecordsByDateRange(dateStringDaysAgo(RECENT_WINDOW_DAYS), today),
    [today],
  );

  // アクティブな習慣が無ければセクションごと出さない(管理は設定画面。ホームを散らかさない)
  if (habits === undefined || todayRecords === undefined || recentRecords === undefined) return null;
  if (habits.length === 0) return null;

  const doneToday = new Set(todayRecords.map((r) => r.habitId));
  // 習慣ごとの実施日集合(連続日数・直近7日の達成数の集計に使う)
  const datesByHabit = new Map<string, Set<string>>();
  for (const record of recentRecords) {
    const set = datesByHabit.get(record.habitId) ?? new Set<string>();
    set.add(record.date);
    datesByHabit.set(record.habitId, set);
  }
  const last7Start = dateStringDaysAgo(6);
  const countLast7 = (habitId: string) => {
    const set = datesByHabit.get(habitId);
    if (!set) return 0;
    let count = 0;
    for (let date = last7Start; date <= today; date = addDaysToDateString(date, 1)) {
      if (set.has(date)) count += 1;
    }
    return count;
  };

  const toggle = async (habitId: string, habitName: string, isDone: boolean) => {
    if (isDone) {
      await unmarkHabitDone(today, habitId);
    } else {
      await markHabitDone({ date: today, habitId, habitName });
    }
  };

  const doneCount = habits.filter((habit) => doneToday.has(habit.id)).length;

  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", m: "24px 0 12px", px: "2px" }}>
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16 }}>今日の習慣</Typography>
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 12, color: "text.secondary" }}>
          {doneCount}/{habits.length}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {habits.map((habit) => {
          const isDone = doneToday.has(habit.id);
          const doneDates = datesByHabit.get(habit.id) ?? new Set<string>();
          const streak = currentStreakDays(doneDates, today);
          const last7 = countLast7(habit.id);
          return (
            <ButtonBase
              key={habit.id}
              onClick={() => toggle(habit.id, habit.name, isDone)}
              aria-pressed={isDone}
              sx={{
                bgcolor: "background.paper",
                borderRadius: "18px",
                boxShadow: tokens.rowCardShadow,
                p: "14px 15px",
                display: "flex",
                alignItems: "center",
                gap: "13px",
                textAlign: "left",
              }}
            >
              <Box
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: isDone ? "none" : `2px solid ${tokens.border}`,
                  bgcolor: isDone ? "secondary.main" : "transparent",
                  color: "#fff",
                }}
              >
                {isDone && <IconCheck size={16} />}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    fontFamily: fontRounded,
                    fontWeight: 700,
                    fontSize: 13,
                    color: isDone ? "text.primary" : "text.secondary",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {habit.name}
                </Typography>
                <Typography sx={{ fontSize: 11, color: tokens.faint }}>
                  直近7日 {last7}/{habit.targetWeeklyFrequency ?? 7}日
                </Typography>
              </Box>
              {streak > 0 && (
                <Typography
                  sx={{
                    fontFamily: fontRounded,
                    fontWeight: 700,
                    fontSize: 11,
                    color: tokens.secondaryDeep,
                    bgcolor: tokens.secondarySoft,
                    px: "9px",
                    py: "4px",
                    borderRadius: "20px",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  連続{streak}日
                </Typography>
              )}
            </ButtonBase>
          );
        })}
      </Box>
    </>
  );
}
