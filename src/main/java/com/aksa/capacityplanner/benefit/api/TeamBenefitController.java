package com.aksa.capacityplanner.benefit.api;

import com.aksa.capacityplanner.auth.domain.Role;
import com.aksa.capacityplanner.auth.security.JwtTokenProvider;
import com.aksa.capacityplanner.benefit.api.dto.TeamBenefitDto;
import com.aksa.capacityplanner.benefit.domain.BenefitType;
import com.aksa.capacityplanner.benefit.domain.TeamBenefit;
import com.aksa.capacityplanner.benefit.facade.BenefitFacade;
import com.aksa.capacityplanner.common.domain.DomainValidationException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;

/**
 * Uygulama ICI kazanim girisi (cookie oturumu). Dis dashboard bu ucu DEGIL,
 * /api/integration/benefits ucunu kullanir (bkz. BenefitsIntegrationController).
 */
@RestController
@RequestMapping("/api/teams/{teamId}/benefits")
public class TeamBenefitController {

    private final BenefitFacade benefitFacade;

    public TeamBenefitController(BenefitFacade benefitFacade) {
        this.benefitFacade = benefitFacade;
    }

    @GetMapping
    public List<TeamBenefitDto> list(@PathVariable Long teamId) {
        return benefitFacade.listForTeam(teamId).stream().map(this::toDto).toList();
    }

    /** Bir donemin kazanim degerlerini topluca yazar (PO'nun kendi takimi ya da admin). */
    @PutMapping("/{period}")
    public List<TeamBenefitDto> upsertPeriod(@PathVariable Long teamId, @PathVariable String period,
                                             @Valid @RequestBody UpsertRequest request, Authentication authentication) {
        JwtTokenProvider.AccessTokenClaims claims = requireClaims(authentication);
        List<TeamBenefit> entries = request.entries().stream().map(this::toDomain).toList();
        return benefitFacade.upsertPeriod(teamId, period, entries, claims.sicil(), claims.teamIds(),
                        claims.role() == Role.ADMIN)
                .stream().map(this::toDto).toList();
    }

    public record UpsertRequest(@NotNull List<@Valid Entry> entries) {
    }

    public record Entry(@NotBlank String key, Integer processCount, BigDecimal value, String currency) {
    }

    private TeamBenefit toDomain(Entry e) {
        BenefitType type = BenefitType.fromKey(e.key())
                .orElseThrow(() -> new DomainValidationException("Bilinmeyen kazanim turu: " + e.key()));
        return new TeamBenefit(null, null, null, type, e.processCount(), e.value(), e.currency(), null, null);
    }

    private TeamBenefitDto toDto(TeamBenefit b) {
        return new TeamBenefitDto(b.getId(), b.getTeamId(), b.getPeriod(), b.getType().key(), b.getType().label(),
                b.getProcessCount(), b.getValue(), b.getCurrency(), b.getUpdatedBy(), b.getUpdatedAt());
    }

    private JwtTokenProvider.AccessTokenClaims requireClaims(Authentication authentication) {
        if (authentication == null || !(authentication.getDetails() instanceof JwtTokenProvider.AccessTokenClaims claims)) {
            throw new AccessDeniedException("Oturum bulunamadi.");
        }
        return claims;
    }
}
