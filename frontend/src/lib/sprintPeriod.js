/**
 * Sprint tarih aralığının takvimden seçilmesi (Gözde onayı 2026-09-09:
 * "Tarih alanını takvimden seçtirelim mi? olur").
 *
 * Neden gerekliydi: alan serbest metindi ve ekipler farklı biçimlerde
 * yazıyordu — "10 Temmuz – 24 Temmuz" (yılsız), "3 Haziran - 18 Haziran"
 * (farklı tire), "27.07.2026 – 06.08.2026", hatta "8 Haziran– 18 Haziran"
 * (tireden önce boşluksuz). Otomatik ortak sunum ekipleri döneme göre
 * eşleştireceği için bu belirsizliğin bitmesi gerekiyordu.
 *
 * TASARIM KARARI — metin hâlâ tek kaynak: takvimden seçilen tarihler
 * `formatPeriod` ile KESİN bir biçime ("27.07.2026 – 06.08.2026")
 * çevrilip mevcut `range` alanına yazılır. Slayt altyazısı, PPTX çıktısı
 * ve sunum listesi bu metni okumaya devam eder, yani hiçbiri değişmez.
 * Backend aynı metni ayrıştırıp gerçek tarihleri kolonlara yazar
 * (bkz. SprintPeriodParser / V34).
 */

const TR_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const iki = (n) => String(n).padStart(2, "0");

/** "2026-07-27" (input[type=date] değeri) -> "27.07.2026" */
export function isoToTr(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

/** "27.07.2026" -> "2026-07-27"; çevrilemezse "" */
export function trToIso(tr) {
  const m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(String(tr || "").trim());
  return m ? `${m[3]}-${iki(+m[2])}-${iki(+m[1])}` : "";
}

/**
 * İki ISO tarihten slaytta görünecek metni üretir. Uzun tire (–) kullanılır,
 * çünkü mevcut kayıtların çoğu ve PO'ların alışkanlığı bu yönde.
 */
export function formatPeriod(startIso, endIso) {
  const s = isoToTr(startIso);
  const e = isoToTr(endIso);
  if (!s || !e) return "";
  return `${s} – ${e}`;
}

/**
 * Serbest metin aralığı takvim alanlarına yüklemek için ayrıştırır.
 * Backend'deki SprintPeriodParser ile AYNI kuralları uygular - eski
 * kayıtlar açıldığında takvim alanları dolu gelsin diye.
 *
 * Yılsız metinlerde (çoğu eski kayıt böyle) yıl `referenceYear`'dan alınır;
 * ay referanstan 6 aydan fazla saparsa yıl kaydırılır (Aralık/Ocak sınırı).
 *
 * @returns {{start: string, end: string} | null} ISO biçiminde
 */
export function parsePeriodText(raw, referenceDate = new Date()) {
  if (!raw) return null;
  const m = /\s*[–—-]\s*/.exec(String(raw).trim());
  if (!m || m.index === 0) return null;
  const text = String(raw).trim();
  const endText = text.slice(m.index + m[0].length).trim();
  const startText = text.slice(0, m.index).trim();
  if (!endText) return null;

  const end = parseOne(endText, referenceDate);
  if (!end) return null;
  let start = parseOne(startText, end);
  if (!start) return null;
  // "28 Aralık – 10 Ocak": başlangıç bitişten sonra görünüyorsa bir yıl geriye.
  if (start > end) start = new Date(Date.UTC(start.getUTCFullYear() - 1, start.getUTCMonth(), start.getUTCDate()));
  if (start > end) return null;
  return { start: toIso(start), end: toIso(end) };
}

function toIso(d) {
  return `${d.getUTCFullYear()}-${iki(d.getUTCMonth() + 1)}-${iki(d.getUTCDate())}`;
}

function mkDate(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt : null;
}

function parseOne(s, reference) {
  const dotted = /(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(s);
  if (dotted) return mkDate(+dotted[3], +dotted[2], +dotted[1]);

  const named = /(\d{1,2})\s*([A-Za-zÇĞİÖŞÜçğıöşü]+)(?:\s+(\d{4}))?/.exec(s);
  if (named) {
    const month = TR_MONTHS.findIndex((x) => x.toLocaleLowerCase("tr-TR") === named[2].toLocaleLowerCase("tr-TR")) + 1;
    if (month === 0) return null;
    if (named[3]) return mkDate(+named[3], month, +named[1]);
    if (!reference) return null;
    const refYear = reference.getUTCFullYear();
    let d = mkDate(refYear, month, +named[1]);
    if (!d) return null;
    const diffMonths = (d.getUTCFullYear() - refYear) * 12 + (d.getUTCMonth() - reference.getUTCMonth());
    if (diffMonths > 6) d = mkDate(refYear - 1, month, +named[1]);
    else if (diffMonths < -6) d = mkDate(refYear + 1, month, +named[1]);
    return d;
  }
  return null;
}
