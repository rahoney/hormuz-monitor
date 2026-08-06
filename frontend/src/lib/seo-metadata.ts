export type SeoMeta = {
  title: string;
  description: string;
  keywords: readonly string[];
};

export const seoMetadata: Record<string, SeoMeta> = {
  ko: {
    title: "호르무즈 해협 실시간 지도·봉쇄 모니터 | 미국·이란 전쟁과 국제유가",
    description: "호르무즈 해협 실시간 지도, 선박 통행과 봉쇄, 미국 이란 전쟁, 트럼프SNS, 국제유가 WTI, 종합주가지수를 한눈에 확인하는 대시보드입니다.",
    keywords: ["호르무즈 해협", "호르무즈 해협 실시간", "호르무즈 모니터", "호르무즈 해협 모니터", "호르무즈 해협 지도 실시간", "미국 이란 전쟁 현황", "이란 전쟁 실시간", "유가 실시간", "WTI 유가 실시간", "브렌트유 실시간", "미국 휘발유 가격", "트럼프"],
  },
  en: {
    title: "Strait of Hormuz News Today | US, Iran, Trump, Oil Price & Map",
    description: "Track the Strait of Hormuz today — Iran conflict, Trump updates, live oil price, vessel traffic map, and market indicators in one real-time dashboard.",
    keywords: ["Strait of Hormuz", "Hormuz Monitor", "Hormuz tracker", "Strait of Hormuz live map", "U.S. Iran conflict", "oil price live", "WTI oil price", "Brent oil price", "vessel traffic", "U.S. gasoline prices", "Trump"],
  },
  ar: {
    title: "أخبار مضيق هرمز اليوم | أمريكا، إيران، ترامب، أسعار النفط والخريطة",
    description: "تابع مضيق هرمز اليوم — الصراع الإيراني، تحديثات ترامب، أسعار النفط المباشرة، خريطة حركة السفن ومؤشرات السوق في لوحة معلومات واحدة.",
    keywords: ["مضيق هرمز", "مراقب هرمز", "متتبع هرمز", "خريطة مضيق هرمز المباشرة", "صراع أمريكا وإيران", "سعر النفط مباشر", "سعر خام غرب تكساس", "سعر خام برنت", "حركة السفن", "أسعار البنزين الأمريكية"],
  },
  fa: {
    title: "اخبار امروز تنگه هرمز | آمریکا، ایران، ترامپ، قیمت نفت و نقشه",
    description: "تنگه هرمز را امروز دنبال کنید — درگیری ایران، اخبار ترامپ، قیمت زنده نفت، نقشه ترافیک کشتی‌ها و شاخص‌های بازار در یک داشبورد لحظه‌ای.",
    keywords: ["تنگه هرمز", "نظارت بر هرمز", "ردیاب هرمز", "نقشه زنده تنگه هرمز", "درگیری آمریکا و ایران", "قیمت زنده نفت", "قیمت نفت WTI", "قیمت نفت برنت", "ترافیک کشتی‌ها", "قیمت بنزین در آمریکا"],
  },
  ja: {
    title: "ホルムズ海峡 今日のニュース | 米国、イラン、トランプ、原油価格、マップ",
    description: "今日のホルムズ海峡をチェック — イランの対立、トランプ氏の最新情報、リアルタイムの原油価格、船舶交通マップ、市場指標を1つのダッシュボードで。",
    keywords: ["ホルムズ海峡", "ホルムズ・モニター", "ホルムズ海峡 トラッカー", "ホルムズ海峡 ライブマップ", "アメリカ イラン 対立", "原油価格 リアルタイム", "WTI原油価格", "ブレント原油価格", "船舶交通", "米国ガソリン価格"],
  },
  es: {
    title: "Noticias del Estrecho de Ormuz | Irán, Trump, Petróleo y Mapa",
    description: "Sigue el Estrecho de Ormuz: conflicto entre Irán y EE. UU., noticias de Trump, precios del petróleo, tráfico marítimo e indicadores del mercado.",
    keywords: ["Estrecho de Ormuz", "Hormuz Monitor", "rastreador de Ormuz", "mapa en vivo Estrecho de Ormuz", "conflicto EE.UU. Irán", "precio del petróleo en vivo", "precio del petróleo WTI", "precio del petróleo Brent", "tráfico de barcos", "precio de la gasolina EE.UU."],
  },
  tr: {
    title: "Hürmüz Boğazı Haberleri | İran, Trump, Petrol ve Harita",
    description: "Hürmüz Boğazı'nı takip edin: İran-ABD çatışması, Trump haberleri, petrol fiyatları, gemi trafiği ve piyasa göstergeleri.",
    keywords: ["Hürmüz Boğazı", "Hürmüz Monitörü", "Hürmüz takip", "Hürmüz Boğazı canlı harita", "ABD İran krizi", "canlı petrol fiyatları", "WTI petrol fiyatı", "Brent petrol fiyatı", "gemi trafiği", "ABD benzin fiyatları"],
  },
  de: {
    title: "Straße von Hormus News Heute | USA, Iran, Trump, Ölpreis & Karte",
    description: "Verfolgen Sie die Straße von Hormus heute — Iran-Konflikt, Trump-Updates, Live-Ölpreis, Schiffsverkehrskarte und Marktindikatoren in einem Echtzeit-Dashboard.",
    keywords: ["Straße von Hormus", "Hormuz Monitor", "Hormus Tracker", "Straße von Hormus Live-Karte", "USA Iran Konflikt", "Ölpreis live", "WTI Ölpreis", "Brent Ölpreis", "Schiffsverkehr", "US Benzinpreise"],
  },
  fr: {
    title: "Actualités du détroit d'Ormuz | Iran, Trump, pétrole et carte",
    description: "Suivez le détroit d'Ormuz : conflit entre l'Iran et les États-Unis, actualités de Trump, prix du pétrole, trafic maritime et indicateurs des marchés.",
    keywords: ["Détroit d'Ormuz", "Hormuz Monitor", "tracker d'Ormuz", "carte en direct Détroit d'Ormuz", "conflit USA Iran", "prix du pétrole en direct", "prix du pétrole WTI", "prix du pétrole Brent", "trafic maritime", "prix de l'essence aux USA"],
  },
  "pt-BR": {
    title: "Notícias do Estreito de Ormuz | Irã, Trump, Petróleo e Mapa",
    description: "Acompanhe o Estreito de Ormuz: conflito entre Irã e EUA, notícias de Trump, preços do petróleo, tráfego de navios e indicadores de mercado.",
    keywords: ["Estreito de Ormuz", "Hormuz Monitor", "rastreador de Ormuz", "mapa ao vivo do Estreito de Ormuz", "conflito EUA Irã", "preço do petróleo ao vivo", "preço do petróleo WTI", "preço do petróleo Brent", "tráfego de navios", "preço da gasolina nos EUA"],
  },
  it: {
    title: "Notizie sullo Stretto di Hormuz Oggi | Iran, Trump, Petrolio e Mappa",
    description: "Segui oggi lo Stretto di Hormuz: conflitto Iran-USA, aggiornamenti su Trump, prezzi del petrolio, traffico navale e indicatori di mercato.",
    keywords: ["Stretto di Hormuz", "Hormuz Monitor", "tracker Hormuz", "mappa in tempo reale Stretto di Hormuz", "conflitto USA Iran", "prezzo petrolio in tempo reale", "prezzo petrolio WTI", "prezzo petrolio Brent", "traffico navale", "prezzo benzina USA"],
  },
  "zh-CN": {
    title: "今日霍尔木兹海峡新闻 | 美国、伊朗、特朗普、油价及地图",
    description: "追踪今日霍尔木兹海峡——在一个实时仪表板中查看伊朗冲突、特朗普最新动态、实时油价、船舶交通地图和市场指标。",
    keywords: ["霍尔木兹海峡", "Hormuz Monitor", "霍尔木兹追踪器", "霍尔木兹海峡实时地图", "美伊冲突", "实时油价", "WTI油价", "布伦特油价", "船舶交通", "美国汽油价格"],
  },
  "zh-TW": {
    title: "今日霍爾木茲海峽新聞 | 美國、伊朗、川普、油價及地圖",
    description: "追蹤今日霍爾木茲海峽——在一個即時儀表板中查看伊朗衝突、川普最新動態、即時油價、船舶交通地圖和市場指標。",
    keywords: ["霍爾木茲海峽", "Hormuz Monitor", "霍爾木茲追蹤器", "霍爾木茲海峽即時地圖", "美伊衝突", "即時油價", "WTI油價", "布倫特油價", "船舶交通", "美國汽油價格"],
  },
  ru: {
    title: "Новости Ормузского пролива | Иран, Трамп, нефть и суда",
    description: "Следите за Ормузским проливом: конфликт Ирана и США, новости о Трампе, цены на нефть, движение судов и рыночные показатели.",
    keywords: ["Ормузский пролив", "Hormuz Monitor", "трекер Ормуза", "Ормузский пролив живая карта", "конфликт США и Ирана", "цены на нефть онлайн", "цена нефти WTI", "цена нефти Brent", "движение судов", "цены на бензин в США"],
  },
};
