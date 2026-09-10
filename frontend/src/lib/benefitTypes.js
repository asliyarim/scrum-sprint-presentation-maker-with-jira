/**
 * ZAMAN DIŞI FAYDA kategorileri — RPA sunumundaki kazanım çubuğu.
 *
 * Neden ayrı bir modül: bu liste hem çubuk editöründe (sabit satırlar), hem
 * slaytın altındaki renk açıklamasında, hem PPTX çıktısında, hem de ileride
 * Nezih Bey'in dış panosuna veri veren serviste kullanılacak. Tek kaynakta
 * durması, birinde değişip diğerinde unutulmasını engelliyor.
 *
 * RENK KATEGORİYE SABİT BAĞLI — kullanıcı seçmez. Normal hedef çubuklarında
 * renk serbesttir, ama burada rengin bir ANLAMI var: slaytın altındaki
 * açıklama ve dış pano veriyi renge/sıraya göre okuyacak. Serbest bıraksaydık
 * iki sunumda aynı renk farklı şeyi ifade edebilir, veri güvenilmez olurdu
 * (kullanıcı isteği 2026-09-10: "renk kodları var ya oradan veriler okunmalı").
 *
 * SIRA DA SABİT: segmentler bu dizideki sırayla üretilir, yani segment
 * indeksi ile kategori arasında birebir karşılık vardır. Dış servis çubuğu
 * `kind === "benefit"` ile bulup indeksten kategoriyi çözebilir.
 *
 * DİKKAT — kategori adları Pelinsu'ya soruldu (2026-09-10), yanıt gelince
 * yalnızca bu dizi güncellenecek; başka hiçbir yere dokunmak gerekmiyor.
 * Eski `BenefitType` enum'u (backend, 6 tür) henüz DEĞİŞMEDİ; dış sözleşme
 * kararı netleşmeden ona dokunulmuyor.
 */

/** Çubuğu diğer hedef çubuklarından ayıran işaret - içerikte saklanır. */
export const BENEFIT_BAR_KIND = "benefit";

/** Çubuğun slayttaki etiketi. */
export const BENEFIT_BAR_LABEL = "ZAMAN DIŞI FAYDA";

/**
 * Kategoriler — sıra ve renk SABİT. `color` değerleri geometry.SEGCOL
 * anahtarlarıdır.
 *
 * RENKLER PELİNSU'NUN TABLOSUNDAN birebir alındı (2026-09-10): kalite sarı,
 * operasyonel mavi, risk kırmızı, çalışan/müşteri mor, finansal yeşil.
 * Önce tahmin edilmişti ve üçü yanlıştı; sunumda ekiplerin alışık olduğu
 * renklerle aynı görünmesi için tabloya uyduruldu.
 */
export const BENEFIT_CATEGORIES = [
  { key: "kaliteDogrulukSureklilik", label: "Kalite, Doğruluk ve Süreklilik", color: "amber" },
  { key: "operasyonelVerimlilik", label: "Operasyonel Verimlilik", color: "blue" },
  { key: "riskUyumDenetim", label: "Risk, Uyum ve Denetim", color: "red" },
  { key: "calisanMusteriDeneyimi", label: "Çalışan ve Müşteri Deneyimi", color: "purple" },
  { key: "finansalKazanim", label: "Finansal Kazanım", color: "green" },
];

/** Boş bir zaman dışı fayda çubuğu - segmentler kategorilerle birebir. */
export function newBenefitBar() {
  return {
    label: BENEFIT_BAR_LABEL,
    kind: BENEFIT_BAR_KIND,
    segments: BENEFIT_CATEGORIES.map((k) => ({ value: "", color: k.color })),
  };
}

export function isBenefitBar(bar) {
  return !!bar && bar.kind === BENEFIT_BAR_KIND;
}

/** Çubuklar arasından zaman dışı fayda çubuğunu bulur; yoksa null. */
export function findBenefitBar(bars) {
  return (bars || []).find(isBenefitBar) || null;
}

/**
 * Çubuğu kategori/değer çiftlerine çevirir - dış servisin ve renk
 * açıklamasının ortak okuma yolu.
 *
 * Segment sayısı kategori sayısından farklı olabilir (eski bir kayıt, ya da
 * kategori listesi sonradan değişmiş olabilir); o yüzden İNDEKSE göre değil,
 * kategori listesi üzerinden yürünür ve eksik segment `null` değer döner.
 */
export function benefitEntries(bar) {
  if (!isBenefitBar(bar)) return [];
  const segs = bar.segments || [];
  return BENEFIT_CATEGORIES.map((k, i) => {
    const ham = segs[i] ? String(segs[i].value ?? "").trim() : "";
    const sayi = ham === "" ? null : Number(ham.replace(",", "."));
    return {
      key: k.key,
      label: k.label,
      color: k.color,
      value: Number.isFinite(sayi) ? sayi : null,
    };
  });
}
