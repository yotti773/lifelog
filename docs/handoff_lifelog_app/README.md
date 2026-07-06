# Handoff: ライフログアプリ「からだログ」— MVP画面一式

## Overview
食事・体重・体脂肪率などのライフログを記録するモバイルアプリのMVP。ホーム（当日サマリー）、記録フロー（体重/食事）、推移（グラフ/履歴）、設定（目標管理）、食事マスタ管理に加え、フェーズ2の 水分/日記/筋トレ 記録画面で構成。React + MUIでの実装を想定して本資料を作成。

> **更新（要件定義 v2 反映）**: FAB＋記録アクションシートは廃止。ホーム上の各カード/区分ラベルを直接タップして記録画面へ遷移する導線に変更。ホーム下部に 水分・日記・筋トレ のフェーズ2セクションを新設し、それぞれの記録画面（水分クイック入力・日記入力・筋トレセット入力）を追加。

## About the Design Files
このバンドル内のHTMLファイルは **HTMLで作成したデザインリファレンス（プロトタイプ）** であり、そのままプロダクションコードとして流用するものではありません。狙いは、このHTMLが示す見た目・挙動を、対象コードベースの環境（本件は React + MUI を想定）の流儀に沿って**再実装**することです。React雛形が未着手の場合は、この資料の構成のまま新規プロジェクトを起こして構いません。

## Fidelity
**High-fidelity（hifi）**。色・タイポグラフィ・余白・角丸・シャドウ・コピーはすべて最終値です。ピクセルパーフェクトに近い形で再現してください。ただし手描きのSVGグラフ（体重・体脂肪率・カロリー推移）は構造説明用の簡易描画であり、実装時は Recharts か MUI X Charts 等での正式なチャートに置き換える前提です（下記参照）。

## 画面構成
すべてモバイル1画面（375〜392px幅想定）。共通シェル：ステータスバー（実装不要、OSが描画）+ ボトムナビゲーション（ホーム/推移/設定の3タブ、設定タブは食事マスタ画面でもアクティブ表示）。**FABは廃止**し、記録はホーム上の各要素の直接タップから開始する。

---

### 1. ホーム画面（Home）
**Purpose**: 起動時に表示。当日の摂取カロリー・体重・体脂肪率・食事記録をまとめて確認する。

**Layout**:
- 縦スクロール1カラム、外側パディング 20px、要素間 gap 14〜22px
- ヘッダー: 挨拶文(13px/#8C8C8C) + 日付見出し(22px bold) + アバター丸型44px(#FFEDE6背景)
- 連続記録バナー（条件表示、`celebrate`フラグ）: グラデーション背景(#FFC145→#FFB01F)、角丸16px
- カロリーカード: 白背景・角丸22px・shadow。目標ピル、46px数値、14px高さのプログレスバー、残量テキスト、PFC3列グリッド（各5px高バー）
- 体重/体脂肪率カード: 1.35fr/1frの2カラムグリッド
- 食事リスト: 朝食/昼食/夕食/間食の4区分。同一区分に複数品目がある場合はカード内に「区分ヘッダー（合計kcal）＋品目ごとのサブ行」を積み上げ表示。区分ヘッダータップ→その区分をプリセットした新規食事記録へ、品目サブ行タップ→その品目の編集画面へ（タップ領域を分離）。未記録区分は破線ボーダー行＋タップで新規食事記録へ
- 体重/体脂肪率カード: タップで体重記録画面へ遷移
- **その他の記録セクション（フェーズ2）**: 食事リストの下に 水分（合計/目標ml＋進捗バー、タップで独立画面へ）・日記（気分アイコン+本文プレビュー/未記録）・筋トレ（種目数・セット数プレビュー/未記録）の3行。各行タップでそれぞれの記録画面へストを表示）・日記（気分3段階チップ「良い/普通/悪い」+本文プレビュー/未記録）・筋トレ（記録済み種目を行リスト表示＋末尾「種目を記録する」/未記録時は破線行）

**MUI コンポーネント対応表**:

| 要素 | MUIコンポーネント | 備考 |
|---|---|---|
| カード全般 | `Card` / `Paper` (elevation={0} + カスタムshadow) | borderRadius 16-22pxをtheme.shape.borderRadiusに設定 |
| カロリー進捗バー | `LinearProgress` (variant="determinate") | 高さ14px、`sx`で角丸・色を上書き |
| PFCミニバー | `LinearProgress` ×3 | 高さ5px |
| 目標ピル/未同期ラベル | `Chip` (size="small") | 背景色はcolor propではなくsxでカスタムパレット |
| アバター | `Avatar` | bgcolor #FFEDE6, color #FF6B4A |
| 食事行 | `ListItemButton` or カスタム`Box` | 未記録行はonClickでアクションシートを開く |
| FAB | （廃止） | 記録アクションシートごと廃止。記録導線はホーム上の各要素の直接タップに集約 |

**Props**（親から渡す想定）:
| プロパティ | 型 | 説明 |
|---|---|---|
| `date` | Date | 表示日 |
| `userName` | string | アバターイニシャル生成用 |
| `caloriesConsumed` | number | 当日摂取カロリー合計 |
| `calorieGoal` | number | 設定画面で管理する目標値 |
| `pfc` | {p,f,c: number} | グラム |
| `weight` | {value, diff, time} | 直近の体重記録 |
| `bodyFat` | number \| null | 未計測ならnull → 「体組成計より」を「未計測」に切替 |
| `meals` | Meal[4] (朝/昼/夕/間) | 各 `{recorded, time, name, kcal, synced}` |
| `streakDays` | number | 7以上で`celebrate`バナー表示 |

**状態遷移**:
- `openMealNew(type)` ← 未記録の食事行タップ / 記録済み区分ヘッダータップ → その区分をプリセットした「食事を記録」画面へ
- `openMealEdit(mealId)` ← 品目サブ行タップ → 「7. 食事を編集」画面へ遷移
- `goWeight()` ← 体重カードタップ / `goWater()` `goDiary()` `goStrength()` ← その他の記録セクション各行タップ
- ホーム自体はグローバルなナビゲーション状態（後述）を`screen==='home'`として参照するのみ、ローカルstateは基本なし

---

### 7. 食事を編集（Meal Edit / Delete）
**Purpose**: ホームの食事行から遷移し、既存の1件の食事記録を編集・削除する（Issue #24 対応）。

**Layout**: ヘッダー（戻る+タイトル「食事を編集」）→ 区分セグメント（朝/昼/夕/間、変更可）→ 日時表示 → 料理名/カロリー/PFC入力欄（「食事を記録」画面と同一スタイル、既存値がプリフィル）→ 補足テキスト「更新すると同期状態は『未同期』に戻ります」→ 下部固定「更新する」ボタン + その下に控えめな「この記録を削除する」ボタン（アウトライン、警告色）
- 削除ボタンタップ → 確認ダイアログ（中央モーダル、`Dialog`相当）: 「この記録を削除しますか？」+ 対象の料理名/カロリー/区分/時刻 + キャンセル/削除するボタン
- 削除確定 → ホームへ戻り、該当行は「未記録」状態に戻る

**MUI対応表**:
| 要素 | MUIコンポーネント |
|---|---|
| 区分セグメント | `ToggleButtonGroup`（記録画面と共通） |
| 各入力欄 | `TextField`（number/text） |
| 更新ボタン | `Button` (variant="contained") |
| 削除ボタン | `Button` (variant="outlined", color="error") |
| 削除確認ダイアログ | `Dialog` + `DialogTitle` + `DialogContent` + `DialogActions` |

**Props**: `meal: {id, mealType, time, name, kcal, p, f, c, synced}`
**状態遷移**:
- 編集画面を開いた時点で対象`meal`をドラフトstateにコピー（`draftMeal`）
- 各入力変更→`draftMeal`更新のみ、確定は「更新する」タップ時
- 更新確定 → 元データを`draftMeal`で上書き、`synced: false`に強制（再同期対象になる）
- 削除確認ダイアログの開閉は`mealDeleteConfirmOpen`（ローカルstate）
- 削除確定 → 対象レコードを削除しホームへ戻る（該当区分は「未記録」表示に戻る）

---

### 2. 推移画面（Trends）
**Purpose**: 体重・体脂肪率・摂取カロリー・水分摂取量の推移と、目標までの進捗を確認する。グラフ/履歴のサブタブを持つ。

**Layout**:
- ヘッダー固定（sticky）: タイトル + セグメントコントロール（グラフ/履歴）
- **グラフタブ**: ゴールバーカード → 体重推移グラフ → 体脂肪率推移グラフ → カロリー推移グラフ → **水分推移グラフ（新規）**（縦積み、gap 14px）
- 水分推移グラフはカロリー推移と同様の日別棒グラフ。設定画面で目標水分摂取量を設定済みの場合のみ目標ライン（破線）を重ねて表示し、未設定の間はラインを表示しない。記録の無い日は0mlで埋めて欠損を隣間として表示（画面設計書 8章・5章参照）
- **履歴タブ**: 期間フィルタは持たず、全期間を日付降順（新しい記録が上）で固定表示（グラフの期間切替えとは連動させない。画面設計書 8.1章参照）。件数テキスト → リスト（Card内、行ごとborder-bottom）→ 0件時は空状態メッセージ

**MUI コンポーネント対応表**:

| 要素 | MUIコンポーネント | 備考 |
|---|---|---|
| グラフ/履歴タブ | `ToggleButtonGroup` (exclusive) or `Tabs` | 現デザインは角丸ピル型セグメント。`ToggleButtonGroup`の方が見た目に近い |
| ゴールバー | `LinearProgress` + カスタムノブ(`Box`で丸を絶対配置) | MUIに専用コンポーネントはないため自作 |
| グラフ本体 | **Recharts** の`LineChart`/`BarChart`、または **MUI X Charts** の`LineChart`/`BarChart` | 現プロトタイプは手描きSVG。軸ラベル・グリッド線はライブラリ標準機能で代替 |
| 履歴リスト行 | `ListItemButton` + `ListItem` | 基準日バッジは`Chip size="small"`。行タップで体重記録編集画面へ遷移 |
| 空状態 | 自作`Box`（中央寄せテキスト） | |

**Props**:
| プロパティ | 型 | 説明 |
|---|---|---|
| `goalWeight` / `baselineWeight` | number | ゴールバーの両端 |
| `currentWeight` | number | ゴールバーのノブ位置計算に使用 |
| `goalDate` | Date | 「あと◯日」計算 |
| `weightHistory` / `bodyFatHistory` / `calorieHistory` | シリーズ配列 | チャートライブラリへそのまま渡せる形に正規化 |
| `records` | WeightRecord[] | 履歴タブの元データ（日付・体重・体脂肪率・メモ・基準日フラグ）。日付降順にソートして表示

**状態遷移**:
- `tab: 'graph' | 'history'`（ローカルstate）
- 履歴行タップ → その日のレコードをドラフトにコピーして体重記録画面へ遷移（`editingFrom: 'history'`）。保存時は日付キーで一致する`records`の該当要素を上書きし、元の履歴タブへ戻る
- ホームの体重カードからの遷移（`editingFrom: 'home'`）は当日分のレコード（なければ空）をドラフトにし、保存後はホームへ戻る

---

### 3. 設定画面（Settings）
**Purpose**: 目標値・データ同期・食事マスタ・種目マスタ（フェーズ2）・（旧JSONバックアップは削除済み）を管理する。

**Layout**:
- セクション見出し(12px, #8C8C8C) + `Card`でグルーピングされた行リスト、の繰り返し
- セクション: 「目標」（5行: 目標体重/目標日/基準日/1日の目標カロリー/**1日の目標水分摂取量（新規）**）→「データ同期」→「食事マスタ」（2行）→**「種目マスタ」（新規、1行）**
- 目標水分摂取量は初期値未設定。未設定の間はホーム/水分記録画面で進捗バー・差分テキストを表示せず合計mlのみ表示（画面設計書 5章・9章参照）
- 種目マスタは食事マスタと同様の専用画面（検索+一覧+インライン編集/削除）だが、重量・PFCなどの数値項目は持たず種目名のみのフラットな一覧（画面設計書 7.1章参照）
- ※ 当初あったJSONエクスポート/インポートのバックアップセクションは要件から除外し削除済み

**MUI コンポーネント対応表**:

| 要素 | MUIコンポーネント | 備考 |
|---|---|---|
| 行グループ | `List` (disablePadding) + `Card` | 行間の区切り線は`Divider`または`ListItem divider` |
| 各設定行 | `ListItemButton` + `ListItemIcon` + `ListItemText` + 右端に値+シェブロン | 値は`Typography`をListItemTextのsecondary位置ではなく右寄せ`Box`で |
| アイコン背景の丸 | `Avatar` (variant="rounded", 小さめ) | 背景色は項目ごとに色分け |
| 同期ボタン | `Button` (variant="contained", color="secondary") | ローディング中は`LoadingButton`(MUI Lab) |
| 同期エラー | `Alert severity="warning"` | |
| 食事マスタ導線 | `ListItemButton` → ルーティングでマスタ画面へ | |

**Props**:
| プロパティ | 型 |
|---|---|
| `goalWeight`, `goalDate`, `baselineDate \| null`, `goalCalories`, `goalWaterMl \| null` | 編集対象の5値 |
| `lastSyncAt`, `unsyncedCount` | データ同期セクション |
| `mealMasterCount`, `exerciseMasterCount` | 「よく食べるものを管理」「よく行う種目を管理」の件数バッジ |

**状態遷移**:
- `editMode: null | 'weight' | 'calories' | 'goalDate' | 'baseline' | 'waterGoal'` → 該当行タップで対応するボトムシートを開く
- 各ボトムシート内は `draft*` の一時state（ステッパー±ボタン + 直接入力`TextField`の両方で編集可能）→「保存」で親stateにコミット、「キャンセル」で破棄
- 基準日・目標水分摂取量は「未設定にする」を持つ（どちらもnull許容。未設定時のフォールバック動作はそれぞれ9章・5章参照）
- 目標カロリーの保存はホーム画面のカロリー計算・進捗バーに反映、目標日の保存は推移画面の「あと◯日」表示に、目標水分摂取量の保存はホーム/水分画面の進捗表示に反映（グローバル状態 or Context経由）

**編集ボトムシート実装メモ**: MUIに専用の「ボトムシート」はないため、`Drawer anchor="bottom"` + `PaperProps={{ sx: { borderTopLeftRadius: 28, borderTopRightRadius: 28 } }}` で再現するのが定番。ステッパーは`IconButton`2つ+中央`Typography`、直接入力は`TextField`（`onBlur`でパース、`type="text"`+`inputMode="decimal"/"numeric"`）。

---

### 4. 食事マスタ管理画面（Meal Master)
**Purpose**: よく食べるものを検索・編集・削除・一括登録する。

**Layout**:
- ヘッダー: 戻る + タイトル + 右上「＋」追加ボタン（円形、primary色）
- 検索バー（`TextField`風、アイコン付き）
- 定番メニュー一括登録カード（ミント背景、登録済みはスキップする旨の注記）
- 「登録済み N件」+ ソート表示
- リスト（`Card`内、行ごとに 名前/PFC/kcal + 編集・削除ボタン）
- ページネーション（前/次 + "n / m ページ"）
- 「手動で追加」（破線ボーダーの追加ボタン）

**MUI コンポーネント対応表**:

| 要素 | MUIコンポーネント |
|---|---|
| 検索バー | `TextField` (size="small", InputProps startAdornment に`SearchIcon`) |
| 一括登録カード | `Card` (sx背景色カスタム) |
| リスト行 | `List`+`ListItem`、右端に`IconButton`×2（編集=`EditIcon`、削除=`DeleteOutlineIcon`） |
| ページネーション | `Pagination` (MUI標準) に置き換え推奨（現デザインは前後矢印の簡易版） |
| 追加ボタン | `Button` (variant="outlined", sx破線) |

**Props**: `items: MealMasterItem[]`, `page`, `pageSize`, `searchQuery`
**状態遷移**: `searchQuery`変更→フィルタ、`page`変更→ページ送り、行の編集/削除ボタン→ダイアログ or インライン編集（詳細未定義、要追加ヒアリング）

---

### 5. 体重を記録（Weight Entry）
**Purpose**: 体重・体脂肪率・メモを記録する。

**Layout**: ヘッダー（戻る+タイトル）→ 日時フィールド → 体重（フォーカス状態でアクセントボーダー、40px数値+単位）→ 前回比チップ → 体脂肪率（任意）→ メモ（任意）→ 下部固定「保存する」ボタン + 数値キーパッド（任意、OS標準キーボードで代替可）

**MUI対応**: 各フィールドは`TextField`（体重・体脂肪率は`type="number"`または大きなカスタム数値表示+ステッパー）、日時は`TextField`+ `MUI X Date/Time Picker`。保存ボタンは`Button fullWidth`を画面下部`Box position="fixed"`に。

**Props**: `initialWeight`, `previousWeight`（差分表示用）, `initialBodyFat`, `initialMemo`, `dateTime`
**状態遷移**: 入力→ローカルstate→保存ボタンで確定、ホームへ戻る

---

### 6. 食事を記録（Meal Entry）
**Purpose**: 区分選択 → 手入力 or 写真AI判定 or マスタから選択、で1件の食事を記録する（1画面完結）。

**Layout**: ヘッダー（戻る+タイトル+保存）→ 区分セグメント（朝/昼/夕/間、現在時刻から自動選択）→ AI反映バナー（条件表示）→ 料理名/カロリー/PFC手入力欄 → 「写真から記録する」カード（撮影/ライブラリボタン+補足入力+AI信頼度低下時の警告）→ 「よく食べるものから選ぶ」カード（検索+リスト）→ 「もう1品記録」→ 「マスタに登録する」チェック → 下部固定保存ボタン

**MUI対応表**:
| 要素 | MUIコンポーネント |
|---|---|
| 区分セグメント | `ToggleButtonGroup` |
| AI反映バナー | `Alert severity="info"` (背景色カスタム) |
| PFC入力 | `Grid`3列 + `TextField`(number) |
| 撮影/ライブラリ | `Button`×2、`input type="file" accept="image/*" capture` |
| AI警告 | `Alert severity="warning"` |
| マスタ検索リスト | `List`（クリックで選択→フォームに反映） |
| マスタ登録チェック | `Checkbox` + `FormControlLabel` |

**Props**: `mealType`（初期値は現在時刻から算出、またはホームの未記録行タップ時にはその区分をプリセット）, `aiSuggestion`（写真解析結果、任意）, `masterItems`
**状態遷移**: 区分切替、写真アップロード→AI呼び出し(非同期, loading state)→フォーム自動入力、マスタ行タップ→フォーム上書き、保存（`createMeal`）→新規レコードを`synced:false`で追加しホームへ遷移

---

### 8. 水分を記録（Water・フェーズ2）
**Purpose**: クイックタップで当日の水分摂取量を積み上げる。
**Layout**: ヘッダー（戻る）→ 合計カード（当日合計/目標ml + 進捗バー。目標未設定時は達成度非表示・案内文のみ）→ クイック追加（100/200/350/500ml の4ボタン、500はプライマリ強調）→ 今日の記録リスト（時刻+ml+削除ボタン）。リストが空なら空状態文言。
**MUI対応**: 合計バー `LinearProgress` / クイックボタン `Button` or `ToggleButton` / リスト `List` + 行末に削除`IconButton`
**Props**: `entries: {id,time,ml}[]`, `target: number|null`（未設定許容）
**状態遷移**: クイックボタン→entriesに現在時刻で追加、行削除→即時除去、合計・バーはリアクティブに再計算

---

### 9. 日記（Diary・フェーズ2）
**Purpose**: 当日の気分とフリーテキストの短い日記を記録。
**Layout**: ヘッダー（戻る）→ 気分セレクター（絶好調/良い/普通/眠い/不調 の5段階、各アイコンは他画面と同じストローク調の手描きSVG表情、選択中はアンバー枠）→ フリーテキストエリア（textarea）→ 下部固定保存ボタン
**MUI対応**: 気分 `ToggleButtonGroup` or 自前チップ群 / 本文 `TextField multiline`
**Props**: `mood: string|null`, `text: string`
**状態遷移**: 開く時に既存値をドラフトにコピー、保存→確定しホームへ（ホーム行に気分アイコン+本文プレビュー表示）

---

### 10. 筋トレを記録（Strength・フェーズ2）
**Purpose**: 複数種目を、それぞれ「重量×回数」のセット単位で記録する。
**Layout**: ヘッダー（戻る）→ 種目カードを縦に並べる（種目名入力、セットリスト、「セットを追加」、種目削除）→ 末尾に「種目を追加」破線ボタン → 下部固定保存ボタン
**MUI対応**: 種目カード `Card` + `TextField` / セット行 `TextField`(number)×2 + 削除`IconButton` / セット追加・種目追加 `Button variant="outlined"`
**Props**: `exercises: {name, sets: {weight,reps}[]}[]`
**状態遷移**: 種目追加/削除・セット追加/行削除・値編集はすべてドラフト側（`strengthDraftExercises`）、保存→名前もセットも空の種目を除外して確定、ホームへ（行に「n種目・合計セット数」プレビュー）

---

## グローバル状態・ナビゲーション
- `screen: 'home' | 'trends' | 'settings' | 'master' | 'exerciseMaster' | 'weight' | 'meal' | 'mealEdit' | 'water' | 'diary' | 'strength'` — ルーティング（`react-router`のpathに置き換え推奨。プロトタイプはSPA内state切替のみ。水分は独立画面ではなくホーム内インライン展開）
- （FABアクションシートは廃止。記録導線はホームの直接タップに集約）
- 食事は`mealRecords: {id,mealType,time,name,kcal,p,f,c,synced}[]`で保持し、ホームは区分（朝/昼/夕/間）ごとに全品目をグルーピング表示（複数品目対応）。新規作成(`createMeal`)/編集(`updateMeal`→`synced:false`)/削除(`confirmMealDelete`)に対応
- フェーズ2データ: `waterEntries`（独立画面）, `diaryMood`/`diaryText`, `strengthExercisesData: {name, sets}[]`（1画面で複数種目を編集） — 各記録はドラフトstateを経由して保存時に確定
- `editMode` 系 — 設定画面の目標編集ボトムシート（体重/目標日/基準日/カロリー/水分目標）
- 目標値（`goalWeight`, `goalDate`, `baselineDate`, `goalCalories`）はホーム・推移・設定の3画面から参照/更新されるため、`Context`（例: `GoalSettingsContext`）かグローバルストア（Zustand等）で保持することを推奨
- 記録データ（体重履歴・食事履歴・マスタ）はローカルファースト。将来のスプレッドシート同期はサービス層で抽象化し、差し替え可能にしておく

## Design Tokens

**Colors**
| 用途 | Hex |
|---|---|
| Primary（コーラル） | #FF6B4A |
| Primary hover/deep | #FF5A38 |
| Secondary（ミントティール） | #2EC4B6 |
| Warning/達成（イエロー） | #FFC145 / #FFB01F |
| 背景（アイボリー） | #FFF8F0 |
| 背景（外枠/デバイス周辺） | #EAE0D3 |
| テキスト主 | #2B2B2B |
| テキスト副 | #8C8C8C |
| テキスト弱 | #B7AE9F / #C3B29A |
| ボーダー | #F0E7DB / #F4EEE4 |
| Alert/warning背景 | #FBF1DD（文字 #C6A05A） |
| Success背景 | #E4F7F5（文字 #2EC4B6 / #1B8B80） |

**Typography**
- 数値・見出し: `M PLUS Rounded 1c`（weight 400/500/700/800）
- 本文: `Noto Sans JP`（weight 300/400/500/700）
- 本文最小サイズ 10-11px（キャプション）、本文標準13-15px、数値強調18-46px

**Radius / Shadow**
- カード角丸: 16-22px
- ボタン・チップ角丸: 10-20px（大きめのpill基調）
- カードshadow: `0 10px 26px -14px rgba(120,60,20,.28)`（暖色系の柔らかい影で統一）

## Assets
アイコンはすべて手描きSVG（絵文字不使用、ストローク幅1.6-1.9、丸みのあるlinecap/linejoin）。実装時は同一トーン＆マナーのアイコンライブラリ（例: 独自SVGスプライト化、または近い丸みを持つセット）に置き換え可。写真・アバター画像は現在プレースホルダーのため、実データ/アップロード機能と接続が必要。

## Screenshots
`screenshots/` に各画面のキャプチャを同梱（プロトタイプから撮影、実際の見た目そのまま）。
- `01_home.png` — ホーム
- `02_trends_graph.png` — 推移（グラフタブ）
- `03_trends_history.png` — 推移（履歴タブ・全期間日付降順）
- `04_settings.png` — 設定
- `05_meal_master.png` — 食事マスタ管理
- `06_weight_entry.png` — 体重を記録
- `07_meal_entry.png` — 食事を記録
- `08_meal_edit.png` / `09_meal_delete_confirm.png` — 食事を編集・削除確認（Issue #24）
- 水分・日記・筋トレ（フェーズ2、要件定義v2）はホーム下部セクション＋各記録画面として`prototype.dc.html`に実装済み。スクリーンショットは未同梱のため必要なら追加キャプチャしてください

## Files
- `prototype.dc.html` — 全画面を回遊できるインタラクティブなSPAプロトタイプ（本README作成のベース、最も詳細な挙動リファレンス）
- `home_screen.dc.html` / `record_flow.dc.html` / `trends_settings.dc.html` — 個別の高精細デザイン（プロトタイプ統合前の単体ファイル、細部確認用）

※ ログイン/サインアップ画面は実装スコープ外のため同梱していません。
