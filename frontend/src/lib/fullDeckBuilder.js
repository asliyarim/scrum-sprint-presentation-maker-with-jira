import PptxGenJS from "pptxgenjs";
import { addCoverSlide, addContentSlide } from "./sprintDeckBuilder";
import { addDashboardSlide } from "./dashboardDeckBuilder";
import { addVelocityBurndownSlide, hasVelocityContent } from "./velocityDeckBuilder";
import { DEFAULT_CORNER_MESH } from "../assets/cornerMesh";

/**
 * Kapak + icerik slayti + kapasite dashboard'u + (varsa) Velocity & Burndown
 * slaydini TEK bir PPTX icinde uretir - "PPTX İndir" hangi sihirbaz
 * adimindan tetiklenirse tetiklensin ayni birlesik dosya iner. cornerMesh:
 * PPTX indirme popup'inda kullanici kendi sablon gorselini yuklerse buraya
 * gelir (bkz. PptxTemplateModal) - verilmezse varsayilan (Resim1) temasi
 * kullanilir.
 *
 * veloData: { burndownUrl, velocityUrl } - sihirbazin 4. adiminda yuklenen
 * ekran goruntuleri (bkz. useVelocityBurndown). IKISI DE YOKSA slayt HIC
 * EKLENMEZ (kullanici karari 2026-09-07): burndown/velocity kullanmayan
 * ekiplerin (orn. Mobil Uygulamalar) ciktisinda bos bir "yüklenmedi" sayfasi
 * kaliyordu - "eklenmeyen ekipler icin bos sayfayi kaldiralim". En az biri
 * varsa slayt eklenir ve eksik olan kutu "yüklenmedi" notunu gosterir.
 */
export async function buildFullDeck(sprintData, dashData, veloData, assets, theme = "light", cornerMesh) {
  // Varsayilani BURADA bir kez cozup her addXSlide cagrisina ACIKCA gecirir -
  // bkz. jointDeckBuilder.buildJointDeck'teki AYNI yorum/gerekce.
  const mesh = cornerMesh || DEFAULT_CORNER_MESH;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "W16x9", width: 13.333, height: 7.5 });
  pptx.layout = "W16x9";
  // Kapak slayti tema secimine bakmaksizin her zaman ayni (acik) kalir -
  // markali kapak gorseli zaten kendi sabit renk dilini tasiyor.
  addCoverSlide(pptx, sprintData, assets, mesh);
  addContentSlide(pptx, sprintData, assets, theme, mesh);
  addDashboardSlide(pptx, dashData, assets, theme, mesh);
  // Burndown/Velocity gorselleri PO'nun sectigi zoom oranina gore ONCE
  // kirpilip (canvas ile, bkz. lib/velocityDeckBuilder.js cropToZoom) SONRA
  // slayda eklenir - bu adim bir <img> yuklemesi (async) gerektirir, bu
  // yuzden buildFullDeck de async oldu (bkz. cagiran taraflardaki `await`,
  // App.jsx handleGenerateFullDeck ve PresentationListPanel.handleDownloadPptx).
  if (hasVelocityContent(veloData)) {
    await addVelocityBurndownSlide(pptx, sprintData, veloData, assets, theme);
  }
  return pptx;
}
