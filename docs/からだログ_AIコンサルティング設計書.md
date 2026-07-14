# からだログ AIコンサルティング設計書

作成日: 2026-07-06
関連ドキュメント: からだログ_要件定義書.md(4.7章)、からだログ_画面設計書.md(8.2章・8.3章)、からだログ_意思決定ログ.md
対応Issue: #12(AIコーチング)。前提となる土台: #43(身体プロフィール・目標カロリー)、#44(実測TDEE)、#45(週次レビュー)、#46(記録率)、#47(PFC目標)。拡張: #114(月次レビュー・月次AIコメント。10章)

## 1. 目的・位置づけ

現在NotebookLMに手動でデータを読み込ませて行っている「パーソナルトレーナー的な壁打ち」をアプリ内に統合する(要件定義書2章・4.7.6章)。具体的には、週次レビュー画面(画面設計書8.2章)に「AIコーチのコメント」欄を設け、週の実績に対する総評・良かった点・来週の具体的アクションをAIが生成する。

## 2. 設計原則

**数値の計算・集計・安全判定はすべてコード側で決定論的に行い、AIには「計算済みの事実の解釈と言語化」だけをさせる。**

この分業が本設計の核心で、理由は3つ:

1. **軽量モデルで成立する**: 生レコードを渡して「分析して」と頼むと、高性能モデルでも計算を間違え、トークンも浪費する。計算済みのダイジェストの言語化だけなら、最安クラスの軽量モデルで十分な品質が出る
2. **数値の正しさが保証される**: 画面に表示する数値(平均体重・必要ペース等)はすべてコードが算出した `WeeklyDigest` の値を直接表示し、AIの出力文は「解釈」の欄にだけ使う。AIが数字を言い間違えても画面上の数値は常に正しい
3. **安全がAIの挙動に依存しない**: 「摂取カロリーが基礎代謝を割っている」「減量ペースが速すぎる」といった安全上の判定はコードが行い、結果をフラグとしてAIに渡す。AIの仕事はそれを踏まえた言い回しだけ

このほかの原則:

- 自動計算・AI提案はすべて「提案」であり、設定値を自動で上書きしない(要件定義書4.7章)
- AIへの入力は生レコードではなく、コードが生成した小さな構造化ダイジェスト(3章)に限定する
- 日記の本文はデフォルトでは外部AIに送らない(7章)

## 3. データ契約(1): WeeklyDigest(入力)

AIへの入力はこの型のJSONのみ。週次レビュー画面の表示にも同じ値を使う(画面とAIが同じ事実を見る)。コード側で純関数として生成し、単体テストを書く。

```typescript
interface WeeklyDigest {
  period: { start: string; end: string };        // 対象週(月曜〜日曜、YYYY-MM-DD)
  goal: {
    targetWeightKg: number;
    targetDate: string;                          // YYYY-MM-DD
    remainingDays: number;
  };
  weight: {
    weekAvgKg: number | null;                    // 週平均体重(記録が無い週はnull)
    prevWeekAvgKg: number | null;
    weeklyChangeKg: number | null;               // 週平均同士の差(単日比較はノイズが大きいため使わない)
    projectedKg: number | null;                  // 現在ペースでの着地予測(実装済みの線形予測を流用。Issue #25)
    requiredWeeklyPaceKg: number;                // 必要ペース = 残り減量幅 ÷ 残り週数
    paceBaseKg: number | null;                   // 必要ペース計算の基準体重(週平均、無ければ最新体重にフォールバック。体重記録が皆無ならnull)
  };
  calories: {
    avgIntakeKcal: number | null;                // 記録がある日の平均
    targetKcal: number;
    daysOnTarget: number;                        // 目標以内に収まった日数
    recordedDays: number;                        // 食事記録がある日数(0〜7)
    estimatedTdeeKcal: number | null;            // 実測TDEE(Issue #44。有効週が無い間はnull)
    bmrKcal: number | null;                      // 基礎代謝(身体プロフィール未設定ならnull)
  };
  pfc: {
    avgProteinG: number | null; avgFatG: number | null; avgCarbsG: number | null;
    targetProteinG: number | null; targetFatG: number | null; targetCarbsG: number | null;
  };
  recording: {
    recordedDays: number;                        // 「記録した日」の数(0〜7。Issue #46の定義に従う)
    currentStreakDays: number;
  };
  flags: DigestFlag[];                           // コード側で判定済みの注意事項(下表)
  mood?: { good: number; normal: number; bad: number };  // 日記の気分タグの件数集計(デフォルトでは本文は送らない。7章)
  activity?: {                                   // Garmin計測の活動サマリー(Issue #82)。活動記録が無い週は省略
    avgSteps: number | null;                     // 週平均歩数(データがある日の平均)
    avgTotalKcal: number | null;                 // 週平均総消費カロリー(Garmin計測)
    avgSleepMinutes: number | null;              // 平均睡眠時間(分)
    recordedDays: number;                        // 活動データがある日数(0〜7)
  };
  workout?: {                                    // 筋トレの週サマリー(Issue #103)。記録が無い週は省略
    activeDays: number;                          // 筋トレを記録した日数(0〜7)
    exerciseCount: number;                       // 週内に行った種目数(種目名の異なり数)
    totalSets: number;                           // 週内の総セット数
  };
  water?: {                                      // 水分の週サマリー(Issue #103)。記録が無い週は省略
    avgIntakeMl: number;                         // 記録がある日の平均摂取量(ml)
    targetMl: number | null;                     // 1日の目標摂取量(未設定ならnull)
    daysOnTarget: number | null;                 // 目標以上飲めた日数(目標未設定ならnull)
    recordedDays: number;                        // 水分記録がある日数(0〜7)
  };
  diaryEntries?: { date: string; text: string }[];  // 週内の日記本文。オプトインON時のみ含める(7章。Issue #103)
  crossAnalysis?: {                              // 週内データのクロス集計(Issue #112)。比較が1つも成立しない週は省略
    sleepIntake?: {                              // 睡眠不足×摂取カロリー(同じ日付でペアリング。下記補足)
      thresholdMinutes: number;                  // 睡眠不足の閾値(360分=6時間固定)
      shortSleepDays: number;                    // 睡眠が閾値未満だった日数(睡眠データがある日のうち)
      sleepRecordedDays: number;                 // 睡眠データがある日数
      avgIntakeOnShortSleepDays: number;         // 睡眠不足の日の平均摂取カロリー(食事記録がある日の平均)
      avgIntakeOnOtherDays: number | null;       // 睡眠が閾値以上だった日の平均(比較対象が無ければnull)
    };
    moodIntake?: {                               // 気分×摂取カロリー。両群に食事記録のある日が無い週は省略
      goodMoodDays: number;                      // 気分が良い日(絶好調・良い)のうち食事記録がある日数
      badMoodDays: number;                       // 眠い・不調の日のうち食事記録がある日数
      avgIntakeOnGoodMoodDays: number;
      avgIntakeOnBadMoodDays: number;
    };
    alcohol?: {                                  // 飲酒×摂取カロリー。飲酒タグの無い週は省略
      alcoholDays: number;                       // 飲酒タグを付けた日数
      avgIntakeOnAlcoholDays: number | null;     // 飲酒日の平均摂取カロリー
      avgIntakeOnOtherDays: number | null;       // 飲酒タグの無い日の平均(「飲酒なしと記録した日」ではない)
      avgIntakeNextDay: number | null;           // 飲酒日の翌日の平均(翌日が週内で食事記録がある日のみ)
    };
  };
}
```

### DigestFlag(コード側で判定する注意フラグ)

| フラグ | 判定条件(コード側。`src/lib/weeklyDigest.ts` で実装済み) |
|---|---|
| `PACE_TOO_AGGRESSIVE` | 週の減少幅(週平均の前週比)が週平均体重の1%を超えている(増加時は判定しない) |
| `INTAKE_BELOW_BMR` | 週平均摂取カロリーが基礎代謝を下回っている(身体プロフィール未設定でBMRが無い場合は判定しない) |
| `BEHIND_PACE` | 着地予測が目標体重を上回っている(ペース不足。予測が計算できない場合は判定しない) |
| `LOW_RECORDING_RATE` | 記録した日が5日未満 |
| `NO_WEIGHT_DATA` | 当該週に体重記録が無い |
| `INSUFFICIENT_DATA` | 記録した日が2日未満(利用開始直後など、評価に適さない週) |

フラグの一覧・判定条件は実装時にこの表を起点に確定し、変更したらこの表を更新する。**AIに新しい警告を発明させない**(プロンプトで「flagsに無い問題を指摘しない」ことを指示する。5章)。

補足(実装時の確定事項):
- `mood` は日記の気分タグ(5段階。画面設計書6章)を3区分へ集計する: 絶好調・良い → `good` / 普通 → `normal` / 眠い・不調 → `bad`。日記が無い週は `mood` 自体を省略する
- `activity` はGarmin連携(CLAUDE.mdのGarmin連携を参照)で取り込んだ活動記録の週集計(Issue #82)。各平均は「その項目のデータがある日」の平均(欠測日は分母に入れない)。週内に活動記録が1日も無ければ省略する(未連携ユーザーのdigest・プロンプトは従来と変わらない)。`avgTotalKcal`(Garmin計測)と `estimatedTdeeKcal`(逆算)は独立した消費カロリー推定値で、画面側は乖離15%超で「記録漏れ等の可能性」の注記を出す。AIには差の計算をさせない(プロンプトで明示。5章)。activity由来の新しい警告フラグは設けない(歩数・睡眠の多寡は安全判定ではなく解釈の領域のため)
- `requiredWeeklyPaceKg` は「減量が必要なら負」の符号で持つ(`weeklyChangeKg` と直接比較できるように)。体重記録が皆無・目標日超過の場合は `0` とし、状況はフラグ側で伝える
- `workout`・`water` は週次レビューへの筋トレ・水分の統合(Issue #103)で追加した週サマリー。activityと同じ扱いで、記録が無い週は省略する(セクション・プロンプトとも従来と変わらない)。水分の平均は「記録がある日」(日別合計が0mlでない日)の平均で、記録の無い日は分母に入れない(食事・活動の平均と同じ考え方)。筋トレ・水分由来の新しい警告フラグは設けない(継続の多寡は安全判定ではなく解釈の領域のため)
- `diaryEntries` は週内の日記本文の配列(Issue #103でIssue #12を決着)。設定のオプトイン(`Settings.sendDiaryTextToAi`、デフォルトOFF)がONの週だけ含め、本文が空の日記(気分タグのみ)は除く。プロンプトでは「生活背景・気分の文脈として読み、winsやactionsをユーザーの実際の状況に沿ったものにする材料にしてよい。本文をそのまま長く引用しない。日記に書かれた内容から病気の診断・治療の提案をしない」と指示する(7章)
- `crossAnalysis` は週内データのクロス集計(Issue #112)。「計算はコード・言語化はAI」の分業を維持し、集計は `buildCrossAnalysis()`(`src/lib/weeklyDigest.ts`)で決定論的に行う。週次レビュー画面はこの値を事実の提示スタイルで表示し(画面設計書8.2章)、AIには気づきの材料として渡す。週単位はサンプル数が少なく「相関」とは言い切れないため、画面・AIとも断定しない(5章のプロンプト制約)。設計上の要点:
  - 睡眠×食事は**同じ日付**でペアリングする。Garminの睡眠時間はその日の朝までの夜間睡眠のため、同日の食事が「睡眠不足明けの日の食事」に相当する(「翌日の摂取カロリー」を日付+1で取ると1日ズレる)
  - 飲酒×食事の「翌日」は週内(月〜日)に収まる日だけを分母にする(日曜の飲酒の翌日は翌週のdigestの範囲のため含めない)。digestを週単位で自己完結させ、画面とAIが同じ事実を見る原則を保つ
  - 飲酒タグは`DiaryRecord.alcohol`(画面設計書6章)。未設定は「記録なし」であり「飲酒なし」ではないため、「それ以外の日」はタグの無い日全体として集計・表現する
  - crossAnalysis由来の新しい警告フラグは設けない(掛け合わせの多寡は安全判定ではなく解釈の領域のため。activity・workout・waterと同じ判断)
- `paceBaseKg` は `requiredWeeklyPaceKg` の計算に使った基準体重(週平均、無ければ全期間の最新体重)をそのまま持つ。UI側で「必要ペース0.00kg/週(既に目標体重付近)」と「計算不能(体重記録が無い・目標日超過)」を区別するために使う。週次レビュー画面のTDEE補正提案(実測消費カロリー節)でも、設定画面の自動計算(#43。`src/pages/settings/ValueEditorDrawer.tsx`)と同じ `suggestCalorieTarget()` の入力(現在体重)として再利用し、ガードレール(基礎代謝クランプ・ペース超過警告)を画面間で一貫させている

## 4. データ契約(2): WeeklyAdvice(出力)

出力は構造化JSONで強制する(Geminiの structured output / `responseSchema` を使用)。自由文をパースしない。

```typescript
interface WeeklyAdvice {
  verdict: "on_track" | "slightly_behind" | "behind" | "needs_attention";
  summary: string;      // 週の総評(2〜3文)
  wins: string[];       // 続けるべき良かった点(1〜2個)
  actions: string[];    // 来週の具体的行動(最大3個。測定可能な形で書かせる)
}
```

- `verdict` はUIでの色分け・アイコン表示に使う(達成演出でない限りaccent色は使わない。デザインガイドの制約)
- スキーマバリデーション(zod等)を通らない出力はエラーとして扱い、リトライ1回 → それでも失敗ならAI欄を「生成に失敗しました(再試行)」表示にする。**AI欄が失敗しても週次レビューの数値表示には影響しない**(分業の利点)

## 5. プロンプト構造

- **システムプロンプト(固定)**:
  - 役割: 減量に伴走するパーソナルトレーナー。断定的すぎず、継続を励ますトーン(日本語)
  - 制約: (1) digestに無い数値を出さない・計算しない、(2) `flags` に無い問題を新たに指摘しない、(3) `flags` にある項目は必ず `summary` または `actions` で言及する、(4) 医学的診断・極端な食事制限の提案をしない、(5) 出力はスキーマに従うJSONのみ
  - `verdict` の判定基準: 必要ペースとの乖離・フラグの有無から機械的に選べるよう、条件を列挙して指示する
  - `crossAnalysis` の扱い(Issue #112): 気づきの材料としてsummary・actionsに使ってよいが、1週間分の少ないデータのため相関・因果を断定しない(「〜の傾向が見られます」程度に留める)。数値の差の計算はさせない。飲酒は記録された事実として扱い、責めるトーンにしない
- **ユーザー入力**: `WeeklyDigest` のJSONそのまま(整形・自然文化はしない)
- few-shot例は初版では持たず、6章の品質確認で不足があれば1〜2例追加する(入力トークンとのトレードオフ)

プロンプト本文はWorkerのコード(またはWorker配下の定数ファイル)として管理し、変更はコードレビューと6章の回帰確認を通す。

## 6. モデル選定・コスト・品質担保

- **モデル**: Gemini Flash-Lite系(その時点の最新世代の最安モデル)から始める。言語化の質に不満が出たら同世代のFlashに上げる。既存契約のAPIキー・既存のWorker中継を流用するため、新しい契約・インフラは不要
  - 実装時の既定値は `gemini-3.1-flash-lite`(`worker/weeklyAdvice.ts`)。Workerの環境変数 `GEMINI_ADVICE_MODEL` で写真判定用の `GEMINI_MODEL` とは独立に上書きできる(旧既定値 `gemini-2.5-flash-lite` は新規ユーザーへの提供が終了したため2026-07に切り替え。Issue #65)
- **コスト試算**: 入力(システムプロンプト+digest)約2Kトークン+出力約500トークン × 週1〜数回(再生成含む)。Flash-Lite級の単価では月1円未満のオーダーであり、実質無料。トークン節約のための特別な工夫(圧縮・キャッシュ)は不要
- **品質の回帰確認**:
  - 代表的な `WeeklyDigest` のフィクスチャを5〜6パターン用意する(順調な週 / 停滞週 / 記録サボり週 / ペース超過(危険)週 / データ不足週 など)。`worker/__tests__/` に置く
  - 自動テスト(CIで実行可能): 出力のスキーマバリデーション通過、`flags` の各項目が `summary`/`actions` のいずれかで言及されているか(キーワードベースの緩い検証)
  - プロンプト・モデルを変更したときは、フィクスチャ全パターンを流して出力を目視確認する(スナップショットとして残す)
  - LLM-as-a-judge(別のAIによる採点)のような大掛かりな評価基盤は、個人利用・週1実行の規模では過剰なので導入しない

## 7. プライバシー・安全

- **日記本文は外部AIに送らない(デフォルト)**: `WeeklyDigest` に含めるのは気分タグの件数集計のみ。本文まで読ませる**オプトイン設定**(設定画面「日記の本文をAIに送る」トグル、`Settings.sendDiaryTextToAi`、デフォルトOFF)を設け、ONの週だけ `diaryEntries` として本文を含める(Issue #103でIssue #12を決着)。週次レビュー画面の日記カードには、本文がAIに渡る状態かどうかを常に注記する
- 体重・カロリー等の数値データはAI判定(写真)で既にGemini APIへ送っている範囲と同等であり、新たなプライバシー区分は増えない
- **医療免責**: AIコメント欄の近くに「AIによる参考情報であり、医学的助言ではありません」の注記を常設する
- 安全ガードレール(最低摂取カロリー・ペース上限)はコード側のフラグ判定と設定画面のクランプ(Issue #43)で担保し、AIには依存しない(2章)

## 8. インフラ・実行フロー

1. クライアント: 週次レビュー画面で「生成する」を押下 → その週の `WeeklyDigest` を算出し、`POST /api/weekly-advice` に送る
2. Worker(既存の中継Workerにエンドポイントを追加): システムプロンプト+digestでGemini API(軽量モデル、structured output指定)を呼び出し、`WeeklyAdvice` を返す。APIキーはWorkerのシークレットのまま(写真判定と同じ構成)
3. クライアント: スキーマバリデーション後、`AdviceRecord`(`weekStart` を主キー、1週1件・後勝ち)としてIndexedDBに保存し表示する。生成時の `digest` も一緒に保存する(後から「何を根拠にこのコメントが出たか」を再現できるように)
4. 生成済みの週はキャッシュを表示する。再生成ボタンで上書き生成できる(記録を追記・修正した後に更新する用途)
5. 自動実行(起動時の自動生成・プッシュ通知)は行わない。ユーザーの明示操作でのみ生成する(コスト管理と、押し付けがましさの回避)

## 9. 実装の段階分け

1. **土台(AI無し)**: #43 → #44 → #45(+#46・#47)。週次レビューはコードだけの決定論的サマリーとして先に価値を出す
2. **AI統合(#12)**: 本設計書の3〜8章を実装する。`WeeklyDigest` は段階1で実装済みのものをそのまま入力契約として使う

※実装状況: 両段階とも実装済み(2026-07-10)。主な実装場所: ダイジェスト生成 `src/lib/weeklyDigest.ts` + `src/db/weeklyReview.ts`、実測TDEE `src/lib/tdee.ts` + `src/db/weeklyNutrition.ts`、Workerエンドポイント `worker/weeklyAdvice.ts`(フィクスチャは `worker/__tests__/weeklyAdviceFixtures.ts`)、キャッシュ `src/db/adviceRecords.ts`、画面 `src/pages/trends/WeeklyReview.tsx`(AIコメントカードは同 `WeeklyAdviceCard.tsx`)。日記本文を読ませるオプトイン(7章)は2026-07-12に実装済み(Issue #103でIssue #12を決着)。

## 10. データ契約(3): MonthlyDigest(月次レビューの入力。Issue #114)

月次レビュー(画面設計書8.3章)は、週次と同じ「計算はコード・言語化はAI」の分業(2章)をそのまま高度を上げて再利用する。週次の全項目を月幅にするのではなく、月次ならではの俯瞰に絞った独自の入力契約 `MonthlyDigest` を持つ。

- **月の定義**: 「その月に日曜が含まれる月曜始まりの週の集合」(4〜5週。画面設計書8.3章・意思決定ログ)。`period` は最初の週の月曜〜最後の週の日曜
- **主な項目**(型定義は `src/types.ts` の `MonthlyDigest` が正):
  - `weeks`: 月内各週の週平均体重・週平均摂取の系列(4〜5点)。ペースの加速・減速を読み取る材料
  - `weight`: 記録がある最初/最後の週の週平均・月間変化・平均ペース(kg/週)・必要ペース・**今月のペースを維持した場合の目標日時点の見込み体重**(マイルストーン)
  - `calories`: 月内平均摂取・目標・目標以内の日数・**月窓の実測TDEE**(月内の全有効週の週次逆算値の平均。週単位よりブレが少ない安定値)とその有効週数・最小/最大・基礎代謝
  - `recording`: 記録した日数 / 月の総日数
  - `flags`: 週次と同じ `DigestFlag` 語彙を月窓の閾値で判定(記録率は総日数の7割未満、データ不足は7日未満)
  - `crossAnalysis`: #112の集計を月窓で再実行(週次と同じ構造。標本数が多い)
- **出力契約**: 週次と共通の `WeeklyAdvice`(4章)を流用する。`wins` を「今月の良かった変化」、`actions` を「来月の重点」の意味で使う
- **プロンプト**: 週次(5章)の月次版。「今月何が変わったか・翌月どこに重点を置くか」の俯瞰で書かせ、`weeks` の系列からペースの加速・減速を読ませる。制約(digestに無い数値を出さない・flagsに無い問題を指摘しない・医療免責)・`verdict` の機械的判定規則は週次と同じ。本文は `worker/monthlyAdvice.ts`(`MONTHLY_ADVICE_SYSTEM_PROMPT`)
- **実行フロー**: 週次(8章)と同一。`POST /api/monthly-advice` → Workerでstructured output生成 → クライアントで検証(週次と共通の `isWeeklyAdvice`)後 `MonthlyAdviceRecord`(`month` を主キー、1月1件・後勝ち)としてキャッシュ。自動生成はせずユーザーの明示操作でのみ生成する
- **プライバシー**: 月次digestは体重・食事・活動・気分/飲酒の集計値のみで、日記本文は含めない(週次のオプトインは月次には設けていない)

※実装状況: 実装済み(Issue #114。2026-07-14)。主な実装場所: ダイジェスト生成 `src/lib/monthlyDigest.ts` + `src/db/monthlyReview.ts`(月の切り出しは `src/lib/date.ts` の `weekStartsOfMonth`)、Workerエンドポイント `worker/monthlyAdvice.ts`、キャッシュ `src/db/adviceRecords.ts`(`saveMonthlyAdviceRecord`/`getMonthlyAdviceRecord`)、画面 `src/pages/trends/MonthlyReview.tsx`(AIコメントカードは同 `MonthlyAdviceCard.tsx`、クロス分析カードは週次と共有の `CrossAnalysisCard.tsx`)。
