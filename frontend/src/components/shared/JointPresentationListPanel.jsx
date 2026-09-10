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
import { fetchJointPresentations, deleteJointPresentation, recordPresentationDownload, fetchPresentationPeriods } from "../../lib/apiClient";
import { loadJointResults } from "../../lib/jointPicks";
import { isoToTr } from "../../lib/sprintPeriod";
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
 * OTOMATIK ORTAK SUNUM - Çağdaş Bey'in asıl isteği: "ekiplerin sunumları son
 * hale geldiğinde bir tetikleme olmalı ve tüm ekipler tamamladığında ancak
 * admin ekranında birleşmiş hali otomatik gelmelidir."
 *
 * Bir dönemi hazır birleşmiş sunuma çevirir — AMA yalnızca tüm ekipler hem
 * sunumunu yüklediyse hem de "hazır" işaretlediyse. Eksik dönem bu listede
 * hiç görünmez; o, Dönemler panelinde "6/8" olarak durur.
 *
 * DONDURULMUŞ KAYIT DEĞİL: picks her açılışta o anki `currentVersion` ile
 * kurulur, yani bir ekip revize ederse birleşmiş sunum kendiliğinden yeni
 * içeriği gösterir (Gözde'nin 3. maddesi — "otomatik güncellensin, Çağdaş Bey
 * sürekli hangisi yeni versiyon diye aramak zorunda kalmasın"). Kaydedilmiş
 * ortak sunumlar ise bilerek dondurulmuş kalır; o bilinçli bir arşivdir.
 */
function donemdenOtomatikSunum(donem, teams) {
  const tamam = teams.length > 0
    && donem.takimSayisi === teams.length
    && donem.hazirTakimSayisi === teams.length;
  if (!tamam) return null;

  // SIRA BACKEND'DEN GELIR: secilenSunumIdler zaten sunus sirasindadir -
  // o doneme kaydedilmis bir siralama varsa uygulanmis olur (bkz.
  // PresentationController.toPeriodDto). Burada yeniden siralamak, birinin
  // elle yaptigi sirayi ezerdi.
  const sunumlar = new Map(donem.sunumlar.map((s) => [s.id, s]));
  const picks = (donem.secilenSunumIdler || [])
    .map((id) => sunumlar.get(id))
    .filter(Boolean)
    .map((s) => ({
      presentationId: s.id,
      version: s.currentVersion,
      teamId: s.teamId,
      teamName: teams.find((t) => t.id === s.teamId)?.name || "Takım",
      sprintNo: s.sprintNo,
      dateRange: s.dateRange || "",
    }));
  if (picks.length === 0) return null;

  return {
    id: `otomatik:${donem.bitis}`,
    title: `${isoToTr(donem.bitis)} Dönemi`,
    picks,
    createdBy: null,
    createdAt: null,
    otomatik: true,
    donem,
  };
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

  // Otomatik birlesen donemler - kaydedilmis sunumlardan AYRI kaynak.
  // Yuklenemezse liste yine calisir, sadece otomatikler gorunmez; kayitli
  // sunumlar hicbir sekilde etkilenmesin.
  const [periods, setPeriods] = useState([]);

  const reload = () => {
    fetchJointPresentations()
      .then(setItems)
      .catch((err) => setError(err?.message || "Ortak sunumlar yüklenemedi."));
    fetchPresentationPeriods()
      .then(setPeriods)
      .catch(() => setPeriods([]));
  };

  useEffect(reload, []);

  const otomatikler = useMemo(
    () => (periods || []).map((d) => donemdenOtomatikSunum(d, teams || [])).filter(Boolean),
    [periods, teams],
  );

  // Otomatikler USTTE: Cagdas Bey ekrani acinca aradigi sey ilk sirada olsun.
  const satirlar = useMemo(
    () => (items === null ? null : [...otomatikler, ...items]),
    [items, otomatikler],
  );

  // Liste gelince ilk kayit otomatik secilir (silme sonrasi secili kayit
  // listeden dustuyse de yenisine gecilir) - takim panelindeki davranisin ayni.
  useEffect(() => {
    if (satirlar && satirlar.length > 0 && !satirlar.some((x) => x.id === selectedId)) {
      setSelectedId(satirlar[0].id);
    } else if (satirlar && satirlar.length === 0) {
      setSelectedId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [satirlar]);

  useEffect(() => {
    const item = satirlar?.find((x) => x.id === selectedId);
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
  }, [selectedId, satirlar, teams]);

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
    if (!satirlar || satirlar.length === 0) return;
    setDownloadingAll(true);
    setError(null);
    const hatalar = [];
    for (const item of satirlar) {
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
              disabled={!satirlar || satirlar.length === 0}
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
        {satirlar === null && !error && <div className="presentation-list-empty">Yükleniyor…</div>}
        {satirlar && satirlar.length === 0 && (
          <div className="presentation-list-empty">
            <IconLayers style={{ width: 28, height: 28, opacity: 0.5 }} />
            Henüz ortak sunum yok. Bir dönemde <b>tüm ekipler</b> sunumunu &quot;hazır&quot; işaretlediğinde
            birleşmiş hali burada <b>kendiliğinden</b> belirir. Beklemeden hazırlamak isterseniz
            &quot;+ Yeni Ortak Sunum&quot; ile takımları seçip <b>Ortak Sunumu Kaydet</b> diyebilirsiniz.
          </div>
        )}

        <div className="presentation-list">
          {satirlar && satirlar.map((item) => (
            <div
              className={`presentation-row${item.id === selectedId ? " selected" : ""}`}
              key={item.id}
              onClick={() => setSelectedId(item.id)}
            >
              <div className="presentation-row-thumb" style={{ backgroundImage: `url(${ASSETS.cover_bg})` }}>
                <span className="presentation-row-thumb-badge">
                  <IconLayers style={{ width: 13, height: 13 }} />
                </span>
                <span className="presentation-row-thumb-label">
                  {item.otomatik ? isoToTr(item.donem.bitis) : shortDate(item.createdAt)}
                </span>
              </div>
              <div className="presentation-row-main">
                <span className="presentation-row-sprint">
                  {item.title}
                  {item.otomatik && <span className="otomatik-rozet">Otomatik</span>}
                  <span className="presentation-row-version-pill">{takimSayisi(item.picks)} takım</span>
                </span>
                {item.otomatik ? (
                  <>
                    <span className="presentation-row-meta">
                      <IconCalendar style={{ width: 13, height: 13 }} />
                      Tüm ekipler sunumunu hazır işaretledi — birleşmiş hali kendiliğinden hazırlandı.
                    </span>
                    <span className="presentation-row-meta presentation-row-meta-sub">
                      Her ekibin en güncel sürümünü gösterir; bir ekip revize ederse burası da güncellenir.
                    </span>
                  </>
                ) : (
                  <>
                    <span className="presentation-row-meta">
                      <IconCalendar style={{ width: 13, height: 13 }} />
                      {formatDateTime(item.createdAt)}
                    </span>
                    <span className="presentation-row-meta presentation-row-meta-sub">
                      {item.createdBy ? `Oluşturan: ${item.createdBy}` : "—"}
                    </span>
                  </>
                )}
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
                {/* Otomatik satirlar SILINEMEZ - kayit degiller, donemden
                    hesaplaniyorlar. Silinseler bir sonraki acilista geri
                    gelirlerdi; "sildim ama duruyor" yanilgisi olmasin. */}
                {!item.otomatik && (
                  <Button variant="ghost" className="presentation-delete-btn" onClick={() => setDeleteFor(item)}>
                    <IconTrash style={{ width: 15, height: 15 }} />
                    Sil
                  </Button>
                )}
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
      {satirlar && satirlar.length > 0 && (
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
