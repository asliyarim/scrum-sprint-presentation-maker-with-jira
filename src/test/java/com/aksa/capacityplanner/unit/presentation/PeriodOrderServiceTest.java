package com.aksa.capacityplanner.unit.presentation;

import com.aksa.capacityplanner.common.domain.DomainValidationException;
import com.aksa.capacityplanner.presentation.domain.PeriodTeamOrder;
import com.aksa.capacityplanner.presentation.port.out.PeriodTeamOrderRepositoryPort;
import com.aksa.capacityplanner.presentation.usecase.PeriodOrderService;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Donem sunus sirasi (bkz. V35__period_team_order.sql).
 *
 * En kritik davranis: SON SIRALAYAN KAZANIR. Gözde'nin karari (2026-09-09):
 * "sıralamayı biz manuel yapabilir miyiz... kim sıralama yaptıysa o şekilde
 * sonlansın." Yani ayni doneme ikinci kez yazan oncekini gecersiz kilar.
 */
class PeriodOrderServiceTest {

    private static final LocalDate DONEM = LocalDate.of(2026, 7, 23);

    /** Bellek ici depo - projede Mockito kullanilmiyor, port dogrudan taklit edilir. */
    private static final class InMemoryOrders implements PeriodTeamOrderRepositoryPort {
        private final List<PeriodTeamOrder> rows = new ArrayList<>();
        private Instant saat = Instant.parse("2026-09-09T09:00:00Z");

        @Override
        public PeriodTeamOrder save(PeriodTeamOrder order) {
            // Gercek tabloda period_end BIRINCIL ANAHTAR - ustune yazar.
            rows.removeIf(r -> r.getPeriodEnd().equals(order.getPeriodEnd()));
            saat = saat.plusSeconds(60);
            PeriodTeamOrder kopya = new PeriodTeamOrder(order.getPeriodEnd(), List.copyOf(order.getTeamIds()),
                    order.getUpdatedBy(), saat);
            rows.add(kopya);
            return kopya;
        }

        @Override
        public Optional<PeriodTeamOrder> findByPeriodEnd(LocalDate periodEnd) {
            return rows.stream().filter(r -> r.getPeriodEnd().equals(periodEnd)).findFirst();
        }

        @Override
        public List<PeriodTeamOrder> findAll() {
            return List.copyOf(rows);
        }
    }

    private final InMemoryOrders depo = new InMemoryOrders();
    private final PeriodOrderService service = new PeriodOrderService(depo);

    @Test
    void siralamaKaydedilirVeKimYaptigiTutulur() {
        PeriodTeamOrder kayit = service.setOrder(DONEM, List.of(3L, 1L, 2L), "40538");

        assertThat(kayit.getPeriodEnd()).isEqualTo(DONEM);
        assertThat(kayit.getTeamIds()).containsExactly(3L, 1L, 2L);
        assertThat(kayit.getUpdatedBy()).isEqualTo("40538");
        assertThat(kayit.getUpdatedAt()).isNotNull();
    }

    /** ISIN KALBI: ayni doneme ikinci kez siralama yazan oncekini gecersiz kilar. */
    @Test
    void sonSiralayanKazanir() {
        service.setOrder(DONEM, List.of(1L, 2L, 3L), "40538");
        PeriodTeamOrder ikinci = service.setOrder(DONEM, List.of(3L, 2L, 1L), "29547");

        assertThat(depo.findAll()).as("donem basina TEK kayit").hasSize(1);
        assertThat(ikinci.getTeamIds()).containsExactly(3L, 2L, 1L);
        assertThat(depo.findByPeriodEnd(DONEM).orElseThrow().getUpdatedBy()).isEqualTo("29547");
    }

    /** Farkli donemler birbirini etkilemez. */
    @Test
    void donemlerBagimsizdir() {
        service.setOrder(DONEM, List.of(1L, 2L), "40538");
        service.setOrder(LocalDate.of(2026, 8, 6), List.of(2L, 1L), "29547");

        assertThat(depo.findAll()).hasSize(2);
        assertThat(depo.findByPeriodEnd(DONEM).orElseThrow().getTeamIds()).containsExactly(1L, 2L);
    }

    /** Ayni takim iki kez gonderilirse ILK gorunumu korunur - sira belirsiz kalmasin. */
    @Test
    void tekrarEdenTakimTekilllenir() {
        PeriodTeamOrder kayit = service.setOrder(DONEM, Arrays.asList(2L, 1L, 2L, 3L), "40538");

        assertThat(kayit.getTeamIds()).containsExactly(2L, 1L, 3L);
    }

    @Test
    void bosSiralamaReddedilir() {
        assertThatThrownBy(() -> service.setOrder(DONEM, List.of(), "40538"))
                .isInstanceOf(DomainValidationException.class);
        assertThatThrownBy(() -> service.setOrder(DONEM, null, "40538"))
                .isInstanceOf(DomainValidationException.class);
    }

    @Test
    void tarihsizSiralamaReddedilir() {
        assertThatThrownBy(() -> service.setOrder(null, List.of(1L), "40538"))
                .isInstanceOf(DomainValidationException.class);
    }

    @Test
    void bosTakimIdsiReddedilir() {
        assertThatThrownBy(() -> service.setOrder(DONEM, Arrays.asList(1L, null), "40538"))
                .isInstanceOf(DomainValidationException.class);
    }

    /**
     * SIRA UYGULAMA KURALI: kayitta olmayan takimlar SONA, kendi aralarindaki
     * sirayi koruyarak eklenir. Siralama kaydedildikten sonra bir ekip o
     * doneme sunum yuklerse listeden dusmemeli.
     */
    @Test
    void kayittaOlmayanTakimlarSonaEklenir() {
        record Oge(Long teamId, String ad) { }
        List<Oge> ogeler = List.of(new Oge(1L, "a"), new Oge(2L, "b"), new Oge(3L, "c"), new Oge(4L, "d"));

        List<Oge> sirali = PeriodTeamOrder.uygula(List.of(3L, 1L), ogeler, Oge::teamId);

        assertThat(sirali).extracting(Oge::teamId).containsExactly(3L, 1L, 2L, 4L);
    }

    /** Kayitta olup listede olmayan takim sirayi bozmaz - silinmis takim sorun cikarmasin. */
    @Test
    void kayittaOlupListedeOlmayanTakimAtlanir() {
        record Oge(Long teamId) { }
        List<Oge> ogeler = List.of(new Oge(1L), new Oge(2L));

        List<Oge> sirali = PeriodTeamOrder.uygula(List.of(9L, 2L, 1L), ogeler, Oge::teamId);

        assertThat(sirali).extracting(Oge::teamId).containsExactly(2L, 1L);
    }

    /** Siralama yoksa liste OLDUGU GIBI kalir. */
    @Test
    void siralamaYoksaListeDegismez() {
        record Oge(Long teamId) { }
        List<Oge> ogeler = List.of(new Oge(1L), new Oge(2L));

        assertThat(PeriodTeamOrder.uygula(null, ogeler, Oge::teamId)).isEqualTo(ogeler);
        assertThat(PeriodTeamOrder.uygula(List.of(), ogeler, Oge::teamId)).isEqualTo(ogeler);
    }
}
