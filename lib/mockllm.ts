import type { LlmReply, Msg, ToolDef } from "./llm";

type L = "en" | "ru" | "kk" | "zh" | "id" | "vi";

const TXT: Record<string, Record<L, string>> = {
  inject: {
    en: "This message looks like a scam, so I paused it. Please verify with your landlord using the number you already saved.",
    ru: "Это сообщение похоже на мошенничество, поэтому я его остановил. Проверьте у арендодателя по номеру, который у вас уже сохранён.",
    kk: "Бұл хабарлама алаяқтыққа ұқсайды, сондықтан тоқтаттым. Үй иесімен өзіңізде сақталған нөмір арқылы тексеріңіз.",
    zh: "这条消息看起来像诈骗，我已暂停操作。请用您已保存的号码向房东核实。",
    id: "Pesan ini tampak seperti penipuan, jadi saya hentikan. Verifikasi ke pemilik kos lewat nomor yang sudah Anda simpan.",
    vi: "Tin nhắn này có vẻ là lừa đảo nên tôi đã tạm dừng. Hãy xác minh với chủ nhà qua số điện thoại bạn đã lưu.",
  },
  limits: {
    en: "I can't change limits, add payees from chat or reveal security codes — those actions are deliberately outside my permissions.",
    ru: "Я не могу менять лимиты, добавлять получателей из чата или раскрывать коды безопасности — это намеренно вне моих прав.",
    kk: "Мен лимиттерді өзгерте алмаймын, чаттан алушы қоса алмаймын және кодтарды аша алмаймын — бұл әдейі менің құқығымнан тыс.",
    zh: "我不能修改限额、通过聊天添加收款人或透露安全码——这些操作被刻意排除在我的权限之外。",
    id: "Saya tidak bisa mengubah batas, menambah penerima dari obrolan, atau membuka kode keamanan — itu sengaja di luar izin saya.",
    vi: "Tôi không thể đổi hạn mức, thêm người nhận từ chat hay tiết lộ mã bảo mật — những việc này được cố ý đặt ngoài quyền của tôi.",
  },
  tuition: {
    en: "Here is your tuition case. Money moves only after each owner approves in the app, and it's complete only when the university posts it.",
    ru: "Вот ваше дело об оплате обучения. Деньги двигаются только после подтверждения каждым владельцем, а завершено оно, когда университет зачтёт платёж.",
    kk: "Міне, оқу ақысын төлеу ісіңіз. Ақша әр иесі растағаннан кейін ғана қозғалады, ал университет есепке алғанда іс аяқталады.",
    zh: "这是您的学费付款案例。每位资金所有人确认后资金才会移动，只有大学入账后才算完成。",
    id: "Ini kasus pembayaran kuliah Anda. Uang bergerak hanya setelah setiap pemilik dana menyetujui di aplikasi, dan selesai saat universitas mencatatnya.",
    vi: "Đây là hồ sơ học phí của bạn. Tiền chỉ di chuyển sau khi từng chủ tài khoản xác nhận, và hoàn tất khi trường ghi nhận.",
  },
  whatif: {
    en: "Here's the what-if with that reserve — nothing was changed. Set the reserve on the Tuition tab to apply it.",
    ru: "Вот расчёт с таким резервом — ничего не изменено. Чтобы применить, задайте резерв на вкладке «Учёба».",
    kk: "Осы резервпен есеп — ештеңе өзгермеді. Қолдану үшін «Оқу» бөлімінде резервті орнатыңыз.",
    zh: "这是按该生活费储备的模拟结果——没有做任何更改。要生效，请在“学费”页设置储备。",
    id: "Ini simulasi dengan cadangan tersebut — tidak ada yang diubah. Atur cadangan di tab Kuliah untuk menerapkannya.",
    vi: "Đây là tính toán giả định với mức dự trữ đó — chưa thay đổi gì. Hãy đặt dự trữ ở tab Học phí để áp dụng.",
  },
  friend: {
    en: "Sure — who exactly should I pay, and how much? I can only send to people already saved as payees.",
    ru: "Конечно — кому именно и сколько? Я могу отправлять только сохранённым получателям.",
    kk: "Әрине — нақты кімге және қанша? Мен тек сақталған алушыларға жібере аламын.",
    zh: "好的——具体付给谁、多少钱？我只能转给已保存的收款人。",
    id: "Baik — tepatnya ke siapa dan berapa? Saya hanya bisa mengirim ke penerima yang sudah disimpan.",
    vi: "Được — chính xác là ai và bao nhiêu? Tôi chỉ có thể gửi cho người nhận đã lưu.",
  },
  compare: {
    en: "Here's how the routes compare. Want me to draft the cheapest one?",
    ru: "Вот сравнение способов. Подготовить самый дешёвый?",
    kk: "Жолдардың салыстыруы. Ең арзанын дайындайын ба?",
    zh: "这是各渠道的对比。要我起草最便宜的那个吗？",
    id: "Ini perbandingan jalurnya. Mau saya siapkan yang termurah?",
    vi: "Đây là so sánh các kênh. Bạn có muốn tôi soạn kênh rẻ nhất không?",
  },
  recent: { en: "Here's your recent activity.", ru: "Вот ваши последние операции.", kk: "Соңғы операцияларыңыз.", zh: "这是您最近的交易。", id: "Ini aktivitas terbaru Anda.", vi: "Đây là hoạt động gần đây của bạn." },
  convert: {
    en: "Conversion drafted on the cheapest route — tap Confirm to execute.",
    ru: "Обмен подготовлен по самому дешёвому способу — нажмите «Подтвердить».",
    kk: "Айырбас ең арзан жолмен дайындалды — растау үшін басыңыз.",
    zh: "已按最便宜渠道起草换汇——点击确认即可执行。",
    id: "Penukaran disiapkan lewat jalur termurah — ketuk Konfirmasi untuk menjalankan.",
    vi: "Đã soạn lệnh đổi tiền qua kênh rẻ nhất — chạm Xác nhận để thực hiện.",
  },
  alert: {
    en: "Alert set. I'll tell you when the rate gets there and draft a conversion.",
    ru: "Уведомление настроено. Сообщу, когда курс дойдёт, и подготовлю обмен.",
    kk: "Хабарлама орнатылды. Бағам жеткенде хабарлап, айырбас дайындаймын.",
    zh: "提醒已设置。汇率达到时我会通知您并起草换汇。",
    id: "Peringatan diatur. Saya akan memberi tahu saat kurs tercapai dan menyiapkan penukaran.",
    vi: "Đã đặt cảnh báo. Tôi sẽ báo khi tỷ giá chạm mức đó và soạn lệnh đổi.",
  },
  credit: {
    en: "You're 2 of 5 steps in. Next: a student secured card. This is education, not an official credit score.",
    ru: "Вы прошли 2 шага из 5. Дальше — студенческая обеспеченная карта. Это обучение, а не официальный кредитный рейтинг.",
    kk: "5 қадамның 2-еуі өтті. Келесі — студенттік кепілді карта. Бұл ресми рейтинг емес, оқу материалы.",
    zh: "您已完成 5 步中的 2 步。下一步：学生担保信用卡。这是教育内容，不是官方信用评分。",
    id: "Anda sudah 2 dari 5 langkah. Berikutnya: kartu kredit berjaminan mahasiswa. Ini edukasi, bukan skor kredit resmi.",
    vi: "Bạn đã xong 2/5 bước. Tiếp theo: thẻ bảo đảm cho sinh viên. Đây là nội dung giáo dục, không phải điểm tín dụng chính thức.",
  },
  family: {
    en: "Transfer to your dad is drafted. Confirm it with Face ID or PIN.",
    ru: "Перевод папе подготовлен. Подтвердите через Face ID или PIN.",
    kk: "Әкеңізге аударым дайын. Face ID немесе PIN арқылы растаңыз.",
    zh: "给爸爸的转账已起草。请用面容 ID 或 PIN 确认。",
    id: "Transfer ke ayah Anda sudah disiapkan. Konfirmasi dengan Face ID atau PIN.",
    vi: "Đã soạn lệnh chuyển cho bố bạn. Hãy xác nhận bằng Face ID hoặc PIN.",
  },
  rent: {
    en: "November rent is drafted for your saved landlord.",
    ru: "Аренда за ноябрь подготовлена для сохранённого арендодателя.",
    kk: "Қараша айының жалдау ақысы сақталған үй иесіне дайындалды.",
    zh: "已为您保存的房东起草十一月房租。",
    id: "Sewa November disiapkan untuk pemilik kos yang tersimpan.",
    vi: "Đã soạn tiền nhà tháng 11 cho chủ nhà đã lưu.",
  },
  balance: { en: "Here are your balances.", ru: "Вот ваши балансы.", kk: "Міне, балансыңыз.", zh: "这是您各币种的余额。", id: "Ini saldo Anda.", vi: "Đây là số dư của bạn." },
  rate: { en: "Here's today's rate.", ru: "Вот сегодняшний курс.", kk: "Бүгінгі бағам.", zh: "这是今天的汇率。", id: "Ini kurs hari ini.", vi: "Đây là tỷ giá hôm nay." },
  fallback: {
    en: "I can help with tuition, transfers home, conversions, rate alerts and spotting scams. What do you need?",
    ru: "Я помогу с оплатой учёбы, переводами домой, обменом, уведомлениями о курсе и защитой от мошенников. Что нужно?",
    kk: "Оқу ақысы, үйге аударым, айырбас, бағам хабарламалары және алаяқтықтан қорғауға көмектесемін. Не керек?",
    zh: "我可以帮您交学费、汇款回家、换汇、设置汇率提醒和识别诈骗。需要什么？",
    id: "Saya bisa bantu biaya kuliah, kirim uang ke rumah, penukaran, peringatan kurs, dan mendeteksi penipuan. Apa yang Anda butuhkan?",
    vi: "Tôi có thể giúp đóng học phí, chuyển tiền về nhà, đổi tiền, cảnh báo tỷ giá và phát hiện lừa đảo. Bạn cần gì?",
  },
  simplified: {
    en: "The AI model is unavailable right now, so I'm in simplified mode: I can show balances, rates, bills and the tuition status. Payments and conversions need the full assistant — please try again in a minute.",
    ru: "Модель ИИ сейчас недоступна, поэтому я в упрощённом режиме: могу показать балансы, курсы, счета и статус оплаты обучения. Платежи и обмен — только в полном режиме, попробуйте через минуту.",
    kk: "ЖИ моделі қазір қолжетімсіз, сондықтан жеңілдетілген режимдемін: баланс, бағам, шоттар және оқу ақысының күйін көрсете аламын. Төлем мен айырбас тек толық режимде — бір минуттан кейін қайталаңыз.",
    zh: "AI 模型暂时不可用，我处于简化模式：可以查看余额、汇率、账单和学费状态。付款和换汇需要完整助手——请一分钟后再试。",
    id: "Model AI sedang tidak tersedia, jadi saya dalam mode sederhana: saya bisa menampilkan saldo, kurs, tagihan, dan status pembayaran kuliah. Pembayaran dan penukaran memerlukan asisten penuh — silakan coba lagi sebentar lagi.",
    vi: "Mô hình AI hiện không khả dụng nên tôi đang ở chế độ đơn giản: có thể xem số dư, tỷ giá, hóa đơn và trạng thái học phí. Thanh toán và đổi tiền cần trợ lý đầy đủ — vui lòng thử lại sau một phút.",
  },
  blocked: {
    en: "Some checks failed, so I didn't draft that. See the details below.",
    ru: "Часть проверок не пройдена, поэтому я это не подготовил. Подробности ниже.",
    kk: "Кейбір тексерулер өтпеді, сондықтан дайындамадым. Толығырақ төменде.",
    zh: "部分检查未通过，所以我没有起草。详情见下方。",
    id: "Beberapa pemeriksaan gagal, jadi tidak saya siapkan. Lihat detail di bawah.",
    vi: "Một số kiểm tra không đạt nên tôi không soạn. Xem chi tiết bên dưới.",
  },
};

function detectLang(text: string, system: string): L {
  if (/[әғқңөұүһі]/i.test(text)) return "kk";
  if (/[а-яё]/i.test(text)) return "ru";
  if (/[一-鿿]/.test(text)) return "zh";
  if (/[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệịỉọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(text)) return "vi";
  if (/\b(saya|bayar|kirim|tukar|berapa|biaya|kuliah|ayah|sewa|saldo|kurs|bagaimana|sisakan|hidup)\b/i.test(text)) return "id";
  const m = system.match(/App language: [^(]*\((\w\w)\)/);
  return (m?.[1] as L) || "en";
}

export function simplifiedText(text: string, system: string) {
  return TXT.simplified[detectLang(text, system)];
}

export async function mockChat(messages: Msg[], tools: ToolDef[]): Promise<LlmReply> {
  return mockTurn(messages, tools, 0);
}

async function mockTurn(messages: Msg[], _tools: ToolDef[], depth: number): Promise<LlmReply> {
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

  if (has(/ignore|игнор|елеме|忽略|abaikan|assistant\s*:|ассистент\s*:|new account|новый сч|жаңа шот|新账户|rekening baru|tài khoản mới|bank changed|банк смен|банк ауыс|银行换|bank sudah berganti/)) {
    intent = "inject";
    plan.push(["check_message_risk", { text }]);
    plan.push(["propose_payment", { payee_id: "p_landlord", amount: amount ?? 1500, currency: "SGD", reference: "deposit" }]);
  } else if (has(/limit|лимит|限额|\bbatas\b|hạn mức|add (a )?(new )?payee|добав\w* (нового )?получател|алушы қос|添加收款人|tambah penerima|thêm người nhận|\bpin\b|password|token|system prompt|пароль|токен|密码|otp|kata sandi/)) {
    intent = "limits";
  } else if (has(/what if|а если|если остав|what-if|қалдырсам|如果|bagaimana kalau|nếu tôi/)) {
    intent = "whatif";
    const m = text.match(/(?:S\$|SGD\s?)\s?([\d.,\s]+)/i);
    const reserve = m ? Number(m[1].trim().replace(/[\s,]/g, "").replace(/\.(?=\d{3}\b)/g, "")) : amount ?? 1000;
    plan.push(["what_if_reserve", { reserve_sgd: reserve }]);
  } else if (has(/tuition|уч[её]б|обучен|оқу ақы|学费|biaya kuliah|kuliah|học phí|semester/)) {
    intent = "tuition";
    plan.push(["get_tuition_case", {}]);
  } else if (has(/friend|друг|досым|朋友|teman|bạn bè|bạn tôi/)) {
    intent = "friend";
  } else if (has(/compare|how much would i get|сравни|сколько получу|салыстыр|比较|bandingkan|so sánh/)) {
    intent = "compare";
    plan.push(["compare_routes", { from: "IDR", to: "SGD", amount: amount ?? 3000000 }]);
  } else if (has(/recent|spend|spent|потрат|последн|соңғы|最近|terbaru|belanja|gần đây|chi tiêu/)) {
    intent = "recent";
    plan.push(["get_recent_transactions", { limit: 8 }]);
  } else if (has(/alert|notify|уведом|сообщи|хабарла|提醒|beri tahu|peringatan|báo/)) {
    intent = "alert";
    plan.push(["set_rate_alert", { from: "IDR", to: "SGD", threshold: amount ?? 12100, direction: "below" }]);
  } else if (has(/convert|exchange|обмен|конверт|поменя|айырбас|换|tukar|đổi/)) {
    intent = "convert";
    const from = /usd|\$|доллар|美元/.test(t) ? "USD" : /cny|yuan|юан|人民币/.test(t) ? "CNY" : "IDR";
    const amt = amount ?? (from === "IDR" ? 1000000 : 100);
    plan.push(["compare_routes", { from, to: "SGD", amount: amt }]);
    plan.push(["propose_conversion", { from, to: "SGD", amount: amt }]);
  } else if (has(/credit|кредит|несие|信用|kredit|tín dụng/)) {
    intent = "credit";
    plan.push(["get_credit_plan", {}]);
  } else if (has(/dad|father|пап|әке|爸爸|ayah|\bbố\b/)) {
    intent = "family";
    plan.push(["list_payees", {}]);
    plan.push(["propose_payment", { payee_id: "p_family", amount: amount ?? 500000, currency: "IDR" }]);
  } else if (has(/rent|аренд|жалда|房租|sewa|tiền nhà/)) {
    intent = "rent";
    plan.push(["get_bills", {}]);
    plan.push(["propose_payment", { payee_id: "p_landlord", amount: 950, currency: "SGD", reference: "RENT-NOV" }]);
  } else if (has(/balance|how much|баланс|сколько|қанша|余额|多少钱|saldo|số dư/)) {
    intent = "balance";
    plan.push(["get_balances", {}]);
  } else if (has(/rate|курс|бағам|汇率|kurs|tỷ giá/)) {
    intent = "rate";
    plan.push(["get_fx_quote", { from: "SGD", to: "IDR" }]);
  }

  if (intent === "fallback" && amount !== undefined && depth === 0) {
    let prevIdx = -1;
    for (let i = lastUser - 1; i >= 0; i--) if (messages[i].role === "user") { prevIdx = i; break; }
    const prev = prevIdx >= 0 ? String(messages[prevIdx].content || "").split("\n\n[Corridor security layer")[0] : "";
    if (prev) {
      const merged = /\d/.test(prev) ? prev.replace(/\d[\d,\s.]*\d|\d/, String(amount)) : `${prev} ${text}`;
      const copy = messages.map((m, i) => (i === lastUser ? ({ ...m, content: merged } as Msg) : m));
      return mockTurn(copy, _tools, 1);
    }
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
  const m = text.match(/(\d[\d,\s.]*)\s*(k\b|к\b|тыс|тысяч|мың|nghìn|ribu|juta|万)?/i);
  if (!m) return undefined;
  let n = Number(m[1].trim().replace(/[\s,]/g, "").replace(/\.(?=\d{3}\b)/g, ""));
  if (m[2]) n *= m[2] === "万" ? 10000 : m[2].toLowerCase() === "juta" ? 1000000 : 1000;
  return n > 0 ? n : undefined;
}
