package com.aksa.capacityplanner.presentation.domain;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Sunumlari DONEMLERE ayirir - otomatik ortak sunumun cekirdegi.
 *
 * NEDEN BITIS TARIHINE GORE: uretimdeki 8 ekibin 39 sunumu incelendi
 * (2026-09-09). Ekipler sprintlerini AYNI GUN bitiriyor - ortak demo gunu.
 * Baslangic tarihleri ise ekipten ekibe kayiyor (kimi 6 Agustos, kimi 10
 * Agustos basliyor), yani baslangica gore gruplamak yanlis sonuc verirdi.
 *
 * NEDEN ZINCIR (single-linkage): ilk surumde her sunum, grubun ILK uyesinin
 * tarihiyle ("capa") karsilastiriliyordu. Bu, bir gun geride kalan uyeleri
 * zincirin disinda birakiyordu: Urun Gelistirme S11 (27 Temmuz) capa olan
 * 23 Temmuz'a 4 gun uzak diye TEK BASINA ayri bir "donem" oluyordu, oysa
 * araya 24 Temmuz'da biten iki sunum giriyordu. Gözde'nin elle cikardigi
 * dogru gruplar (2026-09-09) bu kusuru gosterdi. Simdi ARDISIK iki bitis
 * tarihi arasindaki bosluga bakiliyor: bosluk toleransi asarsa yeni donem
 * baslar, asmazsa zincir devam eder.
 *
 * ZINCIRIN GUVENLIGI: zincirleme yontemin bilinen riski, kucuk adimlarla
 * her seyin tek yigina donusmesidir. Burada bu mumkun degil, cunku sprintler
 * ~2 hafta suruyor: uretim verisinde donem ICINDEKI en buyuk bosluk 3 gun,
 * iki donem ARASINDAKI en kucuk bosluk 6 gun. 3 gunluk tolerans bu ikisinin
 * tam ortasinda duruyor. Bu paylar PeriodGrouperTest'te sabitlendi - biri
 * toleransi yukseltmek isterse test kirilir.
 */
public final class PeriodGrouper {

    /**
     * Varsayilan tolerans (gun). Uretim verisinde donem ici en buyuk bosluk
     * 3 gun oldugundan bu deger tum ekipleri ayni doneme toplar; iki donem
     * arasindaki en kucuk bosluk 6 gun oldugundan da donemleri birbirine
     * karistirmaz.
     */
    public static final int VARSAYILAN_TOLERANS_GUN = 3;

    /**
     * Bir donemin en erken ve en gec bitisi arasindaki EN FAZLA gun sayisi.
     *
     * Zincir kuralinin tek zayif noktasi budur: iki donem arasindaki bosluk 6
     * gunse ve tam ortasina (her iki yana da 3 gun uzakta) tek bir sunum
     * duserse, o sunum iki donemi birbirine baglayabilir. Veri buyudukce bu
     * ihtimal artar. Ust sinir bunu YAPISAL olarak engelliyor: sprintler ~2
     * hafta surdugu icin gercek bir donemin yayilimi bu kadar genis olamaz -
     * uretim verisindeki en genis donem 7 gun (3-10 Agustos). Sinira takilan
     * sunum yeni bir donem baslatir.
     */
    public static final int MAKS_DONEM_YAYILIMI_GUN = 10;

    private PeriodGrouper() {
    }

    /**
     * Bir donem ve o doneme dusen sunumlar. Ayni takimdan birden fazla sunum
     * dusebilir - bu bir veri tutarsizligi isaretidir, cagiran taraf gorunur
     * kilmalidir (bkz. cakisanTakimlar).
     *
     * bitis: donemi TEMSIL eden tarih - en cok ekibin sprintini bitirdigi gun.
     * Ekiplerin cogu 23 Temmuz'da, biri 24'unde, biri 27'sinde bitirdiyse
     * donemin adi "23 Temmuz"dur; herkesin bildigi tarih budur.
     */
    public record Donem(LocalDate bitis, List<SprintPresentation> sunumlar) {

        /** Donemde temsil edilen AYRI takim sayisi (ayni takimin ikinci sunumu sayilmaz). */
        public int takimSayisi() {
            return (int) sunumlar.stream().map(SprintPresentation::getTeamId).distinct().count();
        }

        /** Donemdeki en erken bitis - ekiplerin ne kadar yayildigini gostermek icin. */
        public LocalDate ilkBitis() {
            return sunumlar.stream().map(SprintPresentation::getPeriodEnd).min(Comparator.naturalOrder()).orElse(bitis);
        }

        /** Donemdeki en gec bitis. */
        public LocalDate sonBitis() {
            return sunumlar.stream().map(SprintPresentation::getPeriodEnd).max(Comparator.naturalOrder()).orElse(bitis);
        }

        /** Ayni takimdan birden fazla sunum dusen takimlarin id'leri. */
        public List<Long> cakisanTakimlar() {
            Map<Long, Integer> sayim = new LinkedHashMap<>();
            sunumlar.forEach(s -> sayim.merge(s.getTeamId(), 1, Integer::sum));
            return sayim.entrySet().stream().filter(e -> e.getValue() > 1).map(Map.Entry::getKey).toList();
        }

        /**
         * Bir takimin bu donemdeki sunumu - ayni takimdan birden fazla varsa
         * EN SON GUNCELLENEN secilir (Gözde karari: "Cagdas Bey direkt ilgili
         * tarihin son sunumunu gorsun").
         */
        public SprintPresentation takiminSunumu(Long teamId) {
            return sunumlar.stream()
                    .filter(s -> teamId.equals(s.getTeamId()))
                    .max(Comparator.comparing(SprintPresentation::getUpdatedAt,
                            Comparator.nullsFirst(Comparator.naturalOrder())))
                    .orElse(null);
        }
    }

    public static List<Donem> grupla(List<SprintPresentation> sunumlar) {
        return grupla(sunumlar, VARSAYILAN_TOLERANS_GUN);
    }

    /**
     * Sunumlari donemlere ayirir, EN YENI DONEM BASTA olacak sekilde.
     * Donem tarihi olmayan (cevrilemeyen) sunumlar HIC gruplanmaz - onlar
     * otomatik ortak sunuma giremez, ekibin tarihi duzeltmesi gerekir.
     */
    public static List<Donem> grupla(List<SprintPresentation> sunumlar, int toleransGun) {
        List<SprintPresentation> tarihliler = sunumlar.stream()
                .filter(s -> s != null && s.getPeriodEnd() != null)
                .sorted(Comparator.comparing(SprintPresentation::getPeriodEnd))
                .toList();

        List<List<SprintPresentation>> gruplar = new ArrayList<>();
        LocalDate oncekiBitis = null;
        LocalDate grubunIlkBitisi = null;
        for (SprintPresentation s : tarihliler) {
            long bitis = s.getPeriodEnd().toEpochDay();
            boolean zincirKopuk = oncekiBitis == null || bitis - oncekiBitis.toEpochDay() > toleransGun;
            boolean cokYayildi = grubunIlkBitisi != null
                    && bitis - grubunIlkBitisi.toEpochDay() > MAKS_DONEM_YAYILIMI_GUN;
            if (zincirKopuk || cokYayildi) {
                gruplar.add(new ArrayList<>());
                grubunIlkBitisi = s.getPeriodEnd();
            }
            gruplar.get(gruplar.size() - 1).add(s);
            oncekiBitis = s.getPeriodEnd();
        }

        List<Donem> sonuc = new ArrayList<>();
        for (List<SprintPresentation> grup : gruplar) {
            sonuc.add(new Donem(temsilTarihi(grup), List.copyOf(grup)));
        }
        // En yeni donem basta - admin ekraninda once guncel donem gorunsun.
        sonuc.sort(Comparator.comparing(Donem::bitis).reversed());
        return List.copyOf(sonuc);
    }

    /**
     * Donemi temsil eden tarih: EN COK sunumun bittigi gun. Esitlik halinde
     * gec olan secilir - donemin adi, ekiplerin buyuk kisminin isini bitirdigi
     * gunden once bir tarihi gostermesin.
     */
    private static LocalDate temsilTarihi(List<SprintPresentation> grup) {
        Map<LocalDate, Integer> sayim = new LinkedHashMap<>();
        grup.forEach(s -> sayim.merge(s.getPeriodEnd(), 1, Integer::sum));
        return sayim.entrySet().stream()
                .max(Comparator.<Map.Entry<LocalDate, Integer>>comparingInt(Map.Entry::getValue)
                        .thenComparing(Map.Entry::getKey))
                .map(Map.Entry::getKey)
                .orElseThrow();
    }
}
