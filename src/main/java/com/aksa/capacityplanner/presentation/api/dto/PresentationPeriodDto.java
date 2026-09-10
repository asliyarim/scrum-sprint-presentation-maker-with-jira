package com.aksa.capacityplanner.presentation.api.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Bir sprint donemi ve o doneme dusen sunumlar - otomatik ortak sunum ekrani.
 *
 * `takimSayisi` sunum sayisindan FARKLI olabilir: ayni takim ayni doneme iki
 * sunum birakmis olabilir (uretimde Dijital Uygulamalar S10/S11 boyle - iki
 * sprint neredeyse ayni gunleri kapsiyor). O durumda takim `cakisanTakimlar`
 * icinde de listelenir ve ekran bunu uyari olarak gosterir; ortak sunuma
 * `secilenSunumIdler` icindeki (en son guncellenen) kayit girer.
 *
 * Kac takimin sunum yapmasi GEREKTIGI bilerek burada yok - takim listesi
 * takim modulunun isi, sunum modulu ona bagimli degil. "X/8 hazir" oranini
 * arayuz kendi bildigi takim listesiyle hesaplar.
 */
public record PresentationPeriodDto(/** Donemi TEMSIL eden tarih: en cok ekibin sprintini bitirdigi gun. */
                                     LocalDate bitis,
                                     /** Donemdeki en erken/en gec bitis - ekipler birkac gune yayilabiliyor. */
                                     LocalDate ilkBitis, LocalDate sonBitis,
                                     int takimSayisi,
                                     /** Bu donemde "sunumum hazir" isaretli AYRI takim sayisi. */
                                     int hazirTakimSayisi,
                                     /** Ayni doneme birden fazla sunum birakmis takimlar. */
                                     List<Long> cakisanTakimlar,
                                     /** Her takimdan ortak sunuma girecek olan sunumun id'si - SUNUS SIRASINDA. */
                                     List<Long> secilenSunumIdler,
                                     /** Sirayi en son degistiren kullanicinin sicili; hic siralanmadiysa null. */
                                     String siralayan,
                                     /** Siralamanin en son degistirildigi an; hic siralanmadiysa null. */
                                     Instant siralamaZamani,
                                     /** Doneme dusen TUM sunumlar (cakisanlar dahil), SUNUS SIRASINDA. */
                                     List<PresentationSummaryDto> sunumlar) {
}
