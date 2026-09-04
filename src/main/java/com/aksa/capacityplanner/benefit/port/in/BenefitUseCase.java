package com.aksa.capacityplanner.benefit.port.in;

import com.aksa.capacityplanner.benefit.domain.TeamBenefit;

import java.util.List;

public interface BenefitUseCase {
    List<TeamBenefit> listForTeam(Long teamId);

    /**
     * Bir donemin kazanim degerlerini TOPLUCA yazar (varsa gunceller, yoksa
     * olusturur). Listede olmayan turlere DOKUNULMAZ - boylece PO tek bir turu
     * guncelleyebilir. Yazilan donemin guncel tam listesi doner.
     */
    List<TeamBenefit> upsertPeriod(Long teamId, String period, List<TeamBenefit> entries, String updatedBy);

    List<TeamBenefit> listAll();
}
