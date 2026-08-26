import { DAV_COLORS, initialsOf, nfmtInt, num, sanitizeDecimalInput } from "../../lib/format";
import LeaveDaysField from "./LeaveDaysField";

/**
 * Kisi eslestirme tablosu: Excel'den gelen ad/rol/kisaltma/tamamlanan/toplam
 * kullanici tarafindan duzenlenebilir (Toplam da dahil - Excel'in verdigi
 * deger baslangic degeridir, kullanici gerekirse elle duzeltebilir, bkz.
 * kullanici bildirimi). Acik = Toplam - Tamamlanan otomatik hesaplanip
 * gosterilir (Pressman - User Help Facilities: kullanici hesaplamayi elle
 * yapmak zorunda kalmaz, sonucu aninda gorur).
 */
export default function PersonMappingTable({ persons, onUpdate, teamId, reportDate = null }) {
  if (!persons.length) {
    return <div className="mhint">Önce Excel yükleyin.</div>;
  }

  return (
    <div id="personMap">
      <div className="pmhead">
        <span style={{ width: 30, flex: "none" }} />
        <span style={{ flex: 2 }}>Ad Soyad</span>
        <span style={{ flex: 1.5 }}>Rol</span>
        <span style={{ width: 60, textAlign: "center" }}>Kısa</span>
        <span style={{ width: 76, textAlign: "center" }}>Toplam</span>
        <span style={{ width: 76, textAlign: "center" }}>Tamamlanan</span>
        <span style={{ width: 70, textAlign: "right" }}>Açık</span>
      </div>
      {persons.map((p, i) => {
        const acik = num(p.toplam) - num(p.tamamlanan);
        return (
          <div className="pmrow" key={i}>
            <div className="av" style={{ background: "#" + DAV_COLORS[i % DAV_COLORS.length] }}>
              {(p.initials || initialsOf(p.name))}
            </div>
            <input className="pmname" placeholder="Ad Soyad" value={p.name} onChange={(e) => onUpdate(i, { name: e.target.value })} />
            <input className="pmrole" placeholder="Rol (örn: Geliştirici)" value={p.role} onChange={(e) => onUpdate(i, { role: e.target.value })} />
            <input className="pmini" placeholder="Kısa" maxLength={3} value={p.initials} onChange={(e) => onUpdate(i, { initials: e.target.value })} />
            <input
              className="pmtam"
              style={{ width: 76 }}
              placeholder="0"
              title="Toplam planlanan iş yükü (AG) — Excel'den gelir, gerekirse düzeltebilirsiniz"
              inputMode="decimal"
              value={p.toplam}
              onChange={(e) => onUpdate(i, { toplam: sanitizeDecimalInput(e.target.value) })}
            />
            <input
              className="pmtam"
              style={{ width: 76 }}
              placeholder="0"
              title="Tamamlanan iş yükü (AG)"
              inputMode="decimal"
              value={p.tamamlanan}
              onChange={(e) => onUpdate(i, { tamamlanan: sanitizeDecimalInput(e.target.value) })}
            />
            <div className="pmmeta" style={{ width: 70 }}>{nfmtInt(acik)}</div>
            <LeaveDaysField
              teamId={teamId}
              fullName={p.name}
              role={p.role}
              reportDate={reportDate}
              // Excel kaynaginda sirket tatilleri kapasiteden DUSULMEZ -
              // Excel'in "Kalan İş Günü" degeri onlari zaten dusuyor
              // (bkz. LeaveDaysField.ignoreAutoHolidays).
              ignoreAutoHolidays
              onTotalChange={(total) => {
                if (total !== (p.leaveDays || 0)) onUpdate(i, { leaveDays: total });
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
