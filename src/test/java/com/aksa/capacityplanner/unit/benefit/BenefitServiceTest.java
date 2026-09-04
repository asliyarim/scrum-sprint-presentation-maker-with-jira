package com.aksa.capacityplanner.unit.benefit;

import com.aksa.capacityplanner.benefit.domain.BenefitType;
import com.aksa.capacityplanner.benefit.domain.TeamBenefit;
import com.aksa.capacityplanner.benefit.port.out.TeamBenefitRepositoryPort;
import com.aksa.capacityplanner.benefit.usecase.BenefitService;
import com.aksa.capacityplanner.common.domain.DomainValidationException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BenefitServiceTest {

    /** Bellek ici depo - projede Mockito kullanilmiyor, port dogrudan taklit edilir. */
    private static final class InMemoryRepo implements TeamBenefitRepositoryPort {
        private final List<TeamBenefit> rows = new ArrayList<>();
        private long seq = 1;

        @Override
        public TeamBenefit save(TeamBenefit b) {
            if (b.getId() == null) {
                b.setId(seq++);
                rows.add(b);
            }
            return b;
        }

        @Override
        public List<TeamBenefit> findByTeamId(Long teamId) {
            return rows.stream().filter(r -> teamId.equals(r.getTeamId())).toList();
        }

        @Override
        public Optional<TeamBenefit> findByTeamIdAndPeriodAndType(Long teamId, String period, BenefitType type) {
            return rows.stream().filter(r -> teamId.equals(r.getTeamId()) && period.equals(r.getPeriod())
                    && type == r.getType()).findFirst();
        }

        @Override
        public List<TeamBenefit> findAll() {
            return List.copyOf(rows);
        }
    }

    private final InMemoryRepo repo = new InMemoryRepo();
    private final BenefitService service = new BenefitService(repo);

    @Test
    void upsertCreatesThenUpdatesSameKeyWithoutTouchingOthers() {
        service.upsertPeriod(1L, " 2026 ", List.of(
                entry(BenefitType.FINANCIAL, 12, new BigDecimal("1250000"), null),
                entry(BenefitType.ERROR_REDUCTION, 18, null, null)), "40538");
        assertThat(repo.findAll()).hasSize(2);

        List<TeamBenefit> after = service.upsertPeriod(1L, "2026", List.of(
                entry(BenefitType.FINANCIAL, 13, new BigDecimal("1300000"), "usd")), "40538");

        assertThat(repo.findAll()).hasSize(2); // yeni satir ACILMADI, guncellendi
        TeamBenefit financial = after.stream().filter(b -> b.getType() == BenefitType.FINANCIAL).findFirst().orElseThrow();
        assertThat(financial.getProcessCount()).isEqualTo(13);
        assertThat(financial.getValue()).isEqualByComparingTo("1300000");
        assertThat(financial.getCurrency()).isEqualTo("USD");
        assertThat(financial.getPeriod()).isEqualTo("2026"); // kirpildi
        TeamBenefit error = after.stream().filter(b -> b.getType() == BenefitType.ERROR_REDUCTION).findFirst().orElseThrow();
        assertThat(error.getProcessCount()).isEqualTo(18); // dokunulmadi
    }

    @Test
    void valueIsOnlyKeptForFinancialAndDefaultsCurrency() {
        List<TeamBenefit> saved = service.upsertPeriod(1L, "2026", List.of(
                entry(BenefitType.RISK_CONTROL, 9, new BigDecimal("500"), "EUR"),
                entry(BenefitType.FINANCIAL, 2, new BigDecimal("10"), null)), "x");

        TeamBenefit risk = saved.stream().filter(b -> b.getType() == BenefitType.RISK_CONTROL).findFirst().orElseThrow();
        assertThat(risk.getValue()).isNull();
        assertThat(risk.getCurrency()).isNull();
        TeamBenefit fin = saved.stream().filter(b -> b.getType() == BenefitType.FINANCIAL).findFirst().orElseThrow();
        assertThat(fin.getCurrency()).isEqualTo("TRY");
    }

    @Test
    void rejectsInvalidInput() {
        assertThatThrownBy(() -> service.upsertPeriod(1L, "  ", List.of(), "x"))
                .isInstanceOf(DomainValidationException.class);
        assertThatThrownBy(() -> service.upsertPeriod(1L, "2026", List.of(entry(BenefitType.FINANCIAL, -1, null, null)), "x"))
                .isInstanceOf(DomainValidationException.class);
        assertThatThrownBy(() -> service.upsertPeriod(1L, "2026", List.of(entry(BenefitType.FINANCIAL, 1, BigDecimal.ONE, "lira")), "x"))
                .isInstanceOf(DomainValidationException.class);
        assertThatThrownBy(() -> service.upsertPeriod(1L, "2026", List.of(entry(null, 1, null, null)), "x"))
                .isInstanceOf(DomainValidationException.class);
    }

    @Test
    void nullProcessCountIsPreservedAsUnknown() {
        List<TeamBenefit> saved = service.upsertPeriod(1L, "2026", List.of(entry(BenefitType.DATA_QUALITY, null, null, null)), "x");
        assertThat(saved.get(0).getProcessCount()).isNull();
    }

    private static TeamBenefit entry(BenefitType type, Integer count, BigDecimal value, String currency) {
        return new TeamBenefit(null, null, null, type, count, value, currency, null, null);
    }
}
