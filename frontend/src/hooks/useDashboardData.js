import { useMemo, useState } from "react";
import { parseDashboardExcel } from "../lib/excelParsers";
import { num, autoRange, nfmt1, VARSAYILAN_BAKIM_ORANI } from "../lib/format";
import { hasFteTracking } from "../lib/teamTypes";

const DEFAULT_META = { team: "", dateRange: "01 Haziran – 31 Aralık 2026", reportDate: "", reportObj: null };

/**
 * Kapasite Dashboard modunun tum durumunu (Excel'den okunan veri + kullanicinin
 * duzenledigi kisi/rol/tamamlanan + son 2 hafta delta alanlari) yonetir ve
 * dashSlideHTML'in JSX karsiligi icin gereken `dashData` nesnesini uretir.
 */
export function useDashboardData(dTeam, setDTeam, dSprint, setDSprint, teamType, teamBakimOrani = null) {
  const [loaded, setLoaded] = useState(false);
  const [persons, setPersons] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [meta, setMeta] = useState(DEFAULT_META);
  // "İş_Listesi" sayfasindaki "FTE" sutunu baska hicbir hesaplamada kullanilmiyor -
  // toplamini burada tutup dashData.customKpis uzerinden ek bir kart olarak gosteriyoruz.
  // SADECE RPA'da (bkz. asagidaki hasFte kontrolu) - diger takim tiplerinin
  // Excel'inde bu sutun zaten olmuyor ama teamType degismeden Excel yeniden
  // yuklenirse eski totalFte deger yanlislikla baska bir takimda kalmasin diye
  // ayrica hasFte ile de kapatiliyor (bkz. kullanici bildirimi, 2026-08-17:
  // "bu sadece RPA takımında olacak diğer takımlarda olmasın").
  const [totalFte, setTotalFte] = useState(null);

  const [dKapanan, setDKapanan] = useState("");
  const [dEklenen, setDEklenen] = useState("");
  const [dFte, setDFte] = useState("");
  const [dNet, setDNet] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const BASE_INFO = "Excel yükleyin — Kapasite Takip dosyasındaki Rapor sayfası okunur. Sprint modundan farklı olarak burada tüm sayılar Excel'den gelir.";

  const loadFile = (file, onParsed) => {
    setLoading(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseDashboardExcel(e.target.result, dTeam);
        setLoaded(true);
        setPersons(parsed.persons);
        setKpis(parsed.kpis);
        setMeta(parsed.meta);
        setTotalFte(parsed.totalFte);
        // Her yeni Excel yuklendiginde ekip adi da o dosyadan gelenle
        // guncellensin - "sadece bossa doldur" mantigi, alan zaten dolu
        // (varsayilan) oldugu icin hicbir zaman tetiklenmiyordu.
        setDTeam(parsed.meta.team);
        onParsed?.({ teamType: parsed.teamType, sprintNo: parsed.sprintNo, range: parsed.range });
      } catch (err) {
        setError('Excel okunamadı: ' + (err?.message || "bilinmeyen hata") + ' — dosyanın "Rapor" sayfasını içerdiğinden emin olun.');
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError("Dosya okunamadı. Lütfen tekrar deneyin.");
      setLoading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const updatePerson = (index, patch) =>
    setPersons((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  const dashData = useMemo(() => {
    // Excel bu oturumda HENUZ yuklenmediyse (loaded=false) kesinlikle null
    // donulmeli - aksi halde ASAGIDA "kpis:null" ile birlikte yine de bir
    // NESNE donuluyordu, App.jsx'teki "dashboard.dashData || loadedDashData"
    // dusmesi HER ZAMAN bu (bos) nesneyi truthy sayip secıyordu, kayitli bir
    // sunum Excel yeniden yuklenmeden kaydedilince/guncellenince kapasite
    // dashboard verisini SESSIZCE SILIYORDU (bkz. kullanici bildirimi: "İş
    // Zekası'nın dashboardu kaybolmuş").
    if (!loaded) return null;
    const team = dTeam.trim() || meta.team || "Ekip";
    const mappedPersons = persons.map((p) => {
      const tam = num(p.tamamlanan);
      // İzin günleri (LeaveDaysField/PersonMappingTable ile eklenir) Excel'in
      // kendi "Kapasite" sayfasinda YER ALMAZ (Excel'den SONRA, uygulama
      // icinde eklenir) - bu yuzden "Kullanılabilir Kapasite"den burada
      // dusulmesi gerekir (bkz. kullanici bildirimi: izin eklenince
      // kapasiteden dusmuyordu). Backend'deki CapacityCalculationService
      // (manuel giris akisi) ile AYNI mantik: kapasite negatife duşmez.
      const kapasite = Math.max(0, num(p.kapasite) - num(p.leaveDays || 0));
      // Bakim/SR orani ("buffer"): Kapasite Farkı ve Kapasite % HER ZAMAN
      // "Kapasite x (1 - oran)" tabani uzerinden hesaplanir (PO'nun Excel
      // raporundaki formulun aynisi - 4 sprintlik sunum karsilastirmasiyla
      // dogrulandi, 2026-08-25). Oran su sirayla bulunur:
      //   1) kisiye ozel oran (manuel/Jira akisi bunu doldurur),
      //   2) Excel "Bakım Hariç Kalan Kapasite" kolonu GERCEKTEN bir dusum
      //      iceriyorsa ondan turetilen oran (sprintler arasi degisebiliyor:
      //      2. sprintte 0.15, 3.'de 0.20 olcüldü),
      //   3) takimin kayitli orani (teams.maintenance_allocation_percent).
      // Eskiden hicbiri okunmuyordu: oran null kaliyor, bakim hic dusulmuyor
      // ve Kapasite Farkı "kapasite x oran" kadar fazla (iyimser) cikiyordu
      // (orn. -129 yerine dogrusu -210,6).
      const kapasiteHam = num(p.kapasite);
      const bakimliHam = p.bakimliKapasite != null && p.bakimliKapasite !== "" ? num(p.bakimliKapasite) : null;
      const excelOran = bakimliHam != null && kapasiteHam > 0 && bakimliHam < kapasiteHam
        ? 1 - bakimliHam / kapasiteHam
        : null;
      const oran = p.bakimOrani != null
        ? num(p.bakimOrani)
        : excelOran != null
          ? excelOran
          : teamBakimOrani != null
            ? num(teamBakimOrani)
            : VARSAYILAN_BAKIM_ORANI;
      // "Bakım Hariç Kalan Kapasite" Excel'de gercekten varsa ayni izin
      // dususuyle tasinir; yoksa orandan turetilir (kapasite'de izin zaten
      // dusuldugu icin ikinci kez dusulmez). Goruntulenen "Kapasite" degerini
      // (yukaridaki, "Kalan İş Günü" kaynakli) hicbir durumda ETKİLEMEZ.
      const bakimliKapasite = bakimliHam != null && excelOran != null
        ? Math.max(0, bakimliHam - num(p.leaveDays || 0))
        : oran != null
          ? Math.max(0, kapasite * (1 - oran))
          : null;
      return { name: p.name, role: p.role, initials: p.initials, toplam: p.toplam, tamamlanan: tam, acik: p.toplam - tam, kapasite, bakimliKapasite, bakimOrani: oran, doluluk: p.doluluk, durum: p.durum };
    });
    const k0 = kpis || { toplam: 0, doluluk: 0, durum: "" };
    const toplam = k0.toplam;
    const tamamlanan = mappedPersons.reduce((s, p) => s + p.tamamlanan, 0);
    const acik = toplam - tamamlanan;
    const kapasite = mappedPersons.reduce((s, p) => s + p.kapasite, 0);
    // Kapasite Farkı: Excel'in Rapor sayfasinda ARTIK hazir bir alan var
    // (Rapor!B32 = "Bakım Hariç Kalan Kapasite" − "Kalan Efor") - varsa
    // dogrudan o kullanilir ki PO'nun Excel'de gordugu rakamla birebir aynisi
    // gorunsun. Eski sablonlarda alan yoksa, AYNI formul kisi satirlarindaki
    // "Bakım Hariç Kalan Kapasite" (p.kapasite - bkz. excelParsers, Kapasite
    // sayfasindaki K kolonu) uzerinden hesaplanir.
    // Yedek formul ARTIK bakim hariç kapasiteyi kullanir - eskiden ham
    // "kapasite" ile hesaplaniyordu ve bu, PO'nun Excel'de gordugu rakamla
    // uyusmuyordu (3. sprint: -129 yerine -210,6 olmali; fark tam olarak
    // kapasite x bakim orani). DashboardEditModal.computeKpisFromPersons ile
    // AYNI formul: Σ(bakim hariç kapasite) - açık efor.
    const bakimHaricKapasite = mappedPersons.reduce(
      (acc, p) => acc + (p.bakimliKapasite != null ? num(p.bakimliKapasite) : num(p.kapasite)),
      0
    );
    const acikFazla = k0.kapasiteFarki != null ? k0.kapasiteFarki : bakimHaricKapasite - acik;
    const kpisOut = { toplam, tamamlanan, acik, kapasite, doluluk: k0.doluluk, acikFazla, durum: k0.durum };

    let delta = null;
    if (loaded) {
      delta = {
        kapanan: dKapanan,
        eklenen: dEklenen,
        fte: dFte,
        net: dNet !== "" ? num(dNet) : num(dKapanan) - num(dEklenen),
        range: autoRange(meta.reportObj),
      };
    }
    // "Toplam FTE" sadece RPA'da (hasFteTracking) gosterilir - baska takim
    // tipinde Excel'de bu sutun zaten olmayacagi icin totalFte null gelir,
    // ama teamType degismeden ayni oturumda onceki (RPA) Excel'den kalma bir
    // deger varsa hasFte kontrolu bunu ekstra guvenceye alir.
    const customKpis = hasFteTracking(teamType) && totalFte != null
      ? [{ label: "Toplam FTE", value: nfmt1(totalFte), unit: "İş kalemlerinden (Excel)" }]
      : [];

    return {
      team,
      sprintNo: dSprint,
      dateRange: meta.dateRange,
      reportDate: meta.reportDate,
      kpis: loaded ? kpisOut : null,
      persons: mappedPersons,
      delta,
      deltaRange: delta ? delta.range : "",
      customKpis,
    };
  }, [dTeam, dSprint, dKapanan, dEklenen, dFte, dNet, persons, kpis, meta, loaded, totalFte, teamType, teamBakimOrani]);

  // Ekip adi (dTeam) her degistiginde bu mesaj da guncellensin - Excel'den okunan
  // ismi donup kalmasin, kapak sayfasindaki gibi guncel degeri yansitsin.
  const info = useMemo(() => {
    if (!loaded) return BASE_INFO;
    // Rapor Tarihi okunamadiysa ACIKCA soyle. Eskiden sessizce bos geciliyor,
    // slaytta kalici olarak "–" goruluyordu; PO ne oldugunu anlamiyor ve
    // duzeltemiyordu (kullanici bildirimi 2026-08-26, Gözde Son: "rapor tarihi
    // alaninda genel bir sorun var duzeltmiyor hicbirini").
    //
    // Cozum neden arayuzde DUZENLENEBILIR bir alan DEGIL: Excel akisinda
    // kapasite bizim hesabimiz degil, dosyadan OKUNUYOR ve Excel'in kendi
    // rapor tarihine gore hesaplanmis durumda. Arayuzden tarihi degistirmek
    // slayttaki etiketi degistirir ama kapasiteleri degistirmez; ustelik izin
    // penceresinin alt siniri da rapor tarihi oldugu icin kapasite KISMEN
    // kayardi - ne Excel'in ne bizim hesabimiz olan tutarsiz bir sayi cikardi.
    // Dogru cozum dosyayi duzeltip yeniden yuklemek, o yuzden PO'ya bunu
    // soyluyoruz.
    if (!meta.reportDate) {
      return (
        `Excel okundu — ${dTeam.trim() || meta.team} · ${persons.length} kişi. ` +
        "⚠ Rapor Tarihi okunamadı: dosyanın \"Rapor\" sayfasında ilk sütunda \"Rapor Tarihi\" yazan " +
        "satır yok ya da yanındaki hücre boş. Kapasite bu tarihe göre hesaplandığı için tarihi " +
        "Excel'de düzeltip dosyayı yeniden yükleyin — aksi halde slaytta boş görünür."
      );
    }
    return (
      `Excel okundu — ${dTeam.trim() || meta.team} · ${persons.length} kişi · Rapor Tarihi ${meta.reportDate}. ` +
      "Aşağıdan ad/rol ve Tamamlanan değerlerini girin (Açık = Toplam − Tamamlanan otomatik)."
    );
  }, [loaded, dTeam, meta, persons.length]);

  // Excel'in "Rapor Tarihi" degeri ISO (YYYY-MM-DD) olarak - izin gunlerinin
  // SADECE bu tarihten sonrasi kapasiteden dusulsun diye LeaveDaysField'a
  // pencere alt siniri olarak gecilir (bkz. lib/leaveDays.js
  // sumFractionsInWindow, kullanici bildirimi 2026-08-20).
  const reportDateIso = meta.reportObj instanceof Date && !isNaN(meta.reportObj)
    ? meta.reportObj.toISOString().slice(0, 10)
    : null;

  return {
    loaded, persons, loading, error, info,
    dTeam, setDTeam, dSprint, setDSprint,
    dKapanan, setDKapanan, dEklenen, setDEklenen, dFte, setDFte, dNet, setDNet,
    loadFile, updatePerson, dashData, reportDateIso,
    hasFte: hasFteTracking(teamType),
  };
}
