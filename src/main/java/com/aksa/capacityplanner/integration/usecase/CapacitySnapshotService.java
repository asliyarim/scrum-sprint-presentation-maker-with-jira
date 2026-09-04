package com.aksa.capacityplanner.integration.usecase;

import com.aksa.capacityplanner.integration.api.dto.TeamCapacitySnapshotDto;
import com.aksa.capacityplanner.presentation.domain.SprintPresentation;
import com.aksa.capacityplanner.presentation.facade.PresentationFacade;
import com.aksa.capacityplanner.team.domain.Team;
import com.aksa.capacityplanner.team.facade.TeamFacade;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Her takimin EN SON kaydettigi sunumdaki kapasite verisini toplar; donusum
 * CapacitySnapshotMapper'dadir (saf, test edilebilir).
 *
 * Neden "son kayit"? Kapasite dashboard'unun ana akisi STATELESS calisir (PO
 * Excel'i yukler, hesap anlik yapilir) - kalici olarak yalnizca sunum
 * kaydedilirken content.dashData icine yazilir. Mutabakat: Nezih 2026-09-03
 * "son kayit yeterli"; guncellik lastUpdated ile izlenir.
 */
@Service
public class CapacitySnapshotService {

    private static final Pattern SPRINT_NO_DIGITS = Pattern.compile("\\d+");

    /**
     * "En son sunum": once sprint numarasi, esitlikte guncelleme zamani -
     * PresentationPersistenceAdapter.findLatestPerTeamReadOnly ile AYNI olcut;
     * aksi halde servis ile uygulamanin "son sunum"u ayrisirdi. Comparator
     * TERS oldugu icin min() = en son sunum.
     */
    private static final Comparator<SprintPresentation> LATEST_FIRST =
            Comparator.<SprintPresentation>comparingLong(p -> sprintNoRank(p.getSprintNo()))
                    .thenComparing(SprintPresentation::getUpdatedAt, Comparator.nullsFirst(Comparator.<Instant>naturalOrder()))
                    .reversed();

    private final TeamFacade teamFacade;
    private final PresentationFacade presentationFacade;

    public CapacitySnapshotService(TeamFacade teamFacade, PresentationFacade presentationFacade) {
        this.teamFacade = teamFacade;
        this.presentationFacade = presentationFacade;
    }

    public List<TeamCapacitySnapshotDto> listAll() {
        return teamFacade.listTeams().stream()
                .filter(t -> t.getId() != null)
                .map(this::toSnapshot)
                .toList();
    }

    private TeamCapacitySnapshotDto toSnapshot(Team team) {
        SprintPresentation latest = presentationFacade.listByTeam(team.getId()).stream()
                .min(LATEST_FIRST)
                .orElse(null);
        return CapacitySnapshotMapper.toSnapshot(team, latest, teamFacade.listMembers(team.getId()));
    }

    private static long sprintNoRank(String sprintNo) {
        if (sprintNo == null) {
            return -1;
        }
        Matcher m = SPRINT_NO_DIGITS.matcher(sprintNo);
        return m.find() ? Long.parseLong(m.group()) : -1;
    }
}
