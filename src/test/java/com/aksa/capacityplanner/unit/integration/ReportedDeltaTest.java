package com.aksa.capacityplanner.unit.integration;

import com.aksa.capacityplanner.integration.api.dto.TeamCapacitySnapshotDto;
import com.aksa.capacityplanner.integration.usecase.CapacitySnapshotMapper;
import com.aksa.capacityplanner.presentation.domain.SprintPresentation;
import com.aksa.capacityplanner.team.domain.Team;
import com.aksa.capacityplanner.team.domain.TeamType;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * "Dönem Kapanan / Yeni Eklenen / Net İş Yükü Değişimi" kartlari ekrandaki
 * buildSummaryCards (lib/format.js) ile AYNI degeri vermeli.
 */
class ReportedDeltaTest {

    private static final Team TEAM = new Team(2L, "İş Zekası Ekibi", null, null, null, TeamType.IS_ZEKASI, "IZ", null, false);

    @Test
    void netIsDerivedFromClosedMinusAddedWhenMissing() {
        // Gercek uretim ornegi: Is Zekasi Sprint 4 -> kapanan 32, eklenen 26, net BOS
        var totals = totals(Map.of("kapanan", 32, "eklenen", 26));
        assertThat(totals.reportedClosedEffort()).isEqualByComparingTo("32.00");
        assertThat(totals.reportedAddedEffort()).isEqualByComparingTo("26.00");
        assertThat(totals.reportedNetChange()).isEqualByComparingTo("6.00"); // 32 - 26, ekranla ayni
    }

    @Test
    void storedNetWins() {
        // RPA Sprint 17: kapanan 57, eklenen 0, net 57 -> kayitli deger kullanilir
        var totals = totals(Map.of("kapanan", 57, "eklenen", 0, "net", 57));
        assertThat(totals.reportedNetChange()).isEqualByComparingTo("57.00");
        // Yapay Zeka Sprint 8: net negatif
        assertThat(totals(Map.of("kapanan", 30, "eklenen", 122, "net", -92)).reportedNetChange())
                .isEqualByComparingTo("-92.00");
    }

    @Test
    void emptyFieldsInsideDeltaCountAsZeroLikeTheScreen() {
        // Urun Gelistirme Sprint 13: kapanan/eklenen bos, net 0 -> ekran 0,00 gosterir
        var totals = totals(Map.of("net", 0, "kapanan", "", "eklenen", ""));
        assertThat(totals.reportedClosedEffort()).isEqualByComparingTo("0.00");
        assertThat(totals.reportedAddedEffort()).isEqualByComparingTo("0.00");
        assertThat(totals.reportedNetChange()).isEqualByComparingTo("0.00");
    }

    @Test
    void missingDeltaBlockMeansNoDataNotZero() {
        // CBS Sprint 11: delta blogu YOK -> ekran o kartlari hic cizmez
        var totals = totals(null);
        assertThat(totals.reportedClosedEffort()).isNull();
        assertThat(totals.reportedAddedEffort()).isNull();
        assertThat(totals.reportedNetChange()).isNull();
    }

    private static com.aksa.capacityplanner.integration.api.dto.CapacityTotalsDto totals(Map<String, Object> delta) {
        Map<String, Object> kpis = new HashMap<>();
        kpis.put("toplam", 100);
        kpis.put("tamamlanan", 40);
        kpis.put("acik", 60);
        kpis.put("kapasite", 80);
        kpis.put("doluluk", 0.75);

        Map<String, Object> dash = new HashMap<>();
        dash.put("kpis", kpis);
        dash.put("persons", List.of());
        if (delta != null) {
            dash.put("delta", delta);
        }
        Map<String, Object> content = new HashMap<>();
        content.put("dashData", dash);

        SprintPresentation p = new SprintPresentation(1L, 2L, "4", "24 Temmuz – 6 Ağustos", content, 11, "30816",
                Instant.parse("2026-08-27T14:01:09Z"), Instant.parse("2026-08-27T14:01:09Z"));
        TeamCapacitySnapshotDto dto = CapacitySnapshotMapper.toSnapshot(TEAM, p, List.of());
        return dto.totals();
    }
}
