package com.aksa.capacityplanner.unit.presentation;

import com.aksa.capacityplanner.presentation.domain.PeriodGrouper;
import com.aksa.capacityplanner.presentation.domain.SprintPeriodParser;
import com.aksa.capacityplanner.presentation.domain.SprintPresentation;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Donem gruplama - otomatik ortak sunumun cekirdegi.
 *
 * Testler UYDURMA VERI DEGIL: uretimdeki 8 ekibin gercek tarih araliklariyla
 * kuruluyor (2026-09-09 taramasi). Beklenen gruplar da uydurma degil - Gözde
 * ayni gun dogru gruplari elle cikarip gonderdi ("hepimizin ilk sunumu ilk
 * toplu sunum" diye), testler onun listesini dogruluyor.
 */
class PeriodGrouperTest {

    private static final LocalDate REF = LocalDate.of(2026, 8, 15);

    /** Takim adlarini id'ye cevirir - testin okunur kalmasi icin. */
    private static final Map<String, Long> TAKIM = Map.of(
            "DSYS", 1L, "RPA", 2L, "UrunGel", 3L, "IsZekasi", 4L,
            "Mobil", 5L, "CBS", 6L, "YapayZeka", 7L, "Dijital", 8L);

    private final List<SprintPresentation> hepsi = new ArrayList<>();
    private long seq = 1;

    private void ekle(String takim, String sprintNo, String aralik) {
        SprintPresentation p = new SprintPresentation();
        p.setId(seq++);
        p.setTeamId(TAKIM.get(takim));
        p.setSprintNo(sprintNo);
        p.setDateRange(aralik);
        p.setUpdatedAt(Instant.parse("2026-09-01T10:00:00Z").plusSeconds(seq));
        SprintPeriodParser.parse(aralik, REF).ifPresent(d -> {
            p.setPeriodStart(d.start());
            p.setPeriodEnd(d.end());
        });
        hepsi.add(p);
    }

    /**
     * Uretimdeki 8 ekibin gercek tarihleri (ekran goruntulerinden, 2026-09-09).
     * Gözde bu taramadan sonra Dijital S9 ve RPA S13'un tarihlerini duzeltti;
     * burada TARAMA ANINDAKI degerler duruyor, cunku test gruplamanin bozuk
     * veriyle ne yaptigini da olcuyor.
     */
    private void uretimVerisiniYukle() {
        ekle("DSYS", "14", "24.08.2026 – 07.09.2026");
        ekle("DSYS", "13", "24.07.2026 – 06.08.2026");
        ekle("DSYS", "12", "10.07.2026 – 23.07.2026");
        ekle("DSYS", "11", "19.06.2026 – 09.07.2026");
        ekle("DSYS", "10", "5 Haziran – 18 Haziran");

        ekle("RPA", "18", "06.08.2026 – 03.09.2026");
        ekle("RPA", "17", "27.07.2026 – 06.08.2026");
        ekle("RPA", "16", "9 Temmuz – 23 Temmuz");
        ekle("RPA", "15", "18 Haziran – 9 Temmuz");
        ekle("RPA", "13", "7 Mayıs - 4 Haziran");

        ekle("UrunGel", "13", "24.07.2026 – 03.08.2026");
        ekle("UrunGel", "12", "27.07.2026 – 10.08.2026");
        ekle("UrunGel", "11", "13.07.2026 – 27.07.2026");
        ekle("UrunGel", "10", "29.06.2026 – 13.07.2026");
        ekle("UrunGel", "9", "1 Haziran – 19 Haziran");

        ekle("IsZekasi", "5", "07.08.2026 – 03.09.2026");
        ekle("IsZekasi", "4", "24 Temmuz – 6 Ağustos");
        ekle("IsZekasi", "3", "10 Temmuz – 23 Temmuz");
        ekle("IsZekasi", "2", "19 Haziran – 9 Temmuz");
        ekle("IsZekasi", "1", "3 Haziran - 18 Haziran");

        ekle("Mobil", "7", "10 Ağustos – 3 Eylül");
        ekle("Mobil", "6", "24 Temmuz – 6 Ağustos");
        ekle("Mobil", "5", "10 Temmuz – 23 Temmuz");
        ekle("Mobil", "4", "19 Haziran – 10 Temmuz");

        ekle("CBS", "12", "7 Ağustos – 3 Eylül");
        ekle("CBS", "11", "24 Temmuz – 6 Ağustos");
        ekle("CBS", "10", "10 Temmuz – 23 Temmuz");
        ekle("CBS", "9", "19 Haziran - 9 Temmuz");
        ekle("CBS", "8", "8 Haziran– 18 Haziran");

        ekle("YapayZeka", "9", "21 Ağustos – 4 Eylül");
        ekle("YapayZeka", "8", "24 Temmuz – 7 Ağustos");
        ekle("YapayZeka", "7", "10 Temmuz – 24 Temmuz");
        ekle("YapayZeka", "6", "19 Haziran – 9 Temmuz");
        ekle("YapayZeka", "5", "5 Haziran – 19 Haziran");

        ekle("Dijital", "13", "10 Ağustos – 3 Eylül");
        ekle("Dijital", "12", "24 Temmuz – 7 Ağustos");
        ekle("Dijital", "11", "13 Temmuz – 24 Temmuz");
        ekle("Dijital", "10", "10 Temmuz – 23 Temmuz");
        ekle("Dijital", "9", "1 Haziran – 12 Haziran");
    }

    private PeriodGrouper.Donem donem(int yil, int ay, int gun) {
        return PeriodGrouper.grupla(hepsi).stream()
                .filter(d -> d.bitis().equals(LocalDate.of(yil, ay, gun)))
                .findFirst().orElseThrow(() -> new AssertionError(
                        "beklenen donem yok: " + LocalDate.of(yil, ay, gun) + " - bulunanlar: "
                                + PeriodGrouper.grupla(hepsi).stream().map(PeriodGrouper.Donem::bitis).toList()));
    }

    @Test
    void uretimVerisininTamamiTarihlendi() {
        uretimVerisiniYukle();
        assertThat(hepsi).hasSize(39);
        assertThat(hepsi).allSatisfy(p ->
                assertThat(p.getPeriodEnd()).as("sprint %s cevrilemedi", p.getSprintNo()).isNotNull());
    }

    /**
     * GOZDE'NIN LISTESI: "konum tabanlı sprint 10 - mobil uygulamalar sprint 5 -
     * iş zekası sprint 3 - ürün geliştirme sprint 11 - yapay zeka sprint 7 -
     * dijital uygulamalar sprint 11 - doküman süreç sprint 12 - rpa sprint 16".
     *
     * Urun Gelistirme S11 27 Temmuz'da bitiyor, yani donemin agirlik merkezi
     * olan 23 Temmuz'dan 4 gun sonra - ILK SURUMDE bu yuzden tek basina ayri
     * bir "donem" olmustu. Zincir kurali onu dogru yere koyuyor.
     */
    @Test
    void yirmiUcTemmuzDonemiGozdeninListesiyleAyni() {
        uretimVerisiniYukle();
        PeriodGrouper.Donem d = donem(2026, 7, 23);

        assertThat(d.takimSayisi()).isEqualTo(8);
        assertThat(d.sunumlar()).extracting(SprintPresentation::getTeamId)
                .contains(TAKIM.get("CBS"), TAKIM.get("Mobil"), TAKIM.get("IsZekasi"), TAKIM.get("UrunGel"),
                        TAKIM.get("YapayZeka"), TAKIM.get("Dijital"), TAKIM.get("DSYS"), TAKIM.get("RPA"));
        assertThat(d.sonBitis()).as("Urun Gelistirme S11 27 Temmuz'da bitiyor").isEqualTo(LocalDate.of(2026, 7, 27));
    }

    /**
     * GOZDE'NIN LISTESI: "rpa sprint 15 - doküman s. sprint11 - dijital
     * uygulamalar sprint 10 - yapay zeka s6 - ürün geliştirme s10 - iş zekası
     * sprint 2 - mobil uygulamalar sprint 4 - konum tabanlı sprint 9" = 8 ekip.
     *
     * Sistem 7 buluyor: Dijital S10'un tarihi (10-23 Temmuz) yanlis, o yuzden
     * bir sonraki doneme dusuyor. EKSIGIN GORUNMESI DOGRU DAVRANIS - tarih
     * duzeltilene kadar sessizce dogru yere tasimiyoruz.
     */
    @Test
    void dokuzTemmuzDonemindeDijitalinTarihiYuzundenBirEkipEksik() {
        uretimVerisiniYukle();
        PeriodGrouper.Donem d = donem(2026, 7, 9);

        assertThat(d.takimSayisi()).isEqualTo(7);
        assertThat(d.sunumlar()).extracting(SprintPresentation::getTeamId)
                .doesNotContain(TAKIM.get("Dijital"));
        assertThat(d.sunumlar()).extracting(SprintPresentation::getTeamId)
                .as("Urun Gelistirme S10 13 Temmuz'da bitiyor ama bu doneme ait")
                .contains(TAKIM.get("UrunGel"));
    }

    /**
     * Gözde'nin sordugu durum: "sprint 14 doküman süreç olan son kapatılan
     * sprint orda ne hata var". Cevap: hata yok - 7 Eylul'de bitiyor, digerleri
     * 3-4 Eylul'de; zincir kuraliyla ayni doneme giriyor.
     */
    @Test
    void ucEylulDonemiDokumanSprint14uDeIcerir() {
        uretimVerisiniYukle();
        PeriodGrouper.Donem d = donem(2026, 9, 3);

        assertThat(d.takimSayisi()).isEqualTo(7);
        assertThat(d.sunumlar()).extracting(SprintPresentation::getTeamId).contains(TAKIM.get("DSYS"));
        assertThat(d.ilkBitis()).isEqualTo(LocalDate.of(2026, 9, 3));
        assertThat(d.sonBitis()).isEqualTo(LocalDate.of(2026, 9, 7));
    }

    /** Agustos donemi TEK donemdir - ilk surumde 6 + 3 diye ikiye bolunuyordu. */
    @Test
    void agustosDonemiTekParcadir() {
        uretimVerisiniYukle();
        PeriodGrouper.Donem d = donem(2026, 8, 6);

        assertThat(d.takimSayisi()).isEqualTo(8);
        assertThat(d.sunumlar()).hasSize(9); // Urun Gelistirme iki sunumla giriyor
        assertThat(d.cakisanTakimlar()).containsExactly(TAKIM.get("UrunGel"));
    }

    /**
     * Donemin adi, EN COK ekibin sprintini bitirdigi gundur - herkesin bildigi
     * tarih budur. 23 Temmuz'da alti, 24'unde iki, 27'sinde bir sunum bitiyor.
     */
    @Test
    void donemAdiEnCokEkibinBitirdigiGundur() {
        uretimVerisiniYukle();
        assertThat(PeriodGrouper.grupla(hepsi)).extracting(PeriodGrouper.Donem::bitis)
                .containsExactly(
                        LocalDate.of(2026, 9, 3),
                        LocalDate.of(2026, 8, 6),
                        LocalDate.of(2026, 7, 23),
                        LocalDate.of(2026, 7, 9),
                        LocalDate.of(2026, 6, 18),
                        LocalDate.of(2026, 6, 12),   // Dijital S9 - Gözde sonradan duzeltti
                        LocalDate.of(2026, 6, 4));   // RPA S13 - Gözde sonradan duzeltti
    }

    /**
     * ZINCIR KURALININ GUVENLIK PAYI. Zincirleme gruplamanin bilinen riski
     * kucuk adimlarla her seyin tek yigina donusmesidir; burada bu mumkun
     * degil cunku sprintler ~2 hafta suruyor. Bu test o payi SABITLER: donem
     * ici en buyuk bosluk toleransin altinda, donemler arasi en kucuk bosluk
     * toleransin ustunde kalmali. Biri toleransi yukseltirse burasi kirilir.
     */
    @Test
    void zincirKuralininGuvenlikPayiKorunuyor() {
        uretimVerisiniYukle();
        List<PeriodGrouper.Donem> donemler = PeriodGrouper.grupla(hepsi);

        long donemIciEnBuyukBosluk = 0;
        for (PeriodGrouper.Donem d : donemler) {
            List<LocalDate> tarihler = d.sunumlar().stream().map(SprintPresentation::getPeriodEnd).sorted().toList();
            for (int i = 1; i < tarihler.size(); i++) {
                donemIciEnBuyukBosluk = Math.max(donemIciEnBuyukBosluk,
                        tarihler.get(i).toEpochDay() - tarihler.get(i - 1).toEpochDay());
            }
        }

        // Donemler en yeniden eskiye sirali; ardisik donemler arasindaki bosluk
        List<PeriodGrouper.Donem> eskidenYeniye = new ArrayList<>(donemler);
        java.util.Collections.reverse(eskidenYeniye);
        long donemlerArasiEnKucukBosluk = Long.MAX_VALUE;
        for (int i = 1; i < eskidenYeniye.size(); i++) {
            donemlerArasiEnKucukBosluk = Math.min(donemlerArasiEnKucukBosluk,
                    eskidenYeniye.get(i).ilkBitis().toEpochDay() - eskidenYeniye.get(i - 1).sonBitis().toEpochDay());
        }

        assertThat(donemIciEnBuyukBosluk)
                .as("donem ici bosluk toleransi asarsa donem ikiye bolunur")
                .isLessThanOrEqualTo(PeriodGrouper.VARSAYILAN_TOLERANS_GUN);
        assertThat(donemlerArasiEnKucukBosluk)
                .as("donemler arasi bosluk toleransin altina inerse iki donem birlesir")
                .isGreaterThan(PeriodGrouper.VARSAYILAN_TOLERANS_GUN);
        assertThat(donemIciEnBuyukBosluk).isEqualTo(3);
        assertThat(donemlerArasiEnKucukBosluk).isEqualTo(6);
    }

    /**
     * Dijital Uygulamalar'in S10 (10-23 Temmuz) ve S11 (13-24 Temmuz)
     * tarihleri ayni doneme dusuyor. Bu bir veri tutarsizligi ve gorunur
     * olmali (Gözde onayladi: "iki sprint aynı tarih olmamalı").
     */
    @Test
    void ayniTakimdanIkiSunumDusenDonemIsaretlenir() {
        uretimVerisiniYukle();
        PeriodGrouper.Donem d = donem(2026, 7, 23);

        assertThat(d.cakisanTakimlar()).containsExactly(TAKIM.get("Dijital"));
    }

    /** Cakisma halinde o takimin EN SON GUNCELLENEN sunumu secilir. */
    @Test
    void cakismadaEnSonGuncellenenSecilir() {
        uretimVerisiniYukle();
        SprintPresentation secilen = donem(2026, 7, 23).takiminSunumu(TAKIM.get("Dijital"));

        assertThat(secilen).isNotNull();
        // S10 listeye S11'den SONRA eklendi, yani updatedAt'i daha buyuk.
        assertThat(secilen.getSprintNo()).isEqualTo("10");
    }

    /** Donem tarihi olmayan sunumlar hic gruplanmaz - sessizce yanlis doneme dusmemeli. */
    @Test
    void tarihsizSunumlarGruplanmaz() {
        uretimVerisiniYukle();
        SprintPresentation tarihsiz = new SprintPresentation();
        tarihsiz.setId(999L);
        tarihsiz.setTeamId(TAKIM.get("RPA"));
        tarihsiz.setSprintNo("99");
        tarihsiz.setDateRange("belirsiz");
        hepsi.add(tarihsiz);

        long toplamSunum = PeriodGrouper.grupla(hepsi).stream().mapToLong(d -> d.sunumlar().size()).sum();
        assertThat(toplamSunum).as("tarihsiz sunum hicbir doneme girmemeli").isEqualTo(39);
    }

    /**
     * ZINCIRIN KOPRULENME RISKI. Iki donem arasindaki bosluk 6 gunse ve tam
     * ortasina tek bir sunum duserse, o sunum her iki yana da 3 gun uzakta
     * kalir ve zinciri birlestirebilirdi. MAKS_DONEM_YAYILIMI_GUN bunu
     * yapisal olarak engelliyor; bu test o korumayi dogrudan zorluyor.
     *
     * Kurgu: 1 Temmuz'da biten bir donem, 20 Temmuz'da biten bir donem ve
     * aralarina 3'er gun arayla dizilmis sunumlar. Koruma olmasaydi hepsi
     * TEK donem olurdu.
     */
    @Test
    void araligaSerpistirilmisSunumlarIkiDonemiBirlestiremez() {
        ekle("DSYS", "1", "17.06.2026 – 01.07.2026");
        ekle("RPA", "1", "17.06.2026 – 01.07.2026");
        // Kopru olmaya aday ara sunumlar - 3'er gun arayla
        ekle("UrunGel", "1", "20.06.2026 – 04.07.2026");
        ekle("IsZekasi", "1", "23.06.2026 – 07.07.2026");
        ekle("Mobil", "1", "26.06.2026 – 10.07.2026");
        ekle("CBS", "1", "29.06.2026 – 13.07.2026");
        ekle("YapayZeka", "1", "02.07.2026 – 16.07.2026");
        ekle("Dijital", "1", "06.07.2026 – 20.07.2026");

        List<PeriodGrouper.Donem> donemler = PeriodGrouper.grupla(hepsi);

        assertThat(donemler).as("yayilim siniri olmasa tek donem olurdu").hasSizeGreaterThan(1);
        assertThat(donemler).allSatisfy(d ->
                assertThat(d.sonBitis().toEpochDay() - d.ilkBitis().toEpochDay())
                        .as("hicbir donem %d gunden genis olamaz", PeriodGrouper.MAKS_DONEM_YAYILIMI_GUN)
                        .isLessThanOrEqualTo(PeriodGrouper.MAKS_DONEM_YAYILIMI_GUN));
    }

    /** Ust sinir gercek donemleri BOLMEMELI - uretimdeki en genis donem 7 gun. */
    @Test
    void yayilimSiniriGercekDonemleriBolmez() {
        uretimVerisiniYukle();
        List<PeriodGrouper.Donem> donemler = PeriodGrouper.grupla(hepsi);

        long enGenisDonem = donemler.stream()
                .mapToLong(d -> d.sonBitis().toEpochDay() - d.ilkBitis().toEpochDay())
                .max().orElse(0);

        assertThat(enGenisDonem).as("uretimdeki en genis donem: 3-10 Agustos").isEqualTo(7);
        assertThat(enGenisDonem)
                .as("sinir bunun altina inerse gercek donemler ikiye bolunur")
                .isLessThan(PeriodGrouper.MAKS_DONEM_YAYILIMI_GUN);
    }

    @Test
    void bosGirdiBosDoner() {
        assertThat(PeriodGrouper.grupla(List.of())).isEmpty();
    }
}
