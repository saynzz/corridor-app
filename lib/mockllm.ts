import type { LlmReply, Msg, ToolDef } from "./llm";

type L = "en" | "ru" | "kk" | "zh" | "ms" | "vi";

const TXT: Record<string, Record<L, string>> = {
  inject: {
    en: "This message looks like a scam, so I paused it. Please verify with your landlord using the number you already saved.",
    ru: "Это сообщение похоже на мошенничество, поэтому я его остановил. Проверьте у арендодателя по номеру, который у вас уже сохранён.",
    kk: "Бұл хабарлама алаяқтыққа ұқсайды, сондықтан тоқтаттым. Үй иесімен өзіңізде сақталған нөмір арқылы тексеріңіз.",
    zh: "这条消息看起来像诈骗，我已暂停操作。请用您已保存的号码向房东核实。",
    ms: "Mesej ini nampak seperti penipuan, jadi saya hentikannya. Sila sahkan dengan tuan rumah melalui nombor yang anda sudah simpan.",
    vi: "Tin nhắn này có vẻ là lừa đảo nên tôi đã tạm dừng. Hãy xác minh với chủ nhà qua số điện thoại bạn đã lưu.",
  },
  limits: {
    en: "I can't change limits, add payees from chat or reveal security codes — those actions are deliberately outside my permissions.",
    ru: "Я не могу менять лимиты, добавлять получателей из чата или раскрывать коды безопасности — это намеренно вне моих прав.",
    kk: "Мен лимиттерді өзгерте алмаймын, чаттан алушы қоса алмаймын және кодтарды аша алмаймын — бұл әдейі менің құқығымнан тыс.",
    zh: "我不能修改限额、通过聊天添加收款人或透露安全码——这些操作被刻意排除在我的权限之外。",
    ms: "Saya tidak boleh mengubah had, menambah penerima dari sembang atau mendedahkan kod keselamatan — tindakan itu sengaja di luar kebenaran saya.",
    vi: "Tôi không thể đổi hạn mức, thêm người nhận từ chat hay tiết lộ mã bảo mật — những việc này được cố ý đặt ngoài quyền của tôi.",
  },
  tuition: {
    en: "Plan ready: convert first, then pay the tuition. Both are waiting for your confirmation.",
    ru: "План готов: сначала обмен, потом оплата учёбы. Оба шага ждут вашего подтверждения.",
    kk: "Жоспар дайын: алдымен айырбас, содан кейін оқу ақысы. Екеуі де сіздің растауыңызды күтуде.",
    zh: "方案已就绪：先换汇，再交学费。两步都在等待您确认。",
    ms: "Pelan sedia: tukar dahulu, kemudian bayar yuran. Kedua-duanya menunggu pengesahan anda.",
    vi: "Kế hoạch đã sẵn sàng: đổi tiền trước, sau đó đóng học phí. Cả hai đang chờ bạn xác nhận.",
  },
  friend: {
    en: "Sure — who exactly should I pay, and how much? I can only send to people already saved as payees.",
    ru: "Конечно — кому именно и сколько? Я могу отправлять только сохранённым получателям.",
    kk: "Әрине — нақты кімге және қанша? Мен тек сақталған алушыларға жібере аламын.",
    zh: "好的——具体付给谁、多少钱？我只能转给已保存的收款人。",
    ms: "Baik — siapa sebenarnya dan berapa? Saya hanya boleh hantar kepada penerima yang sudah disimpan.",
    vi: "Được — chính xác là ai và bao nhiêu? Tôi chỉ có thể gửi cho người nhận đã lưu.",
  },
  compare: {
    en: "Here's how the routes compare. Want me to draft the cheapest one?",
    ru: "Вот сравнение способов. Подготовить самый дешёвый?",
    kk: "Жолдардың салыстыруы. Ең арзанын дайындайын ба?",
    zh: "这是各渠道的对比。要我起草最便宜的那个吗？",
    ms: "Ini perbandingan laluan. Mahu saya sediakan yang paling murah?",
    vi: "Đây là so sánh các kênh. Bạn có muốn tôi soạn kênh rẻ nhất không?",
  },
  recent: { en: "Here's your recent activity.", ru: "Вот ваши последние операции.", kk: "Соңғы операцияларыңыз.", zh: "这是您最近的交易。", ms: "Ini aktiviti terkini anda.", vi: "Đây là hoạt động gần đây của bạn." },
  convert: {
    en: "Conversion drafted on the cheapest route — tap Confirm to execute.",
    ru: "Обмен подготовлен по самому дешёвому способу — нажмите «Подтвердить».",
    kk: "Айырбас ең арзан жолмен дайындалды — растау үшін басыңыз.",
    zh: "已按最便宜渠道起草换汇——点击确认即可执行。",
    ms: "Tukaran disediakan melalui laluan paling murah — ketik Sahkan.",
    vi: "Đã soạn lệnh đổi tiền qua kênh rẻ nhất — chạm Xác nhận để thực hiện.",
  },
  alert: {
    en: "Alert set. I'll tell you when the rate gets there and draft a conversion.",
    ru: "Уведомление настроено. Сообщу, когда курс дойдёт, и подготовлю обмен.",
    kk: "Хабарлама орнатылды. Бағам жеткенде хабарлап, айырбас дайындаймын.",
    zh: "提醒已设置。汇率达到时我会通知您并起草换汇。",
    ms: "Amaran ditetapkan. Saya akan beritahu bila kadar sampai dan sediakan tukaran.",
    vi: "Đã đặt cảnh báo. Tôi sẽ báo khi tỷ giá chạm mức đó và soạn lệnh đổi.",
  },
  credit: {
    en: "You're 2 of 5 steps in. Next: a student secured card.",
    ru: "Вы прошли 2 шага из 5. Дальше — студенческая обеспеченная карта.",
    kk: "5 қадамның 2-еуі өтті. Келесі — студенттік кепілді карта.",
    zh: "您已完成 5 步中的 2 步。下一步：学生担保信用卡。",
    ms: "Anda sudah 2 daripada 5 langkah. Seterusnya: kad bercagar pelajar.",
    vi: "Bạn đã xong 2/5 bước. Tiếp theo: thẻ bảo đảm cho sinh viên.",
  },
  mom: {
    en: "Transfer to your mom is drafted. Confirm it with Face ID or PIN.",
    ru: "Перевод маме подготовлен. Подтвердите через Face ID или PIN.",
    kk: "Анаңызға аударым дайын. Face ID немесе PIN арқылы растаңыз.",
    zh: "给妈妈的转账已起草。请用面容 ID 或 PIN 确认。",
    ms: "Pindahan kepada ibu anda sudah disediakan. Sahkan dengan Face ID atau PIN.",
    vi: "Đã soạn lệnh chuyển cho mẹ bạn. Hãy xác nhận bằng Face ID hoặc PIN.",
  },
  rent: {
    en: "November rent is drafted for your saved landlord.",
    ru: "Аренда за ноябрь подготовлена для сохранённого арендодателя.",
    kk: "Қараша айының жалдау ақысы сақталған үй иесіне дайындалды.",
    zh: "已为您保存的房东起草十一月房租。",
    ms: "Sewa November disediakan untuk tuan rumah tersimpan anda.",
    vi: "Đã soạn tiền nhà tháng 11 cho chủ nhà đã lưu.",
  },
  balance: { en: "Here are your balances.", ru: "Вот ваши балансы.", kk: "Міне, балансыңыз.", zh: "这是您各币种的余额。", ms: "Ini baki anda.", vi: "Đây là số dư của bạn." },
  rate: { en: "Here's today's rate.", ru: "Вот сегодняшний курс.", kk: "Бүгінгі бағам.", zh: "这是今天的汇率。", ms: "Ini kadar hari ini.", vi: "Đây là tỷ giá hôm nay." },
  fallback: {
    en: "I can help with transfers home, tuition, conversions, rate alerts and spotting scams. What do you need?",
    ru: "Я помогу с переводами домой, оплатой учёбы, обменом, уведомлениями о курсе и защитой от мошенников. Что нужно?",
    kk: "Үйге аударым, оқу ақысы, айырбас, бағам хабарламалары және алаяқтықтан қорғауға көмектесемін. Не керек?",
    zh: "我可以帮您汇款回家、交学费、换汇、设置汇率提醒和识别诈骗。需要什么？",
    ms: "Saya boleh bantu pindahan ke rumah, yuran, tukaran, amaran kadar dan mengesan penipuan. Apa yang anda perlukan?",
    vi: "Tôi có thể giúp chuyển tiền về nhà, đóng học phí, đổi tiền, cảnh báo tỷ giá và phát hiện lừa đảo. Bạn cần gì?",
  },
  blocked: {
    en: "Some checks failed, so I didn't draft that. See the details below.",
    ru: "Часть проверок не пройдена, поэтому я это не подготовил. Подробности ниже.",
    kk: "Кейбір тексерулер өтпеді, сондықтан дайындамадым. Толығырақ төменде.",
    zh: "部分检查未通过，所以我没有起草。详情见下方。",
    ms: "Sebahagian semakan gagal, jadi saya tidak menyediakannya. Lihat butiran di bawah.",
    vi: "Một số kiểm tra không đạt nên tôi không soạn. Xem chi tiết bên dưới.",
  },
};

const PLAN: Record<L, { title: string; s1: string; s2: string }> = {
  en: { title: "Plan · 2 steps", s1: "Convert ₸500,000 → S$ via the cheapest route", s2: "Pay S$2,000 tuition to Lion City University" },
  ru: { title: "План · 2 шага", s1: "Обменять ₸500 000 → S$ самым дешёвым способом", s2: "Оплатить S$2,000 за учёбу в Lion City University" },
  kk: { title: "Жоспар · 2 қадам", s1: "₸500 000 → S$ ең арзан жолмен айырбастау", s2: "Lion City University-ге S$2,000 оқу ақысын төлеу" },
  zh: { title: "方案 · 2 步", s1: "以最便宜渠道将 ₸500,000 换成新元", s2: "向 Lion City University 支付 S$2,000 学费" },
  ms: { title: "Pelan · 2 langkah", s1: "Tukar ₸500,000 → S$ melalui laluan paling murah", s2: "Bayar yuran S$2,000 kepada Lion City University" },
  vi: { title: "Kế hoạch · 2 bước", s1: "Đổi ₸500.000 → S$ qua kênh rẻ nhất", s2: "Đóng học phí S$2,000 cho Lion City University" },
};

function detectLang(text: string, system: string): L {
  if (/[әғқңөұүһі]/i.test(text)) return "kk";
  if (/[а-яё]/i.test(text)) return "ru";
  if (/[一-鿿]/.test(text)) return "zh";
  if (/[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệịỉọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(text)) return "vi";
  if (/\b(saya|bayar|hantar|tukar|berapa|yuran|ibu|sewa|baki|kadar)\b/i.test(text)) return "ms";
  const m = system.match(/App language: [^(]*\((\w\w)\)/);
  return (m?.[1] as L) || "en";
}

export async function mockChat(messages: Msg[], _tools: ToolDef[]): Promise<LlmReply> {
  void _tools;
  let lastUser = -1;
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "user") { lastUser = i; break; }
  const raw = (messages[lastUser]?.content as string) || "";
  const text = raw.split("\n\n[Corridor security layer")[0];
  const t = text.toLowerCase();
  const lang = detectLang(text, (messages[0]?.content as string) || "");
  const done = messages.slice(lastUser + 1).filter((m) => m.role === "tool") as Extract<Msg, { role: "tool" }>[];
  const results = done.map((m) => safe(m.content));

  const amount = parseAmount(text);
  const plan: [string, Record<string, unknown>][] = [];
  let intent = "fallback";
  const has = (re: RegExp) => re.test(t);

  if (has(/ignore|игнор|елеме|忽略|assistant\s*:|ассистент\s*:|new account|новый сч|жаңа шот|新账户|akaun baharu|tài khoản mới|bank changed|банк смен|банк ауыс|银行换/)) {
    intent = "inject";
    plan.push(["check_message_risk", { text }]);
    plan.push(["propose_payment", { payee_id: "p_landlord", amount: amount ?? 1500, currency: "SGD", reference: "deposit" }]);
  } else if (has(/limit|лимит|限额|\bhad\b|hạn mức|add (a )?(new )?payee|добав\w* (нового )?получател|алушы қос|添加收款人|tambah penerima|thêm người nhận|\bpin\b|password|token|system prompt|пароль|токен|密码|otp/)) {
    intent = "limits";
  } else if (has(/tuition|уч[её]б|обучен|оқу ақы|学费|yuran|học phí|semester/)) {
    intent = "tuition";
    const p = PLAN[lang];
    plan.push(["get_balances", {}]);
    plan.push(["get_bills", {}]);
    plan.push(["compare_routes", { from: "KZT", to: "SGD", amount: 500000 }]);
    plan.push(["present_plan", { title: p.title, steps: [{ text: p.s1, tier: 2 }, { text: p.s2, tier: 3 }] }]);
    plan.push(["propose_conversion", { from: "KZT", to: "SGD", amount: 500000, route_id: "partner_network" }]);
    plan.push(["propose_payment", { payee_id: "p_uni", amount: 2000, currency: "SGD", reference: "LCU-2026-S2-48213" }]);
  } else if (has(/friend|друг|досым|朋友|kawan|bạn bè|bạn tôi/)) {
    intent = "friend";
  } else if (has(/compare|how much would i get|сравни|сколько получу|салыстыр|比较|banding|so sánh/)) {
    intent = "compare";
    plan.push(["compare_routes", { from: "KZT", to: "SGD", amount: amount ?? 300000 }]);
  } else if (has(/recent|spend|spent|потрат|последн|соңғы|最近|belanja|terkini|gần đây|chi tiêu/)) {
    intent = "recent";
    plan.push(["get_recent_transactions", { limit: 8 }]);
  } else if (has(/alert|notify|уведом|сообщи|хабарла|提醒|beritahu|amaran|báo/)) {
    intent = "alert";
    plan.push(["set_rate_alert", { from: "KZT", to: "SGD", threshold: amount ?? 388, direction: "below" }]);
  } else if (has(/convert|exchange|обмен|конверт|поменя|айырбас|换|tukar|đổi/)) {
    intent = "convert";
    const from = /usd|\$|доллар|美元/.test(t) ? "USD" : /cny|yuan|юан|人民币/.test(t) ? "CNY" : "KZT";
    const amt = amount ?? (from === "KZT" ? 100000 : 100);
    plan.push(["compare_routes", { from, to: "SGD", amount: amt }]);
    plan.push(["propose_conversion", { from, to: "SGD", amount: amt }]);
  } else if (has(/credit|кредит|несие|信用|kredit|tín dụng/)) {
    intent = "credit";
    plan.push(["get_credit_plan", {}]);
  } else if (has(/mom|mother|мам|анам|妈妈|\bibu\b|mẹ/)) {
    intent = "mom";
    plan.push(["list_payees", {}]);
    plan.push(["propose_payment", { payee_id: "p_mom", amount: amount ?? 50000, currency: "KZT" }]);
  } else if (has(/rent|аренд|жалда|房租|sewa|tiền nhà/)) {
    intent = "rent";
    plan.push(["get_bills", {}]);
    plan.push(["propose_payment", { payee_id: "p_landlord", amount: 950, currency: "SGD", reference: "RENT-NOV" }]);
  } else if (has(/balance|how much|баланс|сколько|қанша|余额|多少钱|baki|số dư/)) {
    intent = "balance";
    plan.push(["get_balances", {}]);
  } else if (has(/rate|курс|бағам|汇率|kadar|tỷ giá/)) {
    intent = "rate";
    plan.push(["get_fx_quote", { from: "SGD", to: "KZT" }]);
  }

  if (done.length < plan.length) {
    const [name, args] = plan[done.length];
    return { content: "", toolCalls: [{ id: `mock_${done.length}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] };
  }
  const blocked = results.some((r) => r?.status === "blocked");
  const key = blocked && intent !== "inject" ? "blocked" : intent;
  return { content: TXT[key][lang], toolCalls: [] };
}

function safe(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function parseAmount(text: string): number | undefined {
  const m = text.match(/(\d[\d,\s.]*)\s*(k\b|к\b|тыс|тысяч|мың|nghìn|ribu|万)?/i);
  if (!m) return undefined;
  let n = Number(m[1].replace(/[\s,]/g, "").replace(/\.(?=\d{3}\b)/g, ""));
  if (m[2]) n *= m[2] === "万" ? 10000 : 1000;
  return n > 0 ? n : undefined;
}
