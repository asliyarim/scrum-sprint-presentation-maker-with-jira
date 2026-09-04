package com.aksa.capacityplanner.unit.integration;

import com.aksa.capacityplanner.integration.usecase.BenefitsSnapshotService;
import com.aksa.capacityplanner.team.domain.Team;
import com.aksa.capacityplanner.team.domain.TeamType;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;

/** Kazanim ucu yalnizca RPA tipindeki takimlari listeler (kullanici karari 2026-09-04). */
class BenefitsSnapshotServiceTest {

    @Test
    void onlyRpaTeamsAreListed() throws Exception {
        assertThat(isBenefitTeam(team(1L, TeamType.RPA))).isTrue();
        assertThat(isBenefitTeam(team(2L, TeamType.IS_ZEKASI))).isFalse();
        assertThat(isBenefitTeam(team(7L, TeamType.KONUM_TABANLI_URUN_GELISTIRME))).isFalse();
        assertThat(isBenefitTeam(team(9L, TeamType.GENEL))).isFalse();
        assertThat(isBenefitTeam(team(null, TeamType.RPA))).isFalse();
        assertThat(isBenefitTeam(null)).isFalse();
    }

    private static Team team(Long id, TeamType type) {
        return new Team(id, "t", null, null, null, type, null, null, false);
    }

    /** Paket-ozel statik yardimci; test farkli pakette oldugu icin yansima ile cagrilir. */
    private static boolean isBenefitTeam(Team team) throws Exception {
        Method m = BenefitsSnapshotService.class.getDeclaredMethod("isBenefitTeam", Team.class);
        m.setAccessible(true);
        return (boolean) m.invoke(null, team);
    }
}
