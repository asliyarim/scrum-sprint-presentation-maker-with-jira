import { DAV_COLORS, initialsOf, sanitizeDecimalInput, sanitizeIntegerInput, sanitizeRatioInput } from "../../lib/format";
import LeaveDaysField from "./LeaveDaysField";

/**
 * Tek bir ekip uyesi karti: kisi bilgileri + o kisiye ait is kalemleri.
 * Gorsel tasarim DashboardEditModal'daki ".dashedit-*" kart dili (avatar +
 * kompakt mini-etiketli alanlar, hover'da beliren silme ikonu) ile AYNI -
 * eskiden duz .bar/.barrow/.barlabel kutulariydi (bkz. kullanici bildirimi,
 * 2026-08-17: "ekip üyesi ekleme yeri kötü duruyor ... apple UI/UX tasarım
 * stilini esas al"). Pressman - User Help Facilities: startDate icin "1
 * Haziran'dan once ise hedef 145 gun olur" bilgisini hint olarak veririz.
 */
export default function MemberCard({ member, index, statuses, items, onUpdateMember, onRemoveMember, onAddItem, onUpdateItem, onRemoveItem, teamId, reportDate = null, periodEnd = null }) {
  const avatarColor = "#" + DAV_COLORS[(index || 0) % DAV_COLORS.length];

  // Manuel Gir'de sirket tatilleri OTOMATIK EKLENMEZ. Eskiden ad soyad
  // alanindan cikilinca (blur) autoApplyCompanyHolidays cagriliyordu
  // (2026-08-21 talebi: "bu izinle kişi manuel eklenirken zaten otomatik
  // gelmesi lazım"), ama bu PO'nun istemedigi bir varsayimi dayatiyordu:
  // kisi eklenir eklenmez kapasite tatiller kadar dusuk cikiyor ve PO
  // istemiyorsa izinleri TEK TEK elle silmek zorunda kaliyordu (kullanici
  // bildirimi 2026-08-27: "145 girdim 128 yazdi, tatilleri elle silince 135
  // oldu - manuel kisminda tatiller girilmemis olmali, isteyen İzin Ekle ile
  // eklesin").
  //
  // Tatiller kaybolmuyor: "İzin Ekle" penceresindeki "ŞİRKET TAKVİMİNDEN EKLE"
  // bolumunde + ile tek tiklamayla eklenebiliyor. Excel akisi ise DEGISMEDI -
  // orada tatiller yine otomatik eklenir ama kapasiteden DUSULMEZ, cunku
  // Excel'in "Kalan İş Günü" degeri onlari zaten dusmustur (bkz.
  // LeaveDaysField.ignoreAutoHolidays).

  return (
    <div className="mcard" style={{ "--i": index || 0 }}>
      <div className="mcard-head">
        <span className="mcard-avatar" style={{ background: avatarColor }}>{initialsOf(member.fullName)}</span>
        <div className="mcard-identity">
          <input
            className="mcard-name"
            placeholder="Ad Soyad"
            value={member.fullName}
            onChange={(e) => onUpdateMember({ fullName: e.target.value })}
          />
          <input
            className="mcard-role"
            placeholder="Rol (örn: Geliştirici)"
            value={member.role}
            onChange={(e) => onUpdateMember({ role: e.target.value })}
          />
        </div>
        <button type="button" className="mcard-remove" onClick={onRemoveMember}>
          Kişiyi sil
        </button>
      </div>

      <div className="mcard-meta">
        <label className="mcard-meta-field" title="İşe başlama tarihi — 1 Haziran'dan önceyse hedef iş günü otomatik 145 olur">
          <span>İşe başlama</span>
          <input type="date" value={member.startDate} onChange={(e) => onUpdateMember({ startDate: e.target.value })} />
        </label>
        <label className="mcard-meta-field">
          <span>Statü</span>
          <select value={member.statusCode} onChange={(e) => onUpdateMember({ statusCode: e.target.value })}>
            {statuses.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label || s.code}
              </option>
            ))}
          </select>
        </label>
        <label className="mcard-meta-field" title="Boş bırakılırsa 1 Haziran kuralına göre otomatik hesaplanır, sonradan değiştirilebilir">
          <span>Hedef gün</span>
          <input
            inputMode="numeric"
            placeholder="opsiyonel"
            value={member.targetWorkDays || ""}
            onChange={(e) => onUpdateMember({ targetWorkDays: sanitizeIntegerInput(e.target.value) })}
          />
        </label>
        <label className="mcard-meta-field" title="Boş bırakılırsa takım seviyesindeki genel bakım/SR oranı kullanılır (örn: 0.2 = %20)">
          <span>Bakım oranı</span>
          <input
            inputMode="decimal"
            placeholder="opsiyonel"
            value={member.maintenanceAllocationPercent || ""}
            onChange={(e) => onUpdateMember({ maintenanceAllocationPercent: sanitizeRatioInput(e.target.value) })}
          />
        </label>
        <LeaveDaysField
          teamId={teamId}
          fullName={member.fullName}
          role={member.role}
          reportDate={reportDate}
          periodEnd={periodEnd}
          onTotalChange={(total) => {
            if (total !== (member.leaveDays || 0)) onUpdateMember({ leaveDays: total });
          }}
        />
      </div>

      <div className="mcard-items-label">İş kalemleri</div>
      <div className="mcard-items">
        {items.map((item) => (
          <div className="mitem" key={item.clientId}>
            <input
              className="mitem-title"
              placeholder="İş adı"
              value={item.title}
              onChange={(e) => onUpdateItem(item.clientId, { title: e.target.value })}
            />
            <input
              className="mitem-effort"
              placeholder="Efor (AG)"
              inputMode="decimal"
              value={item.plannedEffortDays}
              onChange={(e) => onUpdateItem(item.clientId, { plannedEffortDays: sanitizeDecimalInput(e.target.value) })}
            />
            <label className="mitem-done" title="İşaretlenirse eforu Tamamlanan'a, işaretlenmezse Açık (Kalan)'a sayılır">
              <input
                type="checkbox"
                checked={item.statusCode === "DONE"}
                onChange={(e) => onUpdateItem(item.clientId, { statusCode: e.target.checked ? "DONE" : "OPEN" })}
              />
              Tamamlandı
            </label>
            <input
              type="date"
              className="mitem-date"
              title="Eklenme tarihi (opsiyonel — Yeni Eklenen Efor hesaplaması için)"
              value={item.addedDate}
              onChange={(e) => onUpdateItem(item.clientId, { addedDate: e.target.value })}
            />
            <input
              type="date"
              className="mitem-date"
              title="Kapanma tarihi (opsiyonel — Dönem Kapanan Efor hesaplaması için)"
              value={item.closedDate}
              onChange={(e) => onUpdateItem(item.clientId, { closedDate: e.target.value })}
            />
            <button type="button" className="mitem-remove" title="İş kalemini sil" onClick={() => onRemoveItem(item.clientId)}>
              ×
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="mcard-additem" onClick={onAddItem}>
        + İş kalemi ekle
      </button>
    </div>
  );
}
