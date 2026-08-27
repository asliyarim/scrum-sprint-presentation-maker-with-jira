import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "./Button";
import Modal from "./Modal";
import PptxTemplateModal from "./PptxTemplateModal";
import ZoomModal from "./ZoomModal";
import UnifiedPreviewPane from "./UnifiedPreviewPane";
import SlideCanvas from "../sprint/SlideCanvas";
import DashboardSlideCanvas from "../dashboard/DashboardSlideCanvas";
import VelocityBurndownSlideCanvas from "../sprint/VelocityBurndownSlideCanvas";
import { IconPresentation, IconHistory, IconEdit, IconCalendar, IconDownload } from "./icons";
import { fetchPresentations, fetchPresentation, fetchPresentationVersions, rollbackPresentation, recordPresentationDownload } from "../../lib/apiClient";
import { sortBySprintNo } from "../../lib/sprintNumbers";
import { sprintDataFromContent } from "../../lib/presentationContent";
import { buildFullDeck } from "../../lib/fullDeckBuilder";
import { buildTeamAllSprintsDeck } from "../../lib/teamDeckBuilder";
import { ASSETS } from "../../assets/pptxAssets";

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Bir takima ait kayitli sprint sunumlarinin listesi. Hem AdminHomePage'in
 * sag panelinde (canManage=true, her takim icin) hem PresentationsPage'te
 * (PO'nun kendi takimi icin) kullanilir. "Duzenle" ayni sihirbaz ekranini
 * (/editor/:id) acar - admin/PO ayrimi App.jsx'teki canEdit mantigiyla zaten
 * cozuluyor, burada sadece navigasyon var.
 */
export default function PresentationListPanel({ teamId, teamName, canManage, showNewButton }) {
  const navigate = useNavigate();
  const [presentations, setPresentations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [historyFor, setHistoryFor] = useState(null); // { id, sprintNo }

  // Satira tiklaninca sag/altta acilan "canli onizleme" - sihirbazdaki
  // UnifiedPreviewPane'in AYNISI (Kapak/İçerik/Dashboard karuseli + Preview
  // butonu), sadece bu sayfanin kendi listesine gomulu. Liste endpoint'i
  // (fetchPresentations) sadece ozet dondugu icin secilen satirin TAM
  // icerigi ayrica fetchPresentation(id) ile cekilir.
  const [selectedId, setSelectedId] = useState(null);
  const [previewContent, setPreviewContent] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewTab, setPreviewTab] = useState("cover");
  const [zoomOpen, setZoomOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  // Onizleme icerigi useEffect'i sadece selectedId degisince tetiklenir -
  // rollback SONRASI ayni sunum secili kalirsa (id degismez, sadece icerigi
  // degisir) bu effect tetiklenmez ve onizleme ESKI (rollback oncesi)
  // icerigi gostermeye devam ederdi. Bu sayac, id ayni kalsa bile "yeniden
  // getir" sinyali vermek icin kullanilir (bkz. onRolledBack).
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);

  const reload = (keepSelectedId) => {
    if (!teamId) return;
    setLoading(true);
    setError(null);
    if (!keepSelectedId) setSelectedId(null);
    fetchPresentations(teamId)
      // Backend siralama garantisi VERMEZ (findByTeamId'de ORDER BY yok), bu
      // yuzden liste rastgele sirada geliyordu - "Sprint 5, Sprint 4, Sprint 6"
      // gibi (kullanici bildirimi 2026-08-27: "Sprint sayisina gore siralamayi
      // yapabilir miyiz?"). En guncel sprint en ustte olsun diye AZALAN.
      .then((liste) => setPresentations(sortBySprintNo(liste)))
      .catch((err) => setError(err?.message || "Sunumlar yüklenemedi."))
      .finally(() => setLoading(false));
  };

  useEffect(() => reload(false), [teamId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps

  // Liste yuklenince (veya takim degisince) ilk sunum otomatik secilir -
  // kullanici hemen bir onizleme gorsun, ayrica tiklamak zorunda kalmasin.
  // Secili sunum listede hala varsa (orn. rollback sonrasi ayni id) DOKUNULMAZ.
  useEffect(() => {
    if (presentations.length > 0 && !presentations.some((p) => p.id === selectedId)) {
      setSelectedId(presentations[0].id);
    } else if (presentations.length === 0) {
      setSelectedId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentations]);

  useEffect(() => {
    if (!selectedId) {
      setPreviewContent(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewContent(null);
    setPreviewTab("cover");
    fetchPresentation(selectedId)
      .then((p) => setPreviewContent(p.content || {}))
      .catch(() => setPreviewContent(null))
      .finally(() => setPreviewLoading(false));
  }, [selectedId, previewRefreshKey]);

  const previewSprintData = previewContent ? sprintDataFromContent(previewContent) : null;
  const previewDashData = previewContent?.dashData || null;
  // Velocity & Burndown gorselleri sunum icerigi JSON'unun ICINDE (base64
  // data-url olarak) saklanir - MinIO'ya atilan kopya hicbir yerde geri
  // okunmuyor (bkz. AssetUploadController javadoc'u). sprintDataFromContent
  // veloData'yi tasimadigi icin buradan AYRICA cikarilmali; aksi halde
  // onizlemeye bos url gider ve slayt "gorseli yuklenmedi" der.
  const previewVeloData = previewContent?.veloData || null;

  // "PPTX İndir" tiklaninca hemen indirmez - once sablon secim popup'u acilir
  // (bkz. kullanici bildirimi: "her pptx indirme buttonlarından bahsediyorum").
  // pptxRequest: { type: "single", p } | { type: "all" } | null.
  const [pptxRequest, setPptxRequest] = useState(null);

  // Liste satirindan dogrudan PPTX indirme - editoru acmadan, o sunumun
  // KAYITLI (son kaydedilmis) icerigini indirir. handleGenerateFullDeck
  // (App.jsx) ile ayni kural: kapasite dashboard verisi (kpis) olmadan
  // slayt uretilemez, buildFullDeck bunu kontrol etmiyor (bkz. kod yorumu).
  const handleDownloadPptx = async (p, cornerMesh) => {
    setDownloadingId(p.id);
    try {
      const full = await fetchPresentation(p.id);
      const content = full.content || {};
      const dashData = content.dashData || {};
      if (!dashData.kpis) {
        throw new Error("Bu sunumda kapasite dashboard verisi yok, PPTX indirilemedi.");
      }
      const sprintData = sprintDataFromContent(content);
      // veloData parametresi atlanmisti: ASSETS veloData'nin, "light" assets'in
      // yerine geciyor, cornerMesh de theme'e kayiyordu. Sonuc: bu sayfadan
      // indirilen PPTX'te Velocity & Burndown gorselleri hic yer almiyor, kapak
      // arka plani/logolar da bir string uzerinden okunuyordu.
      const pptx = await buildFullDeck(sprintData, dashData, content.veloData || {}, ASSETS, "light", cornerMesh);
      const sp = (p.sprintNo || "X").toString().replace(/[^\w]/g, "");
      await pptx.writeFile({ fileName: `Sprint_Kapasite_${sp}.pptx` });
      recordPresentationDownload("INDIVIDUAL", [teamId]).catch(() => {});
    } catch (err) {
      setError(err?.message || "PPTX indirilemedi.");
    } finally {
      setDownloadingId(null);
    }
  };

  // "+ Yeni Sunum" yanindaki toplu indirme - takimin TUM kayitli sprintlerini
  // (kapak+icerik+varsa kapasite dashboard'u, sprint numarasina gore siralı)
  // TEK bir PPTX'te birlestirir (bkz. kullanici bildirimi).
  const handleDownloadAllSprints = async (cornerMesh) => {
    if (!presentations.length) return;
    setDownloadingAll(true);
    setError(null);
    try {
      const fulls = await Promise.all(presentations.map((p) => fetchPresentation(p.id)));
      // Sunum kronolojik olmali: burada ARTAN (1, 2, 3...).
      const sorted = sortBySprintNo(fulls, false);
      const sprints = sorted.map((p) => ({
        sprintData: sprintDataFromContent(p.content || {}),
        dashData: p.content?.dashData || null,
      }));
      const pptx = buildTeamAllSprintsDeck(sprints, ASSETS, "light", cornerMesh);
      const fileTeam = (teamName || "Takim").replace(/[^\w]/g, "_");
      await pptx.writeFile({ fileName: `${fileTeam}_Tum_Sprintler.pptx` });
      recordPresentationDownload("BATCH", [teamId]).catch(() => {});
    } catch (err) {
      setError(err?.message || "PPTX indirilemedi.");
    } finally {
      setDownloadingAll(false);
    }
  };

  const handlePptxTemplateConfirm = (customImage) => {
    const req = pptxRequest;
    setPptxRequest(null);
    if (!req) return;
    if (req.type === "single") handleDownloadPptx(req.p, customImage || undefined);
    else handleDownloadAllSprints(customImage || undefined);
  };

  return (
    <div className="presentation-panel-layout">
      <div className="presentation-list-panel">
        <div className="presentation-list-header">
          <h2>{teamName ? `${teamName} — Sprint Sunumları` : "Sprint Sunumları"}</h2>
          {showNewButton && teamId && (
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                variant="soft"
                loading={downloadingAll}
                loadingLabel="Hazırlanıyor…"
                disabled={presentations.length === 0}
                onClick={() => setPptxRequest({ type: "all" })}
              >
                <IconDownload style={{ width: 15, height: 15 }} />
                Tüm Sprintler PPTX İndir
              </Button>
              <Button variant="primary" onClick={() => navigate(`/editor/new?teamId=${teamId}`)}>
                + Yeni Sunum
              </Button>
            </div>
          )}
        </div>

        {loading && <div className="presentation-list-empty">Yükleniyor…</div>}
        {error && <div className="login-error" style={{ margin: "0 0 12px" }}>{error}</div>}
        {!loading && !error && presentations.length === 0 && (
          <div className="presentation-list-empty">
            <IconPresentation style={{ width: 28, height: 28, opacity: 0.5 }} />
            Bu takım için henüz kayıtlı bir sunum yok.
          </div>
        )}

        <div className="presentation-list">
          {presentations.map((p) => (
            <div
              className={`presentation-row${p.id === selectedId ? " selected" : ""}`}
              key={p.id}
              onClick={() => setSelectedId(p.id)}
            >
              <div className="presentation-row-thumb" style={{ backgroundImage: `url(${ASSETS.cover_bg})` }}>
                <span className="presentation-row-thumb-badge">
                  <IconPresentation style={{ width: 13, height: 13 }} />
                </span>
                <span className="presentation-row-thumb-label">Sprint {p.sprintNo}</span>
              </div>
              <div className="presentation-row-main">
                <span className="presentation-row-sprint">
                  Sprint {p.sprintNo}
                  <span className="presentation-row-version-pill">v{p.currentVersion}</span>
                </span>
                <span className="presentation-row-meta">
                  <IconCalendar style={{ width: 13, height: 13 }} />
                  {p.dateRange || "—"}
                </span>
                <span className="presentation-row-meta presentation-row-meta-sub">
                  {formatDateTime(p.updatedAt)}{p.updatedBy ? ` · ${p.updatedBy}` : ""}
                </span>
              </div>
              <div className="presentation-row-actions" onClick={(e) => e.stopPropagation()}>
                <Button variant="soft" onClick={() => setHistoryFor({ id: p.id, sprintNo: p.sprintNo, currentVersion: p.currentVersion })}>
                  <IconHistory style={{ width: 15, height: 15 }} />
                  Sürüm Geçmişi
                </Button>
                <Button variant="primary" onClick={() => navigate(`/editor/${p.id}`)}>
                  <IconEdit style={{ width: 15, height: 15 }} />
                  Düzenle
                </Button>
                <Button
                  variant="soft"
                  loading={downloadingId === p.id}
                  loadingLabel="Hazırlanıyor…"
                  onClick={() => setPptxRequest({ type: "single", p })}
                >
                  <IconDownload style={{ width: 15, height: 15 }} />
                  PPTX İndir
                </Button>
              </div>
            </div>
          ))}
        </div>

        <VersionHistoryModal
          open={!!historyFor}
          presentation={historyFor}
          canRollback={canManage}
          onClose={() => setHistoryFor(null)}
          onRolledBack={() => {
            setHistoryFor(null);
            // Ayni sunum (id degismez) secili KALIR - sadece listedeki
            // v/tarih etiketi ve onizleme icerigi tazelenir, kullanici
            // rollback yaptigi satirdan koparilmaz.
            reload(true);
            setPreviewRefreshKey((k) => k + 1);
          }}
        />

        <PptxTemplateModal
          open={!!pptxRequest}
          onClose={() => setPptxRequest(null)}
          onConfirm={handlePptxTemplateConfirm}
          downloading={downloadingId !== null || downloadingAll}
        />
      </div>

      {/* Secili satirin canli onizlemesi - sihirbazdaki UnifiedPreviewPane'in
          AYNISI, bu listeye gomulu halde. Liste bos/yuklenirken gosterilmez. */}
      {presentations.length > 0 && (
        <div className="presentation-preview-col">
          {previewLoading || !previewSprintData ? (
            <div className="presentation-list-empty">Önizleme yükleniyor…</div>
          ) : (
            <UnifiedPreviewPane
              sprintData={previewSprintData}
              dashData={previewDashData}
              burndownUrl={previewVeloData?.burndownUrl}
              velocityUrl={previewVeloData?.velocityUrl}
              burndownZoomX={previewVeloData?.burndownZoomX}
              burndownZoomY={previewVeloData?.burndownZoomY}
              velocityZoomX={previewVeloData?.velocityZoomX}
              velocityZoomY={previewVeloData?.velocityZoomY}
              assets={ASSETS}
              activeTab={previewTab}
              onTabChange={setPreviewTab}
              onZoom={() => setZoomOpen(true)}
            />
          )}
        </div>
      )}

      {/* Sekme listesi UnifiedPreviewPane'inkiyle AYNI olmali: "velocity" eksik
          oldugunda, yandaki panelde o sekmedeyken ⤢ Preview'a basan kullanici
          basligi "Kapak" yazan ama asagidaki else dalindan icerik slaytini (bos
          kartlar + dev filigran ikonlari) cizen bir ekran goruyordu. */}
      <ZoomModal
        open={zoomOpen}
        onClose={() => setZoomOpen(false)}
        tabs={[
          { key: "cover", label: "Kapak" },
          { key: "content", label: "İçerik Slaytı" },
          { key: "dashboard", label: "Kapasite Dashboard" },
          { key: "velocity", label: "Velocity & Burndown" },
        ]}
        activeTab={previewTab}
        onTabChange={setPreviewTab}
        renderCanvas={(scale) =>
          previewTab === "dashboard" ? (
            <DashboardSlideCanvas dd={previewDashData || {}} assets={ASSETS} scale={scale} />
          ) : previewTab === "velocity" ? (
            <VelocityBurndownSlideCanvas
              data={previewSprintData}
              burndownUrl={previewVeloData?.burndownUrl}
              velocityUrl={previewVeloData?.velocityUrl}
              burndownZoomX={previewVeloData?.burndownZoomX}
              burndownZoomY={previewVeloData?.burndownZoomY}
              velocityZoomX={previewVeloData?.velocityZoomX}
              velocityZoomY={previewVeloData?.velocityZoomY}
              assets={ASSETS}
              scale={scale}
            />
          ) : (
            <SlideCanvas data={previewSprintData} tab={previewTab} assets={ASSETS} scale={scale} />
          )
        }
      />
    </div>
  );
}

function VersionHistoryModal({ open, presentation, canRollback, onClose, onRolledBack }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rollingBackVersion, setRollingBackVersion] = useState(null);

  useEffect(() => {
    if (!open || !presentation) return;
    setLoading(true);
    setError(null);
    fetchPresentationVersions(presentation.id)
      .then(setVersions)
      .catch((err) => setError(err?.message || "Sürüm geçmişi alınamadı."))
      .finally(() => setLoading(false));
  }, [open, presentation]);

  // Guncel (head) surum, versions listesindeki en yuksek numara DEGIL -
  // "Bu sürüme dön" artik gercek bir checkout (bkz. PresentationService.
  // rollback yorumu): head GERIYE de donebilir, bu yuzden asil kaynak
  // presentation.currentVersion (liste satirindan gelir).
  const currentVersion = presentation?.currentVersion ?? null;

  const handleRollback = async (version) => {
    if (
      !window.confirm(
        `Sürüm ${version}'e dönülsün mü?\n\nGüncel sürüm v${version} olacak - hiçbir sürüm silinmeyecek/eklenmeyecek, geçmişteki tüm sürümler (v${version} dahil) aynen kalacak.`
      )
    )
      return;
    setRollingBackVersion(version);
    try {
      await rollbackPresentation(presentation.id, version);
      onRolledBack();
    } catch (err) {
      setError(err?.message || "Geri dönülemedi.");
    } finally {
      setRollingBackVersion(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} boxClassName="box version-history-box">
      <h3 style={{ marginTop: 0 }}>Sprint {presentation?.sprintNo} — Sürüm Geçmişi</h3>
      {loading && <div className="presentation-list-empty">Yükleniyor…</div>}
      {error && <div className="login-error" style={{ margin: "0 0 12px" }}>{error}</div>}
      <div className="version-history-list">
        {versions.map((v) => (
          <div className="version-history-row" key={v.version}>
            <span>v{v.version}</span>
            <span className="presentation-row-meta">{formatDateTime(v.updatedAt)}{v.updatedBy ? ` · ${v.updatedBy}` : ""}</span>
            {v.version === currentVersion ? (
              <span className="presentation-row-meta" style={{ fontWeight: 700, color: "var(--teal2)" }}>
                Güncel sürüm
              </span>
            ) : (
              canRollback && (
                <Button
                  variant="soft"
                  loading={rollingBackVersion === v.version}
                  loadingLabel="Dönülüyor…"
                  onClick={() => handleRollback(v.version)}
                >
                  Bu sürüme dön
                </Button>
              )
            )}
          </div>
        ))}
      </div>
      <Button variant="ghost" onClick={onClose} style={{ marginTop: 14, color: "#B91C1C" }}>
        Kapat
      </Button>
    </Modal>
  );
}
