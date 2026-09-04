package com.aksa.capacityplanner.benefit.usecase;

import com.aksa.capacityplanner.benefit.domain.TeamBenefit;
import com.aksa.capacityplanner.benefit.port.in.BenefitUseCase;
import com.aksa.capacityplanner.benefit.port.out.TeamBenefitRepositoryPort;
import com.aksa.capacityplanner.common.domain.DomainValidationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
public class BenefitService implements BenefitUseCase {

    /** Varsayilan para birimi - deger girilip birim bos birakilirsa. */
    static final String DEFAULT_CURRENCY = "TRY";

    private final TeamBenefitRepositoryPort repository;

    public BenefitService(TeamBenefitRepositoryPort repository) {
        this.repository = repository;
    }

    @Override
    public List<TeamBenefit> listForTeam(Long teamId) {
        return repository.findByTeamId(teamId);
    }

    @Override
    @Transactional
    public List<TeamBenefit> upsertPeriod(Long teamId, String period, List<TeamBenefit> entries, String updatedBy) {
        String normalizedPeriod = normalizePeriod(period);
        for (TeamBenefit entry : entries == null ? List.<TeamBenefit>of() : entries) {
            if (entry.getType() == null) {
                throw new DomainValidationException("Kazanim turu bos olamaz.");
            }
            if (entry.getProcessCount() != null && entry.getProcessCount() < 0) {
                throw new DomainValidationException("Surec sayisi negatif olamaz: " + entry.getType().key());
            }
            TeamBenefit target = repository.findByTeamIdAndPeriodAndType(teamId, normalizedPeriod, entry.getType())
                    .orElseGet(TeamBenefit::new);
            target.setTeamId(teamId);
            target.setPeriod(normalizedPeriod);
            target.setType(entry.getType());
            target.setProcessCount(entry.getProcessCount());
            // Deger/para birimi SADECE finansal turde saklanir; diger turlerde
            // yanlislikla gelen deger sessizce atilir (sozlesme: bolum 3.3).
            if (entry.getType().carriesValue()) {
                target.setValue(entry.getValue());
                target.setCurrency(entry.getValue() == null ? null : normalizeCurrency(entry.getCurrency()));
            } else {
                target.setValue(null);
                target.setCurrency(null);
            }
            target.setUpdatedBy(updatedBy);
            repository.save(target);
        }
        // Donemin TAM listesi (dokunulmayan turler dahil) doner.
        return repository.findByTeamId(teamId).stream()
                .filter(b -> normalizedPeriod.equals(b.getPeriod()))
                .toList();
    }

    @Override
    public List<TeamBenefit> listAll() {
        return repository.findAll();
    }

    private static String normalizePeriod(String period) {
        if (period == null || period.isBlank()) {
            throw new DomainValidationException("Donem bos olamaz (orn. 2026 ya da 2026-Q3).");
        }
        String p = period.trim();
        if (p.length() > 20) {
            throw new DomainValidationException("Donem en fazla 20 karakter olabilir.");
        }
        return p;
    }

    /** ISO 4217: 3 buyuk harf. Bos ise varsayilan TRY. */
    private static String normalizeCurrency(String currency) {
        if (currency == null || currency.isBlank()) {
            return DEFAULT_CURRENCY;
        }
        String c = currency.trim().toUpperCase(Locale.ROOT);
        if (!c.matches("[A-Z]{3}")) {
            throw new DomainValidationException("Para birimi ISO 4217 (3 harf) olmali: " + currency);
        }
        return c;
    }
}
