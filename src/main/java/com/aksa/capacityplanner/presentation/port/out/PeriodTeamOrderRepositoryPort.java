package com.aksa.capacityplanner.presentation.port.out;

import com.aksa.capacityplanner.presentation.domain.PeriodTeamOrder;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface PeriodTeamOrderRepositoryPort {

    /** Donem basina TEK kayit - ayni tarihe ikinci kez yazan ustune yazar. */
    PeriodTeamOrder save(PeriodTeamOrder order);

    Optional<PeriodTeamOrder> findByPeriodEnd(LocalDate periodEnd);

    /** Tum siralamalar - donem listesi tek sorguda zenginlestirilsin diye. */
    List<PeriodTeamOrder> findAll();
}
