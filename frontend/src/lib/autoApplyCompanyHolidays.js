import { ensureTeamMember, fetchCompanyWideLeaves, fetchMemberLeaves, createLeavePeriod } from "./apiClient";
import { sumFractions } from "./leaveDays";

/**
 * Kisi listesine, sirket takvimindeki (SIRKET_TATILI) TUM tatil gunlerini
 * OTOMATIK olarak izin kaydi olarak ekler - kullanicinin her kisi icin tek
 * tek "İzin Ekle" acip sirket takviminden secmesine gerek kalmaz;
 * LeaveDaysField'daki popover yine de acilir ve bu kayitlari "zaten eklenmis"
 * olarak gosterir/duzenlemeye izin verir.
 *
 * İKİ cagiran nokta var: Excel yuklendiginde TUM kisi listesi icin birden
 * (bkz. App.jsx - Excel'deki Toplam/Tamamlanan sayilari zaten bu tatiller
 * dusulmus sekilde hazirlandigi icin) VE Manuel Gir'de bir kisinin adi
 * girilip alandan cikildiginda TEK kisi icin (bkz. MemberCard.jsx onBlur -
 * kullanici bildirimi, 2026-08-21: "bu izinle kişi manuel eklenirken zaten
 * otomatik gelmesi lazım" - eskiden Manuel Gir'de bu BILEREK tetiklenmiyordu,
 * kullanici artik bunu istiyor).
 *
 * Zaten eklenmis (ayni start/end tarihli) kayitlar TEKRAR eklenmez - Excel
 * yeniden yuklenirse/ayni isim tekrar blur olursa kopya olusturulmaz.
 * Best-effort: tek bir kisi/tatil basarisiz olursa digerlerini durdurmaz,
 * sessizce atlar (kullanici gerekirse elle "İzin Ekle" ile ekleyebilir).
 *
 * @param {{name:string, role:string}[]} persons
 * @param {number|string} teamId
 * @returns {Promise<Map<string, number>>} kisi adi -> toplam izin gunu (persons
 *   dizisindeki leaveDays alanini guncellemek icin cagiran taraf kullanir)
 */
/**
 * Bu fonksiyonun olusturdugu izin kayitlarinin aciklamasi - kaydin "elle
 * girilmis" mi yoksa "sirket takviminden otomatik kopyalanmis" mi oldugunu
 * ayirt etmeye yarar. Excel akisi bu kayitlari kapasiteden DUSMEZ (Excel'in
 * "Kalan İş Günü" degeri sirket tatillerini zaten dusuyor), Manuel Gir akisi
 * ise duser - bkz. LeaveDaysField.ignoreAutoHolidays.
 */
export const OTOMATIK_TATIL_ACIKLAMASI = "Şirket takviminden otomatik eklendi";

/**
 * Bir izin kaydi bu fonksiyon tarafindan otomatik mi olusturulmus?
 *
 * ONEK ile karsilastirilir, tam esitlikle DEGIL: veritabaninda kodun eski bir
 * surumunden kalma "... (Excel yükleme)" ekli kayitlar da var (lokalde 60
 * adet). Tam esitlik arayan ilk deneme bunlari kaciriyordu ve Excel akisinda
 * tatiller yine kapasiteden dusuluyordu (kullanici bildirimi 2026-08-26:
 * "2 günlük izin ekledim, 8 gün düştü").
 */
export function otomatikTatilMi(izin) {
  return String(izin?.description || "").startsWith(OTOMATIK_TATIL_ACIKLAMASI);
}

export async function autoApplyCompanyHolidays(persons, teamId) {
  const totals = new Map();
  if (!teamId || !persons?.length) return totals;

  let holidays;
  try {
    const company = await fetchCompanyWideLeaves();
    holidays = company.filter((c) => c.type === "SIRKET_TATILI");
  } catch {
    return totals; // takvim alinamadiysa sessizce vazgec - kullanici elle ekleyebilir
  }
  if (!holidays.length) return totals;

  for (const p of persons) {
    if (!p.name?.trim()) continue;
    try {
      const member = await ensureTeamMember(teamId, p.name, p.role);
      const existing = await fetchMemberLeaves(member.id);
      const existingKeys = new Set(existing.map((l) => `${l.startDate}_${l.endDate}`));
      const missing = holidays.filter((h) => !existingKeys.has(`${h.startDate}_${h.endDate}`));

      for (const h of missing) {
        await createLeavePeriod({
          name: h.name, type: "YILLIK_IZIN", scope: "TEAM_MEMBER", teamMemberId: member.id,
          startDate: h.startDate, endDate: h.endDate, dayFraction: h.dayFraction,
          description: OTOMATIK_TATIL_ACIKLAMASI,
        });
      }

      const finalLeaves = missing.length ? await fetchMemberLeaves(member.id) : existing;
      totals.set(p.name, sumFractions(finalLeaves));
    } catch {
      // bu kisi icin basarisiz oldu (orn. ad henuz benzersiz degil) - digerlerine devam
    }
  }
  return totals;
}
