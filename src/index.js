const MAIN_KEYBOARD = { keyboard: [ [{ text: "📝 New Post" }, { text: "📋 Channels" }], [{ text: "➕ Add Channel" }, { text: "➖ Remove Channel" }], [{ text: "📊 Status" }, { text: "ℹ️ Help" }] ], resize_keyboard: true, one_time_keyboard: false, placeholder: "Choose an action..." };

const OWNER_ID = 7653267274;

// ─── State ───
async function getState(kv, userId) { var data = await kv.get("state_" + userId); return data ? JSON.parse(data) : { mode: null, postType: null, media: [], caption: "", waitingFor: null, addInline: true, urlButton: null }; }
async function setState(kv, userId, state) { await kv.put("state_" + userId, JSON.stringify(state), { expirationTtl: 3600 }); }
async function clearState(kv, userId) { await kv.delete("state_" + userId); }
async function getChannels(kv, env) { var data = await kv.get("bot_channels"); if (data) return JSON.parse(data); var initial = (env.CHANNELS || "@FoeLongTeeCh,@MamaHaythr").split(",").map(function(c) { return c.trim(); }); await kv.put("bot_channels", JSON.stringify(initial)); return initial; }
async function saveChannels(kv, channels) { await kv.put("bot_channels", JSON.stringify(channels)); }

// ─── Telegram API ───
async function tgApi(token, method, body) { var res = await fetch("https://api.telegram.org/bot" + token + "/" + method, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return res.json(); }
async function tgApiFormData(token, method, formData) { var res = await fetch("https://api.telegram.org/bot" + token + "/" + method, { method: "POST", body: formData }); return res.json(); }
async function sendMessage(token, chatId, text, keyboard, linkPreview) { var body = { chat_id: chatId, text: text, parse_mode: "HTML" }; if (keyboard) body.reply_markup = keyboard; if (linkPreview === false) body.link_preview_options = { is_disabled: true }; return tgApi(token, "sendMessage", body); }

function extractFileInfo(msg) { if (msg.photo && msg.photo.length > 0) { var largest = msg.photo[msg.photo.length - 1]; return { type: "photo", fileId: largest.file_id, caption: msg.caption || "" }; } if (msg.video) return { type: "video", fileId: msg.video.file_id, caption: msg.caption || "" }; if (msg.document) return { type: "document", fileId: msg.document.file_id, caption: msg.caption || "" }; if (msg.animation) return { type: "animation", fileId: msg.animation.file_id, caption: msg.caption || "" }; return null; }

// ─── Keyboards ───
function postTypeKeyboard() { return { inline_keyboard: [ [{ text: "📸 Single Post", callback_data: "type_single" }], [{ text: "🖼 Album Post", callback_data: "type_album" }], [{ text: "❌ Cancel", callback_data: "cancel" }] ] }; }

function captionChoiceKeyboard(hasCaption) {
  if (hasCaption) {
    return { inline_keyboard: [ [{ text: "✅ Use This Caption", callback_data: "cap_use" }], [{ text: "✏️ Type New Caption", callback_data: "cap_new" }], [{ text: "⏭️ Skip Caption", callback_data: "cap_skip" }], [{ text: "❌ Cancel", callback_data: "cancel" }] ] };
  }
  return { inline_keyboard: [ [{ text: "✏️ Type Caption", callback_data: "cap_new" }], [{ text: "⏭️ Skip Caption", callback_data: "cap_skip" }], [{ text: "❌ Cancel", callback_data: "cancel" }] ] };
}

function urlChoiceKeyboard() { return { inline_keyboard: [ [{ text: "🔗 Add URL Button", callback_data: "url_add" }], [{ text: "⏭️ Skip URL Button", callback_data: "url_skip" }], [{ text: "❌ Cancel", callback_data: "cancel" }] ] }; }

function doneKeyboard() { return { inline_keyboard: [ [{ text: "✅ Done - Select Channel & Post", callback_data: "post_done" }], [{ text: "❌ Cancel", callback_data: "cancel" }] ] }; }

function albumMediaKeyboard() { return { inline_keyboard: [ [{ text: "✅ Done Sending Media", callback_data: "media_done" }], [{ text: "❌ Cancel", callback_data: "cancel" }] ] }; }

async function channelPickKeyboard(kv, env) { var channels = await getChannels(kv, env); var buttons = []; for (var i = 0; i < channels.length; i++) { buttons.push([{ text: "📢 " + channels[i], callback_data: "pick_ch:" + channels[i] }]); } buttons.push([{ text: "❌ Cancel", callback_data: "cancel" }]); return { inline_keyboard: buttons }; }

// ─── Post to Channel ───
function buildReplyMarkup(addInline, urlButton) {
  var rows = [];
  if (urlButton) rows.push([{ text: urlButton.text, url: urlButton.url }]);
  if (addInline) {
    rows.push([{ text: "👍 Like", callback_data: "post_like" }, { text: "❤️ Love", callback_data: "post_love" }, { text: "🔥 Fire", callback_data: "post_fire" }]);
    rows.push([{ text: "💬 Comment", callback_data: "post_comment" }, { text: "📤 Share", callback_data: "post_share" }]);
  }
  return rows.length > 0 ? { inline_keyboard: rows } : null;
}

async function postToChannel(token, channel, postType, media, caption, addInline, urlButton) {
  try {
    var result;
    if (postType === "single") {
      var fi = media[0];
      var inlineKb = buildReplyMarkup(addInline, urlButton);
      if (fi.type === "photo") {
        var fd = new FormData(); fd.append("chat_id", channel); fd.append("photo", fi.fileId);
        if (caption) { fd.append("caption", caption); fd.append("parse_mode", "HTML"); }
        if (inlineKb) fd.append("reply_markup", JSON.stringify(inlineKb));
        result = await tgApiFormData(token, "sendPhoto", fd);
      } else if (fi.type === "video") {
        var body = { chat_id: channel, video: fi.fileId, parse_mode: "HTML" };
        if (caption) body.caption = caption;
        if (inlineKb) body.reply_markup = inlineKb;
        result = await tgApi(token, "sendVideo", body);
      } else if (fi.type === "animation") {
        var bodyA = { chat_id: channel, animation: fi.fileId, parse_mode: "HTML" };
        if (caption) bodyA.caption = caption;
        if (inlineKb) bodyA.reply_markup = inlineKb;
        result = await tgApi(token, "sendAnimation", bodyA);
      } else {
        var body2 = { chat_id: channel, document: fi.fileId, parse_mode: "HTML" };
        if (caption) body2.caption = caption;
        if (inlineKb) body2.reply_markup = inlineKb;
        result = await tgApi(token, "sendDocument", body2);
      }
    } else if (postType === "album") {
      var mg = media.map(function(m, idx) { var item = { type: m.type, media: m.fileId }; if (idx === 0 && caption) { item.caption = caption; item.parse_mode = "HTML"; } return item; });
      var afd = new FormData(); afd.append("chat_id", channel); afd.append("media", JSON.stringify(mg));
      result = await tgApiFormData(token, "sendMediaGroup", afd);
      if (result.ok && urlButton) {
        await sendMessage(token, channel, "🔗", { inline_keyboard: [[{ text: urlButton.text, url: urlButton.url }]] });
      }
    }
    return { channel: channel, success: result.ok, error: result.ok ? null : (result.description || "Unknown error") };
  } catch (err) { return { channel: channel, success: false, error: String(err) }; }
}

// ─── Summary ───
function buildSummary(state) {
  var s = "📋 <b>Post Summary</b>\n\n";
  s += "📷 Type: " + (state.postType === "single" ? "Single" : "Album") + "\n";
  s += "🖼 Media: " + state.media.length + " ခု\n";
  s += "📝 Caption: " + (state.caption ? state.caption.substring(0, 100) + (state.caption.length > 100 ? "..." : "") : "မရှိ") + "\n";
  if (state.urlButton) {
    s += "🔗 URL Button: " + state.urlButton.text + " → " + state.urlButton.url + "\n";
  } else {
    s += "🔗 URL Button: မရှိ\n";
  }
  return s;
}

// ─── Channel Management ───
async function handleAddChannel(token, kv, env, chatId, text) {
  var channel = text.trim();
  if (!channel.startsWith("@") && !channel.startsWith("-100")) { await sendMessage(token, chatId, "❌ ပုံစံမမှန်ပါ.\n\nPublic: @channel_name\nPrivate: -1001234567890", null); return; }
  var chatResult = await tgApi(token, "getChat", { chat_id: channel });
  if (!chatResult.ok) { await sendMessage(token, chatId, "❌ Channel မရနိုင်ပါ.\nအမှား: " + (chatResult.description || "Unknown") + "\n\nBot ကို Channel မှာ Admin ထည့်ပြီး Post Messages ခွင့်ပေးထားပါ.", null); return; }
  var channels = await getChannels(kv, env);
  if (channels.indexOf(channel) !== -1) { await sendMessage(token, chatId, "⚠️ ထည့်ထားပြီးသားဖြစ်ပါတယ်.", MAIN_KEYBOARD); return; }
  channels.push(channel); await saveChannels(kv, channels);
  var chatInfo = chatResult.result;
  await sendMessage(token, chatId, "✅ Channel ထည့်ပြီးပါပြီ!\n\n📢 " + (chatInfo.title || channel) + "\n🆔 " + channel + "\n\nစုစုပေါင်း: " + channels.length + " ခု", MAIN_KEYBOARD);
}

async function showRemoveChannelKeyboard(token, kv, env, chatId) { var channels = await getChannels(kv, env); if (channels.length === 0) { await sendMessage(token, chatId, "📋 Channel မရှိပါ.", MAIN_KEYBOARD); return; } var buttons = channels.map(function(ch) { return [{ text: "❌ " + ch, callback_data: "remove_ch:" + ch }]; }); buttons.push([{ text: "⬅️ Back", callback_data: "cancel" }]); await sendMessage(token, chatId, "➖ ဖြုတ်ချင်တဲ့ Channel ကို ရွေးပါ.", { inline_keyboard: buttons }); }
async function showChannelsList(token, kv, env, chatId) { var channels = await getChannels(kv, env); if (channels.length === 0) { await sendMessage(token, chatId, "📋 Channel မရှိပါ.", MAIN_KEYBOARD); return; } var text = "📋 <b>Channel များ</b>\n\n"; for (var i = 0; i < channels.length; i++) { text += (i + 1) + ". " + channels[i] + "\n"; } text += "\nစုစုပေါင်း: " + channels.length + " ခု"; await sendMessage(token, chatId, text, MAIN_KEYBOARD); }

// ─── Main Handler ───
async function handleUpdate(update, env) {
  var token = env.BOT_TOKEN;
  var kv = env.BOT_KV;

  // ═══ Callback Queries ═══
  if (update.callback_query) {
    var cb = update.callback_query;
    var cbUserId = cb.from.id;
    var cbData = cb.data || cb.callback_data || "";
    var cbChatId = (cb.message && cb.message.chat) ? cb.message.chat.id : cb.from.id;
    try { await tgApi(token, "answerCallbackQuery", { callback_query_id: cb.id }); } catch (e) {}

    if (cbData === "post_like" || cbData === "post_love" || cbData === "post_fire" || cbData === "post_comment" || cbData === "post_share") {
      var r = cbData === "post_like" ? "👍" : cbData === "post_love" ? "❤️" : cbData === "post_fire" ? "🔥" : cbData === "post_comment" ? "💬" : "📤";
      try { await tgApi(token, "answerCallbackQuery", { callback_query_id: cb.id, text: r, show_alert: false }); } catch(e2) {}
      return;
    }

    if (cbUserId !== OWNER_ID) { try { await tgApi(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "❌ Owner သာ သုံးနိုင်ပါတယ်.", show_alert: true }); } catch(e3) {} return; }

    try {
      if (cbData === "cancel") { await clearState(kv, cbUserId); await sendMessage(token, cbChatId, "❌ ပယ်ဖျက်ပြီးပါပြီ.", MAIN_KEYBOARD); return; }
      if (cbData === "finish") { await clearState(kv, cbUserId); await sendMessage(token, cbChatId, "✅ ပြီးပါပြီ! 📝 New Post နှိပ်ပြီး ဆက်လုပ်ပါ.", MAIN_KEYBOARD); return; }

      if (cbData.startsWith("remove_ch:")) { var chToRemove = cbData.replace("remove_ch:", ""); var channels = await getChannels(kv, env); channels = channels.filter(function(c) { return c !== chToRemove; }); await saveChannels(kv, channels); await sendMessage(token, cbChatId, "✅ Channel ဖြုတ်ပြီးပါပြီ.\n" + chToRemove + "\n\nကျန်: " + channels.length + " ခု", MAIN_KEYBOARD); return; }

      // ── Step 1: Post Type Selection ──
      if (cbData.startsWith("type_")) {
        var ptype = cbData.replace("type_", "");
        var st = await getState(kv, cbUserId);
        st.mode = "creating"; st.postType = ptype; st.media = []; st.caption = ""; st.urlButton = null; st.waitingFor = "media";
        await setState(kv, cbUserId, st);
        if (ptype === "single") {
          await sendMessage(token, cbChatId, "📸 <b>Single Post</b>\n\nပုံ/ဗီဒီယို ပို့ပါ.\n(Caption ပါပို့လည့် ရပါတယ်)", null);
        } else {
          await sendMessage(token, cbChatId, "🖼 <b>Album Post</b>\n\nပုံတွေ ပို့ပါ. အားလုံးပို့ပြီးရင် Done နှိပ်ပါ.", albumMediaKeyboard());
        }
        return;
      }

      // ── Step 2: Album — Done Sending Media ──
      if (cbData === "media_done") {
        var mdst = await getState(kv, cbUserId);
        if (mdst.media.length === 0) { await sendMessage(token, cbChatId, "❌ ပုံ မပို့ရသေးပါ.", null); return; }
        if (mdst.media.length < 2) { await sendMessage(token, cbChatId, "⚠️ Album မှာ ပုံ ၂ ခု အနည်းဆုံး လိုပါသည်. နောက်ထပ် ပို့ပါ.", albumMediaKeyboard()); return; }
        var hasCap = !!(mdst.caption || mdst.media.find(function(m) { return m.caption; }));
        mdst.waitingFor = "caption_choice";
        await setState(kv, cbUserId, mdst);
        var capMsg = "📝 <b>Caption</b>\n\n";
        if (hasCap) {
          var capText = mdst.caption || (mdst.media.find(function(m) { return m.caption; }) || {}).caption || "";
          capMsg += "ပုံမှာ Caption ပါပါတယ်:\n\n\"" + capText.substring(0, 200) + "\"";
        } else {
          capMsg += "Caption ထည့်မလား?";
        }
        await sendMessage(token, cbChatId, capMsg, captionChoiceKeyboard(hasCap));
        return;
      }

      // ── Step 3: Caption Choice ──
      if (cbData === "cap_use") {
        var cust = await getState(kv, cbUserId);
        var capFromMedia = cust.media.find(function(m) { return m.caption; });
        cust.caption = cust.caption || (capFromMedia ? capFromMedia.caption : "");
        cust.waitingFor = "url_choice";
        await setState(kv, cbUserId, cust);
        await sendMessage(token, cbChatId, "🔗 <b>URL Button</b>\n\nPost မှာ URL Button ထည့်မလား?", urlChoiceKeyboard());
        return;
      }
      if (cbData === "cap_new") {
        var cnst = await getState(kv, cbUserId);
        cnst.waitingFor = "caption";
        await setState(kv, cbUserId, cnst);
        await sendMessage(token, cbChatId, "✏️ Caption ရိုက်ပြီး ပို့ပါ.", null);
        return;
      }
      if (cbData === "cap_skip") {
        var csst = await getState(kv, cbUserId);
        csst.caption = ""; csst.waitingFor = "url_choice";
        await setState(kv, cbUserId, csst);
        await sendMessage(token, cbChatId, "🔗 <b>URL Button</b>\n\nPost မှာ URL Button ထည့်မလား?", urlChoiceKeyboard());
        return;
      }

      // ── Step 4: URL Button Choice ──
      if (cbData === "url_add") {
        var uast = await getState(kv, cbUserId);
        uast.waitingFor = "url";
        await setState(kv, cbUserId, uast);
        await sendMessage(token, cbChatId, "🔗 URL ပို့ပါ.\nဥပမာ: https://example.com", null);
        return;
      }
      if (cbData === "url_skip") {
        var usst = await getState(kv, cbUserId);
        usst.urlButton = null; usst.waitingFor = "done";
        await setState(kv, cbUserId, usst);
        await sendMessage(token, cbChatId, buildSummary(usst) + "\n✅ Done နှိပ် → Channel ရွေးပြီး တင်.", doneKeyboard());
        return;
      }

      // ── Step 5: Done → Channel Selection ──
      if (cbData === "post_done") {
        var pdst = await getState(kv, cbUserId);
        if (!pdst.media || pdst.media.length === 0) { await sendMessage(token, cbChatId, "❌ Media မရှိပါ.", null); return; }
        pdst.mode = "pick_channel"; pdst.waitingFor = null;
        await setState(kv, cbUserId, pdst);
        var chKb = await channelPickKeyboard(kv, env);
        await sendMessage(token, cbChatId, "📢 <b>Channel ရွေးပါ</b>\n\nPost တင်မယ့် Channel ကို ရွေးပါ.", chKb);
        return;
      }

      // ── Step 6: Post to Selected Channel ──
      if (cbData.startsWith("pick_ch:")) {
        var picked = cbData.replace("pick_ch:", "");
        var pst = await getState(kv, cbUserId);
        if (!pst.media || pst.media.length === 0) { await sendMessage(token, cbChatId, "❌ Media မရှိပါ.", MAIN_KEYBOARD); return; }
        var addInline = pst.addInline !== false;
        var result = await postToChannel(token, picked, pst.postType, pst.media, pst.caption, addInline, pst.urlButton);
        var resText = result.success
          ? "✅ <b>Post တင်ပြီးပါပြီ!</b>\n\n📢 " + result.channel
          : "❌ <b>Post တင်မရပါ</b>\n\n📢 " + result.channel + "\n\nအမှား: " + result.error;
        var channels = await getChannels(kv, env);
        var nextButtons = [];
        for (var i = 0; i < channels.length; i++) { nextButtons.push([{ text: "📢 " + channels[i], callback_data: "pick_ch:" + channels[i] }]); }
        nextButtons.push([{ text: "🏁 Finish", callback_data: "finish" }]);
        await sendMessage(token, cbChatId, resText + "\n\n━━━━━━━━━━━━━\n<b>နောက် Channel ဆက်တင်မလား?</b>", { inline_keyboard: nextButtons });
        return;
      }
    } catch (cbErr) { console.error("Callback error:", cbErr); await sendMessage(token, cbChatId, "❌ အမှား: " + String(cbErr), MAIN_KEYBOARD); }
    return;
  }

  // ═══ Messages ═══
  if (!update.message) return;
  var msg = update.message; var chatId = msg.chat.id; var userId = msg.from.id; var text = msg.text || "";

  if (userId !== OWNER_ID) {
    if (text === "/start" || text.startsWith("/start")) {
      await sendMessage(token, chatId, "❌ ဒီ Bot က Owner သာ သုံးနိုင်ပါတယ်.\n\nYour ID: " + userId, null);
    }
    return;
  }

  if (text === "/start" || text.startsWith("/start ")) {
    await clearState(kv, userId);
    await sendMessage(token, chatId, "👋 မင်္ဂလာပါ Owner! <b>Telegram Channel Posting Bot</b>\n\n 📝 <b>New Post</b> နှိပ်ပြီး စတင်ပါ 👇", MAIN_KEYBOARD);
    return;
  }

  if (text === "📝 New Post") {
    var initSt = { mode: "pick_type", postType: null, media: [], caption: "", waitingFor: null, addInline: true, urlButton: null };
    await setState(kv, userId, initSt);
    await sendMessage(token, chatId, "📝 <b>New Post</b>\n\nPost type ရွေးပါ.", postTypeKeyboard());
    return;
  }
  if (text === "📋 Channels") { await showChannelsList(token, kv, env, chatId); return; }
  if (text === "➕ Add Channel") { await setState(kv, userId, { mode: "add_channel", postType: null, media: [], caption: "", waitingFor: "channel", addInline: true, urlButton: null }); await sendMessage(token, chatId, "➕ <b>Add Channel</b>\n\n📢 Public: @channel_name\n🔒 Private: -1001234567890\n\nBot ကို Channel မှာ Admin ထည့်ပြီး Post Messages ခွင့်ပေးထားပါ.", null); return; }
  if (text === "➖ Remove Channel") { await showRemoveChannelKeyboard(token, kv, env, chatId); return; }
  if (text === "📊 Status") { var me = await tgApi(token, "getMe", {}); var stChannels = await getChannels(kv, env); if (me.ok) { await sendMessage(token, chatId, "📊 <b>Bot Status</b>\n\n🤖 " + me.result.first_name + "\n🆔 @" + me.result.username + "\n📡 Channels: " + stChannels.length + "\n👑 Owner: " + OWNER_ID + "\n✅ Online", MAIN_KEYBOARD); } else { await sendMessage(token, chatId, "❌ Bot မသိရပါ.", MAIN_KEYBOARD); } return; }
  if (text === "ℹ️ Help") { await sendMessage(token, chatId, "🤖 <b>Telegram Channel Posting Bot</b>\n\n📝 <b>New Post</b>\n  → Post Type (Single/Album)\n  → Media ပို့\n  → Caption (ယူ/Skip/အသစ်)\n  → URL Button (ထည့်/Skip)\n  → Done → Channel ရွေး → Post\n\n➕ <b>Add Channel</b> — Channel အသစ်\n➖ <b>Remove Channel</b> — Channel ဖြုတ်\n📋 <b>Channels</b> — Channel စာရင်း\n📊 <b>Status</b> — Bot အခြေအနေ\n\n👑 Owner only: " + OWNER_ID, MAIN_KEYBOARD); return; }

  var state = await getState(kv, userId);

  if (state.mode === "add_channel" && state.waitingFor === "channel") { await handleAddChannel(token, kv, env, chatId, text); await clearState(kv, userId); return; }

  if (!state.mode) { await sendMessage(token, chatId, "👋 📝 New Post နှိပ်ပြီး စတင်ပါ.", MAIN_KEYBOARD); return; }

  // ── Step 2: Media Handling ──
  if (state.waitingFor === "media") {
    var fi = extractFileInfo(msg);
    if (fi) {
      if (state.postType === "single") {
        state.media = [fi];
        if (!state.caption) state.caption = fi.caption || "";
        var hasCap = !!state.caption;
        state.waitingFor = "caption_choice";
        await setState(kv, userId, state);
        var capMsg = "✅ ပုံ ရပြီ.\n\n📝 <b>Caption</b>\n";
        if (hasCap) { capMsg += "ပုံမှာ Caption ပါပါတယ်:\n\n\"" + state.caption.substring(0, 200) + "\""; }
        else { capMsg += "Caption ထည့်မလား?"; }
        await sendMessage(token, chatId, capMsg, captionChoiceKeyboard(hasCap));
      } else if (state.postType === "album") {
        state.media.push(fi);
        if (state.media.length === 1 && fi.caption && !state.caption) state.caption = fi.caption;
        await setState(kv, userId, state);
        await sendMessage(token, chatId, "✅ ပုံ " + state.media.length + " ခု ရပြီ. နောက်ထပ် ပို့နိုင်သေး.\n\n✅ Done နှိပ် → Caption ဆက်ပါ.", albumMediaKeyboard());
      }
    } else if (text) {
      if (state.postType === "single") {
        state.caption = text;
        await setState(kv, userId, state);
        await sendMessage(token, chatId, "📝 Caption သိမ်းပြီ. ပုံ ပို့ပါ.", null);
      } else if (state.postType === "album" && state.media.length > 0) {
        state.caption = text;
        await setState(kv, userId, state);
        await sendMessage(token, chatId, "✅ Caption သိမ်းပြီ. ပုံ ဆက်ပို့ပါ.\n\n✅ Done နှိပ် → Caption ဆက်ပါ.", albumMediaKeyboard());
      } else {
        await sendMessage(token, chatId, "❌ ပုံ ပို့ပါ အရင်.", null);
      }
    } else {
      await sendMessage(token, chatId, "❌ ပုံ ပို့ပါ.", null);
    }
    return;
  }

  // ── Step 3: Caption Text Input ──
  if (state.waitingFor === "caption") {
    if (text) {
      state.caption = text;
      state.waitingFor = "url_choice";
      await setState(kv, userId, state);
      await sendMessage(token, chatId, "✅ Caption သိမ်းပြီ.\n\n🔗 <b>URL Button</b>\n\nPost မှာ URL Button ထည့်မလား?", urlChoiceKeyboard());
    } else {
      await sendMessage(token, chatId, "❌ Caption ရိုက်ပါ.", null);
    }
    return;
  }

  // ── Step 4: URL Input ──
  if (state.waitingFor === "url") {
    var url = text.trim();
    if (url.startsWith("http://") || url.startsWith("https://")) {
      if (!state.urlButton) state.urlButton = {};
      state.urlButton.url = url;
      state.waitingFor = "url_text";
      await setState(kv, userId, state);
      await sendMessage(token, chatId, "✅ URL: " + url + "\n\nအခု Button ပေါ်မှာ ပြမယ့် စာသား ရိုက်ပါ.\nဥပမာ: 🌐 ဝဘ်ဆိုက် သွားရန်", null);
    } else {
      await sendMessage(token, chatId, "❌ URL မမှန်ပါ. http:// ဒါမှမဟုတ် https:// နဲ့ စရပါ.", null);
    }
    return;
  }

  // ── Step 4b: URL Button Text Input ──
  if (state.waitingFor === "url_text") {
    if (text) {
      if (!state.urlButton) state.urlButton = {};
      state.urlButton.text = text;
      state.waitingFor = "done";
      await setState(kv, userId, state);
      await sendMessage(token, chatId, buildSummary(state) + "\n✅ Done နှိပ် → Channel ရွေးပြီး တင်.", doneKeyboard());
    } else {
      await sendMessage(token, chatId, "❌ Button စာသား ရိုက်ပါ.", null);
    }
    return;
  }
}

export default {
  async fetch(request, env, ctx) {
    var url = new URL(request.url);
    if (url.pathname === "/setupWebhook") { var result = await tgApi(env.BOT_TOKEN, "setWebhook", { url: "https://" + url.host + "/webhook" }); return new Response(JSON.stringify({ result: result }, null, 2), { headers: { "Content-Type": "application/json" } }); }
    if (url.pathname === "/test") { var me = await tgApi(env.BOT_TOKEN, "getMe", {}); return new Response(JSON.stringify({ bot: me, owner: OWNER_ID, kvBound: !!env.BOT_KV, tokenBound: !!env.BOT_TOKEN }, null, 2), { headers: { "Content-Type": "application/json" } }); }
    if (url.pathname === "/webhook" && request.method === "POST") { try { var update = await request.json(); await handleUpdate(update, env); return new Response('{"ok":true}', { headers: { "Content-Type": "application/json" } }); } catch (err) { return new Response('{"ok":true}', { headers: { "Content-Type": "application/json" } }); } }
    if (url.pathname === "/") { return new Response(JSON.stringify({ status: "ok", bot: "Telegram Channel Posting Bot - Owner Only" }, null, 2), { headers: { "Content-Type": "application/json" } }); }
    return new Response("Not found", { status: 404 });
  }
};
