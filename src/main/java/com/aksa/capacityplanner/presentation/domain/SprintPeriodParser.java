package com.aksa.capacityplanner.presentation.domain;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Sunumlardaki SERBEST METIN tarih araligini ({@code date_range}) gercek
 * tarihlere cevirir.
 *
 * Neden gerekli: otomatik ortak sunum, ekipleri "ayni donem" olmalarina gore
 * eslestirecek (Gözde karari 2026-09-09) ama donem bilgisi bugun serbest metin.
 * Uretimdeki gercek degerlerden ornekler:
 *
 *   "10 Temmuz – 24 Temmuz"        (yil YOK, uzun tire)
 *   "3 Haziran - 18 Haziran"       (yil YOK, normal tire)
 *   "27.07.2026 – 06.08.2026"      (yilli, noktali)
 *   "22 Haziran – 9 Temmuz"        (ay degisiyor)
 *
 * YIL TAHMINI: metinde yil yoksa REFERANS TARIHTEN (sunumun olusturulma
 * zamani) turetilir. Sunum genellikle sprint sirasinda ya da hemen sonrasinda
 * olusturuldugu icin referansin yili dogru cevaptir; ancak yil sinirinda
 * (Aralik'ta olusturulmus bir Ocak sprinti gibi) kayma olur, bu yuzden 6 aydan
 * fazla sapma varsa yil bir kaydirilir.
 *
 * ONEMLI - bu sinif TAHMIN yapar. En saglam cozum tarihi kullaniciya takvimden
 * sectirmektir (Gözde'ye soruldu, cevap bekleniyor); o karar cikarsa bu sinif
 * mevcut kayitlari bir kereligine donusturmek icin kullanilir.
 */
public final class SprintPeriodParser {

    private SprintPeriodParser() {
    }

    /** Kucuk harfe cevrilmis Turkce ay adlari - sira ay numarasini verir (0 = Ocak). */
    private static final List<String> TR_MONTHS = List.of(
            "ocak", "şubat", "mart", "nisan", "mayıs", "haziran",
            "temmuz", "ağustos", "eylül", "ekim", "kasım", "aralık");

    /**
     * Araligi ikiye bolen ayirici: uzun tire (–), normal tire (-), uzun cizgi
     * (—) ya da "ile".
     *
     * Tire etrafindaki bosluk OPSIYONEL. Uretimde gercekten su deger var:
     * "8 Haziran– 18 Haziran" (tireden ONCE bosluk yok). Once bosluk zorunlu
     * tutuluyordu ve bu kayit cevrilemiyordu; gercek veriyle test edilince
     * yakalandi (2026-09-09).
     *
     * Tarihin KENDI icindeki noktalar bolmeyi etkilemez; ay adlarindaki
     * harfler de tire icermez, dolayisiyla ilk tire her zaman ayiricidir.
     */
    private static final Pattern SEPARATOR = Pattern.compile("\\s*[–—-]\\s*|\\s+ile\\s+");

    private static final Pattern DOTTED = Pattern.compile("(\\d{1,2})[./](\\d{1,2})[./](\\d{4})");
    private static final Pattern DOTTED_NO_YEAR = Pattern.compile("(\\d{1,2})[./](\\d{1,2})(?![./]?\\d)");
    private static final Pattern NAMED = Pattern.compile("(\\d{1,2})\\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)(?:\\s+(\\d{4}))?");

    /**
     * Serbest metni doneme cevirir. Cevrilemezse {@link Optional#empty()}.
     *
     * @param raw       sunumdaki ham metin (null olabilir)
     * @param reference yil tahmini icin referans (genelde sunumun createdAt'i);
     *                  null verilirse yilsiz metinler cevrilemez
     */
    public static Optional<SprintPeriod> parse(String raw, LocalDate reference) {
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        String[] parts = split(raw.trim());
        if (parts == null) {
            return Optional.empty();
        }

        // Bitisi ONCE cozeriz: bitis tarihi metinde daha sik yillidir ve
        // baslangicin yilini tahmin etmek icin en iyi referanstir.
        LocalDate end = parseSingle(parts[1], reference).orElse(null);
        if (end == null) {
            return Optional.empty();
        }
        LocalDate start = parseSingle(parts[0], end).orElse(null);
        if (start == null) {
            return Optional.empty();
        }
        // Baslangic bitisten sonraysa yil sinirini asmisiz demektir
        // (orn. "28 Aralık – 10 Ocak"): baslangici bir yil geriye al.
        if (start.isAfter(end)) {
            start = start.minusYears(1);
        }
        if (start.isAfter(end)) {
            return Optional.empty(); // hala tutarsizsa guvenme
        }
        return Optional.of(new SprintPeriod(start, end));
    }

    /** Metni baslangic/bitis olarak ikiye boler; bolunemezse null. */
    private static String[] split(String s) {
        Matcher m = SEPARATOR.matcher(s);
        if (m.find() && m.start() > 0 && m.end() < s.length()) {
            return new String[] { s.substring(0, m.start()).trim(), s.substring(m.end()).trim() };
        }
        return null;
    }

    /** Tek bir tarih parcasini cozer. */
    private static Optional<LocalDate> parseSingle(String s, LocalDate reference) {
        Matcher dotted = DOTTED.matcher(s);
        if (dotted.find()) {
            return of(Integer.parseInt(dotted.group(3)), Integer.parseInt(dotted.group(2)),
                    Integer.parseInt(dotted.group(1)));
        }

        Matcher named = NAMED.matcher(s);
        if (named.find()) {
            int day = Integer.parseInt(named.group(1));
            int month = TR_MONTHS.indexOf(named.group(2).toLowerCase(new Locale("tr", "TR"))) + 1;
            if (month == 0) {
                return Optional.empty(); // ay adi taninmadi
            }
            if (named.group(3) != null) {
                return of(Integer.parseInt(named.group(3)), month, day);
            }
            return withInferredYear(month, day, reference);
        }

        // "27.07 – 06.08" gibi yilsiz noktali yazim (uretimde gorulmedi ama
        // PO'lar serbest metne yazabildigi icin desteklenir).
        Matcher noYear = DOTTED_NO_YEAR.matcher(s);
        if (noYear.find()) {
            return withInferredYear(Integer.parseInt(noYear.group(2)), Integer.parseInt(noYear.group(1)), reference);
        }
        return Optional.empty();
    }

    /**
     * Yilsiz bir gun/ay icin yili referanstan tahmin eder. Referansin yiliyla
     * baslanir; sonuc referanstan 6 aydan fazla sapiyorsa yil kaydirilir
     * (Aralik'ta olusturulan bir Ocak sprinti, ya da tersi).
     */
    private static Optional<LocalDate> withInferredYear(int month, int day, LocalDate reference) {
        if (reference == null) {
            return Optional.empty();
        }
        Optional<LocalDate> aday = of(reference.getYear(), month, day);
        if (aday.isEmpty()) {
            return Optional.empty();
        }
        LocalDate d = aday.get();
        long ay = ChronoUnit.MONTHS.between(reference, d);
        if (ay > 6) {
            return of(reference.getYear() - 1, month, day);
        }
        if (ay < -6) {
            return of(reference.getYear() + 1, month, day);
        }
        return Optional.of(d);
    }

    /** Gecersiz tarihlerde (31 Şubat gibi) patlamak yerine bos doner. */
    private static Optional<LocalDate> of(int year, int month, int day) {
        try {
            return Optional.of(LocalDate.of(year, month, day));
        } catch (RuntimeException ignored) {
            return Optional.empty();
        }
    }
}
