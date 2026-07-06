---
id: messaging-and-privacy
title: Mesajlaşma ve gizlilik rehberi
locale: tr
topic: messaging-privacy
safetyScope: marketplace-guidance
sourceReliability: internal
version: 2026-06-18
---

# Mesajlaşma ve gizlilik rehberi

BabyLoop mesajlaşması alıcı ve satıcının ürün hakkında güvenli şekilde konuşması için kullanılır. İlk mesajda ürünün hâlâ uygun olup olmadığı, teslim şekli, ürün durumu ve gerekirse ek fotoğraf sorulabilir.

## Paylaşılmaması gereken bilgiler

Telefon, e-posta, açık adres, kimlik bilgisi, ödeme kartı veya çocukla ilgili özel bilgiler paylaşılmamalıdır. İlan ve mesajlarda çocuk yüzü veya özel aile bilgileri görünür olmamalıdır.

## Sorunlu konuşmalar

Şüpheli ödeme isteği, baskı kuran mesaj, ürünle ilgisiz özel bilgi talebi veya rahatsız edici içerik varsa kullanıcı konuşmayı sonlandırabilir ve BabyLoop içindeki bildirme akışını kullanabilir.

## Messaging safety full-flow boundary

Messaging privacy is protected by pnpm security:messaging-safety-full-flow.

Unsafe message bodies are rejected before persistence, notification creation, and realtime publish. RAG and admin summaries must use redacted previews, not raw private messaging content. Messaging and realtime payloads do not expose email, phone, accessToken, refreshToken, cookie, authorization, passwordHash, or raw auth/session data.

This does not add a new realtime provider.

Messaging safety full-flow boundary does not expose email, does not expose phone, does not expose accessToken, does not expose refreshToken, does not expose cookie, and does not expose authorization in public, realtime, or admin default DTOs.

## Public safety abuse-flow audit

Run pnpm security:public-safety-abuse-flow before claiming report/block/moderation release readiness.

This audit covers report/block/moderation, fail-closed messaging safety, hidden menu public safety actions, admin redaction, sensitive access, and audit readiness across API, web, mobile, and backoffice surfaces.

Public safety and default admin review DTOs do not expose email, do not expose phone, do not expose accessToken, do not expose refreshToken, do not expose passwordHash, do not expose cookie, do not expose authorization, and do not expose raw message body.

Mobile safety surface pending remains an explicit tracked gap until mobile report/block UI is implemented.

Public safety abuse-flow audit does not expose email, does not expose phone, does not expose accessToken, does not expose refreshToken, does not expose passwordHash, does not expose cookie, does not expose authorization, and does not expose raw message body in public safety or default admin review DTOs.

## Auth/session/CSRF/realtime/read-state audit

Run pnpm security:auth-session-realtime-readstate before claiming auth/session/realtime/read-state release readiness.

This audit covers httpOnly cookies, CSRF, public access cookie migration, refresh/logout/session revoke behavior, backoffice admin auth, realtime room access, read-state, unread-count reconciliation, and the release dependency map across API, web, backoffice, and mobile.

Auth/session/realtime/read-state surfaces do not expose accessToken, do not expose refreshToken, do not expose passwordHash, do not expose cookie, and do not expose authorization.

Mobile messaging/realtime parity pending remains an explicit P0 gap until the mobile realtime implementation is completed.
