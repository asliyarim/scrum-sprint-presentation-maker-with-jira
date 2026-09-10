package com.aksa.capacityplanner.integration.persistence;

import com.aksa.capacityplanner.presentation.adapter.out.persistence.PresentationPersistenceAdapter;
import com.aksa.capacityplanner.presentation.adapter.out.persistence.SprintPresentationReadOnlyJpaRepository;
import com.aksa.capacityplanner.presentation.domain.SprintPresentation;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Donem satirlarinin (findPeriodRows) VERITABANI uzerinden dogrulanmasi.
 *
 * Neden ayri bir IT: birim testler portu elle taklit ettigi icin JPQL'i de,
 * arayuz projeksiyonunun (PeriodRow) alan eslemesini de HIC calistirmaz.
 * Sorgudaki bir takma ad hatasi ("p.periodEnd as bitis" gibi) yalnizca gercek
 * bir EntityManager ile ortaya cikar - orada getPeriodEnd() sessizce null
 * donerdi ve butun sunumlar donemsiz gorunurdu.
 */
@DataJpaTest
@ActiveProfiles("test-h2")
@Import(PresentationPersistenceAdapter.class)
class PresentationPeriodRowsIT {

    @Autowired
    private PresentationPersistenceAdapter adapter;

    @Autowired
    private SprintPresentationReadOnlyJpaRepository readOnlyRepository;

    @Autowired
    private EntityManager em;

    /**
     * Salt-okunur view'in JPA karsiligi @Immutable oldugundan Hibernate ona
     * INSERT uretmez - satirlar dogrudan SQL ile konuluyor (uretimde bu satirlar
     * zaten base tablodan view araciligiyla gelir).
     */
    private void satirEkle(long id, long teamId, String sprintNo, String dateRange,
                           LocalDate periodStart, LocalDate periodEnd, boolean hazir) {
        em.createNativeQuery("insert into sprint_presentations_readonly "
                        + "(id, team_id, sprint_no, date_range, content, current_version, updated_by, "
                        + "created_at, updated_at, finalized_at, finalized_by, period_start, period_end) "
                        + "values (?1, ?2, ?3, ?4, '{}', 1, '40538', current_timestamp, current_timestamp, "
                        + "?5, ?6, ?7, ?8)")
                .setParameter(1, id)
                .setParameter(2, teamId)
                .setParameter(3, sprintNo)
                .setParameter(4, dateRange)
                .setParameter(5, hazir ? java.time.Instant.now() : null)
                .setParameter(6, hazir ? "29547" : null)
                .setParameter(7, periodStart)
                .setParameter(8, periodEnd)
                .executeUpdate();
        em.flush();
        em.clear();
    }

    @Test
    void projeksiyonTumAlanlariDogruTasir() {
        satirEkle(1L, 2L, "16", "9 Temmuz – 23 Temmuz",
                LocalDate.of(2026, 7, 9), LocalDate.of(2026, 7, 23), true);

        List<SprintPresentation> satirlar = adapter.findAllForPeriodGrouping();

        assertThat(satirlar).hasSize(1);
        SprintPresentation p = satirlar.get(0);
        assertThat(p.getId()).isEqualTo(1L);
        assertThat(p.getTeamId()).isEqualTo(2L);
        assertThat(p.getSprintNo()).isEqualTo("16");
        assertThat(p.getDateRange()).isEqualTo("9 Temmuz – 23 Temmuz");
        assertThat(p.getCurrentVersion()).isEqualTo(1);
        assertThat(p.getUpdatedBy()).isEqualTo("40538");
        assertThat(p.getUpdatedAt()).as("gruplamada 'en son guncellenen' kurali buna dayaniyor").isNotNull();
        assertThat(p.getPeriodStart()).isEqualTo(LocalDate.of(2026, 7, 9));
        assertThat(p.getPeriodEnd()).isEqualTo(LocalDate.of(2026, 7, 23));
        assertThat(p.isFinalized()).isTrue();
        assertThat(p.getFinalizedBy()).isEqualTo("29547");
    }

    /** Slayt icerigi bu yolda OKUNMAZ - donen nesnenin content'i bos olmali. */
    @Test
    void icerikOkunmaz() {
        satirEkle(1L, 2L, "16", "9 Temmuz – 23 Temmuz",
                LocalDate.of(2026, 7, 9), LocalDate.of(2026, 7, 23), false);

        assertThat(adapter.findAllForPeriodGrouping().get(0).getContent()).isEmpty();
    }

    /** Donem tarihi olmayan (eski, cevrilemeyen) kayitlar hic donmemeli. */
    @Test
    void tarihsizSatirlarElenir() {
        satirEkle(1L, 2L, "16", "9 Temmuz – 23 Temmuz",
                LocalDate.of(2026, 7, 9), LocalDate.of(2026, 7, 23), false);
        satirEkle(2L, 3L, "9", "belirsiz", null, null, false);

        List<SprintPresentation> satirlar = adapter.findAllForPeriodGrouping();

        assertThat(satirlar).hasSize(1);
        assertThat(satirlar.get(0).getId()).isEqualTo(1L);
        assertThat(readOnlyRepository.count()).as("elenen satir silinmiyor, sadece bu sorguya girmiyor").isEqualTo(2);
    }
}
