import { SECTION_KEYS, sectionDefs } from "../../lib/geometry";
import BandEditorPanel from "./BandEditorPanel";
import SectionEditor from "./SectionEditor";
import Button from "../shared/Button";
import ErrorBanner from "../shared/ErrorBanner";
import { IconRefresh } from "../shared/icons";
import { hasFteTracking, tracksBenefits } from "../../lib/teamTypes";

const SECTION_TITLES_TR = {
  done: "İçerik — her satır bir madde",
};

/**
 * Sihirbazin 1. adimi: Sprint Sunumu icerik formu (hedef bandi + 4 bolum).
 * Onizleme artik UnifiedPreviewPane icinde ayri olarak yonetiliyor.
 *
 * Oneri (chip) kaynagi Excel VE Jira olabilir - ikisi ayni SectionEditor'da
 * BIRLESTIRILEREK gosterilir (bkz. kullanici bildirimi, 2026-08-17: "içerik
 * slaytına sprint işleri akmaya başlayacak"). "Jira'dan Getir", üst çubuktaki
 * "Jira'dan Çek" (senkronizasyonu TETIKLER, asenkron) ile AYNI eylem DEGIL -
 * DB'de zaten senkronize edilmis olani okur (Kapasite Dashboard'un "Jira'dan"
 * sekmesindeki "Çek sonra Yenile" deseniyle ayni, bkz. useJiraDashboard.js).
 */
export default function SprintPage({ form, band, excel, jira, teamId, jiraProjectKey, assets, onExpandSection, sectorOptions, readability }) {
  const SEC = sectionDefs(assets);

  return (
    <section>
      {/* Madde sayisina sinir yok; cok madde girilince yazi kuculuyor ve bir
          yerden sonra okunmuyor. Slayta MUDAHALE ETMEK yerine PO uyarilir
          (kullanici karari 2026-09-07), kisaltma karari onundur.
          bkz. geometry.contentReadability / FS_READABLE_MIN. */}
      {readability && (
        <div className="warn" role="status" style={{ margin: "0 0 10px", lineHeight: 1.55 }}>
          <b>
            {readability.critical
              ? "Bu slayttaki yazı okunmayacak kadar küçük."
              : "Bu slayttaki yazı oldukça küçüldü."}
          </b>{" "}
          Toplam <b>{readability.itemCount} madde</b> var, hepsi slayda sığsın diye punto{" "}
          <b>{readability.fs}pt</b>'ye düştü
          {readability.critical && " — önizlemede kartlar boş görünebilir, sunumda da okunmaz"}.
          Maddelerin tamamı korunuyor, hiçbiri atılmadı; okunur hale getirmek için maddeleri
          kısaltabilir veya bir kısmını çıkarabilirsin.
        </div>
      )}
      {excel.info && <div className="excelinfo" style={{ marginBottom: 10 }}>{excel.info}</div>}
      <BandEditorPanel band={band} hasFte={hasFteTracking(form.teamType)} showBenefit={tracksBenefits(form.teamType)} />
      <p className="panelttl">{SECTION_TITLES_TR.done}</p>
      {excel.error && <ErrorBanner error={excel.error} onDismiss={() => {}} />}
      {jira && (
        <div className="bandpanel" style={{ marginBottom: 10 }}>
          <Button variant="soft" loading={jira.loading} loadingLabel="Getiriliyor…" onClick={() => jira.fetchFromJira(teamId, jiraProjectKey)}>
            <IconRefresh className="navbar-icon" />
            Jira'dan Getir
          </Button>
          <div className="mhint" style={{ marginTop: 8 }}>
            Önce üst çubuktaki <b>"Jira'dan Çek"</b> ile senkronize et, birkaç saniye sonra buraya bas —
            <b>Tamamlanan İşler</b>: bir önceki (en son kapanan) sprintin <b>Canlı</b> işlerinin HER BİRİ, tek
            tek (Epic'e göre tekilleştirilmez, sadece gerçek tekrarlar elenir). <b>Yapılacak İşler</b>: mevcut
            sprintte hâlâ açık işi olan görev/story'lerin tekilleştirilmiş <b>üst öğesi (Epic)</b>. Sektör/Öncelik
            etiket olarak eklenir. <b>Riskler</b> ve
            <b>Bekleyen Konular</b> Jira'dan getirilmez — bu iki bölümü elle yazın. <b>Hedefler bandı</b>'ndaki
            HEDEFLER çubuğu (Canlı/Kalan Süreç Sayısı) da otomatik doldurulur — FTE çubuğu hariç, Jira'da bu
            veriyi tutan bir alan yok.
          </div>
          {jira.info && <div className="excelinfo" style={{ marginTop: 8 }}>{jira.info}</div>}
          {jira.error && <ErrorBanner error={jira.error} onDismiss={() => {}} />}
        </div>
      )}
      {SECTION_KEYS.map((key) => (
        <SectionEditor
          key={key}
          sectionKey={key}
          def={SEC[key]}
          text={form.sections[key]}
          onTextChange={(text) => form.setSectionText(key, text)}
          count={form.counts[key]}
          chips={[...excel.suggestions[key], ...(jira ? jira.suggestions[key] : [])]}
          onChipUse={(text) => {
            form.appendToSection(key, text);
            excel.removeSuggestion(key, text);
            jira?.removeSuggestion(key, text);
          }}
          onExpand={() => onExpandSection(key)}
          teamType={form.teamType}
          sectorOptions={sectorOptions}
        />
      ))}
      {/* Konusmaci notlari (PowerPoint'teki "Notlar" bolumu gibi) - slaytta/
          onizlemede/PPTX ciktisinda HIC GORUNMEZ, sadece bu sunumun kayitli
          versiyonuna dahil edilir ve sonradan tekrar acilip duzenlenebilir
          (bkz. App.jsx buildSaveContent/applyContent -> content.notes). */}
      <div className="sec notes">
        <div className="head">
          <span className="t">Notlar</span>
        </div>
        <textarea
          placeholder="Bu sunuma özel notlarınızı buraya yazın — slaytta, önizlemede veya PPTX çıktısında görünmez."
          value={form.notes}
          onChange={(e) => form.setNotes(e.target.value)}
        />
        <div className="hint">Bu alan PowerPoint'teki "Notlar" bölümü gibi çalışır: sadece siz görürsünüz, sunumla birlikte kaydedilir.</div>
      </div>
    </section>
  );
}
