# Telegram Channel Posting Bot

ဒီ Bot က Telegram Channel မှ မြတ် အက်ကောင့်မှ ပုံ, ဗီဒီယို, အယ်လ်ဘွမ်တွေ အလွယ်တကူ တင်နိုင်ပါတယ်။

## ✨ လုပ်ဆောင်ချက်များ

- 📝 **Single Post** - ပုံ/ဗီဒီယို တစ်ခုတည်း တင်ပါ
- 🖼 **Album Post** - ပုံ အများအပြားကို အယ်လ်ဘွမ်အဖြစ် တင်ပါ
- 📢 **Multi-Channel** - အများအပြား Channel တွေဆီ တစ်ခါတည်း တင်နိုင်
- 🔗 **URL Button** - Post မှ URL Button ထည့်ထားနိုင်
- 💾 **State Management** - KV Storage သုံးပြီး User State သိမ်းခြင်း

## 🛠 Setup

### 1. Dependencies Install
```bash
npm install
```

### 2. Environment Setup
`.env` ဖိုင် ဆောက်လုပ်ပါ:
```env
BOT_TOKEN=your_telegram_bot_token_here
BOT_KV=kv_namespace_binding
```

### 3. Cloudflare KV Namespace ဆောက်တည်

```bash
wrangler kv:namespace create "BOT_KV"
wrangler kv:namespace create "BOT_KV" --preview
```

`wrangler.toml` မှာ KV ID အစားထိုးပါ။

### 4. Local Development
```bash
wrangler dev
```

အချက်အလက်:
- Local server: `http://localhost:8787`
- Test endpoint: `http://localhost:8787/test`

### 5. Deploy to Cloudflare

Webhook URL သတ်မှတ်ပါ (ပထမ တစ်ခါတည်း):
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<YOUR_WORKER_URL>/webhook"
```

Deploy လုပ်ပါ:
```bash
npm run deploy
```

## 🔧 Configuration

`wrangler.toml` ရဲ့ အရေးကြီးတဲ့ အပိုင်းများ:

```toml
name = "telegram-channel-bot"
main = "src/index.js"
compatibility_date = "2024-11-15"
compatibility_flags = ["nodejs_compat"]

[[kv_namespaces]]
binding = "BOT_KV"
id = "your_kv_namespace_id"
```

## 📌 ကုဒ်မှ သူ့သ

### Main Entry Point: `src/index.js`

**Handler ပြီး:**
- `/webhook` - Telegram webhook နေရာ
- `/test` - Bot အခြေအတည် ကြည့်ရှုမှု
- `/setupWebhook` - Webhook စေတင်ခြင်း

**State Management:**
- User အလိုက် State ကို KV မှ သိမ်းဆည်းပါတယ်
- အလယ်အလတ် အခြေအတည်ကြည့်သည့် အချိန် - 1 ပြိုင်နက် (3600s)

## ⚠️ အရေးကြီးတဲ့ အမှတ်သညာများ

1. **Owner ID အစားထိုးပါ** - `src/index.js` မှ Line 3
   ```javascript
   const OWNER_ID = YOUR_TELEGRAM_USER_ID; // အပြန်အလှန်နက်ဖွင့်သည့် User ID
   ```

2. **Default Channels** - အစပြင်ဆင်တဲ့ Channel များ:
   ```javascript
   var initial = (env.CHANNELS || "@FoeLongTeeCh,@MamaHaythr").split(",")
   ```

3. **KV Namespace Binding** - `wrangler.toml` မှ KV ID သုံးတူ ရှိကြောင်း အသိပေးပါ

## 🧪 Testing

Local စမ်းသပ်မှု:
```bash
# စမ်းသပ်ခြင်း endpoint
curl http://localhost:8787/test

# ဝက်ဟုတ်ခ် စမ်းသပ်မှု
curl -X POST http://localhost:8787/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 1,
    "message": {
      "message_id": 1,
      "chat": { "id": YOUR_ID, "type": "private" },
      "from": { "id": YOUR_ID },
      "text": "/start"
    }
  }'
```

## 📄 License

MIT
