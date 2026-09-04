package com.aksa.capacityplanner.unit.integration;

import com.aksa.capacityplanner.benefit.domain.BenefitType;
import com.aksa.capacityplanner.benefit.domain.TeamBenefit;
import com.aksa.capacityplanner.integration.api.dto.BenefitEntryDto;
import com.aksa.capacityplanner.integration.api.dto.TeamBenefitsSnapshotDto;
import com.aksa.capacityplanner.integration.usecase.BenefitsSnapshotMapper;
import com.aksa.capacityplanner.team.domain.Team;
import com.aksa.capacityplanner.team.domain.TeamType;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Sozlesme bolum 3.2-3.4: sabit sira, 6 tur, null = bilinmiyor, value/unit sadece finansal. */
class BenefitsSnapshotMapperTest {

    private static final Team RPA = new Team(1L, "RPA Ekibi", null, null, null, TeamType.RPA, "RPA", 538L, true);
    private static final Instant T1 = Instant.parse("2026-09-01T10:00:00Z");
    private static final Instant T2 = Instant.parse("2026-09-03T14:35:00Z");

    @Test
    void returnsAllSixTypesInContractOrderWithNullForMissing() {
        List<TeamBenefit> rows = List.of(
                row(BenefitType.FINANCIAL, "2026", 12, new BigDecimal("1250000"), null, T1),
                row(BenefitType.ERROR_REDUCTION, "2026", 18, null, null, T2),
                row(BenefitType.DATA_QUALITY, "2026", 0, null, null, T1));

        TeamBenefitsSnapshotDto dto = BenefitsSnapshotMapper.toSnapshot(RPA, rows);

        assertThat(dto.apiVersion()).isEqualTo(1);
        assertThat(dto.projectKey()).isEqualTo("RPA");
        assertThat(dto.period()).isEqualTo("2026");
        assertThat(dto.lastUpdated()).isEqualTo(T2);
        assertThat(dto.benefits()).extracting(BenefitEntryDto::key).containsExactly(
                "financial", "errorReduction", "riskControl", "employeeExperience", "customerExperience", "dataQuality");
        assertThat(dto.benefits()).extracting(BenefitEntryDto::label).containsExactly(
                "Finansal Kazanç", "Hata Azaltma", "Risk ve Kontrol", "Çalışan Deneyimi", "Müşteri Deneyimi", "Veri Kalitesi");

        BenefitEntryDto financial = dto.benefits().get(0);
        assertThat(financial.processCount()).isEqualTo(12);
        assertThat(financial.value()).isEqualByComparingTo("1250000");
        assertThat(financial.unit()).isEqualTo("TRY"); // para birimi bos -> varsayilan

        assertThat(dto.benefits().get(1).processCount()).isEqualTo(18);
        assertThat(dto.benefits().get(1).value()).isNull();
        assertThat(dto.benefits().get(2).processCount()).isNull();   // girilmemis -> bilinmiyor
        assertThat(dto.benefits().get(5).processCount()).isZero();   // 0 -> hic surec yok, null DEGIL
    }

    @Test
    void picksMostRecentlyUpdatedPeriod() {
        List<TeamBenefit> rows = List.of(
                row(BenefitType.FINANCIAL, "2026-Q2", 5, null, null, T2),
                row(BenefitType.FINANCIAL, "2026-Q3", 9, null, null, T1));

        TeamBenefitsSnapshotDto dto = BenefitsSnapshotMapper.toSnapshot(RPA, rows);

        assertThat(dto.period()).isEqualTo("2026-Q2"); // T2 daha yeni
        assertThat(dto.benefits().get(0).processCount()).isEqualTo(5);
    }

    @Test
    void teamWithoutRowsReturnsEmptyListNotError() {
        Team cbs = new Team(7L, "CBS", null, null, null, TeamType.KONUM_TABANLI_URUN_GELISTIRME, null, null, false);
        TeamBenefitsSnapshotDto dto = BenefitsSnapshotMapper.toSnapshot(cbs, List.of());
        assertThat(dto.projectKey()).isEqualTo("CBS");
        assertThat(dto.period()).isNull();
        assertThat(dto.lastUpdated()).isNull();
        assertThat(dto.benefits()).isEmpty();
    }

    private static TeamBenefit row(BenefitType type, String period, Integer count, BigDecimal value,
                                   String currency, Instant updatedAt) {
        return new TeamBenefit(null, 1L, period, type, count, value, currency, "40538", updatedAt);
    }
}
