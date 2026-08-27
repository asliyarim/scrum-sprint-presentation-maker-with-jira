/**
 * Sprint numarasi yardimcilari.
 *
 * sprint_no veritabaninda METIN olarak tutulur (bkz. SprintPresentationJpaEntity /
 * PresentationUpsertRequest) - bu yuzden "en son sprint" bulunurken metin
 * siralamasina GUVENILEMEZ ("10" < "9" cikardi). Karsilastirma her zaman
 * sayiya cevrilerek yapilir; ayni kural PresentationListPanel'in toplu
 * indirme siralamasinda da uygulaniyor.
 */

/** "7" -> 7, " 12 " -> 12, "Sprint 7" -> 7. Sayi cikmazsa null. */
export function parseSprintNo(value) {
  if (value == null) return null;
  const n = parseInt(String(value).trim().replace(/^\D+/, ""), 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * Verilen sunum listesindeki EN YUKSEK sprint numarasi (sayisal olmayan
 * kayitlar yok sayilir). Liste bos/gecersizse null.
 */
export function latestSprintNo(presentations) {
  if (!Array.isArray(presentations)) return null;
  let max = null;
  for (const p of presentations) {
    const n = parseSprintNo(p?.sprintNo);
    if (n != null && (max == null || n > max)) max = n;
  }
  return max;
}

/**
 * Sihirbaz bos acildiginda kapakta onerilecek sprint numarasi: takimin
 * KAYITLI en son sunumunun sprintinin bir fazlasi (bkz. kullanici bildirimi
 * 2026-08-21 - onceden sabit "7" yaziyordu). Takimin hic sunumu yoksa "1".
 *
 * Form alani metin tuttugu ve backend @NotBlank bekledigi icin HER ZAMAN
 * dolu bir string doner.
 */
export function nextSprintNo(presentations) {
  const latest = latestSprintNo(presentations);
  return String(latest == null ? 1 : latest + 1);
}

/**
 * Sunum listesini SPRINT NUMARASINA gore siralar (yeni bir dizi doner, girdi
 * degistirilmez).
 *
 * sprint_no METIN oldugu icin duz siralama yaniltir ("10" < "9"); once sayiya
 * cevrilir. Sayiya cevrilemeyen kayitlar (orn. "50-b") listenin SONUNA konur
 * ve kendi aralarinda metin olarak siralanir - kaybolmasinlar.
 *
 * @param azalan true (varsayilan) ise buyukten kucuge - "Sunumlarım"da en
 *   guncel sprint en ustte olsun diye. Toplu PPTX indirmede ise sunum
 *   kronolojik olmali, orada azalan=false ile cagrilir.
 */
export function sortBySprintNo(presentations, azalan = true) {
  const yon = azalan ? -1 : 1;
  return [...(presentations || [])].sort((a, b) => {
    const na = parseSprintNo(a?.sprintNo);
    const nb = parseSprintNo(b?.sprintNo);
    if (na != null && nb != null) return (na - nb) * yon;
    if (na != null) return -1;
    if (nb != null) return 1;
    return String(a?.sprintNo || "").localeCompare(String(b?.sprintNo || ""));
  });
}
