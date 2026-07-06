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
