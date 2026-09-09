import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import Button from "./Button";
import { useCanvasFit } from "../../hooks/useCanvasFit";
import { useCountdown, formatMmSs } from "../../hooks/useCountdown";
import { useFullscreen } from "../../hooks/useFullscreen";

/**
 * Buyutulmus onizleme modali. Sprint modunda icerik/kapak sekmeleri gosterir,
 * dashboard modunda tek bir tuval gosterir (sekme yok) - orijinal davranisla ayni.
 *
 * `timerSeconds` verilirse (PO'nun Kapak adiminda girdigi sunum suresi),
 * modal acildiginda taze bir geri sayim baslar; son 15 saniyede yanip sonen
 * bir uyari class'i eklenir, 0'a ulasinca sayac orada durur (modal kapanmaz).
 */
export default function ZoomModal({ open, onClose, tabs, activeTab, onTabChange, renderCanvas, timerSeconds = null }) {
  const { boxRef, scale } = useCanvasFit({ fitParent: true, active: open });
  useFullscreen(open);
  const idx = tabs ? Math.max(0, tabs.findIndex((t) => t.key === activeTab)) : 0;
  const goTo = (delta) => tabs && onTabChange(tabs[(idx + delta + tabs.length) % tabs.length].key);
  // Sunum sirasinda sayaci duraklatip devam ettirebilme (kullanici istegi
  // 2026-09-08). Modal her acildiginda duraklatma sifirlanir, yoksa bir
  // onceki sunumda duraklatilmis halde acilirdi.
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (open) setPaused(false);
  }, [open]);
  const remaining = useCountdown(timerSeconds, open, undefined, undefined, paused);
  const critical = timerSeconds && remaining <= 15;

  // Klavye oklariyla slayt gecisi - PresentationRunnerModal'daki AYNI desen
  // (bkz. kullanici bildirimi 2026-08-21: "preview mod açıldığın klavyedeki
  // oklar ile de geçiş yapabilmek istiyorum"). Escape'i Modal zaten kapatma
  // icin dinliyor, buraya alinmaz.
  const goToRef = useRef(goTo);
  goToRef.current = goTo;
  useEffect(() => {
    if (!open || !tabs) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goToRef.current(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToRef.current(-1);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, tabs]);

  return (
    <Modal open={open} onClose={onClose} boxClassName="zoombox stage-dark">
      <div className="zoombar">
        {timerSeconds != null && (
          <>
            <div className={`timer-badge${critical ? " timer-critical" : ""}${paused ? " timer-paused" : ""}`}>
              {formatMmSs(remaining)}
            </div>
            <button
              type="button"
              className="tab"
              title={paused ? "Süreyi devam ettir" : "Süreyi durdur"}
              aria-label={paused ? "Süreyi devam ettir" : "Süreyi durdur"}
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? "▶ Devam" : "⏸ Durdur"}
            </button>
          </>
        )}
        {tabs && (
          <div className="carousel-nav">
            <button type="button" className="carousel-arrow" aria-label="Önceki slayt" onClick={() => goTo(-1)}>
              ‹
            </button>
            <div className="carousel-center">
              <span className="carousel-label">{tabs[idx]?.label}</span>
              <div className="carousel-dots">
                {tabs.map((t, i) => (
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
          </div>
        )}
        <Button variant="close" className="zoom-close" onClick={onClose} style={{ marginLeft: "auto" }}>
          Kapat
        </Button>
      </div>
      <div className="zoomstagewrap">
        <div className="zoomstage" ref={boxRef}>
          {open && renderCanvas(scale)}
        </div>
      </div>
    </Modal>
  );
}
