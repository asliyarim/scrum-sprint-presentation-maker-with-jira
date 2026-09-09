package com.aksa.capacityplanner.unit.presentation;

import com.aksa.capacityplanner.presentation.domain.SprintPeriod;
import com.aksa.capacityplanner.presentation.domain.SprintPeriodParser;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Serbest metin sprint tarihlerinin ayristirilmasi.
 *
 * Buradaki bicimlerin cogu UYDURULMADI - uretim veritabanindaki gercek
 * date_range degerlerinden alindi (2026-09-09 taramasi).
 */
class SprintPeriodParserTest {

    /** Sunumlarin olusturuldugu donem - yil tahmini icin referans. */
    private static final LocalDate REF = LocalDate.of(2026, 8, 15);

    private SprintPeriod ayristir(String raw) {
        Optional<SprintPeriod> p = SprintPeriodParser.parse(raw, REF);
        assertThat(p).as("ayristirilamadi: %s", raw).isPresent();
        return p.get();
    }

    // --- uretimde GERCEKTEN bulunan bicimler ---

    @Test
    void yilsizUzunTire() {
        SprintPeriod p = ayristir("10 Temmuz – 24 Temmuz");
        assertThat(p.start()).isEqualTo(LocalDate.of(2026, 7, 10));
        assertThat(p.end()).isEqualTo(LocalDate.of(2026, 7, 24));
    }

    @Test
    void yilsizNormalTire() {
        SprintPeriod p = ayristir("3 Haziran - 18 Haziran");
        assertThat(p.start()).isEqualTo(LocalDate.of(2026, 6, 3));
        assertThat(p.end()).isEqualTo(LocalDate.of(2026, 6, 18));
    }

    @Test
    void yilliNoktali() {
        SprintPeriod p = ayristir("27.07.2026 – 06.08.2026");
        assertThat(p.start()).isEqualTo(LocalDate.of(2026, 7, 27));
        assertThat(p.end()).isEqualTo(LocalDate.of(2026, 8, 6));
    }

    @Test
    void ayDegisenAralik() {
        SprintPeriod p = ayristir("22 Haziran – 9 Temmuz");
        assertThat(p.start()).isEqualTo(LocalDate.of(2026, 6, 22));
        assertThat(p.end()).isEqualTo(LocalDate.of(2026, 7, 9));
    }

    @Test
    void uzunAyAdlariVeBuyukHarfDuyarsizligi() {
        assertThat(ayristir("1 ağustos – 15 AĞUSTOS").start()).isEqualTo(LocalDate.of(2026, 8, 1));
        assertThat(ayristir("07.08.2026 – 03.09.2026").end()).isEqualTo(LocalDate.of(2026, 9, 3));
    }

    /**
     * URETIMDEKI TUM DEGERLER (2026-09-09 taramasi, 6 takim / 29 sunum).
     * Hepsi cevrilebilmeli - biri bile cevrilemezse o takim otomatik ortak
     * sunuma giremez ve sessizce dusar.
     */
    @Test
    void uretimdekiTumTarihlerCevrilebiliyor() {
        String[] uretim = {
                // Doküman ve Süreç Yönetim Sistemi
                "24.08.2026 – 07.09.2026", "24.07.2026 – 06.08.2026", "10.07.2026 – 23.07.2026",
                "19.06.2026 – 09.07.2026", "5 Haziran – 18 Haziran",
                // RPA
                "06.08.2026 – 03.09.2026", "27.07.2026 – 06.08.2026", "9 Temmuz – 23 Temmuz",
                "18 Haziran – 9 Temmuz", "7 Mayıs - 4 Haziran",
                // Ürün Geliştirme
                "24.07.2026 – 03.08.2026", "27.07.2026 – 10.08.2026", "13.07.2026 – 27.07.2026",
                "29.06.2026 – 13.07.2026", "1 Haziran – 19 Haziran",
                // İş Zekası
                "07.08.2026 – 03.09.2026", "24 Temmuz – 6 Ağustos", "10 Temmuz – 23 Temmuz",
                "19 Haziran – 9 Temmuz", "3 Haziran - 18 Haziran",
                // Mobil Uygulamalar
                "10 Ağustos – 3 Eylül", "19 Haziran – 10 Temmuz",
                // Konum Tabanlı (CBS)
                "7 Ağustos – 3 Eylül", "19 Haziran - 9 Temmuz",
                // Tireden ONCE bosluk YOK - uretimde gercekten boyle kayitli.
                // Once ayirici deseni iki yanda da bosluk zorunlu tutuyordu ve
                // bu deger cevrilemiyordu (gercek veriyle test edilince yakalandi).
                "8 Haziran– 18 Haziran",
        };
        for (String raw : uretim) {
            assertThat(SprintPeriodParser.parse(raw, REF))
                    .as("uretimdeki deger cevrilemedi: \"%s\"", raw)
                    .isPresent();
        }
    }

    /**
     * Ekipler sprintlerini AYNI GUN bitiriyor (ortak demo gunu) - donem
     * eslestirmesi bu yuzden bitis tarihine gore yapilacak. Uretim verisinden
     * ornek: 3 Eylul'de biten dort takim.
     */
    @Test
    void ayniDonemdekiTakimlarAyniGunBitiriyor() {
        LocalDate beklenen = LocalDate.of(2026, 9, 3);
        String[] ayniDonem = {
                "06.08.2026 – 03.09.2026",  // RPA S18
                "07.08.2026 – 03.09.2026",  // İş Zekası S5
                "10 Ağustos – 3 Eylül",     // Mobil S7
                "7 Ağustos – 3 Eylül",      // CBS S12
        };
        for (String raw : ayniDonem) {
            assertThat(SprintPeriodParser.parse(raw, REF).orElseThrow().end())
                    .as("%s", raw)
                    .isEqualTo(beklenen);
        }
    }

    // --- yil tahmini ---

    @Test
    void yilSinirindaGeriyeKayar() {
        // Ocak'ta olusturulmus bir sunum, Aralik'ta biten bir sprinti anlatiyorsa
        // o Aralik BIR ONCEKI yildir.
        SprintPeriod p = SprintPeriodParser.parse("20 Aralık – 31 Aralık", LocalDate.of(2027, 1, 5)).orElseThrow();
        assertThat(p.start()).isEqualTo(LocalDate.of(2026, 12, 20));
        assertThat(p.end()).isEqualTo(LocalDate.of(2026, 12, 31));
    }

    @Test
    void yilAtlayanAralik() {
        // "28 Aralık – 10 Ocak": baslangic bitisten sonra gorunur, bir yil geriye alinmali.
        SprintPeriod p = SprintPeriodParser.parse("28 Aralık – 10 Ocak", LocalDate.of(2027, 1, 15)).orElseThrow();
        assertThat(p.start()).isEqualTo(LocalDate.of(2026, 12, 28));
        assertThat(p.end()).isEqualTo(LocalDate.of(2027, 1, 10));
        assertThat(p.lengthInDays()).isEqualTo(14);
    }

    @Test
    void metindekiYilReferansiEZER() {
        SprintPeriod p = SprintPeriodParser.parse("01.02.2024 – 15.02.2024", REF).orElseThrow();
        assertThat(p.start().getYear()).isEqualTo(2024);
    }

    // --- cevrilemeyenler: patlamamali, bos donmeli ---

    @Test
    void cevrilemeyenlerBosDoner() {
        assertThat(SprintPeriodParser.parse(null, REF)).isEmpty();
        assertThat(SprintPeriodParser.parse("", REF)).isEmpty();
        assertThat(SprintPeriodParser.parse("   ", REF)).isEmpty();
        assertThat(SprintPeriodParser.parse("belirsiz", REF)).isEmpty();
        assertThat(SprintPeriodParser.parse("10 Temmuz", REF)).as("tek tarih, aralik degil").isEmpty();
        assertThat(SprintPeriodParser.parse("10 Xxxxx – 24 Xxxxx", REF)).as("gecersiz ay adi").isEmpty();
        assertThat(SprintPeriodParser.parse("31 Şubat – 1 Mart", REF)).as("gecersiz gun").isEmpty();
        assertThat(SprintPeriodParser.parse("10 Temmuz – 24 Temmuz", null)).as("referanssiz yilsiz metin").isEmpty();
    }

    // --- ayni doneme sayma (Gözde karari: cakisiyorsa ayni donem) ---

    @Test
    void cakisanDonemlerAyniSayilir() {
        SprintPeriod a = ayristir("24 Temmuz – 3 Ağustos");
        SprintPeriod b = ayristir("27 Temmuz – 10 Ağustos");
        assertThat(a.overlaps(b)).isTrue();
        assertThat(b.overlaps(a)).as("simetrik olmali").isTrue();
    }

    @Test
    void ucNoktasiDegenDonemlerCakisirSayilir() {
        SprintPeriod a = ayristir("10 Temmuz – 24 Temmuz");
        SprintPeriod b = ayristir("24 Temmuz – 6 Ağustos");
        assertThat(a.overlaps(b)).as("kapali aralik - uc noktalarin degmesi cakismadir").isTrue();
    }

    @Test
    void ayrikDonemlerAyniSayilmaz() {
        SprintPeriod a = ayristir("1 Haziran – 19 Haziran");
        SprintPeriod b = ayristir("10 Temmuz – 24 Temmuz");
        assertThat(a.overlaps(b)).isFalse();
    }

    @Test
    void donemBirlestirmeEnGenisAraligiVerir() {
        SprintPeriod a = ayristir("24 Temmuz – 3 Ağustos");
        SprintPeriod b = ayristir("27 Temmuz – 10 Ağustos");
        SprintPeriod birlesik = a.merge(b);
        assertThat(birlesik.start()).isEqualTo(LocalDate.of(2026, 7, 24));
        assertThat(birlesik.end()).isEqualTo(LocalDate.of(2026, 8, 10));
    }

    @Test
    void gunSayisiUcNoktalarDahil() {
        assertThat(ayristir("10 Temmuz – 24 Temmuz").lengthInDays()).isEqualTo(15);
    }
}
