import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "./Modal";
import Button from "./Button";
import SlideCanvas from "../sprint/SlideCanvas";
import DashboardSlideCanvas from "../dashboard/DashboardSlideCanvas";
import VelocityBurndownSlideCanvas from "../sprint/VelocityBurndownSlideCanvas";
import { commonEndDate, JOINT_COVER_TITLE, JOINT_COVER_SUBTITLE } from "../../lib/jointDeckBuilder";
import { useCanvasFit } from "../../hooks/useCanvasFit";
import { useCountdown, formatMmSs } from "../../hooks/useCountdown";
import { useFullscreen } from "../../hooks/useFullscreen";

// PO bir takimin sunumu icin sure girmemisse (Kapak adiminda "Sunum süresi"
// bos/0 birakilmissa) bu takim aninda atlanmasin diye kullanilan varsayilan.
const DEFAULT_TEAM_SECONDS = 5 * 60;

function teamSeconds(item) {
  const minutes = item?.content?.timerMinutes;
  return minutes != null && Number(minutes) > 0 ? Number(minutes) * 60 : DEFAULT_TEAM_SECONDS;
}

/**
 * Ortak Sunum ekraninin "Sunumu Başlat" modu: secilen takimlarin (bkz.
 * JointPresentationPage `results`) sunumlarini SIRAYLA tam ekran gosterir.
 *
 * Slayt sirasi ortak PPTX ciktisiyla (bkz. jointDeckBuilder.buildJointDeck)
 * AYNIDIR: her takim icin once icerik slayti, kapasite verisi varsa ardindan
 * kapasite dashboard'u. Onceden yalnizca icerik slayti gosteriliyordu ve
 * slaytlar arasinda gecis yapmanin bir yolu yoktu - sunumu yapan kisi
 * tamamen sayaca bagimliydi (bkz. kullanici bildirimi).
 *
 * Iki gecis yolu birlikte calisir:
 *  - MANUEL: ‹ / › butonlari, noktalar ve klavye (yon tuslari / Space /
 *    PageUp-PageDown) ile slayt slayt ilerlenir.
 *  - OTOMATIK: bir takimin suresi dolunca SIRADAKI TAKIMIN ilk slaytina
 *    gecilir (onceki davranis korundu). Sayac her takim degisiminde bastan
 *    baslar - manuel gecislerde de.
 *
 * Son slayttan sonra "Sunum tamamlandı" durumunda kalir; otomatik kapanmaz,
 * kullanici "Kapat" ile cikar ya da ‹ ile geri donebilir.
 */
export default function PresentationRunnerModal({ open, onClose, queue, assets }) {
  // fitParent: tuval kutusunu (16:9) EBEVEYNININ olcusune gore piksel piksel
  // kendisi hesaplar - CSS aspect-ratio ile birakildiginda kucuk cozunurluklerde
  // saginda/altinda beyaz seritler kaliyordu (PO notu 2026-08-19: "Sayfa
  // yapısına uygun yerleşmiyor. Ekran çözünürlüğünü küçültünce de her yerinden
  // beyaz alanlar çıkıyor"). ZoomModal zaten bu modu kullaniyordu.
  const { boxRef, scale } = useCanvasFit({ fitParent: true, active: open });
  // Sunum yapilirken tarayici sekmesi/adres cubugu da gizlenip TUM ekran
  // kaplanir - PO notu 2026-08-19: "Sunu yapılırken tüm ekranı kaplayacak
  // şekilde yapabilir miyiz arka plan dikkat dağıtabilir. Toplu sunumda nasıl
  // oluyor?" (Toplu sunum ekrani buydu, "⤢ Preview"da zaten vardi.)
  useFullscreen(open);
  const [slideIndex, setSlideIndex] = useState(0);
  const [finished, setFinished] = useState(false);

  const slides = useMemo(() => {
    const out = [];
    if (queue?.length) {
      // TEK ortak kapak, herhangi bir takimdan ONCE - teamIndex=-1 verilir ki
      // ilk takimin suresi dolunca advanceTeam'in "sonraki teamIndex" aramasi
      // (teamIndex+1 === 0) sorunsuz calissin, ayri bir ozel durum gerekmez.
      // Eskiden PPTX ciktisinda olan bu kapak, canli "Sunumu Başlat" modunda
      // hic gorunmuyordu (bkz. kullanici bildirimi, 2026-08-21: "kapak
      // sayfası ... gelmiyor ... kapak tek bir tane ortak olacak").
      out.push({
        key: "joint-cover",
        teamIndex: -1,
        // Kapak metni PPTX/onizleme ile TEK kaynaktan (JOINT_COVER_*) gelir -
        // uc yerde ayri ayri yazilinca biri guncellenmeden kalabiliyordu.
        item: {
          teamName: JOINT_COVER_TITLE,
          subtitle: (() => {
            const bitis = commonEndDate(queue);
            return bitis ? `${JOINT_COVER_SUBTITLE} · ${bitis}` : JOINT_COVER_SUBTITLE;
          })(),
        },
        kind: "cover",
        label: "Kapak",
      });
    }
    (queue || []).forEach((item, teamIndex) => {
      out.push({ key: `${teamIndex}-content`, teamIndex, item, kind: "content", label: "İçerik Slaytı" });
      if (item.dashData?.kpis) {
        out.push({ key: `${teamIndex}-dashboard`, teamIndex, item, kind: "dashboard", label: "Kapasite Dashboard" });
      }
      // Velocity&Burndown eskiden bu listede hic yoktu (bkz. kullanici
      // bildirimi, 2026-08-21) - PPTX export'taki addVelocityBurndownSlide
      // cagrisiyla AYNI kosul: sadece gercekten yuklu bir gorsel varsa.
      if (item.veloData?.burndownUrl || item.veloData?.velocityUrl) {
        out.push({ key: `${teamIndex}-velocity`, teamIndex, item, kind: "velocity", label: "Velocity & Burndown" });
      }
    });
    return out;
  }, [queue]);

  // Her acilista bastan basla - onceki bir "Sunumu Baslat" turundan kalan
  // durum (hangi slaytta kalindigi, tamamlandi mi) tasinmaz.
  useEffect(() => {
    if (open) {
      setSlideIndex(0);
      setFinished(false);
    }
  }, [open]);

  const currentSlide = slides[slideIndex] || null;
  const current = currentSlide?.item || null;
  const teamIndex = currentSlide?.teamIndex ?? 0;
  // Ortak kapak icin sayac YOK - herhangi bir takima ait olmadigi icin
  // otomatik ilerlemez, kullanici "›" ile kendi istedigi zaman gecer (bkz.
  // kullanici bildirimi, 2026-08-21: "kapaktaki 10 saniye geri sayımı
  // kaldır"). totalSeconds=0/falsy oldugunda useCountdown hic interval
  // kurmuyor (bkz. o hook'un kendi kontrolu), yani otomatik gecis de olmaz.
  const currentSeconds = !current || currentSlide.kind === "cover" ? 0 : teamSeconds(current);
  const active = open && !finished && !!current;

  /** Suresi dolan takimdan SIRADAKI TAKIMIN ilk slaytina gecer. */
  const advanceTeam = () => {
    const next = slides.findIndex((s) => s.teamIndex === teamIndex + 1);
    if (next === -1) {
      setFinished(true);
      return;
    }
    setSlideIndex(next);
  };

  // teamIndex reset anahtari olarak veriliyor: ard arda gelen iki takimin
  // suresi AYNI ise (orn. ikisi de 5 dk) totalSeconds degismedigi icin sayac
  // kendiliginden sifirlanmazdi - takim degisiminde her zaman bastan baslar.
  const remaining = useCountdown(currentSeconds, active, advanceTeam, teamIndex);
  const isCoverSlide = currentSlide?.kind === "cover";
  const critical = active && !isCoverSlide && remaining <= 15;

  const goTo = (delta) => {
    if (finished) {
      // Tamamlandi ekranindan sadece GERI donulebilir - son slayta.
      if (delta < 0 && slides.length) {
        setFinished(false);
        setSlideIndex(slides.length - 1);
      }
      return;
    }
    const next = slideIndex + delta;
    if (next < 0) return;
    if (next >= slides.length) {
      setFinished(true);
      return;
    }
    setSlideIndex(next);
  };

  const jumpTo = (index) => {
    setFinished(false);
    setSlideIndex(index);
  };

  // Klavye ile gecis - sunum yaparken en pratik yol (kumanda/klikır cihazlari
  // da genelde PageUp/PageDown gonderir). Escape'i Modal zaten kapatma icin
  // dinliyor, buraya alinmaz.
  const goToRef = useRef(goTo);
  goToRef.current = goTo;
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        goToRef.current(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goToRef.current(-1);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const totalRemaining = useMemo(() => {
    if (!queue) return 0;
    const restTeams = queue.slice(teamIndex + 1).reduce((sum, item) => sum + teamSeconds(item), 0);
    return (finished ? 0 : remaining) + restTeams;
  }, [queue, teamIndex, remaining, finished]);

  return (
    <Modal open={open} onClose={onClose} boxClassName="zoombox stage-dark">
      <div className="zoombar presentation-runner-bar">
        <div className={`presentation-runner-status${critical ? " timer-critical" : ""}`}>
          {finished ? (
            <span className="presentation-runner-team">🎉 Sunum tamamlandı</span>
          ) : (
            <>
              <span className="presentation-runner-team">{current?.teamName}</span>
              {!isCoverSlide && <span className="timer-badge">{formatMmSs(remaining)}</span>}
            </>
          )}
        </div>

        {slides.length > 0 && (
          <div className="carousel-nav">
            <button
              type="button"
              className="carousel-arrow"
              aria-label="Önceki slayt"
              title="Önceki slayt (←)"
              disabled={!finished && slideIndex === 0}
              onClick={() => goTo(-1)}
            >
              ‹
            </button>
            <div className="carousel-center">
              <span className="carousel-label">
                {finished ? `${slides.length} / ${slides.length} — son slayt` : `${currentSlide?.label} · ${slideIndex + 1} / ${slides.length}`}
              </span>
              <div className="carousel-dots">
                {slides.map((s, i) => (
                  <button
                    key={s.key}
                    type="button"
                    className={`carousel-dot${!finished && i === slideIndex ? " active" : ""}`}
                    aria-label={`${s.item.teamName} - ${s.label}`}
                    title={`${s.item.teamName} - ${s.label}`}
                    onClick={() => jumpTo(i)}
                  />
                ))}
              </div>
            </div>
            <button
              type="button"
              className="carousel-arrow"
              aria-label="Sonraki slayt"
              title="Sonraki slayt (→ / Space)"
              disabled={finished}
              onClick={() => goTo(1)}
            >
              ›
            </button>
          </div>
        )}

        <div className="presentation-runner-total">Toplam kalan: {formatMmSs(totalRemaining)}</div>
        <Button variant="close" className="zoom-close" onClick={onClose} style={{ marginLeft: "auto" }}>
          Kapat
        </Button>
      </div>
      <div className="zoomstagewrap">
        <div className="zoomstage" ref={boxRef}>
          {open && current && currentSlide.kind === "cover" && (
            <SlideCanvas data={current} tab="cover" assets={assets} scale={scale} />
          )}
          {open && current && currentSlide.kind === "dashboard" && (
            <DashboardSlideCanvas dd={current.dashData || {}} assets={assets} scale={scale} />
          )}
          {open && current && currentSlide.kind === "content" && (
            <SlideCanvas data={current.sprintData} tab="content" assets={assets} scale={scale} />
          )}
          {open && current && currentSlide.kind === "velocity" && (
            <VelocityBurndownSlideCanvas
              data={current.sprintData}
              burndownUrl={current.veloData?.burndownUrl}
              velocityUrl={current.veloData?.velocityUrl}
              burndownZoomX={current.veloData?.burndownZoomX}
              burndownZoomY={current.veloData?.burndownZoomY}
              velocityZoomX={current.veloData?.velocityZoomX}
              velocityZoomY={current.veloData?.velocityZoomY}
              assets={assets}
              scale={scale}
            />
          )}
          {open && finished && (
            <div className="presentation-runner-done-overlay">
              <span>Sunum tamamlandı</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
