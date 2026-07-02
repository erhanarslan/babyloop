# BabyLoop Mobile Deferred Issues

## P0.5 / Release Risk: Android conversation composer keyboard behavior

Durum:
- Android cihazda conversation detail ekranında input'a basıldığında klavye açılıyor.
- Composer/mesaj yazma alanı bazı denemelerde klavyenin üstüne doğru çıkmıyor veya mesaj balonları görünür alanı doğru kullanmıyor.
- Conversation detail route tab group içinde kalmalı; klavye kapalıyken alt tab menü görünmeli.
- Klavye açıkken tab bar gizlenebilir; kritik beklenti composer'ın klavyenin üstünde kalmasıdır.

Şimdilik karar:
- Bu konu release backlog'a alındı.
- Geçici olarak mevcut en stabil conversation detail davranışı korunacak.
- Sonraki çözüm için `react-native-keyboard-controller` veya `react-native-keyboard-aware-scroll-view` değerlendirilecek.
- Sadece padding/absolute dock ile geçiştirilmeyecek; gerçek Android cihazda manuel doğrulanacak.

Manuel kontrol hedefi:
- Mesajlar > konuşma detayı açılır.
- Klavye kapalıyken tab bar görünür.
- Input'a basınca composer klavyenin üstünde kalır.
- Son mesaj composer/keyboard arkasında kaybolmaz.
- Mesaj gönderildiğinde yeni mesaj görünür şekilde en alta eklenir.
