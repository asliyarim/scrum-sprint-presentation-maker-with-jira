import SlideCanvas from "../sprint/SlideCanvas";
import DashboardSlideCanvas from "../dashboard/DashboardSlideCanvas";
import VelocityBurndownSlideCanvas from "../sprint/VelocityBurndownSlideCanvas";
import SourceTabs from "./SourceTabs";
import { useCanvasFit } from "../../hooks/useCanvasFit";

// NOT: Velocity & Burndown sekmesi gorsel yuklenmemis olsa da ONIZLEMEDE
// HEP gosterilir (kullanici karari 2026-09-07) - PO gorseli eklemeyi
// unuttuysa bos sayfayi gorup fark edebilsin diye. Bos sayfa yalnizca
// INDIRILEN PPTX'e ve ortak sunuma girmez
// (bkz. velocityDeckBuilder.hasVelocityContent).
const TABS = [
  { key: "cover", label: "Kapak" },
  { key: "content", label: "İçerik Slaytı" },
  { key: "dashboard", label: "Kapasite Dashboard" },
  { key: "velocity", label: "Velocity & Burndown" },
];

/**
 * Kapak, icerik slayti ve kapasite dashboard'unu TEK bir onizleme panelinde
 * birlestirir - kullanici hangi adimda (sprint parametreleri / dashboard
 * parametreleri) olursa olsun uc goruntuyu de sekmelerle gorebilir.
 */
export default function UnifiedPreviewPane({
  sprintData, dashData, assets, activeTab, onTabChange, onZoom, onEdit,
  showDataSource, dataSource, onDataSourceChange,
  burndownUrl, velocityUrl, burndownZoomX, burndownZoomY, velocityZoomX, velocityZoomY,
}) {
  const { boxRef, scale } = useCanvasFit();
  const idx = Math.max(0, TABS.findIndex((t) => t.key === activeTab));
  const goTo = (delta) => onTabChange(TABS[(idx + delta + TABS.length) % TABS.length].key);

  return (
    <section className="previewwrap">
      <p className="panelttl">Canlı önizleme</p>
      <div className="stage">
        {showDataSource && <SourceTabs source={dataSource} onSourceChange={onDataSourceChange} />}
        <div className="tabs carousel-nav">
          <button type="button" className="carousel-arrow" aria-label="Önceki slayt" onClick={() => goTo(-1)}>
            ‹
          </button>
          <div className="carousel-center">
            <span className="carousel-label">{TABS[idx].label}</span>
            <div className="carousel-dots">
              {TABS.map((t, i) => (
                <button
                  key={t.key}
                  type="button"
                  className={`carousel-dot${i === idx ? " active" : ""}`}
                  aria-label={t.label}
                  title={t.label}
                  onClick={() => onTabChange(t.key)}
                />
              ))}
            </div>
          </div>
          <button type="button" className="carousel-arrow" aria-label="Sonraki slayt" onClick={() => goTo(1)}>
            ›
          </button>
          <button type="button" className="tab zoomtrig" title="Slaydı büyük önizlemede aç" onClick={onZoom}>
            ⤢ Preview
          </button>
          {activeTab === "dashboard" && onEdit && (
            <button
              type="button"
              className="tab zoomtrig"
              title="Kapasite Dashboard verilerini düzenle - sadece bu sunumun versiyonuna kaydedilir"
              onClick={onEdit}
            >
              ✎ Düzenle
            </button>
          )}
        </div>
        <div className="slidebox" ref={boxRef}>
          {activeTab === "dashboard" ? (
            <DashboardSlideCanvas dd={dashData || {}} assets={assets} scale={scale} />
          ) : activeTab === "velocity" ? (
            <VelocityBurndownSlideCanvas
              data={sprintData}
              burndownUrl={burndownUrl}
              velocityUrl={velocityUrl}
              burndownZoomX={burndownZoomX}
              burndownZoomY={burndownZoomY}
              velocityZoomX={velocityZoomX}
              velocityZoomY={velocityZoomY}
              assets={assets}
              scale={scale}
            />
          ) : (
            <SlideCanvas data={sprintData} tab={activeTab} assets={assets} scale={scale} />
          )}
        </div>
        <div className="note">
          Kapak, içerik slaytı, kapasite dashboard'u ve Velocity &amp; Burndown arasında oklarla/noktalarla geçiş
          yapabilirsin — hepsi aynı anda güncel tutulur.
        </div>
      </div>
    </section>
  );
}
