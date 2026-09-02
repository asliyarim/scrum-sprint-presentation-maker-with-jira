package com.aksa.capacityplanner.presentation.port.out;

import com.aksa.capacityplanner.presentation.domain.SprintPresentation;

import java.util.List;
import java.util.Optional;

public interface PresentationRepositoryPort {
    SprintPresentation save(SprintPresentation presentation);

    /** Sunumu siler. FK ON DELETE CASCADE (V30) ile surumleri de gider. */
    void deleteById(Long id);

    Optional<SprintPresentation> findById(Long id);

    Optional<SprintPresentation> findByTeamIdAndSprintNo(Long teamId, String sprintNo);

    List<SprintPresentation> findByTeamId(Long teamId);

    /** sprint_presentations_readonly view'i uzerinden okur (bkz. V5) - salt-okunur goruntuleme yollari icin. */
    Optional<SprintPresentation> findByIdReadOnly(Long id);

    /** sprint_presentations_readonly view'i uzerinden okur (bkz. V5) - salt-okunur goruntuleme yollari icin. */
    List<SprintPresentation> findByTeamIdReadOnly(Long teamId);

    /**
     * Verilen her takim icin EN GUNCEL sunumu (once sprint numarasi, esitlikte
     * son guncelleme zamani baz alinarak) dondurur - ortak (coklu takim)
     * sunum ozelligi icin. sprint_presentations_readonly view'i uzerinden okur.
     */
    List<SprintPresentation> findLatestPerTeamReadOnly(List<Long> teamIds);
}
