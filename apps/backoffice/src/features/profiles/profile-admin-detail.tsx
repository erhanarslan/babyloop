"use client";

import type { ApiResponse } from "@babyloop/shared";
import type { FormEvent } from "react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  type AdminProfileDetail,
  type AdminProfileEnforcementAction,
  type ViewerProfile,
  applyAdminProfileEnforcement,
  getAdminProfile,
} from "./api";
import { useBackofficeAccess } from "../auth/backoffice-access";
import { formatDateTimeTr, formatEnumLabel } from "../../lib/presentation";

export function ProfileAdminDetail({ profileId }: { profileId: string }) {
  const access = useBackofficeAccess();
  const [profile, setProfile] = useState<AdminProfileDetail | ViewerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadProfile() {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await getAdminProfile(profileId);

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setProfile(null);
        setErrorMessage(getApiErrorMessage(response, "Profil yüklenemedi."));
        setIsLoading(false);
        return;
      }

      setProfile(response.data.profile);
      setIsLoading(false);
    }

    void loadProfile();

    return () => {
      isActive = false;
    };
  }, [profileId]);

  return (
    <section className="content-card">
      <div className="page-toolbar">
        <div>
          <p className="eyebrow">Güven ve Emniyet</p>
          <h2>Profil ayrıntısı</h2>
          <p>
            Gizliliği koruyan profil operasyon görünümü. E-posta, telefon, ham kullanıcı
            kayıtları, ham şikâyet ayrıntıları ve ileti gövdeleri burada gösterilmez.
          </p>
        </div>
        <Link className="secondary-action" href="/profiles">
          Profillere dön
        </Link>
      </div>

      {isLoading ? <div className="state-panel">Profil yükleniyor…</div> : null}

      {errorMessage ? (
        <div className="state-panel danger" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {profile ? (
        <ProfileDetailContent
          canMutate={access.can("mutate")}
          onProfileUpdated={setProfile}
          profile={profile}
        />
      ) : null}
    </section>
  );
}

function ProfileDetailContent({
  canMutate,
  onProfileUpdated,
  profile,
}: {
  canMutate: boolean;
  onProfileUpdated: (profile: AdminProfileDetail | ViewerProfile) => void;
  profile: AdminProfileDetail | ViewerProfile;
}) {
  if (!("trustSnapshot" in profile)) {
    return <ViewerProfileDetailContent profile={profile} />;
  }

  const snapshot = profile.trustSnapshot;
  const riskLevel = snapshot?.riskLevel ?? "low";

  return (
    <div className="profile-detail-layout">
      <section className="profile-detail-card">
        <div className="profile-admin-card-header">
          <div>
            <strong>{profile.displayName}</strong>
            <p>{profile.locationCity ?? "Konum belirtilmedi"}</p>
          </div>
          <span className={`risk-pill ${riskLevel}`}>{formatEnumLabel(riskLevel)}</span>
        </div>

        <dl className="compact-details">
          <div>
            <dt>Profil kimliği</dt>
            <dd>{profile.profileId}</dd>
          </div>
          <div>
            <dt>Güvenlik durumu</dt>
            <dd>{formatEnumLabel(profile.safetyStatus)}</dd>
          </div>
          <div>
            <dt>Oluşturulma</dt>
            <dd>{formatDateTime(profile.createdAt)}</dd>
          </div>
          <div>
            <dt>Güncellenme</dt>
            <dd>{formatDateTime(profile.updatedAt)}</dd>
          </div>
        </dl>
      </section>

      {canMutate ? (
        <ProfileEnforcementControls
          onProfileUpdated={onProfileUpdated}
          profile={profile}
        />
      ) : null}

      <section className="profile-detail-card">
        <h3>Güven görünümü</h3>
        {snapshot ? (
          <>
            <dl className="compact-details">
              <div>
                <dt>Güven puanı</dt>
                <dd>{snapshot.trustScore}</dd>
              </div>
              <div>
                <dt>Risk puanı</dt>
                <dd>{snapshot.riskScore}</dd>
              </div>
              <div>
                <dt>Risk düzeyi</dt>
                <dd>{formatEnumLabel(snapshot.riskLevel)}</dd>
              </div>
              <div>
                <dt>Açık vakalar</dt>
                <dd>{snapshot.openCaseCount}</dd>
              </div>
              <div>
                <dt>Yakın tarihli şikâyetler</dt>
                <dd>{snapshot.recentReportCount}</dd>
              </div>
              <div>
                <dt>Yakın tarihli yaptırımlar</dt>
                <dd>{snapshot.recentEnforcementCount}</dd>
              </div>
              <div>
                <dt>Hassas erişim</dt>
                <dd>{snapshot.sensitiveAccessCount}</dd>
              </div>
              <div>
                <dt>AI özetleri</dt>
                <dd>{snapshot.aiSummaryCount}</dd>
              </div>
            </dl>
            <p className="muted">Hesaplanma: {formatDateTime(snapshot.computedAt)}</p>
          </>
        ) : (
          <p className="muted">Bu profil için henüz güven görünümü hesaplanmadı.</p>
        )}
      </section>

      <section className="profile-detail-card">
        <h3>Operasyon istatistikleri</h3>
        <dl className="compact-details">
          <div>
            <dt>Toplam ilan</dt>
            <dd>{profile.stats.totalListings}</dd>
          </div>
          <div>
            <dt>Aktif ilan</dt>
            <dd>{profile.stats.activeListings}</dd>
          </div>
          <div>
            <dt>Arşivlenen ilan</dt>
            <dd>{profile.stats.archivedListings}</dd>
          </div>
          <div>
            <dt>Satılan ilan</dt>
            <dd>{profile.stats.soldListings}</dd>
          </div>
          <div>
            <dt>İlişkili vakalar</dt>
            <dd>{profile.stats.totalCases}</dd>
          </div>
          <div>
            <dt>Açık vakalar</dt>
            <dd>{profile.stats.openCases}</dd>
          </div>
          <div>
            <dt>Yaptırım işlemleri</dt>
            <dd>{profile.stats.enforcementActions}</dd>
          </div>
        </dl>
      </section>

      <section className="profile-detail-card wide">
        <h3>Son ilanlar</h3>
        {profile.listings.length > 0 ? (
          <div className="table-list">
            {profile.listings.map((listing) => (
              <article className="table-list-row" key={listing.listingId}>
                <div>
                  <Link href={`/listings/${listing.listingId}`}>{listing.title}</Link>
                  <p className="muted">
                    {listing.category.name} · {formatEnumLabel(listing.status)} · {formatEnumLabel(listing.condition)}
                  </p>
                </div>
                <span>{listing.price ? `${listing.price.amount} ${listing.price.currency}` : "Fiyat belirtilmedi"}</span>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">Bu profile ait ilan bulunamadı.</p>
        )}
      </section>

      <section className="profile-detail-card wide">
        <h3>İlişkili moderasyon vakaları</h3>
        {profile.relatedModerationCases.length > 0 ? (
          <div className="table-list">
            {profile.relatedModerationCases.map((item) => (
              <article className="table-list-row" key={item.caseId}>
                <div>
                  <Link href={`/moderation/${item.caseId}`}>Vaka {item.caseId.slice(0, 8)}</Link>
                  <p className="muted">
                    {formatEnumLabel(item.targetType)} · {formatEnumLabel(item.status)} · {formatEnumLabel(item.priority)}
                  </p>
                </div>
                <span>{item.reason ? formatEnumLabel(item.reason) : "Şikâyet nedeni belirtilmedi"}</span>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">İlişkili moderasyon vakası bulunamadı.</p>
        )}
      </section>

      <section className="profile-detail-card wide">
        <h3>Yaptırım geçmişi</h3>
        {profile.enforcementHistory.length > 0 ? (
          <div className="table-list">
            {profile.enforcementHistory.map((item) => (
              <article className="table-list-row" key={item.actionId}>
                <div>
                  <strong>{formatEnumLabel(item.actionType)}</strong>
                  <p className="muted">{formatDateTime(item.createdAt)}</p>
                </div>
                {item.caseId ? <Link href={`/moderation/${item.caseId}`}>Vakayı aç</Link> : <span>İlişkili vaka yok</span>}
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">İlişkili vakalarda yaptırım işlemi bulunamadı.</p>
        )}
      </section>
    </div>
  );
}

function ViewerProfileDetailContent({ profile }: { profile: ViewerProfile }) {
  return (
    <div className="profile-detail-layout">
      <section className="profile-detail-card">
        <div className="profile-admin-card-header">
          <div>
            <strong>{profile.displayName}</strong>
            <p>{profile.locationCity ?? "Konum belirtilmedi"}</p>
          </div>
        </div>
        <dl className="compact-details">
          <div>
            <dt>Profil kimliği</dt>
            <dd>{profile.profileId}</dd>
          </div>
          <div>
            <dt>İlanlar</dt>
            <dd>{profile.listingCount}</dd>
          </div>
          <div>
            <dt>Oluşturulma</dt>
            <dd>{formatDateTime(profile.createdAt)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

type ProfileEnforcementOption = {
  action: AdminProfileEnforcementAction;
  label: string;
  description: string;
};

const profileEnforcementOptions: ProfileEnforcementOption[] = [
  {
    action: "profile_warn",
    label: "Profili uyar",
    description: "Profil güvenlik durumunu değiştirmeden bir uyarı kaydet."
  },
  {
    action: "profile_restrict",
    label: "Profili kısıtla",
    description: "Profil kayıtları yöneticilere görünürken ilan oluşturmayı ve mesajlaşmayı engelle."
  },
  {
    action: "profile_suspend",
    label: "Profili askıya al",
    description: "Pazar yeri hareketlerini engelle ve satıcının herkese açık ilanlarını gizle."
  },
  {
    action: "profile_restore",
    label: "Profili geri yükle",
    description: "Profili aktif pazar yeri durumuna döndür."
  }
];

function ProfileEnforcementControls({
  onProfileUpdated,
  profile,
}: {
  onProfileUpdated: (profile: AdminProfileDetail) => void;
  profile: AdminProfileDetail;
}) {
  const [selectedAction, setSelectedAction] = useState<AdminProfileEnforcementAction>(
    "profile_warn"
  );
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedReason = reason.trim();

    if (trimmedReason.length < 10) {
      setErrorMessage("En az 10 karakterlik bir yaptırım nedeni gir.");
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    setErrorMessage(null);

    const response = await applyAdminProfileEnforcement(profile.profileId, {
      action: selectedAction,
      reason: trimmedReason,
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setErrorMessage(getApiErrorMessage(response, "Profil yaptırımı uygulanamadı."));
      return;
    }

    onProfileUpdated(response.data.profile);
    setReason("");
    setFeedback(
      `Profil yaptırımı uygulandı. Denetim olayı: ${response.data.enforcement.auditEventId}`
    );
  }

  return (
    <form className="profile-detail-card enforcement-card" onSubmit={handleSubmit}>
      <div>
        <h3>Profil yaptırımı</h3>
        <p className="muted">
          Profil düzeyindeki güven ve emniyet işlemlerini bu ayrıntı sayfasından uygula.
          Neden zorunludur. İşlem denetlenir ve ham şikâyetleri, şikâyetçi kimliğini,
          ileti gövdelerini, e-posta veya telefon verisini açığa çıkarmaz.
        </p>
      </div>

      <fieldset className="checkbox-group">
        <legend>İşlem</legend>
        {profileEnforcementOptions.map((option) => (
          <label className="checkbox-option" key={option.action}>
            <input
              checked={selectedAction === option.action}
              disabled={isSubmitting}
              name="profile-enforcement-action"
              onChange={() => setSelectedAction(option.action)}
              type="radio"
              value={option.action}
            />
            <span>
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="form-field">
        <span>Yaptırım nedeni</span>
        <textarea
          disabled={isSubmitting}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Bu profil işleminin neden gerekli olduğunu, gereksiz kişisel veri kullanmadan açıkla."
          rows={4}
          value={reason}
        />
      </label>

      <div className="state-panel warning">
        Mevcut profil güvenlik durumu: {formatEnumLabel(profile.safetyStatus)}.
        Aynı durum geçişinin tekrarı API tarafından reddedilir.
      </div>

      {feedback ? <p className="form-success">{feedback}</p> : null}
      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <button
        className="primary-action"
        disabled={isSubmitting || reason.trim().length < 10}
        type="submit"
      >
        {isSubmitting ? "Uygulanıyor…" : "Profil yaptırımını uygula"}
      </button>
    </form>
  );
}

function formatDateTime(value: string): string {
  return formatDateTimeTr(value);
}

function getApiErrorMessage(
  response: ApiResponse<unknown>,
  fallback: string,
): string {
  return response.ok || response.error.code !== "FORBIDDEN"
    ? fallback
    : "Bu profil işlemi için yetkin yok.";
}
