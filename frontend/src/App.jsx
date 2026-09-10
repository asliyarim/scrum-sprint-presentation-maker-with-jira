import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import "./styles/app.css";
import "./styles/theme.css";

import {
  fetchCurrentUser,
  fetchUserProfile,
  fetchPresentation,
  fetchPresentations,
  fetchTeams,
  fetchLatestPresentationsByTeams,
  logout,
  savePresentation,
  updatePresentationInPlace,
  setPresentationFinalized,
  recordPresentationDownload,
  triggerJiraSync,
} from "./lib/apiClient";
import ProfilePage from "./components/shared/ProfilePage";
import AdminHomePage from "./components/shared/AdminHomePage";
import MonitoringPage from "./components/shared/MonitoringPage";
import BenefitsAdminPage from "./components/shared/BenefitsAdminPage";
import BenefitsModal from "./components/sprint/BenefitsModal";
import PresentationsPage from "./components/shared/PresentationsPage";
import JointPresentationPage from "./components/shared/JointPresentationPage";
import TopBar from "./components/shared/TopBar";
import ZoomModal from "./components/shared/ZoomModal";
import ExportPreviewModal from "./components/shared/ExportPreviewModal";
import ErrorBanner from "./components/shared/ErrorBanner";
import WizardSteps from "./components/shared/WizardSteps";
import UnifiedPreviewPane from "./components/shared/UnifiedPreviewPane";
import Button from "./components/shared/Button";
import AlertModal from "./components/shared/AlertModal";
import Modal from "./components/shared/Modal";
import ReadOnlyNotice from "./components/shared/ReadOnlyNotice";

import SprintPage from "./components/sprint/SprintPage";
import SprintTopActions from "./components/sprint/SprintTopActions";
import EditorModal from "./components/sprint/EditorModal";
import SlideCanvas from "./components/sprint/SlideCanvas";
import CoverPage from "./components/sprint/CoverPage";
import VelocityBurndownPage from "./components/sprint/VelocityBurndownPage";
import VelocityBurndownSlideCanvas from "./components/sprint/VelocityBurndownSlideCanvas";

import DashboardPage from "./components/dashboard/DashboardPage";
import DashboardTopActions from "./components/dashboard/DashboardTopActions";
import DashboardSlideCanvas from "./components/dashboard/DashboardSlideCanvas";
import DashboardEditModal from "./components/dashboard/DashboardEditModal";
import { mergeDashOverride, personKeys } from "./lib/dashOverride";

import { useSprintForm } from "./hooks/useSprintForm";
import { useBandEditor } from "./hooks/useBandEditor";
import { useExcelSuggestions } from "./hooks/useExcelSuggestions";
import { useJiraContentSuggestions } from "./hooks/useJiraContentSuggestions";
import { usePptxExport } from "./hooks/usePptxExport";
import { useDashboardData } from "./hooks/useDashboardData";
import { useManualDashboard } from "./hooks/useManualDashboard";
import { useJiraDashboard } from "./hooks/useJiraDashboard";
import { useTheme } from "./hooks/useTheme";
import { useCoverImage } from "./hooks/useCoverImage";
import { useCoverBackground } from "./hooks/useCoverBackground";
import { useVelocityBurndown } from "./hooks/useVelocityBurndown";
import { useSectorOptions } from "./hooks/useSectorOptions";

import { sectionDefs, SECTION_KEYS, contentReadability } from "./lib/geometry";
import { parsePeriodText, formatPeriod } from "./lib/sprintPeriod";
import { buildFullDeck } from "./lib/fullDeckBuilder";
import { ASSETS } from "./assets/pptxAssets";
import { hasFteTracking, resolveIsAdmin, resolveTeamTypeFromDepartment, bandAutoFills, tracksBenefits } from "./lib/teamTypes";
import { nextSprintNo } from "./lib/sprintNumbers";

// Giris ekrani ARTIK BU UYGULAMADA DEGIL: kimlik dogrulama dis kabuga
// (Odyssey) tasindi. Oturum yoksa ya da dustuyse kullaniciyi tum sekmeyle
// birlikte oraya gonderiyoruz - iframe icindeyken de ust pencereyi
// degistiriyoruz, yoksa giris ekrani cerceve icinde sikisip kalirdi.
// VITE_ODYSSEY_URL derleme aninda verilir; verilmezse ayni origin koku
// kullanilir (Odyssey zaten orada duruyor, bkz. Odyssey nginx /kapasite).
const ODYSSEY_URL = import.meta.env.VITE_ODYSSEY_URL || "/";
// Vite base degeri ("/kapasite/") React Router icin sondaki egik cizgisiz
// olmali; kok altinda calisirken ("/") bos string olur ve etkisiz kalir.
const ROUTER_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function odysseyeDon() {
  const hedef = new URL(ODYSSEY_URL, window.location.href);
  // Yerel gelistirmede (VITE_ODYSSEY_URL verilmeden "npm run dev") hedef
  // uygulamanin KENDI koku oluyor; yonlendirme sonsuz donguye girmesin diye
  // ayni sayfaya gidecekse hic dokunmuyoruz - o zaman ekran bos kalir ve
  // gelistirici konsolda sebebini gorur.
  const ust = window.top || window;
  if (ust === window && hedef.href === window.location.href) {
    console.warn("Oturum yok ve Odyssey adresi bu sayfanin kendisi - yonlendirme atlandi (VITE_ODYSSEY_URL verin).");
    return;
  }
  ust.location.href = hedef.href;
}

// ZoomModal ("⤢ Preview") ve ExportPreviewModal ("PPTX İndir" oncesi onizleme)
// AYNI 4 sekmeyi kullanir - tek yerden tanimlanir.
// NOT: Velocity & Burndown sekmesi gorsel yuklenmemis olsa da onizlemede HEP
// kalir (kullanici karari 2026-09-07) - PO eklemeyi unuttuysa fark etsin diye.
// Bos sayfa yalnizca indirilen PPTX'e ve ortak sunuma girmez
// (bkz. velocityDeckBuilder.hasVelocityContent).
const PREVIEW_TABS = [
  { key: "cover", label: "Kapak" },
  { key: "content", label: "İçerik Slaytı" },
  { key: "dashboard", label: "Kapasite Dashboard" },
  { key: "velocity", label: "Velocity & Burndown" },
];

/**
 * Salt-okunur goruntulenen takimin KAYITLI SUNUMU YOKSA onizlemeye
 * uygulanacak "bos" icerik - onceki takimin icerigi, yeni secilen takimin
 * adi altinda kalmasin diye (bkz. loadTeamPresentation). buildSaveContent()
 * ile ayni sekilde, boylece applyContent tek bir bicimi tuketir.
 */
const EMPTY_CONTENT = {
  sprint: "",
  range: "",
  sections: { done: "", active: "", risk: "", pending: "" },
  notes: "",
  band: { show: false, bars: [] },
  dashSource: "excel",
  dashData: null,
  timerMinutes: 5,
};

/**
 * Oturum durumunu yonetir - oturum yoksa kullanici dis kabuga (Odyssey)
 * geri gonderilir, varsa ana uygulama (MainApp) render edilir. Iki farkli
 * bilesen olarak ayrildi ki hook sayisi/sirasi render'lar arasinda tutarli
 * kalsin (Rules of Hooks) - ayni bilesen icinde erken "return" ile kalan
 * hook'lari atlamak gecersizdi.
 *
 * Sayfa yenilendiginde acilista /api/auth/me ile mevcut oturum (access_token
 * cookie'si hala gecerliyse) geri kurulur; cookie'yi Odyssey'in giris
 * ekrani yazar ve ayni origin uzerinden buraya da gelir (bkz. Odyssey
 * nginx.conf - /api ve /kapasite ayni alan adindan servis edilir).
 */
export default function App() {
  const [personnel, setPersonnel] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    fetchCurrentUser()
      .then(setPersonnel)
      .finally(() => setSessionChecked(true));
  }, []);

  // /api/auth/me bilerek hafif (department icermez, bkz. apiClient.js) - takim
  // bazli duzenleme yetkisi kontrolu (bkz. MainApp/currentUser) icin gereken
  // department bilgisini, oturum kurulduktan sonra bir kere /profile'dan
  // ayrica cekip personnel'e ekliyoruz. Basarisiz olursa sessizce yutulur -
  // department yoksa MainApp zaten kisitlama uygulamiyor (fail-open).
  useEffect(() => {
    if (!personnel || personnel.department !== undefined) return;
    fetchUserProfile()
      .then((profile) => setPersonnel((prev) => (prev ? { ...prev, department: profile.department } : prev)))
      .catch(() => {});
  }, [personnel]);

  const handleLogout = () => {
    logout().finally(odysseyeDon);
  };

  if (!sessionChecked) return null;

  // Oturum yoksa giris icin dis kabuga don (bkz. odysseyeDon).
  if (!personnel) {
    odysseyeDon();
    return null;
  }

  const isAdmin = resolveIsAdmin(personnel);

  return (
    <BrowserRouter basename={ROUTER_BASE}>
      <Routes>
        <Route
          path="/profile"
          element={
            personnel ? (
              <ProfilePage
                personnel={personnel}
                theme={theme}
                onToggleTheme={toggleTheme}
                onLogout={handleLogout}
                onProfileUpdated={(updated) =>
                  setPersonnel((prev) =>
                    prev
                      ? {
                          ...prev,
                          fullName: updated.fullName,
                          teamId: updated.teamId,
                          department: updated.department,
                          // Profil ekrani tek takim secimi sundugu icin kaydedince
                          // coklu takim listesi (varsa) teke duser - bkz. backend ProfileService.
                          teamIds: updated.teamId != null ? [updated.teamId] : [],
                        }
                      : prev
                  )
                }
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/admin"
          element={
            personnel && isAdmin ? (
              <AdminHomePage personnel={personnel} theme={theme} onToggleTheme={toggleTheme} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/admin/monitoring"
          element={
            personnel && isAdmin ? (
              <MonitoringPage personnel={personnel} theme={theme} onToggleTheme={toggleTheme} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        {/* "Zaman Disi Kazanimlar" girisi - dis dashboard'un
            /api/integration/benefits ucuna veri kaynagi (Nezih, 04.09.2026). */}
        <Route
          path="/admin/kazanimlar"
          element={
            personnel && isAdmin ? (
              <BenefitsAdminPage personnel={personnel} theme={theme} onToggleTheme={toggleTheme} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/presentations"
          element={
            personnel ? (
              <PresentationsPage personnel={personnel} theme={theme} onToggleTheme={toggleTheme} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/ortak-sunum"
          element={
            personnel ? (
              <JointPresentationPage personnel={personnel} theme={theme} onToggleTheme={toggleTheme} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/editor/new"
          element={personnel ? <EditorForNew theme={theme} toggleTheme={toggleTheme} personnel={personnel} /> : <Navigate to="/" replace />}
        />
        <Route
          path="/editor/:id"
          element={personnel ? <EditorForExisting theme={theme} toggleTheme={toggleTheme} personnel={personnel} /> : <Navigate to="/" replace />}
        />
        <Route
          path="/"
          element={
            isAdmin ? (
              <Navigate to="/admin" replace />
            ) : (
              <MainApp theme={theme} toggleTheme={toggleTheme} personnel={personnel} />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

/**
 * `/editor/:id` - var olan bir sunumu yukleyip duzenlemeye acar.
 * "?fromJoint=1" ise Ortak Sunum ekranindaki "Düzenle"den gelindigini
 * isaretler (bkz. JointPresentationPage.handleEditTeam) - MainApp bu durumda
 * normal "Kaydet" (yeni surum ekler) yaninda bir de "Güncelle" (mevcut
 * surumu YERINDE degistirir) butonu gosterir.
 */
function EditorForExisting({ theme, toggleTheme, personnel }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  return (
    <MainApp
      theme={theme}
      toggleTheme={toggleTheme}
      personnel={personnel}
      presentationId={Number(id)}
      fromJoint={params.get("fromJoint") === "1"}
    />
  );
}

/** `/editor/new?teamId=X` - admin'in "Yeni Sunum" ile actigi bos sihirbaz. */
function EditorForNew({ theme, toggleTheme, personnel }) {
  const [params] = useSearchParams();
  const teamId = params.get("teamId");
  return <MainApp theme={theme} toggleTheme={toggleTheme} personnel={personnel} newForTeamId={teamId ? Number(teamId) : null} />;
}

function MainApp({ theme, toggleTheme, personnel, presentationId, newForTeamId, fromJoint }) {
  // "mode/step" ayni degisken: hem ust nav hem sihirbaz adimi olarak kullanilir.
  const [mode, setMode] = useState("cover");
  const navigate = useNavigate();
  // PPTX ciktisinin acik/koyu temasi - varsayilan olarak uygulama temasiyla
  // baslar, ama kullanici site uzerinden bagimsiz secebilir (yonetici istegi).
  const [pptxTheme, setPptxTheme] = useState(theme);

  // Login yanitindaki (bkz. Odyssey auth.js/apiClient.fetchCurrentUser -
  // su an {sicil, fullName, role, teamId} doner) "role" alanindan admin
  // durumunu, "department"tan (ileride eklenecek AD/personel entegrasyonuyla
  // gelecek - bkz. AuthUser.java) takimini cozumler. Admin her takimi
  // duzenleyebilir; digerleri SADECE kendi takimlarini (roller arasinda
  // simdilik yalnizca PO ele aliniyor) - baska bir takim secilirse asagidaki
  // canEdit false olur ve ilgili adimin parametre alani yerine ReadOnlyNotice
  // gosterilir. department henuz backend yanitinda yoksa (bkz. UserResponse.java)
  // kisitlama uygulanmaz (fail-open) - kimin hangi takimda oldugu bilinmeden
  // herkesi salt-okunura dusurmek yanlis olur.
  const currentUser = useMemo(() => {
    if (!personnel) return { teamType: null, admin: true, department: null };
    const department = personnel.department || "";
    return {
      // department BOS ise teamType da null kalir - "GENEL"e cozumlemek,
      // yukaridaki fail-open kuralini sessizce bozup (GENEL === secili tip
      // olmadigi icin) kullaniciyi salt-okunura dusururdu.
      teamType: department ? resolveTeamTypeFromDepartment(department) : null,
      admin: resolveIsAdmin(personnel),
      department,
    };
  }, [personnel]);

  // ---- Kapak (1. adim) durumu ----
  const cover = useCoverImage(ASSETS.cover_bg);
  const coverBackground = useCoverBackground();
  // Sihirbazin 4. adimi: "Velocity & Burndown Parametreleri" (kullanici
  // bildirimi 2026-08-20). Kapak gorseli/arka planiyla AYNI oturuma-ozel
  // desen - hicbir sey kaydedilmez, sadece bu oturumun onizleme/PPTX'inde
  // kullanilir.
  const velocityBurndown = useVelocityBurndown();

  // ---- Sprint (2. adim) durumu ----
  const sprintForm = useSprintForm();
  // Sunum önizlemesinde geri sayım için - Kapak adımında PO tarafından
  // girilir, diğer "content" alanlarıyla aynı şekilde kaydedilir/yüklenir.
  const [timerMinutes, setTimerMinutes] = useState(5);
  // Takim tipi -> id eslemesi icin takim listesi (acilista bir kez cekilir,
  // bkz. loadTeams). null = henuz yuklenmedi.
  const [teams, setTeams] = useState(null);

  /**
   * Kullanicinin DUZENLEYEBILECEGI takim tipleri. Kaynak, backend'in yetki
   * kontrolunde kullandigi listenin (JWT'deki teamIds - bkz.
   * PresentationFacade.requireEditAccess) ta kendisidir; boylece iki takima
   * birden bakan PO'lar (orn. Dijital Uygulamalar + CBS) her ikisini de
   * duzenleyebilir. Takim listesi/teamIds daha gelmediyse null doner ve
   * asagida tek takimlik department cozumlemesine dusulur.
   */
  const editableTeamTypes = useMemo(() => {
    if (!teams || !personnel?.teamIds?.length) return null;
    const types = new Set(teams.filter((t) => personnel.teamIds.includes(t.id)).map((t) => t.teamType));
    return types.size ? types : null;
  }, [teams, personnel]);

  const canEditTeamType = (type) => {
    if (currentUser.admin) return true;
    if (editableTeamTypes) return editableTeamTypes.has(type);
    return currentUser.teamType == null || currentUser.teamType === type;
  };
  const canEdit = canEditTeamType(sprintForm.teamType);

  // ---- Baska bir takimin sunumunu SALT-OKUNUR goruntuleme ----
  // "Takım tipi" secimi herkes icin acik (bkz. CoverPage): duzenleme yetkisi
  // OLMAYAN bir takim secilince o takimin EN SON sprint sunumu cekilip
  // onizlemeye yuklenir (okuma backend'de zaten herkese acik - bkz.
  // PresentationFacade sinif yorumu). Oncesinde secim sadece kapaktaki ismi
  // degistiriyordu, icerik kullanicinin kendi verisi olarak kaliyordu.
  // readOnlyView: {loading|empty|error|teamId,teamName,sprintNo,updatedBy,updatedAt}
  const [readOnlyView, setReadOnlyView] = useState(null);
  // Baska takima gecmeden HEMEN once alinan kendi taslagimiz - kullanici
  // kendi takimina geri dondugunde uzerine yazilan icerik geri yuklenir.
  const ownDraftRef = useRef(null);
  // Ust uste hizli takim degistirildiginde geciken yanitin guncel secimi
  // ezmemesi icin istek sayaci (yalnizca en son istek uygulanir).
  const readOnlyReqRef = useRef(0);
  // /editor/:id acilisinda KAYITLI olan icerik bolumleri - "dolu sunumun
  // uzerine bos kaydediliyor" durumunu yakalamak icin (bkz. kaydetmeUyarilari).
  const yuklenenIcerikRef = useRef(null);
  // fetchTeams sonucu (teamType -> takim id eslemesi) tek sefer cekilir.
  const teamsPromiseRef = useRef(null);
  const band = useBandEditor();
  const excel = useExcelSuggestions();
  const jiraContent = useJiraContentSuggestions();
  const [editorKey, setEditorKey] = useState(null);
  const handleSectionTextChange = (key, text) => {
    sprintForm.setSectionText(key, text);
  };

  // Excel'in "Rapor" sayfasi Hedefler bandini besleyecek gercek veriyi icerir
  // (FTE Gerçekleşen/Kalan, Canlı/Kalan Süreç Sayısı - bkz. excelParsers.js/
  // parseBandTargets). Excel yuklendiginde bulunursa bant otomatik doldurulur.
  // ...ama SADECE bandi varsayilan kullanan takimlarda (RPA, İş Zekası) -
  // bkz. teamTypes.bandAutoFills. Digerlerinde bant kendiliginden acilmaz;
  // PO isterse Hedefler bandi anahtarindan kendisi acar.
  useEffect(() => {
    if (excel.bandTargets.length && bandAutoFills(sprintForm.teamType)) {
      band.setSample(excel.bandTargets);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excel.bandTargets, sprintForm.teamType]);

  // NOT: "Jira'dan Getir" Hedefler bandina ARTIK DOKUNMAZ.
  //
  // Eskiden bu akis da bandi doldururdu (buildBandTargetsFromWorkItems) ve
  // PO'nun AYNI slaytta elle girdigi cubuklari sessizce EZIYORDU: Is Zekasi ve
  // RPA hedef cubuklarini manuel giriyor, sonra alttaki 4 karti doldurmak icin
  // "Jira'dan Getir"e basinca ustteki manuel veri kayboluyordu (kullanici
  // bildirimi 2026-09-04: "istenmeyen bir veri kaybi"). Hedefler bandi artik
  // HER takim icin yalnizca manuel/Excel kaynaklidir; "Jira'dan Getir" sadece
  // alttaki 4 icerik kartini besler.
  // ---- Kapasite Dashboard (3. adim) durumu ----
  const [dashSource, setDashSource] = useState("excel");
  // Takimin kayitli bakim/SR orani (teams.maintenance_allocation_percent,
  // varsayilan 0.2). Manuel/Jira akisi bunu zaten kisi bazinda okuyordu
  // (useManualDashboard), Excel akisi ise HIC okumuyordu: kisilerin bakimOrani
  // null kaliyor, "Bakım Hariç Kalan Kapasite" ham kapasiteye esitleniyor ve
  // Kapasite Farkı bakim dusulmeden hesaplaniyordu (bkz. useDashboardData).
  const dashTeamBakimOrani = useMemo(() => {
    const t = teams?.find((x) => x.teamType === sprintForm.teamType);
    return t?.maintenanceAllocationPercent != null ? Number(t.maintenanceAllocationPercent) : null;
  }, [teams, sprintForm.teamType]);
  const dashboard = useDashboardData(sprintForm.team, sprintForm.setTeam, sprintForm.sprint, sprintForm.setSprint, sprintForm.teamType, dashTeamBakimOrani);
  const manual = useManualDashboard(sprintForm.team, sprintForm.setTeam, sprintForm.sprint, sprintForm.setSprint, sprintForm.teamType);
  // loadedDashData: /editor/:id ile acilan kayitli bir sunumun son kaydedilen
  // dashboard KPI'lari - kullanici bu oturumda Excel yuklemedigi/manuel
  // girmedigi surece onizleme/export bunu kullanir (asagidaki hidrasyon
  // effect'i doldurur). Yeni Excel yuklenir yuklenmez dashboard.dashData
  // devreye girip bunun onune gecer.
  const [loadedDashData, setLoadedDashData] = useState(null);
  // "Kişi Bazlı Kapasite Özeti" tablosunun kolon basliklari (bkz.
  // DashboardTableHeadersEditor) - Excel/Manuel kaynagindan BAGIMSIZ, tek
  // bir yerde tutulur ve activeDashData icine gomulur ki hem onizleme hem
  // PPTX export (buildFullDeck) hem de kayit/yukleme (handleSave/
  // fetchPresentation hidrasyonu, asagida) AYNI degeri gorsun.
  const [tableHeaders, setTableHeaders] = useState(null);

  /**
   * Kayitli bir sunumun "content" bicimini (bkz. buildSaveContent) forma
   * geri yukler - hem /editor/:id acilisinda hem de baska takimin sunumu
   * salt-okunur goruntulenirken ayni yerden kullanilir.
   *
   * replace=false (varsayilan, /editor/:id): yalnizca content'te DOLU olan
   * alanlar uygulanir - eski/eksik kayitlarda form varsayilanlari korunur.
   * replace=true (takim degistirme): content NE ISE o uygulanir, eksik
   * alanlar temizlenir - onceki takimin verisi ekranda kalmasin diye.
   * applyTeamType=false: takim tipini cagiran taraf zaten belirlemistir,
   * icerikten gelen deger secimi geri almasin.
   */
  const applyContent = (c = {}, { replace = false, applyTeamType = true } = {}) => {
    if (applyTeamType && c.teamType) sprintForm.setTeamType(c.teamType);
    if (replace || c.sprint) sprintForm.setSprint(c.sprint || "");
    if (replace || c.range) sprintForm.setRange(c.range || "");
    if (replace || c.sections) {
      SECTION_KEYS.forEach((k) => sprintForm.setSectionText(k, c.sections?.[k] || ""));
    }
    if (replace || c.notes) sprintForm.setNotes(c.notes || "");
    if (replace || c.band?.bars?.length) band.setSample(c.band?.bars || []);
    // setSample(bars) show'u true yapar - kayitta gizliyse hemen geri kapatilir.
    if (c.band ? c.band.show === false : replace) band.toggleShow(false);
    if (replace || c.dashSource) { setDashSource(c.dashSource || "excel"); clearDashOverride(); }
    // Sol formu geri yukle. Uyesi olmayan anlik goruntu yok sayilir (bkz.
    // useManualDashboard.restore) - Excel/Jira kaynakli sunumlarda sol form
    // bosaltilmasin ve kayitli dashboardun onune bos bir hesap gecmesin.
    manual.restore(c.manualState);
    if (replace || c.dashData) {
      setLoadedDashData(c.dashData || null);
      setTableHeaders(c.dashData?.tableHeaders || null);
    }
    if (replace || c.timerMinutes != null) setTimerMinutes(c.timerMinutes ?? 5);
    // Velocity&Burndown gorselleri artik content'e gomulu (bkz. buildSaveContent
    // veloData yorumu) - kayitli bir sunum acilirken/baska takima gecilirken
    // geri yuklenir. restore() gorseli YENIDEN yuklemez (Dosya nesnesi yok,
    // zaten base64 olarak elde var), sadece hook state'ini doldurur.
    if (replace || c.veloData?.burndownUrl || c.veloData?.velocityUrl) {
      velocityBurndown.burndown.restore({
        url: c.veloData?.burndownUrl,
        naturalWidth: c.veloData?.burndownWidth,
        naturalHeight: c.veloData?.burndownHeight,
        zoomX: c.veloData?.burndownZoomX,
        zoomY: c.veloData?.burndownZoomY,
      });
      velocityBurndown.velocity.restore({
        url: c.veloData?.velocityUrl,
        naturalWidth: c.veloData?.velocityWidth,
        naturalHeight: c.veloData?.velocityHeight,
        zoomX: c.veloData?.velocityZoomX,
        zoomY: c.veloData?.velocityZoomY,
      });
    }
  };

  // ---- Kayitli sunum yukleme (/editor/:id) + kaydetme hedefi ----
  // Ham state'i birebir yansitan "content" sekli (bkz. plan dokumani) hem
  // hidrasyonda hem kaydetmede kullanilir - simetrik olmasi, kaydet->yukle
  // dongusunun kayipsiz calismasini saglar.
  const [presentationMeta, setPresentationMeta] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [saveStatus, setSaveStatus] = useState({ loading: false, error: null });
  // Kaydetmeden once onay istenen riskler (bkz. kaydetmeUyarilari). null =
  // sorulacak bir sey yok, kayit dogrudan yapilir.
  const [saveConfirm, setSaveConfirm] = useState(null);
  // Kapakta secili Takım Tipi'ne karsilik gelen takim (teams listesi ile
  // TEAM_TYPES 1-1 eslesir, bkz. V13__seed_teams.sql).
  const teamIdForSelectedType = useMemo(
    () => teams?.find((t) => t.teamType === sprintForm.teamType)?.id ?? null,
    [teams, sprintForm.teamType]
  );

  /**
   * Kullanicinin bu takima KAYIT yetkisi var mi? Kaynak, backend'in
   * PresentationFacade.requireEditAccess'te kullandigi listenin ta kendisi
   * (JWT'deki teamIds) - boylece frontend backend'in reddedecegi bir takima
   * kaydetmeye calismaz.
   */
  const canSaveToTeam = (id) => {
    if (id == null) return false;
    if (currentUser.admin) return true;
    const izinli = personnel?.teamIds?.length
      ? personnel.teamIds
      : personnel?.teamId != null ? [personnel.teamId] : [];
    return izinli.includes(id);
  };

  /**
   * YENI bir sunum hangi takima kaydedilecek?
   *
   * Eskiden son care olarak DOGRUDAN personnel.teamId (PO'nun BIRINCIL takimi)
   * kullaniliyordu. Iki-uc takima birden bakan PO'larda bu, kapakta secilen
   * Takım Tipi ne olursa olsun her sunumu birincil takima yaziyordu; sunumlar
   * (team_id, sprint_no) ile tekil oldugu icin ikinci takimin ayni numarali
   * sprinti birincisinin UZERINE yaziliyordu (kullanici bildirimleri
   * 2026-08-25: "DU sprint 10'u ezdi ve üzerine yazdı", "mobili dijital
   * uygulamaların içerisine attı").
   */
  /**
   * "Uzerinde calisilan sunum" - presentationMeta, SADECE kapakta secili takim
   * hala o sunumun takimiysa gecerlidir.
   *
   * NEDEN: presentationMeta her basarili kayittan sonra (ve /editor/:id ile
   * acilista) doluyor, ama kapaktan BASKA bir takim tipi secildiginde
   * temizlenmiyordu. Iki takima bakan bir PO "DU Sprint 4"u kaydedip ardindan
   * takim tipini CBS yapip tekrar kaydettiginde, kayit yine DU'nun sunumuna
   * YENI SURUM olarak yaziliyordu (kullanici bildirimi 2026-08-25: "kaydoldu
   * diyor v4 olarak ama sunumlarima cikmiyor"). Daha kotusu
   * autoSaveOnNavigate, adim degistirir degistirmez ayni sunumu YERINDE
   * (surum bile eklemeden) CBS icerigiyle eziyordu.
   */
  const aktifSunum =
    presentationMeta && (teamIdForSelectedType == null || presentationMeta.teamId === teamIdForSelectedType)
      ? presentationMeta
      : null;

  /**
   * YENI bir sunum hangi takima kaydedilecek?
   *
   * Eskiden son care olarak DOGRUDAN personnel.teamId (PO'nun BIRINCIL takimi)
   * kullaniliyordu. Iki-uc takima birden bakan PO'larda bu, kapakta secilen
   * Takım Tipi ne olursa olsun her sunumu birincil takima yaziyordu; sunumlar
   * (team_id, sprint_no) ile tekil oldugu icin ikinci takimin ayni numarali
   * sprinti birincisinin UZERINE yaziliyordu (kullanici bildirimleri
   * 2026-08-25: "DU sprint 10'u ezdi ve üzerine yazdı", "mobili dijital
   * uygulamaların içerisine attı").
   */
  // Zaman Disi Fayda penceresi (ust cubuktaki buton) - kazanim sureci
  // sayilari dis panoya buradan gider (bkz. BenefitsModal).
  const [benefitsOpen, setBenefitsOpen] = useState(false);

  const saveTeamId =
    aktifSunum?.teamId ??
    (canSaveToTeam(teamIdForSelectedType) ? teamIdForSelectedType : null) ??
    newForTeamId ??
    personnel?.teamId ??
    null;
  // "Tamamlanan İşler" kutusundaki Epic-label filtresi icin (bkz.
  // jiraContentMapper.js epicLabeledWithOwnTeam, kullanici teyidi 2026-08-20) -
  // takimin Jira proje anahtari (orn. "RPA") teams listesinden okunur.
  const saveTeamJiraProjectKey = teams?.find((t) => t.id === saveTeamId)?.jiraProjectKey ?? null;

  // "Jira'dan" sekmesi: DB'de zaten senkronize edilmis (bkz. "Jira'dan Çek")
  // veriyi okur - saveTeamId gerektigi icin bu hook, onun hesaplanmasindan
  // SONRA cagrilir (hook cagri SIRASI her render'da ayni oldugu surece
  // fonksiyon govdesindeki konumu onemli degil).
  const jiraDash = useJiraDashboard(sprintForm.team, sprintForm.setTeam, sprintForm.sprint, sprintForm.setSprint, saveTeamId, sprintForm.teamType, sprintForm.setRange);
  // Sektor (ops.) dropdown'u saveTeamId'YE DEGIL, o an KAPAKTA secili Takım
  // Tipi'ne gore olmali (teamIdForSelectedType - yukarida tanimli) - saveTeamId
  // (kaydedilecek sunumun kimligi) henuz bir sunum yuklenmemis/kaydedilmemisse
  // eski/boş kalabiliyor, bu durumda kapakta "Ürün Geliştirme" secili olsa bile
  // sektor listesi baska bir takima (veya hicbirine) ait cekilip eski sabit
  // listeye duseriyordu (bkz. kullanici bildirimi, 2026-08-18: "EDAŞ ...
  // gözükmüyor" - PO henuz bir sunum yuklemeden sadece Takım Tipi'ni
  // degistirerek test ediyordu).
  const sectorOptions = useSectorOptions(teamIdForSelectedType);

  // Baska takimi salt-okunur goruntulerken SADECE o sunumun kayitli
  // dashboard'u gosterilir - aksi halde kullanicinin bu oturumda yukledigi
  // Excel/manuel/Jira verisi (dashboard.dashData) baska takimin slaydina sizardi.
  const viewingOtherTeam = !canEdit && readOnlyView != null;
  //
  // HER kaynak icin son care KAYITLI dashboard'dur (loadedDashData). Eskiden
  // bu yedek SADECE excel dalinda vardi; manuel/Jira kaynakli kayitli bir sunum
  // acildiginda (sol formun durumu geri yuklenmedigi icin manual.dashData /
  // jiraDash.dashData null kalir) Kapasite Dashboard BOS goruluyordu - oysa
  // kayitta veri duruyordu. PO bu haldeyken "Kaydet"e basarsa BOS dashboard
  // yeni surum olarak yazilir ve o surumdeki veri kaybolur (kullanici bildirimi
  // 2026-08-26, Gözde Son: "sunumlarim kisminda duzenleye basinca dashboard
  // kayboluyor, sonra bos kaydediliyor").
  const activeDashDataBase = viewingOtherTeam
    ? loadedDashData
    : dashSource === "manual"
      ? (manual.dashData || loadedDashData)
      : dashSource === "jira"
        ? (jiraDash.dashData || loadedDashData)
        : (dashboard.dashData || loadedDashData);

  // Canlı önizlemedeki "Düzenle" ekraninin (DashboardEditModal) uzerine
  // yazdigi GECICI kaplama - gercek work_items/team_members'i DEGISTIRMEZ,
  // sadece bu sunumun kaydedilecek versiyonuna (buildSaveContent -> dashData)
  // yansir (bkz. kullanici bildirimi 2026-08-17: "bu değişiklikler sadece
  // versiyon tablosuna kaydedilsin").
  //
  // Sekli { data, baseNames } - baseNames, "Uygula"ya basildigi ANDA tabanda hangi
  // kisilerin bulundugunu tutar; rotusta olup tabanda olmayan bir kisinin
  // Düzenle icinden EKLENDIGINI mi yoksa sol formdan SILINDIGINI mi ayirt
  // etmek icin gerekir (bkz. mergeDashOverride).
  const [dashDataOverride, setDashDataOverride] = useState(null);

  /**
   * "Düzenle" rotuslarini TAMAMEN siler - yalnizca kullanicinin BILINCLI
   * olarak veri kaynagini tazeledigi anlarda cagrilir: yeni Excel
   * yuklendiginde, Jira'dan cekildiginde, veri kaynagi sekmesi degistiginde
   * ve kayitli baska bir sunum acildiginda. Sol formdaki siradan
   * duzenlemeler rotusu SILMEZ, uzerine BIRLESIR (bkz. mergeDashOverride).
   *
   * ESKIDEN bu bir effect'ti ve activeDashDataBase her DEGISTIGINDE
   * tetikleniyordu. Manuel Gir'de her tus vurusundan 700 ms sonra otomatik
   * hesaplama calistigi icin (bkz. useManualDashboard AUTO_COMPUTE_DEBOUNCE_MS)
   * bu, PO'nun Düzenle'de girdigi butun degerleri sol formdaki TEK bir harf
   * yuzunden - hatta baska bir kisinin alanina yazsa bile - siliyordu
   * (kullanici bildirimleri 2026-08-26: "manuel kişi ekleme yaparken habire
   * siliniyor", "evet siliniyor").
   */
  const clearDashOverride = () => setDashDataOverride(null);

  // Rotus tabani EZMEZ, tabanla BIRLESIR: kim var sorusunun cevabi tabandan
  // (sol formdan eklenen yeni kisi slayta duser), o kisinin degerleri ise
  // rotustan gelir (PO nun girdigi rakamlar sol formdaki degisiklikle
  // silinmez). Ayrintili gerekce icin bkz. lib/dashOverride.mergeDashOverride.
  const effectiveDashDataBase = useMemo(
    () => mergeDashOverride(activeDashDataBase, dashDataOverride, dashTeamBakimOrani),
    [activeDashDataBase, dashDataOverride, dashTeamBakimOrani],
  );
  // Henuz hicbir veri kaynagi hesaplanmamisken (Manuel Gir'de "Hesapla"
  // basilmadi, Excel yuklenmedi vb. - effectiveDashDataBase null) ESKIDEN
  // tableHeaders BURADA tamamen kaybediliyordu (asagidaki satir hicbir sey
  // dondurmuyordu, DashboardSlideCanvas'a bos obje gidiyordu) - kullanici
  // "Kişi Tablosu Başlıkları"nı degistirse bile onizlemede hicbir zaman
  // gorulmuyordu (kullanici bildirimi 2026-08-24: "manuel girmede kişi
  // tablosu başlıkları çalışmıyor ... previewda göremiyorum"). tableHeaders
  // varsa, veri henuz yokken de EN AZINDAN o alani tasiyan bir nesne
  // dondurulur ki DashboardSlideCanvas'in "veri yok" dalinda (emptyDashData +
  // dd.tableHeaders) baslikları görsün.
  const activeDashData = effectiveDashDataBase
    ? { ...effectiveDashDataBase, tableHeaders }
    : tableHeaders
      ? { tableHeaders }
      : effectiveDashDataBase;

  // "Jira'dan Çek" - backend'e senkronizasyon istegini tetikler (arka plan
  // isleyicisine devredilir - bkz. JiraSyncProcessor / JiraSyncAsyncConfig).
  // Bu yuzden istek BASARILI kabul edildiginde bile veriler o an degil,
  // birkac saniye icinde guncellenir; kullaniciya bunu acikca belirtiyoruz.
  const [jiraSyncing, setJiraSyncing] = useState(false);
  const [jiraSyncNotice, setJiraSyncNotice] = useState(null); // { type: "success" | "error", text }
  // Senkronizasyon backend'de ASENKRON islendigi icin "tamamlandi" sinyali
  // yok - bu yuzden istek kabul edildikten SONRA sabit bir sure (backend.in
  // isi bitirmesi icin makul bir tahmin) beklenip Kapasite Dashboard'un
  // "Jira'dan" sekmesi (jiraDash.refresh) VE İçerik Slaytı'nin HEDEFLER/
  // oneri cubuklari (jiraContent.fetchFromJira) OTOMATIK yenilenir - eskiden
  // ikisi de kullanicinin ayri ayri elle "Yenile"/"Jira'dan Getir" basmasini
  // gerektiriyordu (bkz. kullanici bildirimi, 2026-08-17: "jira dan çek
  // tuşuna basıldığı anda içerik slaytı ile kapasite dashboard sayfası
  // otomatik jiradan çekmesi lazım").
  const JIRA_SYNC_AUTO_REFRESH_DELAY_MS = 4000;
  const handleJiraSync = () => {
    if (!saveTeamId) {
      setJiraSyncNotice({ type: "error", text: "Jira'dan çekebilmek için önce bir takım seçili olmalı." });
      return;
    }
    // Excel yuklerken YAPILANIN AYNISI (bkz. handleExcelFile) - onceden Excel'den
    // (veya elle) doldurulmus icerik bolumleri, "Jira'dan Çek" ile gelecek YENİ
    // verinin ustune eski/yanlis bir sekilde binmesin diye temizlenir. Bu
    // olmadan kullanici Excel yukleyip "Jira'dan Çek"e bassa bile İçerik
    // Slaytı'nda hala ESKİ Excel metni kalıyordu - kullanici Jira oneri
    // cip'lerini ekleyene kadar hicbir sey degismemis GİBİ gorunuyordu (bkz.
    // kullanici bildirimi 2026-08-20: "içerik slaytında hala excel verisi
    // kalıyor jiradan çekmeliydi").
    // NOT: Eskiden burada icerik slayty maddeleri (sections) TEMIZLENIYORDU
    // (kullanici bildirimi 2026-08-20: yeni kaynak yuklenince eski metin
    // kalmasin). Ama bu, PO nun İçerik Slaytina ELLE yazdigi maddeleri de
    // siliyordu: Ece Hanim 4 karti doldurup Kapasite Dashboardda Excel
    // yukleyince/Jira cekince butun icerik ucup gidiyordu (kullanici bildirimi
    // 2026-09-02). Icerik slayty ile kapasite kaynagi (Excel/Jira/Manuel)
    // BAGIMSIZ verilerdir - kapasite kaynagi degisince icerik maddeleri artik
    // KORUNUR; PO isterse maddeleri elle temizler.
    setJiraSyncing(true);
    setJiraSyncNotice(null);
    // jiraProjectKey burada gonderilmiyor - backend, takima kayitli varsayilani
    // (Team.jiraProjectKey, bkz. V18__teams_add_jira_config.sql) kullanir; takimda
    // da tanimli degilse (orn. CBS) backend acik bir hata mesajiyla 400 doner
    // (bkz. JiraSyncController.resolveProjectKey) ve o mesaj asagida gosterilir.
    triggerJiraSync(saveTeamId, {})
      .then(() => {
        setJiraSyncNotice({
          type: "success",
          text: "Jira senkronizasyonu başlatıldı — veriler birkaç saniye içinde otomatik güncellenecek.",
        });
        setTimeout(() => {
          clearDashOverride(); // Jira'dan taze veri geldi
          jiraDash.refresh();
          jiraContent.fetchFromJira(saveTeamId, saveTeamJiraProjectKey);
        }, JIRA_SYNC_AUTO_REFRESH_DELAY_MS);
      })
      .catch((err) => {
        setJiraSyncNotice({ type: "error", text: err?.message || "Jira senkronizasyonu başlatılamadı." });
      })
      .finally(() => setJiraSyncing(false));
  };

  // NOT: Excel kaynaginda sirket tatilleri ARTIK otomatik uygulanmaz.
  //
  // Eskiden burada bir effect vardi: Excel yuklenince sirket takvimindeki
  // tatil gunleri (SIRKET_TATILI) her kisiye izin kaydi olarak yazilip
  // kapasiteden dusuluyordu. Ama Excel'in "Kalan İş Günü" degeri bu gunleri
  // ZATEN dusuyor (145 gunluk "Şirket İş Günü" parametresinden hesaplaniyor;
  // kisisel izinler de Excel'in kendi "İzin" kolonunda). Yani ayni gunler iki
  // kez dusuluyordu: Is Zekasi 4. sprintte kapasite 94 yerine 87, Kapasite
  // Farkı -170,05 yerine -198,10 cikiyordu (kullanici bildirimi 2026-08-26,
  // PO'nun Excel'i ve yayimlanan sunumuyla karsilastirilarak dogrulandi).
  //
  // "Manuel Gir" kaynagindaki otomatik ekleme YERINDE DURUYOR (bkz.
  // MemberCard.jsx) - orada kapasite Excel'den gelmedigi icin cifte dusum
  // sozkonusu degil. Excel modunda PO elle "İzin Ekle" ile izin girerse o
  // izin kapasiteden dusulmeye devam eder.

  useEffect(() => {
    if (!presentationId) {
      yuklenenIcerikRef.current = null; // yeni sunum - kiyaslanacak eski icerik yok
      return;
    }
    setLoadError(null);
    fetchPresentation(presentationId)
      .then((p) => {
        applyContent(p.content || {});
        // Acilista KAYITLI olan icerik saklanir: dolu bir sunumun uzerine bos
        // kaydedilmek uzereyse PO uyarilir (bkz. kaydetmeUyarilari). Sadece
        // kiyaslama icin tutulur, forma etkisi yoktur.
        yuklenenIcerikRef.current = p.content?.sections || null;
        setPresentationMeta({ id: p.id, teamId: p.teamId, sprintNo: p.sprintNo, currentVersion: p.currentVersion, finalizedAt: p.finalizedAt, finalizedBy: p.finalizedBy });
      })
      .catch((err) => setLoadError(err?.message || "Sunum yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentationId]);

  // Sihirbaz BOS acildiginda (yeni sunum) kapaktaki "Sprint no", takimin
  // kayitli EN SON sunumunun sprintinin bir fazlasiyla doldurulur - onceden
  // useSprintForm'daki sabit "7" geliyordu ve PO her seferinde elle
  // duzeltiyordu (bkz. kullanici bildirimi, 2026-08-21).
  //
  // - /editor/:id ile ACILAN bir sunumda calismaz: oradaki sprint no kaydin
  //   kendisidir, ustune yazilamaz (presentationId kontrolu).
  // - Kullanici alani elle degistirdikten sonra da calismaz (sprintDefaultedRef
  //   ile takim basina TEK SEFER).
  // - Istek basarisiz olursa/takimin hic sunumu yoksa mevcut deger korunur ya
  //   da "1"e duser - alan HICBIR ZAMAN bos birakilmaz (backend @NotBlank
  //   bekliyor, CoverPage de bos degeri "sayi olmali" uyarisiyla reddediyor).
  // - "Jira'dan Çek/Yenile" sonrasi Jira'nin GERCEK aktif sprinti bu
  //   varsayilanin onune gecer (bkz. useJiraDashboard.refresh) - kasitli.
  const sprintDefaultedRef = useRef(null);
  useEffect(() => {
    if (presentationId || !saveTeamId) return;
    if (sprintDefaultedRef.current === saveTeamId) return;
    sprintDefaultedRef.current = saveTeamId;
    fetchPresentations(saveTeamId)
      .then((list) => {
        // Istek ucustayken kullanici baska bir takima gectiyse gec gelen
        // yaniti uygulama (ayni desen: readOnlyReqRef).
        if (sprintDefaultedRef.current !== saveTeamId) return;
        sprintForm.setSprint(nextSprintNo(list));
      })
      .catch(() => {
        // Sessizce mevcut varsayilanla devam - sprint no'yu okuyamamak
        // sihirbazi bloke etmemeli.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentationId, saveTeamId]);

  const buildSaveContent = () => ({
    teamType: sprintForm.teamType,
    sprint: sprintForm.sprint,
    range: sprintForm.range,
    sections: sprintForm.sections,
    notes: sprintForm.notes,
    band: { show: band.show, bars: band.bars },
    dashSource,
    dashData: activeDashData,
    // Manuel Girdeki SOL FORMUN girdileri (uyeler, is kalemleri, donem,
    // rapor tarihi, bakim orani, ek gostergeler). Eskiden sadece hesaplanmis
    // SONUC (dashData) kaydediliyordu; girdiler kaydedilmedigi icin sunum
    // yeniden acildiginda sol form bos geliyordu - bkz.
    // useManualDashboard.snapshot yorumundaki kullanici bildirimleri.
    manualState: manual.snapshot(),
    timerMinutes,
    // Eskiden "oturuma ozel" olup HICBIR ZAMAN kaydedilmiyordu (bkz.
    // useVelocityBurndown.js) - bu yuzden Ortak Sunum baska bir PO'nun
    // kaydettigi sunumu cekince Velocity&Burndown gorseli hicbir yerde
    // saklı degildi, gosterilecek bir sey yoktu (kullanici bildirimi,
    // 2026-08-21: "velocity&burndown sayfası gelmiyor... ortak sunumdada
    // görmek istiyorum"). Gorseller kucuk (birkac yuz KB base64) oldugu
    // icin dashData/sections ile AYNI yontemle content'e gomuluyor.
    veloData: {
      burndownUrl: velocityBurndown.burndown.url,
      burndownWidth: velocityBurndown.burndown.naturalWidth,
      burndownHeight: velocityBurndown.burndown.naturalHeight,
      burndownZoomX: velocityBurndown.burndown.zoomX,
      burndownZoomY: velocityBurndown.burndown.zoomY,
      velocityUrl: velocityBurndown.velocity.url,
      velocityWidth: velocityBurndown.velocity.naturalWidth,
      velocityHeight: velocityBurndown.velocity.naturalHeight,
      velocityZoomX: velocityBurndown.velocity.zoomX,
      velocityZoomY: velocityBurndown.velocity.zoomY,
    },
  });

  const loadTeams = () => {
    if (!teamsPromiseRef.current) {
      teamsPromiseRef.current = fetchTeams()
        .then((list) => {
          setTeams(list);
          return list;
        })
        // hata durumunda cache'i bosalt ki sonraki secim tekrar denesin
        .catch((err) => {
          teamsPromiseRef.current = null;
          throw err;
        });
    }
    return teamsPromiseRef.current;
  };

  // Takim listesi acilista bir kez cekilir - hem duzenleme yetkisi
  // cozumlemesi (editableTeamTypes) hem de salt-okunur goruntuleme
  // (loadTeamPresentation) ayni listeyi kullanir.
  useEffect(() => {
    loadTeams().catch(() => setTeams([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Secilen takim tipinin EN SON sprint sunumunu cekip onizlemeye salt-okunur yukler. */
  const loadTeamPresentation = async (type) => {
    const reqId = ++readOnlyReqRef.current;
    const isStale = () => readOnlyReqRef.current !== reqId;
    setReadOnlyView({ loading: true });
    try {
      const teamList = await loadTeams();
      if (isStale()) return;
      // Ayni tipte birden fazla takim tanimliysa ilki kullanilir - takim
      // tipi (TEAM_TYPES) ile teams tablosu 1-1 eslesecek sekilde kurgulanmis
      // durumda (bkz. V13__seed_teams.sql).
      const team = teamList.find((t) => t.teamType === type);
      if (!team) {
        applyContent(EMPTY_CONTENT, { replace: true, applyTeamType: false });
        setReadOnlyView({ empty: true });
        return;
      }
      const list = await fetchLatestPresentationsByTeams([team.id]);
      if (isStale()) return;
      const p = list?.[0];
      if (!p) {
        applyContent(EMPTY_CONTENT, { replace: true, applyTeamType: false });
        setReadOnlyView({ empty: true, teamId: team.id, teamName: team.name });
        return;
      }
      applyContent(
        // sprint no/tarih araligi sunum satirindan da gelir - eski kayitlarda
        // content icinde bos olabilir, bu durumda kolon degerleri kullanilir.
        { ...(p.content || {}), sprint: p.content?.sprint || p.sprintNo || "", range: p.content?.range || p.dateRange || "" },
        { replace: true, applyTeamType: false }
      );
      setReadOnlyView({
        teamId: team.id, teamName: team.name, sprintNo: p.sprintNo, dateRange: p.dateRange,
        version: p.currentVersion, updatedBy: p.updatedBy, updatedAt: p.updatedAt,
      });
    } catch (err) {
      if (isStale()) return;
      applyContent(EMPTY_CONTENT, { replace: true, applyTeamType: false });
      setReadOnlyView({ error: err?.message || "Takımın sunumu yüklenemedi." });
    }
  };

  /**
   * Kapak adimindaki "Takım tipi" secimi. Duzenleyemedigimiz bir takim
   * secilirse o takimin sunumu salt-okunur yuklenir; kendi takimimiza geri
   * donuldugunde ise uzerine yazilan kendi taslagimiz geri getirilir.
   */
  const handleTeamTypeChange = (nextType) => {
    if (nextType === sprintForm.teamType) return;
    const wasEditable = canEditTeamType(sprintForm.teamType);
    const nextEditable = canEditTeamType(nextType);
    sprintForm.setTeamType(nextType);

    if (nextEditable) {
      readOnlyReqRef.current++; // ucusta olan salt-okunur yukleme varsa gecersiz kil
      setReadOnlyView(null);
      if (!wasEditable && ownDraftRef.current) {
        applyContent(ownDraftRef.current, { replace: true, applyTeamType: false });
        ownDraftRef.current = null;
      }
      return;
    }
    if (wasEditable) ownDraftRef.current = buildSaveContent();
    loadTeamPresentation(nextType);
  };

  // Sihirbaz bos acildiginda (yeni sunum) takim tipi kullanicinin KENDI
  // takimiyla baslar - aksi halde useSprintForm varsayilani ("RPA") yuzunden
  // PO'lar kendi takimlarindan baskasinin ekraninda, dogrudan salt-okunur
  // aciliyordu. /editor/:id ve /editor/new?teamId= akislarinda takim zaten
  // sunumdan/parametreden belirlenir, dokunulmaz.
  const teamTypeDefaultedRef = useRef(false);
  useEffect(() => {
    if (teamTypeDefaultedRef.current || presentationId || newForTeamId) return;
    if (currentUser.admin || !currentUser.teamType || currentUser.teamType === "GENEL") return;
    teamTypeDefaultedRef.current = true;
    sprintForm.setTeamType(currentUser.teamType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.admin, currentUser.teamType, presentationId, newForTeamId]);

  // "Sunum süresi" kaydetmek için zorunlu (bkz. CoverPage bilgi notu) -
  // önizleme geri sayımının anlamlı bir baslangic degeri olmadan
  // kaydedilememesi icin; kullanici sonrasinda istedigi an degistirip
  // tekrar kaydedebilir, tek seferlik bir kilit degil.
  const validateBeforeSave = () => {
    if (!saveTeamId) {
      setWizardAlert("Kaydetmek için bir takım belirlenemedi.");
      return false;
    }
    if (!sprintForm.sprint.trim()) {
      setWizardAlert("Kaydetmek için Sprint No boş bırakılamaz.");
      return false;
    }
    if (!Number(timerMinutes) || Number(timerMinutes) <= 0) {
      setWizardAlert("Kaydetmek için Kapak adımında Sunum Süresi (dakika) girilmelidir.");
      return false;
    }
    return true;
  };

  /**
   * Kaydetmeden ONCE kullaniciya sorulacak riskler. Hicbirini ENGELLEMEZ,
   * yalnizca onay ister - Gozde'nin Sprint 10/11 sunumlarinin icerik
   * kartlarinin bos bir surumle ezilmesi uzerine eklendi (kullanici
   * bildirimi 2026-09-07). Liste bos donerse kayit dogrudan yapilir,
   * yani eskisi gibi calisir.
   */
  const kaydetmeUyarilari = async () => {
    const uyarilar = [];

    // 1) DOLU bir sunumun uzerine BOS icerik kaydediliyor mu?
    //    Not: "icerik bos" tek basina uyari sebebi DEGIL - kayitli sunumlarin
    //    yarisi (33'te 14) zaten bos icerikle duruyor, sadece kapasite
    //    dashboard'u icin kullaniliyor; her kayitta uyari cikmasi PO'yu
    //    bogardi. Yalnizca ACILISTA DOLU olan icerik bosalmissa uyarilir.
    const bosIcerik = SECTION_KEYS.every((k) => !String(sprintForm.sections[k] || "").trim());
    const acilistaDoluydu =
      !!yuklenenIcerikRef.current &&
      SECTION_KEYS.some((k) => String(yuklenenIcerikRef.current[k] || "").trim());
    if (bosIcerik && acilistaDoluydu) {
      uyarilar.push(
        "Bu sunum açılırken içerik kartları DOLUYDU, şu an dördü de boş " +
          "(Tamamlanan İşler, Yapılacak İşler, Riskler, Bekleyen Konular). " +
          "Kaydedersen içerik slaytı boş bir sürümle güncellenir."
      );
    }

    // 2) "+ Yeni Sunum" akisinda ayni sprint no zaten kayitli mi?
    //    Backend id=null geldiginde ayni (takim, sprint) kaydini bulup
    //    UZERINE sessizce yeni bir surum yaziyor (bkz.
    //    PresentationService.upsert - id!=null yolunda 409 korumasi VAR,
    //    id==null yolunda YOK). Kullaniciya burada haber verilir.
    if (!aktifSunum && saveTeamId && sprintForm.sprint.trim()) {
      try {
        const mevcut = await fetchPresentations(saveTeamId);
        const ayni = (mevcut || []).find(
          (p) => String(p.sprintNo).trim() === sprintForm.sprint.trim()
        );
        if (ayni) {
          uyarilar.push(
            `Bu takımda "Sprint ${ayni.sprintNo}" zaten kayıtlı (şu an v${ayni.currentVersion}). ` +
              "Kaydedersen o sunumun ÜZERİNE yeni bir sürüm yazılır."
          );
        }
      } catch {
        // Liste alinamadiysa uyari uretemeyiz - kaydetmeyi ENGELLEMEYIZ,
        // davranis eskisiyle ayni kalir.
      }
    }

    return uyarilar;
  };

  const handleSave = async () => {
    if (!validateBeforeSave()) return;
    const uyarilar = await kaydetmeUyarilari();
    if (uyarilar.length > 0) {
      setSaveConfirm(uyarilar);
      return;
    }
    await kaydetmeyiYap();
  };

  const kaydetmeyiYap = async () => {
    setSaveConfirm(null);
    setSaveStatus({ loading: true, error: null });
    try {
      const saved = await savePresentation({
        // Mevcut bir sunum duzenleniyorsa onun id sini gonder - sprint no
        // degistirilip kaydedilince yeni kart cikip "cokluyordu"; artik ayni
        // kayit RENAME edilir (kullanici bildirimi 2026-09-01). Yeni sunumda
        // aktifSunum null, id gitmez, eski davranis.
        id: aktifSunum?.id ?? null,
        teamId: saveTeamId, sprintNo: sprintForm.sprint, dateRange: sprintForm.range, content: buildSaveContent(),
      });
      setPresentationMeta({ id: saved.id, teamId: saved.teamId, sprintNo: saved.sprintNo, currentVersion: saved.currentVersion, finalizedAt: saved.finalizedAt, finalizedBy: saved.finalizedBy });
      setSaveStatus({ loading: false, error: null });
    } catch (err) {
      setSaveStatus({ loading: false, error: err?.message || "Kaydedilemedi." });
    }
  };

  // "Güncelle": Ortak Sunum ekranindan (?fromJoint=1) gelindiginde gosterilir
  // - handleSave'in aksine YENI bir surum EKLEMEZ, mevcut guncel surumu
  // YERINDE degistirir (bkz. apiClient.updatePresentationInPlace).
  /**
   * "Sunumum Hazır" / "Hazır İşaretini Kaldır".
   *
   * Ortak sunumun tetiklenmesi icin gereken isaret (bkz. backend V33). Yeni
   * SURUM OLUSTURMAZ ve icerigi degistirmez; sadece durum degisir. Isaret
   * revizyonda dusmedigi icin PO isaretledikten sonra sunumunu guncellemeye
   * devam edebilir (Gözde karari 2026-09-09).
   */
  const [finalizing, setFinalizing] = useState(false);
  const handleToggleFinalized = async () => {
    if (!aktifSunum?.id) return;
    const hedef = !aktifSunum.finalizedAt;
    setFinalizing(true);
    setSaveStatus({ loading: false, error: null });
    try {
      const saved = await setPresentationFinalized(aktifSunum.id, hedef);
      setPresentationMeta((m) => (m ? { ...m, finalizedAt: saved.finalizedAt, finalizedBy: saved.finalizedBy } : m));
    } catch (err) {
      setSaveStatus({ loading: false, error: err?.message || "Hazır işareti güncellenemedi." });
    } finally {
      setFinalizing(false);
    }
  };

  const handleUpdateInPlace = async () => {
    if (!aktifSunum?.id) return;
    if (!validateBeforeSave()) return;
    setSaveStatus({ loading: true, error: null });
    try {
      const saved = await updatePresentationInPlace(aktifSunum.id, sprintForm.range, buildSaveContent());
      setPresentationMeta({ id: saved.id, teamId: saved.teamId, sprintNo: saved.sprintNo, currentVersion: saved.currentVersion, finalizedAt: saved.finalizedAt, finalizedBy: saved.finalizedBy });
      setSaveStatus({ loading: false, error: null });
    } catch (err) {
      setSaveStatus({ loading: false, error: err?.message || "Güncellenemedi." });
    }
  };

  // Kapak + icerik + kapasite dashboard'u TEK pptx olarak indiren, sihirbazin
  // her adimindan erisilebilen ortak export (bkz. buildFullDeck).
  const fullExport = usePptxExport();

  // ---- Birlesik onizleme (kapak / icerik / kapasite dashboard) ----
  const [previewTab, setPreviewTab] = useState("cover");
  const [zoomOpen, setZoomOpen] = useState(false);
  // "Düzenle" (DashboardEditModal) - sadece Kapasite Dashboard sekmesinde
  // anlamli, bkz. UnifiedPreviewPane onEdit prop'u.
  const [dashEditOpen, setDashEditOpen] = useState(false);
  // "PPTX İndir"e basildiginda dosya HEMEN inmez - once bu onizleme popup'u
  // acilir (tema secenegiyle), kullanici gozden gecirip asil indirmeyi
  // popup icindeki butonla onaylar (bkz. ExportPreviewModal).
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false);

  // Sihirbaz adimi (mode) degistiginde onizleme sekmesi de otomatik esler -
  // "Kapak Sayfasi" adimina gecince onizleme de kapak gorselini (logo + ag deseni)
  // gostersin, kullanici ayrica sekme tiklamak zorunda kalmasin.
  const MODE_TO_PREVIEW_TAB = { cover: "cover", sprint: "content", dash: "dashboard", velocity: "velocity" };
  // 4 adimli sihirbazin sirasi - "İleri"/"Geri" butonlari ve dolayli
  // atlamalar (orn. adimlar arasi tikla-git) bu diziye gore hesaplanir.
  const WIZARD_MODES = ["cover", "sprint", "dash", "velocity"];
  const WIZARD_STEP_LABELS = {
    cover: "Kapak Sayfası", sprint: "İçerik Slaytı", dash: "Kapasite Dashboard", velocity: "Velocity & Burndown",
  };
  const [wizardAlert, setWizardAlert] = useState(null);

  // Sayfa gecislerinde (Ileri/Geri veya adima dogrudan tiklama) uzerinde
  // calisilan surumu sessizce gunceller - kullanici bildirimi: "her sayfayı
  // geçtiğimizde kullanıcının üstünde çalıştığı versiyon auto save
  // kaydedilsin". handleUpdateInPlace'in aksine dogrulama/alert GOSTERMEZ ve
  // sayfa gecisini BEKLEMEZ (fire-and-forget) - eksik/gecersiz veri varsa
  // sessizce atlanir, kullanici "Guncelle" butonuyla elle tekrar deneyebilir.
  // Henuz hic kaydedilmemis (presentationMeta yok) bir sunumda calismaz -
  // her adim gecisinde YENI bir surum OLUSTURMAZ, sadece VAR OLANI gunceller.
  const autoSaveOnNavigate = () => {
    if (!canEdit || !aktifSunum?.id || !saveTeamId) return;
    updatePresentationInPlace(aktifSunum.id, sprintForm.range, buildSaveContent())
      .then((saved) => {
        setPresentationMeta({ id: saved.id, teamId: saved.teamId, sprintNo: saved.sprintNo, currentVersion: saved.currentVersion, finalizedAt: saved.finalizedAt, finalizedBy: saved.finalizedBy });
      })
      .catch(() => {
        // Sessiz basarisizlik - navigasyonu engellemez.
      });
  };

  const changeMode = (newMode) => {
    if (mode === "cover" && newMode !== "cover" && canEdit && !sprintForm.sprint.trim()) {
      setWizardAlert("Sprint No boş bırakılamaz.");
      return;
    }
    if (newMode !== mode) autoSaveOnNavigate();
    setMode(newMode);
    setPreviewTab(MODE_TO_PREVIEW_TAB[newMode]);
  };

  // Kapak gorseli kullanicidan gelmisse ASSETS'in uzerine yazilir - SlideCanvas,
  // DashboardSlideCanvas ve buildFullDeck bunu degistirmeden ayni sekilde tuketir.
  const assets = { ...ASSETS, cover_bg: cover.coverBg, slide_bg: coverBackground.bg };
  const SEC = sectionDefs(assets);

  // Excel yukleme tek bir kaynaktan gelir: hangi sayfadan yuklenirse yuklensin
  // (Sprint veya Kapasite Dashboard), ayni dosya HER IKI sayfayi da besler -
  // standart "Kapasite Takip" dosyasi hem Is_Listesi/Parametreler hem de
  // Rapor/Kapasite sayfalarini bir arada icerir.
  const [excelFileName, setExcelFileName] = useState(null);
  // Excel'in "Parametreler" sayfasindan (Takım Adı/FTE izleri, Rapor Tarihi,
  // Sprint No) okunan takim tipi/sprint no/tarih araligi, sihirbazdaki ilgili
  // alanlari otomatik gunceller - kullanicinin ayni bilgiyi iki kez (bir Excel'e
  // bir de "Ekip adı"/"Sprint no" alanlarina) girmesine gerek kalmaz.
  const applyExcelMeta = ({ teamType, sprintNo, range } = {}) => {
    if (teamType) sprintForm.setTeamType(teamType);
    if (sprintNo) sprintForm.setSprint(sprintNo);
    if (range) sprintForm.setRange(range);
  };
  const handleExcelFile = (file) => {
    // Daha once elle girilmis olabilecek veri (icerik bolumleri + kapasite
    // manuel giris) yeni yuklenen Excel'in verisiyle CELISMESIN/karisik
    // gorunmesin diye temizlenir - bkz. kullanici bildirimi.
    // NOT: Eskiden burada icerik slayty maddeleri (sections) TEMIZLENIYORDU
    // (kullanici bildirimi 2026-08-20: yeni kaynak yuklenince eski metin
    // kalmasin). Ama bu, PO nun İçerik Slaytina ELLE yazdigi maddeleri de
    // siliyordu: Ece Hanim 4 karti doldurup Kapasite Dashboardda Excel
    // yukleyince/Jira cekince butun icerik ucup gidiyordu (kullanici bildirimi
    // 2026-09-02). Icerik slayty ile kapasite kaynagi (Excel/Jira/Manuel)
    // BAGIMSIZ verilerdir - kapasite kaynagi degisince icerik maddeleri artik
    // KORUNUR; PO isterse maddeleri elle temizler.
    if (manual.members.length || manual.workItems.length) {
      manual.clearEntries();
    }
    setDashSource("excel");
    clearDashOverride(); // yeni Excel = bilincli tazeleme
    excel.loadFile(file, sprintForm.team, applyExcelMeta);
    dashboard.loadFile(file, applyExcelMeta);
    setExcelFileName(file.name);
  };

  /**
   * Kapak adimindaki takvim alanlari. Tarihler DEGISKEN DEGIL, mevcut
   * sprintForm.range metninden TURETILIR - boylece tek bir dogruluk kaynagi
   * kalir ve kaydetme/yukleme/PPTX yollarinin hicbiri degismez.
   *
   * Eski kayitlar serbest metinle ("10 Temmuz – 24 Temmuz") geldigi icin
   * ayristirilir; ayristirilamazsa alanlar bos gelir ve PO takvimden secer.
   * bkz. lib/sprintPeriod.js ve backend SprintPeriodParser (ayni kurallar).
   */
  const [donem, setDonem] = useState({ start: "", end: "" });

  // range disaridan degistiginde (sunum acildi, Excel yuklendi, takim
  // degisti...) takvim alanlarini tazele. Kullanici YARIM secim yaptiginda
  // range degismedigi icin bu efekt tetiklenmez, yani yarim secim korunur.
  useEffect(() => {
    const parsed = parsePeriodText(sprintForm.range);
    setDonem({ start: parsed?.start || "", end: parsed?.end || "" });
  }, [sprintForm.range]);

  /**
   * Takvimden secim. Iki tarih de secilince slaytta gorunecek metin uretilir;
   * yalnizca biri secildiyse metin HENUZ yazilmaz (yarim secim eski degeri
   * silmesin), sadece takvim alani guncellenir.
   */
  const handlePeriodChange = (startIso, endIso) => {
    setDonem({ start: startIso || "", end: endIso || "" });
    const metin = formatPeriod(startIso, endIso);
    if (metin) sprintForm.setRange(metin);
  };

  const sprintData = { ...sprintForm.data, showBand: band.show, targets: band.bars };
  // Madde sayisi arttikca yazi kuculur (madde siniri yok, bkz. geometry).
  // Okunamayacak kadar kucuk kaldiysa PO'ya icerik adiminda uyari gosterilir -
  // slayta MUDAHALE EDILMEZ, kisaltma karari PO'nundur.
  const okunabilirlik = contentReadability(sprintData);
  // PPTX ciktisinin "orantı motoru" gorselin GERCEK piksel boyutuna ihtiyac
  // duyar (bkz. lib/velocityDeckBuilder.js - pptxgenjs'in sizing:contain
  // ozelligi bunu KENDISI okuyamiyor), canli onizleme ise buna hic ihtiyac
  // duymaz (CSS object-fit:contain tarayicida otomatik). Bu yuzden iki
  // ayri sekil: renderPreviewCanvas SADECE url kullanir, veloDataForExport
  // (PPTX icin) genislik/yukseklik de tasir.
  const veloDataForExport = {
    burndownUrl: velocityBurndown.burndown.url,
    burndownWidth: velocityBurndown.burndown.naturalWidth,
    burndownHeight: velocityBurndown.burndown.naturalHeight,
    burndownZoomX: velocityBurndown.burndown.zoomX,
    burndownZoomY: velocityBurndown.burndown.zoomY,
    velocityUrl: velocityBurndown.velocity.url,
    velocityWidth: velocityBurndown.velocity.naturalWidth,
    velocityHeight: velocityBurndown.velocity.naturalHeight,
    velocityZoomX: velocityBurndown.velocity.zoomX,
    velocityZoomY: velocityBurndown.velocity.zoomY,
  };

  const handleGenerateFullDeck = (cornerMesh) =>
    fullExport.run(async () => {
      // Kapasite verisi olmasa da indirmeye izin verilir: slayt bos
      // iskeletle uretilir (bkz. addDashboardSlide) - kullanici istegi
      // (2026-08-19). Eskiden burada hata firlatilip PPTX hic inmiyordu.
      const data = { ...sprintForm.data, showBand: band.show, targets: band.bars };
      const pptx = await buildFullDeck(data, activeDashData, veloDataForExport, assets, pptxTheme, cornerMesh);
      const sp = (sprintForm.sprint.trim() || "X").replace(/[^\w]/g, "");
      await pptx.writeFile({ fileName: `Sprint_Kapasite_${sp}.pptx` });
      // Salt-okunur baska bir takimin sunumu indiriliyorsa kayit O takim
      // icin tutulur - kullanicinin kendi takimi icin degil.
      const downloadTeamId = viewingOtherTeam ? readOnlyView?.teamId : saveTeamId;
      if (downloadTeamId) {
        recordPresentationDownload("INDIVIDUAL", [downloadTeamId]).catch(() => {
          // indirme kaydi best-effort - basarisiz olsa da kullaniciyi engellemez
        });
      }
    });

  // ZoomModal ve ExportPreviewModal'in ikisi de aktif sekmeye gore AYNI tuvali
  // (dashboard veya kapak/icerik) cizer - tek yerden tanimlanip ikisine de
  // gecirilir (bkz. asagidaki renderCanvas prop'lari).
  const renderPreviewCanvas = (scale) =>
    previewTab === "dashboard" ? (
      <DashboardSlideCanvas dd={activeDashData || {}} assets={assets} scale={scale} />
    ) : previewTab === "velocity" ? (
      <VelocityBurndownSlideCanvas
        data={sprintData}
        burndownUrl={velocityBurndown.burndown.url}
        velocityUrl={velocityBurndown.velocity.url}
        burndownZoomX={velocityBurndown.burndown.zoomX}
        burndownZoomY={velocityBurndown.burndown.zoomY}
        velocityZoomX={velocityBurndown.velocity.zoomX}
        velocityZoomY={velocityBurndown.velocity.zoomY}
        assets={assets}
        scale={scale}
      />
    ) : (
      <SlideCanvas data={sprintData} tab={previewTab} assets={assets} scale={scale} />
    );

  return (
    <>
      <TopBar
        theme={theme}
        onToggleTheme={toggleTheme}
        excelFileName={excelFileName}
        personnel={personnel}
        actions={
          mode === "cover" || mode === "sprint" ? (
            <SprintTopActions
              onExcelFile={canEdit ? handleExcelFile : null}
              excelLoading={excel.loading}
              onGenerate={() => setExportPreviewOpen(true)}
              generating={fullExport.loading}
              onSave={canEdit ? handleSave : null}
              saving={saveStatus.loading}
              onUpdate={canEdit && fromJoint && aktifSunum ? handleUpdateInPlace : null}
              updating={saveStatus.loading}
              onJiraSync={canEdit ? handleJiraSync : null}
              jiraSyncing={jiraSyncing}
              onToggleFinalized={canEdit && aktifSunum?.id ? handleToggleFinalized : null}
              finalized={!!aktifSunum?.finalizedAt}
              finalizing={finalizing}
              onBenefits={canEdit && saveTeamId && tracksBenefits(sprintForm.teamType) ? () => setBenefitsOpen(true) : null}
            />
          ) : (
            <DashboardTopActions
              onExcelFile={canEdit ? handleExcelFile : null}
              excelLoading={dashboard.loading}
              onGenerate={() => setExportPreviewOpen(true)}
              generating={fullExport.loading}
              onSave={canEdit ? handleSave : null}
              saving={saveStatus.loading}
              onUpdate={canEdit && fromJoint && aktifSunum ? handleUpdateInPlace : null}
              updating={saveStatus.loading}
              onJiraSync={canEdit ? handleJiraSync : null}
              jiraSyncing={jiraSyncing}
              onToggleFinalized={canEdit && aktifSunum?.id ? handleToggleFinalized : null}
              finalized={!!aktifSunum?.finalizedAt}
              finalizing={finalizing}
            />
          )
        }
      />

      {jiraSyncNotice && (
        <div
          role="status"
          style={{
            margin: "10px 22px",
            padding: "10px 14px",
            borderRadius: 8,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            background: jiraSyncNotice.type === "success" ? "#DCFCE7" : "#FEE2E2",
            color: jiraSyncNotice.type === "success" ? "#166534" : "#991B1B",
          }}
        >
          <div style={{ flex: 1 }}>{jiraSyncNotice.text}</div>
          <button
            onClick={() => setJiraSyncNotice(null)}
            aria-label="Bildirimi kapat"
            style={{ border: 0, background: "transparent", cursor: "pointer", fontSize: 16, lineHeight: 1, color: "inherit" }}
          >
            ×
          </button>
        </div>
      )}

      <ErrorBanner
        error={fullExport.error || loadError || saveStatus.error}
        onDismiss={() => {
          fullExport.setError(null);
          setLoadError(null);
          setSaveStatus((s) => ({ ...s, error: null }));
        }}
      />
      {aktifSunum && !saveStatus.error && !viewingOtherTeam && (
        <div style={{ margin: "0 22px 10px", fontSize: 12.5, color: "var(--mut)" }}>
          ✓ Kaydedildi (v{aktifSunum.currentVersion})
        </div>
      )}

      <WizardSteps step={mode} onStepChange={changeMode} onBack={(presentationId || newForTeamId) ? () => navigate(-1) : null} />

      <main>
        <div className="wizard-col">
          {mode === "cover" && (
            <CoverPage
              teamType={sprintForm.teamType} setTeamType={handleTeamTypeChange}
              readOnlyView={readOnlyView}
              sprint={sprintForm.sprint} setSprint={sprintForm.setSprint}
              range={sprintForm.range}
              periodStart={donem.start} periodEnd={donem.end} onPeriodChange={handlePeriodChange}
              cover={cover}
              coverBackground={coverBackground}
              canEdit={canEdit}
              timerMinutes={timerMinutes}
              setTimerMinutes={setTimerMinutes}
            />
          )}
          {mode === "sprint" && (
            canEdit ? (
              <SprintPage
                form={{ ...sprintForm, setSectionText: handleSectionTextChange }}
                band={band}
                excel={excel}
                jira={jiraContent}
                teamId={saveTeamId}
                jiraProjectKey={saveTeamJiraProjectKey}
                assets={assets}
                onExpandSection={setEditorKey}
                sectorOptions={sectorOptions}
                readability={okunabilirlik}
              />
            ) : (
              <ReadOnlyNotice teamType={sprintForm.teamType} view={readOnlyView} />
            )
          )}
          {mode === "dash" && (
            canEdit ? (
              <DashboardPage
                source={dashSource}
                dashboard={dashboard}
                manual={manual}
                jira={jiraDash}
                teamId={saveTeamId}
                tableHeaders={tableHeaders}
                setTableHeaders={setTableHeaders}
              />
            ) : (
              <ReadOnlyNotice teamType={sprintForm.teamType} view={readOnlyView} />
            )
          )}
          {mode === "velocity" && (
            canEdit ? (
              <VelocityBurndownPage velocityBurndown={velocityBurndown} />
            ) : (
              <ReadOnlyNotice teamType={sprintForm.teamType} view={readOnlyView} />
            )
          )}
          <div className="wizard-nav">
            <Button
              variant="soft"
              disabled={mode === "cover"}
              onClick={() => changeMode(WIZARD_MODES[Math.max(0, WIZARD_MODES.indexOf(mode) - 1)])}
            >
              ← Geri: {WIZARD_STEP_LABELS[WIZARD_MODES[Math.max(0, WIZARD_MODES.indexOf(mode) - 1)]]}
            </Button>
            <Button
              variant="primary"
              disabled={mode === "velocity"}
              onClick={() => changeMode(WIZARD_MODES[Math.min(WIZARD_MODES.length - 1, WIZARD_MODES.indexOf(mode) + 1)])}
            >
              İleri: {WIZARD_STEP_LABELS[WIZARD_MODES[Math.min(WIZARD_MODES.length - 1, WIZARD_MODES.indexOf(mode) + 1)]]} →
            </Button>
          </div>
        </div>

        <UnifiedPreviewPane
          sprintData={sprintData}
          dashData={activeDashData}
          assets={assets}
          activeTab={previewTab}
          onTabChange={setPreviewTab}
          onZoom={() => setZoomOpen(true)}
          onEdit={canEdit ? () => setDashEditOpen(true) : null}
          showDataSource={mode === "dash" && canEdit}
          dataSource={dashSource}
          onDataSourceChange={(src) => { clearDashOverride(); setDashSource(src); }}
          burndownUrl={velocityBurndown.burndown.url}
          velocityUrl={velocityBurndown.velocity.url}
          burndownZoomX={velocityBurndown.burndown.zoomX}
          burndownZoomY={velocityBurndown.burndown.zoomY}
          velocityZoomX={velocityBurndown.velocity.zoomX}
          velocityZoomY={velocityBurndown.velocity.zoomY}
        />
      </main>

      <EditorModal
        open={editorKey != null}
        sectionKey={editorKey}
        def={editorKey ? SEC[editorKey] : null}
        text={editorKey ? sprintForm.sections[editorKey] : ""}
        onChange={(text) => editorKey && handleSectionTextChange(editorKey, text)}
        onClose={() => setEditorKey(null)}
      />

      <DashboardEditModal
        open={dashEditOpen}
        onClose={() => setDashEditOpen(false)}
        dashData={activeDashData}
        onApply={(data) => setDashDataOverride({ data, baseNames: personKeys(activeDashDataBase?.persons) })}
        hasFte={hasFteTracking(sprintForm.teamType)}
        teamBakimOrani={dashTeamBakimOrani}
      />

      <ZoomModal
        open={zoomOpen}
        onClose={() => setZoomOpen(false)}
        tabs={PREVIEW_TABS}
        activeTab={previewTab}
        onTabChange={setPreviewTab}
        renderCanvas={renderPreviewCanvas}
        timerSeconds={Number(timerMinutes) > 0 ? Number(timerMinutes) * 60 : null}
      />

      <BenefitsModal
        open={benefitsOpen}
        onClose={() => setBenefitsOpen(false)}
        teamId={saveTeamId}
        teamName={sprintForm.team}
      />

      <ExportPreviewModal
        open={exportPreviewOpen}
        onClose={() => setExportPreviewOpen(false)}
        tabs={PREVIEW_TABS}
        activeTab={previewTab}
        onTabChange={setPreviewTab}
        renderCanvas={renderPreviewCanvas}
        previewTheme={pptxTheme}
        onPreviewThemeChange={setPptxTheme}
        downloading={fullExport.loading}
        onConfirmDownload={async (cornerMesh) => {
          const ok = await handleGenerateFullDeck(cornerMesh);
          if (ok) setExportPreviewOpen(false);
        }}
      />

      <AlertModal
        open={!!wizardAlert}
        title="Eksik bilgi"
        message={wizardAlert}
        onClose={() => setWizardAlert(null)}
      />

      {/* Kaydetmeden once veri kaybi riski varsa onay - bkz.
          kaydetmeUyarilari. Risk yoksa bu modal HIC acilmaz, kaydetme
          akisi eskisi gibi tek tikta biter. */}
      <Modal open={!!saveConfirm} onClose={() => (saveStatus.loading ? null : setSaveConfirm(null))}>
        <h3 style={{ marginTop: 0 }}>Kaydetmeden önce</h3>
        <ul style={{ color: "var(--mut)", lineHeight: 1.6, paddingLeft: 20, margin: "10px 0" }}>
          {(saveConfirm || []).map((u, i) => (
            <li key={i} style={{ marginBottom: 6 }}>{u}</li>
          ))}
        </ul>
        <p style={{ color: "var(--mut)", lineHeight: 1.6, marginBottom: 0 }}>
          Eski sürümler <b>silinmez</b>; yanlışlıkla kaydedersen sunumun <b>Sürüm Geçmişi</b>'nden
          önceki sürüme geri dönebilirsin.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
          <Button variant="soft" onClick={() => setSaveConfirm(null)} disabled={saveStatus.loading}>
            Vazgeç
          </Button>
          <Button variant="primary" onClick={kaydetmeyiYap} loading={saveStatus.loading} loadingLabel="Kaydediliyor…">
            Yine de kaydet
          </Button>
        </div>
      </Modal>
    </>
  );
}
