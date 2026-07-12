import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import Card from "@mui/material/Card";
import { IconBarbell, IconFork } from "@/components/icons";
import { db } from "@/db/db";
import { tokens } from "@/theme";
import SettingRow, { SectionLabel } from "./SettingRow";

/** 設定画面の「食事マスタ」「種目マスタ」セクション。件数表示と管理画面への遷移を持つ */
export default function MasterDataSections() {
  const navigate = useNavigate();
  // 件数表示だけなので全件ロードせずcount()で数える(Issue #59)
  const foodMasterCount = useLiveQuery(() => db.foodMasterItems.count(), []);
  const exerciseMasterCount = useLiveQuery(() => db.exerciseMasterItems.count(), []);

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
          onClick={() => navigate("/settings/food-master")}
        />
      </Card>

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
