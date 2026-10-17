type D = Record<string, string>;

const en: D = {
  "step.of": "Step {n} of {total}", "step.progress": "Payment progress", "step.locked": "Opens after the previous step",
  "chain.title": "Tamper-evident log", "chain.intact": "INTACT", "chain.broken": "TAMPERED",
  "chain.sub": "Every entry stores the SHA-256 of the previous one. Editing or deleting any entry breaks the chain; the chain head is anchored to a ledger.",
  "chain.entries": "entries", "chain.head": "head", "chain.where": "broken at", "chain.anchor": "last anchor", "chain.provider": "ledger",
  "chain.local": "local ledger (simulation)", "chain.anchorNow": "Anchor now", "chain.anchored": "Chain head anchored", "chain.anchorFail": "Anchoring refused — chain is broken or ledger unavailable",
  "con.audit": "Audit log", "con.tamperAudit": "Edit an audit entry", "con.tamperAuditH": "Silently changes one stored entry — the Shield tab must show TAMPERED",
  "rates.sample": "sample rates (offline)",
  "login.payerTitle": "Sign in as the family payer",
  "login.payerSub": "Budi approves only debits from his own IDR account. In production this happens on his own phone.",
  "login.operatorTitle": "Operator sign-in",
  "login.operatorSub": "Backend console for simulated provider and university events. Needs the operator key.",
  "login.pin": "PIN", "login.key": "Operator key", "login.signIn": "Sign in", "login.cancel": "Cancel",
  "login.wrong": "Wrong credentials. Attempts left: {n}", "login.locked": "Too many attempts. Locked for {s} s.",
  "login.hint": "Sandbox credential: {v}",
  "agent.simplified": "Simplified mode · AI model offline",
  "agent.simplifiedHint": "Answered by the rule-based fallback. Read-only: payments and conversions wait for the AI model.",
};

const ru: D = {
  "step.of": "Шаг {n} из {total}", "step.progress": "Ход оплаты", "step.locked": "Откроется после предыдущего шага",
  "chain.title": "Защищённый журнал", "chain.intact": "ЦЕЛ", "chain.broken": "ИЗМЕНЁН",
  "chain.sub": "Каждая запись хранит SHA-256 предыдущей. Правка или удаление любой записи ломает цепочку; вершина цепочки фиксируется в реестре.",
  "chain.entries": "записей", "chain.head": "вершина", "chain.where": "разрыв", "chain.anchor": "последняя фиксация", "chain.provider": "реестр",
  "chain.local": "локальный реестр (симуляция)", "chain.anchorNow": "Зафиксировать", "chain.anchored": "Вершина цепочки зафиксирована", "chain.anchorFail": "Фиксация отклонена — цепочка повреждена или реестр недоступен",
  "con.audit": "Журнал аудита", "con.tamperAudit": "Изменить запись журнала", "con.tamperAuditH": "Тихо меняет одну запись — вкладка «Защита» должна показать ИЗМЕНЁН",
  "rates.sample": "примерные курсы (офлайн)",
  "login.payerTitle": "Вход для семейного плательщика",
  "login.payerSub": "Буди подтверждает только списания со своего счёта в IDR. В реальном продукте — на своём телефоне.",
  "login.operatorTitle": "Вход оператора",
  "login.operatorSub": "Консоль для симуляции событий провайдера и университета. Нужен ключ оператора.",
  "login.pin": "PIN", "login.key": "Ключ оператора", "login.signIn": "Войти", "login.cancel": "Отмена",
  "login.wrong": "Неверные данные. Осталось попыток: {n}", "login.locked": "Слишком много попыток. Блокировка на {s} с.",
  "login.hint": "Данные песочницы: {v}",
  "agent.simplified": "Упрощённый режим · модель ИИ недоступна",
  "agent.simplifiedHint": "Ответ дал резервный модуль на правилах. Только чтение: платежи и обмен ждут модель ИИ.",
};

const id: D = {
  "step.of": "Langkah {n} dari {total}", "step.progress": "Progres pembayaran", "step.locked": "Terbuka setelah langkah sebelumnya",
  "chain.title": "Log anti-rekayasa", "chain.intact": "UTUH", "chain.broken": "DIUBAH",
  "chain.sub": "Setiap entri menyimpan SHA-256 dari entri sebelumnya. Mengubah atau menghapus entri mana pun memutus rantai; ujung rantai dicatat ke buku besar.",
  "chain.entries": "entri", "chain.head": "ujung", "chain.where": "putus di", "chain.anchor": "jangkar terakhir", "chain.provider": "buku besar",
  "chain.local": "buku besar lokal (simulasi)", "chain.anchorNow": "Jangkarkan sekarang", "chain.anchored": "Ujung rantai dijangkarkan", "chain.anchorFail": "Penjangkaran ditolak — rantai rusak atau buku besar tidak tersedia",
  "con.audit": "Log audit", "con.tamperAudit": "Ubah satu entri audit", "con.tamperAuditH": "Diam-diam mengubah satu entri — tab Perisai harus menampilkan DIUBAH",
  "rates.sample": "kurs contoh (offline)",
  "login.payerTitle": "Masuk sebagai pembayar keluarga",
  "login.payerSub": "Budi hanya menyetujui debit dari rekening IDR miliknya. Di produk nyata, ini dilakukan di ponselnya sendiri.",
  "login.operatorTitle": "Masuk sebagai operator",
  "login.operatorSub": "Konsol untuk menyimulasikan peristiwa penyedia dan universitas. Memerlukan kunci operator.",
  "login.pin": "PIN", "login.key": "Kunci operator", "login.signIn": "Masuk", "login.cancel": "Batal",
  "login.wrong": "Data salah. Sisa percobaan: {n}", "login.locked": "Terlalu banyak percobaan. Terkunci selama {s} detik.",
  "login.hint": "Kredensial sandbox: {v}",
  "agent.simplified": "Mode sederhana · model AI tidak aktif",
  "agent.simplifiedHint": "Dijawab oleh cadangan berbasis aturan. Hanya baca: pembayaran dan penukaran menunggu model AI.",
};

const kk: D = {
  "step.of": "{total} қадамның {n}-қадамы", "step.locked": "Алдыңғы қадамнан кейін ашылады",
  "rates.sample": "үлгі бағамдар (офлайн)",
  "agent.simplified": "Жеңілдетілген режим · ЖИ моделі қолжетімсіз",
};

const zh: D = {
  "step.of": "第 {n} 步，共 {total} 步", "step.locked": "完成上一步后开启",
  "rates.sample": "示例汇率（离线）",
  "agent.simplified": "简化模式 · AI 模型离线",
};

const vi: D = {
  "step.of": "Bước {n}/{total}", "step.locked": "Mở sau bước trước",
  "rates.sample": "tỷ giá mẫu (ngoại tuyến)",
  "agent.simplified": "Chế độ đơn giản · mô hình AI ngoại tuyến",
};

export const MORE = { en, ru, id, kk, zh, vi };
