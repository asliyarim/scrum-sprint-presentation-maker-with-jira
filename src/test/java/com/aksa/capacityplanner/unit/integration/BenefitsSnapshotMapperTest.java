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

    /**
     * Dis sozlesme: turler HER ZAMAN tam liste halinde, bildirim sirasinda
     * doner - girilmemis olanlar processCount=null ile ("bilinmiyor").
     *
     * 2026-09-10'da tur sayisi ALTIDAN BESE indi ve key'ler degisti
     * (bkz. BenefitType). Bu test o sozlesmeyi sabitler: key/label listesi
     * degisirse Nezih'in panosu kirilacagi icin burasi da kirilmali.
     */
    @Test
    void returnsAllTypesInContractOrderWithNullForMissing() {
        List<TeamBenefit> rows = List.of(
                row(BenefitType.FINANSAL_KAZANIM, "2026", 12, new BigDecimal("1250000"), null, T1),
                row(BenefitType.KALITE_DOGRULUK_SUREKLILIK, "2026", 18, null, null, T2),
                row(BenefitType.OPERASYONEL_VERIMLILIK, "2026", 0, null, null, T1));

        TeamBenefitsSnapshotDto dto = BenefitsSnapshotMapper.toSnapshot(RPA, rows);

        assertThat(dto.apiVersion()).isEqualTo(1);
        assertThat(dto.projectKey()).isEqualTo("RPA");
        assertThat(dto.period()).isEqualTo("2026");
        assertThat(dto.lastUpdated()).isEqualTo(T2);
        assertThat(dto.benefits()).extracting(BenefitEntryDto::key).containsExactly(
                "kaliteDogrulukSureklilik", "operasyonelVerimlilik", "riskUyumDenetim",
                "calisanMusteriDeneyimi", "finansalKazanim");
        assertThat(dto.benefits()).extracting(BenefitEntryDto::label).containsExactly(
                "Kalite, Doğruluk ve Süreklilik", "Operasyonel Verimlilik", "Risk, Uyum ve Denetim",
                "Çalışan ve Müşteri Deneyimi", "Finansal Kazanım");

        assertThat(dto.benefits().get(0).processCount()).isEqualTo(18);
        assertThat(dto.benefits().get(0).value()).isNull();
        assertThat(dto.benefits().get(1).processCount()).isZero();   // 0 -> hic surec yok, null DEGIL
        assertThat(dto.benefits().get(2).processCount()).isNull();   // girilmemis -> bilinmiyor
        assertThat(dto.benefits().get(3).processCount()).isNull();

        // Tutar/para birimi YALNIZCA finansal kazanimda tasinir.
        BenefitEntryDto financial = dto.benefits().get(4);
        assertThat(financial.processCount()).isEqualTo(12);
        assertThat(financial.value()).isEqualByComparingTo("1250000");
        assertThat(financial.unit()).isEqualTo("TRY"); // para birimi bos -> varsayilan
        assertThat(dto.benefits().get(0).unit()).isNull();
    }

    /**
     * Nezih'in panosu ve elde kalmis eski istekler bir sure daha ESKI
     * key'leri gonderebilir - gecis suresince ikisi de calismali.
     */
    @Test
    void eskiKeylerYeniTurlereCozulur() {
        assertThat(BenefitType.fromKey("financial")).contains(BenefitType.FINANSAL_KAZANIM);
        assertThat(BenefitType.fromKey("errorReduction")).contains(BenefitType.KALITE_DOGRULUK_SUREKLILIK);
        assertThat(BenefitType.fromKey("dataQuality")).contains(BenefitType.KALITE_DOGRULUK_SUREKLILIK);
        assertThat(BenefitType.fromKey("riskControl")).contains(BenefitType.RISK_UYUM_DENETIM);
        assertThat(BenefitType.fromKey("employeeExperience")).contains(BenefitType.CALISAN_MUSTERI_DENEYIMI);
        assertThat(BenefitType.fromKey("customerExperience")).contains(BenefitType.CALISAN_MUSTERI_DENEYIMI);
        // Yeni key'ler de elbette calisir
        assertThat(BenefitType.fromKey("operasyonelVerimlilik")).contains(BenefitType.OPERASYONEL_VERIMLILIK);
        assertThat(BenefitType.fromKey("bilinmeyen")).isEmpty();
    }

    @Test
    void picksMostRecentlyUpdatedPeriod() {
        List<TeamBenefit> rows = List.of(
                row(BenefitType.FINANSAL_KAZANIM, "2026-Q2", 5, null, null, T2),
                row(BenefitType.FINANSAL_KAZANIM, "2026-Q3", 9, null, null, T1));

        TeamBenefitsSnapshotDto dto = BenefitsSnapshotMapper.toSnapshot(RPA, rows);

        assertThat(dto.period()).isEqualTo("2026-Q2"); // T2 daha yeni
        // Finansal kazanim bildirim sirasinda SONUNCU (bkz. BenefitType).
        assertThat(dto.benefits())
                .filteredOn(b -> "finansalKazanim".equals(b.key()))
                .singleElement()
                .extracting(BenefitEntryDto::processCount)
                .isEqualTo(5);
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
