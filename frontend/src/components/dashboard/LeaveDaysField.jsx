import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Modal from "../shared/Modal";
import { IconCalendar, IconCheckCircle, IconPlusCircle } from "../shared/icons";
import {
  ensureTeamMember,
  fetchCompanyWideLeaves,
  fetchMemberLeaves,
  createLeavePeriod,
  deleteLeavePeriod,
} from "../../lib/apiClient";
import { periodDays, sumFractionsInWindow } from "../../lib/leaveDays";
import { otomatikTatilMi } from "../../lib/autoApplyCompanyHolidays";

function formatRange(p) {
  const fmt = (iso) => {
    const [y, m, d] = iso.split("-");
    return `${d}.${m}`;
  };
  return p.startDate === p.endDate ? fmt(p.startDate) : `${fmt(p.startDate)}–${fmt(p.endDate)}`;
}

// JiraDashboardPanel/ManualDashboardForm'daki AYNI kucuk yardimci - bir
// "premium-tile"in bos alanina tiklamak da icindeki input/select'i odaklasin
// (bkz. o dosyalardaki ayni fonksiyon).
function focusTileField(e) {
  if (e.target.closest("input, select, textarea")) return;
  e.currentTarget.querySelector("input, select, textarea")?.focus();
}

/**
 * Bir kişinin izin günü kaydini yonetir - hem MANUEL (serbest tarih araligi)
 * hem de ŞİRKET TAKVİMİNDEN (bkz. LeaveCalendarSeeder, sadece SIRKET_TATILI -
 * resmi bayramlar HARİÇ, bkz. kullanici bildirimi) secilerek eklenebilir.
 * Kisi henuz gercek (persisted) bir team_members satirina sahip degilse
 * (manuel/Excel akislarindaki gecici kisiler) ilk ekleme aninda
 * ensureTeamMember ile ad'a gore bulunur/olusturulur - bkz. apiClient.js.
 * PersonMappingTable (Excel) VE MemberCard (manuel) TARAFINDAN ORTAK kullanilir.
 *
 * Gorsel tasarim DashboardEditModal ile AYNI "premium/Apple" dilini kullanir
 * (".dashedit-box"/".premium-tile"/".premium-add-btn", bkz. theme.css) - eski
 * surum duz beyaz kutu + minik metin butonlardan olusuyordu (kullanici
 * bildirimi, 2026-08-21: "çok dümdüz js gibi duruyor").
 */
export default function LeaveDaysField({ teamId, fullName, role, onTotalChange, reportDate = null, periodEnd = null, ignoreAutoHolidays = false }) {
  const [open, setOpen] = useState(false);
  const [teamMemberId, setTeamMemberId] = useState(null);
  const [leaves, setLeaves] = useState(null); // null = henuz yuklenmedi
  const [companyLeaves, setCompanyLeaves] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [manualName, setManualName] = useState("");
  const [manualStart, setManualStart] = useState("");
  const [manualEnd, setManualEnd] = useState("");
  const [manualFraction, setManualFraction] = useState("1");
  const boxRef = useRef(null);
  // Popup, butonun bulundugu satirin ("backdrop-filter" kaynakli kendi
  // stacking context'i olusturan .pmrow/.bar) DISINA cikabilmesi icin
  // document.body'ye PORTAL edilir - aksi halde acilir ama sonraki satirlarin
  // ARKASINDA kalirdi (bkz. kullanici bildirimi - Excel yukleme tablosunda
  // alt satirlarin arkasinda kayboluyordu). Kutu/backdrop/Escape artik ortak
  // Modal bilesenine ait (DashboardEditModal ile AYNI desen).
  const handleClose = () => setOpen(false);

  // "Önce ad soyad girin." hatasi, kullanici İzin Ekle'yi ad HENUZ bosken
  // actiginda (ensureMemberId) gosteriliyor. Isim SONRADAN yazildiginda bu
  // eski hata KENDILIGINDEN kalkmiyordu - kullanici bildirimi 2026-08-20:
  // "izin eklemede de ... isim girdim halde lütfen ad soyad giriniz diyor"
  // (useManualDashboard.js'teki AYNI sinif hatanin - "En az bir isim
  // girmelisiniz" - AYNI cozumu: gecerli hale gelince otomatik temizle).
  useEffect(() => {
    if (fullName?.trim() && error === "Önce ad soyad girin.") setError(null);
  }, [fullName, error]);

  // SADECE rapor tarihinden SONRAYA dusen izin gunleri kapasiteden dusulur -
  // gecmis izinler zaten "Geçen İş Günü" icinde sayiliyor (bkz. leaveDays.js
  // sumFractionsInWindow ve kullanici bildirimi 2026-08-20: izin gunu gectikten
  // sonra kisi eski kapasite seviyesine geri donmeli).
  // ignoreAutoHolidays: Excel akisinda (PersonMappingTable) sirket takviminden
  // OTOMATIK kopyalanmis tatil gunleri kapasiteden DUSULMEZ - Excel'in "Kalan
  // İş Günü" degeri bu gunleri zaten dusuyor, bir kez daha dusulurse ayni
  // gunler iki kez sayilir (kullanici bildirimi 2026-08-26: kapasite 94 yerine
  // 87 gorunuyordu). Kullanicinin ELLE ekledigi izinler her iki akista da
  // dusulmeye devam eder. Manuel Gir (MemberCard) bu bayragi vermez, orada
  // kapasite Excel'den gelmedigi icin dusum dogrudur.
  const sayilanIzinler = leaves
    ? ignoreAutoHolidays
      ? leaves.filter((l) => !otomatikTatilMi(l))
      : leaves
    : null;
  const total = sayilanIzinler ? sumFractionsInWindow(sayilanIzinler, reportDate, periodEnd) : 0;

  useEffect(() => {
    onTotalChange?.(total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  // Sirket takvimi (companyLeaves) ad soyad'dan BAGIMSIZ, tum takim icin
  // ortak bir liste - ad henuz girilmemis olsa BILE otomatik yuklenmeli
  // (bkz. kullanici bildirimi: manuel girişte ad yazilmadan takvim ac
  // ilinca "Şirket Takviminden Ekle" bolumu hic gorunmuyordu). Kisiye ozel
  // izin gunleri (leaves) ise ancak ad girildiginde/team member
  // olusturulabildiginde yuklenebilir.
  const ensureLoaded = async () => {
    const needCompany = companyLeaves === null;
    const needMemberLeaves = leaves === null && teamId && fullName?.trim();
    if (!needCompany && !needMemberLeaves) return;
    setLoading(true);
    setError(null);
    try {
      if (needCompany) {
        const company = await fetchCompanyWideLeaves();
        setCompanyLeaves(company.filter((c) => c.type === "SIRKET_TATILI"));
      }
      if (needMemberLeaves) {
        const member = await ensureTeamMember(teamId, fullName, role);
        setTeamMemberId(member.id);
        const memberLeaves = await fetchMemberLeaves(member.id);
        setLeaves(memberLeaves);
      }
    } catch (err) {
      setError(err?.message || "İzin bilgisi alınamadı.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = async () => {
    setOpen((o) => !o);
    if (!open) await ensureLoaded();
  };

  const reload = async (id) => {
    const memberId = id || teamMemberId;
    if (!memberId) return;
    const memberLeaves = await fetchMemberLeaves(memberId);
    setLeaves(memberLeaves);
  };

  // Takvimden/elle ekleme aninda henuz teamMemberId yoksa (ad soyad,
  // "İzin Ekle" acildiktan SONRA girildiyse) burada lazy olarak olusturulur.
  const ensureMemberId = async () => {
    if (teamMemberId) return teamMemberId;
    if (!teamId || !fullName?.trim()) {
      setError("Önce ad soyad girin.");
      return null;
    }
    const member = await ensureTeamMember(teamId, fullName, role);
    setTeamMemberId(member.id);
    return member.id;
  };

  const addFromCompany = async (c) => {
    setLoading(true);
    setError(null);
    try {
      const memberId = await ensureMemberId();
      if (!memberId) return;
      await createLeavePeriod({
        name: c.name, type: "YILLIK_IZIN", scope: "TEAM_MEMBER", teamMemberId: memberId,
        startDate: c.startDate, endDate: c.endDate, dayFraction: c.dayFraction,
        description: "Şirket takviminden eklendi",
      });
      await reload(memberId);
    } catch (err) {
      setError(err?.message || "Eklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  const addManual = async () => {
    if (!manualStart || !manualEnd) return;
    setLoading(true);
    setError(null);
    try {
      const memberId = await ensureMemberId();
      if (!memberId) return;
      await createLeavePeriod({
        name: manualName.trim() || "Yıllık izin", type: "YILLIK_IZIN", scope: "TEAM_MEMBER", teamMemberId: memberId,
        startDate: manualStart, endDate: manualEnd, dayFraction: Number(manualFraction) || 1,
        description: null,
      });
      setManualName("");
      setManualStart("");
      setManualEnd("");
      setManualFraction("1");
      await reload(memberId);
    } catch (err) {
      setError(err?.message || "Eklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id) => {
    setLoading(true);
    try {
      await deleteLeavePeriod(id);
      await reload();
    } catch (err) {
      setError(err?.message || "Silinemedi.");
    } finally {
      setLoading(false);
    }
  };

  const addedCompanyIds = new Set((leaves || []).map((l) => `${l.startDate}_${l.endDate}`));

  return (
    <div className="leave-days-field" ref={boxRef}>
      <button type="button" className="leave-days-btn" onClick={handleOpen} title="İzin günlerini yönet">
        📅 İzin{total > 0 ? `: ${total}g` : " Ekle"}
      </button>
      {open && createPortal(
        <Modal open={open} onClose={handleClose} boxClassName="box dashedit-box">
          <div className="dashedit-head">
            <span className="dashedit-head-icon">
              <IconCalendar style={{ width: 20, height: 20 }} />
            </span>
            <div className="dashedit-head-titles">
              <span className="dashedit-title">İzin Günleri</span>
              <span className="dashedit-badge">{fullName || "—"}</span>
            </div>
            <button type="button" className="dashedit-close" onClick={handleClose} aria-label="Kapat">
              ×
            </button>
          </div>

          <div className="dashedit-body">
            {loading && <div className="mhint">Yükleniyor…</div>}
            {error && <div className="login-error" style={{ margin: "0 0 14px" }}>{error}</div>}

            {leaves && leaves.length > 0 && (
              <>
                <div className="dashedit-section-label">
                  <i /> Kayıtlı İzinler
                </div>
                <div className="leave-rows" style={{ marginBottom: 22 }}>
                  {leaves.map((l) => (
                    <div className="leave-row" key={l.id}>
                      <span className="leave-row-name" title={l.name}>{l.name}</span>
                      <span className="leave-row-range">{formatRange(l)}</span>
                      <span className="leave-row-chip">{periodDays(l)}g</span>
                      <button type="button" className="dashedit-remove" onClick={() => remove(l.id)} title="Sil">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {companyLeaves && companyLeaves.length > 0 && (
              <>
                <div className="dashedit-section-label">
                  <i /> Şirket Takviminden Ekle
                </div>
                <div className="leave-company-grid" style={{ marginBottom: 22 }}>
                  {companyLeaves.map((c) => {
                    const added = addedCompanyIds.has(`${c.startDate}_${c.endDate}`);
                    return (
                      <button
                        type="button"
                        key={c.id}
                        className={`leave-company-item${added ? " added" : ""}`}
                        disabled={added}
                        onClick={() => addFromCompany(c)}
                      >
                        <span className="leave-company-item-text">
                          <span className="leave-company-item-name">{c.name}</span>
                          <span className="leave-company-item-meta">{formatRange(c)} · {periodDays(c)}g</span>
                        </span>
                        {added
                          ? <IconCheckCircle className="leave-company-item-icon" />
                          : <IconPlusCircle className="leave-company-item-icon" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="dashedit-section-label">
              <i /> Elle Ekle
            </div>
            <div className="premium-tile-grid-compact">
              <div
                className="premium-tile premium-tile-compact"
                style={{ flexBasis: "100%", maxWidth: "100%" }}
                onClick={focusTileField}
              >
                <div className="premium-tile-label">Açıklama (ops.)</div>
                <input
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="örn. Yıllık izin"
                />
              </div>
              <div className="premium-tile premium-tile-compact" onClick={focusTileField}>
                <div className="premium-tile-label">Başlangıç</div>
                <input type="date" value={manualStart} onChange={(e) => setManualStart(e.target.value)} />
              </div>
              <div className="premium-tile premium-tile-compact" onClick={focusTileField}>
                <div className="premium-tile-label">Bitiş</div>
                <input type="date" value={manualEnd} onChange={(e) => setManualEnd(e.target.value)} />
              </div>
              <div className="premium-tile premium-tile-compact" onClick={focusTileField}>
                <div className="premium-tile-label">Süre</div>
                <select value={manualFraction} onChange={(e) => setManualFraction(e.target.value)}>
                  <option value="1">Tam gün</option>
                  <option value="0.5">Yarım gün</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              className="premium-add-btn"
              style={{ marginTop: 12 }}
              onClick={addManual}
              disabled={!manualStart || !manualEnd}
            >
              <IconPlusCircle className="add-btn-icon" />
              İzin Ekle
            </button>
          </div>
        </Modal>,
        document.body
      )}
    </div>
  );
}
