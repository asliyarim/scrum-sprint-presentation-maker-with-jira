package com.aksa.capacityplanner.presentation.domain;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Bir donemin TAKIM SIRASI - ortak sunumda slaytlarin hangi sirayla gelecegi.
 *
 * Gözde'nin karari (2026-09-09): "sıralamayı biz manuel yapabilir miyiz...
 * kim sıralama yaptıysa o şekilde sonlansın." Yani herkes degistirebilir,
 * en son degistiren gecerlidir - bu yuzden donem basina TEK kayit tutulur
 * (bkz. V35, period_end birincil anahtar).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PeriodTeamOrder {

    private LocalDate periodEnd;
    /** Takim id'lerinin SIRALI listesi. */
    private List<Long> teamIds;
    private String updatedBy;
    private Instant updatedAt;

    /**
     * Verilen takim listesini bu siraya gore dizer.
     *
     * Kayitta OLMAYAN takimlar sona, kendi aralarindaki mevcut sirayi
     * koruyarak eklenir - siralama kaydedildikten sonra yeni bir ekip
     * gelirse (ya da o donemde sunumu olmayan bir ekip sonradan yuklerse)
     * listeden DUSMESIN. Kayitta olup listede olmayan takimlar da sessizce
     * atlanir; silinmis bir takim sirayi bozmaz.
     */
    public static <T> List<T> uygula(List<Long> sira, List<T> ogeler, java.util.function.Function<T, Long> takimIdsi) {
        if (sira == null || sira.isEmpty() || ogeler == null) {
            return ogeler;
        }
        List<T> sirali = new ArrayList<>();
        List<T> kalan = new ArrayList<>(ogeler);
        for (Long teamId : sira) {
            kalan.removeIf(oge -> {
                if (teamId.equals(takimIdsi.apply(oge))) {
                    sirali.add(oge);
                    return true;
                }
                return false;
            });
        }
        sirali.addAll(kalan);
        return sirali;
    }
}
