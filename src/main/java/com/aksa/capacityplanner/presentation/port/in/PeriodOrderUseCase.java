package com.aksa.capacityplanner.presentation.port.in;

import com.aksa.capacityplanner.presentation.domain.PeriodTeamOrder;

import java.time.LocalDate;
import java.util.List;

/**
 * Donem basina takim sirasi. PresentationUseCase'ten AYRI tutuluyor: siralama
 * sunum icerigiyle ilgili degil, yalnizca ortak sunumdaki slayt sirasini
 * belirler; ayri kalinca sunum servisinin bagimliliklari da buyumuyor.
 */
public interface PeriodOrderUseCase {

    /**
     * Donemin sirasini yazar. Donem basina TEK kayit oldugundan ikinci kez
     * siralayan oncekinin ustune yazar - Gözde karari (2026-09-09): "kim
     * sıralama yaptıysa o şekilde sonlansın."
     */
    PeriodTeamOrder setOrder(LocalDate periodEnd, List<Long> teamIds, String callerSicil);

    /** Kaydedilmis tum siralamalar - donem listesi tek sorguda zenginlesir. */
    List<PeriodTeamOrder> listOrders();
}
