package com.aksa.capacityplanner.unit.integration;

import com.aksa.capacityplanner.integration.usecase.CapacitySnapshotMapper;
import com.aksa.capacityplanner.integration.usecase.CapacitySnapshotService;
import com.aksa.capacityplanner.presentation.domain.SprintPresentation;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * RAPOR TARIHI KURALI (kullanici karari 2026-09-04): yalnizca rapor tarihi
 * BUGUN veya daha ONCE olan sunum disari verilir; PO'nun onceden hazirladigi,
 * rapor tarihi henuz gelmemis sunum atlanir.
 */
class ReportDateRuleTest {

    private static final LocalDate BUGUN = LocalDate.of(2026, 9, 4);

    @Test
    void parsesTurkishReportDates() {
        assertThat(CapacitySnapshotMapper.reportDateOf(withReportDate("10.08.2026")))
                .isEqualTo(LocalDate.of(2026, 8, 10));
        assertThat(CapacitySnapshotMapper.reportDateOf(withReportDate("7.9.2026")))
                .isEqualTo(LocalDate.of(2026, 9, 7));
        assertThat(CapacitySnapshotMapper.reportDateOf(withReportDate("03.09.2026")))
                .isEqualTo(LocalDate.of(2026, 9, 3));
    }

    @Test
    void unreadableReportDatesYieldNull() {
        assertThat(CapacitySnapshotMapper.reportDateOf(withReportDate("–"))).isNull();
        assertThat(CapacitySnapshotMapper.reportDateOf(withReportDate(""))).isNull();
        assertThat(CapacitySnapshotMapper.reportDateOf(withReportDate("bilinmiyor"))).isNull();
        assertThat(CapacitySnapshotMapper.reportDateOf(withReportDate("32.13.2026"))).isNull();
        assertThat(CapacitySnapshotMapper.reportDateOf(presentation(Map.of()))).isNull();
        assertThat(CapacitySnapshotMapper.reportDateOf(null)).isNull();
    }

    @Test
    void pastAndTodayAreReleasedFutureIsSkipped() throws Exception {
        // Gercek uretim ornegi (04.09.2026): RPA Sprint 18 -> 07.09, atlanmali
        assertThat(released(withReportDate("07.09.2026"))).isFalse();
        assertThat(released(withReportDate("05.09.2026"))).isFalse();
        // Ayni gun SINIRDA dahil
        assertThat(released(withReportDate("04.09.2026"))).isTrue();
        // Gecmis -> verilir (Urun Gelistirme 03.09, CBS 10.08)
        assertThat(released(withReportDate("03.09.2026"))).isTrue();
        assertThat(released(withReportDate("10.08.2026"))).isTrue();
        // Tarihi okunamayan da atlanir
        assertThat(released(withReportDate("–"))).isFalse();
        assertThat(released(presentation(Map.of()))).isFalse();
    }

    // ---------- yardimcilar ----------

    /** CapacitySnapshotService.raporTarihiGelmis paket-ozel; test farkli pakette. */
    private static boolean released(SprintPresentation p) throws Exception {
        Method m = CapacitySnapshotService.class.getDeclaredMethod(
                "raporTarihiGelmis", SprintPresentation.class, LocalDate.class);
        m.setAccessible(true);
        return (boolean) m.invoke(null, p, BUGUN);
    }

    private static SprintPresentation withReportDate(String reportDate) {
        Map<String, Object> dash = new HashMap<>();
        dash.put("reportDate", reportDate);
        Map<String, Object> content = new HashMap<>();
        content.put("dashData", dash);
        return presentation(content);
    }

    private static SprintPresentation presentation(Map<String, Object> content) {
        return new SprintPresentation(1L, 1L, "18", "24.08.2026 – 07.09.2026", content, 1, "40538",
                Instant.parse("2026-09-01T10:00:00Z"), Instant.parse("2026-09-04T11:34:00Z"), null, null, null, null);
    }
}
