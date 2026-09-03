package com.aksa.capacityplanner.integration.usecase;

import com.aksa.capacityplanner.integration.api.dto.CapacityTotalsDto;
import com.aksa.capacityplanner.integration.api.dto.MemberCapacitySnapshotDto;
import com.aksa.capacityplanner.integration.api.dto.TeamCapacitySnapshotDto;
import com.aksa.capacityplanner.presentation.domain.SprintPresentation;
import com.aksa.capacityplanner.presentation.facade.PresentationFacade;
import com.aksa.capacityplanner.team.domain.Team;
import com.aksa.capacityplanner.team.facade.TeamFacade;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Her takimin EN SON kaydettigi sunumdaki kapasite verisini disariya verilecek
 * sekilde normallestirir.
 *
 * Neden "son kayit"? Kapasite dashboard'unun ana akisi STATELESS calisir (PO
 * Excel'i yukler, hesap anlik yapilir) - kalici olarak yalnizca sunum
 * kaydedilirken content.dashData icine yazilir. Dolayisiyla sunucu tarafinda
 * sorgulanabilen tek kapasite kaynagi budur.
 *
 * Icerik serbest bicimli JSON (Map) oldugu icin tum okumalar savunmacidir:
 * eksik/bozuk alan istisna firlatmaz, null doner - tek bir takimin bozuk
 * kaydi tum listeyi dusurmesin.
 */
@Service
public class CapacitySnapshotService {

    /** content.dashData icindeki (frontend kaynakli) alan adlari. */
    private static final String DASH_DATA = "dashData";
    private static final String KPIS = "kpis";
    private static final String PERSONS = "persons";

    private final TeamFacade teamFacade;
    private final PresentationFacade presentationFacade;

    public CapacitySnapshotService(TeamFacade teamFacade, PresentationFacade presentationFacade) {
        this.teamFacade = teamFacade;
        this.presentationFacade = presentationFacade;
    }

    public List<TeamCapacitySnapshotDto> listAll() {
        List<Team> teams = teamFacade.listTeams();
        if (teams.isEmpty()) {
            return List.of();
        }
        List<Long> teamIds = teams.stream().map(Team::getId).filter(Objects::nonNull).toList();
        Map<Long, SprintPresentation> latestByTeam = presentationFacade.listLatestPerTeam(teamIds).stream()
                .filter(p -> p.getTeamId() != null)
                .collect(Collectors.toMap(SprintPresentation::getTeamId, Function.identity(), (a, b) -> a));

        return teams.stream().map(team -> toSnapshot(team, latestByTeam.get(team.getId()))).toList();
    }

    private TeamCapacitySnapshotDto toSnapshot(Team team, SprintPresentation presentation) {
        if (presentation == null) {
            // Takim var ama henuz hic sunum kaydetmemis - "veri yok" olarak doner.
            return new TeamCapacitySnapshotDto(team.getId(), team.getName(), null, null, null, null, null,
                    null, List.of());
        }
        Map<String, Object> dashData = asMap(valueOf(presentation.getContent(), DASH_DATA));
        Map<String, Object> kpis = asMap(valueOf(dashData, KPIS));

        List<MemberCapacitySnapshotDto> members = asList(valueOf(dashData, PERSONS)).stream()
                .map(this::asMap)
                .filter(m -> !m.isEmpty())
                .map(this::toMember)
                .toList();

        // Takim geneli "bakim haric kapasite" kayitta ayri bir alan olarak
        // tutulmuyor (kpis yalnizca ham "kapasite"yi icerir) - dolulugun
        // paydasi bu oldugu icin kisi satirlarindan toplanir.
        BigDecimal maintainedTotal = members.stream()
                .map(MemberCapacitySnapshotDto::maintainedCapacity)
                .filter(Objects::nonNull)
                .reduce(BigDecimal::add)
                .orElse(null);

        CapacityTotalsDto totals = kpis.isEmpty() ? null : new CapacityTotalsDto(
                scaled(kpis.get("toplam")),
                scaled(kpis.get("tamamlanan")),
                scaled(kpis.get("acik")),
                scaled(kpis.get("kapasite")),
                maintainedTotal,
                percent(kpis.get("doluluk")),
                scaled(kpis.get("acikFazla")),
                text(kpis.get("durum")));

        return new TeamCapacitySnapshotDto(team.getId(), team.getName(), presentation.getSprintNo(),
                presentation.getDateRange(), text(dashData.get("reportDate")), presentation.getUpdatedAt(),
                presentation.getCurrentVersion(), totals, members);
    }

    private MemberCapacitySnapshotDto toMember(Map<String, Object> person) {
        return new MemberCapacitySnapshotDto(
                text(person.get("name")),
                text(person.get("role")),
                scaled(person.get("toplam")),
                scaled(person.get("tamamlanan")),
                scaled(person.get("acik")),
                scaled(person.get("kapasite")),
                // Bakim haric kapasite dolulugun paydasidir; kayitta yoksa ham
                // kapasiteye duser (bkz. useDashboardData).
                person.get("bakimliKapasite") != null ? scaled(person.get("bakimliKapasite"))
                        : scaled(person.get("kapasite")),
                percent(person.get("doluluk")),
                text(person.get("durum")));
    }

    // --- serbest bicimli JSON'dan guvenli okuma yardimcilari ---

    private Object valueOf(Map<String, Object> source, String key) {
        return source == null ? null : source.get(key);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
    }

    private List<?> asList(Object value) {
        return value instanceof List<?> list ? list : List.of();
    }

    private String text(Object value) {
        if (value == null) {
            return null;
        }
        String s = String.valueOf(value).trim();
        return s.isEmpty() ? null : s;
    }

    /** Sayiyi olcekten BAGIMSIZ okur (yuzde carpimi once yapilabilsin diye). */
    private BigDecimal raw(Object value) {
        if (value instanceof Number number) {
            return new BigDecimal(number.toString());
        }
        if (value instanceof String s && !s.isBlank()) {
            try {
                return new BigDecimal(s.trim().replace(',', '.'));
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private BigDecimal scaled(Object value) {
        BigDecimal number = raw(value);
        return number == null ? null : number.setScale(2, RoundingMode.HALF_UP);
    }

    /** Kayittaki doluluk ORAN'dir (1.59); disariya YUZDE (159.00) olarak verilir. */
    private BigDecimal percent(Object value) {
        BigDecimal number = raw(value);
        return number == null ? null : number.multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP);
    }
}
