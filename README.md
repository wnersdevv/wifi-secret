<div align="center">

<img src="assets/banner.svg" alt="WiFi Secret" width="100%" />

<br/>

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=24&duration=2600&pause=700&color=38BDF8&center=true&vCenter=true&multiline=false&width=760&lines=Windows+10%2F11+Wi-Fi+y%C3%B6netim+sistemi;netsh+%C2%B7+WinRT+Hotspot+%C2%B7+DPAPI+g%C3%BCvenli+secret;Discord+bot+%C2%B7+slash+%2B+prefix+%2B+izin+sistemi;MongoDB+%2B+CroxyDB+%C2%B7+ %23powerbywnersdev" alt="typing" />

<br/><br/>

![Node](https://img.shields.io/badge/Node.js-18%2B-3FB950?style=for-the-badge&logo=node.js&logoColor=white)
![Platform](https://img.shields.io/badge/Windows-10%20%7C%2011-0078D6?style=for-the-badge&logo=windows&logoColor=white)
![Discord](https://img.shields.io/badge/discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-A78BFA?style=for-the-badge)

![Env free](https://img.shields.io/badge/.env-YOK-EF4444?style=flat-square)
![Secrets](https://img.shields.io/badge/Secrets-DPAPI%20%C5%9Fifreli-22C55E?style=flat-square)
![Dashboard](https://img.shields.io/badge/Dashboard-127.0.0.1%20loopback-06B6D4?style=flat-square)
![Backup](https://img.shields.io/badge/Backup-AES--256--GCM-F59E0B?style=flat-square)
![Brand](https://img.shields.io/badge/%23powerbywnersdev-F472B6?style=flat-square)

</div>

<img src="assets/divider.svg" width="100%" height="8" alt="" />

## 🎬 Demo

<div align="center">
<img src="assets/demo.gif" alt="WiFi Secret CLI demo" width="80%" />
<br/>
<sub><i>Yukarıdaki demo komut satırı çıktısını canlandırır. Gerçek değerler kendi makinenizdeki ağa göre gelir.</i></sub>
</div>

<img src="assets/divider.svg" width="100%" height="8" alt="" />

## ✨ Özellikler

| | Modül | Ne yapar |
|:--:|:--|:--|
| 📡 | **Wi-Fi Analiz** | Mevcut bağlantı, SSID/BSSID, sinyal (%/dBm), kanal, bant (2.4/5/6 GHz), güvenlik, adapter, IP/Gateway/DNS/MAC, internet testi |
| 🔎 | **Ağ Tarama** | Çevredeki ağlar, kanal yoğunluğu haritası, en boş kanal önerisi |
| 🛡️ | **Güvenlik Taraması** | Kendi ağınız için A–F puanı: WPA/WPA2/WPA3/WEP/Open, zayıf sinyal, kanal sıkışıklığı, DNS/Gateway |
| 📶 | **Hotspot Engine** | Windows WinRT tethering — başlat / durdur / yeniden başlat / durum / bağlı cihazlar (IP + MAC) |
| 💾 | **Profil Yedekleme** | Kendi Wi-Fi profillerini listele / incele / **AES-256-GCM şifreli** yedekle / doğrula / geri yükle / sil |
| 🔑 | **Parola Üretici** | Kriptografik güçlü parola, uzunluk + karakter seçimi, güç ölçer |
| 🔳 | **Wi-Fi QR** | `WIFI:` formatında QR — SSID/parola/güvenlik ile bağlanılabilir kod |
| 🌍 | **IP → Bölge** | Yaklaşık (yalnızca bölgesel) IP geolocation: ülke/şehir/ISP/ASN/timezone |
| 🤖 | **Discord Bot** | Slash + prefix, owner/admin/user izinleri, cooldown, audit log, embed/buton, kritik komut onayı |
| 🧪 | **Lab (Fake WiFi)** | Yalnızca kendi makinenizde **izole test hotspot'u** — taklit/parola toplama/MITM YOK |

<img src="assets/divider.svg" width="100%" height="8" alt="" />

## 🧭 Mimari

<div align="center">
<img src="assets/architecture.svg" alt="Mimari" width="100%" />
</div>

> **Discord Bot → Auth + İzin → WiFi Secret Core → Windows Network APIs.**
> Bot doğrudan işletim sistemi komutu çalıştırmaz; yalnızca Core'daki tanımlı işlemleri çağırır.
> Secret'lar **DPAPI** ile şifreli (`.env` yok), dashboard yalnızca **loopback** dinler.

<img src="assets/divider.svg" width="100%" height="8" alt="" />

## 🚀 Kurulum

```bash
# 1) Bağımlılıklar
npm install

# 2) Secret'ları DPAPI ile güvenli kaydet (.env YOK)
npm run set-credential discord_token
npm run set-credential discord_client_id
npm run set-credential mongo_uri

# 3) Discord slash komutlarını kaydet
npm run register

# 4) Çalıştır
npm start        # dashboard (http://127.0.0.1:4790) + Discord bot
npm run ui       # sadece dashboard
npm run bot      # sadece bot
```

> `config/discord.json` içindeki `owners` / `admins` dizilerine kendi Discord ID'nizi ekleyin.

<img src="assets/divider.svg" width="100%" height="8" alt="" />

## 💻 Komut Satırı

```bash
node wnersdev.js cli status          # mevcut bağlantı
node wnersdev.js cli scan            # kanal yoğunluğu + öneri
node wnersdev.js cli security        # güvenlik puanı
node wnersdev.js cli hotspot start   # hotspot başlat
node wnersdev.js cli hotspot devices # bağlı cihazlar
node wnersdev.js cli ip 8.8.8.8      # IP → bölge
node wnersdev.js cli password 20     # parola üret
```

<img src="assets/divider.svg" width="100%" height="8" alt="" />

## 🤖 Discord Komutları

<table>
<tr><th>Slash</th><th>Prefix</th><th>Yetki</th></tr>
<tr><td><code>/wifi status</code></td><td><code>!wifi status</code></td><td>user</td></tr>
<tr><td><code>/wifi networks</code></td><td><code>!wifi networks</code></td><td>user</td></tr>
<tr><td><code>/wifi scan</code></td><td><code>!wifi scan</code></td><td>user</td></tr>
<tr><td><code>/wifi security</code></td><td><code>!wifi security</code></td><td>user</td></tr>
<tr><td><code>/wifi qr</code> · <code>/wifi password</code> · <code>/wifi ip</code></td><td>—</td><td>user</td></tr>
<tr><td><code>/wifi hotspot info</code></td><td><code>!wifi hotspot info</code></td><td>user</td></tr>
<tr><td><code>/wifi hotspot start·stop·restart</code></td><td><code>!wifi hotspot start·stop</code></td><td>admin 🔒</td></tr>
<tr><td><code>/wifi devices</code> · <code>/wifi logs</code> · <code>/wifi backup</code></td><td>—</td><td>admin</td></tr>
<tr><td><code>/wifi restore</code></td><td>—</td><td>owner 🔒</td></tr>
</table>

🔒 = onay butonu ister. Her komutta cooldown + audit log çalışır.

<img src="assets/divider.svg" width="100%" height="8" alt="" />

## 🔐 Güvenlik

- 🚫 **`.env` yok** — Discord token / Mongo URI Windows **DPAPI** (CurrentUser) ile şifreli, kaynak kodda hard-code yok.
- 🔒 **Dashboard** yalnızca `127.0.0.1` dinler, ağa açılmaz.
- 🧊 **Yedekler** AES-256-GCM + scrypt, sizin belirlediğiniz parolayla (`data/backups/*.wsb`).
- 🙈 Loglarda parola/anahtar **maskelenir**.
- 🧪 **Lab / Fake WiFi** yalnızca izole test hotspot'u; SSID taklidi, captive portal, credential harvesting, MITM **yoktur**.

<img src="assets/divider.svg" width="100%" height="8" alt="" />

<details>
<summary>📁 <b>Dosya Yapısı</b></summary>

```
wnersdev.js              giriş noktası (dashboard + bot + cli)
src/core/                wifi · hotspot · scanner · security
src/services/            password · qr · geo · backup · audit
src/database/            mongo (10 model) + croxy (runtime)
src/discord/             bot · commands · permissions · cooldown · embeds
src/server/              loopback dashboard API
public/                  dark dashboard (index.html + app.js)
config/                  config.json · database.json · discord.json
scripts/                 set-credential · register-commands
```
</details>

<div align="center">
<br/>
<img src="assets/divider.svg" width="100%" height="8" alt="" />
<sub>Made with 💙 by <b>wnersdev</b> · <code>#powerbywnersdev</code></sub>
</div>
