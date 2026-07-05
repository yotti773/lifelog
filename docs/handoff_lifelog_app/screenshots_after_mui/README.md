# MUI移行後のスクリーンショット(Issue #27 / PR #33)

`../screenshots/` にあるデザインモックのキャプチャに対して、実際にMUIで実装した結果を並べて確認できるよう撮影したもの(Playwrightで実データを投入して撮影)。

- `01_home.png` — ホーム(FAB廃止後。体重・体脂肪率カードは前回比表示に統一)
- `02_weight_card_tap_prefilled.png` — ホームの体重カードタップ → 当日分をprefillして体重編集画面が開く
- `03_meal_label_tap_dinner_preset.png` — 未記録の食事区分(夕食)タップ → 区分プリセットで新規記録
- `04_meal_label_tap_breakfast_preset.png` — 記録済み区分(朝食)のラベル部分タップ → 同区分で新規追加(既存品目の編集にはならない)
- `05_trends_graph.png` / `06_trends_history.png` — 推移(グラフ/履歴)
- `07_settings.png` / `08_settings_edit_sheet.png` — 設定・目標体重の編集ボトムシート
- `09_food_master.png` — 食事マスタ管理画面(専用画面に分離)
- `10_meal_record.png` — 食事を記録(新規)
- `11_meal_edit.png` / `12_meal_delete_confirm.png` — 食事の編集・削除確認
