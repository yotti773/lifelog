// 2026年7月時点、各社公式サイトの栄養成分表(モスバーガー・ミスタードーナツはPDF、コンビニ各社は商品ページ)を出典として作成
export interface FoodMasterSeedItem {
  name: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  source: string; // 参照した公式ページのURL
}

// 店ごとに商品をまとめて定義する。商品名(name)には店名を含めず、
// エクスポート時に `【店ラベル】商品名` の形へ整形する(Issue #34)。
// これにより一覧・検索で「どの店の品目か」が分かり、店名(例: "ミスド")での検索も効くようになる。
interface FoodMasterSeedGroup {
  /** 一覧・検索で使う短い店ラベル(例: モス / ミスド / セブン / ローソン / ファミマ) */
  storeLabel: string;
  items: FoodMasterSeedItem[];
}

const foodMasterSeedGroups: FoodMasterSeedGroup[] = [
  // ===== モスバーガー =====
  // 出典: モスバーガー商品 栄養成分表(更新日 2026年5月20日)
  {
    storeLabel: "モス",
    items: [
      { name: "モスバーガー", kcal: 372, proteinG: 15.2, fatG: 17.0, carbsG: 40.0, source: "https://www.mos.jp/menu/pdf/nutrition.pdf" },
      { name: "モスチーズバーガー", kcal: 425, proteinG: 18.2, fatG: 21.4, carbsG: 40.4, source: "https://www.mos.jp/menu/pdf/nutrition.pdf" },
      { name: "テリヤキバーガー", kcal: 385, proteinG: 14.3, fatG: 18.2, carbsG: 41.2, source: "https://www.mos.jp/menu/pdf/nutrition.pdf" },
      { name: "テリヤキチキンバーガー", kcal: 303, proteinG: 20.1, fatG: 10.3, carbsG: 32.4, source: "https://www.mos.jp/menu/pdf/nutrition.pdf" },
      { name: "モス野菜バーガー", kcal: 363, proteinG: 14.1, fatG: 18.6, carbsG: 35.4, source: "https://www.mos.jp/menu/pdf/nutrition.pdf" },
      { name: "フィッシュバーガー", kcal: 381, proteinG: 16.2, fatG: 18.8, carbsG: 37.0, source: "https://www.mos.jp/menu/pdf/nutrition.pdf" },
      { name: "チキンバーガー", kcal: 386, proteinG: 15.0, fatG: 18.5, carbsG: 40.0, source: "https://www.mos.jp/menu/pdf/nutrition.pdf" },
      { name: "ハンバーガー", kcal: 314, proteinG: 13.7, fatG: 13.2, carbsG: 35.2, source: "https://www.mos.jp/menu/pdf/nutrition.pdf" },
      { name: "チーズバーガー", kcal: 367, proteinG: 16.7, fatG: 17.6, carbsG: 35.6, source: "https://www.mos.jp/menu/pdf/nutrition.pdf" },
      { name: "スパイシーモスバーガー", kcal: 375, proteinG: 15.3, fatG: 17.1, carbsG: 40.4, source: "https://www.mos.jp/menu/pdf/nutrition.pdf" },
      { name: "モスライスバーガー焼肉", kcal: 353, proteinG: 9.5, fatG: 11.6, carbsG: 52.8, source: "https://www.mos.jp/menu/pdf/nutrition.pdf" },
      { name: "フレンチフライポテトM", kcal: 238, proteinG: 3.0, fatG: 9.8, carbsG: 34.7, source: "https://www.mos.jp/menu/pdf/nutrition.pdf" },
      { name: "オニポテ", kcal: 189, proteinG: 2.6, fatG: 8.7, carbsG: 25.3, source: "https://www.mos.jp/menu/pdf/nutrition.pdf" },
      { name: "チキンナゲット5コ入り", kcal: 195, proteinG: 14.8, fatG: 10.2, carbsG: 10.9, source: "https://www.mos.jp/menu/pdf/nutrition.pdf" },
      { name: "モスチキン", kcal: 269, proteinG: 15.3, fatG: 16.6, carbsG: 14.7, source: "https://www.mos.jp/menu/pdf/nutrition.pdf" },
    ],
  },

  // ===== ミスタードーナツ =====
  // 出典: ミスタードーナツ 栄養成分情報(2026年7月1日現在)
  {
    storeLabel: "ミスド",
    items: [
      { name: "ポン・デ・リング", kcal: 219, proteinG: 1.2, fatG: 11.8, carbsG: 26.9, source: "https://www.misterdonut.jp/m_menu/eiyou/eiyou.pdf" },
      { name: "ポン・デ・黒糖", kcal: 202, proteinG: 1.2, fatG: 11.9, carbsG: 22.4, source: "https://www.misterdonut.jp/m_menu/eiyou/eiyou.pdf" },
      { name: "オールドファッション", kcal: 281, proteinG: 3.4, fatG: 17.0, carbsG: 28.0, source: "https://www.misterdonut.jp/m_menu/eiyou/eiyou.pdf" },
      { name: "チョコファッション", kcal: 318, proteinG: 3.7, fatG: 19.7, carbsG: 30.7, source: "https://www.misterdonut.jp/m_menu/eiyou/eiyou.pdf" },
      { name: "フレンチクルーラー", kcal: 148, proteinG: 1.5, fatG: 9.2, carbsG: 14.3, source: "https://www.misterdonut.jp/m_menu/eiyou/eiyou.pdf" },
      { name: "エンゼルクリーム", kcal: 200, proteinG: 3.1, fatG: 12.0, carbsG: 19.5, source: "https://www.misterdonut.jp/m_menu/eiyou/eiyou.pdf" },
      { name: "カスタードクリーム", kcal: 222, proteinG: 3.4, fatG: 11.8, carbsG: 25.2, source: "https://www.misterdonut.jp/m_menu/eiyou/eiyou.pdf" },
      { name: "ハニーディップ", kcal: 216, proteinG: 4.1, fatG: 11.4, carbsG: 24.0, source: "https://www.misterdonut.jp/m_menu/eiyou/eiyou.pdf" },
      { name: "シュガーレイズド", kcal: 207, proteinG: 4.1, fatG: 11.5, carbsG: 21.3, source: "https://www.misterdonut.jp/m_menu/eiyou/eiyou.pdf" },
      { name: "チョコレート", kcal: 245, proteinG: 2.9, fatG: 13.9, carbsG: 26.8, source: "https://www.misterdonut.jp/m_menu/eiyou/eiyou.pdf" },
      { name: "ダブルチョコレート", kcal: 271, proteinG: 3.4, fatG: 17.3, carbsG: 24.8, source: "https://www.misterdonut.jp/m_menu/eiyou/eiyou.pdf" },
      { name: "しっとりマフィン バター風味", kcal: 344, proteinG: 4.2, fatG: 18.0, carbsG: 41.1, source: "https://www.misterdonut.jp/m_menu/eiyou/eiyou.pdf" },
      { name: "しっとりマフィン チョコ", kcal: 323, proteinG: 3.9, fatG: 17.3, carbsG: 37.7, source: "https://www.misterdonut.jp/m_menu/eiyou/eiyou.pdf" },
      { name: "ハニーチュロ", kcal: 205, proteinG: 3.3, fatG: 10.1, carbsG: 24.9, source: "https://www.misterdonut.jp/m_menu/eiyou/eiyou.pdf" },
      { name: "北海道産コーンスープ", kcal: 115, proteinG: 2.5, fatG: 3.1, carbsG: 19.3, source: "https://www.misterdonut.jp/m_menu/eiyou/eiyou.pdf" },
    ],
  },

  // ===== コンビニ: セブン-イレブン =====
  {
    storeLabel: "セブン",
    items: [
      { name: "手巻おにぎり 北海道産昆布", kcal: 176, proteinG: 3.3, fatG: 1.4, carbsG: 38.7, source: "https://www.sej.co.jp/products/a/item/041956/" },
      { name: "手巻おにぎり 具たっぷり辛子明太子", kcal: 173, proteinG: 5.1, fatG: 0.8, carbsG: 37.2, source: "https://www.sej.co.jp/products/a/item/041910/" },
      { name: "手巻おにぎり 炭火焼銀しゃけ", kcal: 182, proteinG: 4.5, fatG: 2.7, carbsG: 35.9, source: "https://www.sej.co.jp/products/a/item/043124/" },
      { name: "小さなおむすび ゆかり", kcal: 136, proteinG: 2.6, fatG: 0.8, carbsG: 30.3, source: "https://www.sej.co.jp/products/a/item/043433/" },
      { name: "鶏めしおむすびセット", kcal: 390, proteinG: 15.1, fatG: 14.4, carbsG: 51.1, source: "https://www.sej.co.jp/products/a/item/041598/" },
      { name: "ポーク玉子おむすび", kcal: 400, proteinG: 10.9, fatG: 17.8, carbsG: 50.2, source: "https://www.sej.co.jp/products/a/item/041890/" },
    ],
  },

  // ===== コンビニ: ローソン =====
  {
    storeLabel: "ローソン",
    items: [
      { name: "たんぱく質30.3g サラダチキン プレーン", kcal: 141, proteinG: 30.3, fatG: 2.1, carbsG: 0.2, source: "https://www.lawson.co.jp/recommend/original/detail/1507463_1996.html" },
      { name: "からあげクン レギュラー", kcal: 226, proteinG: 14.4, fatG: 15.4, carbsG: 7.8, source: "https://www.lawson.co.jp/sp/recommend/original/detail/1390563_2168.html" },
      { name: "手巻おにぎり 北海道産日高昆布", kcal: 173, proteinG: 3.5, fatG: 0.9, carbsG: 38.6, source: "https://www.lawson.co.jp/recommend/original/detail/1527626_1996.html" },
      { name: "手巻おにぎり 熟成辛子明太子", kcal: 174, proteinG: 5.1, fatG: 1.1, carbsG: 36.6, source: "https://www.lawson.co.jp/recommend/original/detail/1527627_1996.html" },
      { name: "手巻おにぎり 炙り熟成紅鮭", kcal: 174, proteinG: 4.8, fatG: 1.9, carbsG: 35.1, source: "https://www.lawson.co.jp/recommend/original/detail/1507600_1996.html" },
      { name: "塩にぎり", kcal: 173, proteinG: 2.9, fatG: 0.9, carbsG: 38.7, source: "https://www.lawson.co.jp/recommend/original/detail/1527622_1996.html" },
      { name: "おにぎりおかずセット(シーチキンマヨネーズ・鮭)", kcal: 468, proteinG: 14.6, fatG: 13.8, carbsG: 72.9, source: "https://www.lawson.co.jp/recommend/original/detail/1527621_1996.html" },
    ],
  },

  // ===== コンビニ: ファミリーマート =====
  {
    storeLabel: "ファミマ",
    items: [
      { name: "ファミチキ(骨なし)", kcal: 251.7, proteinG: 12.7, fatG: 15.7, carbsG: 14.8, source: "https://www.family.co.jp/goods/friedfoods/0253116.html" },
      { name: "塩おむすび", kcal: 186, proteinG: 2.6, fatG: 1.1, carbsG: 41.7, source: "https://www.family.co.jp/goods/omusubi/0411523.html" },
      { name: "手巻 紅しゃけ", kcal: 168, proteinG: 4.3, fatG: 1.5, carbsG: 34.6, source: "https://www.family.co.jp/goods/omusubi/0410151.html" },
      { name: "手巻 辛子明太子", kcal: 175, proteinG: 4.1, fatG: 1.4, carbsG: 36.7, source: "https://www.family.co.jp/goods/omusubi/0410120.html" },
      { name: "手巻 シーチキンマヨネーズ", kcal: 225, proteinG: 4.1, fatG: 6.5, carbsG: 37.9, source: "https://www.family.co.jp/goods/omusubi/0410113.html" },
      { name: "鮭はらみおむすび", kcal: 209, proteinG: 5.2, fatG: 3.8, carbsG: 38.6, source: "https://www.family.co.jp/goods/omusubi/0416108.html" },
    ],
  },
];

/** 一括登録用のシードデータ。各品目名は `【店ラベル】商品名` に整形済み。 */
export const foodMasterSeedData: FoodMasterSeedItem[] = foodMasterSeedGroups.flatMap((group) =>
  group.items.map((item) => ({ ...item, name: `【${group.storeLabel}】${item.name}` })),
);
