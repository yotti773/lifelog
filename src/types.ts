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

export interface ExerciseMasterItem {
  id: string;
  name: string; // 食事マスタと異なり数値項目は持たない(重量・回数は毎回変わるため。画面設計書7.1章)
  createdAt: string; // ISO8601
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
export type SyncSheet = "weight" | "meal" | "water" | "workout" | "diary";

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
   * WeightRecord.id=日付 / MealRecord.id・WaterRecord.id・WorkoutRecord.id=UUID / DiaryRecord.id=日付
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
