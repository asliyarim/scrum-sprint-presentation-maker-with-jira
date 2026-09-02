import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "./TopBar";
import Button from "./Button";
import ZoomModal from "./ZoomModal";
import PresentationRunnerModal from "./PresentationRunnerModal";
import PptxTemplateModal from "./PptxTemplateModal";
import SlideCanvas from "../sprint/SlideCanvas";
import DashboardSlideCanvas from "../dashboard/DashboardSlideCanvas";
import VelocityBurndownSlideCanvas from "../sprint/VelocityBurndownSlideCanvas";
import { IconUsers, IconCheckCircle, IconLayers, IconDownload } from "./icons";
import { fetchTeams, fetchPresentations, fetchLatestPresentationsByTeams, fetchPresentationVersions, fetchPresentationVersion, recordPresentationDownload } from "../../lib/apiClient";
import { sprintDataFromContent } from "../../lib/presentationContent";
import { sortBySprintNo } from "../../lib/sprintNumbers";
import { buildJointDeck, commonEndDate } from "../../lib/jointDeckBuilder";
import { SECTION_KEYS, linesOf } from "../../lib/geometry";
import { ASSETS } from "../../assets/pptxAssets";
import { resolveIsAdmin } from "../../lib/teamTypes";
import { DAV_COLORS } from "../../lib/format";
import { useCanvasFit } from "../../hooks/useCanvasFit";

/**
 * Tek bir salt-okunur mini slayt kutusu - .slidebox ile ayni olceklendirme
 * mantigini (useCanvasFit) kullanir. onZoom verilirse tiklaninca/hover'da
 * "büyüt" ipucuyla o takimin sunumunu tam boy modalda acar - coklu takim
 * gorunumunde her birini teker teker, buyultulmus incelemek icin.
 */
function MiniSlideBox({ width = 420, children, onZoom }) {
  const { boxRef, scale } = useCanvasFit();
  return (
    <div
      className={`slidebox joint-mini-slidebox${onZoom ? " zoomable" : ""}`}
      ref={boxRef}
      style={{ width, flex: "0 0 auto" }}
      onClick={onZoom}
      role={onZoom ? "button" : undefined}
      tabIndex={onZoom ? 0 : undefined}
    >
      {children(scale)}
      {onZoom && <span className="joint-mini-slidebox-hint">⤢ Büyüt</span>}
    </div>
  );
}

/** Bir sunumun icerik bolumlerindeki (Tamamlanan/Yapilacak/Riskler/Bekleyen) madde sayilari. */
function sectionCounts(content) {
  const counts = {};
  SECTION_KEYS.forEach((k) => {
    counts[k] = linesOf(content?.sections?.[k] || "").length;
  });
  return counts;
}

const SECTION_LABELS = { done: "Tamamlandı", active: "Devam Ediyor", risk: "Risk", pending: "Bekleyen" };
const SECTION_COLORS = { done: "var(--green)", active: "var(--blue)", risk: "var(--amber)", pending: "var(--purple)" };

/**
 * Tek bir sunumun "Tamamlanan / (Tamamlanan+Yapilacak+Risk+Bekleyen)" oranini
 * gosteren ince halka - coklu takim karsilastirmasi degil, TEK bir sunumun
 * kendi ozet metriği oldugu icin takimin kendi rengini tasir (bkz. --team-accent).
 */
function CompletionRing({ counts, accent, size = 64, stroke = 6 }) {
  const total = SECTION_KEYS.reduce((s, k) => s + counts[k], 0);
  const pct = total > 0 ? Math.round((counts.done / total) * 100) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="joint-ring" role="img" aria-label={`Tamamlanma oranı yüzde ${pct}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--glass-border)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={accent}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="joint-ring-label">
        %{pct}
      </text>
    </svg>
  );
}

/**
 * Ortak (coklu takim) sunum ekrani (/ortak-sunum). Takim PO'lari VE admin
 * erisebilir: takimlari sec (veya "Tum takimlari sec"), her takimin EN SON
 * sunumunu tek bir kapak + tekil slaytlar halinde onizle/indir. Yetki modeli
 * backend'deki (PresentationFacade.requireEditAccess) ile BIREBIR AYNI:
 * PO sadece kendi takiminin sunumunu duzenleyebilir, admin hepsini
 * duzenleyebilir, digerleri salt-okunur kalir ("marklanmis sayfalar" = her
 * takim bloğunun kendi duzenlenebilirlik rozeti).
 *
 * "Düzenle" burada ARTIK inline bir bolum editoru DEGIL (bkz. kullanici
 * bildirimi) - o takimin GUNCEL sprintinin tam sihirbaz editorune
 * (/editor/:id) yonlendirir, "?fromJoint=1" ile isaretlenir ki App.jsx orada
 * normal "Kaydet" (yeni surum ekler) yaninda bir de "Güncelle" (mevcut
 * surumu YERINDE degistirir, bkz. apiClient.updatePresentationInPlace)
 * butonu gostersin - kullanici boylece buradan geldigini bilerek daha
 * rahat, TAM sihirbazla guncelleyebilir.
 */
export default function JointPresentationPage({ personnel, theme, onToggleTheme }) {
  const navigate = useNavigate();
  const isAdmin = resolveIsAdmin(personnel);
  const assets = ASSETS;

  const [teams, setTeams] = useState([]);
  // Her takimin son sunumlarini, o takim GENISLETILDIGINDE (lazy) yukleyip
  // burada tutariz - takim id -> sunum ozeti dizisi. Ortak Sunum artik takim
  // basina TEK "en son" sunumla sinirli degil; PO hangi takimin hangi
  // sprintini, hangi surumunu dahil edecegini tek tek secer (kullanici
  // bildirimi 2026-08-31).
  const [teamPres, setTeamPres] = useState({});           // { [teamId]: summary[] | "loading" | "error" }
  const [expandedTeam, setExpandedTeam] = useState(null); // hangi takim acik
  const [versionsByPres, setVersionsByPres] = useState({}); // { [presId]: version[] | "loading" | "error" }
  const [expandedPres, setExpandedPres] = useState(null); // hangi sunumun surum listesi acik
  // Secilenler: { presentationId, teamId, sprintNo, version }. Ayni sunumun
  // FARKLI surumleri de ayri ayri secilebilir, o yuzden anahtar presId+version.
  const [picks, setPicks] = useState([]);
  const [allLoading, setAllLoading] = useState(false);
  // Secilenler listesinde surukle-birak ile yeniden siralama - o an suruklenen
  // ogenin picks icindeki indeksi. Ortak sunum takim sirasi picks sirasindan
  // gelir (handleFetch sirayi korur), yani buradan siralama = sunum sirasi
  // (kullanici bildirimi 2026-08-31).
  const [dragIdx, setDragIdx] = useState(null);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsError, setTeamsError] = useState(null);

  const [results, setResults] = useState(null); // [{ teamId, teamName, canEdit, content, sprintData, dashData }]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  // Coklu takim ızgarasinda bir takimin sunumunu tek basina, buyultulmus
  // incelemek icin - { teamId, tab } | null. tab, hangi mini-slide'a
  // tiklandiysa onunla baslar, modal icinde sekmeler arasi gecilebilir.
  // teamId="__cover__" ozel bir deger: TEK ortak kapagin kendi buyultulmus
  // gorunumu icin (herhangi bir takima ait degil, bkz. kullanici bildirimi
  // 2026-08-21: "kapak tek bir tane ortak olacak").
  const [zoom, setZoom] = useState(null);
  const isCoverZoom = zoom?.rkey === "__cover__";
  const zoomResult = zoom && !isCoverZoom ? results?.find((r) => r.key === zoom.rkey) : null;
  const hasVeloData = (r) => !!(r?.veloData?.burndownUrl || r?.veloData?.velocityUrl);
  // Kapasite sekmesi veri olmasa da HER ZAMAN gosterilir - slayt bos
  // iskeletle ciziliyor (bkz. addDashboardSlide/DashboardSlideCanvas) ve
  // PPTX ciktisiyla ayni sayfalar onizlemede de gorunsun. Velocity&Burndown
  // ise SADECE veri varsa sekme olarak eklenir (bkz. kullanici bildirimi,
  // 2026-08-21 - eskiden bu sekme/slayt hic yoktu).
  const zoomTabs = isCoverZoom
    ? [{ key: "cover", label: "Kapak" }]
    : zoomResult
      ? [
          { key: "content", label: "İçerik Slaytı" },
          { key: "dashboard", label: "Kapasite Dashboard" },
          ...(hasVeloData(zoomResult) ? [{ key: "velocity", label: "Velocity & Burndown" }] : []),
        ]
      : null;
  // Tek bir ortak kapak icin sentetik "sprintData" - SlideCanvas'in "cover"
  // sekmesi sadece teamName/subtitle okur (bkz. SlideCanvas.jsx), ayri bir
  // bilesen yazmaya gerek kalmadan aynen PPTX'teki addJointCoverSlide ile
  // AYNI baslik + ortak bitis tarihini gosterir.
  const jointCoverData = { teamName: "Ortak Sprint Sunumu", subtitle: commonEndDate(results || []) };

  useEffect(() => {
    fetchTeams()
      .then(setTeams)
      .catch((err) => setTeamsError(err?.message || "Takımlar yüklenemedi."))
      .finally(() => setTeamsLoading(false));
  }, []);

  const pickKey = (presId, version) => `${presId}#${version}`;
  const isPicked = (presId, version) => picks.some((x) => x.presentationId === presId && x.version === version);

  const togglePick = (teamId, presId, sprintNo, version) => {
    setPicks((prev) =>
      prev.some((x) => x.presentationId === presId && x.version === version)
        ? prev.filter((x) => !(x.presentationId === presId && x.version === version))
        : [...prev, { presentationId: presId, teamId, sprintNo, version }]
    );
  };

  // Bir takim kartina tiklanınca: ac/kapa. Ilk acilista o takimin sunumlarini
  // (en guncel sprint ustte, ilk 10) yukler - liste hep sirali gelsin diye
  // sortBySprintNo kullanilir (backend siralama garantisi vermez).
  const toggleTeamExpand = async (teamId) => {
    setExpandedTeam((cur) => (cur === teamId ? null : teamId));
    if (teamPres[teamId] || expandedTeam === teamId) return;
    setTeamPres((m) => ({ ...m, [teamId]: "loading" }));
    try {
      const list = await fetchPresentations(teamId);
      setTeamPres((m) => ({ ...m, [teamId]: sortBySprintNo(list).slice(0, 10) }));
    } catch {
      setTeamPres((m) => ({ ...m, [teamId]: "error" }));
    }
  };

  // Bir sunuma tiklanınca surum gecmisini (Sunumlarım'daki gibi) ac/kapa +
  // ilk acilista yukle.
  const togglePresExpand = async (presId) => {
    setExpandedPres((cur) => (cur === presId ? null : presId));
    if (versionsByPres[presId] || expandedPres === presId) return;
    setVersionsByPres((m) => ({ ...m, [presId]: "loading" }));
    try {
      const vs = await fetchPresentationVersions(presId);
      setVersionsByPres((m) => ({ ...m, [presId]: vs }));
    } catch {
      setVersionsByPres((m) => ({ ...m, [presId]: "error" }));
    }
  };

  // "Tümünü Seç": her takimin SON sprintini (guncel surumuyle) tek hamlede
  // secer - eski davranisin (takim basina en son sunum) kisayolu. Sonuc takim
  // listesi sirasinda dizilir; PO sonra surukleyerek degistirebilir.
  const selectAllLatest = async () => {
    setAllLoading(true);
    setError(null);
    try {
      const latest = await fetchLatestPresentationsByTeams(teams.map((t) => t.id));
      const order = new Map(teams.map((t, i) => [t.id, i]));
      const sorted = [...latest].sort((a, b) => (order.get(a.teamId) ?? 0) - (order.get(b.teamId) ?? 0));
      setPicks(sorted.map((pr) => ({ presentationId: pr.id, teamId: pr.teamId, sprintNo: pr.sprintNo, version: pr.currentVersion })));
    } catch {
      setError("Takımların son sunumları yüklenemedi.");
    } finally {
      setAllLoading(false);
    }
  };

  const clearPicks = () => setPicks([]);
  const removePick = (presId, version) =>
    setPicks((prev) => prev.filter((x) => !(x.presentationId === presId && x.version === version)));

  // Surukle-birak: from indeksindeki secimi to indeksine tasir.
  const reorderPicks = (from, to) => {
    setPicks((prev) => {
      if (from == null || to == null || from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };
  const teamNameOf = (teamId) => teams.find((t) => t.id === teamId)?.name || "Takım";

  const myTeamIds = personnel?.teamIds || (personnel?.teamId != null ? [personnel.teamId] : []);

  const handleFetch = async () => {
    if (picks.length === 0) {
      setError("En az bir sunum seçmelisiniz.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Her secilen (sunum, surum) icin o surumun TAM icerigini cek. Guncel
      // surum de dahil hepsi ayni uctan gelir (bkz. fetchPresentationVersion) -
      // tek yol, tutarli. Secim sirasi korunur.
      const built = [];
      for (const pk of picks) {
        let content;
        try {
          const detail = await fetchPresentationVersion(pk.presentationId, pk.version);
          content = detail?.content || {};
        } catch {
          continue; // bir surum cekilemezse digerlerini durdurma
        }
        const team = teams.find((t) => t.id === pk.teamId);
        built.push({
          key: pickKey(pk.presentationId, pk.version),
          teamId: pk.teamId,
          teamName: team?.name || content?.teamType || "Takım",
          sprintNo: pk.sprintNo,
          version: pk.version,
          canEdit: isAdmin || myTeamIds.includes(pk.teamId),
          presentationId: pk.presentationId,
          content,
          sprintData: sprintDataFromContent(content),
          dashData: content?.dashData || null,
          veloData: content?.veloData || null,
        });
      }
      setResults(built);
      // "Önizle" tekli sunumdaki "⤢ Preview" ile ayni mantikla calisir -
      // onizleme acmak = sunumu baslatmak (bkz. kullanici bildirimi): sonuc
      // varsa dogrudan sirali/timerli tam ekran moda gecilir, ayrica bir
      // "Sunumu Başlat" butonuna basmaya gerek yok.
      if (built.length > 0) setRunnerOpen(true);
      if (built.length < picks.length) {
        setError("Bazı seçilen sürümler getirilemedi, listeye dahil edilmedi.");
      }
    } catch (err) {
      setError(err?.message || "Sunumlar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  /** "Düzenle" - o takimin sunumunu tam sihirbaz editorunde acar, "Güncelle" butonunu göstermesi icin isaretlenir (bkz. üstteki modül yorumu). */
  const handleEditTeam = (r) => {
    navigate(`/editor/${r.presentationId}?fromJoint=1`);
  };

  // "PPTX İndir (Ortak)" tiklaninca hemen indirmez - once sablon secim
  // popup'u acilir (bkz. kullanici bildirimi).
  const [pptxTemplateOpen, setPptxTemplateOpen] = useState(false);

  // Secilen takimlarin sunumlarini sirayla, her birinin kendi suresi kadar
  // tam ekran gosteren mod (bkz. PresentationRunnerModal). "Önizle" ile
  // sonuclar geldiginde OTOMATIK acilir - tekli sunumdaki "⤢ Preview" ile
  // ayni mantik: onizleme acmak = sunumu baslatmak (bkz. handleFetch).
  // "Sunumu Tekrar Başlat" butonu, sonuclar zaten yuklu ama modal kapatilmis
  // durumdayken tekrar acmak icin.
  const [runnerOpen, setRunnerOpen] = useState(false);

  const handleJointExport = async (cornerMesh) => {
    if (!results || results.length === 0) return;
    setExporting(true);
    setError(null);
    try {
      const pptx = await buildJointDeck(results, assets, theme === "dark" ? "dark" : "light", cornerMesh);
      await pptx.writeFile({ fileName: "Ortak_Sprint_Sunumu.pptx" });
      await recordPresentationDownload("BATCH", [...new Set(results.map((r) => r.teamId))]).catch(() => {
        // indirme kaydi best-effort - basarisiz olsa da kullaniciyi engellemez
      });
    } catch (err) {
      setError(err?.message || "Ortak PPTX üretilirken bir hata oluştu.");
    } finally {
      setExporting(false);
    }
  };

  const totalItems = results
    ? results.reduce((sum, r) => sum + SECTION_KEYS.reduce((s, k) => s + sectionCounts(r.content)[k], 0), 0)
    : null;

  return (
    <>
      <TopBar theme={theme} onToggleTheme={onToggleTheme} personnel={personnel} />
      <main className="joint-presentation-page" style={{ padding: "20px 22px" }}>
        <div className="panelttl" style={{ marginBottom: 4 }}>Ortak Sunum</div>
        <div className="hint" style={{ marginBottom: 14 }}>
          Her takımın son sprint sunumlarından istediğinizi (ve istediğiniz sürümünü) seçip tek bir kapak altında
          birleştirin, önizleyin ve PPTX olarak indirin. Aynı takımdan birden fazla sprint de seçebilirsiniz.
          Sadece kendi takımınızın (adminseniz tüm takımların) sayfalarını düzenleyebilirsiniz.
        </div>

        <div className="joint-kpi-row">
          <div className="joint-kpi-tile joint-kpi-blue">
            <span className="joint-kpi-icon"><IconUsers style={{ width: 18, height: 18 }} /></span>
            <div className="joint-kpi-text">
              <span className="joint-kpi-value">{teams.length}</span>
              <span className="joint-kpi-label">Toplam Takım</span>
            </div>
          </div>
          <div className="joint-kpi-tile joint-kpi-green">
            <span className="joint-kpi-icon"><IconCheckCircle style={{ width: 18, height: 18 }} /></span>
            <div className="joint-kpi-text">
              <span className="joint-kpi-value">{picks.length}</span>
              <span className="joint-kpi-label">Seçili Sunum</span>
            </div>
          </div>
          <div className="joint-kpi-tile joint-kpi-purple">
            <span className="joint-kpi-icon"><IconLayers style={{ width: 18, height: 18 }} /></span>
            <div className="joint-kpi-text">
              <span className="joint-kpi-value">{totalItems ?? "—"}</span>
              <span className="joint-kpi-label">Toplam Madde</span>
            </div>
          </div>
          <div className="joint-kpi-tile joint-kpi-amber">
            <span className="joint-kpi-icon"><IconDownload style={{ width: 18, height: 18 }} /></span>
            <div className="joint-kpi-text">
              <span className="joint-kpi-value">{results?.length ?? 0}</span>
              <span className="joint-kpi-label">Hazır Sunum</span>
            </div>
          </div>
        </div>

        <div className="bandpanel joint-filter-panel" style={{ marginBottom: 16 }}>
          <div className="bandtoggle joint-filter-title" style={{ cursor: "default" }}>
            <span className="joint-filter-title-badge">
              <IconUsers style={{ width: 14, height: 14 }} />
            </span>
            Takımlar
          </div>
          {teamsLoading && <div className="mhint">Yükleniyor…</div>}
          {teamsError && <div className="login-error">{teamsError}</div>}
          {!teamsLoading && !teamsError && (
            <>
              <div className="joint-picker-toolbar">
                <Button variant="soft" loading={allLoading} loadingLabel="Seçiliyor…" onClick={selectAllLatest}>
                  Tümünü Seç (son sprintler)
                </Button>
                {picks.length > 0 && (
                  <button type="button" className="joint-picker-clear" onClick={clearPicks}>
                    Seçimi temizle
                  </button>
                )}
              </div>
              <div className="joint-picker">
                {teams.map((t, i) => {
                  const accent = "#" + DAV_COLORS[i % DAV_COLORS.length];
                  const open = expandedTeam === t.id;
                  const list = teamPres[t.id];
                  const pickedInTeam = picks.filter((x) => x.teamId === t.id).length;
                  return (
                    <div key={t.id} className={`joint-picker-team${open ? " open" : ""}`} style={{ "--team-accent": accent }}>
                      <button type="button" className="joint-picker-team-head" onClick={() => toggleTeamExpand(t.id)} aria-expanded={open}>
                        <span className="joint-picker-caret" aria-hidden="true">{open ? "▾" : "▸"}</span>
                        <span className="joint-picker-av" style={{ background: accent }}>{(t.name || "?").slice(0, 2).toUpperCase()}</span>
                        <span className="joint-picker-team-name">{t.name}</span>
                        {pickedInTeam > 0 && <span className="joint-picker-count">{pickedInTeam} seçili</span>}
                      </button>
                      {open && (
                        <div className="joint-picker-body">
                          {list === "loading" && <div className="mhint">Sunumlar yükleniyor…</div>}
                          {list === "error" && <div className="login-error">Sunumlar yüklenemedi.</div>}
                          {Array.isArray(list) && list.length === 0 && <div className="mhint">Bu takımın kayıtlı sunumu yok.</div>}
                          {Array.isArray(list) && list.map((pres) => {
                            const vOpen = expandedPres === pres.id;
                            const vs = versionsByPres[pres.id];
                            const guncelSecili = isPicked(pres.id, pres.currentVersion);
                            return (
                              <div key={pres.id} className="joint-picker-pres">
                                <div className="joint-picker-pres-row">
                                  <label className="joint-picker-pres-main">
                                    <input
                                      type="checkbox"
                                      checked={guncelSecili}
                                      onChange={() => togglePick(t.id, pres.id, pres.sprintNo, pres.currentVersion)}
                                    />
                                    <span className="joint-picker-sprint">Sprint {pres.sprintNo}</span>
                                    <span className="joint-picker-vtag">güncel (v{pres.currentVersion})</span>
                                    {pres.dateRange && <span className="joint-picker-range">{pres.dateRange}</span>}
                                  </label>
                                  <button type="button" className="joint-picker-history" onClick={() => togglePresExpand(pres.id)} aria-expanded={vOpen}>
                                    {vOpen ? "Sürümleri gizle" : "Sürüm geçmişi"}
                                  </button>
                                </div>
                                {vOpen && (
                                  <div className="joint-picker-versions">
                                    {vs === "loading" && <div className="mhint">Sürümler yükleniyor…</div>}
                                    {vs === "error" && <div className="login-error">Sürümler yüklenemedi.</div>}
                                    {Array.isArray(vs) && vs.map((v) => (
                                      <label key={v.version} className="joint-picker-version">
                                        <input
                                          type="checkbox"
                                          checked={isPicked(pres.id, v.version)}
                                          onChange={() => togglePick(t.id, pres.id, pres.sprintNo, v.version)}
                                        />
                                        <span className="joint-picker-vtag">v{v.version}</span>
                                        {v.version === pres.currentVersion && <span className="joint-picker-guncel-badge">güncel</span>}
                                        <span className="joint-picker-vmeta">{v.updatedBy || "—"}</span>
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {picks.length > 0 && (
                <div className="joint-selected">
                  <div className="joint-selected-title">
                    Seçili sunumlar — sürükleyerek sıralayın (sunumdaki sıra budur)
                  </div>
                  <ol className="joint-selected-list">
                    {picks.map((pk, i) => (
                      <li
                        key={`${pk.presentationId}#${pk.version}`}
                        className={`joint-selected-item${dragIdx === i ? " dragging" : ""}`}
                        draggable
                        onDragStart={() => setDragIdx(i)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); reorderPicks(dragIdx, i); setDragIdx(null); }}
                        onDragEnd={() => setDragIdx(null)}
                      >
                        <span className="joint-selected-grip" aria-hidden="true">⠿</span>
                        <span className="joint-selected-order">{i + 1}</span>
                        <span className="joint-selected-name">{teamNameOf(pk.teamId)}</span>
                        <span className="joint-selected-meta">Sprint {pk.sprintNo} · v{pk.version}</span>
                        <button
                          type="button"
                          className="joint-selected-remove"
                          onClick={() => removePick(pk.presentationId, pk.version)}
                          aria-label="Seçimden çıkar"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <Button variant="primary" loading={loading} loadingLabel="Getiriliyor…" onClick={handleFetch} disabled={picks.length === 0}>
                  ⤢ Önizle ({picks.length})
                </Button>
                {results && results.length > 0 && (
                  <Button variant="soft" onClick={() => setRunnerOpen(true)}>
                    Sunumu Tekrar Başlat
                  </Button>
                )}
                {results && (
                  <Button variant="soft" loading={exporting} loadingLabel="Hazırlanıyor…" onClick={() => setPptxTemplateOpen(true)}>
                    PPTX İndir (Ortak)
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        {error && <div className="login-error" style={{ marginBottom: 14 }}>{error}</div>}

        {results && results.length === 0 && <div className="presentation-list-empty">Seçilen takımların kayıtlı sunumu bulunamadı.</div>}

        {results && results.length > 0 && (
          <div className="joint-cover-row" style={{ marginBottom: 16 }}>
            <MiniSlideBox width={300} onZoom={() => setZoom({ rkey: "__cover__", tab: "cover" })}>
              {(scale) => <SlideCanvas data={jointCoverData} tab="cover" assets={assets} scale={scale} />}
            </MiniSlideBox>
          </div>
        )}

        <div className="joint-team-grid">
          {results?.map((r) => {
            const idx = teams.findIndex((t) => t.id === r.teamId);
            const accent = "#" + DAV_COLORS[(idx < 0 ? 0 : idx) % DAV_COLORS.length];
            return (
              <div key={r.key} className="sec joint-team-card" style={{ "--team-accent": accent }}>
                <div className="head" style={{ justifyContent: "space-between" }}>
                  <span className="joint-team-card-title">
                    <span className="joint-team-card-av" style={{ background: accent }}>
                      {(r.teamName || "?").slice(0, 2).toUpperCase()}
                    </span>
                    <span className="t">{r.teamName}{r.sprintNo != null ? ` · Sprint ${r.sprintNo}` : ""}{r.version != null ? ` (v${r.version})` : ""}</span>
                  </span>
                  <span className="tools" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {r.canEdit ? (
                      <span className="joint-badge joint-badge-edit">Düzenlenebilir</span>
                    ) : (
                      <span className="joint-badge joint-badge-readonly">🔒 Salt okunur</span>
                    )}
                    {r.canEdit && (
                      <button type="button" className="addbar" onClick={() => handleEditTeam(r)}>
                        Düzenle
                      </button>
                    )}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
                  <div className="joint-summary">
                    <CompletionRing counts={sectionCounts(r.content)} accent={accent} />
                    <span className="joint-summary-caption">Tamamlanma Oranı</span>
                    <div className="joint-summary-breakdown">
                      {["done", "active"].map((key) => (
                        <span key={key} className="joint-summary-row">
                          <span className="joint-summary-dot" style={{ background: SECTION_COLORS[key] }} />
                          {sectionCounts(r.content)[key]} {SECTION_LABELS[key]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <MiniSlideBox onZoom={() => setZoom({ rkey: r.key, tab: "content" })}>
                    {(scale) => <SlideCanvas data={r.sprintData} tab="content" assets={assets} scale={scale} />}
                  </MiniSlideBox>
                  <MiniSlideBox onZoom={() => setZoom({ rkey: r.key, tab: "dashboard" })}>
                    {(scale) => <DashboardSlideCanvas dd={r.dashData || {}} assets={assets} scale={scale} />}
                  </MiniSlideBox>
                  {hasVeloData(r) && (
                    <MiniSlideBox onZoom={() => setZoom({ rkey: r.key, tab: "velocity" })}>
                      {(scale) => (
                        <VelocityBurndownSlideCanvas
                          data={r.sprintData}
                          burndownUrl={r.veloData?.burndownUrl}
                          velocityUrl={r.veloData?.velocityUrl}
                          burndownZoomX={r.veloData?.burndownZoomX}
                          burndownZoomY={r.veloData?.burndownZoomY}
                          velocityZoomX={r.veloData?.velocityZoomX}
                          velocityZoomY={r.veloData?.velocityZoomY}
                          assets={assets}
                          scale={scale}
                        />
                      )}
                    </MiniSlideBox>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <ZoomModal
        open={!!zoom}
        onClose={() => setZoom(null)}
        tabs={zoomTabs}
        activeTab={zoom?.tab}
        onTabChange={(tab) => setZoom((z) => (z ? { ...z, tab } : z))}
        renderCanvas={(scale) =>
          isCoverZoom ? (
            <SlideCanvas data={jointCoverData} tab="cover" assets={assets} scale={scale} />
          ) : zoom?.tab === "dashboard" ? (
            <DashboardSlideCanvas dd={zoomResult?.dashData || {}} assets={assets} scale={scale} />
          ) : zoom?.tab === "velocity" ? (
            <VelocityBurndownSlideCanvas
              data={zoomResult?.sprintData}
              burndownUrl={zoomResult?.veloData?.burndownUrl}
              velocityUrl={zoomResult?.veloData?.velocityUrl}
              burndownZoomX={zoomResult?.veloData?.burndownZoomX}
              burndownZoomY={zoomResult?.veloData?.burndownZoomY}
              velocityZoomX={zoomResult?.veloData?.velocityZoomX}
              velocityZoomY={zoomResult?.veloData?.velocityZoomY}
              assets={assets}
              scale={scale}
            />
          ) : (
            <SlideCanvas data={zoomResult?.sprintData} tab="content" assets={assets} scale={scale} />
          )
        }
        timerSeconds={zoomResult?.content?.timerMinutes ? Number(zoomResult.content.timerMinutes) * 60 : null}
      />

      <PresentationRunnerModal
        open={runnerOpen}
        onClose={() => setRunnerOpen(false)}
        queue={results}
        assets={assets}
      />

      <PptxTemplateModal
        open={pptxTemplateOpen}
        onClose={() => setPptxTemplateOpen(false)}
        onConfirm={(customImage) => {
          setPptxTemplateOpen(false);
          handleJointExport(customImage || undefined);
        }}
        downloading={exporting}
      />
    </>
  );
}
