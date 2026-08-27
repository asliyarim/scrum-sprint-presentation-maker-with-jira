import { useEffect, useMemo, useState } from "react";
import { computeStatelessDashboard } from "../lib/apiClient";
import { riskLevelToLabel, initialsOf } from "../lib/format";
import { validateDateOrder } from "../lib/dateValidation";
import { hasFteTracking } from "../lib/teamTypes";

let clientIdSeq = 1;
const nextClientId = () => clientIdSeq++;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function defaultPeriod() {
  const year = new Date().getFullYear();
  return { periodStart: `${year}-06-01`, periodEnd: `${year}-12-31`, reportDate: todayIso() };
}

/**
 * Statü kataloğu artık SABİT (kullanıcı ekleyip silemez, özel statü yazamaz) -
 * eskiden StatusEditor ile serbestçe yönetilen bir listeydi, ama bu, her iş
 * kalemi için "kod/etiket seç + Tamamlandı sayılır işaretle" gibi gereksiz bir
 * karmaşıklık getiriyordu. Artık iş kalemi satırında tek bir "Tamamlandı"
 * onay kutusu var (bkz. MemberCard.jsx) - backend'e yine bu iki kod
 * gönderilir, hesaplama mantığı (CapacityCalculationService.isCompleted)
 * DEĞİŞMEDİ (bkz. kullanıcı bildirimi, 2026-08-17: "daha basit yapamaz mıyız
 * ... kullanıcı daha basit seçse").
 */
const DEFAULT_STATUSES = [
  { code: "OPEN", label: "Açık", countsAsCompleted: false },
  { code: "DONE", label: "Tamamlandı", countsAsCompleted: true },
];

/**
 * Kapasite Dashboard'un "Manuel Gir" veri kaynagi: Excel yerine, ekip uyesi ve
 * is kalemi formlariyla girilen veriyi backend'in stateless
 * /api/capacity-dashboard/compute endpoint'ine gonderir. Hicbir sey kaydedilmez;
 * her hesaplama isteginde girilen veri oldugu gibi backend'e tasinir, sonuc aninda
 * doner. addedDate/closedDate girilirse Donem Kapanan/Yeni Eklenen/Net Degisim
 * backend tarafindan otomatik hesaplanir (elle girilmez).
 */
export function useManualDashboard(team, setTeam, sprintNo, setSprintNo, teamType) {
  const [period, setPeriod] = useState(defaultPeriod);
  const [previousSnapshotDate, setPreviousSnapshotDate] = useState("");
  const [maintenanceAllocationPercent, setMaintenanceAllocationPercent] = useState("0.2");

  const [members, setMembers] = useState([]);
  const [workItems, setWorkItems] = useState([]);
  const statuses = DEFAULT_STATUSES;
  // Takima ozgu, backend'in genel formulune girmeyen ek gostergeler (orn. RPA'da
  // "FTE Hedef", "Hedef Sürec Sayisi") - tamamen istemci tarafinda, sadece onizlemede
  // ekstra kart olarak gosterilir, hesaplamaya karismaz.
  const [customKpis, setCustomKpis] = useState([]);

  const [dashData, setDashData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [alertMessage, setAlertMessage] = useState(null);
  const [alertTitle, setAlertTitle] = useState("Uyarı");

  const addMember = () =>
    setMembers((prev) => [...prev, { clientId: nextClientId(), fullName: "", role: "", startDate: period.periodStart, statusCode: "OPEN" }]);
  const updateMember = (clientId, patch) =>
    setMembers((prev) => prev.map((m) => (m.clientId === clientId ? { ...m, ...patch } : m)));
  const removeMember = (clientId) => {
    setMembers((prev) => prev.filter((m) => m.clientId !== clientId));
    setWorkItems((prev) => prev.filter((wi) => wi.memberClientId !== clientId));
  };

  const addWorkItem = (memberClientId) =>
    setWorkItems((prev) => [...prev, { clientId: nextClientId(), memberClientId, title: "", plannedEffortDays: "", statusCode: "OPEN", addedDate: "", closedDate: "" }]);
  const updateWorkItem = (clientId, patch) =>
    setWorkItems((prev) => prev.map((wi) => (wi.clientId === clientId ? { ...wi, ...patch } : wi)));
  const removeWorkItem = (clientId) => setWorkItems((prev) => prev.filter((wi) => wi.clientId !== clientId));
  // Yeni bir Excel yuklendiginde daha once elle girilmis uye/is kalemi
  // verisini temizlemek icin - bkz. App.jsx handleExcelFile.
  const clearEntries = () => {
    setMembers([]);
    setWorkItems([]);
  };

  const addCustomKpi = () => setCustomKpis((prev) => [...prev, { label: "", value: "", unit: "" }]);
  const updateCustomKpi = (index, patch) => setCustomKpis((prev) => prev.map((k, i) => (i === index ? { ...k, ...patch } : k)));
  const removeCustomKpi = (index) => setCustomKpis((prev) => prev.filter((_, i) => i !== index));

  const workItemsByMember = useMemo(() => {
    const map = {};
    workItems.forEach((wi) => {
      if (!map[wi.memberClientId]) map[wi.memberClientId] = [];
      map[wi.memberClientId].push(wi);
    });
    return map;
  }, [workItems]);

  /** "En az bir isim var mı / tüm isimler dolu mu / tarih sırası doğru mu" - hem "Hesapla" butonu hem otomatik hesaplama BU kontrolden geçer. */
  const validationIssue = () => {
    const hasAnyName = members.some((m) => m.fullName.trim());
    if (members.length === 0 || !hasAnyName) return { title: "Eksik bilgi", message: "En az bir isim girmelisiniz." };
    if (members.some((m) => !m.fullName.trim())) {
      return { title: "Eksik bilgi", message: "İsim alanı boş bırakılamaz. Lütfen tüm ekip üyeleri için isim girin." };
    }
    const dateIssue = validateDateOrder({ periodStart: period.periodStart, periodEnd: period.periodEnd, members, workItems });
    if (dateIssue) return { title: "Tarih hatası", message: dateIssue };
    return null;
  };

  const runCompute = async () => {
    setLoading(true);
    setError(null);
    try {
      const request = {
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        reportDate: period.reportDate,
        previousSnapshotDate: previousSnapshotDate || null,
        maintenanceAllocationPercent: Number(String(maintenanceAllocationPercent).replace(",", ".")) || 0,
        members: members.map((m) => ({
          clientId: m.clientId,
          fullName: m.fullName,
          role: m.role,
          startDate: m.startDate || null,
          statusCode: m.statusCode || null,
          targetWorkDays: m.targetWorkDays ? Number(m.targetWorkDays) : null,
          maintenanceAllocationPercent: m.maintenanceAllocationPercent
            ? Number(String(m.maintenanceAllocationPercent).replace(",", "."))
            : null,
        })),
        workItems: workItems
          .filter((wi) => wi.title.trim())
          .map((wi) => ({
            memberClientId: wi.memberClientId,
            title: wi.title,
            plannedEffortDays: Number(String(wi.plannedEffortDays).replace(",", ".")) || 0,
            statusCode: wi.statusCode || null,
            addedDate: wi.addedDate || null,
            closedDate: wi.closedDate || null,
          })),
        statuses: statuses.filter((s) => s.code.trim()),
        // Kisiye ozel izin gunleri (bkz. LeaveDaysField/MemberCard) - clientId'ye
        // gore anahtarlanir (backend'de de gecici id, DB id'si degil, bkz.
        // StatelessDashboardRequest.MemberInput yorumu). CapacityCalculationService
        // bunu targetWorkDays'ten dusup net kapasiteyi yeniden hesaplar.
        personalLeaveDaysByMemberId: members.reduce((acc, m) => {
          if (m.leaveDays) acc[m.clientId] = m.leaveDays;
          return acc;
        }, {}),
      };

      const result = await computeStatelessDashboard(request);
      setDashData(toDashData(result, team, sprintNo, period, previousSnapshotDate, customKpis));
    } catch (err) {
      setError(err);
      setDashData(null);
    } finally {
      setLoading(false);
    }
  };

  /** "Hesapla" butonu - gecersiz/eksik veri varsa ACIKCA uyarir (AlertModal), gecerliyse hemen (debounce beklemeden) hesaplar. */
  const compute = async () => {
    const issue = validationIssue();
    if (issue) {
      setAlertTitle(issue.title);
      setAlertMessage(issue.message);
      return;
    }
    // ESKI UYARIYI TEMIZLE. Bu satir yokken su hata olusuyordu (kullanici
    // bildirimi 2026-08-20: "manuel kişi eklemede bir sıkıntı var hata veriyor
    // 'En az bir isim girmelisiniz.' diyor zaten bir kişi girdiğim halde"):
    // "Ekip üyesi ekle"ye basildiginda kart ADI BOS olarak gelir; kullanici
    // dogal olarak once "Hesapla"ya basiyor, uyari cikiyor ve alertMessage
    // set ediliyor. Sonra ismi yazip tekrar "Hesapla"ya bastiginda dogrulama
    // ARTIK GECIYOR ama alertMessage hic temizlenmedigi icin AYNI uyari
    // ekranda duruyordu - kullaniciya "isim girdim ama hala isim istiyor"
    // gibi gorunuyordu.
    setAlertMessage(null);
    await runCompute();
  };

  // Otomatik hesaplama: kullanici herhangi bir alani (isim, efor, tarih, oran
  // vb.) degistirdiginde "Hesapla"ya basmaya GEREK KALMADAN, kisa bir
  // suskunluktan sonra (debounce - her tus vurusunda degil) Canli Onizleme
  // kendiliginden guncellenir (bkz. kullanici bildirimi, 2026-08-17: "burada
  // yapılan değişiklikler hesaplamaya basılmadan auto olsun ... otomatik
  // dashboardtta dolsun"). Veri HENUZ eksik/gecersizken (isim yok, tarih
  // hatasi vb.) "Hesapla" butonundaki gibi uyari popup'i GOSTERILMEZ - kullanici
  // muhtemelen hala yaziyordur, sessizce atlanip bir sonraki degisiklikte
  // tekrar denenir. "Hesapla" butonu KALDIRILMADI - kullanici isterse ayni anda
  // (debounce beklemeden) tetikleyebilir, gecersiz veri icin acik uyari da hala
  // ondan gelir.
  const AUTO_COMPUTE_DEBOUNCE_MS = 700;
  useEffect(() => {
    if (validationIssue()) return;
    // Eksik bilgi giderilir gidermez (orn. isim yazilir yazilmaz) ekranda
    // duran eski uyari KENDILIGINDEN kalksin - kullanicinin "Anladım"a basip
    // sorunun cozuldugunu ayrica dogrulamasi gerekmesin.
    setAlertMessage((prev) => (prev == null ? prev : null));
    const timer = setTimeout(() => {
      runCompute();
    }, AUTO_COMPUTE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team, sprintNo, period, previousSnapshotDate, maintenanceAllocationPercent, members, workItems, customKpis]);

  /**
   * Sol formun TAM durumu (donem, rapor tarihi, bakim orani, uyeler, is
   * kalemleri, ek gostergeler) - kayitli sunumun contentine gomulur, bkz.
   * App.jsx buildSaveContent.
   *
   * Eskiden SADECE hesaplanmis SONUC (dashData) kaydediliyordu, GIRDILER
   * kaydedilmiyordu. Bu yuzden manuel girisle hazirlanan bir sunum yeniden
   * acildiginda sol form BOS geliyor ve pes pese sikayet uretiyordu
   * (kullanici bildirimleri 2026-08-26):
   *   - "kaydettikten sonra manuel giris alanini tekrar goremiyorum, nerede
   *      hata yaptim diye donup bakamiyorum"
   *   - "hesapla dedigimde bir degisiklik yapmiyor"  (uye listesi bos)
   *   - "rapor tarihi alaninda genel bir sorun var, duzeltmiyor hicbirini"
   *   - "ust bardaki kartlarda yanlis olanlar duzelmiyor"
   * Dordu de ayni eksigin farkli gorunumleriydi.
   *
   * Excel akisinda bu sorun yasanmiyordu cunku orada GIRDI Excel dosyasinin
   * kendisi - PO dosyayi tekrar yukleyebiliyordu. Manuel akista boyle bir
   * kaynak yok, o yuzden girdinin kendisi saklanmali.
   */
  const snapshot = () => ({
    period,
    previousSnapshotDate,
    maintenanceAllocationPercent,
    members,
    workItems,
    customKpis,
  });

  /**
   * snapshot()in tersi. IKI korumasi var:
   *
   * 1) Uyesi olmayan anlik goruntu GERI YUKLENMEZ. Aksi halde Excel/Jira
   *    kaynakli bir sunum acilirken sol form bosaltilir, ardindan otomatik
   *    hesaplama sifirlarla calisip kayitli dashboardun onune gecerdi.
   *    (Otomatik hesaplama zaten members.length === 0 iken calismaz - bkz.
   *    validationIssue - ama burada da acikca korunuyor.)
   * 2) clientIdler modul duzeyinde artan sayilar. Geri yuklenen kayitlarin
   *    numaralari, ayni oturumda sonradan eklenecek yeni satirlarla
   *    CAKISMASIN diye sayac en buyugun uzerine tasinir.
   */
  const restore = (snap) => {
    if (!snap || !Array.isArray(snap.members) || snap.members.length === 0) return;
    const ids = [...snap.members, ...(Array.isArray(snap.workItems) ? snap.workItems : [])]
      .map((x) => Number(x?.clientId))
      .filter(Number.isFinite);
    if (ids.length) clientIdSeq = Math.max(clientIdSeq, Math.max(...ids) + 1);
    if (snap.period) setPeriod(snap.period);
    setPreviousSnapshotDate(snap.previousSnapshotDate || "");
    if (snap.maintenanceAllocationPercent != null) setMaintenanceAllocationPercent(String(snap.maintenanceAllocationPercent));
    setMembers(snap.members);
    setWorkItems(Array.isArray(snap.workItems) ? snap.workItems : []);
    setCustomKpis(Array.isArray(snap.customKpis) ? snap.customKpis : []);
  };

  return {
    team, setTeam, sprintNo, setSprintNo,
    period, setPeriod, previousSnapshotDate, setPreviousSnapshotDate,
    maintenanceAllocationPercent, setMaintenanceAllocationPercent,
    alertMessage, alertTitle, clearAlert: () => setAlertMessage(null),
    members, addMember, updateMember, removeMember,
    workItems, workItemsByMember, addWorkItem, updateWorkItem, removeWorkItem, clearEntries,
    statuses,
    customKpis, addCustomKpi, updateCustomKpi, removeCustomKpi,
    dashData, loading, error, compute,
    snapshot, restore,
    hasFte: hasFteTracking(teamType),
  };
}

/**
 * Backend'in CapacityDashboardDto'sunu DashboardSlideCanvas'ın beklediği dashData
 * şekline çevirir. useJiraDashboard.js'de de (DB'den GET /capacity-dashboard ile
 * gelen AYNI DTO şeklini taşıyan) sonuç için tekrar kullanılır - export edilir.
 */
export function toDashData(dto, team, sprintNo, period, previousSnapshotDate, customKpis = []) {
  const durum = riskLevelToLabel(dto.overallRiskLevel);
  return {
    team: team || "Ekip",
    sprintNo,
    dateRange: `${formatTr(period.periodStart)} – ${formatTr(period.periodEnd)}`,
    reportDate: formatTr(period.reportDate),
    kpis: {
      toplam: dto.totalPlannedEffort,
      tamamlanan: dto.completedEffort,
      acik: dto.remainingEffort,
      kapasite: dto.remainingCapacity,
      doluluk: (dto.maintainedOccupancyPercent || 0) / 100,
      acikFazla: dto.capacityGap,
      durum,
    },
    persons: (dto.memberMetrics || []).map((m) => ({
      name: m.fullName,
      role: m.role || "",
      avatarUrl: m.avatarUrl || "",
      initials: initialsOf(m.fullName),
      toplam: m.totalPlannedEffort,
      tamamlanan: m.completedEffort,
      acik: m.remainingEffort,
      kapasite: m.rawRemainingCapacity,
      // "Bakim Haric Kalan Kapasite" - Kapasite Farki formulunun (tamamlanan -
      // bakim haric kapasite) ikinci terimi; Duzenle ekrani bunu satirlardan
      // yeniden hesaplayabilsin diye kisi nesnesine de tasinir.
      bakimliKapasite: m.maintainedCapacity,
      doluluk: (m.occupancyPercent || 0) / 100,
      durum: riskLevelToLabel(m.riskLevel),
      bakimOrani: m.maintenanceAllocationPercent,
    })),
    delta: previousSnapshotDate
      ? { kapanan: dto.periodClosedEffort, eklenen: dto.newlyAddedEffort, fte: "", net: dto.netChange, range: `${formatTr(previousSnapshotDate)} – ${formatTr(period.reportDate)}` }
      : null,
    customKpis: (customKpis || []).filter((k) => k.label.trim() && k.value !== ""),
  };
}

function formatTr(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}
