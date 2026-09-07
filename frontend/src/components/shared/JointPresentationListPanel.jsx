import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "./Button";
import Modal from "./Modal";
import PptxTemplateModal from "./PptxTemplateModal";
import ZoomModal from "./ZoomModal";
import SlideCanvas from "../sprint/SlideCanvas";
import DashboardSlideCanvas from "../dashboard/DashboardSlideCanvas";
import VelocityBurndownSlideCanvas from "../sprint/VelocityBurndownSlideCanvas";
import { useCanvasFit } from "../../hooks/useCanvasFit";
import { IconDownload, IconTrash, IconCalendar, IconLayers } from "./icons";
import { fetchJointPresentations, deleteJointPresentation, recordPresentationDownload } from "../../lib/apiClient";
import { loadJointResults } from "../../lib/jointPicks";
import { buildJointDeck, commonEndDate, JOINT_COVER_TITLE, JOINT_COVER_SUBTITLE } from "../../lib/jointDeckBuilder";
import { hasVelocityContent } from "../../lib/velocityDeckBuilder";
import { ASSETS } from "../../assets/pptxAssets";

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// Kucuk kapak minyaturunun uzerindeki etiket - takim listesindeki
// "Sprint 50" etiketinin ortak sunumdaki karsiligi (tarih).
function shortDate(iso) {
  if (!iso) return "Ortak";
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function safeFileName(s) {
  return String(s || "Ortak_Sunum").replace(/[\\/:*?"<>|]/g, "_");
}

/**
 * Kayittaki secim sayisi DEGIL, kac AYRI TAKIM oldugu. Ayni takimdan birden
 * fazla sprint secilebildigi icin (bkz. JointPresentationPage - "pickedInTeam")
 * picks.length takim sayisi ANLAMINA GELMEZ; rozette 5 takimlik bir sunum
 * "6 takim" gorunurdu (kullanici bildirimi 2026-09-07).
 */
function takimSayisi(picks) {
  return new Set((picks || []).map((p) => p.teamId)).size;
}

/**
 * Kaydedilmis bir ortak sunumun onizlemesi - PPTX'te uretilecek slaytlarin
 * AYNI sirasi: tek ortak kapak, ardindan her takim icin icerik + kapasite
 * (+ gorseli varsa Velocity & Burndown). Takim bazli listedeki
 * UnifiedPreviewPane ile ayni CSS/karusel kaligini kullanir; ayri bir bilesen
 * olmasinin sebebi sekmelerin sabit 4 degil, kayda gore degisken olmasi.
 */
function slaytlariCikar(results) {
  const out = [{ key: "__cover__", label: "Ortak Kapak", kind: "cover" }];
  (results || []).forEach((r, i) => {
    const ad = r.teamName || "Takım";
    out.push({ key: `${i}-content`, label: `${ad} — İçerik`, kind: "content", r });
    out.push({ key: `${i}-dash`, label: `${ad} — Kapasite`, kind: "dashboard", r });
    // Velocity & Burndown yalnizca gorsel varsa - PPTX'teki kuralin aynisi
    // (bkz. velocityDeckBuilder.hasVelocityContent).
    if (hasVelocityContent(r.veloData)) {
      out.push({ key: `${i}-velocity`, label: `${ad} — Velocity & Burndown`, kind: "velocity", r });
    }
  });
  return out;
}

function JointPreviewPane({ results, slides, activeKey, onActiveKeyChange, onZoom, renderSlide }) {
  const { boxRef, scale } = useCanvasFit();
  const idx = Math.max(0, slides.findIndex((s) => s.key === activeKey));
  const goTo = (delta) => onActiveKeyChange(slides[(idx + delta + slides.length) % slides.length].key);

  return (
    <section className="previewwrap">
      <p className="panelttl">Canlı önizleme</p>
      <div className="stage">
        <div className="tabs carousel-nav">
          <button type="button" className="carousel-arrow" aria-label="Önceki slayt" onClick={() => goTo(-1)}>
            ‹
          </button>
          <div className="carousel-center">
            <span className="carousel-label">{slides[idx]?.label}</span>
            <div className="carousel-dots">
              {slides.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  className={`carousel-dot${i === idx ? " active" : ""}`}
                  aria-label={s.label}
                  title={s.label}
                  onClick={() => onActiveKeyChange(s.key)}
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
        </div>
        <div className="slidebox" ref={boxRef}>{renderSlide(slides[idx], scale)}</div>
        <div className="note">
          {results.length} takımın slaytları, indirilecek PPTX ile aynı sırada — oklarla/noktalarla
          geçiş yapabilirsin. Slayt {idx + 1} / {slides.length}.
        </div>
      </div>
    </section>
  );
}

/**
 * Admin panelindeki "Ortak Sunumlar" bolumu - kaydedilmis coklu takim
 * sunumlari TARIH TARIH listelenir, onizlenir ve tekrar indirilebilir
 * (Cagdas Bey istegi, Gözde uzerinden 2026-09-07: "ortaklastirdigimda
 * ortaklasmis halini tarih tarih gormek istiyorum").
 *
 * Gorunum BILEREK takim bazli sunum listesiyle (PresentationListPanel) ayni
 * kaliba oturtulmustur - ayni CSS siniflari, ayni satir duzeni (kapak
 * minyaturu | baslik + tarih detaylari | aksiyonlar), ayni ust bar (toplu
 * indirme + "yeni" butonu) ve SAGDA ayni canli onizleme kolonu (kullanici
 * istegi 2026-09-07). Hangi takimlari icerdigini yazan uzun satir yerine
 * yalnizca takim SAYISI rozeti kaldi (ayni istek).
 *
 * Indirme ve onizleme, kayittaki (presentationId, version) listesinden
 * icerikleri TAZE okur - yani kayit kucuktur ve surum gecmisi tek kaynakta
 * (versions tablosu) kalir.
 */
export default function JointPresentationListPanel({ teams, theme }) {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [deleteFor, setDeleteFor] = useState(null);
  const [deleting, setDeleting] = useState(false);
  // PPTX sablon secimi - tekil/ortak indirmelerdeki AYNI popup.
  // { type: "single", item } | { type: "all" }
  const [pptxRequest, setPptxRequest] = useState(null);

  // Sagdaki onizleme - takim bazli listedeki (selectedId + previewContent)
  // desenin aynisi. Kayit yalnizca (presentationId, version) tuttugu icin
  // secilen satirin icerikleri ayrica cekilir.
  const [selectedId, setSelectedId] = useState(null);
  const [previewResults, setPreviewResults] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewKey, setPreviewKey] = useState("__cover__");
  const [zoomOpen, setZoomOpen] = useState(false);

  const reload = () => {
    fetchJointPresentations()
      .then(setItems)
      .catch((err) => setError(err?.message || "Ortak sunumlar yüklenemedi."));
  };

  useEffect(reload, []);

  // Liste gelince ilk kayit otomatik secilir (silme sonrasi secili kayit
  // listeden dustuyse de yenisine gecilir) - takim panelindeki davranisin ayni.
  useEffect(() => {
    if (items && items.length > 0 && !items.some((x) => x.id === selectedId)) {
      setSelectedId(items[0].id);
    } else if (items && items.length === 0) {
      setSelectedId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => {
    const item = items?.find((x) => x.id === selectedId);
    if (!item) {
      setPreviewResults(null);
      return;
    }
    let iptal = false;
    setPreviewLoading(true);
    setPreviewResults(null);
    setPreviewKey("__cover__");
    loadJointResults(item.picks, teams)
      .then((r) => { if (!iptal) setPreviewResults(r); })
      .catch(() => { if (!iptal) setPreviewResults(null); })
      .finally(() => { if (!iptal) setPreviewLoading(false); });
    return () => { iptal = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, items, teams]);

  const slides = useMemo(() => (previewResults ? slaytlariCikar(previewResults) : []), [previewResults]);

  // Ortak kapak PPTX'teki addJointCoverSlide ile AYNI metinleri gosterir -
  // baslik/alt baslik tek kaynaktan (JOINT_COVER_*) gelir.
  const jointCoverData = useMemo(() => {
    const bitis = commonEndDate(previewResults || []);
    return {
      teamName: JOINT_COVER_TITLE,
      subtitle: bitis ? `${JOINT_COVER_SUBTITLE} · ${bitis}` : JOINT_COVER_SUBTITLE,
    };
  }, [previewResults]);

  const renderSlide = (slide, scale) => {
    if (!slide) return null;
    if (slide.kind === "cover") {
      return <SlideCanvas data={jointCoverData} tab="cover" assets={ASSETS} scale={scale} />;
    }
    if (slide.kind === "dashboard") {
      return <DashboardSlideCanvas dd={slide.r.dashData || {}} assets={ASSETS} scale={scale} />;
    }
    if (slide.kind === "velocity") {
      return (
        <VelocityBurndownSlideCanvas
          data={slide.r.sprintData}
          burndownUrl={slide.r.veloData?.burndownUrl}
          velocityUrl={slide.r.veloData?.velocityUrl}
          burndownZoomX={slide.r.veloData?.burndownZoomX}
          burndownZoomY={slide.r.veloData?.burndownZoomY}
          velocityZoomX={slide.r.veloData?.velocityZoomX}
          velocityZoomY={slide.r.veloData?.velocityZoomY}
          assets={ASSETS}
          scale={scale}
        />
      );
    }
    return <SlideCanvas data={slide.r.sprintData} tab="content" assets={ASSETS} scale={scale} />;
  };

  // Tek bir kaydin PPTX'ini uretip indirir. Hem satirdaki "PPTX İndir" hem de
  // toplu indirme bunu kullanir; toplu indirmede hata tek kaydi atlatir,
  // digerleri yine iner (bkz. handleDownloadAll).
  const buildAndSave = async (item, cornerMesh) => {
    const results = await loadJointResults(item.picks, teams);
    if (results.length === 0) {
      throw new Error(`"${item.title}" içindeki sunumların içeriği okunamadı (silinmiş olabilir).`);
    }
    const pptx = await buildJointDeck(results, ASSETS, theme === "dark" ? "dark" : "light", cornerMesh);
    await pptx.writeFile({ fileName: `${safeFileName(item.title)}.pptx` });
    await recordPresentationDownload("BATCH", [...new Set(results.map((r) => r.teamId))]).catch(() => {
      // indirme kaydi best-effort - basarisiz olsa da kullaniciyi engellemez
    });
  };

  const handleDownload = async (item, cornerMesh) => {
    setBusyId(item.id);
    setError(null);
    try {
      await buildAndSave(item, cornerMesh);
    } catch (err) {
      setError(err?.message || "PPTX üretilirken bir hata oluştu.");
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Ust bardaki toplu indirme. Takim panelindeki "Tüm Sprintler PPTX İndir"
   * TEK dosya uretir; burada BIRLESTIRMEK anlamsiz olurdu (her ortak sunumun
   * kendi kapagi ve ayni takimlarin tekrar eden slaytlari var), o yuzden her
   * kayit KENDI dosyasi olarak sirayla iner. Tarayici "birden fazla dosya
   * indirilsin mi?" diye sorabilir.
   */
  const handleDownloadAll = async (cornerMesh) => {
    if (!items || items.length === 0) return;
    setDownloadingAll(true);
    setError(null);
    const hatalar = [];
    for (const item of items) {
      try {
        await buildAndSave(item, cornerMesh);
      } catch (err) {
        hatalar.push(err?.message || item.title);
      }
    }
    if (hatalar.length > 0) {
      setError(`${hatalar.length} ortak sunum indirilemedi: ${hatalar.join(" | ")}`);
    }
    setDownloadingAll(false);
  };

  const handlePptxTemplateConfirm = (customImage) => {
    const req = pptxRequest;
    setPptxRequest(null);
    if (!req) return;
    if (req.type === "single") handleDownload(req.item, customImage || undefined);
    else handleDownloadAll(customImage || undefined);
  };

  const handleDelete = async () => {
    if (!deleteFor) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteJointPresentation(deleteFor.id);
      setDeleteFor(null);
      reload();
    } catch (err) {
      setError(err?.message || "Ortak sunum silinemedi.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="presentation-panel-layout">
      <div className="presentation-list-panel">
        <div className="presentation-list-header">
          <h2>Ortak Sunumlar</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              variant="soft"
              loading={downloadingAll}
              loadingLabel="Hazırlanıyor…"
              disabled={!items || items.length === 0}
              onClick={() => setPptxRequest({ type: "all" })}
            >
              <IconDownload style={{ width: 15, height: 15 }} />
              Tüm Ortak Sunumlar PPTX İndir
            </Button>
            <Button variant="primary" onClick={() => navigate("/ortak-sunum")}>
              + Yeni Ortak Sunum
            </Button>
          </div>
        </div>

        {error && <div className="login-error" style={{ margin: "0 0 12px" }}>{error}</div>}
        {items === null && !error && <div className="presentation-list-empty">Yükleniyor…</div>}
        {items && items.length === 0 && (
          <div className="presentation-list-empty">
            <IconLayers style={{ width: 28, height: 28, opacity: 0.5 }} />
            Henüz kaydedilmiş ortak sunum yok. &quot;+ Yeni Ortak Sunum&quot; ile takımları seçip
            <b>&nbsp;Ortak Sunumu Kaydet</b> dediğinizde burada görünür.
          </div>
        )}

        <div className="presentation-list">
          {items && items.map((item) => (
            <div
              className={`presentation-row${item.id === selectedId ? " selected" : ""}`}
              key={item.id}
              onClick={() => setSelectedId(item.id)}
            >
              <div className="presentation-row-thumb" style={{ backgroundImage: `url(${ASSETS.cover_bg})` }}>
                <span className="presentation-row-thumb-badge">
                  <IconLayers style={{ width: 13, height: 13 }} />
                </span>
                <span className="presentation-row-thumb-label">{shortDate(item.createdAt)}</span>
              </div>
              <div className="presentation-row-main">
                <span className="presentation-row-sprint">
                  {item.title}
                  <span className="presentation-row-version-pill">{takimSayisi(item.picks)} takım</span>
                </span>
                <span className="presentation-row-meta">
                  <IconCalendar style={{ width: 13, height: 13 }} />
                  {formatDateTime(item.createdAt)}
                </span>
                <span className="presentation-row-meta presentation-row-meta-sub">
                  {item.createdBy ? `Oluşturan: ${item.createdBy}` : "—"}
                </span>
              </div>
              <div className="presentation-row-actions" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="soft"
                  loading={busyId === item.id}
                  loadingLabel="Hazırlanıyor…"
                  onClick={() => setPptxRequest({ type: "single", item })}
                >
                  <IconDownload style={{ width: 15, height: 15 }} />
                  PPTX İndir
                </Button>
                <Button variant="ghost" className="presentation-delete-btn" onClick={() => setDeleteFor(item)}>
                  <IconTrash style={{ width: 15, height: 15 }} />
                  Sil
                </Button>
              </div>
            </div>
          ))}
        </div>

        <PptxTemplateModal
          open={!!pptxRequest}
          onClose={() => setPptxRequest(null)}
          onConfirm={handlePptxTemplateConfirm}
          downloading={busyId !== null || downloadingAll}
        />

        <Modal open={!!deleteFor} onClose={() => (deleting ? null : setDeleteFor(null))}>
          <h3 style={{ marginTop: 0 }}>Ortak sunumu sil</h3>
          <p style={{ color: "var(--mut)", lineHeight: 1.6 }}>
            <b>{deleteFor?.title}</b> kaydını silmek üzeresiniz. Bu işlem <b>geri alınamaz</b>.
            Takımların kendi sunumları etkilenmez, yalnızca bu birleştirme kaydı silinir.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
            <Button variant="soft" onClick={() => setDeleteFor(null)} disabled={deleting}>Vazgeç</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting} loadingLabel="Siliniyor…">
              Kalıcı olarak sil
            </Button>
          </div>
        </Modal>
      </div>

      {/* Secili kaydin canli onizlemesi - takim bazli listedeki
          .presentation-preview-col ile ayni yer ve ayni karusel gorunumu. */}
      {items && items.length > 0 && (
        <div className="presentation-preview-col">
          {previewLoading || slides.length === 0 ? (
            <div className="presentation-list-empty">
              {previewLoading ? "Önizleme yükleniyor…" : "Bu ortak sunumun içeriği okunamadı."}
            </div>
          ) : (
            <JointPreviewPane
              results={previewResults}
              slides={slides}
              activeKey={previewKey}
              onActiveKeyChange={setPreviewKey}
              onZoom={() => setZoomOpen(true)}
              renderSlide={renderSlide}
            />
          )}
        </div>
      )}

      <ZoomModal
        open={zoomOpen}
        onClose={() => setZoomOpen(false)}
        tabs={slides.map((s) => ({ key: s.key, label: s.label }))}
        activeTab={previewKey}
        onTabChange={setPreviewKey}
        renderCanvas={(scale) => renderSlide(slides.find((s) => s.key === previewKey) || slides[0], scale)}
      />
    </div>
  );
}
