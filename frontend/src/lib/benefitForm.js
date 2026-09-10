import { BENEFIT_CATEGORIES } from "./benefitTypes";

/**
 * "Zaman Dışı Fayda" giriş formunun ortak mantığı.
 *
 * İKİ EKRAN kullanıyor: RPA sunum editöründeki Kazançlar penceresi
 * (BenefitsModal) ve admin giriş ekranı (BenefitsAdminPage). Aynı veriyi aynı
 * uca yazdıkları için doğrulama ve dönüşüm tek yerde duruyor — biri değişip
 * diğeri geride kalmasın.
 *
 * Kategoriler benefitTypes'tan gelir; backend'deki BenefitType ile birebir
 * aynı key/sıra.
 */

export const BENEFIT_TYPES = BENEFIT_CATEGORIES.map((k) => ({
  key: k.key,
  label: k.label,
  color: k.color,
  /** Yalnızca finansal kazanımda toplam tutar + para birimi girilir. */
  hasValue: k.key === "finansalKazanim",
}));

export const EMPTY_BENEFIT_FORM = () =>
  Object.fromEntries(BENEFIT_TYPES.map((t) => [t.key, { processCount: "", value: "", currency: "TRY" }]));

/** Kayıtlı satırlardan (bir dönem) form durumu üretir - boş değer "" (bilinmiyor). */
export function benefitFormFromRows(rows) {
  const form = EMPTY_BENEFIT_FORM();
  for (const r of rows || []) {
    if (!form[r.key]) continue;
    form[r.key] = {
      processCount: r.processCount == null ? "" : String(r.processCount),
      value: r.value == null ? "" : String(r.value),
      currency: r.currency || "TRY",
    };
  }
  return form;
}

/** En son güncellenen dönem - entegrasyon ucunun seçtiği dönemle AYNI kural. */
export function latestBenefitPeriod(rows) {
  let best = null;
  for (const r of rows || []) {
    if (!best || String(r.updatedAt || "") > String(best.updatedAt || "")) best = r;
  }
  return best ? best.period : String(new Date().getFullYear());
}

function toNumber(s) {
  const t = String(s ?? "").trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Formu API gövdesine çevirir ve doğrular.
 *
 * Boş bırakılan süreç sayısı `null` gider — "bilinmiyor" demektir ve dış
 * panoda 0'dan FARKLI gösterilir (dış sözleşmenin açık kuralı). Bu yüzden
 * boş alanı 0'a çevirmiyoruz.
 *
 * Döner: { entries } ya da { hata }.
 */
export function benefitEntriesFromForm(form) {
  const entries = [];
  for (const t of BENEFIT_TYPES) {
    const f = form[t.key] || {};
    const count = toNumber(f.processCount);
    const value = t.hasValue ? toNumber(f.value) : null;
    if (Number.isNaN(count) || Number.isNaN(value)) {
      return { hata: `"${t.label}" için sayısal bir değer girin.` };
    }
    if (count != null && (count < 0 || !Number.isInteger(count))) {
      return { hata: `"${t.label}" süreç sayısı 0 veya pozitif tam sayı olmalı.` };
    }
    entries.push({
      key: t.key,
      processCount: count,
      value: t.hasValue ? value : null,
      currency: t.hasValue && value != null ? (f.currency || "TRY").trim().toUpperCase() : null,
    });
  }
  return { entries };
}
