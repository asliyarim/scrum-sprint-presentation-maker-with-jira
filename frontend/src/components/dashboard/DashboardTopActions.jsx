import { useRef } from "react";
import Button from "../shared/Button";
import { IconUpload, IconDownload, IconSave, IconRefresh, IconJira, IconCheckCircle } from "../shared/icons";

/** Bkz. SprintTopActions - onExcelFile/onSave/onJiraSync null ise ilgili buton gizlenir (salt-okunur goruntuleme). */
export default function DashboardTopActions({
  onExcelFile, excelLoading, onGenerate, generating, onSave, saving, onUpdate, updating,
  onJiraSync, jiraSyncing, onToggleFinalized, finalized, finalizing,
}) {
  const fileInputRef = useRef(null);

  return (
    <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
      {onExcelFile && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              if (e.target.files[0]) onExcelFile(e.target.files[0]);
              e.target.value = "";
            }}
          />
          <Button variant="ghost" loading={excelLoading} loadingLabel="Okunuyor…" onClick={() => fileInputRef.current?.click()}>
            <IconUpload className="navbar-icon" />
            Excel Yükle
          </Button>
        </>
      )}
      {onJiraSync && (
        <Button
          variant="ghost"
          loading={jiraSyncing}
          loadingLabel="Jira'dan çekiliyor…"
          onClick={onJiraSync}
          title="Bu takım için Jira senkronizasyonunu tetikler - veriler arka planda birkaç saniye içinde güncellenir"
        >
          <IconJira className="navbar-icon" />
          Jira'dan Çek
        </Button>
      )}
      {onSave && (
        <Button variant="ghost" loading={saving} loadingLabel="Kaydediliyor…" onClick={onSave}>
          <IconSave className="navbar-icon" />
          Kaydet
        </Button>
      )}
      {onUpdate && (
        <Button variant="ghost" loading={updating} loadingLabel="Güncelleniyor…" onClick={onUpdate} title="Ortak Sunum'dan geldiniz - mevcut sürümü yerinde günceller, yeni sürüm eklemez">
          <IconRefresh className="navbar-icon" />
          Güncelle
        </Button>
      )}
      {/* Sprint adimindakiyle AYNI buton - PO hangi adimda olursa olsun
          sunumunu hazir isaretleyebilsin (bkz. SprintTopActions). */}
      {onToggleFinalized && (
        <Button
          variant={finalized ? "soft" : "primary"}
          loading={finalizing}
          loadingLabel="İşaretleniyor…"
          onClick={onToggleFinalized}
          title={
            finalized
              ? "Bu sunum hazır olarak işaretli. Kaldırırsanız ortak sunumda görünmez."
              : "Sunumunuz son haline geldiyse işaretleyin - tüm ekipler işaretlediğinde ortak sunum otomatik oluşur."
          }
        >
          <IconCheckCircle className="navbar-icon" />
          {finalized ? "Hazır ✓" : "Sunumum Hazır"}
        </Button>
      )}
      <Button variant="primary" loading={generating} loadingLabel="Hazırlanıyor…" onClick={onGenerate}>
        <IconDownload className="navbar-icon" />
        PPTX İndir
      </Button>
    </span>
  );
}
