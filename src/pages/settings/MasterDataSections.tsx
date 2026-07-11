import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import { IconBarbell, IconDownload, IconFork } from "@/components/icons";
import { getAllExerciseMasterItems } from "@/db/exerciseMaster";
import { getAllFoodMasterItems, bulkAddFoodMasterItems } from "@/db/foodMaster";
import { foodMasterSeedData } from "@/db/foodMasterSeedData";
import { tokens } from "@/theme";
import SettingRow, { SectionLabel } from "./SettingRow";

/** 設定画面の「食事マスタ」「種目マスタ」セクション。件数表示・管理画面への遷移・定番メニューの一括登録を持つ */
export default function MasterDataSections() {
  const navigate = useNavigate();
  const foodMasterCount = useLiveQuery(async () => (await getAllFoodMasterItems()).length, []);
  const exerciseMasterCount = useLiveQuery(async () => (await getAllExerciseMasterItems()).length, []);

  const [isSeeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  const handleSeedMaster = async () => {
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
    <>
      <SectionLabel>食事マスタ</SectionLabel>
      <Card sx={{ overflow: "hidden", mb: "18px" }}>
        <SettingRow
          icon={<IconFork size={18} />}
          iconBg={tokens.primarySoft}
          iconColor="#FF6B4A"
          label="よく食べるものを管理"
          value={foodMasterCount !== undefined ? `${foodMasterCount}件` : ""}
          divider
          onClick={() => navigate("/settings/food-master")}
        />
        <SettingRow
          icon={<IconDownload />}
          iconBg={tokens.secondarySoft}
          iconColor="#2EC4B6"
          label={isSeeding ? "登録中..." : "定番メニューを一括登録"}
          onClick={handleSeedMaster}
        />
      </Card>
      {seedMessage && (
        <Typography sx={{ fontSize: 12, color: "text.secondary", mt: "-10px", mb: "18px", px: "4px" }}>{seedMessage}</Typography>
      )}

      <SectionLabel>種目マスタ</SectionLabel>
      <Card sx={{ overflow: "hidden", mb: "18px" }}>
        <SettingRow
          icon={<IconBarbell size={18} />}
          iconBg={tokens.strengthBg}
          iconColor="#FF6B4A"
          label="よく行う種目を管理"
          value={exerciseMasterCount !== undefined ? `${exerciseMasterCount}件` : ""}
          onClick={() => navigate("/settings/exercise-master")}
        />
      </Card>
    </>
  );
}
