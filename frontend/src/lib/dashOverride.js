import { bakimHaricKapasiteOf } from "./format";

function num(v) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Kisi eslestirme anahtari - "Düzenle" rotusunu sol formdaki AYNI kisiyle
 * eslestirmek icin. Ad tek birlestirme anahtarimiz (uygulamanin her yerinde
 * oyle - bkz. autoApplyCompanyHolidays.ensureTeamMember), o yuzden bas/son
 * bosluk ve buyuk/kucuk harf farki (İ/ı icin Turkce yerel ayariyla)
 * onemsenmez: "Ayse Yilmaz" ile "ayşe yilmaz " ayni kisidir.
 */
export function personKey(p) {
  return String(p?.name || "").trim().toLocaleLowerCase("tr");
}

export function personKeys(persons) {
  return (persons || []).map(personKey);
}

/**
 * "Ekip Özet" KPI'larini KISI SATIRLARINDAN hesaplar - PO notu 2026-08-19:
 * "Alttaki verileri hesaplayıp yukarıya yazsak daha uygun olmaz mı? Bu şekilde
 * veri doğruluğu sapabilir." Eskiden ust bloktaki 6 KPI da elle giriliyordu ve
 * alttaki kisi satirlariyla tutarsiz kalabiliyordu (orn. Toplam İş Yükü 120
 * yazarken satirlarin toplami 280).
 *
 * Toplamlar dogrudan sutun toplamidir. "Kapasite %" ise kisi satirlarindaki
 * kendi doluluk degerlerinin KAPASITEYE GORE AGIRLIKLI ortalamasidir - boylece
 * kisiye ozel bakim orani (bakimOrani) gibi satira zaten islenmis duzeltmeler
 * korunur, burada yeni bir formul uydurulmaz. Kapasite toplami 0 ise duz
 * ortalamaya duser.
 *
 * DashboardEditModal ile App.jsx ORTAK kullanir: modal acikken ust ozeti
 * canli gosterir, App ise birlestirmeden (bkz. mergeDashOverride) sonra
 * ozeti yeni kisi listesine gore yeniden turetir - iki yerde iki ayri
 * formul olmasin diye burada tek kopya tutulur.
 */
export function computeKpisFromPersons(persons, currentDurum, varsayilanOran) {
  const list = persons || [];
  const sum = (key) => list.reduce((acc, p) => acc + num(p[key]), 0);
  const toplam = sum("toplam");
  const tamamlanan = sum("tamamlanan");
  const acik = sum("acik");
  const kapasite = sum("kapasite");

  let doluluk = 0;
  if (list.length) {
    const weightTotal = list.reduce((acc, p) => acc + num(p.kapasite), 0);
    doluluk = weightTotal > 0
      ? list.reduce((acc, p) => acc + num(p.doluluk) * num(p.kapasite), 0) / weightTotal
      : list.reduce((acc, p) => acc + num(p.doluluk), 0) / list.length;
  }

  // Kapasite Farkı = Bakım Hariç Kalan Kapasite − Kalan (Açık) Efor.
  // PO Excel'indeki hucre formulunun aynisi (Rapor!B32 = B26 − B22, dosya
  // incelemesi 2026-08-20). Satir basina taban icin bkz. bakimHaricKapasiteOf:
  // eskiden "bakimliKapasite dolu ise oldugu gibi al" deniyordu, ama Excel
  // akisinda bu alan ham kapasiteye ESIT kaydediliyordu (bakim hic dusulmemis)
  // ve Kapasite Farkı olmasi gerekenden iyimser cikiyordu.
  const bakimHaricKapasite = list.reduce((acc, p) => acc + bakimHaricKapasiteOf(p, varsayilanOran), 0);

  return {
    toplam, tamamlanan, acik, kapasite, doluluk,
    acikFazla: bakimHaricKapasite - acik,
    durum: currentDurum || "Uygun",
  };
}

/**
 * Canli onizlemedeki "Düzenle" rotuslarini (override) guncel veri tabanina
 * (base - Excel/Manuel/Jira'dan hesaplanan liste) BIRLESTIRIR.
 *
 * Neden fotograf degil de birlestirme:
 *  - Eskiden taban her degistiginde rotuslar tamamen SILINIYORDU. Manuel
 *    Gir'de her tus vurusundan 700 ms sonra otomatik hesaplama calistigi icin
 *    (useManualDashboard AUTO_COMPUTE_DEBOUNCE_MS) PO'nun girdigi butun
 *    degerler sol formdaki tek bir harf yuzunden ucuyordu (kullanici
 *    bildirimleri 2026-08-26: "manuel kişi ekleme yaparken habire siliniyor").
 *  - Bunun ilk carasi rotusu komple dondurmakti; bu sefer de sol formdan
 *    eklenen YENI kisiler ne slayta ne de Düzenle penceresine dusuyordu
 *    (2026-08-26 tarayici testi: "Test Kisi B" hicbir yerde gorunmedi).
 *
 * Bu yuzden ikisi de degil: kim VAR sorusunun cevabi tabandan, o kisinin
 * DEGERLERI ise rotustan gelir.
 *
 * @param base guncel hesaplanmis dashboard verisi (null olabilir)
 * @param override { data, baseNames } - "Uygula"ya basildigi ANDAKI rotus ve
 *   o an tabanda bulunan kisi anahtarlari. baseNames, rotusta olup tabanda
 *   OLMAYAN bir kisinin "Düzenle'den elle eklendigi" mi yoksa "sol formdan
 *   silindigi" mi oldugunu ayirt etmenin tek yoludur.
 */
export function mergeDashOverride(base, override, varsayilanOran) {
  if (!override?.data) return base;
  const { data, baseNames } = override;
  // Taban henuz yoksa (Excel yuklenmedi / "Hesapla"ya basilmadi) rotus tek
  // basina gecerlidir - PO bos ekranda Düzenle ile her seyi elle girebilir.
  if (!base?.persons?.length) return data;

  const rotuslar = new Map((data.persons || []).map((p) => [personKey(p), p]));
  const tabandakiler = new Set(personKeys(base.persons));
  const uygulamaAninda = new Set(baseNames || []);

  // 1) Kim VAR: taban belirler. Rotusu olan kisi rotuslu haliyle gelir.
  const persons = (base.persons || []).map((p) => rotuslar.get(personKey(p)) || p);

  // 2) Rotusta olup tabanda olmayanlar. Uygula aninda da tabanda YOKSA bu kisi
  //    Düzenle'nin "+ Takım üyesi ekle" dugmesiyle eklenmistir - korunur.
  //    Uygula aninda tabanda VARDIYSA sol formdan silinmis demektir - dusulur.
  for (const [k, p] of rotuslar) {
    if (!tabandakiler.has(k) && !uygulamaAninda.has(k)) persons.push(p);
  }

  return {
    // Modalin DOKUNMADIGI alanlar (takim adi, sprint no, tarih araligi, rapor
    // tarihi, tablo basliklari...) tabandan gelir - sol formda sprint numarasi
    // duzeltilince slayt da duzelsin diye.
    ...base,
    // Modalin duzenledigi alanlar rotustan gelir.
    delta: data.delta,
    customKpis: data.customKpis,
    persons,
    // Ust ozet BIRLESMIS listeden yeniden turetilir - yoksa yeni eklenen kisi
    // tabloda gorunup toplamlara girmezdi.
    kpis: computeKpisFromPersons(persons, data.kpis?.durum, varsayilanOran),
  };
}
