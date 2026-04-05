/**
 * TDHP — Tekdüzen Hesap Planı (Turkish Uniform Chart of Accounts)
 *
 * Full seed data for codes 100–899 following the Turkish accounting standard.
 * These are system-wide template accounts (company_id = NULL).
 * When a company is created, accounts are copied from this template.
 *
 * Account types: asset | liability | equity | revenue | expense
 * Normal balance: debit (assets, expenses) | credit (liabilities, equity, revenue)
 */

export interface TdhpAccount {
  code: string;
  name: string;
  accountType: "asset" | "liability" | "equity" | "revenue" | "expense";
  normalBalance: "debit" | "credit";
  parentCode: string | null;
}

/** Derive normal_balance from account_type per double-entry bookkeeping */
function nb(
  type: TdhpAccount["accountType"]
): TdhpAccount["normalBalance"] {
  return type === "asset" || type === "expense" ? "debit" : "credit";
}

/** Derive parent_code from code: '100.01' → '100', '100' → null */
function pc(code: string): string | null {
  const dot = code.lastIndexOf(".");
  return dot > 0 ? code.substring(0, dot) : null;
}

/** Create an account entry with auto-derived normal_balance and parent_code */
function a(
  code: string,
  name: string,
  accountType: TdhpAccount["accountType"]
): TdhpAccount {
  return { code, name, accountType, normalBalance: nb(accountType), parentCode: pc(code) };
}

/**
 * Full TDHP account list (~200 accounts).
 * Organized by top-level group per Turkish accounting standard.
 */
export const TDHP_ACCOUNTS: TdhpAccount[] = [
  // =========================================================================
  // 1xx — Dönen Varlıklar (Current Assets)
  // =========================================================================
  a("100", "Kasa", "asset"),
  a("100.01", "TL Kasası", "asset"),
  a("100.02", "Döviz Kasası", "asset"),
  a("101", "Alınan Çekler", "asset"),
  a("102", "Bankalar", "asset"),
  a("102.01", "Vadesiz Mevduat — TL", "asset"),
  a("102.02", "Vadesiz Mevduat — Döviz", "asset"),
  a("102.03", "Vadeli Mevduat — TL", "asset"),
  a("102.04", "Vadeli Mevduat — Döviz", "asset"),
  a("103", "Verilen Çekler ve Ödeme Emirleri (−)", "asset"),
  a("108", "Diğer Hazır Değerler", "asset"),
  a("110", "Hisse Senetleri", "asset"),
  a("111", "Özel Kesim Tahvil, Senet ve Bonoları", "asset"),
  a("112", "Kamu Kesimi Tahvil, Senet ve Bonoları", "asset"),
  a("118", "Diğer Menkul Kıymetler", "asset"),
  a("119", "Menkul Kıymetler Değer Düşüklüğü Karşılığı (−)", "asset"),
  a("120", "Alıcılar", "asset"),
  a("120.01", "Yurt İçi Alıcılar", "asset"),
  a("120.02", "Yurt Dışı Alıcılar", "asset"),
  a("121", "Alacak Senetleri", "asset"),
  a("122", "Alacak Senetleri Reeskontu (−)", "asset"),
  a("126", "Verilen Depozito ve Teminatlar", "asset"),
  a("127", "Diğer Ticari Alacaklar", "asset"),
  a("128", "Şüpheli Ticari Alacaklar", "asset"),
  a("129", "Şüpheli Ticari Alacaklar Karşılığı (−)", "asset"),
  a("131", "Ortaklardan Alacaklar", "asset"),
  a("132", "İştiraklerden Alacaklar", "asset"),
  a("133", "Bağlı Ortaklıklardan Alacaklar", "asset"),
  a("135", "Personelden Alacaklar", "asset"),
  a("136", "Diğer Çeşitli Alacaklar", "asset"),
  a("137", "Diğer Alacak Senetleri Reeskontu (−)", "asset"),
  a("138", "Şüpheli Diğer Alacaklar", "asset"),
  a("139", "Şüpheli Diğer Alacaklar Karşılığı (−)", "asset"),
  a("150", "İlk Madde ve Malzeme", "asset"),
  a("151", "Yarı Mamuller — Üretim", "asset"),
  a("152", "Mamuller", "asset"),
  a("153", "Ticari Mallar", "asset"),
  a("157", "Diğer Stoklar", "asset"),
  a("158", "Stok Değer Düşüklüğü Karşılığı (−)", "asset"),
  a("159", "Verilen Sipariş Avansları", "asset"),
  a("170", "Yıllara Yaygın İnşaat ve Onarım Maliyetleri", "asset"),
  a("171", "Yıllara Yaygın İnşaat Enflasyon Düzeltme Hesabı", "asset"),
  a("178", "Yıllara Yaygın İnşaat ve Onarım Hakediş Bedelleri (−)", "asset"),
  a("179", "Taşeronlara Verilen Avanslar", "asset"),
  a("180", "Gelecek Aylara Ait Giderler", "asset"),
  a("181", "Gelir Tahakkukları", "asset"),
  a("190", "Devreden KDV", "asset"),
  a("191", "İndirilecek KDV", "asset"),
  a("192", "Diğer KDV", "asset"),
  a("193", "Peşin Ödenen Vergiler ve Fonlar", "asset"),
  a("195", "İş Avansları", "asset"),
  a("196", "Personel Avansları", "asset"),
  a("197", "Sayım ve Tesellüm Noksanları", "asset"),
  a("199", "Diğer Dönen Varlıklar", "asset"),

  // =========================================================================
  // 2xx — Duran Varlıklar (Fixed Assets)
  // =========================================================================
  a("220", "Alıcılar (Uzun Vadeli)", "asset"),
  a("221", "Alacak Senetleri (Uzun Vadeli)", "asset"),
  a("222", "Alacak Senetleri Reeskontu (−) (UV)", "asset"),
  a("226", "Verilen Depozito ve Teminatlar (UV)", "asset"),
  a("229", "Şüpheli Alacaklar Karşılığı (−) (UV)", "asset"),
  a("240", "Bağlı Menkul Kıymetler", "asset"),
  a("241", "Bağlı Menkul Kıymetler Değer Düşüklüğü Karşılığı (−)", "asset"),
  a("242", "İştirakler", "asset"),
  a("243", "İştiraklere Sermaye Taahhütleri (−)", "asset"),
  a("244", "İştirakler Sermaye Payları Değer Düşüklüğü Karşılığı (−)", "asset"),
  a("245", "Bağlı Ortaklıklar", "asset"),
  a("246", "Bağlı Ortaklıklara Sermaye Taahhütleri (−)", "asset"),
  a("247", "Bağlı Ortaklıklar Sermaye Payları Değer Düşüklüğü Karşılığı (−)", "asset"),
  a("248", "Diğer Mali Duran Varlıklar", "asset"),
  a("249", "Diğer Mali Duran Varlıklar Karşılığı (−)", "asset"),
  a("250", "Arazi ve Arsalar", "asset"),
  a("251", "Yeraltı ve Yerüstü Düzenleri", "asset"),
  a("252", "Binalar", "asset"),
  a("253", "Tesis, Makine ve Cihazlar", "asset"),
  a("254", "Taşıtlar", "asset"),
  a("255", "Demirbaşlar", "asset"),
  a("256", "Diğer Maddi Duran Varlıklar", "asset"),
  a("257", "Birikmiş Amortismanlar (−)", "asset"),
  a("258", "Yapılmakta Olan Yatırımlar", "asset"),
  a("259", "Verilen Avanslar (Yatırımlar)", "asset"),
  a("260", "Haklar", "asset"),
  a("261", "Şerefiye", "asset"),
  a("262", "Kuruluş ve Örgütlenme Giderleri", "asset"),
  a("263", "Araştırma ve Geliştirme Giderleri", "asset"),
  a("264", "Özel Maliyetler", "asset"),
  a("267", "Diğer Maddi Olmayan Duran Varlıklar", "asset"),
  a("268", "Birikmiş Amortismanlar (−) (MODV)", "asset"),
  a("271", "Arama Giderleri", "asset"),
  a("272", "Hazırlık ve Geliştirme Giderleri", "asset"),
  a("278", "Diğer Özel Tükenmeye Tabi Varlıklar", "asset"),
  a("279", "Birikmiş Tükenme Payları (−)", "asset"),
  a("280", "Gelecek Yıllara Ait Giderler", "asset"),
  a("281", "Gelir Tahakkukları (UV)", "asset"),
  a("291", "Gelecek Yıllarda İndirilecek KDV", "asset"),
  a("292", "Diğer KDV (UV)", "asset"),
  a("293", "Gelecek Yıllar İhtiyacı Stoklar", "asset"),
  a("294", "Elden Çıkarılacak Stoklar ve Maddi Duran Varlıklar", "asset"),
  a("295", "Peşin Ödenen Vergiler ve Fonlar (UV)", "asset"),
  a("299", "Diğer Duran Varlıklar", "asset"),

  // =========================================================================
  // 3xx — Kısa Vadeli Yabancı Kaynaklar (Current Liabilities)
  // =========================================================================
  a("300", "Banka Kredileri", "liability"),
  a("301", "Finansal Kiralama İşlemlerinden Borçlar", "liability"),
  a("302", "Ertelenmiş Finansal Kiralama Borçlanma Maliyetleri (−)", "liability"),
  a("303", "Uzun Vadeli Kredilerin Anapara Taksitleri ve Faizleri", "liability"),
  a("304", "Tahvil Anapara Borç, Taksit ve Faizleri", "liability"),
  a("305", "Çıkarılmış Bonolar ve Senetler", "liability"),
  a("309", "Diğer Mali Borçlar", "liability"),
  a("320", "Satıcılar", "liability"),
  a("320.01", "Yurt İçi Satıcılar", "liability"),
  a("320.02", "Yurt Dışı Satıcılar", "liability"),
  a("321", "Borç Senetleri", "liability"),
  a("322", "Borç Senetleri Reeskontu (−)", "liability"),
  a("326", "Alınan Depozito ve Teminatlar", "liability"),
  a("329", "Diğer Ticari Borçlar", "liability"),
  a("331", "Ortaklara Borçlar", "liability"),
  a("332", "İştiraklere Borçlar", "liability"),
  a("333", "Bağlı Ortaklıklara Borçlar", "liability"),
  a("335", "Personele Borçlar", "liability"),
  a("336", "Diğer Çeşitli Borçlar", "liability"),
  a("337", "Diğer Borç Senetleri Reeskontu (−)", "liability"),
  a("340", "Alınan Sipariş Avansları", "liability"),
  a("350", "Yıllara Yaygın İnşaat ve Onarım Hakediş Bedelleri", "liability"),
  a("351", "Yıllara Yaygın İnşaat Enflasyon Düzeltme Hesabı (UV)", "liability"),
  a("360", "Ödenecek Vergiler ve Fonlar", "liability"),
  a("361", "Ödenecek Sosyal Güvenlik Kesintileri", "liability"),
  a("368", "Vadesi Geçmiş, Ertelenmiş veya Taksitlendirilmiş Vergiler", "liability"),
  a("369", "Ödenecek Diğer Yükümlülükler", "liability"),
  a("370", "Dönem Karı Vergi ve Diğer Yasal Yükümlülük Karşılıkları", "liability"),
  a("371", "Dönem Karının Peşin Ödenen Vergi ve Diğer Yükümlülükleri (−)", "liability"),
  a("372", "Kıdem Tazminatı Karşılığı", "liability"),
  a("373", "Maliyet Giderleri Karşılığı", "liability"),
  a("379", "Diğer Borç ve Gider Karşılıkları", "liability"),
  a("380", "Gelecek Aylara Ait Gelirler", "liability"),
  a("381", "Gider Tahakkukları", "liability"),
  a("391", "Hesaplanan KDV", "liability"),
  a("392", "Diğer KDV (Borç)", "liability"),
  a("397", "Sayım ve Tesellüm Fazlaları", "liability"),
  a("399", "Diğer Kısa Vadeli Yabancı Kaynaklar", "liability"),

  // =========================================================================
  // 4xx — Uzun Vadeli Yabancı Kaynaklar (Long-Term Liabilities)
  // =========================================================================
  a("400", "Banka Kredileri (UV)", "liability"),
  a("401", "Finansal Kiralama İşlemlerinden Borçlar (UV)", "liability"),
  a("402", "Ertelenmiş Finansal Kiralama Borçlanma Maliyetleri (−) (UV)", "liability"),
  a("405", "Çıkarılmış Tahviller", "liability"),
  a("407", "Çıkarılmış Diğer Menkul Kıymetler", "liability"),
  a("408", "Menkul Kıymetler İhraç Farkı (−)", "liability"),
  a("409", "Diğer Mali Borçlar (UV)", "liability"),
  a("420", "Satıcılar (UV)", "liability"),
  a("421", "Borç Senetleri (UV)", "liability"),
  a("422", "Borç Senetleri Reeskontu (−) (UV)", "liability"),
  a("426", "Alınan Depozito ve Teminatlar (UV)", "liability"),
  a("429", "Diğer Ticari Borçlar (UV)", "liability"),
  a("431", "Ortaklara Borçlar (UV)", "liability"),
  a("432", "İştiraklere Borçlar (UV)", "liability"),
  a("433", "Bağlı Ortaklıklara Borçlar (UV)", "liability"),
  a("436", "Diğer Çeşitli Borçlar (UV)", "liability"),
  a("437", "Diğer Borç Senetleri Reeskontu (−) (UV)", "liability"),
  a("438", "Kamuya Olan Ertelenmiş veya Taksitlendirilmiş Borçlar", "liability"),
  a("440", "Alınan Sipariş Avansları (UV)", "liability"),
  a("472", "Kıdem Tazminatı Karşılığı (UV)", "liability"),
  a("479", "Diğer Borç ve Gider Karşılıkları (UV)", "liability"),
  a("480", "Gelecek Yıllara Ait Gelirler", "liability"),
  a("481", "Gider Tahakkukları (UV)", "liability"),
  a("492", "Gelecek Yıllara Ertelenen veya Terkin Edilecek KDV", "liability"),
  a("499", "Diğer Uzun Vadeli Yabancı Kaynaklar", "liability"),

  // =========================================================================
  // 5xx — Özkaynaklar (Equity)
  // =========================================================================
  a("500", "Sermaye", "equity"),
  a("501", "Ödenmemiş Sermaye (−)", "equity"),
  a("502", "Sermaye Düzeltmesi Olumlu Farkları", "equity"),
  a("503", "Sermaye Düzeltmesi Olumsuz Farkları (−)", "equity"),
  a("520", "Hisse Senetleri İhraç Primleri", "equity"),
  a("521", "Hisse Senedi İptal Karları", "equity"),
  a("522", "Maddi Duran Varlık Yeniden Değerleme Artışları", "equity"),
  a("523", "İştirakler Yeniden Değerleme Artışları", "equity"),
  a("529", "Diğer Sermaye Yedekleri", "equity"),
  a("540", "Yasal Yedekler", "equity"),
  a("541", "Statü Yedekleri", "equity"),
  a("542", "Olağanüstü Yedekler", "equity"),
  a("548", "Diğer Kar Yedekleri", "equity"),
  a("549", "Özel Fonlar", "equity"),
  a("570", "Geçmiş Yıllar Karları", "equity"),
  a("580", "Geçmiş Yıllar Zararları (−)", "equity"),
  a("590", "Dönem Net Karı", "equity"),
  a("591", "Dönem Net Zararı (−)", "equity"),

  // =========================================================================
  // 6xx — Gelirler & Giderler (Revenue & Expenses)
  // =========================================================================
  a("600", "Yurt İçi Satışlar", "revenue"),
  a("601", "Yurt Dışı Satışlar", "revenue"),
  a("602", "Diğer Gelirler", "revenue"),
  a("610", "Satıştan İadeler (−)", "revenue"),
  a("611", "Satış İskontoları (−)", "revenue"),
  a("612", "Diğer İndirimler (−)", "revenue"),
  a("620", "Satılan Mamuller Maliyeti (−)", "expense"),
  a("621", "Satılan Ticari Mallar Maliyeti (−)", "expense"),
  a("622", "Satılan Hizmet Maliyeti (−)", "expense"),
  a("623", "Diğer Satışların Maliyeti (−)", "expense"),
  a("630", "Araştırma ve Geliştirme Giderleri", "expense"),
  a("631", "Pazarlama, Satış ve Dağıtım Giderleri", "expense"),
  a("632", "Genel Yönetim Giderleri", "expense"),
  a("640", "İştiraklerden Temettü Gelirleri", "revenue"),
  a("641", "Bağlı Ortaklıklardan Temettü Gelirleri", "revenue"),
  a("642", "Faiz Gelirleri", "revenue"),
  a("643", "Komisyon Gelirleri", "revenue"),
  a("644", "Konusu Kalmayan Karşılıklar", "revenue"),
  a("645", "Menkul Kıymet Satış Karları", "revenue"),
  a("646", "Kambiyo Karları", "revenue"),
  a("647", "Reeskont Faiz Gelirleri", "revenue"),
  a("648", "Enflasyon Düzeltmesi Karları", "revenue"),
  a("649", "Diğer Olağan Gelir ve Karlar", "revenue"),
  a("654", "Karşılık Giderleri", "expense"),
  a("655", "Menkul Kıymet Satış Zararları", "expense"),
  a("656", "Kambiyo Zararları", "expense"),
  a("657", "Reeskont Faiz Giderleri", "expense"),
  a("658", "Enflasyon Düzeltmesi Zararları", "expense"),
  a("659", "Diğer Olağan Gider ve Zararlar", "expense"),
  a("660", "Kısa Vadeli Borçlanma Giderleri", "expense"),
  a("661", "Uzun Vadeli Borçlanma Giderleri", "expense"),
  a("671", "Önceki Dönem Gelir ve Karları", "revenue"),
  a("679", "Diğer Olağandışı Gelir ve Karlar", "revenue"),
  a("680", "Çalışmayan Kısım Gider ve Zararları", "expense"),
  a("681", "Önceki Dönem Gider ve Zararları", "expense"),
  a("689", "Diğer Olağandışı Gider ve Zararlar", "expense"),
  a("690", "Dönem Karı veya Zararı", "equity"),
  a("691", "Dönem Karı Vergi ve Diğer Yasal Yükümlülük Karşılıkları (−)", "expense"),
  a("692", "Dönem Net Karı veya Zararı", "equity"),

  // =========================================================================
  // 7xx — Maliyet Hesapları (Cost Accounts)
  // =========================================================================
  a("700", "Maliyet Muhasebesi Bağlantı Hesabı", "expense"),
  a("701", "Maliyet Muhasebesi Yansıtma Hesabı", "expense"),
  a("710", "Direkt İlk Madde ve Malzeme Giderleri", "expense"),
  a("711", "Direkt İlk Madde ve Malzeme Yansıtma Hesabı", "expense"),
  a("712", "Direkt İlk Madde ve Malzeme Fiyat Farkı", "expense"),
  a("713", "Direkt İlk Madde ve Malzeme Miktar Farkı", "expense"),
  a("720", "Direkt İşçilik Giderleri", "expense"),
  a("721", "Direkt İşçilik Giderleri Yansıtma Hesabı", "expense"),
  a("722", "Direkt İşçilik Ücret Farkları", "expense"),
  a("723", "Direkt İşçilik Süre Farkları", "expense"),
  a("730", "Genel Üretim Giderleri", "expense"),
  a("731", "Genel Üretim Giderleri Yansıtma Hesabı", "expense"),
  a("732", "Genel Üretim Giderleri Bütçe Farkları", "expense"),
  a("733", "Genel Üretim Giderleri Verimlilik Farkları", "expense"),
  a("734", "Genel Üretim Giderleri Kapasite Farkları", "expense"),
  a("740", "Hizmet Üretim Maliyeti", "expense"),
  a("741", "Hizmet Üretim Maliyeti Yansıtma Hesabı", "expense"),
  a("742", "Hizmet Üretim Maliyeti Fark Hesapları", "expense"),
  a("750", "Araştırma ve Geliştirme Giderleri (Maliyet)", "expense"),
  a("751", "Araştırma ve Geliştirme Giderleri Yansıtma Hesabı", "expense"),
  a("752", "Araştırma ve Geliştirme Gider Farkları", "expense"),
  a("760", "Pazarlama, Satış ve Dağıtım Giderleri (Maliyet)", "expense"),
  a("761", "Pazarlama, Satış ve Dağıtım Giderleri Yansıtma Hesabı", "expense"),
  a("762", "Pazarlama, Satış ve Dağıtım Gider Farkları", "expense"),
  a("770", "Genel Yönetim Giderleri (Maliyet)", "expense"),
  a("771", "Genel Yönetim Giderleri Yansıtma Hesabı", "expense"),
  a("772", "Genel Yönetim Gider Farkları", "expense"),
  a("780", "Finansman Giderleri (Maliyet)", "expense"),
  a("781", "Finansman Giderleri Yansıtma Hesabı", "expense"),
  a("782", "Finansman Giderleri Fark Hesabı", "expense"),

  // =========================================================================
  // 8xx — Serbest (Reserved / Off-Balance-Sheet)
  // =========================================================================
  a("800", "Alınan Teminat Mektupları", "asset"),
  a("805", "Verilen Teminat Mektupları", "liability"),
  a("810", "Alınan Garantiler", "asset"),
  a("815", "Verilen Garantiler", "liability"),
  a("830", "Alınan Taahhütler", "asset"),
  a("835", "Verilen Taahhütler", "liability"),
  a("890", "Nazım Hesabı Alacak Kalanları", "asset"),
  a("895", "Nazım Hesabı Borç Kalanları", "liability"),
];
