package com.aksa.capacityplanner.benefit.facade;

import com.aksa.capacityplanner.benefit.domain.TeamBenefit;
import com.aksa.capacityplanner.benefit.port.in.BenefitUseCase;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Okuma herkese acik (sunumlarla ayni ilke); YAZMA yalnizca o takima yazma
 * yetkisi olan PO ya da admin (PresentationFacade.requireEditAccess ile
 * AYNI kural).
 */
@Component
public class BenefitFacade {

    private final BenefitUseCase benefitUseCase;

    public BenefitFacade(BenefitUseCase benefitUseCase) {
        this.benefitUseCase = benefitUseCase;
    }

    public List<TeamBenefit> listForTeam(Long teamId) {
        return benefitUseCase.listForTeam(teamId);
    }

    public List<TeamBenefit> upsertPeriod(Long teamId, String period, List<TeamBenefit> entries,
                                          String callerSicil, List<Long> callerTeamIds, boolean callerIsAdmin) {
        requireEditAccess(teamId, callerTeamIds, callerIsAdmin);
        return benefitUseCase.upsertPeriod(teamId, period, entries, callerSicil);
    }

    public List<TeamBenefit> listAll() {
        return benefitUseCase.listAll();
    }

    private void requireEditAccess(Long targetTeamId, List<Long> callerTeamIds, boolean callerIsAdmin) {
        if (callerIsAdmin) {
            return;
        }
        if (callerTeamIds == null || !callerTeamIds.contains(targetTeamId)) {
            throw new AccessDeniedException("Bu takimin kazanim verisini duzenleme yetkiniz yok.");
        }
    }
}
