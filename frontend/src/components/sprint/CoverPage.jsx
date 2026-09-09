import { useRef, useState } from "react";
import Button from "../shared/Button";
import AlertModal from "../shared/AlertModal";
import ReadOnlyNotice from "../shared/ReadOnlyNotice";
import { IconUpload, IconUsers, IconHash, IconCalendar, IconClock } from "../shared/icons";
import { isValidNumberInput } from "../../lib/validation";
import { sanitizeIntegerInput } from "../../lib/format";
import { TEAM_TYPES } from "../../lib/teamTypes";

/**
 * Sihirbazin 1. adimi: Kapak sayfasi parametreleri (takim tipi / sprint no /
 * tarih araligi - eskiden sabit ust cubuk olan MetaBar) + kapak gorseli.
 * Gorsel varsayilan olarak ASSETS.cover_bg gelir, kullanici degistirebilir
 * (bkz. useCoverImage).
 *
 * Ekip adi ayrica elle girilmiyor - goruntulenen isim secilen Takım Tipi'nin
 * etiketinden otomatik turer (bkz. useSprintForm.js). Boylece iki farkli
 * yerde (secim + serbest metin) ayni bilgiyi tutup birbirinden sapan iki
 * "ekip adi" gorunmesi engellenir; Excel yuklendiginde de sadece takim tipi
 * degisir, isim otomatik onu takip eder.
 *
 * Takım Tipi secimi, kullanicinin kendi takimina ait olmayan bir sunumu da
 * (salt-okunur) goruntuleyebilmesi icin HER ZAMAN etkilesimli kalir; yetkisiz
 * bir takim secilince App.jsx (bkz. handleTeamTypeChange) o takimin EN SON
 * sprint sunumunu cekip onizlemeye yukler, geri kalan parametre alanlari
 * yerine de ReadOnlyNotice gosterilir.
 */
export default function CoverPage({
  teamType,
  setTeamType,
  sprint,
  setSprint,
  range,
  setRange,
  periodStart,
  periodEnd,
  onPeriodChange,
  cover,
  coverBackground,
  canEdit = true,
  timerMinutes,
  setTimerMinutes,
  readOnlyView = null,
}) {
  const fileInputRef = useRef(null);
  const bgFileInputRef = useRef(null);
  const [sprintAlert, setSprintAlert] = useState(false);

  const handleSprintBlur = () => {
    if (!isValidNumberInput(sprint)) setSprintAlert(true);
  };

  return (
    <section>
      <div className="meta" style={{ borderRadius: 12, border: "1px solid var(--line)" }}>
        <div className="field">
          <label>Takım tipi</label>
          <div className="icon-select">
            <span className="icon-select-badge">
              <IconUsers style={{ width: 14, height: 14 }} />
            </span>
            <select className="premium-select" value={teamType} onChange={(e) => setTeamType(e.target.value)}>
              {TEAM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {canEdit && (
          <>
            <div className="field">
              <label>Sprint no</label>
              <div className="icon-field">
                <IconHash className="icon-field-icon" style={{ width: 14, height: 14 }} />
                <input inputMode="numeric" value={sprint} onChange={(e) => setSprint(sanitizeIntegerInput(e.target.value))} onBlur={handleSprintBlur} />
              </div>
            </div>
            {/* Tarih aralığı artık SERBEST METİN DEĞİL, takvimden seçiliyor
                (Gözde onayı 2026-09-09). Seçilen iki tarihten slaytta görünen
                metin türetilir; böylece hem ekipler her sprintte tarihi
                güncellemek zorunda kalır hem de otomatik ortak sunum dönemleri
                güvenilir şekilde eşleştirebilir. Eski kayıtlar açıldığında
                mevcut metin ayrıştırılıp alanlar dolu gelir; ayrıştırılamazsa
                alanlar boş kalır ve PO tarihleri seçer.
                bkz. lib/sprintPeriod.js */}
            <div className="field">
              <label>Sprint başlangıcı</label>
              <div className="icon-field">
                <IconCalendar className="icon-field-icon" style={{ width: 14, height: 14 }} />
                <input
                  type="date"
                  value={periodStart}
                  max={periodEnd || undefined}
                  onChange={(e) => onPeriodChange(e.target.value, periodEnd)}
                />
              </div>
            </div>
            <div className="field">
              <label>Sprint bitişi</label>
              <div className="icon-field">
                <IconCalendar className="icon-field-icon" style={{ width: 14, height: 14 }} />
                <input
                  type="date"
                  value={periodEnd}
                  min={periodStart || undefined}
                  onChange={(e) => onPeriodChange(periodStart, e.target.value)}
                />
              </div>
            </div>
            {range && (
              <div className="field grow">
                <label>Slaytta görünecek</label>
                <div className="icon-field">
                  <IconCalendar className="icon-field-icon" style={{ width: 14, height: 14 }} />
                  <input value={range} readOnly tabIndex={-1} style={{ opacity: 0.75 }} />
                </div>
              </div>
            )}
            <div className="field">
              <label>Sunum süresi (dakika)</label>
              <div className="icon-field">
                <IconClock className="icon-field-icon" style={{ width: 14, height: 14 }} />
                <input
                  inputMode="numeric"
                  value={timerMinutes}
                  onChange={(e) => setTimerMinutes(sanitizeIntegerInput(e.target.value))}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {canEdit && (
        <div className="hint" style={{ marginTop: 8 }}>
          Sunum süresi kaydetmek için zorunludur - önizleme açıldığında bu süre geri sayım olarak başlar. Dilediğiniz zaman tekrar değiştirip kaydedebilirsiniz.
        </div>
      )}

      {!canEdit && <ReadOnlyNotice teamType={teamType} view={readOnlyView} />}

      <AlertModal
        open={sprintAlert}
        title="Eksik bilgi"
        message="Sprint no sayı olmalı (örn: 7)."
        onClose={() => setSprintAlert(false)}
      />

      {canEdit && (
        <>
          <p className="panelttl" style={{ marginTop: 14 }}>Kapak görseli</p>
          <div className="sec cover-image-sec">
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <img
                src={cover.coverBg}
                alt="Kapak görseli önizleme"
                className="cover-preview-img"
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files[0]) cover.setFromFile(e.target.files[0]);
                    e.target.value = "";
                  }}
                />
                <span style={{ display: "flex", gap: 10 }}>
                  <Button variant="soft" loading={cover.uploading} loadingLabel="Yükleniyor…" onClick={() => fileInputRef.current?.click()}>
                    <IconUpload className="navbar-icon" />
                    Görseli Değiştir
                  </Button>
                  {cover.isCustom && (
                    <Button variant="ghost" onClick={cover.reset}>
                      Varsayılana Dön
                    </Button>
                  )}
                </span>
                {cover.uploadError && <div className="hint" style={{ color: "#B45309" }}>{cover.uploadError}</div>}
              </div>
            </div>
            <div className="hint" style={{ marginTop: 10 }}>
              Değiştirmezseniz varsayılan kapak görseli kullanılır. Seçtiğiniz görsel bu oturuma özeldir.
            </div>
          </div>

          {coverBackground && (
            <>
              <p className="panelttl" style={{ marginTop: 14 }}>Sunum arka planı</p>
              <div className="sec cover-image-sec">
                <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                  {coverBackground.bg ? (
                    // Yuklenen arka plani kaldirmak icin gorselin KENDI kosesinde
                    // bir "×" - PO notu 2026-08-19: "x butonu bulunmuyor kaldırmak
                    // istediğimde. Sadece üzerine görsel ekleyebiliyorum".
                    <span className="cover-preview-wrap">
                      <img
                        src={coverBackground.bg}
                        alt="Sunum arka planı önizleme"
                        className="cover-preview-img"
                      />
                      <button
                        type="button"
                        className="cover-preview-remove"
                        title="Arka planı kaldır"
                        aria-label="Arka planı kaldır"
                        onClick={coverBackground.reset}
                      >
                        ×
                      </button>
                    </span>
                  ) : (
                    <div className="cover-bg-placeholder" onClick={() => bgFileInputRef.current?.click()}>
                      Arka plan yok
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <input
                      ref={bgFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files[0]) coverBackground.setFromFile(e.target.files[0]);
                        e.target.value = "";
                      }}
                    />
                    <span style={{ display: "flex", gap: 10 }}>
                      <Button variant="soft" loading={coverBackground.uploading} loadingLabel="Yükleniyor…" onClick={() => bgFileInputRef.current?.click()}>
                        <IconUpload className="navbar-icon" />
                        {coverBackground.bg ? "Arka Planı Değiştir" : "Arka Plan Yükle"}
                      </Button>
                      {coverBackground.bg && (
                        <Button variant="ghost" onClick={coverBackground.reset}>
                          Kaldır
                        </Button>
                      )}
                      {/* Tek tusla ANA SABLONA donus - PO notu 2026-08-19:
                          "Sıfırla butonu da olabilir ana templete geçebilmek
                          için". Hem kapak gorselini hem sunum arka planini
                          varsayilana alir. */}
                      {(coverBackground.bg || cover.isCustom) && (
                        <Button variant="ghost" onClick={() => { coverBackground.reset(); cover.reset(); }}>
                          Sıfırla (ana şablon)
                        </Button>
                      )}
                    </span>
                    {coverBackground.uploadError && <div className="hint" style={{ color: "#B45309" }}>{coverBackground.uploadError}</div>}
                  </div>
                </div>
                <div className="hint" style={{ marginTop: 10 }}>
                  Yüklediğiniz görsel <b>tüm slaytların</b> (kapak, içerik ve kapasite dashboard) zemini olur —
                  hem canlı önizlemede hem PPTX çıktısında. Yüklenmezse varsayılan şablon zemini kullanılır. Görselin köşesindeki <b>×</b> ile
                  kaldırabilir, <b>Sıfırla</b> ile kapak görseli dahil ana şablona dönebilirsiniz.
                </div>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
