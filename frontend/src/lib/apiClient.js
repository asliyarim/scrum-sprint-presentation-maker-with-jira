// "??" kasten kullanilir: prod'da VITE_API_BASE_URL bilerek BOS STRING
// olarak build edilir (bkz. frontend/nginx.conf same-origin /api proxy'si -
// cross-site cookie/3rd-party cookie engellemesi sorunlarindan kacinmak icin).
// "||" olsaydi bos string falsy oldugundan yanlislikla localhost'a duserdi.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

/**
 * Auth cookie'leri (access_token/refresh_token) httpOnly oldugu icin JS'ten
 * okunamaz - backend'in Set-Cookie ile yazdigi cookie'ler "credentials: include"
 * ile otomatik gonderilir/alinir. XSRF-TOKEN cookie'si ise bilerek httpOnly
 * DEGIL: CSRF korumasi icin degerini okuyup X-CSRF-Token header'ina yansitiyoruz
 * (double-submit deseni, bkz. backend CsrfCookieFilter).
 */
function readCookie(name) {
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

function csrfHeaders() {
  const token = readCookie("XSRF-TOKEN");
  return token ? { "X-CSRF-Token": token } : {};
}

// access_token'in omru kisa (backend JwtProperties.accessTokenTtlMinutes=15) -
// refresh_token cookie'si (7 gun) hala gecerliyken kullanici 15 dakikadan
// uzun surdugu her oturumda sessizce "401"lere dusuyordu (bkz. kullanici
// bildirimi: Profil sayfasinda "Profil bilgileri alınamadı (HTTP 401)" ve
// konsolda tekrarlanan /api/auth/profile 401'leri) - backend'te calisan bir
// POST /api/auth/refresh ucu vardi ama frontend hicbir yerde cagirmiyordu.
// Asagidaki sarmalayici, authFetch ile atilan HER istekte 401 aldiginda
// BIR KEZ refresh dener, basariliysa istegi TEKRAR eder; refresh de
// basarisizsa (refresh_token da suresi dolmus/gecersiz) orijinal 401 yaniti
// aynen doner - cagiran taraf (App.jsx) bunu normal login-gerekli 401'i gibi
// isler. Ayni anda birden fazla istek 401 alirsa (orn. sayfa acilirken
// paralel /me + /profile) tek bir refresh cagrisinda birlesir (refreshPromise).
let refreshPromise = null;

function isAuthEndpoint(path) {
  return path.startsWith("/api/auth/login") || path.startsWith("/api/auth/refresh");
}

async function tryRefreshSession() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: csrfHeaders(),
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/**
 * fetch() sarmalayici: 401 aldiginda (login/refresh'in kendisi haric) bir kez
 * refresh dener ve basariliysa istegi tekrar eder. `path`, API_BASE_URL'e
 * gore GORECELI olmali (orn. "/api/auth/profile") - isAuthEndpoint kontrolu
 * icin. Mutasyon istekleri (POST/PUT/DELETE) icin `buildInit` bir fonksiyon
 * olarak verilir ki tekrar denemede X-CSRF-Token TAZE cookie degerinden
 * yeniden okunsun (refresh, XSRF-TOKEN cookie'sini rotate edebilir).
 */
async function authFetch(path, buildInit) {
  let response = await fetch(`${API_BASE_URL}${path}`, buildInit());
  if (response.status === 401 && !isAuthEndpoint(path)) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      response = await fetch(`${API_BASE_URL}${path}`, buildInit());
    }
  }
  return response;
}

async function parseErrorBody(response, fallbackMessage) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    // gövde JSON değilse yut
  }
  throw body || { status: response.status, message: fallbackMessage };
}

/**
 * Giris (sicil/sifre) endpoint'ini cagirir. Basarili girişte backend
 * access_token/refresh_token/XSRF-TOKEN cookie'lerini Set-Cookie ile yazar,
 * govdede {sicil, fullName, role, teamId} doner.
 */
export async function login(sicil, password) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sicil, password }),
    });
  } catch (networkErr) {
    throw { message: "Backend'e ulaşılamadı. Sunucunun çalıştığından ve " + API_BASE_URL + " adresinden erişilebilir olduğundan emin olun." };
  }

  if (!response.ok) {
    await parseErrorBody(response, response.status === 401 ? "Sicil no veya şifre hatalı." : "Sunucu hatası (HTTP " + response.status + ")");
  }

  return response.json();
}

/**
 * Sayfa yenilendiğinde mevcut oturumu (access_token cookie geçerliyse)
 * geri kurmak için kullanılır. Oturum yoksa/geçersizse null döner (hata
 * fırlatmaz - bu durum LoginPage'e düşmek için normal bir akış).
 */
export async function fetchCurrentUser() {
  const response = await authFetch("/api/auth/me", () => ({ credentials: "include" }));
  if (!response.ok) return null;
  return response.json();
}

/**
 * Profil sayfasindaki "Profil Bilgileri" butonu tiklandiginda cagirilir.
 * AD/personel servisiyle birebir ayni alan adlarini (company/department/
 * title/ExtensionAttribute4/6/8) tasiyan, salt-okunur genisletilmis bilgiyi
 * doner - /api/auth/me'nin hafif govdesinden farkli olarak burada tek seferlik,
 * istege bagli cekilir.
 */
export async function fetchUserProfile() {
  const response = await authFetch("/api/auth/profile", () => ({ credentials: "include" }));
  if (!response.ok) {
    await parseErrorBody(response, "Profil bilgileri alınamadı (HTTP " + response.status + ")");
  }
  return response.json();
}

/**
 * Profil sayfasindaki duzenlenebilir alanlari (ad, takim, sirket/departman/
 * unvan vb.) kaydeder. teamId degisebildigi icin backend yeni bir access
 * token cookie'si de yazar (bkz. AuthController.updateProfile) - o yuzden
 * requestJson'in credentials:"include" davranisi burada da onemli.
 */
export async function updateUserProfile(profile) {
  return requestJson("/api/auth/profile", { method: "PUT", body: JSON.stringify(profile) });
}

export async function logout() {
  await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: csrfHeaders(),
  });
}

/**
 * Backend'in stateless (kalici olmayan) kapasite dashboard endpoint'ini cagirir.
 * Hicbir sey veritabanina kaydedilmez - istek suresince yasar, aninda sonuc doner.
 *
 * Hata durumunda backend'in ApiErrorResponse'unu (status/error/message) oldugu
 * gibi firlatir; cagiran taraf ErrorBanner ile normalize edip gosterir.
 */
export async function computeStatelessDashboard(request) {
  let response;
  try {
    response = await authFetch("/api/capacity-dashboard/compute", () => ({
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify(request),
    }));
  } catch (networkErr) {
    throw { message: "Backend'e ulaşılamadı. Sunucunun çalıştığından ve " + API_BASE_URL + " adresinden erişilebilir olduğundan emin olun." };
  }

  if (!response.ok) {
    let body = null;
    try {
      body = await response.json();
    } catch {
      // gövde JSON değilse yut, asagida generic mesaj kullanilir
    }
    throw body || { status: response.status, message: "Sunucu hatası (HTTP " + response.status + ")" };
  }

  return response.json();
}

/**
 * Auth/CSRF header'larini ekleyip JSON gövdeli bir istek atan ortak yardimci -
 * team/presentation endpoint'lerinin hepsi ayni desende (credentials+CSRF+hata
 * normalize etme) oldugu icin tekrarlanmiyor.
 */
async function requestJson(path, options = {}) {
  let response;
  try {
    response = await authFetch(path, () => ({
      credentials: "include",
      headers: { "Content-Type": "application/json", ...csrfHeaders(), ...(options.headers || {}) },
      ...options,
    }));
  } catch (networkErr) {
    throw { message: "Backend'e ulaşılamadı. Sunucunun çalıştığından ve " + API_BASE_URL + " adresinden erişilebilir olduğundan emin olun." };
  }

  if (!response.ok) {
    await parseErrorBody(response, "Sunucu hatası (HTTP " + response.status + ")");
  }
  // 204 (No Content) disinda, 202 (Accepted) gibi govdesiz baska basarili
  // yanitlar da olabilir (orn. POST /jira-sync -> ResponseEntity.accepted().build()) -
  // response.json() bos govdede "Unexpected end of JSON input" ile patliyordu
  // (bkz. kullanici bildirimi). Govde varsa parse edilir, yoksa null donulur.
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

/** Takım seçici (admin split-screen sol panel) için mevcut takımları döner. */
export async function fetchTeams() {
  return requestJson("/api/teams");
}

/** Bir takıma ait kayıtlı sprint sunumlarının özet listesini döner. */
export async function fetchPresentations(teamId) {
  return requestJson(`/api/presentations?teamId=${teamId}`);
}

/** Tek bir sunumun tam içeriğini (editörü hidratlamak için) döner. */
export async function fetchPresentation(id) {
  return requestJson(`/api/presentations/${id}`);
}

/**
 * Sunumu kaydeder - yoksa oluşturur (version=1), varsa yeni bir versiyon
 * olarak günceller (bkz. backend PresentationService.upsert). Yetkisiz
 * takıma yazma denemesi 403 fırlatır (backend PresentationFacade).
 */
export async function savePresentation({ id, teamId, sprintNo, dateRange, content }) {
  // id verilirse (mevcut sunum duzenleniyor) backend o kaydi gunceller; sprint
  // no degistiyse RENAME eder, yeni kart olusturmaz (bkz. PresentationService.upsert).
  return requestJson("/api/presentations", {
    method: "PUT",
    body: JSON.stringify({ id, teamId, sprintNo, dateRange, content }),
  });
}

/**
 * "Güncelle": savePresentation'ın aksine YENİ bir sürüm OLUŞTURMAZ, mevcut
 * güncel içeriği yerinde değiştirir (bkz. backend PresentationService.
 * updateInPlace). Ortak Sunum ekranından "Düzenle" ile gelindiğinde kullanılır.
 */
export async function updatePresentationInPlace(id, dateRange, content) {
  return requestJson(`/api/presentations/${id}/content`, {
    method: "PUT",
    body: JSON.stringify({ dateRange, content }),
  });
}

/** Bir sunumun versiyon (audit log) geçmişini döner. */
export async function fetchPresentationVersions(id) {
  return requestJson(`/api/presentations/${id}/versions`);
}

/**
 * Belirli bir surumun TAM icerigini (content dahil) doner. fetchPresentationVersions
 * yalnizca meta (numara/kim/ne zaman) verir; bu ise o surumun sunum icerigini
 * getirir - Ortak Sunum ekraninda PO nun sectigi surumle sunum hazirlamasi icin.
 * SALT OKUMA - backend head e/gecmise dokunmaz (bkz. PresentationController.getVersion).
 */
export async function fetchPresentationVersion(id, version) {
  return requestJson(`/api/presentations/${id}/versions/${version}`);
}

/**
 * Bir sunumu VE tum surum gecmisini KALICI siler (geri alinamaz). Backend
 * yalnizca o takima yazma yetkisi olan (ya da admin) kullaniciya izin verir
 * (bkz. PresentationFacade.delete); yetkisizse 403 doner.
 */
export async function deletePresentation(id) {
  return requestJson(`/api/presentations/${id}`, { method: "DELETE" });
}

/**
 * Ortak (çoklu takım) sunum ekranı için: verilen her takımın EN SON sunumunu
 * döner (bkz. backend PresentationFacade.listLatestPerTeam). Okuma herkese
 * açık olduğundan PO'lar da diğer takımların en son sürümünü buradan görür.
 */
export async function fetchLatestPresentationsByTeams(teamIds) {
  return requestJson(`/api/presentations/latest?teamIds=${teamIds.join(",")}`);
}

/** Bir PPTX indirmesini (toplu/bireysel) denetim amaçlı kaydeder — bkz. backend PresentationDownloadLog. */
export async function recordPresentationDownload(downloadType, teamIds) {
  return requestJson("/api/presentations/downloads", {
    method: "POST",
    body: JSON.stringify({ downloadType, teamIds }),
  });
}

/** Belirtilen versiyonu YENİ bir versiyon olarak head'e geri kopyalar (geçmiş silinmez). */
export async function rollbackPresentation(id, version) {
  return requestJson(`/api/presentations/${id}/versions/${version}/rollback`, { method: "POST" });
}

/** Monitoring sayfasi ust bilgi seridi (bugunku islem sayisi, aktif kullanici vb.) - admin-only. */
export async function fetchAuditSummary() {
  return requestJson("/api/monitoring/summary");
}

/** Filtre dropdown'lari icin kullanicilar/eylem turleri/takimlar - admin-only. */
export async function fetchAuditFilterOptions() {
  return requestJson("/api/monitoring/filters");
}

/** Sayfalanmis aktivite log listesi - filters: {actorSicil, actionCode, entityType, teamId, success, from, to, page, size}. */
export async function fetchAuditLogs(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") params.set(key, value);
  });
  const qs = params.toString();
  return requestJson(`/api/monitoring/audit-logs${qs ? `?${qs}` : ""}`);
}

/**
 * Kapak gorseli/arka plani MinIO'ya yuklenir ve erisim URL'i geri doner. Tek
 * kullanimlik bir ozellik oldugu icin bu istek best-effort'tur - cagiran taraf
 * (useCoverImage/useCoverBackground) hata durumunda kullaniciyi engellemez,
 * gorseli zaten kendi tarafinda (base64) kullanmaya devam eder.
 */
async function uploadAssetImage(path, file) {
  const form = new FormData();
  form.append("file", file);

  const response = await authFetch(path, () => ({
    method: "POST",
    credentials: "include",
    headers: csrfHeaders(),
    body: form,
  }));

  if (!response.ok) {
    let body = null;
    try {
      body = await response.json();
    } catch {
      // gövde JSON değilse yut
    }
    throw body || { status: response.status, message: "Görsel yüklenemedi (HTTP " + response.status + ")" };
  }

  return response.json();
}

export async function uploadCoverImage(file) {
  return uploadAssetImage("/api/assets/cover-image", file);
}

/** Kapak slaydinin tam zemin arka plani - "Kapak Görseli"nin SEFFAF bölgelerinden görünen alt katman (bkz. useCoverBackground). */
export async function uploadCoverBackground(file) {
  return uploadAssetImage("/api/assets/cover-background", file);
}

/** Velocity & Burndown adimindaki ekran goruntuleri (bkz. useVelocityBurndown). */
export async function uploadBurndownChart(file) {
  return uploadAssetImage("/api/assets/burndown-chart", file);
}

export async function uploadVelocityChart(file) {
  return uploadAssetImage("/api/assets/velocity-chart", file);
}

/** Bir takımın (persisted) üye listesini döner - izin günü kaydı için gerçek bir team_member_id bulmak/oluşturmak üzere kullanılır. */
export async function fetchTeamMembers(teamId) {
  return requestJson(`/api/teams/${teamId}/members`);
}

/** Yeni bir (persisted) takım üyesi oluşturur. */
export async function createTeamMember(teamId, { fullName, role }) {
  return requestJson(`/api/teams/${teamId}/members`, {
    method: "POST",
    body: JSON.stringify({ fullName, role: role || null }),
  });
}

/**
 * Ad Soyad'a göre (case-insensitive) bir takımda mevcut bir üyeyi bulur, yoksa
 * oluşturur. Manuel/Excel akışlarındaki kişiler geçici (clientId) olduğu için,
 * izin günü kayıtlarını (leave_periods.team_member_id FK'si) gerçek bir
 * team_members satırına bağlamak için kullanılır.
 */
export async function ensureTeamMember(teamId, fullName, role) {
  const trimmed = (fullName || "").trim();
  if (!trimmed) throw new Error("Ad Soyad boş olamaz.");
  const members = await fetchTeamMembers(teamId);
  const existing = members.find((m) => m.fullName.trim().toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing;
  return createTeamMember(teamId, { fullName: trimmed, role });
}

/** Şirket geneli (COMPANY_WIDE) izin/tatil takvimi - resmi bayram (RESMI_TATIL) ve ortak şirket izni (SIRKET_TATILI) kayıtları karışık döner. */
export async function fetchCompanyWideLeaves() {
  return requestJson("/api/leave-periods/company-wide");
}

/** Bir takım üyesinin kayıtlı (TEAM_MEMBER scope) izin günü kayıtları. */
export async function fetchMemberLeaves(teamMemberId) {
  return requestJson(`/api/leave-periods/members/${teamMemberId}`);
}

/** Yeni bir izin/tatil kaydı oluşturur (kişiye özel ya da şirket geneli). */
export async function createLeavePeriod(period) {
  return requestJson("/api/leave-periods", { method: "POST", body: JSON.stringify(period) });
}

export async function deleteLeavePeriod(id) {
  return requestJson(`/api/leave-periods/${id}`, { method: "DELETE" });
}

/**
 * Bir takımın DB'de kayıtlı (WorkItem/TeamMember) verilerinden GERÇEK kapasite
 * dashboard'unu hesaplatır (bkz. backend CapacityDashboardController - Excel/
 * Manuel'den farklı olarak burada veri triggerJiraSync ile Jira'dan senkronize
 * edilip work_items tablosuna yazılmış olan verilerdir).
 */
export async function fetchCapacityDashboard(teamId, { reportDate, periodStart, periodEnd, previousSnapshotDate } = {}) {
  const params = new URLSearchParams();
  if (reportDate) params.set("reportDate", reportDate);
  if (periodStart) params.set("periodStart", periodStart);
  if (periodEnd) params.set("periodEnd", periodEnd);
  if (previousSnapshotDate) params.set("previousSnapshotDate", previousSnapshotDate);
  const qs = params.toString();
  return requestJson(`/api/teams/${teamId}/capacity-dashboard${qs ? "?" + qs : ""}`);
}

/**
 * Bir takımın DB'de kayıtlı TÜM iş kalemlerini (Jira'dan senkronize edilmiş
 * veya elle girilmiş) HAM (kişi bazlı toplanmamış, her biri kendi başlık/
 * status/flagged/sektör/öncelik alanlarıyla) döner - İçerik Slaytı'nın
 * "Jira'dan Getir" akışı (bkz. useJiraContentSuggestions.js) bunu kullanır.
 * fetchCapacityDashboard'dan farkı budur: o sadece kişi bazlı TOPLAM sayıları
 * döner, tek tek iş kalemi başlıklarını taşımaz.
 */
export async function fetchWorkItems(teamId) {
  return requestJson(`/api/teams/${teamId}/work-items`);
}

/**
 * Jira senkronizasyonunu tetikler (backend arka planda işler,
 * bkz. JiraSyncProcessor). jira.enabled=false ise
 * (API anahtarı tanımlı değilse) istek yine kabul edilir ama hiçbir veri
 * gelmez (NoOpJiraGatewayAdapter boş liste döner) - bu durumda kullanıcıya
 * "Jira bağlantısı henüz yapılandırılmadı" gibi bir yanıt DÖNMEZ, backend
 * sessizce boş sonuçla biter (bkz. docs/jira-endpoint-plani.md).
 */
export async function triggerJiraSync(teamId, { jiraProjectKey, jql } = {}) {
  return requestJson(`/api/teams/${teamId}/jira-sync`, {
    method: "POST",
    body: JSON.stringify({ jiraProjectKey, jql }),
  });
}

/**
 * İçerik Slaytı'ndaki "madde ekle" satırının "Sektör (ops.)" dropdown'u için -
 * her takımın Jira'da GERÇEKTEN kullandığı sektör listesi (her "Jira'dan Çek"
 * ile JiraSyncProcessor tarafından yeniden hesaplanır, bkz. kullanıcı
 * bildirimi 2026-08-18: takımlar arasında sektör kümesi farklı). Henüz hiç
 * senkronize edilmemiş bir takım için boş liste döner.
 */
export async function fetchSectorOptions(teamId) {
  return requestJson(`/api/teams/${teamId}/sector-options`);
}
