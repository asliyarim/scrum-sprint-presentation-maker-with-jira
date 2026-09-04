package com.aksa.capacityplanner.integration.usecase;

import com.aksa.capacityplanner.integration.api.dto.TeamCapacitySnapshotDto;
import com.aksa.capacityplanner.presentation.domain.SprintPresentation;
import com.aksa.capacityplanner.presentation.facade.PresentationFacade;
import com.aksa.capacityplanner.team.domain.Team;
import com.aksa.capacityplanner.team.facade.TeamFacade;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Her takimin, RAPOR TARIHI GELMIS en son sunumundaki kapasite verisini toplar;
 * donusum CapacitySnapshotMapper'dadir (saf, test edilebilir).
 *
 * Neden "son kayit"? Kapasite dashboard'unun ana akisi STATELESS calisir (PO
 * Excel'i yukler, hesap anlik yapilir) - kalici olarak yalnizca sunum
 * kaydedilirken content.dashData icine yazilir. Mutabakat: Nezih 2026-09-03
 * "son kayit yeterli"; guncellik lastUpdated ile izlenir.
 *
 * RAPOR TARIHI KURALI (kullanici karari 2026-09-04): Bir sunum, ancak
 * dashData.reportDate degeri BUGUN veya DAHA ONCE ise disari verilir. PO'lar
 * siradaki sprintin sunumunu, rapor tarihi HENUZ GELMEDEN olusturup
 * kaydedebiliyor; o kayit "gelecege ait" oldugu icin dis dashboard'a
 * gitmemelidir. Ornek (04.09.2026): RPA Sprint 18'in rapor tarihi 07.09.2026 ->
 * ATLANIR, bir onceki (rapor tarihi gecmis) sunum verilir.
 *
 * Rapor tarihi OKUNAMAYAN sunumlar da atlanir - "gecmiste" oldugu
 * dogrulanamayan bir kaydi yayinlamak, yanlis veri vermek olurdu. Bir takimin
 * hicbir sunumu bu sarti saglamiyorsa takim listede kalir ama totals null
 * doner ("veri yok").
 */
@Service
public class CapacitySnapshotService {

    /** Rapor tarihi karsilastirmasi kullanicinin takvimine gore yapilir (sunucu UTC olabilir). */
    static final ZoneId ZONE = ZoneId.of("Europe/Istanbul");

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
        LocalDate bugun = LocalDate.now(ZONE);
        return teamFacade.listTeams().stream()
                .filter(t -> t.getId() != null)
                .map(t -> toSnapshot(t, bugun))
                .toList();
    }

    private TeamCapacitySnapshotDto toSnapshot(Team team, LocalDate bugun) {
        SprintPresentation latest = presentationFacade.listByTeam(team.getId()).stream()
                .filter(p -> raporTarihiGelmis(p, bugun))
                .min(LATEST_FIRST)
                .orElse(null);
        return CapacitySnapshotMapper.toSnapshot(team, latest, teamFacade.listMembers(team.getId()));
    }

    /**
     * Sunum disari verilebilir mi? Rapor tarihi BUGUN veya oncesi olmali.
     * Tarihi okunamayan (bos/bicimsiz) sunumlar da elenir - bkz. sinif yorumu.
     */
    static boolean raporTarihiGelmis(SprintPresentation presentation, LocalDate bugun) {
        LocalDate rapor = CapacitySnapshotMapper.reportDateOf(presentation);
        return rapor != null && !rapor.isAfter(bugun);
    }

    private static long sprintNoRank(String sprintNo) {
        if (sprintNo == null) {
            return -1;
        }
        Matcher m = SPRINT_NO_DIGITS.matcher(sprintNo);
        return m.find() ? Long.parseLong(m.group()) : -1;
    }
}
