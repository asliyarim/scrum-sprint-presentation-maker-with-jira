package com.aksa.capacityplanner.unit.integration;

import com.aksa.capacityplanner.integration.usecase.CapacitySnapshotMapper;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Bakim/SR orani ekrandaki "(bakım %20)" notuyla AYNI olmali - frontend'deki
 * bakimOraniOf (lib/format.js) sirasi birebir uygulanir.
 */
class MaintenancePercentTest {

    @Test
    void usesExplicitRatioWhenPresent() throws Exception {
        assertThat(percent(person(Map.of("bakimOrani", 0.2)))).isEqualByComparingTo("20.00");
        assertThat(percent(person(Map.of("bakimOrani", 0.15)))).isEqualByComparingTo("15.00");
        // Excel'den gelen kayan nokta gurultusu (0.19999999999999996) yuvarlanir
        assertThat(percent(person(Map.of("bakimOrani", 0.19999999999999996)))).isEqualByComparingTo("20.00");
    }

    @Test
    void derivesFromMaintainedCapacityWhenRatioMissing() throws Exception {
        // 75.20 / 94 -> %20
        assertThat(percent(person(Map.of("kapasite", 94, "bakimliKapasite", 75.2))))
                .isEqualByComparingTo("20.00");
        // 85 / 100 -> %15
        assertThat(percent(person(Map.of("kapasite", 100, "bakimliKapasite", 85))))
                .isEqualByComparingTo("15.00");
    }

    @Test
    void fallsBackToTwentyPercentWhenNothingUsable() throws Exception {
        assertThat(percent(person(Map.of()))).isEqualByComparingTo("20.00");
        // bakimli == kapasite (bakim dusulmemis) -> turetilemez, varsayilan
        assertThat(percent(person(Map.of("kapasite", 75.2, "bakimliKapasite", 75.2))))
                .isEqualByComparingTo("20.00");
        // bozuk deger de patlatmaz
        assertThat(percent(person(Map.of("bakimOrani", "abc", "kapasite", "x"))))
                .isEqualByComparingTo("20.00");
    }

    private static BigDecimal percent(Map<String, Object> person) throws Exception {
        Method m = CapacitySnapshotMapper.class.getDeclaredMethod("maintenancePercent", Map.class);
        m.setAccessible(true);
        return (BigDecimal) m.invoke(null, person);
    }

    private static Map<String, Object> person(Map<String, Object> fields) {
        return new HashMap<>(fields);
    }
}
