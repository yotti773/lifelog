export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface WeightRecord {
  id: string;
  date: string; // YYYY-MM-DD, 1日1件のキー
  timestamp: string; // ISO8601, 最後に保存した時刻
  weightKg: number;
  bodyFatPercent?: number; // 体脂肪率(%)。任意入力
  note?: string;
  synced: boolean; // スプレッドシートへの同期済みフラグ
}

/**
 * 血圧記録(Issue #117)。体重記録と同型で、dateを1日1件のキー(後勝ち)にする。
 * 家庭血圧の基準に合わせ「朝の測定値」を記録する運用を想定(体重と同じ朝のリズム)。
 * アプリは医療機器ではないため、値の医学的判断はせず事実の提示に留める(要件定義書フェーズ4)。
 */
export interface BloodPressureRecord {
  id: string;
  date: string; // YYYY-MM-DD, 1日1件のキー
  timestamp: string; // ISO8601, 最後に保存した時刻
  systolic: number; // 収縮期(最高血圧)mmHg
  diastolic: number; // 拡張期(最低血圧)mmHg
  pulse?: number; // 脈拍(bpm)。任意入力
  note?: string;
  synced: boolean; // スプレッドシートへの同期済みフラグ
}

/**
 * 周囲径記録(Issue #118)。体重記録と同型で、dateを1日1件のキー(後勝ち)にする。
 * 減量停滞期に体重が動かなくても腹囲は減っていることが多く、体重以外の進捗指標になる。
 * 月1回程度の低頻度入力を想定。腹囲を必須とし、胸囲・太ももは任意。
 */
export interface BodyMeasurementRecord {
  id: string;
  date: string; // YYYY-MM-DD, 1日1件のキー
  timestamp: string; // ISO8601, 最後に保存した時刻
  waistCm: number; // 腹囲(cm)。必須
  chestCm?: number; // 胸囲(cm)。任意
  thighCm?: number; // 太もも(cm)。任意
  note?: string;
  synced: boolean; // スプレッドシートへの同期済みフラグ
}

/**
 * 習慣マスタ(Issue #113)。「ストレッチ」「読書」「血圧の薬」等の、やった/やらないだけを記録する習慣。
 * 食事マスタ・種目マスタと同じ構成で設定画面から管理する。同名の重複登録は弾く(チェックリストの識別のため)。
 */
export interface HabitMasterItem {
  id: string;
  name: string;
  targetWeeklyFrequency?: number; // 目標頻度(週あたり日数、1〜7)。任意
  archived: boolean; // アーカイブ済み(チェックリストに出さないが記録は残す)
  order: number; // チェックリストの並び順(小さいほど上。同値は登録順)
  createdAt: string; // ISO8601
  synced: boolean; // スプレッドシートへの同期済みフラグ
}

/**
 * 習慣記録(Issue #113)。日付×習慣のチェック1件。1日1習慣1件・後勝ち。
 * idは`${date}_${habitId}`の合成キーで、これによりput()だけで上書きが成立する(体重・日記と同じ考え方)。
 * チェックを外す操作は記録の削除(トゥームストーンを残す)で表す — 記録の存在が「その日にやった」を意味する。
 * habitNameは書き出したシートの可読性のための非正規化コピー(筋トレのexerciseNameと同じ)。
 */
export interface HabitRecord {
  id: string; // `${date}_${habitId}`
  date: string; // YYYY-MM-DD
  habitId: string;
  habitName: string; // 記録時点の習慣名のコピー(シート表示用)
  timestamp: string; // ISO8601
  synced: boolean; // スプレッドシートへの同期済みフラグ
}

export interface MealRecord {
  id: string;
  timestamp: string; // ISO8601
  mealType: MealType;
  photoLocalRef?: string;
  aiEstimatedName?: string;
  aiEstimatedKcal?: number;
  aiEstimatedProteinG?: number;
  aiEstimatedFatG?: number;
  aiEstimatedCarbsG?: number;
  confirmedName: string;
  confirmedKcal: number;
  confirmedProteinG: number;
  confirmedFatG: number;
  confirmedCarbsG: number;
  /**
   * この区分は食べなかった、という明示的な記録(Issue #143)。trueの場合、その日・その区分の
   * MealRecordはこの1件のみを持つ(replaceMealRecordsForDateAndTypeが丸ごと置き換えるため)。
   * 「未記録」(MealRecordが0件)と区別するためのフラグで、kcal/PFCは0で保存する。
   */
  skipped?: boolean;
  synced: boolean; // スプレッドシートへの同期済みフラグ
}

export interface FoodMasterItem {
  id: string;
  name: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  source?: string; // 出典(公式栄養成分表のURL等)。事前登録の数値検証用、任意
  createdAt: string; // ISO8601
  synced: boolean; // スプレッドシートへの同期済みフラグ(Issue #96)
}

/**
 * 水分記録。1回のクイック追加=1レコード(画面設計書5章)。
 * 量の編集UIは持たず、訂正は削除→再記録で行う。
 */
export interface WaterRecord {
  id: string;
  timestamp: string; // ISO8601, 記録した瞬間の時刻
  amountMl: number;
  synced: boolean; // スプレッドシートへの同期済みフラグ(Issue #72)
}

/** 日記の気分タグ(絶好調/良い/普通/眠い/不調の5段階。画面設計書6章) */
export type DiaryMood = "great" | "good" | "ok" | "tired" | "bad";

export interface DiaryRecord {
  id: string;
  date: string; // YYYY-MM-DD, 1日1件のキー(体重と同様の後勝ち)
  timestamp: string; // ISO8601, 最後に保存した時刻
  text: string;
  mood?: DiaryMood;
  /**
   * 飲酒タグ(Issue #112)。気分タグと同列の任意入力で、週次レビューのクロス分析の集計軸に使う。
   * トグルONで保存した日だけtrue。未設定(undefined)は「記録していない」であり「飲酒なし」とは断定しない
   */
  alcohol?: boolean;
  synced: boolean; // スプレッドシートへの同期済みフラグ(Issue #72)。本文も含めて同期する
}

/**
 * 筋トレ記録。1セット=1レコードで、種目単位の合計値は持たない(画面設計書7章)。
 * 保存は「その日の全レコードの置き換え」で行うため、dateが置き換えの単位になる。
 */
export interface WorkoutRecord {
  id: string;
  date: string; // YYYY-MM-DD, 記録日(当日分置き換えの単位)
  timestamp: string; // ISO8601, 同じ保存操作で確定した全セットが共通で持つ
  exerciseName: string; // 自由入力(種目マスタのサジェストから選んだ場合も名前のコピー)
  exerciseOrder: number; // 画面上で何番目の種目カードか(1始まり)
  setNumber: number; // 何セット目か(1始まり)
  weightKg: number;
  reps: number;
  synced: boolean; // スプレッドシートへの同期済みフラグ(Issue #72)
}

/** 種目マスタの部位分類(固定選択肢・任意。Issue #104)。自由入力は表記ゆれで将来の部位別集計に使えないため設けない */
export type ExerciseBodyPart = "chest" | "back" | "shoulders" | "arms" | "legs" | "core" | "other";

export interface ExerciseMasterItem {
  id: string;
  name: string; // 食事マスタと異なり数値項目は持たない(重量・回数は毎回変わるため。画面設計書7.1章)
  bodyPart?: ExerciseBodyPart; // 部位分類(任意。Issue #104)
  createdAt: string; // ISO8601
  synced: boolean; // スプレッドシートへの同期済みフラグ(Issue #96)
}

/**
 * Garmin由来の日次活動記録(Issue #81)。シートの「活動記録」タブ(Garmin連携が書き込む。
 * scripts/garmin/README.md 参照)からの取り込み専用で、アプリ内での作成・編集・削除はしない —
 * 真実の情報源はGarmin側のため、取り込みは他と違い常に上書き(シート優先)でよい。
 * 全項目がGarminの計測状況次第で欠けうるため、date以外はすべて任意。
 */
export interface ActivityRecord {
  date: string; // YYYY-MM-DD, 1日1件のキー
  steps?: number;
  totalKcal?: number; // 総消費カロリー(基礎代謝込み)
  activeKcal?: number; // 活動消費カロリー
  sleepMinutes?: number;
  sleepScore?: number; // Garminの睡眠スコア(0〜100)
  restingHeartRate?: number; // 安静時心拍数(bpm)
  moderateIntensityMinutes?: number; // 中強度運動時間(分)
  vigorousIntensityMinutes?: number; // 高強度運動時間(分)
  synced: boolean; // 常にtrue(シート由来・取り込み専用。push対象にしない)
}

/** どちらのスプレッドシートタブの行を指すかの識別子 */
export type SyncSheet =
  | "weight"
  | "meal"
  | "water"
  | "workout"
  | "diary"
  | "foodMaster"
  | "exerciseMaster"
  | "bloodPressure"
  | "bodyMeasurement"
  | "habitMaster"
  | "habitRecord";

/**
 * 同期済み(スプレッドシートに書き出し済み)の可能性がある記録を削除したときのトゥームストーン。
 * ローカルの記録は即座に消えるが、スプレッドシート側の行は次回同期でこの情報を使って削除する(Issue #30)。
 */
export interface SyncDeletion {
  /** `${sheet}:${recordId}` の合成キー(同じ行への削除要求を冪等にまとめる) */
  id: string;
  sheet: SyncSheet;
  /**
   * スプレッドシートのID列に書かれている値。
   * WeightRecord.id=日付 / MealRecord.id・WaterRecord.id・WorkoutRecord.id=UUID / DiaryRecord.id=日付 /
   * FoodMasterItem.id・ExerciseMasterItem.id=UUID(Issue #96) /
   * BloodPressureRecord.id・BodyMeasurementRecord.id=日付(Issue #117・#118) /
   * HabitMasterItem.id=UUID・HabitRecord.id=`${date}_${habitId}`(Issue #113)
   */
  recordId: string;
  deletedAt: string; // ISO8601
}

/** 身体プロフィールの性別(Mifflin-St Jeor式の係数分岐に使う。画面設計書9章) */
export type Sex = "male" | "female";

export interface Settings {
  goalWeightKg: number;
  goalDate: string; // ISO8601 date
  dailyCalorieTarget: number;
  dailyWaterTargetMl?: number; // 1日の目標水分摂取量(ml)。未設定時はホーム・水分記録画面で合計mlのみ表示する(画面設計書5章)
  lastSyncedAt?: string; // ISO8601, 最終同期日時
  apiToken?: string; // Worker API(/api/*)の共有トークン(Issue #87)。WorkerのAPI_AUTH_TOKENと同じ値を設定する
  baselineDate?: string; // YYYY-MM-DD, 進捗バーの起点日。未設定時は一番古い体重記録を起点とする

  // --- フェーズ3: 身体プロフィール(Issue #43。画面設計書9章) ---
  // 目標カロリー・PFC目標の自動計算にのみ使う。未入力でも各目標値の手動入力は従来どおり可能
  heightCm?: number;
  birthYear?: number;
  sex?: Sex;
  activityLevel?: number; // 活動係数(1.2 / 1.375 / 1.55 / 1.725 / 1.9 の5段階)

  // --- フェーズ3: PFC目標値(Issue #47。画面設計書9章) ---
  dailyProteinTargetG?: number;
  dailyFatTargetG?: number;
  dailyCarbsTargetG?: number;

  /**
   * AIコーチング生成時に日記本文をWeeklyDigestへ含めるオプトイン(Issue #103でIssue #12を決着)。
   * デフォルト(undefined)はOFF = 本文は外部AIに送らず気分タグの件数集計のみ(AIコンサルティング設計書7章)
   */
  sendDiaryTextToAi?: boolean;
}

// --- フェーズ3: 週次レビュー・AIコーチング(Issue #45・#12。AIコンサルティング設計書3〜4章) ---

/**
 * コード側で判定済みの注意フラグ(AIコンサルティング設計書3章の表)。
 * AIに新しい警告を発明させないため、判定はすべて純関数側で行う(src/lib/weeklyDigest.ts)。
 */
export type DigestFlag =
  | "PACE_TOO_AGGRESSIVE" // 週の減少幅が現在体重(週平均)の1%を超えている
  | "INTAKE_BELOW_BMR" // 週平均摂取カロリーが基礎代謝を下回っている
  | "BEHIND_PACE" // 着地予測が目標体重を上回っている(ペース不足)
  | "LOW_RECORDING_RATE" // 記録した日が5日未満
  | "NO_WEIGHT_DATA" // 当該週に体重記録が無い
  | "INSUFFICIENT_DATA"; // データが少なく評価に適さない(記録した日が2日未満)

/**
 * AIへの入力契約かつ週次レビュー画面の表示データ(画面とAIが同じ事実を見る)。
 * 生成はsrc/lib/weeklyDigest.tsの純関数で行い、AdviceRecord内のスナップショット以外には永続化しない。
 */
export interface WeeklyDigest {
  period: { start: string; end: string }; // 対象週(月曜〜日曜、YYYY-MM-DD)
  goal: {
    targetWeightKg: number;
    targetDate: string; // YYYY-MM-DD
    remainingDays: number; // 今日から目標日までの残り日数(過ぎていれば0)
  };
  weight: {
    weekAvgKg: number | null; // 週平均体重(記録が無い週はnull)
    prevWeekAvgKg: number | null;
    weeklyChangeKg: number | null; // 週平均同士の差(単日比較はノイズが大きいため使わない)
    projectedKg: number | null; // 現在ペースでの着地予測(Issue #25の線形予測を流用)
    requiredWeeklyPaceKg: number; // 必要ペース(kg/週)。減量が必要なら負の値
    /** 必要ペース計算の基準体重(週平均、無ければ全期間の最新体重にフォールバック)。体重記録が1件も無い場合のみnull */
    paceBaseKg: number | null;
  };
  calories: {
    avgIntakeKcal: number | null; // 食事記録がある日の平均
    targetKcal: number;
    daysOnTarget: number; // 目標以内に収まった日数
    recordedDays: number; // 食事記録がある日数(0〜7)
    estimatedTdeeKcal: number | null; // 実測TDEE(Issue #44。有効週が無い間はnull)
    bmrKcal: number | null; // 基礎代謝(身体プロフィール未設定ならnull)
  };
  pfc: {
    avgProteinG: number | null;
    avgFatG: number | null;
    avgCarbsG: number | null;
    targetProteinG: number | null;
    targetFatG: number | null;
    targetCarbsG: number | null;
  };
  recording: {
    recordedDays: number; // 「記録した日」(食事1件以上または体重記録あり)の数(0〜7。Issue #46)
    currentStreakDays: number;
  };
  flags: DigestFlag[];
  /** 日記の気分タグの件数集計のみ(本文は外部AIに送らない。AIコンサルティング設計書7章)。日記が無い週は省略 */
  mood?: { good: number; normal: number; bad: number };
  /**
   * Garmin計測の活動サマリー(Issue #82)。週内に活動記録が1日も無ければ省略(mood と同じ扱い)。
   * 各平均は「その項目のデータがある日」の平均(欠測日は分母に入れない)。項目ごとに欠測しうるためnull許容
   */
  activity?: {
    avgSteps: number | null; // 週平均歩数
    avgTotalKcal: number | null; // 週平均総消費カロリー(Garmin計測。逆算TDEEとの突き合わせに使う)
    avgSleepMinutes: number | null; // 平均睡眠時間(分)
    recordedDays: number; // 活動データがある日数(0〜7)
  };
  /** 筋トレの週サマリー(Issue #103)。週内に筋トレ記録が無ければ省略(mood と同じ扱い) */
  workout?: {
    activeDays: number; // 筋トレを記録した日数(0〜7)
    exerciseCount: number; // 週内に行った種目数(種目名の異なり数)
    totalSets: number; // 週内の総セット数
  };
  /** 水分の週サマリー(Issue #103)。週内に水分記録が無ければ省略 */
  water?: {
    avgIntakeMl: number; // 記録がある日の平均摂取量(ml)
    targetMl: number | null; // 1日の目標摂取量(未設定ならnull)
    daysOnTarget: number | null; // 目標以上飲めた日数(目標未設定ならnull)
    recordedDays: number; // 水分記録がある日数(0〜7)
  };
  /**
   * 血圧の週サマリー(Issue #117)。週内に血圧記録が無ければ省略。
   * アプリは医療機器ではないため、highReadingDaysは「家庭血圧135/85以上の日が何日」という
   * 事実の提示に留め、医学的判断はしない(AIコーチングの医療免責と同じ整理)。
   * weekAvgWeightKgを併記し、医学的に確立した体重×血圧の関係を並べて見せる(#112のクロス分析の軸)。
   */
  bloodPressure?: {
    avgSystolic: number; // 週平均の最高血圧(記録がある日の平均)
    avgDiastolic: number; // 週平均の最低血圧
    recordedDays: number; // 血圧記録がある日数(0〜7)
    highReadingDays: number; // 最高135以上または最低85以上だった日数(事実提示)
    weekAvgWeightKg: number | null; // 同じ週の週平均体重(体重×血圧を並べて見せる)
  };
  /**
   * 週内の日記本文(Issue #103)。設定のオプトイン(Settings.sendDiaryTextToAi)がONのときだけ含まれ、
   * そのまま外部AI(Gemini)に送られる。OFF(デフォルト)では省略され、気分はmoodの件数集計のみになる
   * (AIコンサルティング設計書7章のプライバシー原則)
   */
  diaryEntries?: { date: string; text: string }[];
  /**
   * 週内データのクロス集計(Issue #112)。計算はコード側で行い、画面・AIとも事実の提示に留める
   * (週単位はサンプル数が少なく「相関」とは言い切れないため、解釈・断定はしない)。
   * 各項目は比較が成立する週だけ含め、1つも成立しない週はcrossAnalysis自体を省略する
   */
  crossAnalysis?: {
    /**
     * 睡眠不足×摂取カロリー。Garminの睡眠時間(その日の朝までの夜間睡眠)が6時間未満だった日と
     * それ以外の日で、同じ日の摂取カロリーを比較する(睡眠明けの日=シート上の同じ日付)。
     * 睡眠6時間未満の日に食事記録が1日も無い週は省略
     */
    sleepIntake?: {
      thresholdMinutes: number; // 睡眠不足の閾値(360分=6時間固定)
      shortSleepDays: number; // 睡眠が閾値未満だった日数(睡眠データがある日のうち)
      sleepRecordedDays: number; // 睡眠データがある日数
      avgIntakeOnShortSleepDays: number; // 睡眠不足の日の平均摂取カロリー(食事記録がある日の平均)
      avgIntakeOnOtherDays: number | null; // 睡眠が閾値以上だった日の平均摂取カロリー(比較対象が無ければnull)
    };
    /** 気分×摂取カロリー。気分が良い日(絶好調・良い)と眠い・不調の日の摂取カロリーを比較する。両群に食事記録のある日が無い週は省略 */
    moodIntake?: {
      goodMoodDays: number; // 気分が良い日(絶好調・良い)のうち食事記録がある日数
      badMoodDays: number; // 眠い・不調の日のうち食事記録がある日数
      avgIntakeOnGoodMoodDays: number;
      avgIntakeOnBadMoodDays: number;
    };
    /** 飲酒×摂取カロリー(Issue #112コメント)。飲酒タグを付けた日が1日も無い週は省略 */
    alcohol?: {
      alcoholDays: number; // 飲酒タグを付けた日数
      avgIntakeOnAlcoholDays: number | null; // 飲酒日の平均摂取カロリー(食事記録が無ければnull)
      avgIntakeOnOtherDays: number | null; // 飲酒タグの無い日の平均摂取カロリー(食事記録がある日の平均)
      avgIntakeNextDay: number | null; // 飲酒日の翌日の平均摂取カロリー(翌日が週内で食事記録がある日のみ)
    };
  };
}

/**
 * 月次レビューのAI入力契約かつ画面の表示データ(Issue #114。画面とAIが同じ事実を見る)。
 * 月の定義は「その月に日曜が含まれる月曜始まりの週の集合」(src/lib/date.tsのweekStartsOfMonth)。
 * 週次レビューの全セクションは持ち込まず、月次ならではの俯瞰(週平均体重の推移・月間TDEE・
 * 月窓クロス分析・目標マイルストーン)に絞る。生成はsrc/lib/monthlyDigest.tsの純関数で行う。
 */
export interface MonthlyDigest {
  month: string; // YYYY-MM
  period: { start: string; end: string }; // 最初の週の月曜〜最後の週の日曜
  goal: {
    targetWeightKg: number;
    targetDate: string; // YYYY-MM-DD
    remainingDays: number; // 今日から目標日までの残り日数(過ぎていれば0)
  };
  /** 月内の週平均体重・平均摂取の系列(週の昇順、4〜5点)。ペースの加速・減速を見せる折れ線の元データ */
  weeks: {
    weekStart: string; // YYYY-MM-DD(月曜)
    weekAvgKg: number | null; // 週平均体重(記録が無い週はnull)
    avgIntakeKcal: number | null; // 食事記録がある日の平均摂取(無い週はnull)
  }[];
  weight: {
    startWeekAvgKg: number | null; // 月内で最初に体重記録がある週の週平均
    endWeekAvgKg: number | null; // 月内で最後に体重記録がある週の週平均
    monthlyChangeKg: number | null; // endWeekAvgKg - startWeekAvgKg(記録のある週が2週未満ならnull)
    avgWeeklyPaceKg: number | null; // 月間の平均ペース(kg/週)。変化量を週数差で割った値
    requiredWeeklyPaceKg: number; // 必要ペース(kg/週)。週次と同じ計算(減量が必要なら負)
    /** 今月のペースを維持した場合の目標日時点の見込み体重(マイルストーン)。ペースが計算できなければnull */
    projectedAtGoalDateKg: number | null;
    weeksWithData: number; // 体重記録がある週の数(0〜5)
  };
  calories: {
    avgIntakeKcal: number | null; // 月内の食事記録がある日の平均
    targetKcal: number;
    daysOnTarget: number; // 目標以内に収まった日数
    recordedDays: number; // 食事記録がある日数
    /** 月窓の実測TDEE(月内の有効週の週次逆算値の平均)。週単位よりブレが少ない安定値(Issue #44・#114) */
    monthlyTdeeKcal: number | null;
    tdeeValidWeeks: number; // 逆算に使えた有効週の数(0〜5)
    tdeeMinKcal: number | null; // 有効週の週次逆算値の最小(ブレ幅の表示用)
    tdeeMaxKcal: number | null; // 同・最大
    bmrKcal: number | null; // 基礎代謝(身体プロフィール未設定ならnull)
  };
  recording: {
    recordedDays: number; // 「記録した日」(食事1件以上または体重記録あり)の数
    totalDays: number; // 期間の総日数(28または35)
  };
  /** 週次と同じフラグ語彙を月窓の閾値で判定する(判定はsrc/lib/monthlyDigest.tsの純関数) */
  flags: DigestFlag[];
  /** 月窓のクロス集計(Issue #112の集計を月幅で再実行。週次より標本数が多い) */
  crossAnalysis?: WeeklyDigest["crossAnalysis"];
  /**
   * 血圧の月サマリー(Issue #117)。月内に血圧記録が無ければ省略。週次と同じく事実の提示に留める。
   * 月窓は週次よりサンプルが多く、体重×血圧の傾向が安定して見える。
   */
  bloodPressure?: {
    avgSystolic: number; // 月内の記録がある日の平均最高血圧
    avgDiastolic: number; // 同・平均最低血圧
    recordedDays: number; // 血圧記録がある日数
    highReadingDays: number; // 最高135以上または最低85以上だった日数(事実提示)
  };
}

/** AIの出力契約(AIコンサルティング設計書4章)。Workerのstructured outputで強制する */
export interface WeeklyAdvice {
  verdict: "on_track" | "slightly_behind" | "behind" | "needs_attention";
  summary: string; // 週の総評(2〜3文)
  wins: string[]; // 続けるべき良かった点(1〜2個)
  actions: string[]; // 来週の具体的行動(最大3個)
}

/**
 * AIコーチのコメントのキャッシュ(Issue #12。画面設計書11章)。
 * 週の開始日(月曜)を主キーとし、1週1件・再生成で上書き(後勝ち)。スプレッドシート同期の対象外(ローカルのみ)。
 * 生成時のdigestも保存し、「何を根拠にこのコメントが出たか」を後から再現できるようにする。
 */
export interface AdviceRecord {
  weekStart: string; // YYYY-MM-DD(月曜)
  createdAt: string; // ISO8601
  digest: WeeklyDigest;
  advice: WeeklyAdvice;
}

/**
 * 月次AIコーチコメントのキャッシュ(Issue #114)。週次のAdviceRecordと同じ仕組みを月キーで流用する:
 * 月(YYYY-MM)を主キーとし、1月1件・再生成で上書き(後勝ち)。スプレッドシート同期の対象外(ローカルのみ)。
 * 出力契約(verdict/summary/wins/actions)は週次と共通で、winsは「今月の良かった変化」、
 * actionsは「来月の重点」の意味で使う。
 */
export interface MonthlyAdviceRecord {
  month: string; // YYYY-MM
  createdAt: string; // ISO8601
  digest: MonthlyDigest;
  advice: WeeklyAdvice;
}
