import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  IconBack,
  IconChevronRight,
  IconDownload,
  IconEdit,
  IconSearch,
  IconTrash,
} from "../components/icons";
import {
  bulkAddFoodMasterItems,
  deleteFoodMasterItem,
  getAllFoodMasterItems,
  updateFoodMasterItem,
} from "../db/foodMaster";
import { foodMasterSeedData } from "../db/foodMasterSeedData";
import { fontRounded, tokens } from "../theme";
import type { FoodMasterItem } from "../types";

const PAGE_SIZE = 8;

export default function FoodMasterPage() {
  const navigate = useNavigate();
  const items = useLiveQuery(() => getAllFoodMasterItems(), []);

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editKcal, setEditKcal] = useState("");
  const [editProteinG, setEditProteinG] = useState("");
  const [editFatG, setEditFatG] = useState("");
  const [editCarbsG, setEditCarbsG] = useState("");
  const [isSeeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  if (items === undefined) {
    return <Typography sx={{ p: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>読み込み中...</Typography>;
  }

  const trimmedQuery = query.trim();
  const filtered = trimmedQuery ? items.filter((item) => item.name.includes(trimmedQuery)) : items;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  const startEdit = (item: FoodMasterItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditKcal(String(item.kcal));
    setEditProteinG(String(item.proteinG));
    setEditFatG(String(item.fatG));
    setEditCarbsG(String(item.carbsG));
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateFoodMasterItem(editingId, {
      name: editName.trim(),
      kcal: Number(editKcal),
      proteinG: Number(editProteinG),
      fatG: Number(editFatG),
      carbsG: Number(editCarbsG),
    });
    setEditingId(null);
  };

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMessage(null);
    try {
      const count = await bulkAddFoodMasterItems(foodMasterSeedData);
      setSeedMessage(
        count > 0 ? `${count}件を登録しました` : "追加できる新しい品目はありませんでした(すべて登録済みです)",
      );
    } finally {
      setSeeding(false);
    }
  };

  return (
    <Box sx={{ mx: "auto", maxWidth: 448, px: "20px", pt: "16px", pb: "130px" }}>
      {/* ヘッダー */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "14px" }}>
        <IconButton
          onClick={() => navigate("/settings")}
          aria-label="設定に戻る"
          sx={{ width: 38, height: 38, borderRadius: "12px", bgcolor: "background.paper", boxShadow: tokens.fieldShadow, color: "text.primary" }}
        >
          <IconBack />
        </IconButton>
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16 }}>食事マスタ</Typography>
        <Box sx={{ width: 38 }} />
      </Box>

      {/* 検索 */}
      <TextField
        fullWidth
        size="small"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(0);
        }}
        placeholder="品目名で検索"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Box sx={{ color: tokens.faint, display: "flex" }}>
                  <IconSearch />
                </Box>
              </InputAdornment>
            ),
          },
        }}
        sx={{ mb: "14px" }}
      />

      {/* 定番メニュー一括登録 */}
      <ButtonBase
        onClick={handleSeed}
        disabled={isSeeding}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          width: "100%",
          bgcolor: tokens.secondarySoft,
          borderRadius: "14px",
          p: "13px 15px",
          textAlign: "left",
          mb: "6px",
        }}
      >
        <Box sx={{ color: "secondary.main", display: "flex", flexShrink: 0 }}>
          <IconDownload />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13, color: tokens.secondaryDeep }}>
            {isSeeding ? "登録中..." : "定番メニューを一括登録"}
          </Typography>
          <Typography sx={{ fontSize: 11, color: tokens.secondaryDeep, opacity: 0.8, mt: "2px" }}>
            モスバーガー・ミスタードーナツ・コンビニの定番。登録済みはスキップします
          </Typography>
        </Box>
      </ButtonBase>
      {seedMessage && <Typography sx={{ fontSize: 12, color: "text.secondary", mb: "6px", px: "4px" }}>{seedMessage}</Typography>}

      {/* 件数 */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", m: "10px 4px 8px" }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary" }}>
          登録済み {filtered.length}件
        </Typography>
        <Typography sx={{ fontSize: 11, color: tokens.faint }}>名前順</Typography>
      </Box>

      {/* リスト */}
      {items.length === 0 ? (
        <Card sx={{ p: "20px" }}>
          <Typography sx={{ fontSize: 13, color: "text.secondary", textAlign: "center" }}>
            まだ登録がありません。食事記録の保存時に「マスタに登録する」を選ぶと追加されます。
          </Typography>
        </Card>
      ) : (
        <Card sx={{ overflow: "hidden" }}>
          {pageItems.map((item, index) =>
            editingId === item.id ? (
              <Box key={item.id} sx={{ p: "12px 14px", borderBottom: index < pageItems.length - 1 ? `1px solid ${tokens.divider}` : "none" }}>
                <TextField
                  fullWidth
                  size="small"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  sx={{ mb: "8px" }}
                />
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", mb: "8px" }}>
                  <TextField size="small" type="number" value={editKcal} onChange={(e) => setEditKcal(e.target.value)} placeholder="kcal" />
                  <TextField size="small" type="number" value={editProteinG} onChange={(e) => setEditProteinG(e.target.value)} placeholder="P" />
                  <TextField size="small" type="number" value={editFatG} onChange={(e) => setEditFatG(e.target.value)} placeholder="F" />
                  <TextField size="small" type="number" value={editCarbsG} onChange={(e) => setEditCarbsG(e.target.value)} placeholder="C" />
                </Box>
                <Box sx={{ display: "flex", gap: "8px" }}>
                  <Button fullWidth variant="contained" size="small" onClick={saveEdit}>
                    保存
                  </Button>
                  <Button fullWidth variant="outlined" size="small" onClick={() => setEditingId(null)} sx={{ color: "text.secondary", borderColor: tokens.border }}>
                    キャンセル
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box
                key={item.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  p: "12px 14px",
                  borderBottom: index < pageItems.length - 1 ? `1px solid ${tokens.divider}` : "none",
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.name}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: "text.secondary", mt: "2px" }}>
                    P{item.proteinG} / F{item.fatG} / C{item.carbsG}g
                  </Typography>
                </Box>
                <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                  {item.kcal}
                  <Box component="span" sx={{ fontSize: 10, color: "text.secondary", fontWeight: 500 }}>
                    kcal
                  </Box>
                </Typography>
                <IconButton
                  onClick={() => startEdit(item)}
                  aria-label={`${item.name}を編集`}
                  sx={{ width: 30, height: 30, borderRadius: "9px", border: `1px solid ${tokens.border}`, color: "text.secondary" }}
                >
                  <IconEdit size={14} />
                </IconButton>
                <IconButton
                  onClick={() => deleteFoodMasterItem(item.id)}
                  aria-label={`${item.name}を削除`}
                  sx={{ width: 30, height: 30, borderRadius: "9px", border: `1px solid ${tokens.border}`, color: "primary.main" }}
                >
                  <IconTrash size={14} />
                </IconButton>
              </Box>
            ),
          )}
          {filtered.length === 0 && (
            <Typography sx={{ p: "16px", fontSize: 12, color: "text.secondary", textAlign: "center" }}>
              該当する品目がありません
            </Typography>
          )}
        </Card>
      )}

      {/* ページネーション */}
      {pageCount > 1 && (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", mt: "12px" }}>
          <IconButton
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage === 0}
            aria-label="前のページ"
            sx={{ color: currentPage === 0 ? tokens.faint2 : "primary.main" }}
          >
            <Box sx={{ transform: "rotate(180deg)", display: "flex" }}>
              <IconChevronRight />
            </Box>
          </IconButton>
          <Typography sx={{ fontFamily: fontRounded, fontWeight: 600, fontSize: 11, color: "text.secondary" }}>
            {currentPage + 1} / {pageCount} ページ
          </Typography>
          <IconButton
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage === pageCount - 1}
            aria-label="次のページ"
            sx={{ color: currentPage === pageCount - 1 ? tokens.faint2 : "primary.main" }}
          >
            <IconChevronRight />
          </IconButton>
        </Box>
      )}
    </Box>
  );
}
