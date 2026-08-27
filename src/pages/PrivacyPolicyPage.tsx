import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import RecordHeader from "@/components/RecordHeader";
import { IconCheck, IconClose } from "@/components/icons";
import { fontRounded, tokens } from "@/theme";

/**
 * プライバシーポリシー(Issue #238)。
 *
 * **OAuth同意画面(#214)を本番公開するために、実在するURLが必要**なため用意した画面。
 * Google Cloud Console の「プライバシーポリシー URL」に `/privacy` を登録する。
 * 同時に、配布(#213)の相手に「何が端末に残り、何が外へ出るのか」を示す場所でもある。
 *
 * **本文は事実だけを書く。** 実装を変えたらこのページも直すこと — 特に次の3点は
 * コードと1対1で対応しており、嘘になると同意の前提が崩れる:
 * - 日記本文をAIへ送るのは `Settings.sendDiaryTextToAi` がONのときだけ(`src/lib/weeklyDigest.ts`)
 * - Googleへ要求するスコープは `drive.file` のみ(`worker/googleOAuth.ts` の `GOOGLE_OAUTH_SCOPE`)
 * - 写真は判定に使うだけで端末にもサーバーにも保存しない(`MealRecord.photoLocalRef` は未使用)
 */

/** 最終更新日。本文を変えたらここも更新する(利用者が変更に気付ける唯一の手がかりのため) */
const LAST_UPDATED = "2026年8月27日";

/** AIへ送るもの・送らないものの一覧。「送る」を上にまとめ、誤解の起きやすい日記本文を送らない側の先頭に置く */
const AI_DATA_ROWS: { label: string; sent: boolean; note?: string }[] = [
  { label: "食事の写真・入力したテキスト", sent: true },
  { label: "記録の要約(体重・カロリー・PFC・歩数など)", sent: true },
  { label: "日記の気分タグ(件数のみ)", sent: true },
  { label: "日記の本文", sent: false, note: "既定で送らない" },
  { label: "氏名・メールアドレス", sent: false },
];

function Section({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card sx={{ p: "15px 16px", mb: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: "9px" }}>
        <Box
          sx={{
            width: 26,
            height: 26,
            borderRadius: "9px",
            bgcolor: tokens.primarySoft,
            color: "primary.main",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontFamily: fontRounded,
            fontWeight: 700,
            fontSize: 11,
          }}
        >
          {index}
        </Box>
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 14 }}>{title}</Typography>
      </Box>
      {children}
    </Card>
  );
}

/** 本文の段落。行間を広めに取り、読み物として読める密度にする */
function Paragraph({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ fontSize: 12, lineHeight: 1.95, color: "#4A4A4A" }}>{children}</Typography>;
}

function Strong({ children }: { children: React.ReactNode }) {
  return (
    <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>
      {children}
    </Box>
  );
}

export default function PrivacyPolicyPage() {
  const navigate = useNavigate();

  /**
   * 戻る。**このページはGoogle Cloud Consoleに登録するURLとして直接開かれる**ため、
   * 履歴が無いことがある(その場合 navigate(-1) は何も起きない)。
   * react-routerは履歴内の位置を history.state.idx に持つので、先頭なら設定画面へ送る。
   */
  const handleBack = () => {
    const historyIndex = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof historyIndex === "number" && historyIndex > 0) navigate(-1);
    else navigate("/settings", { replace: true });
  };

  return (
    <Box sx={{ mx: "auto", maxWidth: 448, px: "20px", pt: "16px", pb: "40px" }}>
      <RecordHeader title="プライバシーポリシー" onBack={handleBack} />

      <Typography sx={{ fontSize: 11, color: tokens.faint, mb: "12px", px: "2px" }}>
        最終更新: {LAST_UPDATED}
      </Typography>

      {/* 要約。配布相手が最初に読む画面になるため、結論を先に置く */}
      <Box sx={{ bgcolor: tokens.secondarySoft, borderRadius: "18px", p: "14px 15px", mb: "14px" }}>
        <Typography
          sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13, color: tokens.secondaryDeep, mb: "7px" }}
        >
          まとめ
        </Typography>
        <Box component="ul" sx={{ m: 0, pl: "17px", display: "flex", flexDirection: "column", gap: "5px" }}>
          {[
            "記録はあなたの端末の中に保存されます",
            "同期をONにしたときだけ、記録があなたのGoogleスプレッドシートへ送られます",
            "日記の本文は、設定でONにしない限りAIに送りません",
            "解析ツールの設置・広告・第三者への提供はありません",
          ].map((text) => (
            <Typography key={text} component="li" sx={{ fontSize: 11.5, lineHeight: 1.7, color: "#2F6F68" }}>
              {text}
            </Typography>
          ))}
        </Box>
      </Box>

      <Section index={1} title="端末に保存される情報">
        <Paragraph>
          体重・食事・水分・筋トレ・日記・習慣などの記録と、身長や目標といった設定は、
          <Strong>あなたのブラウザの中(IndexedDB)</Strong>
          に保存されます。ここに保存されている限り、記録が外部へ出ることはありません。
        </Paragraph>
      </Section>

      <Section index={2} title="スプレッドシートへの同期">
        <Paragraph>
          同期は<Strong>既定では無効</Strong>
          です。設定画面でGoogleと連携して同期を有効にした場合にかぎり、記録は
          <Strong>あなた自身のGoogle Driveに作成されるスプレッドシート</Strong>
          に保存されます。端末を変えても記録を引き継げるようにするための機能です。
        </Paragraph>
      </Section>

      <Section index={3} title="Googleアカウントとの連携">
        <Paragraph>
          連携する場合、このアプリが求める権限は
          <Strong>「このアプリが作成したファイルへのアクセス」(drive.file)だけ</Strong>
          です。Driveにある他のファイル、メール、連絡先などを見ることはできません。連携は設定画面からいつでも解除できます。
        </Paragraph>
      </Section>

      <Section index={4} title="AIに送られる情報">
        <Paragraph>
          食事の判定と、週次・月次レビューのコメント生成に、GoogleのGemini APIを利用します。送られるのは次のものだけです。
        </Paragraph>
        <Box sx={{ display: "flex", flexDirection: "column" }}>
          {AI_DATA_ROWS.map((row, index) => (
            <Box
              key={row.label}
              sx={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "12px",
                py: "9px",
                borderBottom: index === AI_DATA_ROWS.length - 1 ? "none" : `1px solid ${tokens.divider}`,
              }}
            >
              <Typography sx={{ fontSize: 11.5, lineHeight: 1.6, color: "#4A4A4A" }}>{row.label}</Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
                <Box sx={{ display: "flex", color: row.sent ? "primary.main" : tokens.secondaryDeep }}>
                  {row.sent ? <IconCheck size={12} /> : <IconClose size={12} />}
                </Box>
                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: row.sent ? "primary.main" : tokens.secondaryDeep,
                  }}
                >
                  {row.sent ? "送る" : (row.note ?? "送らない")}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
        <Paragraph>
          日記の本文は、設定の<Strong>「日記の本文をAIに送る」</Strong>
          をONにしたときだけ、レビューの生成に含まれます。写真は判定に使うだけで、端末にもサーバーにも保存しません。
        </Paragraph>
      </Section>

      <Section index={5} title="行わないこと">
        <Paragraph>
          アクセス解析ツールの設置、広告の配信、記録の第三者への提供・販売は
          <Strong>いずれも行いません</Strong>
          。サーバー側に残るのは通信のログ(いつ・どのURLへリクエストがあったか)だけで、用途は「障害の調査」と「どの入り口から来たかを知ること」の2つです。後者は、記事やSNSに貼ったリンクに付けておいた印を数えているだけで、
          <Strong>誰が来たかは分かりません</Strong>
          (IPアドレス・端末の情報・記録の中身は残していません)。
        </Paragraph>
      </Section>

      <Section index={6} title="データの削除">
        <Paragraph>
          端末の記録は、設定画面の「アプリのデータを削除」またはブラウザのサイトデータ削除で消せます。Googleとの連携は設定画面から解除でき、Googleアカウントの「サードパーティ
          アプリとの連携」からも取り消せます。スプレッドシートに書き込まれた行は、そのシートを直接編集して削除してください。
        </Paragraph>
      </Section>

      <Typography sx={{ fontSize: 11, color: "text.secondary", lineHeight: 1.8, px: "4px", mt: "4px" }}>
        お問い合わせ・ポリシーの変更について —{" "}
        <Box
          component="a"
          href="https://github.com/yotti773/lifelog/issues"
          target="_blank"
          rel="noreferrer"
          sx={{ color: tokens.secondaryDeep }}
        >
          GitHubのIssue
        </Box>{" "}
        で受け付けます。内容を変更した場合は、このページの最終更新日を改めます。
      </Typography>
    </Box>
  );
}
