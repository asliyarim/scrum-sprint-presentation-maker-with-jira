package com.aksa.capacityplanner.unit.integration;

import com.aksa.capacityplanner.integration.api.dto.MemberCapacitySnapshotDto;
import com.aksa.capacityplanner.integration.api.dto.TeamCapacitySnapshotDto;
import com.aksa.capacityplanner.integration.usecase.CapacitySnapshotMapper;
import com.aksa.capacityplanner.presentation.domain.SprintPresentation;
import com.aksa.capacityplanner.team.domain.Team;
import com.aksa.capacityplanner.team.domain.TeamMember;
import com.aksa.capacityplanner.team.domain.TeamType;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Dis sozlesmenin (Nezih, 04.09.2026) alanlarini, frontend'in kaydettigi
 * dashData bicimine karsi dogrular. Alan adi degisirse (toplam/doluluk/...)
 * bu test KIRMIZI yanar - servis sessizce null donmeye baslamasin diye.
 */
class CapacitySnapshotMapperTest {

    private static final Team TEAM = new Team(2L, "İş Zekası Ekibi", null, null, null, TeamType.IS_ZEKASI, "IZ", 1669L, false);

    @Test
    void mapsTotalsMembersAndContractFields() {
        SprintPresentation latest = presentation(dashData(
                kpis(696.5, 216, 480.5, 362, 1.6595, -190.9, "Yüksek Risk"),
                List.of(person("Müge", "Geliştirici", 128.5, 47, 81.5, 94, 75.2, 1.0884, "Risk")),
                Map.of("kapanan", "37", "eklenen", "62", "net", -25),
                List.of(Map.of("label", "Toplam FTE", "value", "24,1"))));

        TeamCapacitySnapshotDto dto = CapacitySnapshotMapper.toSnapshot(TEAM, latest, List.of());

        assertThat(dto.apiVersion()).isEqualTo(1);
        assertThat(dto.unit()).isEqualTo("day");
        assertThat(dto.projectKey()).isEqualTo("IZ");
        assertThat(dto.sprintNo()).isEqualTo("5");
        assertThat(dto.capacityPeriod()).isEqualTo("01 Haziran – 31 Aralık 2026");
        assertThat(dto.presentationVersion()).isEqualTo(3);
        assertThat(dto.totals().plannedEffort()).isEqualByComparingTo("696.50");
        assertThat(dto.totals().occupancyPercent()).isEqualByComparingTo("165.95");
        assertThat(dto.totals().status()).isEqualTo("Yüksek Risk");
        assertThat(dto.totals().maintainedCapacity()).isEqualByComparingTo("75.20");
        assertThat(dto.totals().fte()).isEqualByComparingTo("24.10");
        assertThat(dto.totals().reportedClosedEffort()).isEqualByComparingTo("37.00");
        assertThat(dto.totals().reportedNetChange()).isEqualByComparingTo("-25.00");

        MemberCapacitySnapshotDto m = dto.members().get(0);
        assertThat(m.name()).isEqualTo("Müge");
        assertThat(m.fullName()).isEqualTo("Müge"); // roster yok -> name
        assertThat(m.capacity()).isEqualByComparingTo("94.00");
        assertThat(m.maintainedCapacity()).isEqualByComparingTo("75.20");
        assertThat(m.occupancyPercent()).isEqualByComparingTo("108.84");
        assertThat(m.status()).isEqualTo("Risk");
    }

    @Test
    void statusIsDerivedFromOccupancyNotFromStaleStoredLabel() {
        // CBS Sprint 11 vakasi: kayitta "Yüksek Risk" ama doluluk 0.63 -> ekranda "Uygun"
        assertThat(CapacitySnapshotMapper.status("Yüksek Risk", 0.6298)).isEqualTo("Uygun");
        assertThat(CapacitySnapshotMapper.status("Uygun", 0.8499)).isEqualTo("Uygun");
        assertThat(CapacitySnapshotMapper.status("Uygun", 0.85)).isEqualTo("Dikkat");
        assertThat(CapacitySnapshotMapper.status("Uygun", 1.0)).isEqualTo("Risk");
        assertThat(CapacitySnapshotMapper.status("Uygun", 1.2)).isEqualTo("Yüksek Risk");
        // doluluk yoksa kayitli etiket yedek olarak kullanilir
        assertThat(CapacitySnapshotMapper.status("Dikkat", null)).isEqualTo("Dikkat");
    }

    @Test
    void enrichesMembersFromRosterWithTokenMatchingAndRefusesAmbiguity() {
        TeamMember anil = member(1L, "Anıl Muslu", "Geliştirici", "acc-anil");
        TeamMember anilIkinci = member(2L, "Anıl Kaya", null, "acc-anil2");
        TeamMember osman = member(3L, "Osman Bal", "Analist", "acc-osman");
        SprintPresentation latest = presentation(dashData(
                kpis(10, 5, 5, 10, 0.5, 5, "Uygun"),
                List.of(person("Osman", "", 1, 1, 0, 1, 1, 0, null),
                        person("Anıl", "Geliştici", 1, 1, 0, 1, 1, 0, null),
                        person("Osman Bal", "aa", 1, 1, 0, 1, 1, 0, null)),
                Map.of(), List.of()));

        TeamCapacitySnapshotDto dto = CapacitySnapshotMapper.toSnapshot(TEAM, latest, List.of(anil, anilIkinci, osman));

        MemberCapacitySnapshotDto osmanKisa = dto.members().get(0);
        assertThat(osmanKisa.fullName()).isEqualTo("Osman Bal");          // token alt kumesi ile eslesti
        assertThat(osmanKisa.jiraAccountId()).isEqualTo("acc-osman");
        assertThat(osmanKisa.role()).isEqualTo("Analist");                 // PO bos birakti -> roster rolu

        MemberCapacitySnapshotDto anilBelirsiz = dto.members().get(1);
        assertThat(anilBelirsiz.fullName()).isEqualTo("Anıl");             // iki aday -> baglanmadi
        assertThat(anilBelirsiz.jiraAccountId()).isNull();
        assertThat(anilBelirsiz.role()).isEqualTo("Geliştirici");          // yazim hatasi duzeltildi

        MemberCapacitySnapshotDto osmanTam = dto.members().get(2);
        assertThat(osmanTam.jiraAccountId()).isEqualTo("acc-osman");       // tam eslesme
        assertThat(osmanTam.role()).isEqualTo("Analist");                  // "aa" anlamsiz -> roster
    }

    @Test
    void normalizesRoleVariants() {
        assertThat(CapacitySnapshotMapper.normalizeRole("Developer")).isEqualTo("Geliştirici");
        assertThat(CapacitySnapshotMapper.normalizeRole("BI Developer")).isEqualTo("Geliştirici");
        assertThat(CapacitySnapshotMapper.normalizeRole("analist")).isEqualTo("Analist");
        assertThat(CapacitySnapshotMapper.normalizeRole("dd")).isNull();
        assertThat(CapacitySnapshotMapper.normalizeRole("  ")).isNull();
        assertThat(CapacitySnapshotMapper.normalizeRole("veri mühendisi")).isEqualTo("Veri mühendisi");
    }

    @Test
    void parsesTurkishFormattedNumbers() {
        assertThat(CapacitySnapshotMapper.raw("24,1")).isEqualByComparingTo("24.1");
        assertThat(CapacitySnapshotMapper.raw("1.250,50")).isEqualByComparingTo("1250.50");
        assertThat(CapacitySnapshotMapper.raw("12.5")).isEqualByComparingTo("12.5");
        assertThat(CapacitySnapshotMapper.raw(7)).isEqualByComparingTo("7");
        assertThat(CapacitySnapshotMapper.raw("abc")).isNull();
        assertThat(CapacitySnapshotMapper.raw(null)).isNull();
    }

    @Test
    void teamWithoutPresentationOrDashDataStaysNullSafe() {
        TeamCapacitySnapshotDto none = CapacitySnapshotMapper.toSnapshot(TEAM, null, List.of());
        assertThat(none.totals()).isNull();
        assertThat(none.members()).isEmpty();
        assertThat(none.unit()).isEqualTo("day");

        SprintPresentation withoutDash = presentation(Map.of("sections", Map.of()));
        TeamCapacitySnapshotDto noDash = CapacitySnapshotMapper.toSnapshot(TEAM, withoutDash, List.of());
        assertThat(noDash.totals()).isNull();
        assertThat(noDash.members()).isEmpty();
        assertThat(noDash.sprintNo()).isEqualTo("5");

        // dashData bozuk (liste yerine metin) -> istisna yok
        SprintPresentation garbage = presentation(Map.of("dashData", Map.of("persons", "bozuk", "kpis", 42)));
        assertThat(CapacitySnapshotMapper.toSnapshot(TEAM, garbage, List.of()).members()).isEmpty();
    }

    @Test
    void projectKeyFallsBackToCbsOnlyForLocationTeam() {
        Team cbs = new Team(7L, "CBS", null, null, null, TeamType.KONUM_TABANLI_URUN_GELISTIRME, null, null, false);
        Team mobil = new Team(8L, "Mobil", null, null, null, TeamType.MOBIL_UYGULAMALAR, "  ", null, false);
        assertThat(CapacitySnapshotMapper.toSnapshot(cbs, null, List.of()).projectKey()).isEqualTo("CBS");
        assertThat(CapacitySnapshotMapper.toSnapshot(mobil, null, List.of()).projectKey()).isNull();
    }

    // ---------- yardimcilar: frontend'in kaydettigi dashData bicimi ----------

    private static SprintPresentation presentation(Map<String, Object> content) {
        return new SprintPresentation(31L, 2L, "5", "07.08.2026 – 03.09.2026", content, 3, "35840",
                Instant.parse("2026-09-01T10:00:00Z"), Instant.parse("2026-09-03T14:24:00Z"));
    }

    private static Map<String, Object> dashData(Map<String, Object> kpis, List<Map<String, Object>> persons,
                                                Map<String, Object> delta, List<Map<String, Object>> customKpis) {
        Map<String, Object> dash = new HashMap<>();
        dash.put("dateRange", "01 Haziran – 31 Aralık 2026");
        dash.put("reportDate", "03.09.2026");
        dash.put("kpis", kpis);
        dash.put("persons", persons);
        dash.put("delta", delta);
        dash.put("customKpis", customKpis);
        Map<String, Object> content = new HashMap<>();
        content.put("dashData", dash);
        return content;
    }

    private static Map<String, Object> kpis(double toplam, double tamamlanan, double acik, double kapasite,
                                            double doluluk, double acikFazla, String durum) {
        Map<String, Object> m = new HashMap<>();
        m.put("toplam", toplam);
        m.put("tamamlanan", tamamlanan);
        m.put("acik", acik);
        m.put("kapasite", kapasite);
        m.put("doluluk", doluluk);
        m.put("acikFazla", acikFazla);
        m.put("durum", durum);
        return m;
    }

    private static Map<String, Object> person(String name, String role, double toplam, double tamamlanan, double acik,
                                              double kapasite, double bakimli, double doluluk, String durum) {
        Map<String, Object> m = new HashMap<>();
        m.put("name", name);
        m.put("role", role);
        m.put("toplam", toplam);
        m.put("tamamlanan", tamamlanan);
        m.put("acik", acik);
        m.put("kapasite", kapasite);
        m.put("bakimliKapasite", bakimli);
        m.put("doluluk", doluluk);
        m.put("durum", durum);
        return m;
    }

    private static TeamMember member(Long id, String fullName, String role, String accountId) {
        TeamMember m = new TeamMember(id, 2L, fullName, role, null, null, "ACTIVE", null, false);
        m.setJiraAccountId(accountId);
        return m;
    }
}
