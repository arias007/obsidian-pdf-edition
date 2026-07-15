import { Notice, Plugin, PluginSettingTab, Setting, TFile, WorkspaceLeaf, setIcon } from "obsidian";
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFString, degrees, rgb } from "pdf-lib";

// Mobile WebViews do not expose Obsidian desktop-only activeWindow globals.
const activeWindow = window;
const activeDocument = document;

type ToolMode = "select" | "pen" | "highlight" | "eraser" | "text" | "cover" | "image-crop";
type ResizeHandle = "nw" | "ne" | "sw" | "se";
type PdfFontkitModule = typeof import("@pdf-lib/fontkit");

const AUTO_SAVE_IDLE_DELAY_MS = 5200;
const AUTO_SAVE_CLOSE_DELAY_MS = 200;
const OVERLAY_HEALTH_CHECK_MS = 5000;
const OVERLAY_MAX_DPR = 2;
const PDF_ZOOM_SETTLE_DELAY_MS = 160;
const INK_AUTO_GROUP_GAP_PX = 28;
const INK_AUTO_GROUP_WINDOW_MS = 3500;
const INK_LEGACY_GROUP_GAP_PX = 10;
const NATIVE_POPUP_SUPPRESS_MS = 650;
const STROKE_FAST_SAVE_DELAY_MS = 180;
const STROKE_MIN_POINT_DISTANCE_PX = 0.35;
const STROKE_INTERPOLATION_STEP_PX = 0.75;
let pdfFontkitModulePromise: Promise<PdfFontkitModule> | null = null;
const PALETTE_COLORS = [
  "#000000",
  "#e03131",
  "#fab005",
  "#2f9e44",
  "#1971c2"
];
const PDFTION_AI_API_NAME = "PdftionAI";
const TEXT_FONTS = [
  { labelEn: "Default", labelZh: "默认", value: "sans-serif" },
  { labelEn: "Serif CJK", labelZh: "宋体", value: "SimSun, STSong, serif" },
  { labelEn: "Sans CJK", labelZh: "黑体", value: "SimHei, Microsoft YaHei, sans-serif" },
  { labelEn: "Mono", labelZh: "等宽", value: "Consolas, monospace" },
  { labelEn: "Serif", labelZh: "衬线", value: "Georgia, serif" }
];
const TEXT_SELECTION_HIGHLIGHT_COLORS = ["#ffe066", "#ff8787", "#69db7c", "#74c0fc"];
type PdftionLocale = "ar" | "de" | "en" | "es" | "fr" | "id" | "ja" | "ko" | "pt" | "ru" | "tr" | "vi" | "zh";
const PDFTION_TRANSLATIONS: Partial<Record<PdftionLocale, Record<string, string>>> = {
  ar: {
    "Alpha": "الشفافية",
    "Cancel": "إلغاء",
    "Close": "إغلاق",
    "Color and size": "اللون والحجم",
    "Confirm": "تأكيد",
    "Convert docs": "تحويل المستندات",
    "Copied PDF text link.": "تم نسخ رابط نص PDF.",
    "Copied PDF text.": "تم نسخ نص PDF.",
    "Copy PDF link": "نسخ رابط PDF",
    "Copy text": "نسخ النص",
    "Could not copy link.": "تعذر نسخ الرابط.",
    "Could not copy text.": "تعذر نسخ النص.",
    "Crop": "قص",
    "Custom color": "لون مخصص",
    "Custom highlight": "تمييز مخصص",
    "Delete pages": "حذف الصفحات",
    "Delete selection/clear annotations": "حذف التحديد/مسح التعليقات",
    "Eraser": "ممحاة",
    "Export DOCX": "تصدير DOCX",
    "Export MD": "تصدير MD",
    "Export PDF": "تصدير PDF",
    "Font": "الخط",
    "Highlight": "تمييز",
    "Highlighter": "قلم تمييز",
    "Image": "صورة",
    "Import PDF": "استيراد PDF",
    "Insert image": "إدراج صورة",
    "Insert link": "إدراج رابط",
    "Loading pages...": "جار تحميل الصفحات...",
    "Move toolbar": "نقل شريط الأدوات",
    "Open a PDF first.": "افتح ملف PDF أولا.",
    "PDF annotation": "تعليقات PDF",
    "PDF annotation enabled.": "تم تفعيل تعليقات PDF.",
    "Page/annotation navigator": "تنقل الصفحات/التعليقات",
    "Pen": "قلم",
    "Redo": "إعادة",
    "Reorder": "إعادة ترتيب",
    "Rotate": "تدوير",
    "Select": "تحديد",
    "Share/export": "مشاركة/تصدير",
    "Size": "الحجم",
    "Text": "نص",
    "Undo": "تراجع"
  },
  de: {
    "Alpha": "Deckkraft",
    "Cancel": "Abbrechen",
    "Close": "Schließen",
    "Color and size": "Farbe und Größe",
    "Confirm": "Bestätigen",
    "Convert docs": "Dokumente umwandeln",
    "Copied PDF text link.": "PDF-Textlink kopiert.",
    "Copied PDF text.": "PDF-Text kopiert.",
    "Copy PDF link": "PDF-Link kopieren",
    "Copy text": "Text kopieren",
    "Could not copy link.": "Link konnte nicht kopiert werden.",
    "Could not copy text.": "Text konnte nicht kopiert werden.",
    "Crop": "Zuschneiden",
    "Custom color": "Eigene Farbe",
    "Custom highlight": "Eigene Markierung",
    "Delete pages": "Seiten löschen",
    "Delete selection/clear annotations": "Auswahl löschen/Anmerkungen leeren",
    "Eraser": "Radierer",
    "Export DOCX": "DOCX exportieren",
    "Export MD": "MD exportieren",
    "Export PDF": "PDF exportieren",
    "Font": "Schrift",
    "Highlight": "Markieren",
    "Highlighter": "Marker",
    "Image": "Bild",
    "Import PDF": "PDF importieren",
    "Insert image": "Bild einfügen",
    "Insert link": "Link einfügen",
    "Loading pages...": "Seiten werden geladen...",
    "Move toolbar": "Werkzeugleiste verschieben",
    "Open a PDF first.": "Öffne zuerst ein PDF.",
    "PDF annotation": "PDF-Anmerkung",
    "PDF annotation enabled.": "PDF-Anmerkung aktiviert.",
    "Page/annotation navigator": "Seiten-/Anmerkungsnavigator",
    "Pen": "Stift",
    "Redo": "Wiederholen",
    "Reorder": "Neu anordnen",
    "Rotate": "Drehen",
    "Select": "Auswählen",
    "Share/export": "Teilen/exportieren",
    "Size": "Größe",
    "Text": "Text",
    "Undo": "Rückgängig"
  },
  es: {
    "Alpha": "Opacidad",
    "Cancel": "Cancelar",
    "Close": "Cerrar",
    "Color and size": "Color y tamaño",
    "Confirm": "Confirmar",
    "Convert docs": "Convertir documentos",
    "Copied PDF text link.": "Enlace de texto PDF copiado.",
    "Copied PDF text.": "Texto PDF copiado.",
    "Copy PDF link": "Copiar enlace PDF",
    "Copy text": "Copiar texto",
    "Could not copy link.": "No se pudo copiar el enlace.",
    "Could not copy text.": "No se pudo copiar el texto.",
    "Crop": "Recortar",
    "Custom color": "Color personalizado",
    "Custom highlight": "Resaltado personalizado",
    "Delete pages": "Eliminar páginas",
    "Delete selection/clear annotations": "Eliminar selección/borrar anotaciones",
    "Eraser": "Borrador",
    "Export DOCX": "Exportar DOCX",
    "Export MD": "Exportar MD",
    "Export PDF": "Exportar PDF",
    "Font": "Fuente",
    "Highlight": "Resaltar",
    "Highlighter": "Marcador",
    "Image": "Imagen",
    "Import PDF": "Importar PDF",
    "Insert image": "Insertar imagen",
    "Insert link": "Insertar enlace",
    "Loading pages...": "Cargando páginas...",
    "Move toolbar": "Mover barra",
    "Open a PDF first.": "Abre primero un PDF.",
    "PDF annotation": "Anotación PDF",
    "PDF annotation enabled.": "Anotación PDF activada.",
    "Page/annotation navigator": "Navegador de páginas/anotaciones",
    "Pen": "Lápiz",
    "Redo": "Rehacer",
    "Reorder": "Reordenar",
    "Rotate": "Rotar",
    "Select": "Seleccionar",
    "Share/export": "Compartir/exportar",
    "Size": "Tamaño",
    "Text": "Texto",
    "Undo": "Deshacer"
  },
  fr: {
    "Alpha": "Opacité",
    "Cancel": "Annuler",
    "Close": "Fermer",
    "Color and size": "Couleur et taille",
    "Confirm": "Confirmer",
    "Convert docs": "Convertir les documents",
    "Copied PDF text link.": "Lien du texte PDF copié.",
    "Copied PDF text.": "Texte PDF copié.",
    "Copy PDF link": "Copier le lien PDF",
    "Copy text": "Copier le texte",
    "Could not copy link.": "Impossible de copier le lien.",
    "Could not copy text.": "Impossible de copier le texte.",
    "Crop": "Rogner",
    "Custom color": "Couleur personnalisée",
    "Custom highlight": "Surlignage personnalisé",
    "Delete pages": "Supprimer les pages",
    "Delete selection/clear annotations": "Supprimer la sélection/effacer les annotations",
    "Eraser": "Gomme",
    "Export DOCX": "Exporter DOCX",
    "Export MD": "Exporter MD",
    "Export PDF": "Exporter PDF",
    "Font": "Police",
    "Highlight": "Surligner",
    "Highlighter": "Surligneur",
    "Image": "Image",
    "Import PDF": "Importer PDF",
    "Insert image": "Insérer une image",
    "Insert link": "Insérer un lien",
    "Loading pages...": "Chargement des pages...",
    "Move toolbar": "Déplacer la barre",
    "Open a PDF first.": "Ouvrez d'abord un PDF.",
    "PDF annotation": "Annotation PDF",
    "PDF annotation enabled.": "Annotation PDF activée.",
    "Page/annotation navigator": "Navigation pages/annotations",
    "Pen": "Stylo",
    "Redo": "Rétablir",
    "Reorder": "Réordonner",
    "Rotate": "Pivoter",
    "Select": "Sélectionner",
    "Share/export": "Partager/exporter",
    "Size": "Taille",
    "Text": "Texte",
    "Undo": "Annuler"
  },
  id: {
    "Alpha": "Opasitas",
    "Cancel": "Batal",
    "Close": "Tutup",
    "Color and size": "Warna dan ukuran",
    "Confirm": "Konfirmasi",
    "Convert docs": "Konversi dokumen",
    "Copied PDF text link.": "Tautan teks PDF disalin.",
    "Copied PDF text.": "Teks PDF disalin.",
    "Copy PDF link": "Salin tautan PDF",
    "Copy text": "Salin teks",
    "Could not copy link.": "Gagal menyalin tautan.",
    "Could not copy text.": "Gagal menyalin teks.",
    "Crop": "Pangkas",
    "Custom color": "Warna khusus",
    "Custom highlight": "Sorotan khusus",
    "Delete pages": "Hapus halaman",
    "Delete selection/clear annotations": "Hapus pilihan/bersihkan anotasi",
    "Eraser": "Penghapus",
    "Export DOCX": "Ekspor DOCX",
    "Export MD": "Ekspor MD",
    "Export PDF": "Ekspor PDF",
    "Font": "Font",
    "Highlight": "Sorot",
    "Highlighter": "Penyorot",
    "Image": "Gambar",
    "Import PDF": "Impor PDF",
    "Insert image": "Sisipkan gambar",
    "Insert link": "Sisipkan tautan",
    "Loading pages...": "Memuat halaman...",
    "Move toolbar": "Pindahkan bilah alat",
    "Open a PDF first.": "Buka PDF terlebih dahulu.",
    "PDF annotation": "Anotasi PDF",
    "PDF annotation enabled.": "Anotasi PDF aktif.",
    "Page/annotation navigator": "Navigasi halaman/anotasi",
    "Pen": "Pena",
    "Redo": "Ulangi",
    "Reorder": "Susun ulang",
    "Rotate": "Putar",
    "Select": "Pilih",
    "Share/export": "Bagikan/ekspor",
    "Size": "Ukuran",
    "Text": "Teks",
    "Undo": "Urungkan"
  },
  ja: {
    "Alpha": "不透明度",
    "Cancel": "キャンセル",
    "Close": "閉じる",
    "Color and size": "色とサイズ",
    "Confirm": "確認",
    "Convert docs": "文書変換",
    "Copied PDF text link.": "PDFテキストリンクをコピーしました。",
    "Copied PDF text.": "PDFテキストをコピーしました。",
    "Copy PDF link": "PDFリンクをコピー",
    "Copy text": "テキストをコピー",
    "Could not copy link.": "リンクをコピーできません。",
    "Could not copy text.": "テキストをコピーできません。",
    "Crop": "切り抜き",
    "Custom color": "カスタム色",
    "Custom highlight": "カスタムハイライト",
    "Delete pages": "ページ削除",
    "Delete selection/clear annotations": "選択削除/注釈クリア",
    "Eraser": "消しゴム",
    "Export DOCX": "DOCX出力",
    "Export MD": "MD出力",
    "Export PDF": "PDF出力",
    "Font": "フォント",
    "Highlight": "ハイライト",
    "Highlighter": "蛍光ペン",
    "Image": "画像",
    "Import PDF": "PDF取り込み",
    "Insert image": "画像を挿入",
    "Insert link": "リンクを挿入",
    "Loading pages...": "ページを読み込み中...",
    "Move toolbar": "ツールバーを移動",
    "Open a PDF first.": "先にPDFを開いてください。",
    "PDF annotation": "PDF注釈",
    "PDF annotation enabled.": "PDF注釈を有効にしました。",
    "Page/annotation navigator": "ページ/注釈ナビ",
    "Pen": "ペン",
    "Redo": "やり直し",
    "Reorder": "並べ替え",
    "Rotate": "回転",
    "Select": "選択",
    "Share/export": "共有/出力",
    "Size": "サイズ",
    "Text": "テキスト",
    "Undo": "元に戻す"
  },
  ko: {
    "Alpha": "투명도",
    "Cancel": "취소",
    "Close": "닫기",
    "Color and size": "색상과 크기",
    "Confirm": "확인",
    "Convert docs": "문서 변환",
    "Copied PDF text link.": "PDF 텍스트 링크를 복사했습니다.",
    "Copied PDF text.": "PDF 텍스트를 복사했습니다.",
    "Copy PDF link": "PDF 링크 복사",
    "Copy text": "텍스트 복사",
    "Could not copy link.": "링크를 복사할 수 없습니다.",
    "Could not copy text.": "텍스트를 복사할 수 없습니다.",
    "Crop": "자르기",
    "Custom color": "사용자 색상",
    "Custom highlight": "사용자 하이라이트",
    "Delete pages": "페이지 삭제",
    "Delete selection/clear annotations": "선택 삭제/주석 지우기",
    "Eraser": "지우개",
    "Export DOCX": "DOCX 내보내기",
    "Export MD": "MD 내보내기",
    "Export PDF": "PDF 내보내기",
    "Font": "글꼴",
    "Highlight": "하이라이트",
    "Highlighter": "형광펜",
    "Image": "이미지",
    "Import PDF": "PDF 가져오기",
    "Insert image": "이미지 삽입",
    "Insert link": "링크 삽입",
    "Loading pages...": "페이지 로드 중...",
    "Move toolbar": "도구막대 이동",
    "Open a PDF first.": "먼저 PDF를 여세요.",
    "PDF annotation": "PDF 주석",
    "PDF annotation enabled.": "PDF 주석이 켜졌습니다.",
    "Page/annotation navigator": "페이지/주석 탐색",
    "Pen": "펜",
    "Redo": "다시 실행",
    "Reorder": "재정렬",
    "Rotate": "회전",
    "Select": "선택",
    "Share/export": "공유/내보내기",
    "Size": "크기",
    "Text": "텍스트",
    "Undo": "실행 취소"
  },
  pt: {
    "Alpha": "Opacidade",
    "Cancel": "Cancelar",
    "Close": "Fechar",
    "Color and size": "Cor e tamanho",
    "Confirm": "Confirmar",
    "Convert docs": "Converter documentos",
    "Copied PDF text link.": "Link de texto PDF copiado.",
    "Copied PDF text.": "Texto PDF copiado.",
    "Copy PDF link": "Copiar link PDF",
    "Copy text": "Copiar texto",
    "Could not copy link.": "Não foi possível copiar o link.",
    "Could not copy text.": "Não foi possível copiar o texto.",
    "Crop": "Recortar",
    "Custom color": "Cor personalizada",
    "Custom highlight": "Destaque personalizado",
    "Delete pages": "Excluir páginas",
    "Delete selection/clear annotations": "Excluir seleção/limpar anotações",
    "Eraser": "Borracha",
    "Export DOCX": "Exportar DOCX",
    "Export MD": "Exportar MD",
    "Export PDF": "Exportar PDF",
    "Font": "Fonte",
    "Highlight": "Destacar",
    "Highlighter": "Marcador",
    "Image": "Imagem",
    "Import PDF": "Importar PDF",
    "Insert image": "Inserir imagem",
    "Insert link": "Inserir link",
    "Loading pages...": "Carregando páginas...",
    "Move toolbar": "Mover barra",
    "Open a PDF first.": "Abra um PDF primeiro.",
    "PDF annotation": "Anotação PDF",
    "PDF annotation enabled.": "Anotação PDF ativada.",
    "Page/annotation navigator": "Navegador de páginas/anotações",
    "Pen": "Caneta",
    "Redo": "Refazer",
    "Reorder": "Reordenar",
    "Rotate": "Girar",
    "Select": "Selecionar",
    "Share/export": "Compartilhar/exportar",
    "Size": "Tamanho",
    "Text": "Texto",
    "Undo": "Desfazer"
  },
  ru: {
    "Alpha": "Прозрачность",
    "Cancel": "Отмена",
    "Close": "Закрыть",
    "Color and size": "Цвет и размер",
    "Confirm": "Подтвердить",
    "Convert docs": "Конвертировать документы",
    "Copied PDF text link.": "Ссылка на текст PDF скопирована.",
    "Copied PDF text.": "Текст PDF скопирован.",
    "Copy PDF link": "Копировать ссылку PDF",
    "Copy text": "Копировать текст",
    "Could not copy link.": "Не удалось скопировать ссылку.",
    "Could not copy text.": "Не удалось скопировать текст.",
    "Crop": "Обрезать",
    "Custom color": "Свой цвет",
    "Custom highlight": "Своя подсветка",
    "Delete pages": "Удалить страницы",
    "Delete selection/clear annotations": "Удалить выбор/очистить аннотации",
    "Eraser": "Ластик",
    "Export DOCX": "Экспорт DOCX",
    "Export MD": "Экспорт MD",
    "Export PDF": "Экспорт PDF",
    "Font": "Шрифт",
    "Highlight": "Подсветить",
    "Highlighter": "Маркер",
    "Image": "Изображение",
    "Import PDF": "Импорт PDF",
    "Insert image": "Вставить изображение",
    "Insert link": "Вставить ссылку",
    "Loading pages...": "Загрузка страниц...",
    "Move toolbar": "Переместить панель",
    "Open a PDF first.": "Сначала откройте PDF.",
    "PDF annotation": "Аннотация PDF",
    "PDF annotation enabled.": "Аннотация PDF включена.",
    "Page/annotation navigator": "Навигация страниц/аннотаций",
    "Pen": "Перо",
    "Redo": "Повторить",
    "Reorder": "Переупорядочить",
    "Rotate": "Повернуть",
    "Select": "Выбрать",
    "Share/export": "Поделиться/экспорт",
    "Size": "Размер",
    "Text": "Текст",
    "Undo": "Отменить"
  },
  tr: {
    "Alpha": "Opaklık",
    "Cancel": "İptal",
    "Close": "Kapat",
    "Color and size": "Renk ve boyut",
    "Confirm": "Onayla",
    "Convert docs": "Belgeleri dönüştür",
    "Copied PDF text link.": "PDF metin bağlantısı kopyalandı.",
    "Copied PDF text.": "PDF metni kopyalandı.",
    "Copy PDF link": "PDF bağlantısını kopyala",
    "Copy text": "Metni kopyala",
    "Could not copy link.": "Bağlantı kopyalanamadı.",
    "Could not copy text.": "Metin kopyalanamadı.",
    "Crop": "Kırp",
    "Custom color": "Özel renk",
    "Custom highlight": "Özel vurgulama",
    "Delete pages": "Sayfaları sil",
    "Delete selection/clear annotations": "Seçimi sil/notları temizle",
    "Eraser": "Silgi",
    "Export DOCX": "DOCX dışa aktar",
    "Export MD": "MD dışa aktar",
    "Export PDF": "PDF dışa aktar",
    "Font": "Yazı tipi",
    "Highlight": "Vurgula",
    "Highlighter": "Fosforlu kalem",
    "Image": "Görsel",
    "Import PDF": "PDF içe aktar",
    "Insert image": "Görsel ekle",
    "Insert link": "Bağlantı ekle",
    "Loading pages...": "Sayfalar yükleniyor...",
    "Move toolbar": "Araç çubuğunu taşı",
    "Open a PDF first.": "Önce bir PDF açın.",
    "PDF annotation": "PDF notu",
    "PDF annotation enabled.": "PDF notu etkin.",
    "Page/annotation navigator": "Sayfa/not gezgini",
    "Pen": "Kalem",
    "Redo": "Yinele",
    "Reorder": "Yeniden sırala",
    "Rotate": "Döndür",
    "Select": "Seç",
    "Share/export": "Paylaş/dışa aktar",
    "Size": "Boyut",
    "Text": "Metin",
    "Undo": "Geri al"
  },
  vi: {
    "Alpha": "Độ mờ",
    "Cancel": "Hủy",
    "Close": "Đóng",
    "Color and size": "Màu và cỡ",
    "Confirm": "Xác nhận",
    "Convert docs": "Chuyển đổi tài liệu",
    "Copied PDF text link.": "Đã sao chép liên kết văn bản PDF.",
    "Copied PDF text.": "Đã sao chép văn bản PDF.",
    "Copy PDF link": "Sao chép liên kết PDF",
    "Copy text": "Sao chép văn bản",
    "Could not copy link.": "Không thể sao chép liên kết.",
    "Could not copy text.": "Không thể sao chép văn bản.",
    "Crop": "Cắt",
    "Custom color": "Màu tùy chỉnh",
    "Custom highlight": "Tô sáng tùy chỉnh",
    "Delete pages": "Xóa trang",
    "Delete selection/clear annotations": "Xóa lựa chọn/xóa chú thích",
    "Eraser": "Tẩy",
    "Export DOCX": "Xuất DOCX",
    "Export MD": "Xuất MD",
    "Export PDF": "Xuất PDF",
    "Font": "Phông",
    "Highlight": "Tô sáng",
    "Highlighter": "Bút tô sáng",
    "Image": "Ảnh",
    "Import PDF": "Nhập PDF",
    "Insert image": "Chèn ảnh",
    "Insert link": "Chèn liên kết",
    "Loading pages...": "Đang tải trang...",
    "Move toolbar": "Di chuyển thanh công cụ",
    "Open a PDF first.": "Mở PDF trước.",
    "PDF annotation": "Chú thích PDF",
    "PDF annotation enabled.": "Đã bật chú thích PDF.",
    "Page/annotation navigator": "Điều hướng trang/chú thích",
    "Pen": "Bút",
    "Redo": "Làm lại",
    "Reorder": "Sắp xếp lại",
    "Rotate": "Xoay",
    "Select": "Chọn",
    "Share/export": "Chia sẻ/xuất",
    "Size": "Cỡ",
    "Text": "Văn bản",
    "Undo": "Hoàn tác"
  }
};
const NATIVE_TEXT_SELECTION_DESKTOP_LIMITS = {
  clearExcessive: false,
  maxAreaRatio: 0.45,
  maxChars: 1600,
  maxHeightRatio: 0.68,
  maxRects: 120
};
const NATIVE_TEXT_SELECTION_TOUCH_LIMITS = {
  clearExcessive: true,
  maxAreaRatio: 0.18,
  maxChars: 360,
  maxHeightRatio: 0.34,
  maxRects: 36
};

const BUILTIN_ALIPAY_QR_PATH = "plugins/pdftion/assets/alipay.png";
const BUILTIN_BINANCE_QR_PATH = "plugins/pdftion/assets/binance.png";

interface PdftionSettings {
  autoEnableAnnotationToolbar: boolean;
  boostPdfMenus: boolean;
  lastCropBottom: number;
  lastCropLeft: number;
  lastCropRight: number;
  lastCropTop: number;
  nativeTextSelectionMenuAttachedToText: boolean;
  openBurnedPdfAfterExport: boolean;
  paymentQrOneLabel: string;
  paymentQrOnePath: string;
  paymentQrTwoLabel: string;
  paymentQrTwoPath: string;
  eraserWidth: number;
  highlightColor: string;
  highlightOpacity: number;
  highlightWidth: number;
  nativeTextHighlightColor: string;
  penColor: string;
  penOpacity: number;
  penWidth: number;
  textColor: string;
  textFontFamily: string;
  textFontSize: number;
  textOpacity: number;
  toolbarButtonSize: number;
  toolbarMaxWidth: number;
  toolbarTopOffset: number;
}

const DEFAULT_SETTINGS: PdftionSettings = {
  autoEnableAnnotationToolbar: false,
  boostPdfMenus: true,
  lastCropBottom: 0.03,
  lastCropLeft: 0.03,
  lastCropRight: 0.03,
  lastCropTop: 0.04,
  nativeTextSelectionMenuAttachedToText: true,
  openBurnedPdfAfterExport: true,
  paymentQrOneLabel: "支付宝",
  paymentQrOnePath: "builtin:alipay",
  paymentQrTwoLabel: "币安",
  paymentQrTwoPath: "builtin:binance",
  eraserWidth: 14,
  highlightColor: "#fab005",
  highlightOpacity: 0.36,
  highlightWidth: 9,
  nativeTextHighlightColor: "#ffd43b",
  penColor: "#d9480f",
  penOpacity: 1,
  penWidth: 3,
  textColor: "#000000",
  textFontFamily: "sans-serif",
  textFontSize: 18,
  textOpacity: 1,
  toolbarButtonSize: 25,
  toolbarMaxWidth: 640,
  toolbarTopOffset: 0
};

function normalizePdftionLocale(language: string): PdftionLocale | null {
  const normalized = language.toLowerCase().replace("_", "-").trim();
  if (!normalized) {
    return null;
  }
  if (normalized.startsWith("zh") || normalized.includes("中文")) {
    return "zh";
  }
  if (normalized.startsWith("ja") || normalized.startsWith("jp")) {
    return "ja";
  }
  if (normalized.startsWith("ko")) {
    return "ko";
  }
  if (normalized.startsWith("es")) {
    return "es";
  }
  if (normalized.startsWith("fr")) {
    return "fr";
  }
  if (normalized.startsWith("de")) {
    return "de";
  }
  if (normalized.startsWith("ru")) {
    return "ru";
  }
  if (normalized.startsWith("pt")) {
    return "pt";
  }
  if (normalized.startsWith("tr")) {
    return "tr";
  }
  if (normalized.startsWith("ar")) {
    return "ar";
  }
  if (normalized.startsWith("id") || normalized.startsWith("in")) {
    return "id";
  }
  if (normalized.startsWith("vi")) {
    return "vi";
  }
  if (normalized.startsWith("en")) {
    return "en";
  }
  return null;
}

function getPdftionLocale(): PdftionLocale {
  const languages: string[] = [];
  if (activeDocument.documentElement.lang) {
    languages.push(activeDocument.documentElement.lang);
  }
  languages.push(activeWindow.navigator.language);
  languages.push(...(activeWindow.navigator.languages ?? []));

  for (const language of languages) {
    const locale = normalizePdftionLocale(language);
    if (locale) {
      return locale;
    }
  }
  return "en";
}

function uiText(zh: string, en: string): string {
  const locale = getPdftionLocale();
  if (locale === "zh") {
    return zh;
  }
  if (locale === "en") {
    return en;
  }
  return PDFTION_TRANSLATIONS[locale]?.[en] ?? en;
}

function toArrayBufferCopy(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function createActiveElement<K extends keyof HTMLElementTagNameMap>(tagName: K): HTMLElementTagNameMap[K] {
  return activeDocument.createElement(tagName);
}

function appendToActiveBody(element: HTMLElement): void {
  activeDocument.body.appendChild(element);
}

function getActiveBody(): HTMLElement {
  return activeDocument.body;
}

function waitForUiPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.setTimeout(resolve, 0);
    });
  });
}

type CrossWindowNode = Node & {
  instanceOf<T>(type: { new(): T }): this is T;
};

function hasCrossWindowInstanceCheck(value: unknown): value is CrossWindowNode {
  return typeof value === "object" && value !== null && "instanceOf" in value;
}

function isHTMLElement(value: unknown): value is HTMLElement {
  return hasCrossWindowInstanceCheck(value) && value.instanceOf(HTMLElement);
}

function isTouchLikeViewport(): boolean {
  return Boolean(activeWindow.matchMedia?.("(pointer: coarse)").matches) || activeWindow.innerWidth <= 820;
}

function getNativeSelectionLimits(): typeof NATIVE_TEXT_SELECTION_DESKTOP_LIMITS {
  return isTouchLikeViewport() ? NATIVE_TEXT_SELECTION_TOUCH_LIMITS : NATIVE_TEXT_SELECTION_DESKTOP_LIMITS;
}

function clearNativeSelectionSoon(selection: Selection): void {
  window.setTimeout(() => {
    try {
      selection.removeAllRanges();
    } catch {
      // Ignore selection objects that were detached by the host viewer.
    }
  }, 0);
}

async function showPromptModal(options: {
  actionLabel: string;
  cancelLabel?: string;
  defaultValue?: string;
  message: string;
  title: string;
}): Promise<string | null> {
  return new Promise((resolve) => {
    const modal = createActiveElement("div");
    modal.className = "pdftion-dialog-backdrop";

    const panel = createActiveElement("div");
    panel.className = "pdftion-dialog";

    const heading = createActiveElement("div");
    heading.className = "pdftion-dialog-title";
    heading.textContent = options.title;
    panel.appendChild(heading);

    const message = createActiveElement("div");
    message.className = "pdftion-dialog-message";
    message.textContent = options.message;
    panel.appendChild(message);

    const input = createActiveElement("textarea");
    input.className = "pdftion-dialog-input";
    input.value = options.defaultValue ?? "";
    panel.appendChild(input);

    const actions = createActiveElement("div");
    actions.className = "pdftion-dialog-actions";

    const cancel = createActiveElement("button");
    cancel.type = "button";
    cancel.textContent = options.cancelLabel ?? uiText("取消", "Cancel");
    cancel.addEventListener("click", () => {
      modal.remove();
      resolve(null);
    });
    actions.appendChild(cancel);

    const submit = createActiveElement("button");
    submit.type = "button";
    submit.textContent = options.actionLabel;
    submit.classList.add("mod-cta");
    submit.addEventListener("click", () => {
      const value = input.value.trim();
      modal.remove();
      resolve(value || null);
    });
    actions.appendChild(submit);

    panel.appendChild(actions);
    modal.appendChild(panel);
    appendToActiveBody(modal);
    input.focus({ preventScroll: true });

    modal.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        modal.remove();
        resolve(null);
      }
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        const value = input.value.trim();
        modal.remove();
        resolve(value || null);
      }
    });
  });
}

async function showConfirmModal(options: {
  cancelLabel?: string;
  confirmLabel?: string;
  message: string;
  title: string;
}): Promise<boolean> {
  return new Promise((resolve) => {
    const modal = createActiveElement("div");
    modal.className = "pdftion-dialog-backdrop";

    const panel = createActiveElement("div");
    panel.className = "pdftion-dialog";

    const heading = createActiveElement("div");
    heading.className = "pdftion-dialog-title";
    heading.textContent = options.title;
    panel.appendChild(heading);

    const message = createActiveElement("div");
    message.className = "pdftion-dialog-message";
    message.textContent = options.message;
    panel.appendChild(message);

    const actions = createActiveElement("div");
    actions.className = "pdftion-dialog-actions";

    const cancel = createActiveElement("button");
    cancel.type = "button";
    cancel.textContent = options.cancelLabel ?? uiText("取消", "Cancel");
    cancel.addEventListener("click", () => {
      modal.remove();
      resolve(false);
    });
    actions.appendChild(cancel);

    const confirm = createActiveElement("button");
    confirm.type = "button";
    confirm.textContent = options.confirmLabel ?? uiText("确认", "Confirm");
    confirm.classList.add("mod-cta");
    confirm.addEventListener("click", () => {
      modal.remove();
      resolve(true);
    });
    actions.appendChild(confirm);

    panel.appendChild(actions);
    modal.appendChild(panel);
    appendToActiveBody(modal);

    modal.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        modal.remove();
        resolve(false);
      }
      if (event.key === "Enter") {
        event.preventDefault();
        modal.remove();
        resolve(true);
      }
    });
  });
}

async function showCropModal(
  defaultCrop: PageCropMargins,
  onPreview: (crop: PageCropMargins | null) => void
): Promise<PageCropMargins | null> {
  return new Promise((resolve) => {
    const modal = createActiveElement("div");
    modal.className = "pdftion-dialog-backdrop";

    const panel = createActiveElement("div");
    panel.className = "pdftion-dialog pdftion-crop-dialog";

    const heading = createActiveElement("div");
    heading.className = "pdftion-dialog-title";
    heading.textContent = uiText("裁切页面", "Crop pages");
    panel.appendChild(heading);

    const message = createActiveElement("div");
    message.className = "pdftion-dialog-message";
    message.textContent = uiText("分别输入左、上、右、下四个边距。支持 0.05 或 5%。输入时会实时显示四边预览线。", "Enter left, top, right, and bottom margins separately. Use 0.05 or 5%. Preview lines update as you type.");
    panel.appendChild(message);

    const grid = createActiveElement("div");
    grid.className = "pdftion-crop-grid";
    const inputs: Record<keyof PageCropMargins, HTMLInputElement> = {
      bottom: createCropInput(defaultCrop.bottom),
      left: createCropInput(defaultCrop.left),
      right: createCropInput(defaultCrop.right),
      top: createCropInput(defaultCrop.top)
    };

    for (const item of [
      { key: "left" as const, label: uiText("左", "Left") },
      { key: "top" as const, label: uiText("上", "Top") },
      { key: "right" as const, label: uiText("右", "Right") },
      { key: "bottom" as const, label: uiText("下", "Bottom") }
    ]) {
      const label = createActiveElement("label");
      label.className = "pdftion-crop-field";
      const span = createActiveElement("span");
      span.textContent = item.label;
      label.appendChild(span);
      label.appendChild(inputs[item.key]);
      grid.appendChild(label);
    }
    panel.appendChild(grid);

    const error = createActiveElement("div");
    error.className = "pdftion-dialog-error";
    panel.appendChild(error);

    const actions = createActiveElement("div");
    actions.className = "pdftion-dialog-actions";

    const cancel = createActiveElement("button");
    cancel.type = "button";
    cancel.textContent = uiText("取消", "Cancel");
    cancel.addEventListener("click", () => {
      modal.remove();
      resolve(null);
    });
    actions.appendChild(cancel);

    const submit = createActiveElement("button");
    submit.type = "button";
    submit.textContent = uiText("应用裁切", "Apply crop");
    submit.classList.add("mod-cta");
    const previewCrop = (): PageCropMargins | null => {
      const crop = readCropInputs(inputs);
      onPreview(crop);
      error.textContent = crop ? "" : uiText("裁切参数无效。四边相加不能裁掉整页。", "Invalid crop values. Margins cannot remove the whole page.");
      return crop;
    };
    const submitCrop = (): void => {
      const crop = previewCrop();
      if (!crop) {
        return;
      }
      modal.remove();
      resolve(crop);
    };
    submit.addEventListener("click", submitCrop);
    actions.appendChild(submit);

    panel.appendChild(actions);
    modal.appendChild(panel);
    appendToActiveBody(modal);
    inputs.left.focus({ preventScroll: true });
    previewCrop();

    for (const input of Object.values(inputs)) {
      input.addEventListener("input", () => {
        previewCrop();
      });
    }

    modal.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        modal.remove();
        resolve(null);
      }
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        submitCrop();
      }
    });
  });
}

function createCropInput(value: number): HTMLInputElement {
  const input = createActiveElement("input");
  input.className = "pdftion-crop-input";
  input.inputMode = "decimal";
  input.type = "text";
  input.value = formatCropValue(value);
  return input;
}

function readCropInputs(inputs: Record<keyof PageCropMargins, HTMLInputElement>): PageCropMargins | null {
  const left = parseCropValue(inputs.left.value.trim());
  const top = parseCropValue(inputs.top.value.trim());
  const right = parseCropValue(inputs.right.value.trim());
  const bottom = parseCropValue(inputs.bottom.value.trim());
  if (left === null || top === null || right === null || bottom === null) {
    return null;
  }
  if (left + right >= 0.9 || top + bottom >= 0.9) {
    return null;
  }
  return { bottom, left, right, top };
}

function formatCropValue(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

interface PdfViewLike {
  containerEl?: HTMLElement;
  contentEl?: HTMLElement;
  file?: TFile;
  getViewType?: () => string;
}

interface InkPoint {
  x: number;
  y: number;
}

interface InkStroke {
  color: string;
  createdAt?: number;
  groupId?: string;
  id: string;
  kind: "stroke";
  opacity: number;
  pageCssHeight: number;
  pageCssWidth: number;
  pageIndex: number;
  externalDirty?: boolean;
  pdfPoints?: InkPoint[];
  pdfSaved?: boolean;
  points: InkPoint[];
  saved: boolean;
  source?: "external-ink" | "pdftion";
  tool: Exclude<ToolMode, "eraser" | "select">;
  width: number;
}

interface InkText {
  color: string;
  fontFamily?: string;
  fontSize: number;
  id: string;
  kind: "text";
  opacity: number;
  pageCssHeight: number;
  pageCssWidth: number;
  pageIndex: number;
  saved: boolean;
  text: string;
  x: number;
  y: number;
}

interface InkCover {
  color: string;
  height: number;
  id: string;
  kind: "cover";
  opacity: number;
  pageCssHeight: number;
  pageCssWidth: number;
  pageIndex: number;
  saved: boolean;
  source?: "manual" | "native-region" | "native-text";
  width: number;
  x: number;
  y: number;
}

interface InkImage {
  dataUrl: string;
  height: number;
  id: string;
  kind: "image";
  opacity: number;
  pageCssHeight: number;
  pageCssWidth: number;
  pageIndex: number;
  saved: boolean;
  width: number;
  x: number;
  y: number;
}

type InkElement = InkStroke | InkText | InkCover | InkImage;

interface HistorySnapshot {
  elements: InkElement[];
  nativeSelection: PdfNativeObject | null;
  selectedIds: string[];
}

interface PdftionElementQuery {
  color?: string;
  ids?: string[];
  kind?: InkElement["kind"];
  pageIndex?: number;
  text?: string;
}

interface PdftionObsidianLinkInput {
  color?: string;
  fontSize?: number;
  label?: string;
  link: string;
  pageIndex?: number;
  x?: number;
  y?: number;
}

interface PdftionVaultImageInput {
  height?: number;
  opacity?: number;
  pageIndex?: number;
  path: string;
  width?: number;
  x?: number;
  y?: number;
}

type PdftionPlanOperation =
  | { action: "addCover"; input: Partial<InkCover> & Pick<InkCover, "height" | "pageIndex" | "width" | "x" | "y"> }
  | { action: "addImage"; input: Partial<InkImage> & Pick<InkImage, "dataUrl" | "pageIndex" | "x" | "y"> }
  | { action: "addStroke"; input: Partial<InkStroke> & Pick<InkStroke, "pageIndex" | "points"> }
  | { action: "addText"; input: Partial<InkText> & Pick<InkText, "pageIndex" | "text" | "x" | "y"> }
  | { action: "deleteElements"; ids: string[] }
  | { action: "exportAnnotatedPdf" }
  | { action: "exportAnnotationsDocx" }
  | { action: "exportAnnotationsMarkdown" }
  | { action: "exportMarkdownDocxBridge" }
  | { action: "insertObsidianLink"; input: PdftionObsidianLinkInput }
  | { action: "insertVaultImage"; input: PdftionVaultImageInput }
  | { action: "replaceElements"; elements: InkElement[] }
  | { action: "selectElements"; ids: string[] }
  | { action: "updateElements"; elements: InkElement[] };

interface PdftionPlanResult {
  added: string[];
  deleted: number;
  errors: string[];
  exported: string[];
  ok: boolean;
  selected: number;
  updated: number;
}

interface PdfFingerprint {
  mtime?: number;
  sha256: string;
  size: number;
}

interface AnnotationStateRecord {
  basePdfFingerprint?: PdfFingerprint;
  elements: InkElement[];
  filePath?: string;
  overlayAnnotationsOnly?: boolean;
  overlayTextOnly?: boolean;
  pdfFingerprint: PdfFingerprint;
  updatedAt?: string;
  version?: number;
}

interface PdfNativeObject {
  height: number;
  id: string;
  kind: "text" | "region";
  pageIndex: number;
  text?: string;
  width: number;
  x: number;
  y: number;
}

interface NativeTextSelectionInfo {
  objects: PdfNativeObject[];
  overlay: PageOverlay;
  rect: { bottom: number; left: number; right: number; top: number };
  text: string;
}

interface PageOverlay {
  abort: AbortController;
  canvas: HTMLCanvasElement;
  cssHeight: number;
  cssWidth: number;
  dpr: number;
  observedCanvas?: HTMLCanvasElement | null;
  pageEl: HTMLElement;
  pageIndex: number;
  redrawFrame?: number | null;
  redrawPreviewStroke?: InkStroke | null;
  resizeObserver?: ResizeObserver | null;
  resizeTimer?: number | null;
  staticCanvas: HTMLCanvasElement;
}

interface OverlayGeometry {
  cssHeight: number;
  cssWidth: number;
  left: number;
  top: number;
}

interface RecentInkGroup {
  bounds: NormalizedBounds;
  color: string;
  id: string;
  lastAt: number;
  opacity: number;
  pageIndex: number;
  tool: InkStroke["tool"];
  width: number;
}

interface VisualConversionPage {
  bytes: Uint8Array;
  height: number;
  pageIndex: number;
  path?: string;
  width: number;
}

interface TouchScrollState {
  historyRecorded?: boolean;
  initialDistance: number;
  initialBounds?: NormalizedBounds;
  initialElements?: InkElement[];
  lastX: number;
  lastY: number;
  mode: "scroll" | "resize-selection";
  scrollEl: HTMLElement;
}

interface SelectionDragState {
  clearSelectionOnTap?: boolean;
  current: InkPoint;
  handle?: ResizeHandle;
  historyRecorded?: boolean;
  moved: boolean;
  mode: "move" | "marquee" | "resize";
  originalBounds?: NormalizedBounds;
  originalElements?: InkElement[];
  pageIndex: number;
  startedFromFreshSelection?: boolean;
  start: InkPoint;
}

interface NormalizedBounds {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
}

interface NativeAnnotationStyleSnapshot {
  display: string;
  opacity: string;
  pointerEvents: string;
  visibility: string;
}

interface ConversionResult {
  covers: number;
  pages?: number;
  skipped?: number;
  texts: number;
}

interface PdfElementStats {
  covers: number;
  images: number;
  pages: number;
  strokes: number;
  texts: number;
  total: number;
}

interface PageCropMargins {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

interface CropPreviewState {
  crop: PageCropMargins;
  pageIndexes: Set<number>;
}

interface PdfRewriteBackupRecord {
  elements: InkElement[];
  filePath: string;
  pdfPath: string;
  updatedAt: string;
  version: number;
}

interface PdftionAiApi {
  addImage(input: Partial<InkImage> & Pick<InkImage, "dataUrl" | "pageIndex" | "x" | "y">): string | null;
  addCover(input: Partial<InkCover> & Pick<InkCover, "height" | "pageIndex" | "width" | "x" | "y">): string | null;
  addStroke(input: Partial<InkStroke> & Pick<InkStroke, "pageIndex" | "points">): string | null;
  addText(input: Partial<InkText> & Pick<InkText, "pageIndex" | "text" | "x" | "y">): string | null;
  applyPlan(operations: PdftionPlanOperation[]): Promise<PdftionPlanResult>;
  convertNativeDocument(): ConversionResult;
  convertNativePage(pageIndex?: number): ConversionResult;
  convertNativeSelection(): ConversionResult;
  coverNativeSelection(): string | null;
  deleteElements(ids: string[]): number;
  exportAnnotatedPdf(): Promise<string | null>;
  exportAnnotationsDocx(): Promise<string | null>;
  exportAnnotationsMarkdown(): Promise<string | null>;
  exportMarkdownDocxBridge(): Promise<string | null>;
  findElements(query?: PdftionElementQuery): InkElement[];
  getAnnotationsMarkdown(): string;
  getCurrentFile(): string | null;
  getElements(): InkElement[];
  getNativeSelection(): PdfNativeObject | null;
  getSelectedElements(): InkElement[];
  getStats(): PdfElementStats;
  groupElementsByPage(): Record<string, InkElement[]>;
  jumpToPage(pageIndex: number): boolean;
  replaceNativeText(text: string): { coverId: string | null; textId: string | null } | null;
  replaceElements(elements: InkElement[]): boolean;
  selectElements(ids: string[]): number;
  insertObsidianLink(input: PdftionObsidianLinkInput): Promise<string | null>;
  insertVaultImage(input: PdftionVaultImageInput): Promise<string | null>;
  setPageCrop(pageIndex: number, crop: { bottom?: number; left?: number; right?: number; top?: number }): boolean;
  getPageCrops(): Record<string, { bottom: number; left: number; right: number; top: number }>;
  updateElements(elements: InkElement[]): number;
}

declare global {
  interface Window {
    PdftionAI?: PdftionAiApi;
  }
}

export default class PdftionPlugin extends Plugin {
  private annotationFontBytes: Uint8Array | null = null;
  private sessions = new Map<HTMLElement, InkSession>();
  private surfaceScanTimers: number[] = [];
  settings: PdftionSettings = { ...DEFAULT_SETTINGS };

  async onload(): Promise<void> {
    await this.loadSettings();
    this.applyRuntimeSettings();
    this.addSettingTab(new PdftionSettingTab(this));

    this.addCommand({
      id: "toggle",
      name: uiText("切换 PDF 批注", "Toggle PDF annotation"),
      callback: () => {
        const session = this.getActivePdfSession();
        if (!session) {
          new Notice(uiText("请先打开 PDF。", "Open a PDF first."));
          return;
        }
        session.toggle();
      }
    });

    this.addCommand({
      id: "export-annotated-pdf",
      name: uiText("导出带批注 PDF", "Export visible annotated PDF"),
      callback: () => {
        const session = this.getActivePdfSession();
        if (!session) {
          new Notice(uiText("请先打开 PDF。", "Open a PDF first."));
          return;
        }
        void session.exportAnnotatedPdf();
      }
    });

    this.addCommand({
      id: "export-annotations-markdown",
      name: uiText("导出批注 Markdown", "Export annotations to Markdown"),
      callback: () => {
        const session = this.getActivePdfSession();
        if (!session) {
          new Notice(uiText("请先打开 PDF。", "Open a PDF first."));
          return;
        }
        void session.exportAnnotationsMarkdown();
      }
    });

    this.addCommand({
      id: "show-pdf-page-navigator",
      name: uiText("打开页面导航", "Show page navigator"),
      callback: () => {
        const session = this.getActivePdfSession();
        if (!session) {
          new Notice(uiText("请先打开 PDF。", "Open a PDF first."));
          return;
        }
        session.showPageNavigator();
      }
    });

    this.addCommand({
      id: "convert-pdf-markdown-docx",
      name: uiText("PDF/Markdown/DOCX 转换", "PDF/Markdown/DOCX conversion"),
      callback: () => {
        const session = this.getActivePdfSession();
        if (!session) {
          new Notice(uiText("请先打开 PDF。", "Open a PDF first."));
          return;
        }
        void session.exportMarkdownDocxBridge();
      }
    });

    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.queuePdfSurfaceScans()));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.queuePdfSurfaceScans()));
    this.registerEvent(this.app.workspace.on("file-open", () => this.queuePdfSurfaceScans()));
    this.registerDomEvent(activeDocument, "visibilitychange", () => this.flushAllSessionsSoon());
    this.registerDomEvent(activeDocument, "pointerdown", (event) => this.commitEditorsOnOutsidePointer(event), { capture: true });
    this.registerDomEvent(activeWindow, "pagehide", () => this.flushAllSessionsSoon());
    this.registerDomEvent(activeWindow, "beforeunload", () => this.flushAllSessionsSoon());
    this.register(() => this.clearSurfaceScanTimers());

    this.queuePdfSurfaceScans();
    this.installAiApi();
  }

  async loadSettings(): Promise<void> {
    this.settings = normalizeSettings(await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.applyRuntimeSettings();
  }

  onunload(): void {
    if (activeWindow.PdftionAI) {
      delete activeWindow.PdftionAI;
    }
    delete (activeWindow as unknown as Record<string, unknown>)[PDFTION_AI_API_NAME];
    getActiveBody().classList.remove("pdftion-menu-boost");
    getActiveBody().classList.remove("pdftion-editing-active");
    getActiveBody().setCssProps({
      "--pdftion-toolbar-button-size": "",
      "--pdftion-toolbar-max-width": "",
      "--pdftion-toolbar-top-offset": ""
    });
    for (const session of this.sessions.values()) {
      session.destroy();
    }
    this.sessions.clear();
    this.clearSurfaceScanTimers();
  }

  refreshGlobalEditingClass(): void {
    const hasActiveSession = Array.from(this.sessions.values()).some((session) => session.isEnabled());
    getActiveBody().classList.toggle("pdftion-editing-active", hasActiveSession);
  }

  applyRuntimeSettings(): void {
    const body = getActiveBody();
    body.classList.toggle("pdftion-menu-boost", this.settings.boostPdfMenus);
    body.setCssProps({
      "--pdftion-toolbar-button-size": `${this.settings.toolbarButtonSize}px`,
      "--pdftion-toolbar-max-width": `${this.settings.toolbarMaxWidth}px`,
      "--pdftion-toolbar-top-offset": `${this.settings.toolbarTopOffset}px`
    });
  }

  private queuePdfSurfaceScans(): void {
    this.clearSurfaceScanTimers();
    for (const delay of [0, 80, 180, 420, 900, 1800, 3200]) {
      const timer = window.setTimeout(() => {
        this.surfaceScanTimers = this.surfaceScanTimers.filter((value) => value !== timer);
        this.scanPdfSurfaces();
      }, delay);
      this.surfaceScanTimers.push(timer);
    }
  }

  private clearSurfaceScanTimers(): void {
    for (const timer of this.surfaceScanTimers) {
      window.clearTimeout(timer);
    }
    this.surfaceScanTimers = [];
  }

  async loadAnnotationFontBytes(): Promise<Uint8Array> {
    if (this.annotationFontBytes) {
      return this.annotationFontBytes;
    }

    const dir = this.manifest.dir;
    if (!dir) {
      throw new Error("Plugin directory is unavailable.");
    }

    const buffer = await this.app.vault.adapter.readBinary(`${dir}/fonts/NotoSansSC-Regular.otf`);
    this.annotationFontBytes = new Uint8Array(buffer);
    return this.annotationFontBytes;
  }

  async loadAnnotationState(file: TFile): Promise<{ elements: InkElement[]; overlayAnnotationsOnly: boolean; overlayTextOnly: boolean } | null> {
    const currentBytes = await this.app.vault.readBinary(file);
    const currentFingerprint = await fingerprintPdfBytes(currentBytes, file.stat.mtime);
    const state = await this.loadVerifiedAnnotationRecord(file, currentFingerprint);
    if (!state) {
      return null;
    }
    return {
      elements: state.elements,
      overlayAnnotationsOnly: state.overlayAnnotationsOnly === true,
      overlayTextOnly: state.overlayTextOnly === true
    };
  }

  async loadPdfInkAnnotations(file: TFile, pageIndexes?: Set<number>): Promise<InkStroke[]> {
    try {
      const binary = await this.app.vault.readBinary(file);
      const pdf = await PDFDocument.load(binary, { ignoreEncryption: true, updateMetadata: false });
      return extractPdfInkAnnotations(pdf, pageIndexes);
    } catch (error) {
      console.warn("pdftion could not import PDF ink annotations.", error);
      return [];
    }
  }

  async saveAnnotationState(file: TFile, elements: InkElement[], basePdfFingerprint: PdfFingerprint, savedBytes: ArrayBuffer): Promise<void> {
    const path = this.getAnnotationStatePath(file);
    const pdfFingerprint = await fingerprintPdfBytes(savedBytes, file.stat.mtime);
    await this.ensureAdapterFolder(path.substring(0, path.lastIndexOf("/")));
    await this.app.vault.adapter.write(
      path,
      JSON.stringify(
        {
          basePdfFingerprint,
          filePath: file.path,
          overlayAnnotationsOnly: true,
          overlayTextOnly: true,
          pdfFingerprint,
          updatedAt: new Date().toISOString(),
          version: 6,
          elements
        },
        null,
        2
      )
    );
  }

  async saveEditableAnnotationState(file: TFile, elements: InkElement[], currentBytes: ArrayBuffer): Promise<void> {
    const path = this.getAnnotationStatePath(file);
    const pdfFingerprint = await fingerprintPdfBytes(currentBytes, file.stat.mtime);
    await this.ensureAdapterFolder(path.substring(0, path.lastIndexOf("/")));
    await this.app.vault.adapter.write(
      path,
      JSON.stringify(
        {
          filePath: file.path,
          overlayAnnotationsOnly: true,
          overlayTextOnly: true,
          pdfFingerprint,
          updatedAt: new Date().toISOString(),
          version: 6,
          elements
        },
        null,
        2
      )
    );
  }

  async loadBasePdfBytes(file: TFile, fingerprint: PdfFingerprint): Promise<ArrayBuffer | null> {
    try {
      return await this.app.vault.adapter.readBinary(this.getBasePdfPath(file, fingerprint.sha256));
    } catch {
      return null;
    }
  }

  async ensureBasePdfBytes(file: TFile, currentBytes: ArrayBuffer): Promise<{ bytes: ArrayBuffer; fingerprint: PdfFingerprint }> {
    const currentFingerprint = await fingerprintPdfBytes(currentBytes, file.stat.mtime);
    const state = await this.loadVerifiedAnnotationRecord(file, currentFingerprint);
    if (state?.basePdfFingerprint) {
      const existing = await this.loadBasePdfBytes(file, state.basePdfFingerprint);
      if (existing) {
        return { bytes: existing, fingerprint: state.basePdfFingerprint };
      }
    }

    const path = this.getBasePdfPath(file, currentFingerprint.sha256);
    await this.ensureAdapterFolder(path.substring(0, path.lastIndexOf("/")));
    await this.app.vault.adapter.writeBinary(path, currentBytes);
    return { bytes: currentBytes, fingerprint: currentFingerprint };
  }

  async replaceBasePdfBytes(file: TFile, currentBytes: ArrayBuffer): Promise<PdfFingerprint> {
    const fingerprint = await fingerprintPdfBytes(currentBytes, file.stat.mtime);
    const path = this.getBasePdfPath(file, fingerprint.sha256);
    await this.ensureAdapterFolder(path.substring(0, path.lastIndexOf("/")));
    await this.app.vault.adapter.writeBinary(path, currentBytes);
    return fingerprint;
  }

  private getAnnotationStatePath(file: TFile): string {
    return `${this.manifest.dir}/data/annotations/${safeAnnotationKey(file.path)}.json`;
  }

  private getBasePdfPath(file: TFile, sha256: string): string {
    return `${this.manifest.dir}/data/base-pdfs/${safeAnnotationKey(file.path)}--${sha256}.pdf`;
  }

  private async loadVerifiedAnnotationRecord(file: TFile, currentFingerprint: PdfFingerprint): Promise<AnnotationStateRecord | null> {
    try {
      const raw = await this.app.vault.adapter.read(this.getAnnotationStatePath(file));
      const parsed = JSON.parse(raw) as {
        basePdfFingerprint?: unknown;
        elements?: unknown;
        filePath?: unknown;
        overlayAnnotationsOnly?: unknown;
        overlayTextOnly?: unknown;
        pdfFingerprint?: unknown;
        updatedAt?: unknown;
        version?: unknown;
      };
      if (!Array.isArray(parsed.elements)) {
        return null;
      }
      if (!isPdfFingerprint(parsed.pdfFingerprint)) {
        console.warn("pdftion skipped annotation state without a PDF fingerprint.", file.path);
        return null;
      }
      const filePath = typeof parsed.filePath === "string" ? parsed.filePath : undefined;
      const pendingInk = parsed.elements
        .filter(isInkElement)
        .some((element) => element.kind === "stroke" && element.pdfSaved !== true);
      if (parsed.pdfFingerprint.sha256 !== currentFingerprint.sha256 && !(pendingInk && filePath === file.path)) {
        console.warn("pdftion skipped annotation state for a replaced PDF.", file.path);
        return null;
      }

      return {
        basePdfFingerprint: isPdfFingerprint(parsed.basePdfFingerprint) ? parsed.basePdfFingerprint : undefined,
        elements: parsed.elements.filter(isInkElement),
        filePath,
        overlayAnnotationsOnly: parsed.overlayAnnotationsOnly === true,
        overlayTextOnly: parsed.overlayTextOnly === true,
        pdfFingerprint: parsed.pdfFingerprint,
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined,
        version: typeof parsed.version === "number" ? parsed.version : undefined
      };
    } catch {
      return null;
    }
  }

  private async ensureAdapterFolder(path: string): Promise<void> {
    if (!path) {
      return;
    }
    const parts = path.split("/").filter(Boolean);
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!(await this.app.vault.adapter.exists(current))) {
        await this.app.vault.adapter.mkdir(current);
      }
    }
  }

  private scanPdfSurfaces(): void {
    const liveRoots = new Set<HTMLElement>();

    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view as unknown as PdfViewLike;
      const hostEl = view.containerEl ?? view.contentEl;
      if (!hostEl) {
        return;
      }

      for (const surface of this.findPdfSurfaces(hostEl, view)) {
        liveRoots.add(surface.rootEl);
        const existing = this.sessions.get(surface.rootEl);
        if (existing) {
          existing.updateFile(surface.file);
          existing.scheduleQuietScan();
          continue;
        }

        const session = new InkSession(this, leaf, surface.file, surface.rootEl);
        this.sessions.set(surface.rootEl, session);
      }
    });

    const activeFile = this.app.workspace.getActiveFile();
    const currentLeaf = activeFile ? this.findLeafForFile(activeFile) : this.app.workspace.getMostRecentLeaf();
    if (currentLeaf) {
      for (const surface of this.findPdfSurfaces(activeDocument.body, currentLeaf.view as unknown as PdfViewLike)) {
        if (!this.isDetachedPdfSurface(surface.rootEl) || this.isCoveredByExistingSession(surface.rootEl)) {
          continue;
        }
        liveRoots.add(surface.rootEl);
        const existing = this.sessions.get(surface.rootEl);
        if (existing) {
          existing.updateFile(surface.file);
          existing.scheduleQuietScan();
          continue;
        }

        const session = new InkSession(this, currentLeaf, surface.file, surface.rootEl);
        this.sessions.set(surface.rootEl, session);
      }
    }

    for (const [rootEl, session] of this.sessions.entries()) {
      if (!activeDocument.body.contains(rootEl) || !liveRoots.has(rootEl)) {
        session.destroy();
        this.sessions.delete(rootEl);
      }
    }
    this.refreshGlobalEditingClass();
  }

  private findLeafForFile(file: TFile): WorkspaceLeaf | null {
    let matched: WorkspaceLeaf | null = null;
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view as unknown as PdfViewLike;
      if (view.file?.path === file.path) {
        matched = leaf;
      }
    });
    return matched;
  }

  private flushAllSessionsSoon(): void {
    for (const session of this.sessions.values()) {
      session.flushSoon();
    }
  }

  private isCoveredByExistingSession(rootEl: HTMLElement): boolean {
    for (const existingRoot of this.sessions.keys()) {
      if (existingRoot === rootEl || existingRoot.contains(rootEl) || rootEl.contains(existingRoot)) {
        return true;
      }
    }
    return false;
  }

  private isDetachedPdfSurface(rootEl: HTMLElement): boolean {
    if (rootEl.closest(".workspace-leaf-content")) {
      return false;
    }
    return rootEl.closest(".sr-modal, .sr-card, .spaced-repetition, .spaced-repetition-modal, .review-modal, .review-card, .modal") !== null;
  }

  private commitEditorsOnOutsidePointer(event: PointerEvent): void {
    const target = event.target;
    if (isHTMLElement(target) && target.closest(".pdftion-native-editor, .pdftion-panel")) {
      return;
    }
    for (const session of this.sessions.values()) {
      session.commitNativeTextEditor();
    }
  }

  private findPdfSurfaces(hostEl: HTMLElement, view: PdfViewLike): Array<{ file: TFile; rootEl: HTMLElement }> {
    const directFile = view.file?.extension === "pdf" ? view.file : null;
    const viewType = view.getViewType?.();
    if (directFile || viewType === "pdf") {
      const file = directFile ?? this.resolvePdfFile(hostEl, view.file);
      return file ? [{ file, rootEl: hostEl }] : [];
    }

    const roots = new Set<HTMLElement>();
    for (const page of this.findPdfPageElements(hostEl)) {
      const root =
        page.closest<HTMLElement>(".internal-embed, .media-embed, .file-embed, .markdown-embed") ??
        page.closest<HTMLElement>(".pdf-embed, .pdf-container, .pdf-viewer, .pdfViewer") ??
        page.parentElement ??
        hostEl;
      roots.add(root);
    }

    const surfaces: Array<{ file: TFile; rootEl: HTMLElement }> = [];
    for (const rootEl of roots) {
      const file = this.resolvePdfFile(rootEl, view.file);
      if (file && this.hasPdfPages(rootEl)) {
        surfaces.push({ file, rootEl });
      }
    }
    return surfaces;
  }

  private findPdfPageElements(rootEl: HTMLElement): HTMLElement[] {
    return Array.from(
      rootEl.querySelectorAll<HTMLElement>(
        ".pdfViewer .page, .pdf-viewer .page, .pdf-container .page, .page[data-page-number]"
      )
    ).filter((page) => page.querySelector("canvas") !== null);
  }

  private hasPdfPages(rootEl: HTMLElement): boolean {
    return this.findPdfPageElements(rootEl).some((page) => page.clientWidth > 0 && page.clientHeight > 0);
  }

  private resolvePdfFile(rootEl: HTMLElement, sourceFile?: TFile): TFile | null {
    if (sourceFile?.extension === "pdf") {
      return sourceFile;
    }

    for (const rawPath of collectPdfPathHints(rootEl)) {
      const file = this.resolvePdfPathHint(rawPath, sourceFile);
      if (file) {
        return file;
      }
    }

    return null;
  }

  private resolvePdfPathHint(rawPath: string, sourceFile?: TFile): TFile | null {
    const cleaned = cleanPdfPathHint(rawPath);
    if (!cleaned) {
      return null;
    }

    const linked = this.app.metadataCache.getFirstLinkpathDest(cleaned, sourceFile?.path ?? "");
    if (linked instanceof TFile && linked.extension === "pdf") {
      return linked;
    }

    const normalized = cleaned.replace(/\\/g, "/").replace(/^\/+/, "");
    const direct = this.app.vault.getAbstractFileByPath(normalized);
    if (direct instanceof TFile && direct.extension === "pdf") {
      return direct;
    }

    return null;
  }

  private getActivePdfSession(): InkSession | null {
    const activeFile = this.app.workspace.getActiveFile();
    const leaf = activeFile ? this.findLeafForFile(activeFile) : this.app.workspace.getMostRecentLeaf();
    if (!leaf) {
      return null;
    }

    const view = leaf.view as unknown as PdfViewLike;
    const rootEl = view.containerEl ?? view.contentEl;
    if (!rootEl) {
      return null;
    }

    this.scanPdfSurfaces();
    const direct = this.sessions.get(rootEl);
    if (direct) {
      return direct;
    }

    for (const [sessionRoot, session] of this.sessions.entries()) {
      if (rootEl.contains(sessionRoot) || sessionRoot.contains(rootEl)) {
        return session;
      }
    }

    return this.getVisiblePdfSession();
  }

  private getVisiblePdfSession(): InkSession | null {
    let best: { score: number; session: InkSession } | null = null;
    for (const [rootEl, session] of this.sessions.entries()) {
      const rect = rootEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || rect.bottom < 0 || rect.top > activeWindow.innerHeight) {
        continue;
      }
      const score = Math.abs(rect.top + rect.height / 2 - activeWindow.innerHeight / 2);
      if (!best || score < best.score) {
        best = { score, session };
      }
    }
    return best?.session ?? null;
  }

  private installAiApi(): void {
    const api: PdftionAiApi = {
      addImage: (input) => this.getActivePdfSession()?.aiAddImage(input) ?? null,
      addCover: (input) => this.getActivePdfSession()?.aiAddCover(input) ?? null,
      addStroke: (input) => this.getActivePdfSession()?.aiAddStroke(input) ?? null,
      addText: (input) => this.getActivePdfSession()?.aiAddText(input) ?? null,
      applyPlan: (operations) => this.getActivePdfSession()?.aiApplyPlan(operations) ?? Promise.resolve({ added: [], deleted: 0, errors: ["No active PDF session."], exported: [], ok: false, selected: 0, updated: 0 }),
      convertNativeDocument: () => this.getActivePdfSession()?.convertNativeDocumentToEditable() ?? { covers: 0, skipped: 0, texts: 0 },
      convertNativePage: (pageIndex) => this.getActivePdfSession()?.convertNativePageToEditable(pageIndex) ?? { covers: 0, skipped: 0, texts: 0 },
      convertNativeSelection: () => this.getActivePdfSession()?.convertNativeSelectionToEditable() ?? { covers: 0, skipped: 0, texts: 0 },
      coverNativeSelection: () => this.getActivePdfSession()?.aiCoverNativeSelection() ?? null,
      deleteElements: (ids) => this.getActivePdfSession()?.aiDeleteElements(ids) ?? 0,
      exportAnnotatedPdf: () => this.getActivePdfSession()?.exportAnnotatedPdf() ?? Promise.resolve(null),
      exportAnnotationsDocx: () => this.getActivePdfSession()?.exportAnnotationsDocx() ?? Promise.resolve(null),
      exportAnnotationsMarkdown: () => this.getActivePdfSession()?.exportAnnotationsMarkdown() ?? Promise.resolve(null),
      exportMarkdownDocxBridge: () => this.getActivePdfSession()?.exportMarkdownDocxBridge() ?? Promise.resolve(null),
      findElements: (query) => this.getActivePdfSession()?.aiFindElements(query) ?? [],
      getAnnotationsMarkdown: () => this.getActivePdfSession()?.getAnnotationsMarkdown() ?? "",
      getCurrentFile: () => this.getActivePdfSession()?.getFilePath() ?? null,
      getElements: () => this.getActivePdfSession()?.aiGetElements() ?? [],
      getNativeSelection: () => this.getActivePdfSession()?.aiGetNativeSelection() ?? null,
      getSelectedElements: () => this.getActivePdfSession()?.aiGetSelectedElements() ?? [],
      getStats: () => this.getActivePdfSession()?.aiGetStats() ?? { covers: 0, images: 0, pages: 0, strokes: 0, texts: 0, total: 0 },
      groupElementsByPage: () => this.getActivePdfSession()?.aiGroupElementsByPage() ?? {},
      jumpToPage: (pageIndex) => this.getActivePdfSession()?.jumpToPage(pageIndex) ?? false,
      replaceNativeText: (text) => this.getActivePdfSession()?.aiReplaceNativeText(text) ?? null,
      replaceElements: (elements) => this.getActivePdfSession()?.aiReplaceElements(elements) ?? false,
      selectElements: (ids) => this.getActivePdfSession()?.aiSelectElements(ids) ?? 0,
      insertObsidianLink: (input) => this.getActivePdfSession()?.insertObsidianLink(input) ?? Promise.resolve(null),
      insertVaultImage: (input) => this.getActivePdfSession()?.insertVaultImage(input) ?? Promise.resolve(null),
      setPageCrop: (pageIndex, crop) => this.getActivePdfSession()?.setPageCrop(pageIndex, crop) ?? false,
      getPageCrops: () => this.getActivePdfSession()?.getPageCrops() ?? {},
      updateElements: (elements) => this.getActivePdfSession()?.aiUpdateElements(elements) ?? 0
    };
    activeWindow.PdftionAI = api;
    (window as unknown as Record<string, PdftionAiApi | undefined>)[PDFTION_AI_API_NAME] = api;
  }
}

class PdftionSettingTab extends PluginSettingTab {
  constructor(private readonly plugin: PdftionPlugin) {
    super(plugin.app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.replaceChildren();

    new Setting(containerEl)
      .setName(uiText("Pdftion 设置", "Pdftion settings"))
      .setHeading();

    this.addSection(uiText("导出", "Export"));
    new Setting(containerEl)
      .setName(uiText("导出后自动打开", "Open after PDF export"))
      .setDesc(uiText("导出烧录 PDF 后自动打开生成的 PDF。", "Automatically open the generated burned-in PDF after export."))
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.openBurnedPdfAfterExport)
          .onChange(async (value) => {
            this.plugin.settings.openBurnedPdfAfterExport = value;
            await this.plugin.saveSettings();
          });
      });

    this.addSection(uiText("工具栏", "Toolbar"));
    this.addToggleSetting(
      uiText("增强 PDF 顶部菜单", "Boost PDF top menu"),
      uiText("提高 PDF 菜单层级和按钮可点区域，减少被复习卡片或嵌入视图夹住时点不到。", "Raises PDF menu stacking and button hit areas to help inside review cards and embeds."),
      "boostPdfMenus"
    );
    this.addToggleSetting(
      uiText("打开 PDF 时自动显示批注工具栏", "Show annotation toolbar when a PDF opens"),
      uiText("适合主要用 Pdftion 批注 PDF 的工作流；关闭后仍可点 PDF 菜单里的笔按钮。", "Useful when most PDFs are annotated with Pdftion; the pen button still works when disabled."),
      "autoEnableAnnotationToolbar"
    );
    this.addNumberSetting(
      uiText("工具栏按钮大小", "Toolbar button size"),
      uiText("单位 px。建议 22-32，手机可适当加大。", "Pixels. 22-32 is recommended; use larger values on touch screens."),
      "toolbarButtonSize",
      18,
      44
    );
    this.addNumberSetting(
      uiText("工具栏最大宽度", "Toolbar max width"),
      uiText("单位 px。屏幕窄时仍会自动压到屏幕内。", "Pixels. It is still clamped to the viewport on narrow screens."),
      "toolbarMaxWidth",
      360,
      1200
    );
    this.addNumberSetting(
      uiText("工具栏下移距离", "Toolbar top offset"),
      uiText("单位 px。顶部被挡时调大；不想留空就设为 0。", "Pixels. Increase when the top is covered; use 0 for no extra gap."),
      "toolbarTopOffset",
      0,
      160
    );

    this.addSection(uiText("选择与触控", "Selection and touch"));
    this.addToggleSetting(
      uiText("手机文字菜单贴近选中文字", "Attach mobile text menu to selected text"),
      uiText("开启后高亮/复制菜单跟随选中文字；关闭后使用旧的屏幕边缘定位。", "When enabled, highlight/copy actions follow the selected text; disable to use the older edge placement."),
      "nativeTextSelectionMenuAttachedToText"
    );

    this.addSection(uiText("数据与 AI", "Data and AI"));
    const apiNote = containerEl.createDiv({ cls: "pdftion-settings-note" });
    apiNote.textContent = uiText(
      "Pdftion 会自动保存可编辑批注数据，并在窗口暴露 PdftionAI / __PDftionAI__，方便本地脚本或 AI 读取、统计和操作当前 PDF 批注。",
      "Pdftion auto-saves editable annotation data and exposes PdftionAI / __PDftionAI__ on the window for local scripts or AI agents to inspect, summarize, and operate the active PDF annotations."
    );

    this.addSection(uiText("支持作者", "Support the author"));
    this.renderPaymentQrCodes(containerEl);
  }

  private addSection(title: string): void {
    new Setting(this.containerEl)
      .setName(title)
      .setHeading()
      .settingEl.addClass("pdftion-settings-section");
  }

  private addToggleSetting(
    name: string,
    desc: string,
    key: { [K in keyof PdftionSettings]: PdftionSettings[K] extends boolean ? K : never }[keyof PdftionSettings]
  ): void {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(desc)
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings[key])
          .onChange(async (value) => {
            this.plugin.settings[key] = value;
            await this.plugin.saveSettings();
          });
      });
  }

  private addNumberSetting(
    name: string,
    desc: string,
    key: { [K in keyof PdftionSettings]: PdftionSettings[K] extends number ? K : never }[keyof PdftionSettings],
    min: number,
    max: number
  ): void {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(desc)
      .addText((text) => {
        text
          .setValue(String(this.plugin.settings[key]))
          .onChange(async (value) => {
            const next = clamp(Math.round(Number(value)), min, max);
            if (!Number.isFinite(next)) {
              return;
            }
            this.plugin.settings[key] = next;
            await this.plugin.saveSettings();
          });
        text.inputEl.type = "number";
        text.inputEl.min = String(min);
        text.inputEl.max = String(max);
      });
  }

  private addTextSetting(
    name: string,
    placeholder: string,
    key: { [K in keyof PdftionSettings]: PdftionSettings[K] extends string ? K : never }[keyof PdftionSettings]
  ): void {
    new Setting(this.containerEl)
      .setName(name)
      .addText((text) => {
        text
          .setPlaceholder(placeholder)
          .setValue(this.plugin.settings[key])
          .onChange(async (value) => {
            this.plugin.settings[key] = value.trim();
            await this.plugin.saveSettings();
          });
      });
  }

  private renderPaymentQrCodes(containerEl: HTMLElement): void {
    const wrap = containerEl.createDiv({ cls: "pdftion-payment-grid" });
    this.renderPaymentQrCode(wrap, this.plugin.settings.paymentQrOneLabel, this.plugin.settings.paymentQrOnePath);
    this.renderPaymentQrCode(wrap, this.plugin.settings.paymentQrTwoLabel, this.plugin.settings.paymentQrTwoPath);
  }

  private renderPaymentQrCode(containerEl: HTMLElement, label: string, rawPath: string): void {
    const card = containerEl.createDiv({ cls: "pdftion-payment-card" });
    const title = card.createDiv({ cls: "pdftion-payment-title" });
    title.textContent = label || uiText("收款码", "Payment QR");
    const src = this.getPaymentImageSource(rawPath);
    if (src) {
      const image = card.createEl("img", {
        attr: {
          alt: title.textContent,
          loading: "lazy",
          src
        },
        cls: "pdftion-payment-image"
      });
      image.addEventListener("error", () => {
        image.remove();
        this.renderPaymentPlaceholder(card, uiText("图片无法加载", "Image could not be loaded"));
      });
      return;
    }
    this.renderPaymentPlaceholder(card, uiText("未配置图片", "No image configured"));
  }

  private renderPaymentPlaceholder(card: HTMLElement, message: string): void {
    const placeholder = card.createDiv({ cls: "pdftion-payment-placeholder" });
    setIcon(placeholder, "qr-code");
    placeholder.createSpan({ text: message });
  }

  private getPaymentImageSource(rawPath: string): string | null {
    const path = rawPath.trim();
    if (!path) {
      return null;
    }
    if (path === "builtin:alipay") {
      return this.plugin.app.vault.adapter.getResourcePath(`${this.plugin.app.vault.configDir}/${BUILTIN_ALIPAY_QR_PATH}`);
    }
    if (path === "builtin:binance") {
      return this.plugin.app.vault.adapter.getResourcePath(`${this.plugin.app.vault.configDir}/${BUILTIN_BINANCE_QR_PATH}`);
    }
    if (/^(https?:|data:image\/)/i.test(path)) {
      return path;
    }
    if (/^[a-z]:[\\/]/i.test(path)) {
      return `file:///${path.replace(/\\/g, "/")}`;
    }
    return this.plugin.app.vault.adapter.getResourcePath(path.replace(/\\/g, "/").replace(/^\/+/, ""));
  }
}

function normalizeSettings(data: unknown): PdftionSettings {
  const record = data && typeof data === "object" ? data as Partial<PdftionSettings> : {};
  return {
    autoEnableAnnotationToolbar: typeof record.autoEnableAnnotationToolbar === "boolean"
      ? record.autoEnableAnnotationToolbar
      : DEFAULT_SETTINGS.autoEnableAnnotationToolbar,
    boostPdfMenus: typeof record.boostPdfMenus === "boolean"
      ? record.boostPdfMenus
      : DEFAULT_SETTINGS.boostPdfMenus,
    lastCropBottom: normalizeNumberSetting(record.lastCropBottom, DEFAULT_SETTINGS.lastCropBottom, 0, 0.45, 0.001),
    lastCropLeft: normalizeNumberSetting(record.lastCropLeft, DEFAULT_SETTINGS.lastCropLeft, 0, 0.45, 0.001),
    lastCropRight: normalizeNumberSetting(record.lastCropRight, DEFAULT_SETTINGS.lastCropRight, 0, 0.45, 0.001),
    lastCropTop: normalizeNumberSetting(record.lastCropTop, DEFAULT_SETTINGS.lastCropTop, 0, 0.45, 0.001),
    nativeTextSelectionMenuAttachedToText: typeof record.nativeTextSelectionMenuAttachedToText === "boolean"
      ? record.nativeTextSelectionMenuAttachedToText
      : DEFAULT_SETTINGS.nativeTextSelectionMenuAttachedToText,
    openBurnedPdfAfterExport: typeof record.openBurnedPdfAfterExport === "boolean"
      ? record.openBurnedPdfAfterExport
      : DEFAULT_SETTINGS.openBurnedPdfAfterExport,
    paymentQrOneLabel: normalizeStringSetting(record.paymentQrOneLabel, DEFAULT_SETTINGS.paymentQrOneLabel),
    paymentQrOnePath: normalizeStringSetting(record.paymentQrOnePath, DEFAULT_SETTINGS.paymentQrOnePath),
    paymentQrTwoLabel: normalizeStringSetting(record.paymentQrTwoLabel, DEFAULT_SETTINGS.paymentQrTwoLabel),
    paymentQrTwoPath: normalizeStringSetting(record.paymentQrTwoPath, DEFAULT_SETTINGS.paymentQrTwoPath),
    eraserWidth: normalizeNumberSetting(record.eraserWidth, DEFAULT_SETTINGS.eraserWidth, 2, 120, 0.5),
    highlightColor: normalizeColorSetting(record.highlightColor, DEFAULT_SETTINGS.highlightColor),
    highlightOpacity: normalizeNumberSetting(record.highlightOpacity, DEFAULT_SETTINGS.highlightOpacity, 0.05, 1, 0.05),
    highlightWidth: normalizeNumberSetting(record.highlightWidth, DEFAULT_SETTINGS.highlightWidth, 2, 96, 0.5),
    nativeTextHighlightColor: normalizeColorSetting(record.nativeTextHighlightColor, DEFAULT_SETTINGS.nativeTextHighlightColor),
    penColor: normalizeColorSetting(record.penColor, DEFAULT_SETTINGS.penColor),
    penOpacity: normalizeNumberSetting(record.penOpacity, DEFAULT_SETTINGS.penOpacity, 0.05, 1, 0.05),
    penWidth: normalizeNumberSetting(record.penWidth, DEFAULT_SETTINGS.penWidth, 0.5, 72, 0.5),
    textColor: normalizeColorSetting(record.textColor, DEFAULT_SETTINGS.textColor),
    textFontFamily: normalizeFontFamilySetting(record.textFontFamily, DEFAULT_SETTINGS.textFontFamily),
    textFontSize: normalizeNumberSetting(record.textFontSize, DEFAULT_SETTINGS.textFontSize, 6, 120, 1),
    textOpacity: normalizeNumberSetting(record.textOpacity, DEFAULT_SETTINGS.textOpacity, 0.05, 1, 0.05),
    toolbarButtonSize: normalizeNumberSetting(record.toolbarButtonSize, DEFAULT_SETTINGS.toolbarButtonSize, 18, 44),
    toolbarMaxWidth: normalizeNumberSetting(record.toolbarMaxWidth, DEFAULT_SETTINGS.toolbarMaxWidth, 360, 1200),
    toolbarTopOffset: normalizeNumberSetting(record.toolbarTopOffset, DEFAULT_SETTINGS.toolbarTopOffset, 0, 160)
  };
}

function normalizeNumberSetting(value: unknown, fallback: number, min: number, max: number, step = 1): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return clamp(Math.round(numeric / step) * step, min, max);
}

function normalizeStringSetting(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeColorSetting(value: unknown, fallback: string): string {
  return typeof value === "string" ? normalizeHexColor(value) : fallback;
}

function normalizeFontFamilySetting(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  return TEXT_FONTS.some((font) => font.value === value) ? value : fallback;
}

class InkSession {
  private cropByPage = new Map<number, PageCropMargins>();
  private button: HTMLElement | null = null;
  private currentCover: InkCover | null = null;
  private currentStroke: InkStroke | null = null;
  private currentStrokeStartedAt = 0;
  private currentStrokeMoved = false;
  private currentStrokeHadTouchMove = false;
  private cropPreview: CropPreviewState | null = null;
  private dirty = false;
  private destroyed = false;
  private enabled = false;
  private imageCache = new Map<string, HTMLImageElement>();
  private imageMenu: HTMLElement | null = null;
  private shareMenu: HTMLElement | null = null;
  private mutationObserver: MutationObserver;
  private hiddenNativeAnnotationStyles = new Map<HTMLElement, NativeAnnotationStyleSnapshot>();
  private pendingNativeInkHidePages = new Set<number>();
  private detachedInkEditPages = new Set<number>();
  private overlays = new Map<HTMLElement, PageOverlay>();
  private activeTouchId: number | null = null;
  private annotationLoadToken = 0;
  private annotationLoadPromise: Promise<void> | null = null;
  private preparingPdfInkForEditing = false;
  private pendingEditableInkPrepareAfterSave = false;
  private pendingSaveAfterCurrentSave = false;
  private palette: HTMLElement | null = null;
  private penColor = DEFAULT_SETTINGS.penColor;
  private penOpacity = DEFAULT_SETTINGS.penOpacity;
  private penWidth = DEFAULT_SETTINGS.penWidth;
  private nativeTextEditor: HTMLTextAreaElement | null = null;
  private nativeTextEditorCover: InkCover | null = null;
  private eraserWidth = DEFAULT_SETTINGS.eraserWidth;
  private textColor = DEFAULT_SETTINGS.textColor;
  private textFontFamily = DEFAULT_SETTINGS.textFontFamily;
  private textFontSize = DEFAULT_SETTINGS.textFontSize;
  private textOpacity = DEFAULT_SETTINGS.textOpacity;
  private coverHistory: InkCover[] = [];
  private loadedAnnotationState = false;
  private redoStack: InkElement[] = [];
  private undoStack: HistorySnapshot[] = [];
  private redoHistoryStack: HistorySnapshot[] = [];
  private saveTimer: number | null = null;
  private settingsSaveTimer: number | null = null;
  private scanTimer: number | null = null;
  private healthTimer: number | null = null;
  private zoomGeometryTimer: number | null = null;
  private inkPrepareTimer: number | null = null;
  private inkPrepareTimerForce = false;
  private nativeAnnotationPopupTimer: number | null = null;
  private nativePopupHideTimers = new Set<number>();
  private nativePopupSuppressUntil = 0;
  private recentInkGroup: RecentInkGroup | null = null;
  private selectionDrag: SelectionDragState | null = null;
  private nativeSelection: PdfNativeObject | null = null;
  private pendingImageCrop: PdfNativeObject | null = null;
  private pageNavigator: HTMLElement | null = null;
  private selectedPageIndexes = new Set<number>();
  private selectedStrokeIds = new Set<string>();
  private selectionChangedAt = 0;
  private selectionWasExplicitTap = false;
  private dirtyInkPages = new Set<number>();
  private deletedExternalInkIds = new Set<string>();
  private deletedPdftionInkIds = new Set<string>();
  private nativeTextSelectionMenu: HTMLElement | null = null;
  private nativeTextSelectionInfo: NativeTextSelectionInfo | null = null;
  private nativeTextSelectionTimer: number | null = null;
  private nativeTextSelectionAbort = new AbortController();
  private saving = false;
  private strokeHistory: InkStroke[] = [];
  private textHistory: InkText[] = [];
  private imageHistory: InkImage[] = [];
  private toolbar: HTMLElement | null = null;
  private toolbarHost: HTMLElement | null = null;
  private tool: ToolMode = "pen";
  private lastTap: { pageIndex: number; point: InkPoint; time: number } | null = null;
  private savedInkIsBurnedIntoPdf = false;
  private savedTextIsBurnedIntoPdf = false;
  private touchGestureCooldownUntil = 0;
  private touchScroll: TouchScrollState | null = null;
  private highlightColor = DEFAULT_SETTINGS.highlightColor;
  private highlightOpacity = DEFAULT_SETTINGS.highlightOpacity;
  private highlightWidth = DEFAULT_SETTINGS.highlightWidth;
  private nativeTextHighlightColor = DEFAULT_SETTINGS.nativeTextHighlightColor;

  constructor(
    private plugin: PdftionPlugin,
    private leaf: WorkspaceLeaf,
    private file: TFile,
    private rootEl: HTMLElement
  ) {
    this.applyToolSettingsFromPlugin();
    this.rootEl.classList.add("pdftion-root");
    this.injectButton();
    void this.loadEditableAnnotations();
    if (this.plugin.settings.autoEnableAnnotationToolbar) {
      window.setTimeout(() => this.setEnabled(true, { notice: false }), 0);
    }
    this.scanPages();

    this.mutationObserver = new MutationObserver((mutations) => {
      if (this.shouldScanForMutations(mutations)) {
        if (this.enabled) {
          this.updateExternalInkLayerState();
          this.scheduleEditableInkPrepare(80, true);
          window.setTimeout(() => this.scheduleEditableInkPrepare(0, true), 360);
        }
        this.scheduleQuietScan();
      }
    });
    this.mutationObserver.observe(this.rootEl, {
      childList: true,
      subtree: true
    });
    activeDocument.addEventListener("selectionchange", () => this.scheduleNativeTextSelectionMenu(), {
      signal: this.nativeTextSelectionAbort.signal
    });
    this.rootEl.addEventListener("pointerup", () => this.scheduleNativeTextSelectionMenu(20), {
      signal: this.nativeTextSelectionAbort.signal
    });
    this.rootEl.addEventListener("keyup", () => this.scheduleNativeTextSelectionMenu(20), {
      signal: this.nativeTextSelectionAbort.signal
    });
    this.rootEl.addEventListener("scroll", () => {
      this.scheduleEditableInkPrepare(180);
      this.refreshVisibleOverlays();
    }, {
      capture: true,
      passive: true,
      signal: this.nativeTextSelectionAbort.signal
    });
    activeDocument.addEventListener("scroll", () => {
      this.scheduleEditableInkPrepare(180);
      this.refreshVisibleOverlays();
    }, {
      capture: true,
      passive: true,
      signal: this.nativeTextSelectionAbort.signal
    });
    for (const eventName of ["auxclick", "click", "contextmenu", "dblclick", "focusin", "mousedown", "mousemove", "mouseover", "mouseup", "pointerdown", "pointermove", "pointerup", "touchstart"]) {
      this.rootEl.addEventListener(eventName, (event) => this.blockNativePdfAnnotationEvent(event), {
        capture: true,
        signal: this.nativeTextSelectionAbort.signal
      });
      activeDocument.addEventListener(eventName, (event) => this.blockNativePdfAnnotationEvent(event), {
        capture: true,
        signal: this.nativeTextSelectionAbort.signal
      });
    }
  }

  destroy(): void {
    this.flushSoon();
    this.destroyed = true;
    this.enabled = false;
    this.restoreHiddenNativeInkAnnotations();
    this.clearAutoSaveTimer();
    this.clearToolSettingsSaveTimer();
    this.clearScanTimer();
    this.clearEditableInkPrepareTimer();
    this.clearZoomGeometryTimer();
    this.clearNativePopupHideTimers();
    this.stopOverlayHealthCheck();
    this.stopNativeAnnotationPopupSuppressor();
    this.mutationObserver.disconnect();
    this.button?.remove();
    this.closeNativeTextEditor(false);
    this.palette?.remove();
    this.hideNativeTextSelectionMenu();
    this.clearNativeTextSelectionTimer();
    this.nativeTextSelectionAbort.abort();
    this.pageNavigator?.remove();
    this.imageMenu?.remove();
    this.shareMenu?.remove();
    this.toolbar?.remove();
    this.toolbarHost?.remove();
    this.rootEl.querySelector<HTMLElement>(".pdftion-inline-actions")?.remove();
    this.toolbarHost = null;
    for (const overlay of this.overlays.values()) {
      overlay.abort.abort();
      overlay.resizeObserver?.disconnect();
      if (overlay.redrawFrame !== null && overlay.redrawFrame !== undefined) {
        window.cancelAnimationFrame(overlay.redrawFrame);
      }
      if (overlay.resizeTimer !== null && overlay.resizeTimer !== undefined) {
        window.clearTimeout(overlay.resizeTimer);
      }
      overlay.canvas.remove();
      overlay.staticCanvas.remove();
      overlay.pageEl.classList.remove("pdftion-page", "pdftion-hide-native-ink-layer");
    }
    this.overlays.clear();
    this.pendingImageCrop = null;
    this.rootEl.classList.remove("pdftion-enabled", "pdftion-root", "pdftion-selecting");
    this.plugin.refreshGlobalEditingClass();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  updateFile(file: TFile): void {
    if (file.path === this.file.path) {
      return;
    }

    this.flushSoon();
    this.restoreHiddenNativeInkAnnotations();
    this.closeNativeTextEditor(false);
    this.file = file;
    this.clearAutoSaveTimer();
    this.clearEditableInkPrepareTimer();
    this.clearCurrentStroke();
    this.recentInkGroup = null;
    this.dirty = false;
    this.pendingNativeInkHidePages.clear();
    this.dirtyInkPages.clear();
    this.deletedExternalInkIds.clear();
    this.deletedPdftionInkIds.clear();
    this.redoStack = [];
    this.undoStack = [];
    this.redoHistoryStack = [];
    this.selectionDrag = null;
    this.clearEditableSelection();
    this.hideNativeTextSelectionMenu();
    this.pendingImageCrop = null;
    this.strokeHistory = [];
    this.textHistory = [];
    this.coverHistory = [];
    this.imageHistory = [];
    this.detachedInkEditPages.clear();
    this.loadedAnnotationState = false;
    this.annotationLoadToken += 1;
    this.annotationLoadPromise = null;
    void this.loadEditableAnnotations();
    this.redrawAll();
  }

  private async loadEditableAnnotations(): Promise<void> {
    if (this.loadedAnnotationState) {
      return;
    }
    if (this.annotationLoadPromise) {
      return this.annotationLoadPromise;
    }
    this.annotationLoadPromise = this.loadEditableAnnotationsInner().finally(() => {
      this.annotationLoadPromise = null;
    });
    return this.annotationLoadPromise;
  }

  private async loadEditableAnnotationsInner(): Promise<void> {
    if (this.loadedAnnotationState) {
      return;
    }
    const filePath = this.file.path;
    const loadToken = ++this.annotationLoadToken;
    const state = await this.plugin.loadAnnotationState(this.file);
    if (loadToken !== this.annotationLoadToken || this.file.path !== filePath) {
      return;
    }
    const pdfInkStrokes = await this.plugin.loadPdfInkAnnotations(this.file);
    if (loadToken !== this.annotationLoadToken || this.file.path !== filePath) {
      return;
    }
    const loadedElements: InkElement[] = [
      ...(state?.elements ?? []),
      ...pdfInkStrokes.filter((stroke) => !(state?.elements ?? []).some((element) => (
        element.id === stroke.id ||
        (element.kind === "stroke" && isSamePdfInkStrokeCandidate(element, stroke))
      )))
    ].map((element): InkElement => {
      if (element.kind !== "stroke") {
        return markElementSaved(element);
      }
      const pdfStroke = pdfInkStrokes.find((stroke) => stroke.id === element.id);
      const pdfPoints = element.pdfPoints ?? pdfStroke?.points;
      const matchesPdfStroke = Boolean(pdfStroke && pdfPoints && inkPointsApproximatelyEqual(element.points, pdfPoints));
      const stroke: InkStroke = {
        ...element,
        externalDirty: matchesPdfStroke ? false : element.externalDirty,
        pdfPoints: pdfPoints?.map((point) => ({ ...point })),
        pdfSaved: matchesPdfStroke ? true : element.pdfSaved ?? (pdfStroke ? true : undefined),
        source: element.source ?? pdfStroke?.source
      };
      return markElementSaved(stroke);
    });
    const elements = dedupeInkElements(loadedElements);
    this.strokeHistory = elements.filter((element): element is InkStroke => element.kind === "stroke");
    this.textHistory = elements.filter((element): element is InkText => element.kind === "text");
    this.coverHistory = elements.filter((element): element is InkCover => element.kind === "cover");
    this.imageHistory = elements.filter((element): element is InkImage => element.kind === "image");
    this.savedInkIsBurnedIntoPdf = state !== null && !state.overlayAnnotationsOnly && this.strokeHistory.some((stroke) => !Array.isArray(stroke.pdfPoints));
    this.savedTextIsBurnedIntoPdf = state !== null && !state.overlayAnnotationsOnly && !state.overlayTextOnly && this.textHistory.length > 0;
    if (this.savedInkIsBurnedIntoPdf || this.savedTextIsBurnedIntoPdf) {
      this.dirty = true;
      this.scheduleAutoSave(250);
    }
    this.loadedAnnotationState = true;
    this.redrawAll();
  }

  toggle(): void {
    this.setEnabled(!this.enabled);
  }

  scanPages(): void {
    this.clearScanTimer();
    if (this.isInteracting()) {
      this.scheduleScanPages(700);
      return;
    }

    this.injectButton();
    this.cleanupDetachedOverlays();

    const pageEls = this.findPageElements();
    for (let i = 0; i < pageEls.length; i += 1) {
      this.ensureOverlay(pageEls[i], i);
    }

    if (this.enabled) {
      this.rememberNativeInkHidePagesForCurrentPages();
    }
    this.redrawAll();
    this.scheduleEditableInkPrepare(120);
  }

  scheduleQuietScan(): void {
    this.scheduleScanPages(this.enabled ? 320 : 120);
  }

  private scheduleScanPages(delay = 250): void {
    this.clearScanTimer();
    this.scanTimer = window.setTimeout(() => {
      this.scanTimer = null;
      this.scanPages();
    }, delay);
  }

  private shouldScanForMutations(mutations: MutationRecord[]): boolean {
    if (this.isInteracting()) {
      return false;
    }

    return mutations.some((mutation) => {
      for (const node of Array.from(mutation.addedNodes)) {
        if (this.isRelevantPdfMutationNode(node)) {
          return true;
        }
      }
      for (const node of Array.from(mutation.removedNodes)) {
        if (this.isRelevantPdfMutationNode(node)) {
          return true;
        }
      }
      return false;
    });
  }

  private isRelevantPdfMutationNode(node: Node): boolean {
    if (!node.instanceOf(HTMLElement)) {
      return false;
    }
    if (node.closest(".pdftion-root") && node.classList.contains("pdftion-canvas")) {
      return false;
    }
    if (node.closest(".pdftion-toolbar-host, .pdftion-toolbar, .pdftion-palette-panel, .pdftion-image-menu, .pdftion-share-menu, .pdftion-embed-actions, .pdftion-inline-actions")) {
      return false;
    }
    if (
      node.classList.contains("page") ||
      node.matches("canvas, .pdfViewer, .pdf-viewer, .pdf-container, .view-actions, .view-header, .file-embed-title, .embed-title")
    ) {
      return true;
    }
    return node.querySelector(".page, canvas, .pdfViewer, .pdf-viewer, .pdf-container, .view-actions, .view-header, .file-embed-title, .embed-title") !== null;
  }

  private isInteracting(): boolean {
    return this.currentStroke !== null || this.activeTouchId !== null || this.selectionDrag !== null || this.touchScroll !== null;
  }

  private injectButton(): void {
    if (this.button?.isConnected) {
      this.moveButtonIntoHostIfAvailable(this.button);
      return;
    }

    const existing = this.rootEl.querySelector<HTMLElement>(".pdftion-button");
    if (existing) {
      this.button = existing;
      this.moveButtonIntoHostIfAvailable(existing);
      return;
    }

    const button = createIconButton("pen-line", uiText("PDF 批注", "PDF annotation"));
    button.classList.add("pdftion-button");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.toggle();
    });

    const actions = this.findButtonHost();
    if (actions) {
      this.placeButtonInHost(actions, button);
    } else {
      (this.ensureInlineEmbedHost() ?? this.rootEl).appendChild(button);
    }

    this.button = button;
    this.updateButtonState();
  }

  private moveButtonIntoHostIfAvailable(button: HTMLElement): void {
    const actions = this.findButtonHost();
    if (!actions) {
      return;
    }

    const oldHost = button.closest<HTMLElement>(".pdftion-embed-actions");
    this.placeButtonInHost(actions, button);
    if (oldHost && oldHost.childElementCount === 0) {
      oldHost.remove();
    }
  }

  private placeButtonInHost(host: HTMLElement, button: HTMLElement): void {
    if (button.parentElement === host && host.firstElementChild === button) {
      return;
    }

    const zoomOut = this.findZoomOutButton(host);
    if (zoomOut?.parentElement === host) {
      host.insertBefore(button, zoomOut);
      return;
    }

    host.prepend(button);
  }

  private findZoomOutButton(host: HTMLElement): HTMLElement | null {
    for (const item of Array.from(host.querySelectorAll<HTMLElement>("button, .clickable-icon, [aria-label], [title]"))) {
      if (item.classList.contains("pdftion-button")) {
        continue;
      }
      const label = `${item.getAttribute("aria-label") ?? ""} ${item.getAttribute("title") ?? ""} ${item.textContent ?? ""}`.toLowerCase();
      if (
        label.includes("zoom out") ||
        label.includes("缩小") ||
        label.includes("放小") ||
        label.includes("zoom-out")
      ) {
        return item;
      }
    }
    return null;
  }

  private findButtonHost(): HTMLElement | null {
    const view = this.leaf.view as unknown as PdfViewLike;
    const leafContent = this.rootEl.closest<HTMLElement>(".workspace-leaf-content") ?? view.containerEl ?? view.contentEl ?? this.rootEl;
    const leafEl = this.rootEl.closest<HTMLElement>(".workspace-leaf") ?? leafContent;

    const pdfHost =
      this.rootEl.querySelector<HTMLElement>(".pdf-toolbar-actions") ??
      this.rootEl.querySelector<HTMLElement>(".pdf-toolbar-items") ??
      this.rootEl.querySelector<HTMLElement>(".pdf-viewer-toolbar") ??
      this.rootEl.querySelector<HTMLElement>(".pdf-toolbar") ??
      this.rootEl.querySelector<HTMLElement>(".pdf-toolbar-container") ??
      this.rootEl.querySelector<HTMLElement>(".pdf-embed-toolbar") ??
      leafContent.querySelector<HTMLElement>(".pdf-toolbar-actions") ??
      leafContent.querySelector<HTMLElement>(".pdf-toolbar-items") ??
      leafContent.querySelector<HTMLElement>(".pdf-viewer-toolbar") ??
      leafContent.querySelector<HTMLElement>(".pdf-toolbar") ??
      leafContent.querySelector<HTMLElement>(".pdf-toolbar-container") ??
      leafContent.querySelector<HTMLElement>(".pdf-embed-toolbar") ??
      leafEl.querySelector<HTMLElement>(".pdf-toolbar-actions") ??
      leafEl.querySelector<HTMLElement>(".pdf-toolbar-items") ??
      leafEl.querySelector<HTMLElement>(".pdf-viewer-toolbar") ??
      leafEl.querySelector<HTMLElement>(".pdf-toolbar") ??
      leafEl.querySelector<HTMLElement>(".pdf-toolbar-container") ??
      leafEl.querySelector<HTMLElement>(".pdf-embed-toolbar");
    if (pdfHost) {
      return pdfHost;
    }

    const officialHost =
      this.rootEl.querySelector<HTMLElement>(".view-actions") ??
      leafContent.querySelector<HTMLElement>(".view-actions") ??
      leafEl.querySelector<HTMLElement>(".view-actions");
    if (officialHost) {
      return officialHost;
    }

    if (this.isEmbeddedPdfSurface()) {
      if (this.isSpacedRepetitionSurface()) {
        return this.ensureInlineEmbedHost();
      }
      return (
        this.rootEl.querySelector<HTMLElement>(".file-embed-title .file-embed-title-inner") ??
        this.rootEl.querySelector<HTMLElement>(".file-embed-title") ??
        this.rootEl.querySelector<HTMLElement>(".embed-title .embed-title-inner") ??
        this.rootEl.querySelector<HTMLElement>(".embed-title") ??
        this.findSpacedRepetitionHost() ??
        this.ensureInlineEmbedHost()
      );
    }

    return null;
  }

  private isEmbeddedPdfSurface(): boolean {
    return (
      this.rootEl.matches(".internal-embed, .media-embed, .file-embed, .markdown-embed") ||
      this.rootEl.closest(".internal-embed, .media-embed, .file-embed, .markdown-embed") !== null ||
      this.rootEl.closest(".sr-modal, .sr-card, .spaced-repetition, .spaced-repetition-modal, .review-modal, .review-card") !== null
    );
  }

  private isSpacedRepetitionSurface(): boolean {
    return this.rootEl.closest(".sr-modal, .sr-card, .spaced-repetition, .spaced-repetition-modal, .review-modal, .review-card") !== null;
  }

  private findSpacedRepetitionHost(): HTMLElement | null {
    const srRoot = this.rootEl.closest<HTMLElement>(".sr-modal, .sr-card, .spaced-repetition, .spaced-repetition-modal, .review-modal, .review-card");
    if (!srRoot) {
      return null;
    }
    return (
      srRoot.querySelector<HTMLElement>(".file-embed-title .file-embed-title-inner") ??
      srRoot.querySelector<HTMLElement>(".file-embed-title") ??
      srRoot.querySelector<HTMLElement>(".embed-title .embed-title-inner") ??
      srRoot.querySelector<HTMLElement>(".embed-title") ??
      this.ensureInlineEmbedHost()
    );
  }

  private ensureInlineEmbedHost(create = true): HTMLElement | null {
    const existing = this.rootEl.querySelector<HTMLElement>(".pdftion-inline-actions");
    if (existing || !create) {
      return existing;
    }

    const host = activeDocument.createElement("div");
    host.className = this.isSpacedRepetitionSurface()
      ? "pdftion-inline-actions pdftion-sr-inline-actions"
      : "pdftion-inline-actions";

    const title =
      this.rootEl.querySelector<HTMLElement>(".file-embed-title, .embed-title, .markdown-embed-title") ??
      this.rootEl.firstElementChild;
    if (title?.parentElement) {
      title.insertAdjacentElement("afterend", host);
    } else {
      this.rootEl.prepend(host);
    }

    return host;
  }

  private findPageElements(): HTMLElement[] {
    const candidates = Array.from(
      this.rootEl.querySelectorAll<HTMLElement>(
        ".pdfViewer .page, .pdf-viewer .page, .pdf-container .page, .page[data-page-number]"
      )
    );

    const unique = new Set<HTMLElement>();
    return candidates.filter((candidate) => {
      if (unique.has(candidate)) {
        return false;
      }
      unique.add(candidate);
      return candidate.querySelector("canvas") !== null && candidate.clientWidth > 0 && candidate.clientHeight > 0;
    });
  }

  private ensureOverlay(pageEl: HTMLElement, fallbackIndex: number): void {
    const pageIndex = getPageIndex(pageEl, fallbackIndex);
    let overlay = this.overlays.get(pageEl);

    if (!overlay) {
      const staticCanvas = activeDocument.createElement("canvas");
      staticCanvas.className = "pdftion-canvas pdftion-static-canvas";
      const canvas = activeDocument.createElement("canvas");
      canvas.className = "pdftion-canvas pdftion-live-canvas";

      const abort = new AbortController();
      const newOverlay: PageOverlay = {
        abort,
        canvas,
        cssHeight: 0,
        cssWidth: 0,
        dpr: 1,
        observedCanvas: null,
        pageEl,
        pageIndex,
        redrawFrame: null,
        redrawPreviewStroke: null,
        resizeObserver: null,
        resizeTimer: null,
        staticCanvas
      };

      canvas.addEventListener("pointerdown", (event: PointerEvent) => this.onPointerDown(event, newOverlay), { signal: abort.signal });
      canvas.addEventListener("dblclick", (event: MouseEvent) => this.onDoubleClick(event, newOverlay), { signal: abort.signal });
      canvas.addEventListener("pointermove", (event: PointerEvent) => this.onPointerMove(event, newOverlay), { signal: abort.signal });
      canvas.addEventListener("pointerup", (event: PointerEvent) => this.onPointerUp(event, newOverlay), { signal: abort.signal });
      canvas.addEventListener("pointercancel", (event: PointerEvent) => this.onPointerUp(event, newOverlay), { signal: abort.signal });
      canvas.addEventListener("lostpointercapture", (event: PointerEvent) => this.onPointerUp(event, newOverlay), { signal: abort.signal });
      canvas.addEventListener("touchstart", (event: TouchEvent) => this.onTouchStart(event, newOverlay), {
        passive: false,
        signal: abort.signal
      });
      canvas.addEventListener("touchmove", (event: TouchEvent) => this.onTouchMove(event, newOverlay), {
        passive: false,
        signal: abort.signal
      });
      canvas.addEventListener("touchend", (event: TouchEvent) => this.onTouchEnd(event, newOverlay), {
        passive: false,
        signal: abort.signal
      });
      canvas.addEventListener("touchcancel", (event: TouchEvent) => this.onTouchEnd(event, newOverlay), {
        passive: false,
        signal: abort.signal
      });

      pageEl.classList.add("pdftion-page");
      pageEl.appendChild(staticCanvas);
      pageEl.appendChild(canvas);
      overlay = newOverlay;
      this.overlays.set(pageEl, overlay);
    }

    overlay.pageIndex = pageIndex;
    this.observeOverlayResize(overlay);
    if (this.isOverlayNearViewport(overlay)) {
      this.resizeOverlay(overlay);
    }
  }

  private observeOverlayResize(overlay: PageOverlay): void {
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    if (!overlay.resizeObserver) {
      overlay.resizeObserver = new ResizeObserver(() => this.scheduleOverlayResize(overlay));
      overlay.resizeObserver.observe(overlay.pageEl);
    }

    const visibleCanvas = overlay.pageEl.querySelector<HTMLCanvasElement>("canvas:not(.pdftion-canvas)");
    if (overlay.observedCanvas !== visibleCanvas) {
      if (overlay.observedCanvas) {
        overlay.resizeObserver.unobserve(overlay.observedCanvas);
      }
      if (visibleCanvas) {
        overlay.resizeObserver.observe(visibleCanvas);
      }
      overlay.observedCanvas = visibleCanvas;
    }
  }

  private measureOverlayGeometry(overlay: PageOverlay): OverlayGeometry | null {
    const visibleCanvas = overlay.pageEl.querySelector<HTMLCanvasElement>("canvas:not(.pdftion-canvas)");
    const pageRect = overlay.pageEl.getBoundingClientRect();
    const visibleRect = visibleCanvas?.getBoundingClientRect() ?? pageRect;
    const pageLocalWidth = overlay.pageEl.offsetWidth || overlay.pageEl.clientWidth || pageRect.width;
    const pageLocalHeight = overlay.pageEl.offsetHeight || overlay.pageEl.clientHeight || pageRect.height;
    const canvasLocalWidth = visibleCanvas?.clientWidth || visibleCanvas?.offsetWidth || 0;
    const canvasLocalHeight = visibleCanvas?.clientHeight || visibleCanvas?.offsetHeight || 0;
    const scaleX = canvasLocalWidth > 0
      ? visibleRect.width / canvasLocalWidth
      : pageRect.width > 0 && pageLocalWidth > 0
        ? pageRect.width / pageLocalWidth
        : 1;
    const scaleY = canvasLocalHeight > 0
      ? visibleRect.height / canvasLocalHeight
      : pageRect.height > 0 && pageLocalHeight > 0
        ? pageRect.height / pageLocalHeight
        : 1;
    const pageStyle = activeWindow.getComputedStyle(overlay.pageEl);
    const borderLeft = Number.parseFloat(pageStyle.borderLeftWidth) || 0;
    const borderTop = Number.parseFloat(pageStyle.borderTopWidth) || 0;
    const cssWidth = canvasLocalWidth > 0 ? canvasLocalWidth : visibleRect.width / Math.max(0.01, scaleX);
    const cssHeight = canvasLocalHeight > 0 ? canvasLocalHeight : visibleRect.height / Math.max(0.01, scaleY);

    if (cssWidth <= 0 || cssHeight <= 0) {
      return null;
    }

    return {
      cssHeight,
      cssWidth,
      left: Math.max(0, (visibleRect.left - pageRect.left) / Math.max(0.01, scaleX) - borderLeft),
      top: Math.max(0, (visibleRect.top - pageRect.top) / Math.max(0.01, scaleY) - borderTop)
    };
  }

  private applyOverlayCssGeometry(overlay: PageOverlay, geometry: OverlayGeometry): void {
    const styles = {
      height: `${geometry.cssHeight}px`,
      left: `${geometry.left}px`,
      top: `${geometry.top}px`,
      width: `${geometry.cssWidth}px`
    };
    overlay.staticCanvas.setCssStyles(styles);
    overlay.canvas.setCssStyles(styles);
  }

  private syncOverlayCssGeometry(overlay: PageOverlay): OverlayGeometry | null {
    this.ensureOverlayCanvasMounted(overlay);
    const geometry = this.measureOverlayGeometry(overlay);
    if (geometry) {
      this.applyOverlayCssGeometry(overlay, geometry);
    }
    return geometry;
  }

  private scheduleOverlayResize(overlay: PageOverlay, delay = PDF_ZOOM_SETTLE_DELAY_MS): void {
    if (!this.isOverlayNearViewport(overlay)) {
      if (overlay.resizeTimer !== null && overlay.resizeTimer !== undefined) {
        window.clearTimeout(overlay.resizeTimer);
        overlay.resizeTimer = null;
      }
      return;
    }
    this.syncOverlayCssGeometry(overlay);
    if (overlay.resizeTimer !== null && overlay.resizeTimer !== undefined) {
      window.clearTimeout(overlay.resizeTimer);
    }
    overlay.resizeTimer = window.setTimeout(() => {
      overlay.resizeTimer = null;
      if (this.currentStroke?.pageIndex === overlay.pageIndex) {
        this.scheduleOverlayResize(overlay, 80);
        return;
      }
      if (this.isOverlayNearViewport(overlay)) {
        this.resizeOverlay(overlay);
      }
    }, delay);
  }

  private resizeOverlay(overlay: PageOverlay): boolean {
    const geometry = this.syncOverlayCssGeometry(overlay);
    if (!geometry) {
      this.scheduleScanPages(260);
      return false;
    }
    const cssWidth = geometry.cssWidth;
    const cssHeight = geometry.cssHeight;
    const dpr = Math.max(1, Math.min(OVERLAY_MAX_DPR, activeWindow.devicePixelRatio || 1));
    const bitmapWidth = Math.max(1, Math.round(cssWidth * dpr));
    const bitmapHeight = Math.max(1, Math.round(cssHeight * dpr));
    const geometryUnchanged =
      Math.abs(overlay.cssWidth - cssWidth) < 0.1 &&
      Math.abs(overlay.cssHeight - cssHeight) < 0.1 &&
      overlay.dpr === dpr &&
      overlay.canvas.width === bitmapWidth &&
      overlay.canvas.height === bitmapHeight &&
      overlay.staticCanvas.width === bitmapWidth &&
      overlay.staticCanvas.height === bitmapHeight;
    if (geometryUnchanged) {
      return false;
    }

    overlay.cssWidth = cssWidth;
    overlay.cssHeight = cssHeight;
    overlay.dpr = dpr;
    overlay.staticCanvas.width = bitmapWidth;
    overlay.staticCanvas.height = bitmapHeight;
    overlay.canvas.width = bitmapWidth;
    overlay.canvas.height = bitmapHeight;
    this.redrawOverlay(overlay, this.currentStroke?.pageIndex === overlay.pageIndex ? this.currentStroke : undefined);
    return true;
  }

  private refreshOverlayGeometry(): void {
    for (const overlay of this.overlays.values()) {
      if (this.isOverlayNearViewport(overlay)) {
        this.resizeOverlay(overlay);
      }
    }
  }

  private refreshVisibleOverlays(): void {
    for (const overlay of this.overlays.values()) {
      if (!this.isOverlayNearViewport(overlay)) {
        continue;
      }
      const geometry = this.measureOverlayGeometry(overlay);
      if (!geometry) {
        continue;
      }
      this.applyOverlayCssGeometry(overlay, geometry);
      if (
        overlay.cssWidth <= 0 ||
        overlay.cssHeight <= 0 ||
        Math.abs(overlay.cssWidth - geometry.cssWidth) >= 0.1 ||
        Math.abs(overlay.cssHeight - geometry.cssHeight) >= 0.1
      ) {
        this.requestOverlayRedraw(overlay);
      }
    }
  }

  private scheduleZoomGeometryRefresh(delay = PDF_ZOOM_SETTLE_DELAY_MS): void {
    this.clearZoomGeometryTimer();
    this.zoomGeometryTimer = window.setTimeout(() => {
      this.zoomGeometryTimer = null;
      this.refreshOverlayGeometry();
    }, delay);
  }

  private clearZoomGeometryTimer(): void {
    if (this.zoomGeometryTimer !== null) {
      window.clearTimeout(this.zoomGeometryTimer);
      this.zoomGeometryTimer = null;
    }
  }

  private getOverlayClientRect(overlay: PageOverlay): DOMRectReadOnly {
    const visibleCanvas = overlay.pageEl.querySelector<HTMLCanvasElement>("canvas:not(.pdftion-canvas)");
    const visibleRect = visibleCanvas?.getBoundingClientRect();
    if (visibleRect && visibleRect.width > 0 && visibleRect.height > 0) {
      return visibleRect;
    }

    const canvasRect = overlay.canvas.getBoundingClientRect();
    if (canvasRect.width > 0 && canvasRect.height > 0) {
      return canvasRect;
    }

    return overlay.pageEl.getBoundingClientRect();
  }

  private getOverlayInputPoint(overlay: PageOverlay, clientX: number, clientY: number): InkPoint {
    const rect = this.getOverlayClientRect(overlay);
    return {
      x: clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1),
      y: clamp((clientY - rect.top) / Math.max(1, rect.height), 0, 1)
    };
  }

  private ensureOverlayCanvasMounted(overlay: PageOverlay): boolean {
    if (!this.rootEl.contains(overlay.pageEl)) {
      return false;
    }

    overlay.pageEl.classList.add("pdftion-page");
    let changed = false;
    if (overlay.staticCanvas.parentElement !== overlay.pageEl) {
      overlay.pageEl.appendChild(overlay.staticCanvas);
      changed = true;
    }
    if (overlay.canvas.parentElement !== overlay.pageEl || overlay.pageEl.lastElementChild !== overlay.canvas) {
      overlay.pageEl.appendChild(overlay.canvas);
      changed = true;
    }
    if (overlay.staticCanvas.nextElementSibling !== overlay.canvas) {
      overlay.pageEl.insertBefore(overlay.staticCanvas, overlay.canvas);
      changed = true;
    }
    return changed;
  }

  private startOverlayHealthCheck(): void {
    if (this.healthTimer !== null) {
      return;
    }
    this.healthTimer = window.setInterval(() => this.repairActiveOverlays(), OVERLAY_HEALTH_CHECK_MS);
  }

  private stopOverlayHealthCheck(): void {
    if (this.healthTimer !== null) {
      window.clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  private startNativeAnnotationPopupSuppressor(): void {
    if (this.nativeAnnotationPopupTimer !== null) {
      return;
    }
    this.nativeAnnotationPopupTimer = window.setInterval(() => this.hideNativePdfAnnotationPopups(), 180);
  }

  private stopNativeAnnotationPopupSuppressor(): void {
    if (this.nativeAnnotationPopupTimer !== null) {
      window.clearInterval(this.nativeAnnotationPopupTimer);
      this.nativeAnnotationPopupTimer = null;
    }
    this.nativePopupSuppressUntil = 0;
    this.clearNativePopupHideTimers();
    this.hideNativePdfAnnotationPopups();
  }

  private clearNativePopupHideTimers(): void {
    for (const timer of this.nativePopupHideTimers) {
      window.clearTimeout(timer);
    }
    this.nativePopupHideTimers.clear();
  }

  private suppressNativePdfPopupBurst(duration = NATIVE_POPUP_SUPPRESS_MS): void {
    this.clearNativePopupHideTimers();
    this.nativePopupSuppressUntil = Math.max(this.nativePopupSuppressUntil, Date.now() + duration);
    this.hideNativePdfAnnotationPopups();
    for (const delay of [0, 16, 60, 160, 320, duration]) {
      const timer = window.setTimeout(() => {
        this.nativePopupHideTimers.delete(timer);
        if (this.enabled || Date.now() <= this.nativePopupSuppressUntil) {
          this.hideNativePdfAnnotationPopups();
        }
      }, delay);
      this.nativePopupHideTimers.add(timer);
    }
  }

  private repairActiveOverlays(): void {
    if (!this.enabled || this.isInteracting()) {
      return;
    }

    let repaired = false;
    this.cleanupDetachedOverlays();
    for (const overlay of this.overlays.values()) {
      const wasMounted = this.ensureOverlayCanvasMounted(overlay);
      this.observeOverlayResize(overlay);
      if (!this.isOverlayNearViewport(overlay)) {
        continue;
      }
      const geometry = this.syncOverlayCssGeometry(overlay);
      const sizeChanged = Boolean(
        geometry &&
        (Math.abs(overlay.cssWidth - geometry.cssWidth) >= 0.1 || Math.abs(overlay.cssHeight - geometry.cssHeight) >= 0.1)
      );
      if (wasMounted || sizeChanged) {
        this.resizeOverlay(overlay);
        repaired = true;
      }
    }

    if (repaired) {
      this.redrawAll();
      void this.prepareEditableInkForCurrentPage();
      return;
    }

    void this.prepareEditableInkForCurrentPage();
    this.scheduleScanPages(0);
  }

  private setEnabled(enabled: boolean, options: { notice?: boolean } = {}): void {
    this.enabled = enabled;
    this.rootEl.classList.toggle("pdftion-enabled", this.enabled);
    this.rootEl.classList.toggle("pdftion-selecting", this.enabled && (this.tool === "select" || this.tool === "image-crop"));
    this.plugin.refreshGlobalEditingClass();
    this.updateButtonState();

    if (this.enabled) {
      this.pendingEditableInkPrepareAfterSave = false;
      this.detachedInkEditPages.clear();
      this.showToolbar();
      this.scanPages();
      this.primeNativeInkHidingForCurrentPages(true);
      this.startOverlayHealthCheck();
      this.startNativeAnnotationPopupSuppressor();
      this.scheduleEditableInkPrepare(0, true);
      window.setTimeout(() => this.scheduleEditableInkPrepare(0, true), 260);
      window.setTimeout(() => this.scheduleEditableInkPrepare(0, true), 760);
      if (options.notice !== false) {
        new Notice(uiText("PDF 批注已开启。", "PDF annotation enabled."));
      }
    } else {
      this.stopOverlayHealthCheck();
      this.stopNativeAnnotationPopupSuppressor();
      this.clearCurrentStroke();
      this.recentInkGroup = null;
      this.selectionDrag = null;
      this.pendingImageCrop = null;
      this.pendingNativeInkHidePages.clear();
      this.clearEditableSelection();
      this.palette?.remove();
      this.palette = null;
      this.imageMenu?.remove();
      this.imageMenu = null;
      this.shareMenu?.remove();
      this.shareMenu = null;
      this.toolbar?.remove();
      this.toolbar = null;
      if (this.hasPendingPdfWrite()) {
        this.scheduleAutoSave(AUTO_SAVE_CLOSE_DELAY_MS);
      }
      this.redrawAll();
    }
  }

  private async prepareEditableInkForCurrentPage(force = false): Promise<void> {
    try {
      await this.loadEditableAnnotations();
      if (!this.enabled) {
        return;
      }
      if (this.saving) {
        this.pendingEditableInkPrepareAfterSave = true;
        return;
      }
      const pageIndexes = this.getCurrentInkPreparePages(force);
      if (pageIndexes.size === 0) {
        return;
      }
      this.preparePdfInkOverlayForEditing(pageIndexes);
    } catch (error) {
      console.warn("pdftion could not prepare PDF ink for editable mode.", error);
    }
  }

  private scheduleEditableInkPrepare(delay = 160, force = false): void {
    if (!this.enabled) {
      return;
    }
    const shouldForce = force || this.inkPrepareTimerForce;
    this.clearEditableInkPrepareTimer();
    this.inkPrepareTimerForce = shouldForce;
    this.inkPrepareTimer = window.setTimeout(() => {
      const runForce = this.inkPrepareTimerForce;
      this.inkPrepareTimerForce = false;
      this.inkPrepareTimer = null;
      void this.prepareEditableInkForCurrentPage(runForce);
    }, delay);
  }

  private clearEditableInkPrepareTimer(): void {
    if (this.inkPrepareTimer !== null) {
      window.clearTimeout(this.inkPrepareTimer);
      this.inkPrepareTimer = null;
    }
    this.inkPrepareTimerForce = false;
  }

  private getCurrentInkPreparePages(force = false): Set<number> {
    const pages = new Set<number>();
    const viewportHeight = activeWindow.innerHeight || activeDocument.documentElement.clientHeight || 1;
    const margin = force ? 160 : 80;
    for (const overlay of this.overlays.values()) {
      if (this.detachedInkEditPages.has(overlay.pageIndex)) {
        continue;
      }
      const rect = overlay.pageEl.getBoundingClientRect();
      if (rect.bottom >= -margin && rect.top <= viewportHeight + margin) {
        pages.add(overlay.pageIndex);
      }
    }
    if (pages.size === 0) {
      const overlay = this.getVisibleOverlay() ?? Array.from(this.overlays.values()).sort((a, b) => a.pageIndex - b.pageIndex)[0];
      if (overlay && !this.detachedInkEditPages.has(overlay.pageIndex)) {
        pages.add(overlay.pageIndex);
      }
    }
    return pages;
  }

  private preparePdfInkOverlayForEditing(pageIndexes: Set<number>): void {
    if (pageIndexes.size === 0 || this.preparingPdfInkForEditing) {
      return;
    }

    this.preparingPdfInkForEditing = true;
    try {
      for (const pageIndex of pageIndexes) {
        this.pendingNativeInkHidePages.add(pageIndex);
      }
      this.updateExternalInkLayerState();

      for (const pageIndex of pageIndexes) {
        this.detachedInkEditPages.add(pageIndex);
        this.pendingNativeInkHidePages.delete(pageIndex);
      }
      this.updateExternalInkLayerState();
      this.redrawAll();
    } catch (error) {
      console.warn("pdftion could not prepare PDF ink annotations for editing.", error);
    } finally {
      this.preparingPdfInkForEditing = false;
    }
  }

  private async importPdfInkForPages(pageIndexes: Set<number>): Promise<boolean> {
    if (pageIndexes.size === 0) {
      return false;
    }
    const targetPath = this.file.path;
    const pdfInkStrokes = await this.plugin.loadPdfInkAnnotations(this.file, pageIndexes);
    if (this.file.path !== targetPath || pdfInkStrokes.length === 0) {
      return false;
    }

    let changed = false;
    for (const stroke of pdfInkStrokes) {
      changed = this.mergePdfInkStrokeForEditing(stroke) || changed;
    }
    if (changed) {
      this.savedInkIsBurnedIntoPdf = this.strokeHistory.some((stroke) => !Array.isArray(stroke.pdfPoints)) && this.savedInkIsBurnedIntoPdf;
      this.dirty = true;
    }
    return changed;
  }

  private mergePdfInkStrokeForEditing(stroke: InkStroke): boolean {
    const existing = this.strokeHistory.find((candidate) => (
      candidate.id === stroke.id ||
      isSamePdfInkStrokeCandidate(candidate, stroke)
    ));
    const pdfPoints = (stroke.pdfPoints ?? stroke.points).map((point) => ({ ...point }));

    if (!existing) {
      this.strokeHistory.push({
        ...stroke,
        externalDirty: false,
        pdfPoints,
        pdfSaved: true,
        points: stroke.points.map((point) => ({ ...point })),
        saved: false
      });
      return true;
    }

    let changed = false;
    const canRefreshFromPdf = existing.saved && existing.pdfSaved !== false && existing.externalDirty !== true;
    if (canRefreshFromPdf && !inkStrokesEquivalentForPdf(existing, stroke)) {
      existing.points = stroke.points.map((point) => ({ ...point }));
      existing.color = stroke.color;
      existing.opacity = stroke.opacity;
      existing.pageCssHeight = stroke.pageCssHeight;
      existing.pageCssWidth = stroke.pageCssWidth;
      existing.groupId = stroke.groupId;
      existing.tool = stroke.tool;
      existing.width = stroke.width;
      changed = true;
    }
    if (!existing.pdfPoints || !inkPointsApproximatelyEqual(existing.pdfPoints, pdfPoints)) {
      existing.pdfPoints = pdfPoints;
      changed = true;
    }
    if (existing.pdfSaved !== false && existing.pdfSaved !== true) {
      existing.pdfSaved = true;
      changed = true;
    }
    if (!existing.source && stroke.source) {
      existing.source = stroke.source;
      changed = true;
    }
    if (existing.pdfSaved === true && existing.externalDirty === true) {
      existing.externalDirty = false;
      changed = true;
    }
    if (changed && existing.saved) {
      existing.saved = false;
    }
    return changed;
  }

  private updateButtonState(): void {
    this.button?.classList.toggle("is-active", this.enabled);
  }

  private showToolbar(): void {
    if (this.toolbar?.isConnected) {
      this.updateToolbarState();
      return;
    }

    const toolbar = activeDocument.createElement("div");
    toolbar.className = "pdftion-toolbar";

    const dragHandle = createIconButton("grip-horizontal", uiText("拖动工具栏", "Move toolbar"));
    dragHandle.classList.add("pdftion-drag-handle");
    this.attachToolbarDragHandle(dragHandle);
    toolbar.appendChild(dragHandle);

    const select = createIconButton("mouse-pointer-2", uiText("选择", "Select"));
    select.dataset.tool = "select";
    select.addEventListener("click", () => this.setTool("select"));
    toolbar.appendChild(select);

    const pen = createIconButton("pen-line", uiText("笔", "Pen"));
    pen.dataset.tool = "pen";
    pen.classList.add("pdftion-color-tool", "pdftion-pen-button");
    pen.addEventListener("click", () => this.setTool("pen"));
    toolbar.appendChild(pen);

    const highlighter = createIconButton("highlighter", uiText("水彩", "Highlighter"));
    highlighter.dataset.tool = "highlight";
    highlighter.classList.add("pdftion-color-tool", "pdftion-highlight-button");
    highlighter.addEventListener("click", () => this.setTool("highlight"));
    toolbar.appendChild(highlighter);

    const text = createIconButton("type", uiText("文字", "Text"));
    text.dataset.tool = "text";
    text.classList.add("pdftion-color-tool", "pdftion-text-button");
    text.addEventListener("click", () => this.setTool("text"));
    toolbar.appendChild(text);

    const image = createIconButton("image", uiText("图片", "Image"));
    image.classList.add("pdftion-image-button");
    image.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.toggleImageMenu();
    });
    toolbar.appendChild(image);

    const eraser = createIconButton("eraser", uiText("橡皮", "Eraser"));
    eraser.dataset.tool = "eraser";
    eraser.addEventListener("click", () => this.setTool("eraser"));
    toolbar.appendChild(eraser);

    const palette = createIconButton("palette", uiText("颜色与大小", "Color and size"));
    palette.classList.add("pdftion-color-tool", "pdftion-palette-button");
    palette.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.togglePalette();
    });
    toolbar.appendChild(palette);

    const undo = createIconButton("undo-2", uiText("撤销", "Undo"));
    undo.addEventListener("click", () => this.undo());
    toolbar.appendChild(undo);

    const redo = createIconButton("redo-2", uiText("重做", "Redo"));
    redo.addEventListener("click", () => this.redo());
    toolbar.appendChild(redo);

    const exportPdf = createIconButton("share-2", uiText("分享/导出", "Share/export"));
    exportPdf.classList.add("pdftion-share-button");
    exportPdf.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.toggleShareMenu();
    });
    toolbar.appendChild(exportPdf);

    const navigator = createIconButton("list", uiText("页面/标注导航", "Page/annotation navigator"));
    navigator.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.showPageNavigator();
    });
    toolbar.appendChild(navigator);

    const clear = createIconButton("trash-2", uiText("删除选中/清空标注", "Delete selection/clear annotations"));
    clear.addEventListener("click", () => void this.clearUnsavedInk());
    toolbar.appendChild(clear);

    (this.ensureToolbarHost() ?? activeDocument.body).appendChild(toolbar);
    this.toolbar = toolbar;
    this.updateToolbarState();
  }

  private ensureToolbarHost(): HTMLElement | null {
    const placement = this.getToolbarHostPlacement();
    const existingHosts = Array.from(
      placement.container.querySelectorAll<HTMLElement>(":scope > .pdftion-toolbar-host")
    );
    let host =
      this.toolbarHost?.isConnected && this.toolbarHost.parentElement === placement.container
        ? this.toolbarHost
        : existingHosts[0] ?? null;

    if (!host) {
      host = activeDocument.createElement("div");
      host.className = "pdftion-toolbar-host";
    }

    if (
      placement.before !== host &&
      (host.parentElement !== placement.container || host.nextElementSibling !== placement.before)
    ) {
      placement.container.insertBefore(host, placement.before);
    }

    for (const duplicate of existingHosts) {
      if (duplicate !== host) {
        duplicate.remove();
      }
    }

    this.toolbarHost = host;
    return host;
  }

  private attachToolbarDragHandle(handle: HTMLElement): void {
    handle.addEventListener("pointerdown", (event) => {
      if (!this.toolbarHost) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const startRect = (this.toolbar ?? this.toolbarHost).getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const host = this.toolbarHost;
      handle.setPointerCapture?.(event.pointerId);
      host.classList.add("is-floating");
      host.classList.add("is-dragging");
      host.setCssStyles({
        height: `${startRect.height}px`,
        left: `${startRect.left}px`,
        top: `${startRect.top}px`,
        transform: "translate3d(0, 0, 0)",
        width: `${startRect.width}px`
      });
      let dragX = 0;
      let dragY = 0;
      let frame = 0;

      const applyTransform = (): void => {
        frame = 0;
        host.setCssStyles({ transform: `translate3d(${dragX}px, ${dragY}px, 0)` });
      };

      const move = (moveEvent: PointerEvent): void => {
        const maxLeft = Math.max(0, activeWindow.innerWidth - host.offsetWidth);
        const maxTop = Math.max(0, activeWindow.innerHeight - host.offsetHeight);
        dragX = clamp(startRect.left + moveEvent.clientX - startX, 0, maxLeft) - startRect.left;
        dragY = clamp(startRect.top + moveEvent.clientY - startY, 0, maxTop) - startRect.top;
        if (frame === 0) {
          frame = window.requestAnimationFrame(applyTransform);
        }
      };
      const up = (): void => {
        if (frame !== 0) {
          activeWindow.cancelAnimationFrame(frame);
          frame = 0;
        }
        host.setCssStyles({
          left: `${startRect.left + dragX}px`,
          top: `${startRect.top + dragY}px`,
          transform: ""
        });
        host.classList.remove("is-dragging");
        handle.releasePointerCapture?.(event.pointerId);
        activeWindow.removeEventListener("pointermove", move, true);
        activeWindow.removeEventListener("pointerup", up, true);
        activeWindow.removeEventListener("pointercancel", up, true);
      };
      activeWindow.addEventListener("pointermove", move, true);
      activeWindow.addEventListener("pointerup", up, true);
      activeWindow.addEventListener("pointercancel", up, true);
    });
  }

  private getToolbarHostPlacement(): { container: HTMLElement; before: HTMLElement | null } {
    const viewer = this.rootEl.querySelector<HTMLElement>(".pdf-viewer, .pdfViewer, .pdf-container");
    if (viewer?.parentElement) {
      return { container: viewer.parentElement, before: viewer };
    }

    const firstChild = this.rootEl.firstElementChild as HTMLElement | null;
    return {
      container: this.rootEl,
      before: firstChild?.classList.contains("pdftion-toolbar-host")
        ? (firstChild.nextElementSibling as HTMLElement | null)
        : firstChild
    };
  }

  private updateToolbarState(): void {
    if (!this.toolbar) {
      return;
    }

    for (const button of Array.from(this.toolbar.querySelectorAll("[data-tool]")).filter(isHTMLElement)) {
      button.classList.toggle("is-active", button.dataset.tool === this.tool);
    }
    this.toolbar.querySelector<HTMLElement>(".pdftion-image-button")?.classList.toggle("is-active", this.tool === "image-crop");
    this.setToolbarIconColor(".pdftion-pen-button", this.penColor);
    this.setToolbarIconColor(".pdftion-highlight-button", this.highlightColor);
    this.setToolbarIconColor(".pdftion-text-button", this.getTextPaletteColor());
    this.setToolbarIconColor(".pdftion-palette-button", this.getCurrentPaletteColor());

    const colorButtons = this.palette ? Array.from(this.palette.querySelectorAll(".pdftion-color")).filter(isHTMLElement) : [];
    for (const colorButton of colorButtons) {
      const target = colorButton.dataset.target;
      const activeColor = this.getPaletteColorForTarget(target);
      const colorInput = colorButton.querySelector<HTMLInputElement>("input[type='color']");
      colorButton.setCssProps({ "--pdftion-current-color": activeColor });
      if (colorInput) {
        colorInput.value = activeColor;
      }
      const isAdvanced = colorButton.classList.contains("pdftion-color-advanced");
      const swatchColor = normalizeHexColor(colorButton.dataset.color ?? colorButton.title);
      colorButton.classList.toggle("is-active", isAdvanced ? !PALETTE_COLORS.includes(activeColor) : swatchColor === activeColor);
    }

    this.updatePaletteState();
  }

  private setToolbarIconColor(selector: string, color: string): void {
    this.toolbar?.querySelector<HTMLElement>(selector)?.setCssProps({
      "--pdftion-tool-color": normalizeHexColor(color)
    });
  }

  private getCurrentPaletteColor(): string {
    if (this.hasEditableSelection()) {
      return this.getSelectedPaletteColor();
    }
    if (this.tool === "highlight") {
      return normalizeHexColor(this.highlightColor);
    }
    if (this.tool === "text" || this.hasSelectedText()) {
      return normalizeHexColor(this.getTextPaletteColor());
    }
    return normalizeHexColor(this.penColor);
  }

  private getPaletteColorForTarget(target: string | undefined): string {
    if (target === "selection") {
      return this.getSelectedPaletteColor();
    }
    if (target === "highlight") {
      return normalizeHexColor(this.highlightColor);
    }
    if (target === "text") {
      return normalizeHexColor(this.getTextPaletteColor());
    }
    return normalizeHexColor(this.penColor);
  }

  private setTool(tool: ToolMode): void {
    if (this.tool !== tool) {
      this.recentInkGroup = null;
    }
    this.tool = tool;
    this.rootEl.classList.toggle("pdftion-selecting", this.enabled && (this.tool === "select" || this.tool === "image-crop"));
    if (tool !== "select" && tool !== "image-crop") {
      this.selectionDrag = null;
      this.nativeSelection = null;
      this.pendingImageCrop = null;
      if (tool === "eraser" || tool === "cover") {
        this.clearEditableSelection();
      }
      this.redrawAll();
    }
    if (tool === "select" || tool === "image-crop") {
      this.palette?.remove();
      this.palette = null;
      if (tool === "image-crop") {
        new Notice(uiText("拖拽框选 PDF 区域，截取为可编辑图片。", "Drag a PDF region to capture it as an editable image."));
      }
      this.updateToolbarState();
      return;
    }
    this.imageMenu?.remove();
    this.imageMenu = null;
    this.shareMenu?.remove();
    this.shareMenu = null;
    if (this.palette?.isConnected) {
      this.showPalette();
    }
    this.updateToolbarState();
  }

  private toggleImageMenu(): void {
    if (this.imageMenu?.isConnected) {
      this.imageMenu.remove();
      this.imageMenu = null;
      return;
    }
    this.shareMenu?.remove();
    this.shareMenu = null;
    this.showImageMenu();
  }

  private showImageMenu(): void {
    this.imageMenu?.remove();
    const button = this.toolbar?.querySelector<HTMLElement>(".pdftion-image-button");
    const panel = activeDocument.createElement("div");
    panel.className = "pdftion-image-menu";

    const capture = createIconButton("scan-line", uiText("截取图片", "Capture image"));
    capture.classList.add("pdftion-image-menu-button");
    capture.addEventListener("click", () => {
      panel.remove();
      this.imageMenu = null;
      this.setTool("image-crop");
    });
    panel.appendChild(capture);

    const insert = createIconButton("image-plus", uiText("插入图片", "Insert image"));
    insert.classList.add("pdftion-image-menu-button");
    insert.addEventListener("click", () => {
      panel.remove();
      this.imageMenu = null;
      void this.pickAndInsertImageFile();
    });
    panel.appendChild(insert);

    appendToActiveBody(panel);
    const rect = button?.getBoundingClientRect();
    const fallbackTop = Math.max(76, (this.toolbarHost?.getBoundingClientRect().bottom ?? 68) + 6);
    panel.setCssStyles({
      left: `${Math.min(activeWindow.innerWidth - 190, Math.max(8, rect ? rect.left : 16))}px`,
      top: `${Math.min(activeWindow.innerHeight - 96, Math.max(8, rect ? rect.bottom + 6 : fallbackTop))}px`
    });
    this.imageMenu = panel;
  }

  private toggleShareMenu(): void {
    if (this.shareMenu?.isConnected) {
      this.shareMenu.remove();
      this.shareMenu = null;
      return;
    }
    this.imageMenu?.remove();
    this.imageMenu = null;
    this.showShareMenu();
  }

  private showShareMenu(): void {
    this.shareMenu?.remove();
    const button = this.toolbar?.querySelector<HTMLElement>(".pdftion-share-button");
    const panel = activeDocument.createElement("div");
    panel.className = "pdftion-share-menu";

    const pdf = createIconButton("file-output", uiText("导出 PDF", "Export PDF"));
    pdf.classList.add("pdftion-share-menu-button");
    pdf.addEventListener("click", () => {
      panel.remove();
      this.shareMenu = null;
      void this.exportAnnotatedPdf();
    });
    panel.appendChild(pdf);

    const docx = createIconButton("file-type-2", uiText("导出 DOCX", "Export DOCX"));
    docx.classList.add("pdftion-share-menu-button");
    docx.addEventListener("click", () => {
      panel.remove();
      this.shareMenu = null;
      void this.exportConvertedDocx();
    });
    panel.appendChild(docx);

    const md = createIconButton("file-text", uiText("导出 MD", "Export MD"));
    md.classList.add("pdftion-share-menu-button");
    md.addEventListener("click", () => {
      panel.remove();
      this.shareMenu = null;
      void this.exportConvertedMarkdown();
    });
    panel.appendChild(md);

    appendToActiveBody(panel);
    const rect = button?.getBoundingClientRect();
    const fallbackTop = Math.max(76, (this.toolbarHost?.getBoundingClientRect().bottom ?? 68) + 6);
    panel.setCssStyles({
      left: `${Math.min(activeWindow.innerWidth - 190, Math.max(8, rect ? rect.left : 16))}px`,
      top: `${Math.min(activeWindow.innerHeight - 96, Math.max(8, rect ? rect.bottom + 6 : fallbackTop))}px`
    });
    this.shareMenu = panel;
  }

  private onPointerDown(event: PointerEvent, overlay: PageOverlay): void {
    if (!this.enabled) {
      return;
    }
    if (event.pointerType === "touch") {
      return;
    }

    this.suppressNativePdfPopupBurst();
    event.preventDefault();
    event.stopPropagation();
    this.resizeOverlay(overlay);
    const point = this.getOverlayInputPoint(overlay, event.clientX, event.clientY);
    if (event.detail >= 2 && this.openEditorAtPoint(point, overlay)) {
      return;
    }
    overlay.canvas.setPointerCapture(event.pointerId);
    this.beginInkInteraction(point, overlay);
  }

  private onDoubleClick(event: MouseEvent, overlay: PageOverlay): void {
    if (!this.enabled) {
      return;
    }
    this.suppressNativePdfPopupBurst();
    event.preventDefault();
    event.stopPropagation();
    this.resizeOverlay(overlay);
    this.openEditorAtPoint(this.getOverlayInputPoint(overlay, event.clientX, event.clientY), overlay);
  }

  private openEditorAtPoint(point: InkPoint, overlay: PageOverlay): boolean {
    const element = this.findTextElementAt(overlay, point) ?? this.findElementAt(overlay, point);
    if (element?.kind === "text") {
      this.clearCurrentStroke();
      this.currentCover = null;
      this.selectionDrag = null;
      this.setSingleSelectedElement(element.id);
      this.nativeSelection = null;
      this.openExistingTextEditor(element, overlay);
      this.redrawAll();
      return true;
    }
    if (this.findCoverElementAt(overlay, point)) {
      return false;
    }
    const native = this.findNativeObjectAt(overlay, point);
    if (native?.kind === "text") {
      this.clearCurrentStroke();
      this.currentCover = null;
      this.selectionDrag = null;
      this.clearEditableSelection();
      this.openNativeTextEditor(native, overlay);
      this.redrawAll();
      return true;
    }
    return false;
  }

  private beginInkInteraction(point: InkPoint, overlay: PageOverlay): void {
    const hitElement = this.findElementAt(overlay, point);
    if (this.tool === "image-crop") {
      if (this.pendingImageCrop?.pageIndex === overlay.pageIndex && nativeRegionContainsPoint(this.pendingImageCrop, point)) {
        const region = this.pendingImageCrop;
        this.pendingImageCrop = null;
        this.nativeSelection = null;
        if (this.convertNativeRegionToImage(region, overlay)) {
          this.selectionDrag = {
            current: point,
            mode: "move",
            moved: false,
            pageIndex: overlay.pageIndex,
            start: point
          };
          this.redrawAll();
        } else {
          this.selectionDrag = null;
        }
        return;
      }
      this.clearEditableSelection();
      this.pendingImageCrop = null;
      this.selectionDrag = {
        current: point,
        mode: "marquee",
        moved: false,
        pageIndex: overlay.pageIndex,
        start: point
      };
      this.redrawAll();
      return;
    }

    const tool = this.tool;
    const drawingTool = this.isDrawingToolMode(tool);
    const startsInsideEditableSelection = this.findSelectionHandleAt(overlay, point) !== null || this.selectionBoxContainsPoint(overlay, point);
    const canDragSelection =
      tool !== "eraser" &&
      tool !== "cover" &&
      !drawingTool &&
      this.hasEditableSelection(overlay.pageIndex) &&
      startsInsideEditableSelection &&
      this.canMoveFreshSelection() &&
      this.canDragSelectedElements(overlay.pageIndex);
    if (canDragSelection) {
      this.beginSelectionInteraction(point, overlay);
      return;
    }

    if (drawingTool) {
      this.selectionDrag = null;
      this.currentStrokeMoved = false;
      this.currentStrokeHadTouchMove = false;
      this.currentStrokeStartedAt = Date.now();
      this.currentStroke = {
        color: this.getToolColor(tool),
        createdAt: this.currentStrokeStartedAt,
        id: makeStrokeId(),
        kind: "stroke",
        opacity: this.getToolOpacity(tool),
        pageCssHeight: overlay.cssHeight,
        pageCssWidth: overlay.cssWidth,
        pageIndex: overlay.pageIndex,
        points: [point],
        saved: false,
        tool,
        width: this.getToolWidth(tool)
      };
      this.redrawOverlay(overlay, this.currentStroke);
      return;
    }

    if (hitElement && !drawingTool && tool !== "eraser" && tool !== "cover") {
      this.beginSelectionInteraction(point, overlay);
      return;
    }

    if (tool === "select") {
      this.beginSelectionInteraction(point, overlay);
      return;
    }

    if (tool === "eraser") {
      this.eraseAt(overlay, point);
      return;
    }

    if (tool === "text") {
      this.addTextAnnotation(point, overlay);
      return;
    }

    if (tool === "cover") {
      this.currentCover = {
        color: "#ffffff",
        height: 0.001,
        id: makeStrokeId(),
        kind: "cover",
        opacity: 1,
        pageCssHeight: overlay.cssHeight,
        pageCssWidth: overlay.cssWidth,
        pageIndex: overlay.pageIndex,
        saved: false,
        width: 0.001,
        x: point.x,
        y: point.y
      };
      return;
    }

  }

  private addTextAnnotation(point: InkPoint, overlay: PageOverlay): void {
    const textElement: InkText = {
      color: this.textColor,
      fontFamily: this.textFontFamily,
      fontSize: this.textFontSize,
      id: makeStrokeId(),
      kind: "text",
      opacity: this.textOpacity,
      pageCssHeight: overlay.cssHeight,
      pageCssWidth: overlay.cssWidth,
      pageIndex: overlay.pageIndex,
      saved: false,
      text: "",
      x: point.x,
      y: point.y
    };

    this.rememberHistory();
    this.textHistory.push(textElement);
    this.redoStack = [];
    this.setSingleSelectedElement(textElement.id);
    this.markDirty();
    this.redrawOverlay(overlay);
    this.openExistingTextEditor(textElement, overlay);
  }

  private openNativeTextEditor(selection: PdfNativeObject, overlay: PageOverlay): void {
    this.closeNativeTextEditor(false);
    this.suppressNativePdfPopupBurst();
    const overlayRect = this.getOverlayClientRect(overlay);
    const x = selection.x * overlay.cssWidth;
    const y = selection.y * overlay.cssHeight;
    const rawWidth = selection.width * overlay.cssWidth;
    const rawHeight = selection.height * overlay.cssHeight;
    const editorPadX = Math.max(4, Math.min(14, rawHeight * 0.35));
    const editorPadY = Math.max(2, Math.min(8, rawHeight * 0.18));
    const editorX = Math.max(0, x - editorPadX);
    const editorY = Math.max(0, y - editorPadY * 0.65);
    const editorWidth = Math.min(overlay.cssWidth - editorX, Math.max(42, rawWidth + editorPadX * 2.5));
    const editorHeight = Math.min(overlay.cssHeight - editorY, Math.max(26, rawHeight + editorPadY * 2.4));
    const editor = activeDocument.createElement("textarea");
    editor.className = "pdftion-native-editor";
    editor.classList.add("is-native-text-editor");
    editor.value = selection.text ?? "";
    const sampledBackground = this.samplePdfBackgroundColor(overlay, selection);
    this.nativeTextEditorCover = this.createNativeTextCover(selection, overlay, sampledBackground, false);
    this.redrawOverlay(overlay);
    editor.dataset.coverColor = sampledBackground;
    editor.setCssStyles({
      backgroundColor: sampledBackground,
      borderColor: "#1c7ed6",
      color: readableTextColor(sampledBackground),
      fontSize: `${Math.max(8, rawHeight * 0.82)}px`,
      height: `${editorHeight}px`,
      left: `${overlayRect.left + editorX}px`,
      lineHeight: "1.15",
      top: `${overlayRect.top + editorY}px`,
      width: `${editorWidth}px`
    });

    const commit = (): void => {
      if (this.nativeTextEditor !== editor) {
        return;
      }
      const value = editor.value.trim();
      this.closeNativeTextEditor(false);
      if (!value || value === (selection.text ?? "").trim()) {
        return;
      }
      this.replaceNativeSelectionWithText(selection, overlay, value, editor.dataset.coverColor ?? sampledBackground);
    };

    editor.addEventListener("blur", commit);
    editor.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        this.closeNativeTextEditor(false);
      } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        commit();
      }
    });
    editor.addEventListener("input", () => {
      // Keep the native text editor locked to the selected text box.
    });

    appendToActiveBody(editor);
    this.nativeTextEditor = editor;
    focusTextEditor(editor);
  }

  private openExistingTextEditor(textElement: InkText, overlay: PageOverlay): void {
    this.closeNativeTextEditor(false);
    this.suppressNativePdfPopupBurst();
    const overlayRect = this.getOverlayClientRect(overlay);
    const bounds = textBounds(textElement, overlay.cssWidth, overlay.cssHeight);
    const editor = activeDocument.createElement("textarea");
    editor.className = "pdftion-native-editor";
    editor.value = textElement.text;
    const estimatedWidth = estimateTextEditorWidth(editor.value, textElement.fontSize, bounds.maxX - bounds.minX);
    editor.setCssStyles({
      backgroundColor: "rgba(255, 255, 255, 0.92)",
      color: textElement.color,
      fontFamily: textElement.fontFamily ?? "sans-serif",
      fontSize: `${textElement.fontSize}px`,
      height: `${Math.max(24, bounds.maxY - bounds.minY + 8)}px`,
      left: `${overlayRect.left + bounds.minX}px`,
      lineHeight: "1.15",
      top: `${overlayRect.top + bounds.minY}px`,
      width: `${Math.min(Math.max(48, estimatedWidth + 24), Math.max(80, activeWindow.innerWidth - (overlayRect.left + bounds.minX) - 12))}px`
    });

    const commit = (): void => {
      if (this.nativeTextEditor !== editor) {
        return;
      }
      const value = editor.value.trim();
      this.closeNativeTextEditor(false);
      if (!value) {
        if (textElement.text.trim()) {
          this.rememberHistory();
        }
        this.removeElementById(textElement.id);
        this.selectedStrokeIds.delete(textElement.id);
        this.markDirty();
        this.redrawOverlay(overlay);
        this.scheduleAutoSave();
        return;
      }
      if (value === textElement.text.trim()) {
        return;
      }
      this.rememberHistory();
      textElement.text = value;
      textElement.saved = false;
      this.markDirty();
      this.redrawOverlay(overlay);
      this.scheduleAutoSave();
    };

    editor.addEventListener("blur", commit);
    editor.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        this.closeNativeTextEditor(false);
      } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        commit();
      }
    });
    editor.addEventListener("input", () => {
      editor.setCssStyles({ height: `${Math.max(24, editor.scrollHeight)}px` });
    });

    appendToActiveBody(editor);
    this.nativeTextEditor = editor;
    focusTextEditor(editor);
  }

  private closeNativeTextEditor(commit: boolean): void {
    const editor = this.nativeTextEditor;
    if (!editor) {
      return;
    }
    this.nativeTextEditor = null;
    const tempCover = this.nativeTextEditorCover;
    this.nativeTextEditorCover = null;
    if (commit) {
      editor.blur();
      return;
    }
    editor.remove();
    if (tempCover) {
      const overlay = this.findOverlayByPageIndex(tempCover.pageIndex);
      if (overlay) {
        this.redrawOverlay(overlay);
      }
    }
  }

  commitNativeTextEditor(): void {
    const editor = this.nativeTextEditor;
    if (!editor) {
      return;
    }
    editor.blur();
  }

  private clearNativeTextSelectionTimer(): void {
    if (this.nativeTextSelectionTimer !== null) {
      window.clearTimeout(this.nativeTextSelectionTimer);
      this.nativeTextSelectionTimer = null;
    }
  }

  private scheduleNativeTextSelectionMenu(delay = 100): void {
    this.clearNativeTextSelectionTimer();
    this.nativeTextSelectionTimer = window.setTimeout(() => {
      this.nativeTextSelectionTimer = null;
      this.updateNativeTextSelectionMenu();
    }, delay);
  }

  private updateNativeTextSelectionMenu(): void {
    if (this.nativeTextEditor) {
      this.hideNativeTextSelectionMenu();
      return;
    }

    const info = this.getNativeTextSelectionInfo();
    if (!info) {
      this.hideNativeTextSelectionMenu();
      return;
    }
    this.showNativeTextSelectionMenu(info);
  }

  private getNativeTextSelectionInfo(): NativeTextSelectionInfo | null {
    const selection = activeDocument.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return null;
    }

    const limits = getNativeSelectionLimits();
    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;
    if ((!anchorNode || !this.rootEl.contains(anchorNode)) && (!focusNode || !this.rootEl.contains(focusNode))) {
      return null;
    }

    const text = selection.toString().replace(/\s+/g, " ").trim();
    if (!text) {
      return null;
    }
    if (text.length > limits.maxChars) {
      if (limits.clearExcessive) {
        clearNativeSelectionSoon(selection);
      }
      return null;
    }

    const ranges: Range[] = [];
    for (let index = 0; index < selection.rangeCount; index += 1) {
      ranges.push(selection.getRangeAt(index));
    }

    let best: { objects: PdfNativeObject[]; overlay: PageOverlay; rect: NativeTextSelectionInfo["rect"]; score: number } | null = null;
    for (const overlay of this.overlays.values()) {
      const overlayRect = this.getOverlayClientRect(overlay);
      const rects: Array<{ bottom: number; left: number; right: number; top: number }> = [];
      let score = 0;
      let excessive = false;

      for (const range of ranges) {
        for (const rect of Array.from(range.getClientRects())) {
          const area = rectIntersectionArea(rect, overlayRect);
          if (area < 4) {
            continue;
          }
          const clipped = clipRectToBounds(rect, overlayRect);
          if (clipped.right - clipped.left < 2 || clipped.bottom - clipped.top < 2) {
            continue;
          }
          rects.push(clipped);
          score += area;
          if (rects.length > limits.maxRects) {
            excessive = true;
            break;
          }
        }
        if (excessive) {
          break;
        }
      }

      if (excessive) {
        if (limits.clearExcessive) {
          clearNativeSelectionSoon(selection);
        }
        return null;
      }
      if (rects.length === 0 || (best && score <= best.score)) {
        continue;
      }

      const union = unionRects(rects);
      const normalizedWidth = Math.max(1, overlayRect.width);
      const normalizedHeight = Math.max(1, overlayRect.height);
      const selectionAreaRatio = ((union.right - union.left) * (union.bottom - union.top)) / Math.max(1, normalizedWidth * normalizedHeight);
      const selectionHeightRatio = (union.bottom - union.top) / normalizedHeight;
      if (selectionAreaRatio > limits.maxAreaRatio || selectionHeightRatio > limits.maxHeightRatio) {
        if (limits.clearExcessive) {
          clearNativeSelectionSoon(selection);
        }
        return null;
      }
      const objects = rects.map((rect, index): PdfNativeObject => ({
        height: clamp((rect.bottom - rect.top) / normalizedHeight, 0.001, 1),
        id: `native-text-selection-${overlay.pageIndex}-${index}`,
        kind: "text",
        pageIndex: overlay.pageIndex,
        text,
        width: clamp((rect.right - rect.left) / normalizedWidth, 0.001, 1),
        x: clamp((rect.left - overlayRect.left) / normalizedWidth, 0, 1),
        y: clamp((rect.top - overlayRect.top) / normalizedHeight, 0, 1)
      }));

      best = { objects, overlay, rect: union, score };
    }

    return best ? { objects: best.objects, overlay: best.overlay, rect: best.rect, text } : null;
  }

  private showNativeTextSelectionMenu(info: NativeTextSelectionInfo): void {
    this.nativeTextSelectionInfo = info;
    this.nativeTextSelectionMenu?.remove();

    const panel = activeDocument.createElement("div");
    panel.className = "pdftion-native-selection-menu";
    panel.addEventListener("pointerdown", (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
    });
    panel.addEventListener("click", (event: MouseEvent) => event.stopPropagation());

    const colorRow = activeDocument.createElement("div");
    colorRow.className = "pdftion-native-selection-colors";
    for (const color of TEXT_SELECTION_HIGHLIGHT_COLORS) {
      const button = activeDocument.createElement("button");
      button.className = "pdftion-native-selection-color";
      button.type = "button";
      button.title = uiText("高亮", "Highlight");
      button.setAttribute("aria-label", uiText("高亮", "Highlight"));
      button.setCssProps({ "--pdftion-selection-color": color });
      const swatch = activeDocument.createElement("span");
      swatch.setAttribute("aria-hidden", "true");
      button.appendChild(swatch);
      button.addEventListener("click", () => this.applyNativeTextHighlight(color));
      colorRow.appendChild(button);
    }
    colorRow.appendChild(this.createNativeTextAdvancedColorButton());
    panel.appendChild(colorRow);

    const actionRow = activeDocument.createElement("div");
    actionRow.className = "pdftion-native-selection-actions";

    const copyText = createIconButton("type", uiText("复制文字", "Copy text"));
    copyText.classList.add("pdftion-native-selection-action", "pdftion-native-selection-copy-text");
    copyText.addEventListener("click", () => void this.copyNativeTextSelectionText());
    actionRow.appendChild(copyText);

    const copyLink = createIconButton("link", uiText("复制 PDF 链接", "Copy PDF link"));
    copyLink.classList.add("pdftion-native-selection-action", "pdftion-native-selection-copy-link");
    copyLink.addEventListener("click", () => void this.copyNativeTextSelectionLink());
    actionRow.appendChild(copyLink);
    panel.appendChild(actionRow);

    appendToActiveBody(panel);
    this.nativeTextSelectionMenu = panel;
    this.positionNativeTextSelectionMenu(info, panel);
  }

  private createNativeTextAdvancedColorButton(): HTMLElement {
    const button = activeDocument.createElement("button");
    button.className = "pdftion-native-selection-color pdftion-native-selection-color-advanced";
    button.type = "button";
    button.title = uiText("自定义高亮", "Custom highlight");
    button.setAttribute("aria-label", uiText("自定义高亮", "Custom highlight"));
    button.setCssProps({ "--pdftion-selection-current-color": normalizeHexColor(this.nativeTextHighlightColor) });

    const input = activeDocument.createElement("input");
    input.type = "color";
    input.value = normalizeHexColor(this.nativeTextHighlightColor);
    input.addEventListener("click", (event: MouseEvent) => event.stopPropagation());
    input.addEventListener("input", () => {
      const color = normalizeHexColor(input.value);
      this.nativeTextHighlightColor = color;
      this.scheduleToolSettingsSave();
      this.applyNativeTextHighlight(color);
    });
    button.addEventListener("click", () => input.click());
    button.appendChild(input);

    return button;
  }

  private positionNativeTextSelectionMenu(info: NativeTextSelectionInfo, panel: HTMLElement): void {
    if (isTouchLikeViewport() && this.plugin.settings.nativeTextSelectionMenuAttachedToText) {
      panel.classList.add("is-mobile-attached");
      const centerX = info.rect.left + (info.rect.right - info.rect.left) / 2;
      panel.setCssStyles({
        bottom: "auto",
        left: `${clamp(centerX, 8, Math.max(8, activeWindow.innerWidth - 8))}px`,
        right: "auto",
        top: `${clamp(info.rect.bottom + 8, 8, Math.max(8, activeWindow.innerHeight - 8))}px`,
        transform: "translateX(-50%)"
      });

      window.requestAnimationFrame(() => {
        const menuRect = panel.getBoundingClientRect();
        let left = centerX - menuRect.width / 2;
        let top = info.rect.bottom + 8;
        if (top + menuRect.height > activeWindow.innerHeight - 8) {
          top = info.rect.top - menuRect.height - 8;
        }
        left = clamp(left, 8, Math.max(8, activeWindow.innerWidth - menuRect.width - 8));
        top = clamp(top, 8, Math.max(8, activeWindow.innerHeight - menuRect.height - 8));
        panel.setCssStyles({
          bottom: "auto",
          left: `${left}px`,
          right: "auto",
          top: `${top}px`,
          transform: "none"
        });
      });
      return;
    }

    panel.classList.remove("is-mobile-attached");
    panel.setCssStyles({
      bottom: "auto",
      left: `${clamp(info.rect.left, 8, Math.max(8, activeWindow.innerWidth - 8))}px`,
      top: `${clamp(info.rect.top - 40, 8, Math.max(8, activeWindow.innerHeight - 8))}px`,
      transform: "none"
    });

    window.requestAnimationFrame(() => {
      const menuRect = panel.getBoundingClientRect();
      let left = info.rect.left + (info.rect.right - info.rect.left) / 2 - menuRect.width / 2;
      let top = info.rect.top - menuRect.height - 8;
      if (top < 8) {
        top = info.rect.bottom + 8;
      }
      left = clamp(left, 8, Math.max(8, activeWindow.innerWidth - menuRect.width - 8));
      top = clamp(top, 8, Math.max(8, activeWindow.innerHeight - menuRect.height - 8));
      panel.setCssStyles({ left: `${left}px`, top: `${top}px` });
    });
  }

  private hideNativeTextSelectionMenu(): void {
    this.nativeTextSelectionMenu?.remove();
    this.nativeTextSelectionMenu = null;
    this.nativeTextSelectionInfo = null;
  }

  private applyNativeTextHighlight(color: string): void {
    const info = this.nativeTextSelectionInfo;
    if (!info) {
      return;
    }

    this.nativeTextHighlightColor = normalizeHexColor(color);
    this.scheduleToolSettingsSave();
    this.rememberHistory();
    for (const object of info.objects) {
      this.coverHistory.push({
        color: normalizeHexColor(color),
        height: object.height,
        id: makeStrokeId(),
        kind: "cover",
        opacity: 0.36,
        pageCssHeight: info.overlay.cssHeight,
        pageCssWidth: info.overlay.cssWidth,
        pageIndex: info.overlay.pageIndex,
        saved: false,
        source: "native-text",
        width: object.width,
        x: object.x,
        y: object.y
      });
    }

    this.redoStack = [];
    this.markDirty();
    this.redrawOverlay(info.overlay);
    this.scheduleAutoSave();
    activeDocument.getSelection()?.removeAllRanges();
    this.hideNativeTextSelectionMenu();
  }

  private async copyNativeTextSelectionLink(): Promise<void> {
    const info = this.nativeTextSelectionInfo;
    if (!info) {
      return;
    }

    const link = buildPdfSelectionWikilink(this.file, info.overlay.pageIndex, info.text);
    if (await this.copyTextToClipboard(link, uiText("Copied PDF text link.", "Copied PDF text link."))) {
      this.hideNativeTextSelectionMenu();
      activeDocument.getSelection()?.removeAllRanges();
      return;
    }
    this.showManualCopyPanel(link, uiText("PDF 链接", "PDF link"));
  }

  private async copyNativeTextSelectionText(): Promise<void> {
    const info = this.nativeTextSelectionInfo;
    if (!info) {
      return;
    }

    if (await this.copyTextToClipboard(info.text, uiText("Copied PDF text.", "Copied PDF text."))) {
      this.hideNativeTextSelectionMenu();
      activeDocument.getSelection()?.removeAllRanges();
      return;
    }
    this.showManualCopyPanel(info.text, uiText("PDF 文字", "PDF text"));
  }

  private async copyTextToClipboard(value: string, successMessage: string): Promise<boolean> {
    try {
      if (!activeWindow.navigator.clipboard?.writeText) {
        return false;
      }
      await activeWindow.navigator.clipboard.writeText(value);
      new Notice(successMessage);
      return true;
    } catch (error) {
      console.warn("pdftion clipboard write failed; showing manual copy panel.", error);
      return false;
    }
  }

  private showManualCopyPanel(value: string, title: string): void {
    const info = this.nativeTextSelectionInfo;
    this.nativeTextSelectionMenu?.remove();

    const panel = activeDocument.createElement("div");
    panel.className = "pdftion-native-selection-menu pdftion-native-selection-copy-panel";
    panel.addEventListener("pointerdown", (event: PointerEvent) => {
      if (isHTMLElement(event.target) && event.target.closest("textarea")) {
        event.stopPropagation();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    });
    panel.addEventListener("click", (event: MouseEvent) => event.stopPropagation());

    const header = activeDocument.createElement("div");
    header.className = "pdftion-native-selection-copy-title";
    header.textContent = title;
    panel.appendChild(header);

    const textarea = activeDocument.createElement("textarea");
    textarea.className = "pdftion-native-selection-copy-value";
    textarea.readOnly = true;
    textarea.rows = clamp(value.split(/\r?\n/).length, 2, 6);
    textarea.value = value;
    panel.appendChild(textarea);

    const closeButton = createIconButton("x", uiText("关闭", "Close"));
    closeButton.classList.add("pdftion-native-selection-action");
    closeButton.addEventListener("click", () => {
      activeDocument.getSelection()?.removeAllRanges();
      this.hideNativeTextSelectionMenu();
    });
    panel.appendChild(closeButton);

    appendToActiveBody(panel);
    this.nativeTextSelectionMenu = panel;
    if (info) {
      this.positionNativeTextSelectionMenu(info, panel);
    }
    focusTextEditor(textarea);
    new Notice(uiText("已显示可复制内容。", "Text is ready to copy."));
  }

  private replaceNativeSelectionWithText(selection: PdfNativeObject, overlay: PageOverlay, text: string, backgroundColor: string): void {
    const cover = this.createNativeTextCover(selection, overlay, backgroundColor, false);
    const textElement: InkText = {
      color: readableTextColor(backgroundColor),
      fontSize: Math.max(6, selection.height * overlay.cssHeight * 0.82),
      id: makeStrokeId(),
      kind: "text",
      opacity: this.textOpacity,
      pageCssHeight: overlay.cssHeight,
      pageCssWidth: overlay.cssWidth,
      pageIndex: selection.pageIndex,
      saved: false,
      text,
      x: selection.x,
      y: selection.y
    };
    this.rememberHistory();
    this.coverHistory.push(cover);
    this.textHistory.push(textElement);
    this.clearEditableSelection();
    this.redoStack = [];
    this.markDirty();
    this.redrawOverlay(overlay);
    this.scheduleAutoSave();
  }

  private createNativeTextCover(selection: PdfNativeObject, overlay: PageOverlay, backgroundColor: string, saved: boolean): InkCover {
    return expandCoverToHideNativeText({
      color: cssColorToHex(backgroundColor) ?? "#ffffff",
      height: selection.height,
      id: makeStrokeId(),
      kind: "cover",
      opacity: 1,
      pageCssHeight: overlay.cssHeight,
      pageCssWidth: overlay.cssWidth,
      pageIndex: selection.pageIndex,
      saved,
      source: "native-text",
      width: selection.width,
      x: selection.x,
      y: selection.y
    }, overlay);
  }

  private samplePdfBackgroundColor(overlay: PageOverlay, selection: PdfNativeObject): string {
    const pdfCanvas = this.getPdfCanvas(overlay);
    if (!pdfCanvas) {
      return "#ffffff";
    }

    try {
      const ctx = pdfCanvas.getContext("2d");
      if (!ctx) {
        return "#ffffff";
      }
      const samples = [
        { x: selection.x + selection.width * 0.08, y: selection.y + selection.height * 0.12 },
        { x: selection.x + selection.width * 0.92, y: selection.y + selection.height * 0.12 },
        { x: selection.x + selection.width * 0.08, y: selection.y + selection.height * 0.88 },
        { x: selection.x + selection.width * 0.92, y: selection.y + selection.height * 0.88 },
        { x: selection.x + selection.width * 0.5, y: selection.y + selection.height * 0.08 },
        { x: selection.x + selection.width * 0.5, y: selection.y + selection.height * 0.92 },
        { x: selection.x + selection.width * 0.02, y: selection.y + selection.height * 0.5 },
        { x: selection.x + selection.width * 0.98, y: selection.y + selection.height * 0.5 }
      ];
      const colors = samples.map((sample) => {
        const x = clamp(sample.x * pdfCanvas.width, 0, Math.max(0, pdfCanvas.width - 1));
        const y = clamp(sample.y * pdfCanvas.height, 0, Math.max(0, pdfCanvas.height - 1));
        const data = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
        return { b: data[2], g: data[1], luminance: 0.299 * data[0] + 0.587 * data[1] + 0.114 * data[2], r: data[0] };
      });
      const candidate = colors.some((color) => color.luminance > 220)
        ? colors.filter((color) => color.luminance > 220).sort((a, b) => b.luminance - a.luminance)[0]
        : colors.some((color) => color.luminance < 35)
          ? colors.filter((color) => color.luminance < 35).sort((a, b) => a.luminance - b.luminance)[0]
          : colors.sort((a, b) => a.luminance - b.luminance)[Math.floor(colors.length / 2)];
      return rgbToHex(candidate.r, candidate.g, candidate.b);
    } catch {
      return "#ffffff";
    }
  }

  private getPdfCanvas(overlay: PageOverlay): HTMLCanvasElement | null {
    return (
      overlay.pageEl.querySelector<HTMLCanvasElement>(".canvasWrapper canvas") ??
      Array.from(overlay.pageEl.querySelectorAll<HTMLCanvasElement>("canvas")).find((canvas) => !canvas.classList.contains("pdftion-canvas")) ??
      null
    );
  }

  private blockNativePdfAnnotationEvent(event: Event): void {
    if (!this.enabled) {
      return;
    }

    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    const target = event.target;
    const insideSession = path.some((value) => value === this.rootEl || (isHTMLElement(value) && this.rootEl.contains(value)));
    const targetElement = isHTMLElement(target) ? target : null;
    const popupTriggerEvent = ["click", "contextmenu", "dblclick", "focusin", "mousedown", "pointerdown", "touchstart"].includes(event.type);
    const fromPdftionInteraction = path.some((value) => (
      isHTMLElement(value) &&
      value.closest(
        ".pdftion-live-canvas, .pdftion-native-editor, .pdftion-native-selection-menu, .pdftion-palette-panel, .pdftion-panel"
      ) !== null
    ));
    if (
      !insideSession &&
      !fromPdftionInteraction &&
      !(targetElement && (this.isNativePdfAnnotationPopup(targetElement) || this.looksLikeNativeAnnotationMenu(targetElement)))
    ) {
      return;
    }

    if (fromPdftionInteraction) {
      if (popupTriggerEvent) {
        this.suppressNativePdfPopupBurst();
      } else {
        this.hideNativePdfAnnotationPopups();
      }
      return;
    }

    const fromNativeAnnotation = path.some((value) => (
      isHTMLElement(value) &&
      this.isNativePdfAnnotationElement(value)
    ));
    const fromNativePopup = targetElement !== null && (this.isNativePdfAnnotationPopup(targetElement) || this.looksLikeNativeAnnotationMenu(targetElement));
    if (!fromNativeAnnotation && !fromNativePopup) {
      if (popupTriggerEvent) {
        this.suppressNativePdfPopupBurst();
      } else {
        this.hideNativePdfAnnotationPopups();
      }
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }
    this.suppressNativePdfPopupBurst();
  }

  private hideNativePdfAnnotationPopups(): void {
    const rootRect = this.rootEl.getBoundingClientRect();
    const genericSuppressionActive = this.nativeTextEditor !== null || Date.now() <= this.nativePopupSuppressUntil;
    const selectors = [
      ".annotationLayer .popupWrapper",
      ".annotationLayer .popup",
      ".annotationEditorLayer .popupWrapper",
      ".annotationEditorLayer .popup",
      ".annotationEditorParams",
      ".annotationEditorToolbar",
      ".editorParamsToolbar",
      ".pdf-annotation-popup",
      ".pdf-annotation-menu",
      ".pdfAnnotationPopup",
      ".popupAnnotation",
      ".popover",
      ".hover-popover",
      ".menu",
      "[role='menu']"
    ];
    for (const candidate of Array.from(activeDocument.querySelectorAll<HTMLElement>(selectors.join(",")))) {
      if (candidate.closest(".pdftion-root, .pdftion-toolbar, .pdftion-panel, .pdftion-palette-panel, .pdftion-native-selection-menu")) {
        continue;
      }
      const rect = candidate.getBoundingClientRect();
      const nearSession = rectsOverlap(
        {
          bottom: rootRect.bottom + 80,
          left: rootRect.left - 80,
          right: rootRect.right + 80,
          top: rootRect.top - 80
        },
        rect
      );
      if (!nearSession && !this.isNativePdfAnnotationPopup(candidate)) {
        continue;
      }
      const genericNearbyMenu = genericSuppressionActive && candidate.matches(".menu, .popover, .hover-popover, [role='menu']");
      if (!this.isNativePdfAnnotationPopup(candidate) && !this.looksLikeNativeAnnotationMenu(candidate) && !genericNearbyMenu) {
        continue;
      }
      candidate.classList.add("pdftion-hide-native-popup");
      candidate.setAttribute("aria-hidden", "true");
    }
  }

  private isNativePdfAnnotationElement(element: HTMLElement): boolean {
    return element.closest(
      ".annotationLayer, .annotationEditorLayer, .annotationEditorParams, .annotationEditorToolbar, .editorParamsToolbar, .popupAnnotation, [data-annotation-id], [data-pdf-annotation-id]"
    ) !== null;
  }

  private isNativePdfAnnotationPopup(element: HTMLElement): boolean {
    return element.closest(
      ".annotationLayer .popupWrapper, .annotationLayer .popup, .annotationEditorLayer .popupWrapper, .annotationEditorLayer .popup, .annotationEditorParams, .annotationEditorToolbar, .editorParamsToolbar, .pdf-annotation-popup, .pdf-annotation-menu, .pdfAnnotationPopup, .popupAnnotation"
    ) !== null;
  }

  private looksLikeNativeAnnotationMenu(element: HTMLElement): boolean {
    const text = (element.textContent ?? "").trim();
    if (!text) {
      return Date.now() <= this.nativePopupSuppressUntil && element.closest(".menu, .popover, .hover-popover, [role='menu']") !== null;
    }
    if (text.length > 120) {
      return false;
    }
    return /复制|信息|注释|批注|copy|info|annotation/i.test(text);
  }

  private beginSelectionInteraction(point: InkPoint, overlay: PageOverlay): void {
    const handle = this.findSelectionHandleAt(overlay, point);
    if (handle && this.canMoveFreshSelection() && this.canDragSelectedElements(overlay.pageIndex)) {
      const selected = this.getSelectedEditableElements(overlay.pageIndex);
      const bounds = normalizedElementsBounds(selected);
      if (selected.length > 0 && bounds) {
        this.selectionDrag = {
          current: point,
          handle,
          mode: "resize",
          moved: false,
          originalBounds: bounds,
          originalElements: selected.map(cloneElement),
          pageIndex: overlay.pageIndex,
          startedFromFreshSelection: true,
          start: point
        };
        this.redrawAll();
        return;
      }
    }

    const selected = this.findElementAt(overlay, point);
    if (selected) {
      if (!this.selectedStrokeIds.has(selected.id)) {
        this.setSelectedElementForEditing(selected, overlay);
        this.selectionDrag = null;
        this.redrawAll();
        return;
      }
      if (!this.canMoveFreshSelection() || !this.canDragSelectedElements(overlay.pageIndex)) {
        this.nativeSelection = null;
        this.selectionDrag = null;
        this.redrawAll();
        return;
      }
      this.nativeSelection = null;
      this.selectionDrag = {
        current: point,
        mode: "move",
        moved: false,
        pageIndex: overlay.pageIndex,
        startedFromFreshSelection: true,
        start: point
      };
      this.redrawAll();
      return;
    }

    if (this.hasEditableSelection(overlay.pageIndex) && this.selectionBoxContainsPoint(overlay, point) && this.canMoveFreshSelection() && this.canDragSelectedElements(overlay.pageIndex)) {
      this.nativeSelection = null;
      this.selectionDrag = {
        clearSelectionOnTap: true,
        current: point,
        mode: "move",
        moved: false,
        pageIndex: overlay.pageIndex,
        startedFromFreshSelection: true,
        start: point
      };
      this.redrawAll();
      return;
    }

    if (!selected) {
      if (this.selectedStrokeIds.size > 0 || this.nativeSelection !== null) {
        this.clearEditableSelection();
        this.selectionDrag = null;
        this.redrawAll();
        return;
      }
      const blockingCover = this.findCoverElementAt(overlay, point, true);
      if (blockingCover?.source === "native-text") {
        this.clearEditableSelection();
        this.selectionDrag = null;
        this.redrawAll();
        return;
      }
      const native = this.findNativeObjectAt(overlay, point);
      if (native) {
        this.clearEditableSelection();
        this.nativeSelection = native;
        this.selectionDrag = null;
        this.redrawAll();
        return;
      }
      if (this.selectionBoxContainsPoint(overlay, point) && this.canMoveFreshSelection() && this.canDragSelectedElements(overlay.pageIndex)) {
        this.selectionDrag = {
          current: point,
          mode: "move",
          moved: false,
          pageIndex: overlay.pageIndex,
          startedFromFreshSelection: true,
          start: point
        };
      } else {
        this.clearEditableSelection();
        this.selectionDrag = {
          current: point,
          mode: "marquee",
          moved: false,
          pageIndex: overlay.pageIndex,
          start: point
        };
      }
    } else {
      this.selectionDrag = null;
    }

    this.redrawAll();
  }

  private togglePalette(): void {
    if (this.palette?.isConnected) {
      this.palette.remove();
      this.palette = null;
      return;
    }

    this.showPalette();
  }

  private showPalette(): void {
    this.palette?.remove();

    const panel = activeDocument.createElement("div");
    panel.className = "pdftion-palette-panel";
    panel.addEventListener("pointerdown", (event: PointerEvent) => event.stopPropagation());
    panel.addEventListener("click", (event: MouseEvent) => event.stopPropagation());

    if (this.hasEditableSelection()) {
      panel.appendChild(this.createPaletteSelectionGroup());
    } else if (this.tool === "eraser") {
      panel.appendChild(
        this.createPaletteRange(uiText("橡皮", "Eraser"), "eraser", "pdftion-width-eraser", 2, 120, 1, this.eraserWidth, (value) => {
          this.eraserWidth = value;
          this.scheduleToolSettingsSave();
        })
      );
    } else if (this.tool === "highlight") {
      panel.appendChild(this.createPaletteToolGroup("highlight", uiText("水彩", "Highlighter")));
    } else if (this.hasSelectedText()) {
      panel.appendChild(this.createPaletteTextGroup());
    } else if (this.tool === "text") {
      panel.appendChild(this.createPaletteTextGroup());
    } else {
      panel.appendChild(this.createPaletteToolGroup("pen", uiText("笔", "Pen")));
    }
    activeDocument.body.appendChild(panel);
    this.palette = panel;
    this.positionPalettePanel(panel);
    this.updateToolbarState();
  }

  private positionPalettePanel(panel: HTMLElement): void {
    const button = this.toolbar?.querySelector<HTMLElement>(".pdftion-palette-button");
    const gap = 8;
    const fallbackTop = Math.max(76, (this.toolbarHost?.getBoundingClientRect().bottom ?? 68) + gap);

    panel.classList.remove("is-mobile-bottom");
    panel.setCssStyles({
      bottom: "auto",
      right: `${Math.max(8, activeWindow.innerWidth - (button?.getBoundingClientRect().right ?? activeWindow.innerWidth - 12))}px`,
      top: `${fallbackTop}px`,
      transform: "none"
    });

    window.requestAnimationFrame(() => {
      const rect = panel.getBoundingClientRect();
      const buttonRect = button?.getBoundingClientRect();
      let left = buttonRect ? buttonRect.right - rect.width : activeWindow.innerWidth - rect.width - 12;
      let top = buttonRect ? buttonRect.bottom + gap : fallbackTop;

      left = clamp(left, 8, Math.max(8, activeWindow.innerWidth - rect.width - 8));
      if (buttonRect && top + rect.height > activeWindow.innerHeight - 8) {
        top = buttonRect.top - rect.height - gap;
      }
      top = clamp(top, 8, Math.max(8, activeWindow.innerHeight - rect.height - 8));

      panel.setCssStyles({
        bottom: "auto",
        left: `${left}px`,
        right: "auto",
        top: `${top}px`,
        transform: "none"
      });
    });
  }

  private createPaletteToolGroup(tool: "pen" | "highlight", title: string): HTMLElement {
    const group = activeDocument.createElement("div");
    group.className = "pdftion-palette-group";
    group.setAttribute("aria-label", title);
    group.title = title;

    const colorRow = activeDocument.createElement("div");
    colorRow.className = "pdftion-palette-colors";
    for (const swatch of PALETTE_COLORS) {
      const colorButton = this.createPaletteColorButton(swatch, tool);
      colorButton.addEventListener("click", () => {
        this.setToolColor(tool, swatch);
        this.updateToolbarState();
      });
      colorRow.appendChild(colorButton);
    }
    colorRow.appendChild(this.createAdvancedColorInput(tool, this.getToolColor(tool), (color) => this.setToolColor(tool, color)));
    group.appendChild(colorRow);

    group.appendChild(
      this.createPaletteRange(uiText("大小", "Size"), "maximize-2", `pdftion-width-${tool}`, tool === "highlight" ? 2 : 0.5, tool === "highlight" ? 96 : 72, 0.5, this.getToolWidth(tool), (value) => {
        this.setToolWidth(tool, value);
      })
    );

    group.appendChild(
      this.createPaletteRange(uiText("透明", "Alpha"), "droplet", `pdftion-opacity-${tool}`, 0.05, 1, 0.05, this.getToolOpacity(tool), (value) => {
        this.setToolOpacity(tool, value);
      })
    );

    return group;
  }

  private createPaletteTextGroup(): HTMLElement {
    const group = activeDocument.createElement("div");
    group.className = "pdftion-palette-group";
    group.setAttribute("aria-label", uiText("文字", "Text"));
    group.title = uiText("文字", "Text");

    const colorRow = activeDocument.createElement("div");
    colorRow.className = "pdftion-palette-colors";
    for (const swatch of PALETTE_COLORS) {
      const colorButton = this.createPaletteColorButton(swatch, "text");
      colorButton.addEventListener("click", () => {
        this.setTextPaletteColor(swatch);
        this.updateToolbarState();
      });
      colorRow.appendChild(colorButton);
    }
    colorRow.appendChild(this.createAdvancedColorInput("text", this.getTextPaletteColor(), (color) => this.setTextPaletteColor(color)));
    group.appendChild(colorRow);

    const fontRow = activeDocument.createElement("label");
    fontRow.className = "pdftion-palette-range";
    fontRow.title = uiText("字体", "Font");
    const fontLabel = activeDocument.createElement("span");
    fontLabel.className = "pdftion-palette-icon";
    fontLabel.setAttribute("aria-hidden", "true");
    setIcon(fontLabel, "type");
    fontRow.appendChild(fontLabel);
    const fontButton = createIconButton("case-sensitive", uiText("字体", "Font"));
    fontButton.classList.add("pdftion-font-family");
    this.updateFontButtonTitle(fontButton);
    fontButton.addEventListener("click", () => {
      const current = this.getTextPaletteFontFamily();
      const index = TEXT_FONTS.findIndex((font) => font.value === current);
      const next = TEXT_FONTS[(index + 1) % TEXT_FONTS.length] ?? TEXT_FONTS[0];
      this.setTextPaletteFontFamily(next.value);
      this.updateFontButtonTitle(fontButton);
      this.updateToolbarState();
    });
    fontRow.appendChild(fontButton);
    group.appendChild(fontRow);

    group.appendChild(
      this.createPaletteRange(uiText("大小", "Size"), "maximize-2", "pdftion-size-text", 6, 120, 1, this.getTextPaletteFontSize(), (value) => this.setTextPaletteFontSize(value))
    );

    group.appendChild(
      this.createPaletteRange(uiText("透明", "Alpha"), "droplet", "pdftion-opacity-text", 0.05, 1, 0.05, this.getTextPaletteOpacity(), (value) => this.setTextPaletteOpacity(value))
    );

    return group;
  }

  private updateFontButtonTitle(button: HTMLElement): void {
    const current = this.getTextPaletteFontFamily();
    const font = TEXT_FONTS.find((item) => item.value === current) ?? TEXT_FONTS[0];
    const title = `${uiText("字体", "Font")}: ${uiText(font.labelZh, font.labelEn)}`;
    button.title = title;
    button.setAttribute("aria-label", title);
  }

  private createPaletteSelectionGroup(): HTMLElement {
    const group = activeDocument.createElement("div");
    group.className = "pdftion-palette-group";
    group.setAttribute("aria-label", uiText("选中元素", "Selection"));
    group.title = uiText("选中元素", "Selection");

    const colorRow = activeDocument.createElement("div");
    colorRow.className = "pdftion-palette-colors";
    for (const swatch of PALETTE_COLORS) {
      const colorButton = this.createPaletteColorButton(swatch, "selection");
      colorButton.addEventListener("click", () => {
        this.setSelectedPaletteColor(swatch);
        this.updateToolbarState();
      });
      colorRow.appendChild(colorButton);
    }
    colorRow.appendChild(this.createAdvancedColorInput("selection", this.getSelectedPaletteColor(), (color) => this.setSelectedPaletteColor(color)));
    group.appendChild(colorRow);

    return group;
  }

  private createPaletteColorButton(swatch: string, target: "pen" | "highlight" | "text" | "selection"): HTMLElement {
    const colorButton = activeDocument.createElement("button");
    colorButton.className = "pdftion-color";
    colorButton.dataset.color = swatch;
    colorButton.dataset.target = target;
    colorButton.setCssProps({ "--pdftion-swatch-color": swatch });
    colorButton.title = swatch;
    colorButton.type = "button";
    colorButton.setAttribute("aria-label", swatch);

    const chip = activeDocument.createElement("span");
    chip.className = "pdftion-color-swatch";
    chip.setCssProps({ "--pdftion-swatch-color": swatch });
    chip.setAttribute("aria-hidden", "true");
    colorButton.appendChild(chip);

    return colorButton;
  }

  private createAdvancedColorInput(target: "pen" | "highlight" | "text" | "selection", value: string, onInput: (color: string) => void): HTMLElement {
    const row = activeDocument.createElement("button");
    row.className = "pdftion-color pdftion-color-advanced";
    row.dataset.target = target;
    row.setCssProps({ "--pdftion-current-color": normalizeHexColor(value) });
    row.title = uiText("自定义颜色", "Custom color");
    row.type = "button";

    const input = activeDocument.createElement("input");
    input.dataset.target = target;
    input.type = "color";
    input.value = normalizeHexColor(value);
    input.addEventListener("click", (event: MouseEvent) => event.stopPropagation());
    input.addEventListener("input", () => {
      onInput(input.value);
      this.updateToolbarState();
    });
    row.addEventListener("click", () => {
      input.click();
    });
    row.appendChild(input);

    return row;
  }

  private createPaletteRange(
    title: string,
    icon: string,
    className: string,
    min: number,
    max: number,
    step: number,
    value: number,
    onInput: (value: number) => void
  ): HTMLElement {
    const row = activeDocument.createElement("label");
    row.className = "pdftion-palette-range";
    row.title = title;

    const label = activeDocument.createElement("span");
    label.className = "pdftion-palette-icon";
    label.setAttribute("aria-hidden", "true");
    setIcon(label, icon);
    row.appendChild(label);

    const input = activeDocument.createElement("input");
    input.className = className;
    input.title = title;
    input.setAttribute("aria-label", title);
    input.max = String(max);
    input.min = String(min);
    input.step = String(step);
    input.type = "range";
    input.value = String(value);
    input.addEventListener("input", () => onInput(Number(input.value)));
    row.appendChild(input);

    return row;
  }

  private updatePaletteState(): void {
    if (!this.palette) {
      return;
    }

    for (const tool of ["pen", "highlight"] as const) {
      const widthInput = this.palette.querySelector<HTMLInputElement>(`.pdftion-width-${tool}`);
      if (widthInput) {
        widthInput.value = String(this.getToolWidth(tool));
      }

      const opacityInput = this.palette.querySelector<HTMLInputElement>(`.pdftion-opacity-${tool}`);
      if (opacityInput) {
        opacityInput.value = String(this.getToolOpacity(tool));
      }
    }

    const eraserInput = this.palette.querySelector<HTMLInputElement>(".pdftion-width-eraser");
    if (eraserInput) {
      eraserInput.value = String(this.eraserWidth);
    }

    const textSizeInput = this.palette.querySelector<HTMLInputElement>(".pdftion-size-text");
    if (textSizeInput) {
      textSizeInput.value = String(this.getTextPaletteFontSize());
    }

    const textOpacityInput = this.palette.querySelector<HTMLInputElement>(".pdftion-opacity-text");
    if (textOpacityInput) {
      textOpacityInput.value = String(this.getTextPaletteOpacity());
    }

    const textFontButton = this.palette.querySelector<HTMLElement>(".pdftion-font-family");
    if (textFontButton) {
      this.updateFontButtonTitle(textFontButton);
    }
  }

  private hasSelectedText(): boolean {
    return this.getSelectedTextElements().length > 0;
  }

  private getSelectedTextElements(): InkText[] {
    return this.textHistory.filter((text) => this.selectedStrokeIds.has(text.id));
  }

  private getTextPaletteColor(): string {
    return this.getSelectedTextElements()[0]?.color ?? this.textColor;
  }

  private getTextPaletteFontSize(): number {
    return this.getSelectedTextElements()[0]?.fontSize ?? this.textFontSize;
  }

  private getTextPaletteFontFamily(): string {
    return this.getSelectedTextElements()[0]?.fontFamily ?? this.textFontFamily;
  }

  private getTextPaletteOpacity(): number {
    return this.getSelectedTextElements()[0]?.opacity ?? this.textOpacity;
  }

  private setTextPaletteColor(color: string): void {
    color = normalizeHexColor(color);
    this.textColor = color;
    this.scheduleToolSettingsSave();
    this.updateSelectedTextElements((text) => {
      text.color = color;
    });
  }

  private setTextPaletteFontSize(fontSize: number): void {
    this.textFontSize = fontSize;
    this.scheduleToolSettingsSave();
    this.updateSelectedTextElements((text) => {
      text.fontSize = fontSize;
    });
  }

  private setTextPaletteFontFamily(fontFamily: string): void {
    this.textFontFamily = fontFamily;
    this.scheduleToolSettingsSave();
    this.updateSelectedTextElements((text) => {
      text.fontFamily = fontFamily;
    });
  }

  private setTextPaletteOpacity(opacity: number): void {
    this.textOpacity = opacity;
    this.scheduleToolSettingsSave();
    this.updateSelectedTextElements((text) => {
      text.opacity = opacity;
    });
  }

  private updateSelectedTextElements(update: (text: InkText) => void): void {
    const selected = this.getSelectedTextElements();
    if (selected.length === 0) {
      return;
    }
    this.rememberHistory();
    for (const text of selected) {
      update(text);
      text.saved = false;
    }
    this.markDirty();
    this.redrawAll();
    this.scheduleAutoSave();
  }

  showPageNavigator(): void {
    if (this.pageNavigator?.isConnected) {
      this.pageNavigator.remove();
      this.pageNavigator = null;
      return;
    }

    const panel = activeDocument.createElement("div");
    panel.className = "pdftion-panel pdftion-page-navigator";
    panel.addEventListener("pointerdown", (event: PointerEvent) => event.stopPropagation());
    panel.addEventListener("click", (event: MouseEvent) => event.stopPropagation());

    const header = activeDocument.createElement("div");
    header.className = "pdftion-panel-header";
    header.textContent = "Pdftion";
    const close = createIconButton("x", uiText("关闭", "Close"));
    close.addEventListener("click", () => {
      panel.remove();
      this.pageNavigator = null;
    });
    header.appendChild(close);
    panel.appendChild(header);

    const stats = this.aiGetStats();
    const summary = activeDocument.createElement("div");
    summary.className = "pdftion-panel-summary";
    summary.textContent = this.getPageNavigatorSummary(null, stats);
    panel.appendChild(summary);

    const list = activeDocument.createElement("div");
    list.className = "pdftion-page-list";
    list.textContent = uiText("读取页面...", "Loading pages...");
    panel.appendChild(list);

    const actions = activeDocument.createElement("div");
    actions.className = "pdftion-panel-actions";

    const up = createIconButton("arrow-up", uiText("上移", "Move up"));
    up.addEventListener("click", () => void this.moveSelectedPages(-1));
    actions.appendChild(up);

    const down = createIconButton("arrow-down", uiText("下移", "Move down"));
    down.addEventListener("click", () => void this.moveSelectedPages(1));
    actions.appendChild(down);

    const reorder = createIconButton("shuffle", uiText("重排", "Reorder"));
    reorder.addEventListener("click", () => void this.reorderPagesByPrompt());
    actions.appendChild(reorder);

    const rotate = createIconButton("rotate-cw", uiText("旋转", "Rotate"));
    rotate.addEventListener("click", () => void this.rotateSelectedPagesClockwise());
    actions.appendChild(rotate);

    const crop = createIconButton("crop", uiText("裁切", "Crop"));
    crop.addEventListener("click", () => void this.cropSelectedPagesByPrompt());
    actions.appendChild(crop);

    const undoRewrite = createIconButton("rotate-ccw", uiText("回退上次 PDF 改写", "Revert last PDF rewrite"));
    undoRewrite.addEventListener("click", () => void this.restoreLastPdfRewrite());
    actions.appendChild(undoRewrite);

    const deletePages = createIconButton("file-minus", uiText("删页", "Delete pages"));
    deletePages.addEventListener("click", () => void this.deleteSelectedPages());
    actions.appendChild(deletePages);

    const importPdf = createIconButton("file-plus", uiText("导入 PDF", "Import PDF"));
    importPdf.addEventListener("click", () => void this.importPdfByPrompt());
    actions.appendChild(importPdf);

    const exportMd = createIconButton("file-text", uiText("导出 MD", "Export MD"));
    exportMd.addEventListener("click", () => void this.exportAnnotationsMarkdown());
    actions.appendChild(exportMd);
    const insertLink = createIconButton("link", uiText("插入链接", "Insert link"));
    insertLink.addEventListener("click", () => void this.insertObsidianLinkInteractive());
    actions.appendChild(insertLink);
    const convert = createIconButton("files", uiText("转换文档", "Convert docs"));
    convert.addEventListener("click", () => void this.exportMarkdownDocxBridge());
    actions.appendChild(convert);
    panel.appendChild(actions);

    activeDocument.body.appendChild(panel);
    this.pageNavigator = panel;
    void this.populatePageNavigatorList(list, summary);
    const anchor = this.toolbarHost?.getBoundingClientRect();
    panel.setCssStyles({
      right: "12px",
      top: `${Math.max(8, anchor ? anchor.bottom + 8 : 80)}px`
    });
  }

  private async populatePageNavigatorList(list: HTMLElement, summary: HTMLElement): Promise<void> {
    const pageCount = await this.getCurrentPdfPageCount();
    const stats = this.aiGetStats();
    summary.textContent = this.getPageNavigatorSummary(pageCount, stats);
    list.textContent = "";

    if (this.selectedPageIndexes.size === 0) {
      this.selectedPageIndexes.add(clamp(Math.floor(this.getVisibleOverlay()?.pageIndex ?? 0), 0, Math.max(0, pageCount - 1)));
    }

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const row = activeDocument.createElement("div");
      row.className = "pdftion-page-row";

      const checkbox = activeDocument.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = this.selectedPageIndexes.has(pageIndex);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          this.selectedPageIndexes.add(pageIndex);
        } else {
          this.selectedPageIndexes.delete(pageIndex);
        }
      });
      row.appendChild(checkbox);

      const item = activeDocument.createElement("button");
      item.type = "button";
      item.className = "pdftion-page-item";
      const count = this.getEditableElements().filter((element) => element.pageIndex === pageIndex).length;
      item.textContent = `${pageIndex + 1} (${count})`;
      item.title = uiText(`第 ${pageIndex + 1} 页，${count} 个元素`, `Page ${pageIndex + 1}, ${count} elements`);
      item.addEventListener("click", () => {
        checkbox.checked = true;
        this.selectedPageIndexes.add(pageIndex);
        this.jumpToPage(pageIndex);
      });
      row.appendChild(item);

      list.appendChild(row);
    }
  }

  private getPageNavigatorSummary(pageCount: number | null, stats: PdfElementStats): string {
    const pages = pageCount === null ? "..." : String(pageCount);
    return uiText(
      `页 ${pages} | 笔 ${stats.strokes} | 文 ${stats.texts} | 图 ${stats.images} | 遮 ${stats.covers}`,
      `P ${pages} | ink ${stats.strokes} | text ${stats.texts} | img ${stats.images} | cover ${stats.covers}`
    );
  }

  private async getCurrentPdfPageCount(): Promise<number> {
    const binary = await this.plugin.app.vault.readBinary(this.file);
    const pdf = await PDFDocument.load(binary, { ignoreEncryption: true });
    return pdf.getPageCount();
  }

  private getSelectedPageIndexes(pageCount: number): number[] {
    const selected = Array.from(this.selectedPageIndexes)
      .map((pageIndex) => Math.floor(pageIndex))
      .filter((pageIndex) => pageIndex >= 0 && pageIndex < pageCount)
      .sort((a, b) => a - b);
    if (selected.length > 0) {
      return selected;
    }
    return [clamp(Math.floor(this.getVisibleOverlay()?.pageIndex ?? 0), 0, Math.max(0, pageCount - 1))];
  }

  private refreshPageNavigator(): void {
    const panel = this.pageNavigator;
    if (!panel?.isConnected) {
      return;
    }
    const list = panel.querySelector<HTMLElement>(".pdftion-page-list");
    const summary = panel.querySelector<HTMLElement>(".pdftion-panel-summary");
    if (list && summary) {
      void this.populatePageNavigatorList(list, summary);
    }
  }

  private async moveSelectedPages(delta: -1 | 1): Promise<void> {
    const pageCount = await this.getCurrentPdfPageCount();
    const selected = new Set(this.getSelectedPageIndexes(pageCount));
    const order = Array.from({ length: pageCount }, (_, index) => index);
    if (delta < 0) {
      for (let i = 1; i < order.length; i += 1) {
        if (selected.has(order[i]) && !selected.has(order[i - 1])) {
          [order[i - 1], order[i]] = [order[i], order[i - 1]];
        }
      }
    } else {
      for (let i = order.length - 2; i >= 0; i -= 1) {
        if (selected.has(order[i]) && !selected.has(order[i + 1])) {
          [order[i + 1], order[i]] = [order[i], order[i + 1]];
        }
      }
    }
    await this.rewritePdfWithPageOrder(order, "页码已移动");
  }

  private async reorderPagesByPrompt(): Promise<void> {
    const pageCount = await this.getCurrentPdfPageCount();
    const raw = await showPromptModal({
      actionLabel: uiText("重排", "Reorder"),
      defaultValue: "",
      message: uiText(`输入新的页码顺序，例如 3,1,2 或 1-3,5。当前共 ${pageCount} 页。`, `Enter a new page order, for example 3,1,2 or 1-3,5. Current pages: ${pageCount}.`),
      title: uiText("重组页面", "Reorder pages")
    });
    if (!raw) {
      return;
    }
    const order = parsePageOrder(raw, pageCount);
    if (!order) {
      new Notice(uiText("页码顺序无效。", "Invalid page order."));
      return;
    }
    await this.rewritePdfWithPageOrder(order, uiText("页码已重组", "Pages reordered"));
  }

  private async deleteSelectedPages(): Promise<void> {
    const pageCount = await this.getCurrentPdfPageCount();
    const selected = new Set(this.getSelectedPageIndexes(pageCount));
    if (selected.size >= pageCount) {
      new Notice(uiText("不能删除全部页面。", "Cannot delete all pages."));
      return;
    }
    if (!(await showConfirmModal({
      confirmLabel: uiText("删除", "Delete"),
      message: uiText(`删除 ${selected.size} 页？此操作会修改当前 PDF。`, `Delete ${selected.size} pages? This will modify the current PDF.`),
      title: uiText("删除页面", "Delete pages")
    }))) {
      return;
    }
    const order = Array.from({ length: pageCount }, (_, index) => index).filter((pageIndex) => !selected.has(pageIndex));
    await this.rewritePdfWithPageOrder(order, uiText("已删除页面", "Pages deleted"));
  }

  private async rotateSelectedPagesClockwise(): Promise<void> {
    const pageCount = await this.getCurrentPdfPageCount();
    const selected = this.getSelectedPageIndexes(pageCount);
    const binary = await this.plugin.app.vault.readBinary(this.file);
    const pdf = await PDFDocument.load(binary, { ignoreEncryption: true });
    for (const pageIndex of selected) {
      const page = pdf.getPage(pageIndex);
      const angle = page.getRotation().angle;
      page.setRotation(degrees((angle + 90) % 360));
    }
    const rotated = this.getEditableElements().map((element) => selected.includes(element.pageIndex) ? rotateElementClockwise(element) : cloneElement(element));
    const saved = await pdf.save({ useObjectStreams: true });
    await this.persistPdfRewrite(saved, rotated, uiText("已旋转选中页面", "Selected pages rotated"));
  }

  private async cropSelectedPagesByPrompt(): Promise<void> {
    const pageCount = await this.getCurrentPdfPageCount();
    const selected = this.getSelectedPageIndexes(pageCount);
    const selectedSet = new Set(selected);
    const crop = await showCropModal({
      bottom: this.plugin.settings.lastCropBottom,
      left: this.plugin.settings.lastCropLeft,
      right: this.plugin.settings.lastCropRight,
      top: this.plugin.settings.lastCropTop
    }, (previewCrop) => {
      this.cropPreview = previewCrop ? { crop: previewCrop, pageIndexes: selectedSet } : null;
      this.redrawAll();
    });
    if (!crop) {
      this.cropPreview = null;
      this.redrawAll();
      return;
    }
    this.plugin.settings.lastCropBottom = crop.bottom;
    this.plugin.settings.lastCropLeft = crop.left;
    this.plugin.settings.lastCropRight = crop.right;
    this.plugin.settings.lastCropTop = crop.top;
    await this.plugin.saveSettings();

    const binary = await this.plugin.app.vault.readBinary(this.file);
    const pdf = await PDFDocument.load(binary, { ignoreEncryption: true });
    for (const pageIndex of selected) {
      const page = pdf.getPage(pageIndex);
      const size = page.getSize();
      const width = size.width * Math.max(0.01, 1 - crop.left - crop.right);
      const height = size.height * Math.max(0.01, 1 - crop.top - crop.bottom);
      page.setCropBox(crop.left * size.width, crop.bottom * size.height, width, height);
    }
    const cropped = this.getEditableElements().map((element) => selected.includes(element.pageIndex) ? cropElement(element, crop) : cloneElement(element));
    const saved = await pdf.save({ useObjectStreams: true });
    this.cropPreview = null;
    await this.persistPdfRewrite(saved, cropped, uiText("已裁切选中页面", "Selected pages cropped"));
  }

  private async importPdfByPrompt(): Promise<void> {
    const file = await pickPdfFile();
    if (!file) {
      return;
    }
    const pageCount = await this.getCurrentPdfPageCount();
    const defaultInsert = this.getSelectedPageIndexes(pageCount).at(-1) ?? pageCount - 1;
    const raw = await showPromptModal({
      actionLabel: uiText("插入", "Insert"),
      defaultValue: String(defaultInsert + 1),
      message: uiText("插入到第几页之后？填 0 表示插到最前，留空表示插到选中页之后。", "Insert after which page? Use 0 for the beginning, or leave blank to insert after the selected page."),
      title: uiText("导入 PDF", "Import PDF")
    });
    const insertAfter = raw?.trim() ? Math.max(0, Math.floor(Number(raw)) || 0) : defaultInsert + 1;
    const insertIndex = clamp(insertAfter, 0, pageCount);

    const currentBytes = await this.plugin.app.vault.readBinary(this.file);
    const incomingBytes = await file.arrayBuffer();
    const currentPdf = await PDFDocument.load(currentBytes, { ignoreEncryption: true });
    const incomingPdf = await PDFDocument.load(incomingBytes, { ignoreEncryption: true });
    const output = await PDFDocument.create();
    const before = await output.copyPages(currentPdf, Array.from({ length: insertIndex }, (_, index) => index));
    for (const page of before) {
      output.addPage(page);
    }
    const imported = await output.copyPages(incomingPdf, Array.from({ length: incomingPdf.getPageCount() }, (_, index) => index));
    for (const page of imported) {
      output.addPage(page);
    }
    const after = await output.copyPages(currentPdf, Array.from({ length: pageCount - insertIndex }, (_, index) => insertIndex + index));
    for (const page of after) {
      output.addPage(page);
    }

    const shifted = this.getEditableElements().map((element) => {
      const clone = cloneElement(element);
      if (clone.pageIndex >= insertIndex) {
        clone.pageIndex += incomingPdf.getPageCount();
      }
      return clone;
    });
    const saved = await output.save({ useObjectStreams: true });
    await this.persistPdfRewrite(saved, shifted, uiText(`已导入并合并 ${file.name}`, `Imported and merged ${file.name}`));
  }

  private async rewritePdfWithPageOrder(order: number[], message: string): Promise<void> {
    const binary = await this.plugin.app.vault.readBinary(this.file);
    const source = await PDFDocument.load(binary, { ignoreEncryption: true });
    if (order.length === 0 || order.some((pageIndex) => pageIndex < 0 || pageIndex >= source.getPageCount())) {
      new Notice(uiText("页码顺序无效。", "Invalid page order."));
      return;
    }
    const output = await PDFDocument.create();
    const pages = await output.copyPages(source, order);
    for (const page of pages) {
      output.addPage(page);
    }

    const indexMap = new Map<number, number>();
    order.forEach((oldIndex, newIndex) => indexMap.set(oldIndex, newIndex));
    const remapped = this.getEditableElements()
      .filter((element) => indexMap.has(element.pageIndex))
      .map((element) => {
        const clone = cloneElement(element);
        clone.pageIndex = indexMap.get(element.pageIndex) ?? clone.pageIndex;
        return clone;
      });
    const selected = this.getSelectedPageIndexes(source.getPageCount())
      .map((pageIndex) => indexMap.get(pageIndex))
      .filter((pageIndex): pageIndex is number => typeof pageIndex === "number");
    this.selectedPageIndexes = new Set(selected);
    const saved = await output.save({ useObjectStreams: true });
    await this.persistPdfRewrite(saved, remapped, message);
  }

  private async persistPdfRewrite(saved: Uint8Array, elements: InkElement[], message: string): Promise<void> {
    await this.savePdfRewriteBackup();
    const buffer = new ArrayBuffer(saved.byteLength);
    new Uint8Array(buffer).set(saved);
    await this.plugin.app.vault.modifyBinary(this.file, buffer);
    const basePdf = await this.plugin.ensureBasePdfBytes(this.file, buffer);
    const marked = elements.map((element) => markElementSaved(cloneElement(element)));
    await this.plugin.saveAnnotationState(this.file, marked, basePdf.fingerprint, buffer);
    this.applyLocalElementsAfterPdfRewrite(marked);
    new Notice(message);
  }

  private applyLocalElementsAfterPdfRewrite(elements: InkElement[]): void {
    this.strokeHistory = elements.filter((element): element is InkStroke => element.kind === "stroke");
    this.textHistory = elements.filter((element): element is InkText => element.kind === "text");
    this.coverHistory = elements.filter((element): element is InkCover => element.kind === "cover");
    this.imageHistory = elements.filter((element): element is InkImage => element.kind === "image");
    this.clearCurrentStroke();
    this.currentCover = null;
    this.cropPreview = null;
    this.redoStack = [];
    this.undoStack = [];
    this.redoHistoryStack = [];
    this.clearEditableSelection();
    this.dirty = false;
    this.redrawAll();
    this.refreshPageNavigator();
    this.scheduleQuietScan();
  }

  private getPdfRewriteBackupPdfPath(): string {
    return `${this.plugin.manifest.dir}/data/rewrite-backups/${safeAnnotationKey(this.file.path)}.pdf`;
  }

  private getPdfRewriteBackupJsonPath(): string {
    return `${this.plugin.manifest.dir}/data/rewrite-backups/${safeAnnotationKey(this.file.path)}.json`;
  }

  private async savePdfRewriteBackup(): Promise<void> {
    const pdfPath = this.getPdfRewriteBackupPdfPath();
    const jsonPath = this.getPdfRewriteBackupJsonPath();
    await this.ensureVaultFolder(pdfPath.substring(0, pdfPath.lastIndexOf("/")));
    const currentBytes = await this.plugin.app.vault.readBinary(this.file);
    await this.plugin.app.vault.adapter.writeBinary(pdfPath, currentBytes);
    const record: PdfRewriteBackupRecord = {
      elements: this.getEditableElements().map(cloneElement),
      filePath: this.file.path,
      pdfPath,
      updatedAt: new Date().toISOString(),
      version: 1
    };
    await this.plugin.app.vault.adapter.write(jsonPath, JSON.stringify(record, null, 2));
  }

  private async restoreLastPdfRewrite(): Promise<void> {
    const jsonPath = this.getPdfRewriteBackupJsonPath();
    let record: PdfRewriteBackupRecord;
    try {
      record = JSON.parse(await this.plugin.app.vault.adapter.read(jsonPath)) as PdfRewriteBackupRecord;
    } catch {
      new Notice(uiText("没有可回退的 PDF 改写备份。", "No PDF rewrite backup is available."));
      return;
    }
    if (record.filePath !== this.file.path || !record.pdfPath) {
      new Notice(uiText("回退备份与当前 PDF 不匹配。", "The rewrite backup does not match the current PDF."));
      return;
    }
    if (!(await showConfirmModal({
      confirmLabel: uiText("回退", "Revert"),
      message: uiText("回退到上次 PDF 改写前？当前 PDF 文件和可编辑批注都会恢复到备份状态。", "Revert to the state before the last PDF rewrite? The current PDF file and editable annotations will be restored from backup."),
      title: uiText("回退上次 PDF 改写", "Revert last PDF rewrite")
    }))) {
      return;
    }
    try {
      const backupBytes = await this.plugin.app.vault.adapter.readBinary(record.pdfPath);
      await this.plugin.app.vault.modifyBinary(this.file, backupBytes);
      const basePdf = await this.plugin.ensureBasePdfBytes(this.file, backupBytes);
      const elements = Array.isArray(record.elements) ? record.elements.filter(isInkElement).map((element) => markElementSaved(cloneElement(element))) : [];
      await this.plugin.saveAnnotationState(this.file, elements, basePdf.fingerprint, backupBytes);
      this.cropPreview = null;
      this.applyLocalElementsAfterPdfRewrite(elements);
      new Notice(uiText("已回退上次 PDF 改写。", "Reverted the last PDF rewrite."));
    } catch (error) {
      console.error(error);
      new Notice(uiText("回退失败，请查看控制台。", "Could not revert. Check the console."));
    }
  }

  private getToolColor(tool: "pen" | "highlight"): string {
    return tool === "highlight" ? this.highlightColor : this.penColor;
  }

  private isDrawingToolMode(tool: ToolMode = this.tool): tool is "pen" | "highlight" {
    return tool === "pen" || tool === "highlight";
  }

  private shouldShowEditableSelection(): boolean {
    return !this.isDrawingToolMode();
  }

  private applyToolSettingsFromPlugin(): void {
    this.penColor = this.plugin.settings.penColor;
    this.penOpacity = this.plugin.settings.penOpacity;
    this.penWidth = this.plugin.settings.penWidth;
    this.highlightColor = this.plugin.settings.highlightColor;
    this.highlightOpacity = this.plugin.settings.highlightOpacity;
    this.highlightWidth = this.plugin.settings.highlightWidth;
    this.eraserWidth = this.plugin.settings.eraserWidth;
    this.textColor = this.plugin.settings.textColor;
    this.textFontFamily = this.plugin.settings.textFontFamily;
    this.textFontSize = this.plugin.settings.textFontSize;
    this.textOpacity = this.plugin.settings.textOpacity;
    this.nativeTextHighlightColor = this.plugin.settings.nativeTextHighlightColor;
  }

  private setToolColor(tool: "pen" | "highlight", color: string): void {
    color = normalizeHexColor(color);
    if (tool === "highlight") {
      this.highlightColor = color;
    } else {
      this.penColor = color;
    }
    this.scheduleToolSettingsSave();
  }

  private getSelectedPaletteColor(): string {
    const selected = this.getSelectedEditableElements();
    const colored = selected.find((element): element is InkStroke | InkText | InkCover => "color" in element);
    return normalizeHexColor(colored?.color ?? this.penColor);
  }

  private setSelectedPaletteColor(color: string): void {
    color = normalizeHexColor(color);
    let changed = false;
    const selected = this.getSelectedEditableElements();
    if (selected.some((element) => "color" in element && normalizeHexColor(element.color) !== color)) {
      this.rememberHistory();
    }
    for (const element of selected) {
      if (!("color" in element) || normalizeHexColor(element.color) === color) {
        continue;
      }
      this.markElementChanged(element);
      element.color = color;
      changed = true;
    }
    if (!changed) {
      return;
    }
    this.redoStack = [];
    this.markDirty();
    this.redrawAll();
    this.scheduleAutoSave();
  }

  private getToolOpacity(tool: "pen" | "highlight"): number {
    return tool === "highlight" ? this.highlightOpacity : this.penOpacity;
  }

  private setToolOpacity(tool: "pen" | "highlight", opacity: number): void {
    if (tool === "highlight") {
      this.highlightOpacity = opacity;
    } else {
      this.penOpacity = opacity;
    }
    this.scheduleToolSettingsSave();
  }

  private getToolWidth(tool: "pen" | "highlight"): number {
    return tool === "highlight" ? this.highlightWidth : this.penWidth;
  }

  private setToolWidth(tool: "pen" | "highlight", width: number): void {
    if (tool === "highlight") {
      this.highlightWidth = width;
    } else {
      this.penWidth = width;
    }
    this.scheduleToolSettingsSave();
  }

  private onPointerMove(event: PointerEvent, overlay: PageOverlay): void {
    if (!this.enabled) {
      return;
    }
    if (event.pointerType === "touch") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const events = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [event];
    const stroke = this.currentStroke;
    if (stroke?.pageIndex === overlay.pageIndex) {
      const startIndex = stroke.points.length - 1;
      for (const pointerEvent of events) {
        this.appendPointToCurrentStroke(
          stroke,
          this.getOverlayInputPoint(overlay, pointerEvent.clientX, pointerEvent.clientY),
          overlay,
          false
        );
      }
      if (stroke.points.length > startIndex + 1) {
        this.drawLiveStrokeSegments(overlay, stroke, startIndex);
      }
      return;
    }
    for (const pointerEvent of events) {
      this.moveInkInteraction(this.getOverlayInputPoint(overlay, pointerEvent.clientX, pointerEvent.clientY), overlay);
    }
  }

  private moveInkInteraction(point: InkPoint, overlay: PageOverlay): void {
    const tool = this.tool;
    const drawingTool = this.isDrawingToolMode(tool);

    if (this.selectionDrag) {
      if (drawingTool) {
        this.selectionDrag = null;
      } else {
        this.moveSelectionInteraction(point, overlay);
        return;
      }
    }

    if (this.currentCover && this.currentCover.pageIndex === overlay.pageIndex) {
      this.updateCurrentCover(point, overlay);
      return;
    }

    if (tool === "select") {
      this.moveSelectionInteraction(point, overlay);
      return;
    }

    if (tool === "eraser") {
      this.eraseAt(overlay, point);
      return;
    }

    const stroke = this.currentStroke;
    if (!stroke || stroke.pageIndex !== overlay.pageIndex) {
      return;
    }

    this.appendPointToCurrentStroke(stroke, point, overlay);
  }

  private isStrictDrawingTap(stroke: InkStroke, overlay: PageOverlay): boolean {
    if (this.currentStrokeHadTouchMove || this.currentStrokeMoved || stroke.points.length > 3) {
      return false;
    }
    if (Date.now() - this.currentStrokeStartedAt > 260) {
      return false;
    }
    const first = stroke.points[0];
    if (!first) {
      return false;
    }
    return stroke.points.every((point) => normalizedDistance(first, point, overlay.cssWidth, overlay.cssHeight) <= 1.25);
  }

  private clearCurrentStroke(): void {
    const pageIndex = this.currentStroke?.pageIndex;
    this.currentStroke = null;
    this.currentStrokeMoved = false;
    this.currentStrokeHadTouchMove = false;
    this.currentStrokeStartedAt = 0;
    if (pageIndex !== undefined) {
      const overlay = this.findOverlayByPageIndex(pageIndex);
      if (overlay) {
        this.clearLiveOverlay(overlay);
      }
    }
  }

  private resolveInkGroupId(stroke: InkStroke, overlay: PageOverlay): string {
    const now = Date.now();
    const bounds = normalizedStrokeBounds(stroke);
    const recent = this.recentInkGroup;
    const canReuseRecentGroup = Boolean(
      bounds &&
      recent &&
      now - recent.lastAt <= INK_AUTO_GROUP_WINDOW_MS &&
      recent.pageIndex === stroke.pageIndex &&
      recent.tool === stroke.tool &&
      recent.color === stroke.color &&
      Math.abs(recent.opacity - stroke.opacity) <= 0.001 &&
      Math.abs(recent.width - stroke.width) <= 0.01 &&
      normalizedBoundsAreNear(recent.bounds, bounds, overlay.cssWidth, overlay.cssHeight, INK_AUTO_GROUP_GAP_PX)
    );
    const groupId = canReuseRecentGroup && recent ? recent.id : makeInkGroupId();
    if (bounds) {
      this.recentInkGroup = {
        bounds: canReuseRecentGroup && recent ? unionNormalizedBounds(recent.bounds, bounds) : bounds,
        color: stroke.color,
        id: groupId,
        lastAt: now,
        opacity: stroke.opacity,
        pageIndex: stroke.pageIndex,
        tool: stroke.tool,
        width: stroke.width
      };
    }
    return groupId;
  }

  private updateCurrentCover(point: InkPoint, overlay: PageOverlay): void {
    const cover = this.currentCover;
    if (!cover) {
      return;
    }
    const x1 = cover.x;
    const y1 = cover.y;
    cover.x = Math.min(x1, point.x);
    cover.y = Math.min(y1, point.y);
    cover.width = Math.max(0.001, Math.abs(point.x - x1));
    cover.height = Math.max(0.001, Math.abs(point.y - y1));
    this.redrawOverlay(overlay);
  }

  private appendPointToCurrentStroke(stroke: InkStroke, point: InkPoint, overlay: PageOverlay, render = true): boolean {
    const last = stroke.points[stroke.points.length - 1];
    if (!last) {
      stroke.points.push(point);
      return true;
    }

    const distance = normalizedDistance(last, point, overlay.cssWidth, overlay.cssHeight);
    if (distance < STROKE_MIN_POINT_DISTANCE_PX) {
      return false;
    }

    this.currentStrokeMoved = true;
    const startIndex = stroke.points.length - 1;
    const steps = Math.max(1, Math.ceil(distance / STROKE_INTERPOLATION_STEP_PX));
    for (let i = 1; i <= steps; i += 1) {
      const ratio = i / steps;
      stroke.points.push({
        x: last.x + (point.x - last.x) * ratio,
        y: last.y + (point.y - last.y) * ratio
      });
    }

    if (render) {
      this.drawLiveStrokeSegments(overlay, stroke, startIndex);
    }
    return true;
  }

  private drawLiveStrokeSegments(overlay: PageOverlay, stroke: InkStroke, startIndex: number): void {
    const ctx = overlay.canvas.getContext("2d");
    if (!ctx || startIndex < 0 || startIndex >= stroke.points.length - 1) {
      this.requestOverlayRedraw(overlay, stroke);
      return;
    }
    ctx.setTransform(overlay.dpr, 0, 0, overlay.dpr, 0, 0);
    ctx.save();
    ctx.globalAlpha = stroke.opacity;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = strokeDisplayWidth(stroke, overlay.cssWidth);
    ctx.strokeStyle = stroke.color;
    ctx.beginPath();
    const first = stroke.points[startIndex];
    ctx.moveTo(first.x * overlay.cssWidth, first.y * overlay.cssHeight);
    for (let i = startIndex + 1; i < stroke.points.length; i += 1) {
      const point = stroke.points[i];
      ctx.lineTo(point.x * overlay.cssWidth, point.y * overlay.cssHeight);
    }
    ctx.stroke();
    ctx.restore();
  }

  private moveSelectionInteraction(point: InkPoint, overlay: PageOverlay): void {
    const drag = this.selectionDrag;
    if (!drag || drag.pageIndex !== overlay.pageIndex) {
      return;
    }

    const dx = point.x - drag.current.x;
    const dy = point.y - drag.current.y;
    const moved = normalizedDistance(drag.current, point, overlay.cssWidth, overlay.cssHeight) > 0.45;

    if (drag.mode === "move") {
      const selected = this.getSelectedEditableElements(overlay.pageIndex);
      if (selected.length === 0 || !moved) {
        return;
      }
      if (!drag.startedFromFreshSelection || !this.selectionWasExplicitTap) {
        this.selectionDrag = null;
        this.redrawAll();
        return;
      }
      if (!drag.historyRecorded) {
        this.rememberHistory();
        drag.historyRecorded = true;
      }

      for (const element of selected) {
        this.markElementChanged(element);
        translateElement(element, dx, dy);
      }
      shiftElementsInsidePage(selected);
      this.markDirty();
      this.redoStack = [];
      drag.moved = true;
      drag.current = point;
      this.requestOverlayRedraw(overlay);
      return;
    }

    if (drag.mode === "resize") {
      if (!drag.handle || !drag.originalBounds || !drag.originalElements || !moved) {
        return;
      }
      if (!drag.historyRecorded) {
        this.rememberHistory();
        drag.historyRecorded = true;
      }

      this.resizeSelectedElements(drag, point);
      this.markDirty();
      this.redoStack = [];
      drag.moved = true;
      drag.current = point;
      this.requestOverlayRedraw(overlay);
      return;
    }

    drag.current = point;
    drag.moved = drag.moved || moved;
    this.redrawOverlay(overlay);
  }

  private onPointerUp(event: PointerEvent, overlay: PageOverlay): void {
    if (!this.enabled) {
      return;
    }
    if (event.pointerType === "touch") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (overlay.canvas.hasPointerCapture(event.pointerId)) {
      overlay.canvas.releasePointerCapture(event.pointerId);
    }

    this.endInkInteraction(overlay);
  }

  private endInkInteraction(overlay: PageOverlay): void {
    if (this.selectionDrag) {
      this.endSelectionInteraction(overlay);
      return;
    }

    if (this.currentCover) {
      this.endCoverInteraction(overlay);
      return;
    }

    const stroke = this.currentStroke;
    if (!stroke) {
      return;
    }

    if (this.isStrictDrawingTap(stroke, overlay)) {
      const selected = this.findElementAt(overlay, stroke.points[0]);
      if (selected) {
        this.setSelectedElementForEditing(selected, overlay);
        this.clearCurrentStroke();
        this.redrawAll();
        this.updateToolbarState();
        return;
      }
      if (this.hasEditableSelection(overlay.pageIndex) || this.nativeSelection?.pageIndex === overlay.pageIndex) {
        this.clearEditableSelection();
        this.clearCurrentStroke();
        this.redrawAll();
        this.updateToolbarState();
        return;
      }
    }

    if (stroke.points.length === 1) {
      const only = stroke.points[0];
      stroke.points.push({
        x: Math.min(1, only.x + 0.001),
        y: Math.min(1, only.y + 0.001)
      });
    }

    this.rememberHistory();
    stroke.groupId = this.resolveInkGroupId(stroke, overlay);
    this.strokeHistory.push(stroke);
    this.redoStack = [];
    this.clearEditableSelection();
    this.clearCurrentStroke();
    this.markInkPageDirty(stroke.pageIndex);
    this.markDirty();
    this.redrawOverlay(overlay);
    this.scheduleAutoSave(STROKE_FAST_SAVE_DELAY_MS);
  }

  private endCoverInteraction(overlay: PageOverlay): void {
    const cover = this.currentCover;
    if (!cover) {
      return;
    }
    this.currentCover = null;
    if (cover.width * overlay.cssWidth < 6 || cover.height * overlay.cssHeight < 6) {
      this.redrawOverlay(overlay);
      return;
    }
    this.rememberHistory();
    this.coverHistory.push(cover);
    this.redoStack = [];
    this.clearEditableSelection();
    this.markDirty();
    this.redrawOverlay(overlay);
    this.scheduleAutoSave();
  }

  private endSelectionInteraction(overlay: PageOverlay): void {
    const drag = this.selectionDrag;
    if (!drag) {
      return;
    }

    this.selectionDrag = null;

    if (drag.mode === "move") {
      if (drag.moved) {
        this.redrawAll();
        this.scheduleAutoSave(250);
      } else if (drag.clearSelectionOnTap) {
        this.clearEditableSelection();
        this.redrawAll();
      }
      this.updateToolbarState();
      return;
    }

    if (drag.mode === "resize") {
      if (drag.moved) {
        this.redrawAll();
        this.scheduleAutoSave(250);
      }
      this.updateToolbarState();
      return;
    }

    if (drag.moved) {
      if (this.tool === "image-crop") {
        const region = this.createNativeImageRegionFromSelection(overlay, drag.start, drag.current);
        if (region) {
          this.pendingImageCrop = region;
          this.nativeSelection = region;
          this.redrawAll();
        }
        this.updateToolbarState();
        return;
      }

      const selectedElements = this.findElementsInSelection(overlay, drag.start, drag.current);
      this.setSelectedElements(selectedElements);
      const native = selectedElements.length === 0 ? this.createNativeRegionFromSelection(overlay, drag.start, drag.current) : null;
      this.nativeSelection = native?.kind === "text" ? native : null;
      this.redrawAll();
    }
    this.updateToolbarState();
  }

  private onTouchStart(event: TouchEvent, overlay: PageOverlay): void {
    if (!this.enabled) {
      return;
    }

    if (event.touches.length >= 2) {
      event.preventDefault();
      event.stopPropagation();
      this.touchGestureCooldownUntil = Date.now() + 450;
      this.clearCurrentStroke();
      this.activeTouchId = null;
      this.redrawAll();
      this.resizeOverlay(overlay);
      const center = getTouchCenter(event.touches);
      const centerPoint = this.getOverlayInputPoint(overlay, center.x, center.y);
      const selected = this.getSelectedEditableElements(overlay.pageIndex);
      const bounds = normalizedElementsBounds(selected);
      const resizeSelection = this.tool === "select" && selected.length > 0 && bounds !== null && this.selectionBoxContainsPoint(overlay, centerPoint);
      this.touchScroll = {
        initialDistance: getTouchDistance(event.touches),
        initialBounds: resizeSelection ? bounds : undefined,
        initialElements: resizeSelection ? selected.map(cloneElement) : undefined,
        lastX: center.x,
        lastY: center.y,
        mode: resizeSelection ? "resize-selection" : "scroll",
        scrollEl: findScrollableAncestor(overlay.pageEl)
      };
      return;
    }

    if (event.touches.length !== 1) {
      return;
    }
    if (Date.now() < this.touchGestureCooldownUntil) {
      event.preventDefault();
      event.stopPropagation();
      this.clearCurrentStroke();
      this.activeTouchId = null;
      return;
    }

    const touch = event.changedTouches[0];
    this.touchScroll = null;
    this.activeTouchId = touch.identifier;
    event.preventDefault();
    event.stopPropagation();
    this.resizeOverlay(overlay);
    const point = this.getOverlayInputPoint(overlay, touch.clientX, touch.clientY);
    const now = Date.now();
    const previousTap = this.lastTap;
    const isDoubleTap =
      previousTap !== null &&
      previousTap.pageIndex === overlay.pageIndex &&
      now - previousTap.time < 420 &&
      normalizedDistance(previousTap.point, point, overlay.cssWidth, overlay.cssHeight) < 18;
    this.lastTap = { pageIndex: overlay.pageIndex, point, time: now };
    if (isDoubleTap && this.openEditorAtPoint(point, overlay)) {
      this.activeTouchId = null;
      return;
    }
    this.beginInkInteraction(point, overlay);
  }

  private onTouchMove(event: TouchEvent, overlay: PageOverlay): void {
    if (!this.enabled) {
      return;
    }

    if (event.touches.length >= 2) {
      event.preventDefault();
      event.stopPropagation();
      this.touchGestureCooldownUntil = Date.now() + 450;
      this.clearCurrentStroke();
      this.activeTouchId = null;
      const center = getTouchCenter(event.touches);
      if (!this.touchScroll) {
        this.touchScroll = {
          initialDistance: getTouchDistance(event.touches),
          lastX: center.x,
          lastY: center.y,
          mode: "scroll",
          scrollEl: findScrollableAncestor(overlay.pageEl)
        };
        return;
      }

      const distance = getTouchDistance(event.touches);
      const zoomDelta = distance - this.touchScroll.initialDistance;

      if (this.touchScroll.mode === "resize-selection") {
        if (this.touchScroll.initialBounds && this.touchScroll.initialElements && Math.abs(zoomDelta) > 4) {
          if (!this.touchScroll.historyRecorded) {
            this.rememberHistory();
            this.touchScroll.historyRecorded = true;
          }
          this.resizeSelectedElementsFromPinch(this.touchScroll, distance);
          this.markDirty();
          this.redoStack = [];
          this.requestOverlayRedraw(overlay);
        }
        this.touchScroll.lastX = center.x;
        this.touchScroll.lastY = center.y;
        return;
      }

      const moveY = Math.abs(center.y - this.touchScroll.lastY);
      const moveX = Math.abs(center.x - this.touchScroll.lastX);
      if (Math.abs(zoomDelta) > 26 && Math.abs(zoomDelta) > Math.max(moveY, moveX) * 1.8) {
        dispatchPdfZoomGesture(this.rootEl, zoomDelta);
        this.touchScroll.initialDistance = distance;
        this.scheduleZoomGeometryRefresh();
      }

      this.touchScroll.scrollEl.scrollTop += this.touchScroll.lastY - center.y;
      this.touchScroll.scrollEl.scrollLeft += this.touchScroll.lastX - center.x;
      this.touchScroll.lastX = center.x;
      this.touchScroll.lastY = center.y;
      return;
    }

    if (this.activeTouchId === null) {
      return;
    }

    const touch = findTouch(event.touches, this.activeTouchId);
    if (!touch) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.currentStrokeHadTouchMove = true;
    this.moveInkInteraction(this.getOverlayInputPoint(overlay, touch.clientX, touch.clientY), overlay);
  }

  private onTouchEnd(event: TouchEvent, overlay: PageOverlay): void {
    if (!this.enabled) {
      return;
    }

    if (event.touches.length >= 2) {
      this.touchGestureCooldownUntil = Date.now() + 450;
      return;
    }

    if (event.touches.length === 1 && this.touchScroll) {
      this.touchGestureCooldownUntil = Date.now() + 450;
      if (this.touchScroll.mode === "resize-selection" && this.dirty) {
        this.scheduleAutoSave();
      }
      this.touchScroll = null;
      this.scheduleZoomGeometryRefresh(80);
      return;
    }

    this.touchScroll = null;
    this.scheduleZoomGeometryRefresh(80);
    if (this.activeTouchId === null) {
      return;
    }

    if (findTouch(event.touches, this.activeTouchId)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.activeTouchId = null;
    this.endInkInteraction(overlay);
  }

  private eraseAt(overlay: PageOverlay, point: InkPoint): void {
    const before = this.strokeHistory.length;
    const removed: InkStroke[] = [];
    const nextStrokes = this.strokeHistory.filter((stroke) => {
      if (stroke.pageIndex !== overlay.pageIndex) {
        return true;
      }
      const keep = !strokeContainsPoint(stroke, point, overlay.cssWidth, overlay.cssHeight, this.eraserWidth);
      if (!keep) {
        removed.push(stroke);
      }
      return keep;
    });

    if (nextStrokes.length !== before) {
      this.rememberHistory();
      this.markElementsDeleted(removed);
      this.strokeHistory = nextStrokes;
      this.redoStack = [];
      this.pruneSelection();
      this.markDirty();
      this.redrawOverlay(overlay);
      this.scheduleAutoSave();
    }
  }

  private undo(): void {
    const snapshot = this.undoStack.pop();
    if (!snapshot) {
      return;
    }
    this.redoHistoryStack.push(this.createHistorySnapshot());
    this.restoreHistorySnapshot(snapshot);
  }

  private redo(): void {
    const snapshot = this.redoHistoryStack.pop();
    if (!snapshot) {
      return;
    }
    this.undoStack.push(this.createHistorySnapshot());
    this.restoreHistorySnapshot(snapshot);
  }

  private async clearUnsavedInk(): Promise<void> {
    if (this.selectedStrokeIds.size > 0) {
      const selected = new Set(this.selectedStrokeIds);
      const before = this.getEditableElements().length;
      const removed = this.getEditableElements().filter((element) => selected.has(element.id));
      const nextStrokes = this.strokeHistory.filter((stroke) => !selected.has(stroke.id));
      const nextTexts = this.textHistory.filter((text) => !selected.has(text.id));
      const nextCovers = this.coverHistory.filter((cover) => !selected.has(cover.id));
      const nextImages = this.imageHistory.filter((image) => !selected.has(image.id));
      if (nextStrokes.length + nextTexts.length + nextCovers.length + nextImages.length !== before) {
        this.rememberHistory();
        this.markElementsDeleted(removed);
        this.strokeHistory = nextStrokes;
        this.textHistory = nextTexts;
        this.coverHistory = nextCovers;
        this.imageHistory = nextImages;
        this.clearCurrentStroke();
        this.currentCover = null;
        this.clearEditableSelection();
        this.redoStack = [];
        this.markDirty();
        this.redrawAll();
        this.scheduleAutoSave();
        return;
      }
    }

    if (this.nativeSelection) {
      const covered = this.aiCoverNativeSelection();
      if (covered) {
        this.nativeSelection = null;
        this.redrawAll();
      }
      return;
    }

    if (this.getEditableElements().length === 0) {
      return;
    }

    if (!(await showConfirmModal({
      confirmLabel: uiText("清空", "Clear"),
      message: uiText("清空可编辑标注？不会直接删除原 PDF 内容，但会移除覆盖层和本插件标注。", "Clear editable annotations? This will not delete original PDF content, but it will remove overlays and plugin annotations."),
      title: uiText("清空标注", "Clear annotations")
    }))) {
      return;
    }

    this.clearCurrentStroke();
    this.currentCover = null;
    this.rememberHistory();
    this.markElementsDeleted(this.getEditableElements());
    this.strokeHistory = [];
    this.textHistory = [];
    this.coverHistory = [];
    this.imageHistory = [];
    this.redoStack = [];
    this.pruneSelection();
    this.markDirty();
    this.redrawAll();
    this.scheduleAutoSave();
  }

  private redrawAll(): void {
    this.updateExternalInkLayerState();
    for (const overlay of this.overlays.values()) {
      if (this.isOverlayNearViewport(overlay)) {
        this.requestOverlayRedraw(overlay);
      }
    }
  }

  private requestOverlayRedraw(overlay: PageOverlay, previewStroke?: InkStroke): void {
    if (previewStroke) {
      overlay.redrawPreviewStroke = previewStroke;
    }
    if (overlay.redrawFrame !== null && overlay.redrawFrame !== undefined) {
      return;
    }
    overlay.redrawFrame = window.requestAnimationFrame(() => {
      overlay.redrawFrame = null;
      const pendingPreview = overlay.redrawPreviewStroke ?? undefined;
      overlay.redrawPreviewStroke = null;
      let resized = false;
      if (!this.currentStroke || this.currentStroke.pageIndex !== overlay.pageIndex) {
        resized = this.resizeOverlay(overlay);
      }
      if (!resized) {
        this.redrawOverlay(overlay, pendingPreview);
      }
    });
  }

  private isOverlayNearViewport(overlay: PageOverlay): boolean {
    const rect = overlay.pageEl.getBoundingClientRect();
    const margin = Math.max(activeWindow.innerHeight * 1.5, 900);
    return rect.bottom >= -margin && rect.top <= activeWindow.innerHeight + margin;
  }

  private redrawOverlay(overlay: PageOverlay, previewStroke?: InkStroke): void {
    const ctx = overlay.staticCanvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.setTransform(overlay.dpr, 0, 0, overlay.dpr, 0, 0);
    ctx.clearRect(0, 0, overlay.cssWidth, overlay.cssHeight);
    const editingText = this.nativeTextEditor !== null;
    const tintEditableSelection = !editingText;
    const showEditableSelectionControls = !editingText && this.shouldShowEditableSelection();

    for (const cover of this.coverHistory) {
      if (cover.pageIndex === overlay.pageIndex) {
        drawCoverElement(ctx, cover, overlay.cssWidth, overlay.cssHeight, tintEditableSelection && this.selectedStrokeIds.has(cover.id));
      }
    }

    if (this.currentCover && this.currentCover.pageIndex === overlay.pageIndex) {
      drawCoverElement(ctx, this.currentCover, overlay.cssWidth, overlay.cssHeight, false);
    }

    if (this.nativeTextEditorCover && this.nativeTextEditorCover.pageIndex === overlay.pageIndex) {
      drawCoverElement(ctx, this.nativeTextEditorCover, overlay.cssWidth, overlay.cssHeight, false);
    }

    for (const image of this.imageHistory) {
      if (image.pageIndex === overlay.pageIndex) {
        this.drawImageElement(ctx, image, overlay.cssWidth, overlay.cssHeight, tintEditableSelection && this.selectedStrokeIds.has(image.id));
      }
    }

    for (const stroke of this.strokeHistory) {
      if (stroke.pageIndex !== overlay.pageIndex) {
        continue;
      }
      if (this.savedInkIsBurnedIntoPdf && stroke.saved && !Array.isArray(stroke.pdfPoints)) {
        continue;
      }
      const selected = tintEditableSelection && this.selectedStrokeIds.has(stroke.id);
      drawStroke(ctx, stroke, overlay.cssWidth, overlay.cssHeight, selected);
    }

    for (const text of this.textHistory) {
      if (text.pageIndex === overlay.pageIndex && (!text.saved || !this.savedTextIsBurnedIntoPdf)) {
        drawTextElement(ctx, text, overlay.cssWidth, overlay.cssHeight, tintEditableSelection && this.selectedStrokeIds.has(text.id));
      }
    }

    if (showEditableSelectionControls && this.selectionDrag?.mode === "marquee" && this.selectionDrag.pageIndex === overlay.pageIndex) {
      drawMarqueeBox(ctx, this.selectionDrag.start, this.selectionDrag.current, overlay.cssWidth, overlay.cssHeight);
    }

    const selected = this.getSelectedEditableElements(overlay.pageIndex);
    if (showEditableSelectionControls && selected.length > 0) {
      drawSelectionGroup(ctx, selected, overlay.cssWidth, overlay.cssHeight);
    }

    if (showEditableSelectionControls && this.nativeSelection?.pageIndex === overlay.pageIndex) {
      drawNativeSelection(ctx, this.nativeSelection, overlay.cssWidth, overlay.cssHeight);
    }

    if (this.cropPreview?.pageIndexes.has(overlay.pageIndex)) {
      drawCropPreview(ctx, this.cropPreview.crop, overlay.cssWidth, overlay.cssHeight);
    }

    const liveStroke = previewStroke ?? (this.currentStroke?.pageIndex === overlay.pageIndex ? this.currentStroke : undefined);
    this.redrawLiveOverlay(overlay, liveStroke);
  }

  private clearLiveOverlay(overlay: PageOverlay): void {
    const ctx = overlay.canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, overlay.canvas.width, overlay.canvas.height);
  }

  private redrawLiveOverlay(overlay: PageOverlay, stroke?: InkStroke): void {
    this.clearLiveOverlay(overlay);
    if (!stroke || stroke.pageIndex !== overlay.pageIndex) {
      return;
    }
    const ctx = overlay.canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.setTransform(overlay.dpr, 0, 0, overlay.dpr, 0, 0);
    drawStroke(ctx, stroke, overlay.cssWidth, overlay.cssHeight, false);
  }

  private drawImageElement(ctx: CanvasRenderingContext2D, image: InkImage, cssWidth: number, cssHeight: number, selected = false): void {
    let bitmap = this.imageCache.get(image.dataUrl);
    if (!bitmap) {
      bitmap = new Image();
      bitmap.onload = () => this.redrawAll();
      bitmap.src = image.dataUrl;
      this.imageCache.set(image.dataUrl, bitmap);
    }
    if (!bitmap.complete || bitmap.naturalWidth === 0) {
      return;
    }

    ctx.save();
    ctx.globalAlpha = selected ? Math.max(0.2, image.opacity * 0.55) : image.opacity;
    ctx.drawImage(bitmap, image.x * cssWidth, image.y * cssHeight, image.width * cssWidth, image.height * cssHeight);
    ctx.restore();
  }

  private async saveIntoPdf(auto = false): Promise<void> {
    const elements = this.getEditableElements();
    const targetFile = this.file;
    const targetPath = targetFile.path;
    const hasUnsavedPdfStroke = elements.some((element) => element.kind === "stroke" && element.pdfSaved !== true);
    const changedInkPages = new Set([
      ...Array.from(this.dirtyInkPages),
      ...elements
        .filter((element): element is InkStroke => element.kind === "stroke" && element.pdfSaved !== true)
        .map((stroke) => stroke.pageIndex)
    ]);
    const deletedExternalInkIds = new Set(this.deletedExternalInkIds);
    const deletedPdftionInkIds = new Set(this.deletedPdftionInkIds);
    const hasInkPdfChange = changedInkPages.size > 0 || deletedExternalInkIds.size > 0 || deletedPdftionInkIds.size > 0;
    if (!this.dirty && elements.every((element) => element.saved) && !hasUnsavedPdfStroke && !hasInkPdfChange) {
      if (!auto) {
        new Notice(uiText("没有新的标注需要保存。", "No new annotations to save."));
      }
      return;
    }

    if (this.saving) {
      this.pendingSaveAfterCurrentSave = true;
      return;
    }

    this.clearAutoSaveTimer();
    this.saving = true;

    try {
      const binary = await this.plugin.app.vault.readBinary(targetFile);
      let buffer = binary;
      if (hasInkPdfChange) {
        const pdf = await PDFDocument.load(binary, { ignoreEncryption: true, updateMetadata: false });
        await syncEditableInkAnnotationsOnPdf(pdf, elements, {
          deletedExternalInkIds,
          deletedPdftionInkIds,
          dirtyPages: changedInkPages
        });
        const saved = await pdf.save({ addDefaultPage: false, useObjectStreams: false });
        buffer = new ArrayBuffer(saved.byteLength);
        new Uint8Array(buffer).set(saved);
        await this.plugin.app.vault.modifyBinary(targetFile, buffer);
      }

      const markedElements = elements.map((element) => {
        const wroteStrokeToPdf =
          element.kind === "stroke" &&
          changedInkPages.has(element.pageIndex);
        element.saved = true;
        if (element.kind === "stroke") {
          if (wroteStrokeToPdf) {
            element.pdfSaved = true;
            element.pdfPoints = element.points.map((point) => ({ ...point }));
            element.externalDirty = false;
          }
          if (wroteStrokeToPdf) {
            element.source = "pdftion";
          }
        }
        return cloneElement(element);
      });
      await this.plugin.saveEditableAnnotationState(targetFile, markedElements, buffer);

      if (this.file.path !== targetPath) {
        return;
      }

      this.clearCurrentStroke();
      this.currentCover = null;
      this.savedInkIsBurnedIntoPdf = false;
      this.savedTextIsBurnedIntoPdf = false;
      this.pendingNativeInkHidePages.clear();
      this.detachedInkEditPages.clear();
      this.dirtyInkPages.clear();
      this.deletedExternalInkIds.clear();
      this.deletedPdftionInkIds.clear();
      this.pruneSelection();
      this.dirty = false;
      this.updateExternalInkLayerState();
      if (!auto) {
        this.redrawAll();
      }
      if (!auto) {
        new Notice(uiText(`已保存到 ${targetFile.name}。`, `Saved into ${targetFile.name}.`));
      }
    } catch (error) {
      console.error(error);
      if (auto) {
        await this.saveEditableStateWhileSaving();
      } else {
        new Notice(uiText("自动保存失败，请查看控制台。", "Could not auto-save into this PDF. Check the console for details."));
      }
    } finally {
      this.saving = false;
      this.flushPendingEditableInkPrepare();
      if (this.pendingSaveAfterCurrentSave) {
        this.pendingSaveAfterCurrentSave = false;
        this.scheduleAutoSave(AUTO_SAVE_IDLE_DELAY_MS);
      }
    }
  }

  private async saveEditableState(): Promise<void> {
    const elements = this.getEditableElements();
    const targetFile = this.file;
    const targetPath = targetFile.path;
    if (!this.dirty && elements.every((element) => element.saved)) {
      return;
    }

    if (this.saving) {
      this.pendingSaveAfterCurrentSave = true;
      return;
    }

    this.clearAutoSaveTimer();
    this.saving = true;

    try {
      const binary = await this.plugin.app.vault.readBinary(targetFile);
      await this.plugin.saveEditableAnnotationState(targetFile, elements.map(markElementSaved), binary);

      if (this.file.path !== targetPath) {
        return;
      }

      this.savedInkIsBurnedIntoPdf = false;
      this.savedTextIsBurnedIntoPdf = false;
      for (const element of elements) {
        element.saved = true;
      }
      this.dirty = false;
    } catch (error) {
      console.warn("pdftion could not save editable annotation state; retrying.", error);
      if (this.file.path === targetPath) {
        this.scheduleAutoSave(1200);
      }
    } finally {
      this.saving = false;
      this.flushPendingEditableInkPrepare();
      if (this.pendingSaveAfterCurrentSave) {
        this.pendingSaveAfterCurrentSave = false;
        this.scheduleAutoSave(AUTO_SAVE_IDLE_DELAY_MS);
      }
    }
  }

  private flushPendingEditableInkPrepare(): void {
    if (!this.pendingEditableInkPrepareAfterSave || !this.enabled) {
      return;
    }
    this.pendingEditableInkPrepareAfterSave = false;
    this.detachedInkEditPages.clear();
    this.scheduleEditableInkPrepare(0, true);
    window.setTimeout(() => this.scheduleEditableInkPrepare(0, true), 500);
  }

  async exportAnnotationsMarkdown(): Promise<string | null> {
    this.commitNativeTextEditor();
    const targetFile = this.file;
    const base = targetFile.path.replace(/\.pdf$/i, "");
    let targetPath = `${base}-pdftion-content.md`;
    let index = 2;
    while (await this.plugin.app.vault.adapter.exists(targetPath)) {
      targetPath = `${base}-pdftion-content-${index}.md`;
      index += 1;
    }

    const markdown = await this.getPdfContentMarkdown();
    await this.plugin.app.vault.adapter.write(targetPath, markdown);
    new Notice(uiText(`已导出 Markdown：${targetPath}`, `Exported Markdown: ${targetPath}`));
    return targetPath;
  }

  async exportAnnotationsDocx(): Promise<string | null> {
    this.commitNativeTextEditor();
    const targetFile = this.file;
    const base = targetFile.path.replace(/\.pdf$/i, "");
    let targetPath = `${base}-pdftion-content.docx`;
    let index = 2;
    while (await this.plugin.app.vault.adapter.exists(targetPath)) {
      targetPath = `${base}-pdftion-content-${index}.docx`;
      index += 1;
    }

    const docx = buildDocxFromParagraphs(markdownToDocxParagraphs(await this.getPdfContentMarkdown()), targetFile.basename);
    const buffer = toArrayBufferCopy(docx);
    await this.plugin.app.vault.adapter.writeBinary(targetPath, buffer);
    new Notice(uiText(`已导出 DOCX：${targetPath}`, `Exported DOCX: ${targetPath}`));
    return targetPath;
  }

  private async getPdfContentMarkdown(): Promise<string> {
    const pageCount = await this.getCurrentPdfPageCount();
    const lines = [
      `# ${this.file.basename} PDF content`,
      "",
      `PDF: [[${this.file.path}]]`,
      `Exported: ${new Date().toISOString()}`,
      ""
    ];
    let extractedPages = 0;
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const overlay = this.findOverlayByPageIndex(pageIndex);
      const text = overlay ? this.extractNativeTextInRegion(overlay, 0, 0, 1, 1) : "";
      if (!text) {
        continue;
      }
      extractedPages += 1;
      lines.push(`## Page ${pageIndex + 1}`, "", text, "");
    }
    if (extractedPages === 0) {
      lines.push("> 当前 PDF 页面尚未渲染文字层；请先滚动到需要导出的页面后再导出，或后续接入完整 PDF 文本解析引擎。", "");
    } else if (extractedPages < pageCount) {
      lines.push(`> 已导出当前渲染到文字层的 ${extractedPages}/${pageCount} 页；未渲染页请滚动到对应页面后再次导出。`, "");
    }
    return lines.join("\n");
  }

  async exportMarkdownDocxBridge(): Promise<string | null> {
    const mdPath = await this.exportConvertedMarkdown({ notice: false });
    const docxPath = await this.exportConvertedDocx({ notice: false });
    if (mdPath || docxPath) {
      new Notice(uiText(`已导出转换文档：${[mdPath, docxPath].filter(Boolean).join(", ")}`, `Exported converted documents: ${[mdPath, docxPath].filter(Boolean).join(", ")}`));
    }
    return mdPath ?? docxPath;
  }

  private async prepareExportSnapshot(): Promise<void> {
    this.commitNativeTextEditor();
    await sleepMs(0);
    this.redrawAll();
    await waitForNextFrame();
  }

  async exportConvertedMarkdown(options: { notice?: boolean } = {}): Promise<string | null> {
    try {
      await this.prepareExportSnapshot();
      const pages = await this.captureVisualConversionPages();
      const folderPath = await this.writeVisualConversionImages(pages);
      const targetPath = await this.getUniqueConvertedPath("pdftion-converted", "md");
      const markdown = buildVisualConversionMarkdown(this.file, pages, folderPath);
      await this.plugin.app.vault.adapter.write(targetPath, markdown);
      if (options.notice !== false) {
        new Notice(uiText(`已转换 MD：${targetPath}`, `Converted MD: ${targetPath}`));
      }
      return targetPath;
    } catch (error) {
      console.error(error);
      new Notice(uiText("转换 MD 失败，请查看控制台。", "MD conversion failed. Check the console."));
      return null;
    }
  }

  async exportConvertedDocx(options: { notice?: boolean } = {}): Promise<string | null> {
    try {
      await this.prepareExportSnapshot();
      const pages = await this.captureVisualConversionPages();
      const targetPath = await this.getUniqueConvertedPath("pdftion-converted", "docx");
      const docx = buildDocxFromPageImages(pages, this.file.basename);
      const buffer = toArrayBufferCopy(docx);
      await this.plugin.app.vault.adapter.writeBinary(targetPath, buffer);
      if (options.notice !== false) {
        new Notice(uiText(`已转换 DOCX：${targetPath}`, `Converted DOCX: ${targetPath}`));
      }
      return targetPath;
    } catch (error) {
      console.error(error);
      new Notice(uiText("转换 DOCX 失败，请查看控制台。", "DOCX conversion failed. Check the console."));
      return null;
    }
  }

  private async captureVisualConversionPages(): Promise<VisualConversionPage[]> {
    const overlays = Array.from(this.overlays.values()).sort((a, b) => a.pageIndex - b.pageIndex);
    const pages: VisualConversionPage[] = [];
    for (const overlay of overlays) {
      const captured = await this.captureVisualPageImage(overlay);
      if (captured) {
        pages.push(captured);
      }
    }
    if (pages.length === 0) {
      throw new Error("No rendered PDF pages are available for conversion.");
    }
    return pages;
  }

  private async captureVisualPageImage(overlay: PageOverlay): Promise<VisualConversionPage | null> {
    const pdfCanvas = this.getPdfCanvas(overlay);
    if (!pdfCanvas) {
      return null;
    }

    const sourceWidth = Math.max(1, pdfCanvas.width);
    const sourceHeight = Math.max(1, pdfCanvas.height);
    const maxSize = 1800;
    const scale = Math.min(1, maxSize / Math.max(sourceWidth, sourceHeight));
    const outputWidth = Math.max(1, Math.round(sourceWidth * scale));
    const outputHeight = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = activeDocument.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }

    ctx.drawImage(pdfCanvas, 0, 0, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);
    ctx.save();
    ctx.scale(outputWidth / Math.max(1, overlay.cssWidth), outputHeight / Math.max(1, overlay.cssHeight));
    const elements = this.getEditableElements();
    for (const cover of elements.filter((element): element is InkCover => element.kind === "cover" && element.pageIndex === overlay.pageIndex && !element.saved)) {
      drawCoverElement(ctx, cover, overlay.cssWidth, overlay.cssHeight, false);
    }
    for (const image of elements.filter((element): element is InkImage => element.kind === "image" && element.pageIndex === overlay.pageIndex)) {
      await this.drawImageElementForExport(ctx, image, overlay.cssWidth, overlay.cssHeight);
    }
    for (const stroke of elements.filter((element): element is InkStroke => (
      element.kind === "stroke" &&
      element.pageIndex === overlay.pageIndex &&
      (!element.saved || !this.savedInkIsBurnedIntoPdf || Array.isArray(element.pdfPoints))
    ))) {
      drawStroke(ctx, stroke, overlay.cssWidth, overlay.cssHeight, false);
    }
    for (const text of elements.filter((element): element is InkText => element.kind === "text" && element.pageIndex === overlay.pageIndex && (!element.saved || !this.savedTextIsBurnedIntoPdf))) {
      drawTextElement(ctx, text, overlay.cssWidth, overlay.cssHeight, false);
    }
    ctx.restore();

    const dataUrl = canvas.toDataURL("image/png");
    return {
      bytes: dataUrlToBytes(dataUrl),
      height: outputHeight,
      pageIndex: overlay.pageIndex,
      width: outputWidth
    };
  }

  private async drawImageElementForExport(ctx: CanvasRenderingContext2D, image: InkImage, cssWidth: number, cssHeight: number): Promise<void> {
    const bitmap = await loadDataUrlImage(image.dataUrl);
    ctx.save();
    ctx.globalAlpha = image.opacity;
    ctx.drawImage(bitmap, image.x * cssWidth, image.y * cssHeight, image.width * cssWidth, image.height * cssHeight);
    ctx.restore();
  }

  private async writeVisualConversionImages(pages: VisualConversionPage[]): Promise<string> {
    const targetFile = this.file;
    const base = targetFile.path.replace(/\.pdf$/i, "");
    let folderPath = `${base}-pdftion-pages`;
    let index = 2;
    while (await this.plugin.app.vault.adapter.exists(folderPath)) {
      folderPath = `${base}-pdftion-pages-${index}`;
      index += 1;
    }

    await this.ensureVaultFolder(folderPath);
    for (const page of pages) {
      const pageName = `page-${String(page.pageIndex + 1).padStart(3, "0")}.png`;
      page.path = `${folderPath}/${pageName}`;
      const buffer = toArrayBufferCopy(page.bytes);
      await this.plugin.app.vault.adapter.writeBinary(page.path, buffer);
    }
    return folderPath;
  }

  private async getUniqueConvertedPath(suffix: string, extension: string): Promise<string> {
    const base = this.file.path.replace(/\.pdf$/i, "");
    let target = `${base}-${suffix}.${extension}`;
    let index = 2;
    while (await this.plugin.app.vault.adapter.exists(target)) {
      target = `${base}-${suffix}-${index}.${extension}`;
      index += 1;
    }
    return target;
  }

  private async ensureVaultFolder(path: string): Promise<void> {
    if (!path) {
      return;
    }
    const parts = path.split("/").filter(Boolean);
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!(await this.plugin.app.vault.adapter.exists(current))) {
        await this.plugin.app.vault.adapter.mkdir(current);
      }
    }
  }

  async exportAnnotatedPdf(options: { notice?: boolean; share?: boolean } = {}): Promise<string | null> {
    const progressNotice = options.notice !== false
      ? new Notice(uiText("正在导出烧录 PDF...", "Exporting burned-in PDF..."), 0)
      : null;
    try {
      if (progressNotice) {
        await waitForUiPaint();
      }
      this.commitNativeTextEditor();
      this.redrawAll();

      const elements = this.getEditableElements().map(cloneElement);
      const targetFile = this.file;
      const targetPath = await this.getUniqueAnnotatedPdfPath(targetFile);
      const binary = await this.plugin.app.vault.readBinary(targetFile);
      let basePdf = await this.plugin.ensureBasePdfBytes(targetFile, binary);
      let pdf: PDFDocument;
      try {
        pdf = await PDFDocument.load(basePdf.bytes, { ignoreEncryption: true, updateMetadata: false });
      } catch (error) {
        console.warn("pdftion could not load the stored base PDF for export; retrying with the current PDF.", error);
        basePdf = {
          bytes: binary,
          fingerprint: await this.plugin.replaceBasePdfBytes(targetFile, binary)
        };
        pdf = await PDFDocument.load(binary, { ignoreEncryption: true, updateMetadata: false });
      }
      const fontBytes = elements.some((element) => element.kind === "text") ? await this.plugin.loadAnnotationFontBytes() : null;
      await drawVisibleInkElementsOnPdf(pdf, elements, fontBytes);

      const saved = await pdf.save({ addDefaultPage: false, useObjectStreams: false });
      const buffer = new ArrayBuffer(saved.byteLength);
      new Uint8Array(buffer).set(saved);
      const exportedFile = await this.plugin.app.vault.createBinary(targetPath, buffer);
      const opened = await this.openExportedPdfIfEnabled(exportedFile);

      const shared = options.share === false ? false : await trySharePdf(targetPath.split("/").pop() ?? targetFile.name, saved);
      if (progressNotice) {
        progressNotice.setMessage(
          opened
            ? uiText(`已导出并打开：${targetPath}`, `Exported and opened: ${targetPath}`)
            : shared
              ? uiText(`已导出并分享：${targetPath}`, `Exported and shared: ${targetPath}`)
              : uiText(`已导出：${targetPath}`, `Exported: ${targetPath}`)
        );
        window.setTimeout(() => progressNotice.hide(), 4500);
      }
      return targetPath;
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : String(error);
      if (progressNotice) {
        progressNotice.setMessage(uiText(`导出 PDF 失败：${message}`, `PDF export failed: ${message}`));
        window.setTimeout(() => progressNotice.hide(), 7000);
      } else {
        new Notice(uiText(`导出 PDF 失败：${message}`, `PDF export failed: ${message}`));
      }
      return null;
    }
  }

  private async openExportedPdfIfEnabled(file: TFile): Promise<boolean> {
    if (!this.plugin.settings.openBurnedPdfAfterExport) {
      return false;
    }

    try {
      await this.plugin.app.workspace.getLeaf(false).openFile(file);
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  private async redactCoveredPagesIntoCurrentPdf(): Promise<void> {
    this.commitNativeTextEditor();
    const elements = this.getEditableElements().map(cloneElement);
    if (!elements.some((element) => element.kind === "cover")) {
      new Notice(uiText("没有遮挡区域可固化。", "No cover regions to flatten."));
      return;
    }
    if (!(await showConfirmModal({
      confirmLabel: uiText("固化", "Flatten"),
      message: uiText("固化遮挡会修改当前 PDF：有遮挡的已渲染页面会重建为图片页，从而删除底层被遮挡文字/图片对象。继续？", "Flattening covers will modify the current PDF by rebuilding rendered covered pages as images. Continue?"),
      title: uiText("固化遮挡", "Flatten covers")
    }))) {
      return;
    }

    const binary = await this.plugin.app.vault.readBinary(this.file);
    const { flattenedPages, pdf } = await this.buildPdfWithFlattenedCoveredPages(binary, elements, "covers-only");
    if (flattenedPages.size === 0) {
      new Notice(uiText("当前没有可固化的已渲染遮挡页。请先滚到有遮挡的页面再试。", "No rendered covered pages are available. Scroll to covered pages and try again."));
      return;
    }
    const saved = await pdf.save({ useObjectStreams: true });
    await this.persistPdfRewrite(saved, elements, uiText(`已固化 ${flattenedPages.size} 页遮挡`, `Flattened covers on ${flattenedPages.size} pages`));
  }

  private async buildPdfWithFlattenedCoveredPages(
    sourceBytes: ArrayBuffer,
    elements: InkElement[],
    mode: "all" | "covers-only"
  ): Promise<{ flattenedPages: Set<number>; pdf: PDFDocument }> {
    const source = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
    const output = await PDFDocument.create();
    const flattenedPages = new Set<number>();
    const pageCount = source.getPageCount();
    const coverPages = new Set(elements.filter((element): element is InkCover => element.kind === "cover").map((cover) => cover.pageIndex));

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const page = source.getPage(pageIndex);
      const overlay = coverPages.has(pageIndex) ? this.findOverlayByPageIndex(pageIndex) : null;
      const pageElements = elements.filter((element) => element.pageIndex === pageIndex);
      const dataUrl = overlay ? await this.renderFlattenedPageDataUrl(overlay, pageElements, mode) : null;
      if (dataUrl) {
        const size = page.getSize();
        const outPage = output.addPage([size.width, size.height]);
        const image = await output.embedPng(dataUrlToBytes(dataUrl));
        outPage.drawImage(image, { height: size.height, width: size.width, x: 0, y: 0 });
        flattenedPages.add(pageIndex);
        continue;
      }

      const [copied] = await output.copyPages(source, [pageIndex]);
      output.addPage(copied);
    }

    return { flattenedPages, pdf: output };
  }

  private async renderFlattenedPageDataUrl(overlay: PageOverlay, elements: InkElement[], mode: "all" | "covers-only"): Promise<string | null> {
    const pdfCanvas = this.getPdfCanvas(overlay);
    if (!pdfCanvas || pdfCanvas.width <= 0 || pdfCanvas.height <= 0) {
      return null;
    }
    const canvas = activeDocument.createElement("canvas");
    canvas.width = pdfCanvas.width;
    canvas.height = pdfCanvas.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }
    ctx.drawImage(pdfCanvas, 0, 0, canvas.width, canvas.height);
    const scaleX = canvas.width / Math.max(1, overlay.cssWidth);
    const scaleY = canvas.height / Math.max(1, overlay.cssHeight);
    ctx.save();
    ctx.scale(scaleX, scaleY);

    for (const cover of elements.filter((element): element is InkCover => element.kind === "cover")) {
      drawCoverElement(ctx, cover, overlay.cssWidth, overlay.cssHeight, false);
    }
    if (mode === "all") {
      for (const image of elements.filter((element): element is InkImage => element.kind === "image")) {
        await drawImageDataUrl(ctx, image, overlay.cssWidth, overlay.cssHeight);
      }
      for (const stroke of elements.filter((element): element is InkStroke => element.kind === "stroke")) {
        drawStroke(ctx, stroke, overlay.cssWidth, overlay.cssHeight, false);
      }
      for (const text of elements.filter((element): element is InkText => element.kind === "text")) {
        drawTextElement(ctx, text, overlay.cssWidth, overlay.cssHeight, false);
      }
    }

    ctx.restore();
    return canvas.toDataURL("image/png");
  }

  private async getUniqueAnnotatedPdfPath(file: TFile): Promise<string> {
    const base = file.path.replace(/\.pdf$/i, "");
    let target = `${base}-annotated.pdf`;
    let index = 2;
    while (await this.plugin.app.vault.adapter.exists(target)) {
      target = `${base}-annotated-${index}.pdf`;
      index += 1;
    }
    return target;
  }

  jumpToPage(pageIndex: number): boolean {
    const overlay = this.findOverlayByPageIndex(pageIndex);
    if (!overlay) {
      return false;
    }
    overlay.pageEl.scrollIntoView({ block: "start", behavior: "smooth" });
    return true;
  }

  private findElementAt(overlay: PageOverlay, point: InkPoint): InkElement | null {
    const text = this.findTextElementAt(overlay, point);
    if (text) {
      return text;
    }

    const image = this.findImageElementAt(overlay, point);
    if (image) {
      return image;
    }

    return this.findStrokeElementAt(overlay, point);
  }

  private findCoverElementAt(overlay: PageOverlay, point: InkPoint, includeNativeTextCover = true): InkCover | null {
    for (let i = this.coverHistory.length - 1; i >= 0; i -= 1) {
      const cover = this.coverHistory[i];
      if (cover.pageIndex !== overlay.pageIndex) {
        continue;
      }
      if (!includeNativeTextCover && cover.source === "native-text") {
        continue;
      }
      if (coverBoxContainsPoint(cover, point)) {
        return cover;
      }
    }

    return null;
  }

  private findTextElementAt(overlay: PageOverlay, point: InkPoint): InkText | null {
    for (let i = this.textHistory.length - 1; i >= 0; i -= 1) {
      const text = this.textHistory[i];
      if (text.pageIndex !== overlay.pageIndex) {
        continue;
      }
      if (textBoxContainsPoint(text, point, overlay.cssWidth, overlay.cssHeight)) {
        return text;
      }
    }

    return null;
  }

  private findStrokeElementAt(overlay: PageOverlay, point: InkPoint): InkStroke | null {
    for (let i = this.strokeHistory.length - 1; i >= 0; i -= 1) {
      const stroke = this.strokeHistory[i];
      if (stroke.pageIndex !== overlay.pageIndex) {
        continue;
      }
      if (strokeBoxContainsPoint(stroke, point, overlay.cssWidth, overlay.cssHeight)) {
        return stroke;
      }
    }
    return null;
  }

  private findImageElementAt(overlay: PageOverlay, point: InkPoint): InkImage | null {
    for (let i = this.imageHistory.length - 1; i >= 0; i -= 1) {
      const image = this.imageHistory[i];
      if (image.pageIndex !== overlay.pageIndex) {
        continue;
      }
      if (imageBoxContainsPoint(image, point)) {
        return image;
      }
    }
    return null;
  }

  private findElementsInSelection(overlay: PageOverlay, start: InkPoint, end: InkPoint): InkElement[] {
    const strokes = this.strokeHistory.filter((stroke) => {
      if (stroke.pageIndex !== overlay.pageIndex) {
        return false;
      }
      return strokeIntersectsSelection(stroke, start, end, overlay.cssWidth, overlay.cssHeight);
    });

    const texts = this.textHistory.filter((text) => {
      if (text.pageIndex !== overlay.pageIndex) {
        return false;
      }
      return textIntersectsSelection(text, start, end, overlay.cssWidth, overlay.cssHeight);
    });

    const images = this.imageHistory.filter((image) => {
      if (image.pageIndex !== overlay.pageIndex) {
        return false;
      }
      return imageIntersectsSelection(image, start, end);
    });

    return [...strokes, ...texts, ...images];
  }

  private findNativeObjectAt(overlay: PageOverlay, point: InkPoint): PdfNativeObject | null {
    const overlayRect = this.getOverlayClientRect(overlay);
    const clientX = overlayRect.left + point.x * overlay.cssWidth;
    const clientY = overlayRect.top + point.y * overlay.cssHeight;
    const textSpans = Array.from(
      overlay.pageEl.querySelectorAll<HTMLElement>(".textLayer span, .textLayer .markedContent, [data-canvas-width]")
    );

    for (let i = textSpans.length - 1; i >= 0; i -= 1) {
      const span = textSpans[i];
      const text = span.textContent?.trim();
      if (!text) {
        continue;
      }
      const rect = span.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) {
        continue;
      }
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        return {
          height: clamp(rect.height / Math.max(1, overlay.cssHeight), 0.001, 1),
          id: `native-text-${overlay.pageIndex}-${i}`,
          kind: "text",
          pageIndex: overlay.pageIndex,
          text,
          width: clamp(rect.width / Math.max(1, overlay.cssWidth), 0.001, 1),
          x: clamp((rect.left - overlayRect.left) / Math.max(1, overlay.cssWidth), 0, 1),
          y: clamp((rect.top - overlayRect.top) / Math.max(1, overlay.cssHeight), 0, 1)
        };
      }
    }

    return null;
  }

  private createNativeRegionFromSelection(overlay: PageOverlay, start: InkPoint, end: InkPoint): PdfNativeObject | null {
    const minX = Math.min(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const width = Math.abs(start.x - end.x);
    const height = Math.abs(start.y - end.y);
    if (width * overlay.cssWidth < 5 || height * overlay.cssHeight < 5) {
      return null;
    }

    const text = this.extractNativeTextInRegion(overlay, minX, minY, width, height);
    return {
      height,
      id: `native-region-${overlay.pageIndex}-${Date.now().toString(36)}`,
      kind: text ? "text" : "region",
      pageIndex: overlay.pageIndex,
      text: text || undefined,
      width,
      x: minX,
      y: minY
    };
  }

  private createNativeImageRegionFromSelection(overlay: PageOverlay, start: InkPoint, end: InkPoint): PdfNativeObject | null {
    const minX = Math.min(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const width = Math.abs(start.x - end.x);
    const height = Math.abs(start.y - end.y);
    if (width * overlay.cssWidth < 5 || height * overlay.cssHeight < 5) {
      return null;
    }
    return {
      height,
      id: `native-image-region-${overlay.pageIndex}-${Date.now().toString(36)}`,
      kind: "region",
      pageIndex: overlay.pageIndex,
      width,
      x: minX,
      y: minY
    };
  }

  private convertNativeRegionToImage(selection: PdfNativeObject, overlay: PageOverlay): boolean {
    const dataUrl = this.captureNativeRegionImage(selection, overlay);
    if (!dataUrl) {
      return false;
    }

    const cover: InkCover = {
      color: this.sampleOuterBackgroundColor(overlay, selection),
      height: selection.height,
      id: makeStrokeId(),
      kind: "cover",
      opacity: 1,
      pageCssHeight: overlay.cssHeight,
      pageCssWidth: overlay.cssWidth,
      pageIndex: selection.pageIndex,
      saved: false,
      source: "native-region",
      width: selection.width,
      x: selection.x,
      y: selection.y
    };
    const image: InkImage = {
      dataUrl,
      height: selection.height,
      id: makeStrokeId(),
      kind: "image",
      opacity: 1,
      pageCssHeight: overlay.cssHeight,
      pageCssWidth: overlay.cssWidth,
      pageIndex: selection.pageIndex,
      saved: false,
      width: selection.width,
      x: selection.x,
      y: selection.y
    };

    this.rememberHistory();
    this.coverHistory.push(cover);
    this.imageHistory.push(image);
    this.setSingleSelectedElement(image.id);
    this.redoStack = [];
    this.markDirty();
    this.scheduleAutoSave();
    return true;
  }

  private captureNativeRegionImage(selection: PdfNativeObject, overlay: PageOverlay): string | null {
    const pdfCanvas = this.getPdfCanvas(overlay);
    if (!pdfCanvas) {
      return null;
    }

    const sourceX = clamp(Math.round(selection.x * pdfCanvas.width), 0, Math.max(0, pdfCanvas.width - 1));
    const sourceY = clamp(Math.round(selection.y * pdfCanvas.height), 0, Math.max(0, pdfCanvas.height - 1));
    const sourceWidth = clamp(Math.round(selection.width * pdfCanvas.width), 1, Math.max(1, pdfCanvas.width - sourceX));
    const sourceHeight = clamp(Math.round(selection.height * pdfCanvas.height), 1, Math.max(1, pdfCanvas.height - sourceY));
    const maxSize = 1600;
    const scale = Math.min(1, maxSize / Math.max(sourceWidth, sourceHeight));
    const outputWidth = Math.max(1, Math.round(sourceWidth * scale));
    const outputHeight = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = activeDocument.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }
    ctx.drawImage(pdfCanvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);
    return canvas.toDataURL("image/png");
  }

  private async pickAndInsertImageFile(): Promise<void> {
    const file = await pickImageFile();
    if (!file) {
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    const size = await getImageDataUrlSize(dataUrl);
    const overlay = this.getVisibleOverlay() ?? Array.from(this.overlays.values())[0];
    if (!overlay) {
      new Notice(uiText("没有可插入图片的 PDF 页面。", "No PDF page is available for image insertion."));
      return;
    }
    const maxWidth = 0.42;
    const maxHeight = 0.42;
    const ratio = size.width / Math.max(1, size.height);
    let width = maxWidth;
    let height = width / ratio * (overlay.cssWidth / Math.max(1, overlay.cssHeight));
    if (height > maxHeight) {
      height = maxHeight;
      width = height * ratio * (overlay.cssHeight / Math.max(1, overlay.cssWidth));
    }
    const image: InkImage = {
      dataUrl,
      height: clamp(height, 0.03, 0.9),
      id: makeStrokeId(),
      kind: "image",
      opacity: 1,
      pageCssHeight: overlay.cssHeight,
      pageCssWidth: overlay.cssWidth,
      pageIndex: overlay.pageIndex,
      saved: false,
      width: clamp(width, 0.03, 0.9),
      x: 0.5 - clamp(width, 0.03, 0.9) / 2,
      y: 0.5 - clamp(height, 0.03, 0.9) / 2
    };
    this.rememberHistory();
    this.imageHistory.push(image);
    this.setSingleSelectedElement(image.id);
    this.redoStack = [];
    this.markDirty();
    this.redrawAll();
    this.scheduleAutoSave();
  }

  private async insertObsidianLinkInteractive(): Promise<void> {
    const raw = await showPromptModal({
      actionLabel: uiText("插入", "Insert"),
      message: uiText("输入链接或笔记名，例如 [[笔记]] / ![[图片.png]]", "Enter a link or note name, for example [[Note]] / ![[image.png]]"),
      title: uiText("插入链接", "Insert link")
    });
    if (!raw) {
      return;
    }
    await this.insertObsidianLink({ link: raw });
  }

  async insertObsidianLink(input: PdftionObsidianLinkInput): Promise<string | null> {
    const link = normalizeObsidianLink(input.link);
    if (!link) {
      return null;
    }
    if (link.embed) {
      const inserted = await this.insertVaultImage({
        path: link.target,
        pageIndex: input.pageIndex,
        x: input.x,
        y: input.y
      });
      if (inserted) {
        return inserted;
      }
    }

    const overlay = this.resolveTargetOverlay(input.pageIndex);
    if (!overlay) {
      new Notice(uiText("没有可插入链接的 PDF 页面。", "No PDF page is available for link insertion."));
      return null;
    }
    return this.aiAddText({
      color: normalizeHexColor(input.color ?? this.textColor),
      fontFamily: this.textFontFamily,
      fontSize: input.fontSize ?? this.textFontSize,
      opacity: this.textOpacity,
      pageCssHeight: overlay.cssHeight,
      pageCssWidth: overlay.cssWidth,
      pageIndex: overlay.pageIndex,
      text: input.label?.trim() || link.wikilink,
      x: input.x ?? 0.08,
      y: input.y ?? 0.08
    });
  }

  async insertVaultImage(input: PdftionVaultImageInput): Promise<string | null> {
    const file = this.resolveVaultFile(input.path);
    if (!(file instanceof TFile) || !isImageExtension(file.extension)) {
      new Notice(uiText("未找到可插入的图片。", "No insertable image was found."));
      return null;
    }

    const binary = await this.plugin.app.vault.readBinary(file);
    const dataUrl = arrayBufferToDataUrl(binary, imageMimeFromExtension(file.extension));
    const size = await getImageDataUrlSize(dataUrl);
    const overlay = this.resolveTargetOverlay(input.pageIndex);
    if (!overlay) {
      new Notice(uiText("没有可插入图片的 PDF 页面。", "No PDF page is available for image insertion."));
      return null;
    }
    const dimensions = fitImageToOverlay(size, overlay, input.width, input.height);
    return this.aiAddImage({
      dataUrl,
      height: dimensions.height,
      opacity: input.opacity ?? 1,
      pageCssHeight: overlay.cssHeight,
      pageCssWidth: overlay.cssWidth,
      pageIndex: overlay.pageIndex,
      width: dimensions.width,
      x: input.x ?? 0.5 - dimensions.width / 2,
      y: input.y ?? 0.5 - dimensions.height / 2
    });
  }

  private resolveVaultFile(path: string): TFile | null {
    const cleaned = stripObsidianLinkSyntax(path);
    const linked = this.plugin.app.metadataCache.getFirstLinkpathDest(cleaned, this.file.path);
    if (linked instanceof TFile) {
      return linked;
    }
    const direct = this.plugin.app.vault.getAbstractFileByPath(cleaned);
    return direct instanceof TFile ? direct : null;
  }

  private resolveTargetOverlay(pageIndex?: number): PageOverlay | null {
    if (typeof pageIndex === "number") {
      const overlay = this.findOverlayByPageIndex(Math.max(0, Math.floor(pageIndex)));
      if (overlay) {
        return overlay;
      }
    }
    return this.getVisibleOverlay() ?? Array.from(this.overlays.values())[0] ?? null;
  }

  private sampleOuterBackgroundColor(overlay: PageOverlay, selection: PdfNativeObject): string {
    const pdfCanvas = this.getPdfCanvas(overlay);
    if (!pdfCanvas) {
      return "#ffffff";
    }

    try {
      const ctx = pdfCanvas.getContext("2d");
      if (!ctx) {
        return "#ffffff";
      }
      const padX = Math.max(2 / Math.max(1, overlay.cssWidth), selection.width * 0.08);
      const padY = Math.max(2 / Math.max(1, overlay.cssHeight), selection.height * 0.08);
      const samples = [
        { x: selection.x - padX, y: selection.y + selection.height * 0.5 },
        { x: selection.x + selection.width + padX, y: selection.y + selection.height * 0.5 },
        { x: selection.x + selection.width * 0.5, y: selection.y - padY },
        { x: selection.x + selection.width * 0.5, y: selection.y + selection.height + padY },
        { x: selection.x - padX, y: selection.y - padY },
        { x: selection.x + selection.width + padX, y: selection.y - padY },
        { x: selection.x - padX, y: selection.y + selection.height + padY },
        { x: selection.x + selection.width + padX, y: selection.y + selection.height + padY }
      ];
      const colors = samples.map((sample) => {
        const x = clamp(sample.x * pdfCanvas.width, 0, Math.max(0, pdfCanvas.width - 1));
        const y = clamp(sample.y * pdfCanvas.height, 0, Math.max(0, pdfCanvas.height - 1));
        const data = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
        return { b: data[2], g: data[1], luminance: 0.299 * data[0] + 0.587 * data[1] + 0.114 * data[2], r: data[0] };
      });
      const candidate = colors.sort((a, b) => b.luminance - a.luminance)[Math.floor(colors.length / 2)] ?? colors[0];
      return candidate ? rgbToHex(candidate.r, candidate.g, candidate.b) : "#ffffff";
    } catch {
      return "#ffffff";
    }
  }

  private extractNativeTextInRegion(overlay: PageOverlay, x: number, y: number, width: number, height: number): string {
    const overlayRect = this.getOverlayClientRect(overlay);
    const region = {
      bottom: overlayRect.top + (y + height) * overlay.cssHeight,
      left: overlayRect.left + x * overlay.cssWidth,
      right: overlayRect.left + (x + width) * overlay.cssWidth,
      top: overlayRect.top + y * overlay.cssHeight
    };
    const parts: string[] = [];
    for (const span of Array.from(overlay.pageEl.querySelectorAll<HTMLElement>(".textLayer span, .textLayer .markedContent, [data-canvas-width]"))) {
      const text = span.textContent?.trim();
      if (!text) {
        continue;
      }
      const rect = span.getBoundingClientRect();
      if (rect.right >= region.left && rect.left <= region.right && rect.bottom >= region.top && rect.top <= region.bottom) {
        parts.push(text);
      }
    }
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }

  convertNativeSelectionToEditable(): ConversionResult {
    const selection = this.nativeSelection;
    if (!selection) {
      return { covers: 0, skipped: 0, texts: 0 };
    }

    const overlay = this.findOverlayByPageIndex(selection.pageIndex);
    if (!overlay) {
      return { covers: 0, skipped: 0, texts: 0 };
    }

    const result = selection.kind === "text"
      ? this.convertNativeTextBlocksToEditable(overlay, selection)
      : this.convertNativeRegionToCover(selection, overlay);
    this.nativeSelection = null;
    this.selectedStrokeIds.clear();
    this.redrawAll();
    return result;
  }

  convertCurrentPageToEditable(): ConversionResult {
    const overlay = this.getVisibleOverlay() ?? Array.from(this.overlays.values())[0];
    return overlay ? this.convertNativePageToEditable(overlay.pageIndex) : { covers: 0, skipped: 0, texts: 0 };
  }

  convertNativePageToEditable(pageIndex?: number): ConversionResult {
    const overlay = pageIndex === undefined ? this.getVisibleOverlay() : this.findOverlayByPageIndex(pageIndex);
    if (!overlay) {
      return { covers: 0, skipped: 0, texts: 0 };
    }
    return this.convertNativeTextBlocksToEditable(overlay);
  }

  convertNativeDocumentToEditable(): ConversionResult {
    const total: ConversionResult = { covers: 0, pages: 0, skipped: 0, texts: 0 };
    for (const overlay of this.overlays.values()) {
      const result = this.convertNativeTextBlocksToEditable(overlay);
      total.covers += result.covers;
      total.skipped = (total.skipped ?? 0) + (result.skipped ?? 0);
      total.texts += result.texts;
      if (result.covers > 0 || result.texts > 0) {
        total.pages = (total.pages ?? 0) + 1;
      }
    }
    return total;
  }

  private convertNativeTextBlocksToEditable(overlay: PageOverlay, region?: PdfNativeObject): ConversionResult {
    const blocks = this.collectNativeTextBlocks(overlay, region);
    let converted = 0;
    let skipped = 0;
    for (const block of blocks) {
      if (this.hasConvertedNativeBlock(block)) {
        skipped += 1;
        continue;
      }
      const cover = expandCoverToHideNativeText({
        color: this.samplePdfBackgroundColor(overlay, block),
        height: block.height,
        id: makeStrokeId(),
        kind: "cover",
        opacity: 1,
        pageCssHeight: overlay.cssHeight,
        pageCssWidth: overlay.cssWidth,
        pageIndex: overlay.pageIndex,
        saved: false,
        width: block.width,
        x: block.x,
        y: block.y
      }, overlay);
      const text: InkText = {
        color: this.penColor,
        fontSize: clamp(block.fontSize, 4, 200),
        id: makeStrokeId(),
        kind: "text" as const,
        opacity: this.textOpacity,
        pageCssHeight: overlay.cssHeight,
        pageCssWidth: overlay.cssWidth,
        pageIndex: overlay.pageIndex,
        saved: false,
        text: block.text,
        x: block.x,
        y: block.y
      };
      if (converted === 0) {
        this.rememberHistory();
      }
      this.coverHistory.push(cover);
      this.textHistory.push(text);
      converted += 1;
    }

    if (converted > 0) {
      this.redoStack = [];
      this.markDirty();
      this.scheduleAutoSave();
      this.redrawOverlay(overlay);
    }
    return { covers: converted, skipped, texts: converted };
  }

  private convertNativeRegionToCover(selection: PdfNativeObject, overlay: PageOverlay): ConversionResult {
    if (this.hasConvertedNativeBlock(selection)) {
      return { covers: 0, skipped: 1, texts: 0 };
    }
    const cover: InkCover = {
      color: this.samplePdfBackgroundColor(overlay, selection),
      height: selection.height,
      id: makeStrokeId(),
      kind: "cover",
      opacity: 1,
      pageCssHeight: overlay.cssHeight,
      pageCssWidth: overlay.cssWidth,
      pageIndex: selection.pageIndex,
      saved: false,
      source: "native-region",
      width: selection.width,
      x: selection.x,
      y: selection.y
    };
    this.rememberHistory();
    this.coverHistory.push(cover);
    this.redoStack = [];
    this.markDirty();
    this.scheduleAutoSave();
    this.redrawOverlay(overlay);
    return { covers: 1, skipped: 0, texts: 0 };
  }

  private collectNativeTextBlocks(overlay: PageOverlay, region?: PdfNativeObject): Array<PdfNativeObject & { fontSize: number; text: string }> {
    const overlayRect = this.getOverlayClientRect(overlay);
    const regionPx = region
      ? {
          bottom: overlayRect.top + (region.y + region.height) * overlay.cssHeight,
          left: overlayRect.left + region.x * overlay.cssWidth,
          right: overlayRect.left + (region.x + region.width) * overlay.cssWidth,
          top: overlayRect.top + region.y * overlay.cssHeight
        }
      : null;
    const fragments: Array<{ bottom: number; fontSize: number; index: number; left: number; right: number; text: string; top: number }> = [];
    for (const [index, span] of Array.from(overlay.pageEl.querySelectorAll<HTMLElement>(".textLayer span, .textLayer .markedContent, [data-canvas-width]")).entries()) {
      const text = span.textContent?.trim();
      if (!text) {
        continue;
      }
      const rect = span.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) {
        continue;
      }
      if (regionPx && !(rect.right >= regionPx.left && rect.left <= regionPx.right && rect.bottom >= regionPx.top && rect.top <= regionPx.bottom)) {
        continue;
      }
      const computedStyle = activeWindow.getComputedStyle(span);
      const fontSize = Number.parseFloat(computedStyle.fontSize || "") || Math.max(4, rect.height * 0.82);
      fragments.push({
        bottom: rect.bottom,
        fontSize,
        index,
        left: rect.left,
        right: rect.right,
        text,
        top: rect.top
      });
    }
    return mergeNativeTextFragmentsIntoLines(fragments, overlay, overlayRect);
  }

  private hasConvertedNativeBlock(block: PdfNativeObject): boolean {
    const tolerance = 0.003;
    return this.coverHistory.some((cover) => (
      cover.pageIndex === block.pageIndex &&
      Math.abs(cover.x - block.x) <= tolerance &&
      Math.abs(cover.y - block.y) <= tolerance &&
      Math.abs(cover.width - block.width) <= tolerance &&
      Math.abs(cover.height - block.height) <= tolerance
    ));
  }

  private findOverlayByPageIndex(pageIndex: number): PageOverlay | null {
    for (const overlay of this.overlays.values()) {
      if (overlay.pageIndex === pageIndex) {
        return overlay;
      }
    }
    return null;
  }

  private getVisibleOverlay(): PageOverlay | null {
    const viewportHeight = activeWindow.innerHeight || activeDocument.documentElement.clientHeight || 1;
    let best: { distance: number; overlay: PageOverlay } | null = null;
    for (const overlay of this.overlays.values()) {
      const rect = overlay.pageEl.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > viewportHeight) {
        continue;
      }
      const distance = Math.abs(rect.top + rect.height / 2 - viewportHeight / 2);
      if (!best || distance < best.distance) {
        best = { distance, overlay };
      }
    }
    return best?.overlay ?? null;
  }

  private setSelectedElements(elements: InkElement[]): void {
    this.selectedStrokeIds.clear();
    this.nativeSelection = null;
    for (const element of elements) {
      this.selectedStrokeIds.add(element.id);
    }
    this.selectionChangedAt = Date.now();
    this.selectionWasExplicitTap = false;
  }

  private setSelectedElementForEditing(element: InkElement, overlay: PageOverlay): void {
    if (element.kind !== "stroke") {
      this.setSingleSelectedElement(element.id);
      return;
    }
    const group = this.findStrokeEditGroup(element, overlay);
    this.setSelectedElements(group);
    this.selectionWasExplicitTap = true;
  }

  private findStrokeEditGroup(stroke: InkStroke, overlay: PageOverlay): InkStroke[] {
    if (stroke.groupId) {
      return this.strokeHistory.filter((candidate) => (
        candidate.pageIndex === stroke.pageIndex && candidate.groupId === stroke.groupId
      ));
    }

    const candidates = this.strokeHistory.filter((candidate) => (
      candidate.pageIndex === stroke.pageIndex && !candidate.groupId
    ));
    const grouped = new Set<InkStroke>([stroke]);
    const queue: InkStroke[] = [stroke];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        break;
      }
      for (const candidate of candidates) {
        if (grouped.has(candidate)) {
          continue;
        }
        if (strokesAreVisuallyConnected(current, candidate, overlay.cssWidth, overlay.cssHeight, INK_LEGACY_GROUP_GAP_PX)) {
          grouped.add(candidate);
          queue.push(candidate);
        }
      }
    }
    return Array.from(grouped);
  }

  private setSingleSelectedElement(id: string): void {
    this.selectedStrokeIds.clear();
    this.selectedStrokeIds.add(id);
    this.nativeSelection = null;
    this.selectionChangedAt = Date.now();
    this.selectionWasExplicitTap = true;
  }

  private clearEditableSelection(): void {
    const hadSelection = this.selectedStrokeIds.size > 0 || this.nativeSelection !== null;
    this.selectedStrokeIds.clear();
    this.nativeSelection = null;
    if (hadSelection) {
      this.selectionChangedAt = Date.now();
    }
    this.selectionWasExplicitTap = false;
  }

  private canMoveFreshSelection(): boolean {
    return this.selectionWasExplicitTap && Date.now() - this.selectionChangedAt >= 500;
  }

  private canDragSelectedElements(pageIndex?: number): boolean {
    if (this.nativeTextEditor !== null) {
      return false;
    }
    return this.getSelectedEditableElements(pageIndex).every((element) => element.kind !== "text" || element.text.trim().length > 0);
  }

  private pruneSelection(): void {
    for (const id of Array.from(this.selectedStrokeIds)) {
      const element = this.findElementById(id);
      if (!element) {
        this.selectedStrokeIds.delete(id);
      }
    }
  }

  private getSelectedEditableElements(pageIndex?: number): InkElement[] {
    return this.getEditableElements().filter((element) => {
      if (!this.selectedStrokeIds.has(element.id)) {
        return false;
      }
      return pageIndex === undefined || element.pageIndex === pageIndex;
    });
  }

  private hasEditableSelection(pageIndex?: number): boolean {
    return this.getSelectedEditableElements(pageIndex).length > 0;
  }

  private updateExternalInkLayerState(): void {
    const activePages = new Set<number>();

    for (const overlay of this.overlays.values()) {
      const targets = this.strokeHistory.filter((stroke) => (
        stroke.pageIndex === overlay.pageIndex &&
        Array.isArray(stroke.pdfPoints)
      ));
      const shouldHidePage =
        targets.length > 0 ||
        (this.enabled && (this.pendingNativeInkHidePages.has(overlay.pageIndex) || this.detachedInkEditPages.has(overlay.pageIndex)));
      if (!shouldHidePage) {
        overlay.pageEl.classList.remove("pdftion-hide-native-ink-layer");
        continue;
      }

      activePages.add(overlay.pageIndex);
      overlay.pageEl.classList.add("pdftion-hide-native-ink-layer");

      for (const layer of this.collectNativeAnnotationElements(overlay.pageEl, false)) {
        this.hideNativeAnnotationElement(layer);
      }

      const canvasRect = overlay.canvas.getBoundingClientRect();
      const targetRects = targets
        .map((stroke) => normalizedStrokeBounds({ ...stroke, points: stroke.pdfPoints ?? stroke.points }))
        .filter((bounds): bounds is NormalizedBounds => bounds !== null)
        .map((bounds) => {
          const pad = 24;
          return {
            bottom: canvasRect.top + bounds.maxY * canvasRect.height + pad,
            left: canvasRect.left + bounds.minX * canvasRect.width - pad,
            right: canvasRect.left + bounds.maxX * canvasRect.width + pad,
            top: canvasRect.top + bounds.minY * canvasRect.height - pad
        };
      });
      if (targetRects.length === 0) {
        continue;
      }

      for (const candidate of this.collectNativeAnnotationElements(overlay.pageEl, true)) {
        const rect = candidate.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          continue;
        }
        if (targetRects.some((target) => rectsOverlap(target, rect))) {
          this.hideNativeAnnotationElement(candidate);
        }
      }
    }

    this.restoreHiddenNativeInkAnnotations(activePages);
  }

  private rememberNativeInkHidePagesForCurrentPages(force = false): boolean {
    const pageIndexes = this.getCurrentInkPreparePages(force);
    if (pageIndexes.size === 0) {
      return false;
    }
    for (const pageIndex of pageIndexes) {
      this.pendingNativeInkHidePages.add(pageIndex);
    }
    return true;
  }

  private primeNativeInkHidingForCurrentPages(force = false): void {
    if (!this.rememberNativeInkHidePagesForCurrentPages(force)) {
      return;
    }
    this.updateExternalInkLayerState();
    window.requestAnimationFrame(() => this.updateExternalInkLayerState());
    window.setTimeout(() => this.updateExternalInkLayerState(), 80);
  }

  private collectNativeAnnotationElements(root: HTMLElement, includeChildren: boolean): HTMLElement[] {
    const selector = includeChildren
      ? ".annotationLayer *, .annotationEditorLayer *, [data-annotation-id], [data-pdf-annotation-id], .popupAnnotation, .pdf-annotation-popup, .pdfAnnotationPopup"
      : ".annotationLayer, .annotationEditorLayer, [data-annotation-id], [data-pdf-annotation-id], .popupAnnotation, .pdf-annotation-popup, .pdfAnnotationPopup";
    return Array.from(root.querySelectorAll<HTMLElement>(selector));
  }

  private hideNativeAnnotationElement(element: HTMLElement): void {
    if (!this.hiddenNativeAnnotationStyles.has(element)) {
      this.hiddenNativeAnnotationStyles.set(element, {
        display: element.style.display,
        opacity: element.style.opacity,
        pointerEvents: element.style.pointerEvents,
        visibility: element.style.visibility
      });
    }
    element.classList.add("pdftion-hide-native-annotation-element");
  }

  private restoreHiddenNativeAnnotationElement(element: HTMLElement, snapshot: NativeAnnotationStyleSnapshot): void {
    element.classList.remove("pdftion-hide-native-annotation-element");
    element.setCssStyles({
      display: snapshot.display || "",
      opacity: snapshot.opacity || "",
      pointerEvents: snapshot.pointerEvents || "",
      visibility: snapshot.visibility || ""
    });
  }

  private restoreHiddenNativeInkAnnotations(keepPageIndexes = new Set<number>()): void {
    for (const overlay of this.overlays.values()) {
      if (!keepPageIndexes.has(overlay.pageIndex)) {
        overlay.pageEl.classList.remove("pdftion-hide-native-ink-layer");
      }
    }

    for (const [element, snapshot] of Array.from(this.hiddenNativeAnnotationStyles)) {
      const overlay = Array.from(this.overlays.values()).find((candidate) => candidate.pageEl.contains(element));
      if (overlay && keepPageIndexes.has(overlay.pageIndex)) {
        continue;
      }
      if (element.isConnected) {
        this.restoreHiddenNativeAnnotationElement(element, snapshot);
      } else {
        this.hiddenNativeAnnotationStyles.delete(element);
        continue;
      }
      this.hiddenNativeAnnotationStyles.delete(element);
    }
  }

  private selectionBoxContainsPoint(overlay: PageOverlay, point: InkPoint): boolean {
    const bounds = normalizedElementsBounds(this.getSelectedEditableElements(overlay.pageIndex));
    if (!bounds) {
      return false;
    }

    // Give the move region a wider hit area so casual taps land on drag instead of resize.
    const padX = Math.max(14 / overlay.cssWidth, 0.014);
    const padY = Math.max(14 / overlay.cssHeight, 0.014);
    return (
      point.x >= bounds.minX - padX &&
      point.x <= bounds.maxX + padX &&
      point.y >= bounds.minY - padY &&
      point.y <= bounds.maxY + padY
    );
  }

  private findSelectionHandleAt(overlay: PageOverlay, point: InkPoint): ResizeHandle | null {
    const selected = this.getSelectedEditableElements(overlay.pageIndex);
    const bounds = normalizedElementsBounds(selected);
    if (!bounds) {
      return null;
    }

    const textOnly = selected.length > 0 && selected.every((element) => element.kind === "text");
    return findResizeHandleAt(bounds, point, overlay.cssWidth, overlay.cssHeight, textOnly ? 10 : 5, textOnly ? 12 : 0);
  }

  private resizeSelectedElements(drag: SelectionDragState, point: InkPoint): void {
    if (!drag.handle || !drag.originalBounds || !drag.originalElements) {
      return;
    }

    this.applyResizedElements(resizeElementsFromHandle(drag.originalElements, drag.originalBounds, drag.handle, point));
  }

  private resizeSelectedElementsFromPinch(touch: TouchScrollState, distance: number): void {
    if (!touch.initialBounds || !touch.initialElements || touch.initialDistance <= 0) {
      return;
    }

    const factor = clamp(distance / touch.initialDistance, 0.18, 6);
    this.applyResizedElements(scaleElementsAroundBoundsCenter(touch.initialElements, touch.initialBounds, factor));
  }

  private applyResizedElements(elements: InkElement[]): void {
    for (const element of elements) {
      const live = this.findElementById(element.id);
      if (!live) {
        continue;
      }
      this.markElementChanged(live);
      if (live.kind === "stroke" && element.kind === "stroke") {
        live.points = element.points;
        live.width = element.width;
      } else if (live.kind === "text" && element.kind === "text") {
        live.x = element.x;
        live.y = element.y;
        live.fontSize = element.fontSize;
      } else if (live.kind === "cover" && element.kind === "cover") {
        live.x = element.x;
        live.y = element.y;
        live.width = element.width;
        live.height = element.height;
      } else if (live.kind === "image" && element.kind === "image") {
        live.x = element.x;
        live.y = element.y;
        live.width = element.width;
        live.height = element.height;
      }
    }
  }

  private getEditableElements(): InkElement[] {
    return [...this.strokeHistory, ...this.textHistory, ...this.coverHistory, ...this.imageHistory];
  }

  private createHistorySnapshot(): HistorySnapshot {
    return {
      elements: this.getEditableElements().map(cloneElement),
      nativeSelection: this.nativeSelection ? { ...this.nativeSelection } : null,
      selectedIds: Array.from(this.selectedStrokeIds)
    };
  }

  private restoreHistorySnapshot(snapshot: HistorySnapshot): void {
    const elements = snapshot.elements.map((element) => markElementUnsaved(cloneElement(element)));
    this.markInkChangesBetween(this.getEditableElements(), elements);
    this.strokeHistory = elements.filter((element): element is InkStroke => element.kind === "stroke");
    this.textHistory = elements.filter((element): element is InkText => element.kind === "text");
    this.coverHistory = elements.filter((element): element is InkCover => element.kind === "cover");
    this.imageHistory = elements.filter((element): element is InkImage => element.kind === "image");
    this.selectedStrokeIds = new Set(snapshot.selectedIds.filter((id) => elements.some((element) => element.id === id)));
    this.nativeSelection = snapshot.nativeSelection ? { ...snapshot.nativeSelection } : null;
    this.clearCurrentStroke();
    this.currentCover = null;
    this.selectionDrag = null;
    this.dirty = true;
    this.redrawAll();
    this.scheduleAutoSave();
  }

  private rememberHistory(): void {
    const snapshot = this.createHistorySnapshot();
    const previous = this.undoStack.at(-1);
    if (previous && JSON.stringify(previous) === JSON.stringify(snapshot)) {
      return;
    }
    this.undoStack.push(snapshot);
    if (this.undoStack.length > 80) {
      this.undoStack.shift();
    }
    this.redoHistoryStack = [];
  }

  private findElementById(id: string): InkElement | null {
    return (
      this.strokeHistory.find((stroke) => stroke.id === id) ??
      this.textHistory.find((text) => text.id === id) ??
      this.coverHistory.find((cover) => cover.id === id) ??
      this.imageHistory.find((image) => image.id === id) ??
      null
    );
  }

  private addElement(element: InkElement): void {
    if (element.kind === "stroke") {
      this.strokeHistory.push(element);
    } else if (element.kind === "text") {
      this.textHistory.push(element);
    } else if (element.kind === "image") {
      this.imageHistory.push(element);
    } else {
      this.coverHistory.push(element);
    }
  }

  private removeElementById(id: string): InkElement | null {
    const removed = this.findElementById(id);
    if (!removed) {
      return null;
    }
    this.markElementsDeleted([removed]);
    this.strokeHistory = this.strokeHistory.filter((stroke) => stroke.id !== id);
    this.textHistory = this.textHistory.filter((text) => text.id !== id);
    this.coverHistory = this.coverHistory.filter((cover) => cover.id !== id);
    this.imageHistory = this.imageHistory.filter((image) => image.id !== id);
    return removed;
  }

  private hasUnsavedStrokes(): boolean {
    return this.getEditableElements().some((element) => !element.saved);
  }

  private hasPendingPdfWrite(): boolean {
    return (
      this.dirty ||
      this.dirtyInkPages.size > 0 ||
      this.deletedExternalInkIds.size > 0 ||
      this.deletedPdftionInkIds.size > 0 ||
      this.getEditableElements().some((element) => !element.saved || (element.kind === "stroke" && element.pdfSaved !== true))
    );
  }

  private markDirty(): void {
    this.dirty = true;
  }

  private markInkPageDirty(pageIndex: number): void {
    if (Number.isFinite(pageIndex) && pageIndex >= 0) {
      this.dirtyInkPages.add(pageIndex);
    }
  }

  private markElementChanged(element: InkElement): void {
    element.saved = false;
    if (element.kind === "stroke") {
      this.markInkPageDirty(element.pageIndex);
      if (element.pdfSaved === true && !element.pdfPoints) {
        element.pdfPoints = element.points.map((point) => ({ ...point }));
      }
      if (element.source === "external-ink") {
        element.externalDirty = true;
      }
      element.pdfSaved = false;
    }
  }

  private markStrokeDeleted(stroke: InkStroke): void {
    this.markInkPageDirty(stroke.pageIndex);
    if (stroke.source === "external-ink") {
      this.deletedExternalInkIds.add(stroke.id);
      return;
    }
    if (stroke.source === "pdftion" || stroke.pdfSaved === true) {
      this.deletedPdftionInkIds.add(stroke.id);
    }
  }

  private markElementsDeleted(elements: InkElement[]): void {
    for (const element of elements) {
      if (element.kind === "stroke") {
        this.markStrokeDeleted(element);
      }
    }
  }

  private markInkChangesBetween(before: InkElement[], after: InkElement[]): void {
    const beforeStrokes = new Map(before.filter((element): element is InkStroke => element.kind === "stroke").map((stroke) => [stroke.id, stroke]));
    const afterStrokes = after.filter((element): element is InkStroke => element.kind === "stroke");
    const afterIds = new Set(afterStrokes.map((stroke) => stroke.id));

    for (const stroke of beforeStrokes.values()) {
      if (!afterIds.has(stroke.id)) {
        this.markStrokeDeleted(stroke);
      }
    }

    for (const stroke of afterStrokes) {
      const previous = beforeStrokes.get(stroke.id);
      if (!previous || !inkStrokesEquivalentForPdf(previous, stroke)) {
        this.markElementChanged(stroke);
      }
    }
  }

  private async saveEditableStateWhileSaving(): Promise<void> {
    const elements = this.getEditableElements();
    const targetFile = this.file;
    const targetPath = targetFile.path;
    try {
      const binary = await this.plugin.app.vault.readBinary(targetFile);
      await this.plugin.saveEditableAnnotationState(targetFile, elements.map(markElementSaved), binary);
      if (this.file.path !== targetPath) {
        return;
      }
      for (const element of elements) {
        element.saved = true;
      }
      this.dirty = false;
    } catch (error) {
      console.error(error);
    }
  }

  getFilePath(): string {
    return this.file.path;
  }

  aiGetElements(): InkElement[] {
    return this.getEditableElements().map(cloneElement);
  }

  aiGetSelectedElements(): InkElement[] {
    return this.getSelectedEditableElements().map(cloneElement);
  }

  aiGetStats(): PdfElementStats {
    const pages = new Set<number>();
    for (const element of this.getEditableElements()) {
      pages.add(element.pageIndex);
    }
    return {
      covers: this.coverHistory.length,
      images: this.imageHistory.length,
      pages: pages.size,
      strokes: this.strokeHistory.length,
      texts: this.textHistory.length,
      total: this.getEditableElements().length
    };
  }

  aiGroupElementsByPage(): Record<string, InkElement[]> {
    const grouped: Record<string, InkElement[]> = {};
    for (const element of this.getEditableElements()) {
      const key = String(element.pageIndex);
      grouped[key] = grouped[key] ?? [];
      grouped[key].push(cloneElement(element));
    }
    return grouped;
  }

  aiFindElements(query: PdftionElementQuery = {}): InkElement[] {
    const ids = new Set(query.ids ?? []);
    const color = query.color ? normalizeHexColor(query.color) : null;
    const text = query.text?.trim().toLowerCase() ?? "";
    return this.getEditableElements()
      .filter((element) => {
        if (ids.size > 0 && !ids.has(element.id)) {
          return false;
        }
        if (query.kind && element.kind !== query.kind) {
          return false;
        }
        if (typeof query.pageIndex === "number" && element.pageIndex !== Math.max(0, Math.floor(query.pageIndex))) {
          return false;
        }
        if (color && "color" in element && normalizeHexColor(element.color) !== color) {
          return false;
        }
        if (text && (element.kind !== "text" || !element.text.toLowerCase().includes(text))) {
          return false;
        }
        return true;
      })
      .map(cloneElement);
  }

  getAnnotationsMarkdown(): string {
    const elements = this.getEditableElements().map(cloneElement).sort((a, b) => (a.pageIndex - b.pageIndex) || a.id.localeCompare(b.id));
    const lines = [
      `# ${this.file.basename} pdftion annotations`,
      "",
      `PDF: [[${this.file.path}]]`,
      `Exported: ${new Date().toISOString()}`,
      "",
      "## Summary",
      "",
      `- Total: ${elements.length}`,
      `- Text: ${elements.filter((element) => element.kind === "text").length}`,
      `- Stroke: ${elements.filter((element) => element.kind === "stroke").length}`,
      `- Image: ${elements.filter((element) => element.kind === "image").length}`,
      `- Cover: ${elements.filter((element) => element.kind === "cover").length}`,
      ""
    ];
    let currentPage = -1;
    for (const element of elements) {
      if (element.pageIndex !== currentPage) {
        currentPage = element.pageIndex;
        lines.push("", `## Page ${currentPage + 1}`, "");
      }
      lines.push(`- ${formatElementForMarkdown(element)}`);
    }
    return lines.join("\n");
  }

  aiSelectElements(ids: string[]): number {
    this.selectedStrokeIds.clear();
    for (const id of ids) {
      if (this.findElementById(id)) {
        this.selectedStrokeIds.add(id);
      }
    }
    this.nativeSelection = null;
    this.selectionChangedAt = Date.now();
    this.selectionWasExplicitTap = false;
    this.redrawAll();
    return this.selectedStrokeIds.size;
  }

  aiGetNativeSelection(): PdfNativeObject | null {
    return this.nativeSelection ? { ...this.nativeSelection } : null;
  }

  aiReplaceElements(elements: InkElement[]): boolean {
    if (!Array.isArray(elements) || !elements.every(isInkElement)) {
      return false;
    }

    const cloned = elements.map((element) => markElementUnsaved(cloneElement(element)));
    this.rememberHistory();
    this.strokeHistory = cloned.filter((element): element is InkStroke => element.kind === "stroke");
    this.textHistory = cloned.filter((element): element is InkText => element.kind === "text");
    this.coverHistory = cloned.filter((element): element is InkCover => element.kind === "cover");
    this.imageHistory = cloned.filter((element): element is InkImage => element.kind === "image");
    this.clearEditableSelection();
    this.redoStack = [];
    this.markDirty();
    this.redrawAll();
    this.scheduleAutoSave();
    return true;
  }

  aiUpdateElements(elements: InkElement[]): number {
    let count = 0;
    let recorded = false;
    for (const element of elements) {
      if (!isInkElement(element)) {
        continue;
      }
      const live = this.findElementById(element.id);
      if (!live || live.kind !== element.kind) {
        continue;
      }
      if (!recorded) {
        this.rememberHistory();
        recorded = true;
      }
      this.removeElementById(live.id);
      this.addElement(markElementUnsaved(cloneElement(element)));
      count += 1;
    }

    if (count > 0) {
      this.markDirty();
      this.redrawAll();
      this.scheduleAutoSave();
    }
    return count;
  }

  aiDeleteElements(ids: string[]): number {
    const before = this.getEditableElements().length;
    const existingIds = ids.filter((id) => this.findElementById(id));
    if (existingIds.length > 0) {
      this.rememberHistory();
    }
    for (const id of ids) {
      this.removeElementById(id);
      this.selectedStrokeIds.delete(id);
    }
    const count = before - this.getEditableElements().length;
    if (count > 0) {
      this.markDirty();
      this.redrawAll();
      this.scheduleAutoSave();
    }
    return count;
  }

  async aiApplyPlan(operations: PdftionPlanOperation[]): Promise<PdftionPlanResult> {
    const result: PdftionPlanResult = { added: [], deleted: 0, errors: [], exported: [], ok: true, selected: 0, updated: 0 };
    if (!Array.isArray(operations)) {
      return { ...result, errors: ["Plan must be an array."], ok: false };
    }

    for (const operation of operations) {
      try {
        if (operation.action === "addCover") {
          const id = this.aiAddCover(operation.input);
          if (id) {
            result.added.push(id);
          }
        } else if (operation.action === "addImage") {
          const id = this.aiAddImage(operation.input);
          if (id) {
            result.added.push(id);
          }
        } else if (operation.action === "addStroke") {
          const id = this.aiAddStroke(operation.input);
          if (id) {
            result.added.push(id);
          }
        } else if (operation.action === "addText") {
          const id = this.aiAddText(operation.input);
          if (id) {
            result.added.push(id);
          }
        } else if (operation.action === "deleteElements") {
          result.deleted += this.aiDeleteElements(operation.ids);
        } else if (operation.action === "exportAnnotatedPdf") {
          const path = await this.exportAnnotatedPdf();
          if (path) {
            result.exported.push(path);
          }
        } else if (operation.action === "exportAnnotationsDocx") {
          const path = await this.exportAnnotationsDocx();
          if (path) {
            result.exported.push(path);
          }
        } else if (operation.action === "exportAnnotationsMarkdown") {
          const path = await this.exportAnnotationsMarkdown();
          if (path) {
            result.exported.push(path);
          }
        } else if (operation.action === "exportMarkdownDocxBridge") {
          const path = await this.exportMarkdownDocxBridge();
          if (path) {
            result.exported.push(path);
          }
        } else if (operation.action === "insertObsidianLink") {
          const id = await this.insertObsidianLink(operation.input);
          if (id) {
            result.added.push(id);
          }
        } else if (operation.action === "insertVaultImage") {
          const id = await this.insertVaultImage(operation.input);
          if (id) {
            result.added.push(id);
          }
        } else if (operation.action === "replaceElements") {
          if (!this.aiReplaceElements(operation.elements)) {
            result.errors.push("replaceElements failed.");
          }
        } else if (operation.action === "selectElements") {
          result.selected = this.aiSelectElements(operation.ids);
        } else if (operation.action === "updateElements") {
          result.updated += this.aiUpdateElements(operation.elements);
        } else {
          result.errors.push("Unknown operation.");
        }
      } catch (error) {
        result.errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    result.ok = result.errors.length === 0;
    return result;
  }

  setPageCrop(pageIndex: number, crop: { bottom?: number; left?: number; right?: number; top?: number }): boolean {
    this.cropByPage.set(pageIndex, {
      bottom: clamp(Number(crop.bottom ?? 0), 0, 0.45),
      left: clamp(Number(crop.left ?? 0), 0, 0.45),
      right: clamp(Number(crop.right ?? 0), 0, 0.45),
      top: clamp(Number(crop.top ?? 0), 0, 0.45)
    });
    new Notice(uiText("页面裁剪参数已记录。", "Page crop values recorded."));
    return true;
  }

  getPageCrops(): Record<string, { bottom: number; left: number; right: number; top: number }> {
    const result: Record<string, { bottom: number; left: number; right: number; top: number }> = {};
    for (const [pageIndex, crop] of this.cropByPage.entries()) {
      result[String(pageIndex)] = { ...crop };
    }
    return result;
  }

  aiCoverNativeSelection(): string | null {
    const selection = this.nativeSelection;
    if (!selection) {
      return null;
    }
    return this.aiAddCover({
      color: this.sampleNativeSelectionBackground(),
      height: selection.height,
      opacity: 1,
      pageIndex: selection.pageIndex,
      source: selection.kind === "text" ? "native-text" : "native-region",
      width: selection.width,
      x: selection.x,
      y: selection.y
    });
  }

  aiReplaceNativeText(text: string): { coverId: string | null; textId: string | null } | null {
    const selection = this.nativeSelection;
    const trimmed = text.trim();
    if (!selection || !trimmed) {
      return null;
    }
    const coverId = this.aiCoverNativeSelection();
    const textId = this.aiAddText({
      color: readableTextColor(this.sampleNativeSelectionBackground()),
      fontSize: Math.max(6, selection.height * Math.max(1, this.findOverlayCssHeight(selection.pageIndex)) * 0.82),
      pageIndex: selection.pageIndex,
      text: trimmed,
      x: selection.x,
      y: selection.y
    });
    return { coverId, textId };
  }

  private sampleNativeSelectionBackground(): string {
    const selection = this.nativeSelection;
    if (!selection) {
      return "#ffffff";
    }
    const overlay = this.findOverlayByPageIndex(selection.pageIndex);
    return overlay ? this.samplePdfBackgroundColor(overlay, selection) : "#ffffff";
  }

  aiAddText(input: Partial<InkText> & Pick<InkText, "pageIndex" | "text" | "x" | "y">): string | null {
    const text = String(input.text ?? "").trim();
    if (!text) {
      return null;
    }
    const element: InkText = {
      color: normalizeHexColor(input.color ?? this.penColor),
      fontFamily: input.fontFamily ?? this.textFontFamily,
      fontSize: clamp(Number(input.fontSize ?? this.textFontSize), 4, 200),
      id: input.id ?? makeStrokeId(),
      kind: "text",
      opacity: clamp(Number(input.opacity ?? this.textOpacity), 0.01, 1),
      pageCssHeight: Number(input.pageCssHeight ?? 1),
      pageCssWidth: Number(input.pageCssWidth ?? 1),
      pageIndex: Math.max(0, Math.floor(Number(input.pageIndex))),
      saved: false,
      text,
      x: clamp(Number(input.x), 0, 1),
      y: clamp(Number(input.y), 0, 1)
    };
    return this.aiAddElement(element);
  }

  aiAddImage(input: Partial<InkImage> & Pick<InkImage, "dataUrl" | "pageIndex" | "x" | "y">): string | null {
    if (!input.dataUrl?.startsWith("data:image/")) {
      return null;
    }
    const element: InkImage = {
      dataUrl: input.dataUrl,
      height: clamp(Number(input.height ?? 0.18), 0.001, 1),
      id: input.id ?? makeStrokeId(),
      kind: "image",
      opacity: clamp(Number(input.opacity ?? 1), 0.01, 1),
      pageCssHeight: Number(input.pageCssHeight ?? 1),
      pageCssWidth: Number(input.pageCssWidth ?? 1),
      pageIndex: Math.max(0, Math.floor(Number(input.pageIndex))),
      saved: false,
      width: clamp(Number(input.width ?? 0.24), 0.001, 1),
      x: clamp(Number(input.x), 0, 1),
      y: clamp(Number(input.y), 0, 1)
    };
    return this.aiAddElement(element);
  }

  aiAddCover(input: Partial<InkCover> & Pick<InkCover, "height" | "pageIndex" | "width" | "x" | "y">): string | null {
    const element: InkCover = {
      color: normalizeHexColor(input.color ?? "#ffffff"),
      height: clamp(Number(input.height), 0.001, 1),
      id: input.id ?? makeStrokeId(),
      kind: "cover",
      opacity: clamp(Number(input.opacity ?? 1), 0.01, 1),
      pageCssHeight: Number(input.pageCssHeight ?? 1),
      pageCssWidth: Number(input.pageCssWidth ?? 1),
      pageIndex: Math.max(0, Math.floor(Number(input.pageIndex))),
      saved: false,
      source: input.source,
      width: clamp(Number(input.width), 0.001, 1),
      x: clamp(Number(input.x), 0, 1),
      y: clamp(Number(input.y), 0, 1)
    };
    return this.aiAddElement(element);
  }

  aiAddStroke(input: Partial<InkStroke> & Pick<InkStroke, "pageIndex" | "points">): string | null {
    if (!Array.isArray(input.points) || input.points.length < 1) {
      return null;
    }
    const points = input.points
      .filter((point) => typeof point?.x === "number" && typeof point?.y === "number")
      .map((point) => ({ x: clamp(point.x, 0, 1), y: clamp(point.y, 0, 1) }));
    if (points.length < 1) {
      return null;
    }
    if (points.length === 1) {
      points.push({ x: clamp(points[0].x + 0.001, 0, 1), y: clamp(points[0].y + 0.001, 0, 1) });
    }
    const tool = input.tool === "highlight" ? "highlight" : "pen";
    const element: InkStroke = {
      color: normalizeHexColor(input.color ?? this.getToolColor(tool)),
      createdAt: typeof input.createdAt === "number" ? input.createdAt : Date.now(),
      groupId: typeof input.groupId === "string" && input.groupId.trim() ? input.groupId.trim() : undefined,
      id: input.id ?? makeStrokeId(),
      kind: "stroke",
      opacity: clamp(Number(input.opacity ?? this.getToolOpacity(tool)), 0.01, 1),
      pageCssHeight: Number(input.pageCssHeight ?? 1),
      pageCssWidth: Number(input.pageCssWidth ?? 1),
      pageIndex: Math.max(0, Math.floor(Number(input.pageIndex))),
      points,
      saved: false,
      tool,
      width: clamp(Number(input.width ?? this.getToolWidth(tool)), 0.2, 200)
    };
    return this.aiAddElement(element);
  }

  private aiAddElement(element: InkElement): string {
    this.rememberHistory();
    this.addElement(element);
    this.redoStack = [];
    this.markDirty();
    this.redrawAll();
    this.scheduleAutoSave();
    return element.id;
  }

  private findOverlayCssHeight(pageIndex: number): number {
    for (const overlay of this.overlays.values()) {
      if (overlay.pageIndex === pageIndex) {
        return overlay.cssHeight;
      }
    }
    return 1;
  }

  private scheduleAutoSave(delay = AUTO_SAVE_IDLE_DELAY_MS): void {
    if (this.destroyed || !this.hasPendingPdfWrite()) {
      return;
    }
    this.clearAutoSaveTimer();
    const effectiveDelay = this.enabled ? Math.min(delay, 900) : delay;
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      if (this.enabled) {
        void this.saveEditableState();
      } else {
        void this.saveIntoPdf(true);
      }
    }, effectiveDelay);
  }

  flushSoon(): void {
    if (this.destroyed || !this.hasPendingPdfWrite()) {
      return;
    }
    this.clearAutoSaveTimer();
    if (this.enabled) {
      void this.saveEditableState();
    } else {
      void this.saveIntoPdf(true);
    }
  }

  private clearAutoSaveTimer(): void {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  private scheduleToolSettingsSave(delay = 220): void {
    this.plugin.settings.penColor = normalizeHexColor(this.penColor);
    this.plugin.settings.penOpacity = clamp(this.penOpacity, 0.05, 1);
    this.plugin.settings.penWidth = clamp(this.penWidth, 0.5, 72);
    this.plugin.settings.highlightColor = normalizeHexColor(this.highlightColor);
    this.plugin.settings.highlightOpacity = clamp(this.highlightOpacity, 0.05, 1);
    this.plugin.settings.highlightWidth = clamp(this.highlightWidth, 2, 96);
    this.plugin.settings.eraserWidth = clamp(this.eraserWidth, 2, 120);
    this.plugin.settings.textColor = normalizeHexColor(this.textColor);
    this.plugin.settings.textFontFamily = this.textFontFamily;
    this.plugin.settings.textFontSize = clamp(this.textFontSize, 6, 120);
    this.plugin.settings.textOpacity = clamp(this.textOpacity, 0.05, 1);
    this.plugin.settings.nativeTextHighlightColor = normalizeHexColor(this.nativeTextHighlightColor);

    this.clearToolSettingsSaveTimer();
    this.settingsSaveTimer = window.setTimeout(() => {
      this.settingsSaveTimer = null;
      void this.plugin.saveSettings();
    }, delay);
  }

  private clearToolSettingsSaveTimer(): void {
    if (this.settingsSaveTimer !== null) {
      window.clearTimeout(this.settingsSaveTimer);
      this.settingsSaveTimer = null;
    }
  }

  private clearScanTimer(): void {
    if (this.scanTimer !== null) {
      window.clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }
  }

  private cleanupDetachedOverlays(): void {
    for (const [pageEl, overlay] of this.overlays.entries()) {
      if (this.rootEl.contains(pageEl)) {
        continue;
      }

      overlay.abort.abort();
      overlay.resizeObserver?.disconnect();
      if (overlay.redrawFrame !== null && overlay.redrawFrame !== undefined) {
        window.cancelAnimationFrame(overlay.redrawFrame);
      }
      if (overlay.resizeTimer !== null && overlay.resizeTimer !== undefined) {
        window.clearTimeout(overlay.resizeTimer);
      }
      overlay.canvas.remove();
      overlay.staticCanvas.remove();
      pageEl.classList.remove("pdftion-page", "pdftion-hide-native-ink-layer");
      this.overlays.delete(pageEl);
    }
  }
}

function createIconButton(icon: string, title: string): HTMLElement {
  const button = activeDocument.createElement("button");
  button.className = "clickable-icon";
  button.title = title;
  button.type = "button";
  button.setAttribute("aria-label", title);
  setIcon(button, icon);
  return button;
}

async function embedAnnotationFont(pdf: PDFDocument, fontBytes: Uint8Array) {
  const fontkitModule = await loadPdfFontkitModule();
  pdf.registerFontkit(resolvePdfFontkit(fontkitModule) as Parameters<PDFDocument["registerFontkit"]>[0]);
  return pdf.embedFont(fontBytes, { subset: true });
}

function loadPdfFontkitModule(): Promise<PdfFontkitModule> {
  if (!pdfFontkitModulePromise) {
    pdfFontkitModulePromise = import("@pdf-lib/fontkit");
  }
  return pdfFontkitModulePromise;
}

interface PdfInkSyncOptions {
  deletedExternalInkIds?: Set<string>;
  deletedPdftionInkIds?: Set<string>;
  dirtyPages?: Set<number>;
}

async function syncEditableInkAnnotationsOnPdf(pdf: PDFDocument, elements: InkElement[], options: PdfInkSyncOptions = {}): Promise<void> {
  const dirtyStrokes = elements.filter((element): element is InkStroke => (
    element.kind === "stroke" && element.pdfSaved !== true
  ));
  const pagesToRewrite = new Set([
    ...(options.dirtyPages ? Array.from(options.dirtyPages) : []),
    ...dirtyStrokes.map((stroke) => stroke.pageIndex)
  ]);
  const strokesToWrite = elements.filter((element): element is InkStroke => (
    element.kind === "stroke" &&
    (element.pdfSaved !== true || (pagesToRewrite.has(element.pageIndex) && element.source !== "external-ink"))
  ));
  removeTargetInkAnnotations(
    pdf,
    new Set([
      ...dirtyStrokes.filter((stroke) => stroke.source !== "external-ink").map((stroke) => stroke.id),
      ...(options.deletedPdftionInkIds ? Array.from(options.deletedPdftionInkIds) : [])
    ]),
    new Set([
      ...dirtyStrokes.filter((stroke) => stroke.source === "external-ink" && stroke.externalDirty === true).map((stroke) => stroke.id),
      ...(options.deletedExternalInkIds ? Array.from(options.deletedExternalInkIds) : [])
    ])
  );
  removePdftionInkAnnotationsOnPages(pdf, pagesToRewrite);
  const pages = pdf.getPages();
  for (const stroke of strokesToWrite) {
    const page = pages[stroke.pageIndex];
    if (!page || stroke.points.length < 2) {
      continue;
    }
    if (!addStandardInkAnnotation(pdf, page, stroke)) {
      const size = page.getSize();
      drawStrokeAsPdfLines(page, stroke, size.width, size.height);
    }
  }
}

function removePdftionInkAnnotationsOnPages(pdf: PDFDocument, pageIndexes: Set<number>): void {
  if (pageIndexes.size === 0) {
    return;
  }
  const pages = pdf.getPages();
  for (const pageIndex of pageIndexes) {
    const page = pages[pageIndex];
    const annots = page?.node.Annots?.();
    if (!annots) {
      continue;
    }
    for (let index = annots.size() - 1; index >= 0; index -= 1) {
      const annot = annots.lookupMaybe(index, PDFDict);
      if (annot && isPdftionInkAnnotation(annot)) {
        annots.remove(index);
      }
    }
  }
}

function removeTargetInkAnnotations(pdf: PDFDocument, pdftionIds = new Set<string>(), importedExternalIds = new Set<string>()): void {
  const pages = pdf.getPages();
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const annots = page.node.Annots?.();
    if (!annots) {
      continue;
    }
    for (let index = annots.size() - 1; index >= 0; index -= 1) {
      const annot = annots.lookupMaybe(index, PDFDict);
      if (annot && (pdftionIds.has(pdftionInkStrokeId(annot) ?? "") || importedExternalIds.has(externalInkStrokeId(pageIndex, index, annot)))) {
        annots.remove(index);
      }
    }
  }
}

function isPdftionInkAnnotation(annot: PDFDict): boolean {
  const subtype = annot.lookupMaybe(PDFName.of("Subtype"), PDFName);
  if (subtype?.decodeText() !== "Ink") {
    return false;
  }

  const nm = decodePdfText(annot.lookupMaybe(PDFName.of("NM"), PDFString, PDFHexString));
  const contents = decodePdfText(annot.lookupMaybe(PDFName.of("Contents"), PDFString, PDFHexString));
  const title = decodePdfText(annot.lookupMaybe(PDFName.of("T"), PDFString, PDFHexString));
  return nm.startsWith("Pdftion:") || contents.startsWith("Pdftion ") || title === "Pdftion";
}

function extractPdfInkAnnotations(pdf: PDFDocument, pageIndexes?: Set<number>): InkStroke[] {
  const strokes: InkStroke[] = [];
  const pages = pdf.getPages();
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    if (pageIndexes && !pageIndexes.has(pageIndex)) {
      continue;
    }
    const page = pages[pageIndex];
    const size = page.getSize();
    const annots = page.node.Annots?.();
    if (!annots) {
      continue;
    }
    for (let annotIndex = 0; annotIndex < annots.size(); annotIndex += 1) {
      const annot = annots.lookupMaybe(annotIndex, PDFDict);
      if (!annot) {
        continue;
      }
      const stroke = externalInkAnnotationToStroke(annot, pageIndex, annotIndex, size.width, size.height);
      if (stroke) {
        strokes.push(stroke);
      }
    }
  }
  return strokes;
}

function externalInkAnnotationToStroke(
  annot: PDFDict,
  pageIndex: number,
  annotIndex: number,
  pageWidth: number,
  pageHeight: number
): InkStroke | null {
  const subtype = annot.lookupMaybe(PDFName.of("Subtype"), PDFName);
  if (subtype?.decodeText() !== "Ink") {
    return null;
  }
  const inkList = annot.lookupMaybe(PDFName.of("InkList"), PDFArray);
  if (!inkList || inkList.size() === 0) {
    return null;
  }

  const points: InkPoint[] = [];
  for (let pathIndex = 0; pathIndex < inkList.size(); pathIndex += 1) {
    const path = inkList.lookupMaybe(pathIndex, PDFArray);
    if (!path) {
      continue;
    }
    for (let pointIndex = 0; pointIndex + 1 < path.size(); pointIndex += 2) {
      const x = path.lookupMaybe(pointIndex, PDFNumber)?.asNumber();
      const y = path.lookupMaybe(pointIndex + 1, PDFNumber)?.asNumber();
      if (typeof x !== "number" || typeof y !== "number") {
        continue;
      }
      points.push({
        x: clamp(x / Math.max(1, pageWidth), 0, 1),
        y: clamp((pageHeight - y) / Math.max(1, pageHeight), 0, 1)
      });
    }
  }
  if (points.length < 2) {
    return null;
  }

  const color = readPdfColor(annot.lookupMaybe(PDFName.of("C"), PDFArray));
  const opacity = annot.lookupMaybe(PDFName.of("CA"), PDFNumber)?.asNumber() ?? 1;
  const border = annot.lookupMaybe(PDFName.of("Border"), PDFArray);
  const borderWidth = border?.lookupMaybe(2, PDFNumber)?.asNumber() ?? 2;
  const pdftionId = pdftionInkStrokeId(annot);
  const groupId = decodePdfText(annot.lookupMaybe(PDFName.of("PdftionGroup"), PDFString, PDFHexString)).trim() || undefined;
  const simplifiedPoints = simplifyInkPoints(points, 900);
  return {
    color,
    groupId,
    id: pdftionId ?? externalInkStrokeId(pageIndex, annotIndex, annot),
    kind: "stroke",
    opacity: clamp(opacity, 0.01, 1),
    pageCssHeight: pageHeight,
    pageCssWidth: pageWidth,
    pageIndex,
    pdfPoints: simplifiedPoints.map((point) => ({ ...point })),
    pdfSaved: true,
    points: simplifiedPoints,
    saved: true,
    source: pdftionId ? "pdftion" : "external-ink",
    tool: "pen",
    width: clamp(borderWidth, 0.5, 96)
  };
}

function pdftionInkStrokeId(annot: PDFDict): string | null {
  if (!isPdftionInkAnnotation(annot)) {
    return null;
  }
  const nm = decodePdfText(annot.lookupMaybe(PDFName.of("NM"), PDFString, PDFHexString));
  if (nm.startsWith("Pdftion:")) {
    return nm.slice("Pdftion:".length) || null;
  }
  const contents = decodePdfText(annot.lookupMaybe(PDFName.of("Contents"), PDFString, PDFHexString));
  const match = contents.match(/^Pdftion\s+(.+)$/);
  return match?.[1]?.trim() || null;
}

function externalInkStrokeId(pageIndex: number, annotIndex: number, annot: PDFDict): string {
  const nm = decodePdfText(annot.lookupMaybe(PDFName.of("NM"), PDFString, PDFHexString));
  if (nm) {
    return `external-ink-${pageIndex}-${safeAnnotationKey(nm)}`;
  }
  const contents = decodePdfText(annot.lookupMaybe(PDFName.of("Contents"), PDFString, PDFHexString));
  if (contents) {
    return `external-ink-${pageIndex}-${annotIndex}-${fallbackBufferHash(new TextEncoder().encode(contents).buffer)}`;
  }
  return `external-ink-${pageIndex}-${annotIndex}`;
}

function simplifyInkPoints(points: InkPoint[], maxPoints: number): InkPoint[] {
  if (points.length <= maxPoints) {
    return points;
  }
  const step = Math.ceil(points.length / maxPoints);
  const simplified: InkPoint[] = [];
  for (let index = 0; index < points.length; index += step) {
    simplified.push(points[index]);
  }
  const last = points[points.length - 1];
  if (simplified[simplified.length - 1] !== last) {
    simplified.push(last);
  }
  return simplified;
}

function smoothInkPointsForPdf(points: InkPoint[], maxPoints: number): InkPoint[] {
  if (points.length <= 2) {
    return points.map((point) => ({ ...point }));
  }

  const result: InkPoint[] = [{ ...points[0] }];
  let current = points[0];
  for (let i = 1; i < points.length - 1; i += 1) {
    const control = points[i];
    const next = points[i + 1];
    const end = {
      x: (control.x + next.x) / 2,
      y: (control.y + next.y) / 2
    };
    const distance = Math.hypot(end.x - current.x, end.y - current.y);
    const steps = clamp(Math.ceil(distance * 1600), 2, 10);
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      const oneMinusT = 1 - t;
      result.push({
        x: oneMinusT * oneMinusT * current.x + 2 * oneMinusT * t * control.x + t * t * end.x,
        y: oneMinusT * oneMinusT * current.y + 2 * oneMinusT * t * control.y + t * t * end.y
      });
    }
    current = end;
    if (result.length > maxPoints * 1.4) {
      return simplifyInkPoints(result, maxPoints);
    }
  }
  result.push({ ...points[points.length - 1] });
  return simplifyInkPoints(result, maxPoints);
}

function readPdfColor(colorArray: PDFArray | undefined): string {
  if (!colorArray || colorArray.size() < 3) {
    return "#000000";
  }
  const r = colorArray.lookupMaybe(0, PDFNumber)?.asNumber() ?? 0;
  const g = colorArray.lookupMaybe(1, PDFNumber)?.asNumber() ?? 0;
  const b = colorArray.lookupMaybe(2, PDFNumber)?.asNumber() ?? 0;
  return rgbToHex(r * 255, g * 255, b * 255);
}

function decodePdfText(value: PDFString | PDFHexString | undefined): string {
  try {
    return value?.decodeText() ?? "";
  } catch {
    return value?.asString() ?? "";
  }
}

function addStandardInkAnnotation(pdf: PDFDocument, page: ReturnType<PDFDocument["getPage"]>, stroke: InkStroke): boolean {
  if (stroke.points.length < 2) {
    return true;
  }

  try {
    const size = page.getSize();
    const inkPoints = smoothInkPointsForPdf(stroke.points, 1600);
    const scaledPoints = inkPoints.map((point) => ({
      x: clamp(point.x, 0, 1) * size.width,
      y: size.height - clamp(point.y, 0, 1) * size.height
    }));
    const xs = scaledPoints.map((point) => point.x);
    const ys = scaledPoints.map((point) => point.y);
    const thickness = Math.max(0.5, stroke.width * (size.width / Math.max(1, stroke.pageCssWidth)));
    const padding = Math.max(4, thickness * 2);
    const color = hexToRgb(stroke.color);

    const rect = pdf.context.obj([
      Math.max(0, Math.min(...xs) - padding),
      Math.max(0, Math.min(...ys) - padding),
      Math.min(size.width, Math.max(...xs) + padding),
      Math.min(size.height, Math.max(...ys) + padding)
    ]);
    const inkPath = pdf.context.obj(scaledPoints.flatMap((point) => [point.x, point.y]));
    const inkList = pdf.context.obj([inkPath]);
    const border = pdf.context.obj([0, 0, thickness]);
    const annotation = pdf.context.obj({
      Border: border,
      C: pdf.context.obj([color.r, color.g, color.b]),
      CA: PDFNumber.of(clamp(stroke.opacity, 0.01, 1)),
      Contents: PDFHexString.fromText(`Pdftion ${stroke.id}`),
      F: PDFNumber.of(4),
      InkList: inkList,
      M: PDFHexString.fromText(new Date().toISOString()),
      NM: PDFHexString.fromText(`Pdftion:${stroke.id}`),
      Rect: rect,
      Subtype: PDFName.of("Ink"),
      T: PDFHexString.fromText("Pdftion"),
      Type: PDFName.of("Annot")
    });
    if (stroke.groupId) {
      annotation.set(PDFName.of("PdftionGroup"), PDFHexString.fromText(stroke.groupId));
    }
    const annotationRef = pdf.context.register(annotation);
    const pageNode = page.node as unknown as {
      addAnnot?: (annotRef: unknown) => void;
      Annots?: () => PDFArray | undefined;
      set: (key: PDFName, value: PDFArray) => void;
    };
    if (typeof pageNode.addAnnot === "function") {
      pageNode.addAnnot(annotationRef);
      return true;
    }
    let annots = pageNode.Annots?.();
    if (!annots) {
      annots = pdf.context.obj([]);
      pageNode.set(PDFName.of("Annots"), annots);
    }
    annots.push(annotationRef);
    return true;
  } catch (error) {
    console.warn("pdftion could not write a standard ink annotation; falling back to visible lines.", error);
    return false;
  }
}

function drawStrokeAsPdfLines(page: ReturnType<PDFDocument["getPage"]>, stroke: InkStroke, width: number, height: number): void {
  if (stroke.points.length < 2) {
    return;
  }
  const color = hexToRgb(stroke.color);
  const thickness = Math.max(0.5, stroke.width * (width / Math.max(1, stroke.pageCssWidth)));
  const points = smoothInkPointsForPdf(stroke.points, 1600);
  for (let i = 1; i < points.length; i += 1) {
    const start = points[i - 1];
    const end = points[i];
    page.drawLine({
      color: rgb(color.r, color.g, color.b),
      end: { x: end.x * width, y: height - end.y * height },
      opacity: stroke.opacity,
      start: { x: start.x * width, y: height - start.y * height },
      thickness
    });
  }
}

async function drawVisibleInkElementsOnPdf(pdf: PDFDocument, elements: InkElement[], fontBytes: Uint8Array | null): Promise<void> {
  const pages = pdf.getPages();
  const font = fontBytes ? await embedAnnotationFont(pdf, fontBytes) : null;
  const orderedElements = [
    ...elements.filter((element): element is InkCover => element.kind === "cover"),
    ...elements.filter((element): element is InkImage => element.kind === "image"),
    ...elements.filter((element): element is InkStroke => element.kind === "stroke"),
    ...elements.filter((element): element is InkText => element.kind === "text")
  ];

  for (const element of orderedElements) {
    const page = pages[element.pageIndex];
    if (!page) {
      continue;
    }
    const size = page.getSize();

    if (element.kind === "cover") {
      const color = hexToRgb(element.color);
      page.drawRectangle({
        color: rgb(color.r, color.g, color.b),
        height: element.height * size.height,
        opacity: element.opacity,
        width: element.width * size.width,
        x: element.x * size.width,
        y: size.height - (element.y + element.height) * size.height
      });
      continue;
    }

    if (element.kind === "stroke") {
      if (element.points.length < 2) {
        continue;
      }
      const color = hexToRgb(element.color);
      const thickness = Math.max(0.5, element.width * (size.width / Math.max(1, element.pageCssWidth)));
      for (let i = 1; i < element.points.length; i += 1) {
        const start = element.points[i - 1];
        const end = element.points[i];
        page.drawLine({
          color: rgb(color.r, color.g, color.b),
          end: { x: end.x * size.width, y: size.height - end.y * size.height },
          opacity: element.opacity,
          start: { x: start.x * size.width, y: size.height - start.y * size.height },
          thickness
        });
      }
      continue;
    }

    if (element.kind === "image") {
      const bytes = dataUrlToBytes(element.dataUrl);
      const embedded = element.dataUrl.startsWith("data:image/jpeg") || element.dataUrl.startsWith("data:image/jpg")
        ? await pdf.embedJpg(bytes)
        : await pdf.embedPng(bytes);
      page.drawImage(embedded, {
        height: element.height * size.height,
        opacity: element.opacity,
        width: element.width * size.width,
        x: element.x * size.width,
        y: size.height - (element.y + element.height) * size.height
      });
      continue;
    }

    if (!font) {
      continue;
    }

    const color = hexToRgb(element.color);
    const scale = size.width / Math.max(1, element.pageCssWidth);
    const fontSize = Math.max(1, element.fontSize * scale);
    const lineHeight = fontSize * 1.2;
    let y = size.height - element.y * size.height - fontSize;
    for (const line of element.text.split(/\r?\n/)) {
      page.drawText(line || " ", {
        color: rgb(color.r, color.g, color.b),
        font,
        opacity: element.opacity,
        size: fontSize,
        x: element.x * size.width,
        y
      });
      y -= lineHeight;
    }
  }
}

async function trySharePdf(fileName: string, bytes: Uint8Array): Promise<boolean> {
  if (typeof File === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const fileBuffer = toArrayBufferCopy(bytes);
  const file = new File([fileBuffer], fileName, { type: "application/pdf" });
  const shareData: ShareData & { files: File[] } = {
    files: [file],
    title: fileName
  };
  const shareNavigator = navigator as Navigator & {
    canShare?: (data: ShareData & { files?: File[] }) => boolean;
    share?: (data: ShareData & { files?: File[] }) => Promise<void>;
  };

  if (typeof shareNavigator.share !== "function") {
    return false;
  }
  if (typeof shareNavigator.canShare === "function" && !shareNavigator.canShare(shareData)) {
    return false;
  }

  try {
    await shareNavigator.share(shareData);
    return true;
  } catch {
    return false;
  }
}

function formatElementForMarkdown(element: InkElement): string {
  if (element.kind === "text") {
    return `Text (${element.id}): ${element.text.replace(/\s+/g, " ")}; x=${element.x.toFixed(3)}, y=${element.y.toFixed(3)}, size=${element.fontSize}`;
  }
  if (element.kind === "stroke") {
    return `Stroke (${element.id}): ${element.points.length} points, color ${element.color}, width ${element.width}`;
  }
  if (element.kind === "image") {
    return `Image (${element.id}): x=${element.x.toFixed(3)}, y=${element.y.toFixed(3)}, w=${element.width.toFixed(3)}, h=${element.height.toFixed(3)}`;
  }
  return `Cover (${element.id}): x=${element.x.toFixed(3)}, y=${element.y.toFixed(3)}, w=${element.width.toFixed(3)}, h=${element.height.toFixed(3)}`;
}

function rectIntersectionArea(a: DOMRectReadOnly, b: DOMRectReadOnly): number {
  const left = Math.max(a.left, b.left);
  const right = Math.min(a.right, b.right);
  const top = Math.max(a.top, b.top);
  const bottom = Math.min(a.bottom, b.bottom);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function clipRectToBounds(rect: DOMRectReadOnly, bounds: DOMRectReadOnly): { bottom: number; left: number; right: number; top: number } {
  return {
    bottom: clamp(rect.bottom, bounds.top, bounds.bottom),
    left: clamp(rect.left, bounds.left, bounds.right),
    right: clamp(rect.right, bounds.left, bounds.right),
    top: clamp(rect.top, bounds.top, bounds.bottom)
  };
}

function unionRects(rects: Array<{ bottom: number; left: number; right: number; top: number }>): { bottom: number; left: number; right: number; top: number } {
  return rects.reduce((union, rect) => ({
    bottom: Math.max(union.bottom, rect.bottom),
    left: Math.min(union.left, rect.left),
    right: Math.max(union.right, rect.right),
    top: Math.min(union.top, rect.top)
  }), rects[0]);
}

function normalizeObsidianLink(raw: string): { embed: boolean; target: string; wikilink: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const embed = trimmed.startsWith("![[");
  const match = trimmed.match(/^!?\[\[([^\]]+)]]$/);
  const target = (match?.[1] ?? trimmed).trim();
  if (!target) {
    return null;
  }
  return {
    embed,
    target,
    wikilink: match ? trimmed : `[[${target}]]`
  };
}

function buildPdfSelectionWikilink(file: TFile, pageIndex: number, text: string): string {
  const target = sanitizeWikilinkTarget(`${file.path}#page=${pageIndex + 1}`);
  const alias = sanitizeWikilinkAlias(`${truncateForLinkAlias(text)} - ${getPdfDisplayName(file)}`);
  return `[[${target}|${alias}]]`;
}

function getPdfDisplayName(file: TFile): string {
  const name = file.name.trim() || file.basename;
  return /\.pdf$/i.test(name) ? name : `${file.basename || name}.pdf`;
}

function sanitizeWikilinkTarget(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/]/g, "");
}

function sanitizeWikilinkAlias(value: string): string {
  return value.replace(/\s+/g, " ").replaceAll("|", " ").replaceAll("[", " ").replaceAll("]", " ").trim();
}

function truncateForLinkAlias(value: string): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > 96 ? `${cleaned.slice(0, 95)}…` : cleaned;
}

function stripObsidianLinkSyntax(value: string): string {
  const normalized = normalizeObsidianLink(value);
  return normalized?.target.split("#", 1)[0].split("|", 1)[0].trim() ?? value.trim();
}

function isImageExtension(extension: string): boolean {
  return ["apng", "avif", "gif", "jpeg", "jpg", "png", "svg", "webp"].includes(extension.toLowerCase());
}

function imageMimeFromExtension(extension: string): string {
  const ext = extension.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") {
    return "image/jpeg";
  }
  if (ext === "svg") {
    return "image/svg+xml";
  }
  if (ext === "gif") {
    return "image/gif";
  }
  if (ext === "webp") {
    return "image/webp";
  }
  if (ext === "avif") {
    return "image/avif";
  }
  if (ext === "apng") {
    return "image/apng";
  }
  return "image/png";
}

function arrayBufferToDataUrl(buffer: ArrayBuffer, mime: string): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

function loadDataUrlImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image data."));
    image.src = dataUrl;
  });
}

function fitImageToOverlay(
  size: { height: number; width: number },
  overlay: PageOverlay,
  requestedWidth?: number,
  requestedHeight?: number
): { height: number; width: number } {
  if (typeof requestedWidth === "number" && typeof requestedHeight === "number") {
    return { height: clamp(requestedHeight, 0.001, 1), width: clamp(requestedWidth, 0.001, 1) };
  }
  const maxWidth = clamp(Number(requestedWidth ?? 0.42), 0.03, 0.95);
  const maxHeight = clamp(Number(requestedHeight ?? 0.42), 0.03, 0.95);
  const ratio = size.width / Math.max(1, size.height);
  let width = maxWidth;
  let height = width / ratio * (overlay.cssWidth / Math.max(1, overlay.cssHeight));
  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio * (overlay.cssHeight / Math.max(1, overlay.cssWidth));
  }
  return {
    height: clamp(height, 0.03, 0.95),
    width: clamp(width, 0.03, 0.95)
  };
}

function markdownToDocxParagraphs(markdown: string): string[] {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.replace(/^#{1,6}\s+/, "").replace(/^-\s+/, "• ").trim())
    .filter((line) => line.length > 0);
}

function buildDocxFromParagraphs(paragraphs: string[], title: string): Uint8Array {
  const content = [
    xmlEscape(title),
    ...paragraphs.map(xmlEscape)
  ];
  const body = content.map((paragraph) => `<w:p><w:r><w:t xml:space="preserve">${paragraph}</w:t></w:r></w:p>`).join("");
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/activeDocument.xml" ContentType="application/vnd.openxmlformats-officeactiveDocument.wordprocessingml.activeDocument.main+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/activeDocument.xml"/></Relationships>`;
  return zipStoreFiles([
    { name: "[Content_Types].xml", data: utf8Bytes(contentTypes) },
    { name: "_rels/.rels", data: utf8Bytes(rels) },
    { name: "word/activeDocument.xml", data: utf8Bytes(documentXml) }
  ]);
}

function buildVisualConversionMarkdown(file: TFile, pages: VisualConversionPage[], folderPath: string): string {
  const lines = [
    `# ${file.basename} pdftion conversion`,
    "",
    `PDF: [[${file.path}]]`,
    `Images: ${folderPath}`,
    `Exported: ${new Date().toISOString()}`,
    ""
  ];
  for (const page of pages) {
    const imagePath = `${folderPath}/page-${String(page.pageIndex + 1).padStart(3, "0")}.png`;
    lines.push(`## Page ${page.pageIndex + 1}`, "", `![[${imagePath}]]`, "");
  }
  return lines.join("\n");
}

function buildDocxFromPageImages(pages: VisualConversionPage[], title: string): Uint8Array {
  const mediaFiles: Array<{ data: Uint8Array; name: string }> = [];
  const rels: string[] = [];
  let relId = 1;
  const body = [`<w:p><w:r><w:t xml:space="preserve">${xmlEscape(title)}</w:t></w:r></w:p>`];

  for (const page of pages) {
    const imageName = `image${page.pageIndex + 1}.png`;
    mediaFiles.push({ name: `word/media/${imageName}`, data: page.bytes });
    const imageRelId = `rId${relId}`;
    relId += 1;
    rels.push(`<Relationship Id="${imageRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${imageName}"/>`);

    const widthPx = Math.max(1, page.width);
    const heightPx = Math.max(1, page.height);
    const rawWidthEmu = Math.max(914400, Math.round(widthPx * 9525));
    const rawHeightEmu = Math.max(914400, Math.round(heightPx * 9525));
    const scale = Math.min(1, 6600000 / rawWidthEmu);
    const widthEmu = Math.round(rawWidthEmu * scale);
    const heightEmu = Math.round(rawHeightEmu * scale);

    body.push(
      `<w:p><w:r><w:t xml:space="preserve">Page ${page.pageIndex + 1}</w:t></w:r></w:p>`,
      `<w:p><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${widthEmu}" cy="${heightEmu}"/><wp:docPr id="${page.pageIndex + 1}" name="Page ${page.pageIndex + 1}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${page.pageIndex + 1}" name="Page ${page.pageIndex + 1}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${imageRelId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
    );
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr></w:body></w:document>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/activeDocument.xml" ContentType="application/vnd.openxmlformats-officeactiveDocument.wordprocessingml.activeDocument.main+xml"/></Types>`;
  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/activeDocument.xml"/></Relationships>`;
  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join("")}</Relationships>`;

  return zipStoreFiles([
    { name: "[Content_Types].xml", data: utf8Bytes(contentTypes) },
    { name: "_rels/.rels", data: utf8Bytes(relsXml) },
    { name: "word/activeDocument.xml", data: utf8Bytes(documentXml) },
    { name: "word/_rels/activeDocument.xml.rels", data: utf8Bytes(docRelsXml) },
    ...mediaFiles
  ]);
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function utf8Bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function zipStoreFiles(files: Array<{ data: Uint8Array; name: string }>): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = utf8Bytes(file.name);
    const crc = crc32(file.data);
    const local = concatBytes([
      le32(0x04034b50), le16(20), le16(0), le16(0), le16(0), le16(0),
      le32(crc), le32(file.data.length), le32(file.data.length), le16(name.length), le16(0), name, file.data
    ]);
    parts.push(local);
    central.push(concatBytes([
      le32(0x02014b50), le16(20), le16(20), le16(0), le16(0), le16(0), le16(0),
      le32(crc), le32(file.data.length), le32(file.data.length), le16(name.length), le16(0), le16(0),
      le16(0), le16(0), le32(0), le32(offset), name
    ]));
    offset += local.length;
  }
  const centralStart = offset;
  const centralBytes = concatBytes(central);
  const end = concatBytes([
    le32(0x06054b50), le16(0), le16(0), le16(files.length), le16(files.length),
    le32(centralBytes.length), le32(centralStart), le16(0)
  ]);
  return concatBytes([...parts, centralBytes, end]);
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function le16(value: number): Uint8Array {
  return new Uint8Array([value & 255, (value >>> 8) & 255]);
}

function le32(value: number): Uint8Array {
  return new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]);
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const [, payload = ""] = dataUrl.split(",", 2);
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function pickImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = activeDocument.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", () => {
      resolve(input.files?.[0] ?? null);
    }, { once: true });
    input.click();
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}

function pickPdfFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = activeDocument.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,.pdf";
    input.addEventListener("change", () => {
      resolve(input.files?.[0] ?? null);
    }, { once: true });
    input.click();
  });
}

function parsePageOrder(raw: string, pageCount: number): number[] | null {
  const result: number[] = [];
  for (const token of raw.split(/[,\s]+/).map((part) => part.trim()).filter(Boolean)) {
    const range = token.match(/^(\d+)-(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < 1 || start > pageCount || end > pageCount) {
        return null;
      }
      const step = start <= end ? 1 : -1;
      for (let value = start; step > 0 ? value <= end : value >= end; value += step) {
        result.push(value - 1);
      }
      continue;
    }
    const page = Number(token);
    if (!Number.isInteger(page) || page < 1 || page > pageCount) {
      return null;
    }
    result.push(page - 1);
  }
  if (result.length !== pageCount || new Set(result).size !== pageCount) {
    return null;
  }
  return result;
}

function parseCropValue(raw: string): number | null {
  const value = raw.endsWith("%") ? Number(raw.slice(0, -1)) / 100 : Number(raw);
  if (!Number.isFinite(value)) {
    return null;
  }
  return clamp(value, 0, 0.45);
}

function rotateElementClockwise<T extends InkElement>(element: T): T {
  const clone = cloneElement(element) as T;
  if (clone.kind === "stroke") {
    clone.points = clone.points.map((point) => ({ x: 1 - point.y, y: point.x }));
  } else if (clone.kind === "text") {
    const box = normalizedTextBounds(clone);
    clone.x = clamp(1 - box.maxY, 0, 1);
    clone.y = clamp(box.minX, 0, 1);
  } else if (clone.kind === "cover" || clone.kind === "image") {
    const oldX = clone.x;
    const oldHeight = clone.height;
    const oldWidth = clone.width;
    const oldY = clone.y;
    const right = clone.x + clone.width;
    clone.x = clamp(1 - (oldY + oldHeight), 0, 1);
    clone.y = clamp(oldX, 0, 1);
    clone.width = clamp(oldHeight, 0.001, 1);
    clone.height = clamp(right - oldX || oldWidth, 0.001, 1);
  }
  clone.saved = false;
  return clone;
}

function cropElement<T extends InkElement>(element: T, crop: { bottom: number; left: number; right: number; top: number }): T {
  const clone = cloneElement(element) as T;
  const width = Math.max(0.01, 1 - crop.left - crop.right);
  const height = Math.max(0.01, 1 - crop.top - crop.bottom);
  const mapPoint = (point: InkPoint): InkPoint => ({
    x: clamp((point.x - crop.left) / width, 0, 1),
    y: clamp((point.y - crop.top) / height, 0, 1)
  });

  if (clone.kind === "stroke") {
    clone.points = clone.points.map(mapPoint);
  } else if (clone.kind === "text") {
    const point = mapPoint({ x: clone.x, y: clone.y });
    clone.x = point.x;
    clone.y = point.y;
  } else if (clone.kind === "cover" || clone.kind === "image") {
    const topLeft = mapPoint({ x: clone.x, y: clone.y });
    clone.x = topLeft.x;
    clone.y = topLeft.y;
    clone.width = clamp(clone.width / width, 0.001, 1);
    clone.height = clamp(clone.height / height, 0.001, 1);
  }
  clone.saved = false;
  return clone;
}

function drawImageDataUrl(ctx: CanvasRenderingContext2D, image: InkImage, cssWidth: number, cssHeight: number): Promise<void> {
  return new Promise((resolve) => {
    const bitmap = new Image();
    bitmap.onload = () => {
      ctx.save();
      ctx.globalAlpha = image.opacity;
      ctx.drawImage(bitmap, image.x * cssWidth, image.y * cssHeight, image.width * cssWidth, image.height * cssHeight);
      ctx.restore();
      resolve();
    };
    bitmap.onerror = () => resolve();
    bitmap.src = image.dataUrl;
  });
}

function getImageDataUrlSize(dataUrl: string): Promise<{ height: number; width: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ height: Math.max(1, image.naturalHeight), width: Math.max(1, image.naturalWidth) });
    image.onerror = () => reject(new Error("Could not load image file."));
    image.src = dataUrl;
  });
}

function resolvePdfFontkit(moduleValue: unknown): unknown {
  const moduleShape = moduleValue as { create?: unknown; default?: { create?: unknown } };
  const candidate = typeof moduleShape.create === "function" ? moduleShape : moduleShape.default;
  if (!candidate || typeof candidate.create !== "function") {
    throw new Error("PDF fontkit is unavailable.");
  }
  return candidate;
}

function getPageIndex(pageEl: HTMLElement, fallbackIndex: number): number {
  const raw = pageEl.dataset.pageNumber ?? pageEl.getAttribute("data-page-number");
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed - 1 : fallbackIndex;
}

function getTouchCenter(touches: TouchList): InkPoint {
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < touches.length; i += 1) {
    sumX += touches[i].clientX;
    sumY += touches[i].clientY;
  }
  const count = Math.max(1, touches.length);
  return { x: sumX / count, y: sumY / count };
}

function getTouchDistance(touches: TouchList): number {
  if (touches.length < 2) {
    return 0;
  }

  const first = touches[0];
  const second = touches[1];
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
}

function dispatchPdfZoomGesture(rootEl: HTMLElement, delta: number): void {
  const button = findPdfZoomButton(rootEl, delta > 0 ? "in" : "out");
  if (button) {
    button.click();
    return;
  }

  const target =
    rootEl.querySelector<HTMLElement>(".pdfViewer, .pdf-viewer, .pdf-container, .workspace-leaf-content") ?? rootEl;
  target.dispatchEvent(
    new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaMode: WheelEvent.DOM_DELTA_PIXEL,
      deltaY: clamp(-delta * 1.5, -80, 80)
    })
  );
}

function findPdfZoomButton(rootEl: HTMLElement, direction: "in" | "out"): HTMLButtonElement | null {
  const tokens =
    direction === "in"
      ? ["zoom in", "放大", "zoom-in"]
      : ["zoom out", "缩小", "放小", "zoom-out"];

  for (const button of Array.from(rootEl.querySelectorAll<HTMLButtonElement>("button, .clickable-icon"))) {
    if (button.classList.contains("pdftion-button") || button.disabled) {
      continue;
    }

    const label = `${button.getAttribute("aria-label") ?? ""} ${button.getAttribute("title") ?? ""} ${
      button.textContent ?? ""
    }`.toLowerCase();
    if (tokens.some((token) => label.includes(token))) {
      return button;
    }
  }

  return null;
}

function findTouch(touches: TouchList, identifier: number): Touch | null {
  for (let i = 0; i < touches.length; i += 1) {
    if (touches[i].identifier === identifier) {
      return touches[i];
    }
  }
  return null;
}

function findScrollableAncestor(start: HTMLElement): HTMLElement {
  let element: HTMLElement | null = start;
  while (element) {
    const computedStyle = activeWindow.getComputedStyle(element);
    const canScrollY = element.scrollHeight > element.clientHeight + 2;
    const canScrollX = element.scrollWidth > element.clientWidth + 2;
    const allowsScrollY = /auto|scroll|overlay/i.test(computedStyle.overflowY);
    const allowsScrollX = /auto|scroll|overlay/i.test(computedStyle.overflowX);
    if ((canScrollY && allowsScrollY) || (canScrollX && allowsScrollX)) {
      return element;
    }
    element = element.parentElement;
  }

  return (activeDocument.scrollingElement as HTMLElement | null) ?? activeDocument.documentElement;
}

function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: InkStroke,
  cssWidth: number,
  cssHeight: number,
  selected = false
): void {
  if (stroke.points.length < 2) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = selected ? Math.max(0.14, stroke.opacity * 0.38) : stroke.opacity;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = strokeDisplayWidth(stroke, cssWidth);
  ctx.strokeStyle = stroke.color;
  ctx.beginPath();
  const first = stroke.points[0];
  ctx.moveTo(first.x * cssWidth, first.y * cssHeight);

  if (stroke.points.length === 2) {
    const end = stroke.points[1];
    ctx.lineTo(end.x * cssWidth, end.y * cssHeight);
  } else {
    for (let i = 1; i < stroke.points.length - 1; i += 1) {
      const point = stroke.points[i];
      const next = stroke.points[i + 1];
      const midX = ((point.x + next.x) / 2) * cssWidth;
      const midY = ((point.y + next.y) / 2) * cssHeight;
      ctx.quadraticCurveTo(point.x * cssWidth, point.y * cssHeight, midX, midY);
    }
    const last = stroke.points[stroke.points.length - 1];
    ctx.lineTo(last.x * cssWidth, last.y * cssHeight);
  }

  ctx.stroke();
  ctx.restore();

}

function strokeDisplayWidth(stroke: InkStroke, cssWidth: number): number {
  return Math.max(0.5, stroke.width * (cssWidth / Math.max(1, stroke.pageCssWidth)));
}

function drawTextElement(ctx: CanvasRenderingContext2D, text: InkText, cssWidth: number, cssHeight: number, selected = false): void {
  const lines = text.text.split(/\r?\n/);
  ctx.save();
  ctx.globalAlpha = selected ? Math.max(0.14, text.opacity * 0.38) : text.opacity;
  ctx.fillStyle = text.color;
  ctx.font = `${text.fontSize}px ${text.fontFamily ?? "sans-serif"}`;
  ctx.textBaseline = "top";
  const x = text.x * cssWidth;
  let y = text.y * cssHeight;
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += text.fontSize * 1.2;
  }
  ctx.restore();
}

function drawCoverElement(ctx: CanvasRenderingContext2D, cover: InkCover, cssWidth: number, cssHeight: number, selected = false): void {
  ctx.save();
  ctx.globalAlpha = selected ? Math.max(0.18, cover.opacity * 0.5) : cover.opacity;
  ctx.fillStyle = cover.color;
  ctx.fillRect(cover.x * cssWidth, cover.y * cssHeight, cover.width * cssWidth, cover.height * cssHeight);
  ctx.restore();
}

function drawSelectionGroup(ctx: CanvasRenderingContext2D, elements: InkElement[], cssWidth: number, cssHeight: number): void {
  const box = normalizedElementsBounds(elements);
  if (!box) {
    return;
  }

  const x = box.minX * cssWidth;
  const y = box.minY * cssHeight;
  const width = (box.maxX - box.minX) * cssWidth;
  const height = (box.maxY - box.minY) * cssHeight;

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#1c7ed6";
  ctx.lineWidth = 1.8;
  ctx.setLineDash([7, 4]);
  ctx.strokeRect(x, y, width, height);
  ctx.setLineDash([]);

  for (const handle of getSelectionHandlePoints(box)) {
    const size = 10;
    const hx = handle.point.x * cssWidth;
    const hy = handle.point.y * cssHeight;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#1c7ed6";
    ctx.lineWidth = 2;
    ctx.fillRect(hx - size / 2, hy - size / 2, size, size);
    ctx.strokeRect(hx - size / 2, hy - size / 2, size, size);
  }

  ctx.restore();
}

function drawNativeSelection(ctx: CanvasRenderingContext2D, selection: PdfNativeObject, cssWidth: number, cssHeight: number): void {
  const x = selection.x * cssWidth;
  const y = selection.y * cssHeight;
  const width = selection.width * cssWidth;
  const height = selection.height * cssHeight;

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#0ca678";
  ctx.fillStyle = selection.kind === "text" ? "rgba(12, 166, 120, 0.10)" : "rgba(12, 166, 120, 0.06)";
  ctx.lineWidth = 1.8;
  ctx.setLineDash([5, 4]);
  ctx.fillRect(x, y, width, height);
  ctx.strokeRect(x, y, width, height);
  ctx.restore();
}

function drawCropPreview(ctx: CanvasRenderingContext2D, crop: PageCropMargins, cssWidth: number, cssHeight: number): void {
  const left = crop.left * cssWidth;
  const right = (1 - crop.right) * cssWidth;
  const top = crop.top * cssHeight;
  const bottom = (1 - crop.bottom) * cssHeight;

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(255, 193, 7, 0.13)";
  if (left > 0) {
    ctx.fillRect(0, 0, left, cssHeight);
  }
  if (right < cssWidth) {
    ctx.fillRect(right, 0, cssWidth - right, cssHeight);
  }
  if (top > 0) {
    ctx.fillRect(left, 0, Math.max(0, right - left), top);
  }
  if (bottom < cssHeight) {
    ctx.fillRect(left, bottom, Math.max(0, right - left), cssHeight - bottom);
  }

  ctx.strokeStyle = "#f08c00";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 5]);
  ctx.beginPath();
  ctx.moveTo(left, 0);
  ctx.lineTo(left, cssHeight);
  ctx.moveTo(right, 0);
  ctx.lineTo(right, cssHeight);
  ctx.moveTo(0, top);
  ctx.lineTo(cssWidth, top);
  ctx.moveTo(0, bottom);
  ctx.lineTo(cssWidth, bottom);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = "#e67700";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
  ctx.restore();
}

function mergeNativeTextFragmentsIntoLines(
  fragments: Array<{ bottom: number; fontSize: number; index: number; left: number; right: number; text: string; top: number }>,
  overlay: PageOverlay,
  pageRect: DOMRect
): Array<PdfNativeObject & { fontSize: number; text: string }> {
  const sorted = [...fragments].sort((a, b) => (a.top - b.top) || (a.left - b.left));
  const lines: Array<{
    bottom: number;
    fontSizes: number[];
    fragments: Array<{ index: number; left: number; text: string }>;
    left: number;
    right: number;
    top: number;
  }> = [];

  for (const fragment of sorted) {
    const centerY = (fragment.top + fragment.bottom) / 2;
    const line = lines.find((candidate) => {
      const candidateCenterY = (candidate.top + candidate.bottom) / 2;
      const tolerance = Math.max(3, Math.max(...candidate.fontSizes, fragment.fontSize) * 0.42);
      return Math.abs(candidateCenterY - centerY) <= tolerance;
    });

    if (line) {
      line.bottom = Math.max(line.bottom, fragment.bottom);
      line.fontSizes.push(fragment.fontSize);
      line.fragments.push({ index: fragment.index, left: fragment.left, text: fragment.text });
      line.left = Math.min(line.left, fragment.left);
      line.right = Math.max(line.right, fragment.right);
      line.top = Math.min(line.top, fragment.top);
    } else {
      lines.push({
        bottom: fragment.bottom,
        fontSizes: [fragment.fontSize],
        fragments: [{ index: fragment.index, left: fragment.left, text: fragment.text }],
        left: fragment.left,
        right: fragment.right,
        top: fragment.top
      });
    }
  }

  return lines
    .sort((a, b) => (a.top - b.top) || (a.left - b.left))
    .map((line, index) => {
      const ordered = line.fragments.sort((a, b) => a.left - b.left);
      const text = ordered.map((fragment) => fragment.text).join(" ").replace(/\s+/g, " ").trim();
      const fontSize = median(line.fontSizes);
      return {
        fontSize,
        height: clamp((line.bottom - line.top) / Math.max(1, overlay.cssHeight), 0.001, 1),
        id: `native-line-${overlay.pageIndex}-${index}`,
        kind: "text" as const,
        pageIndex: overlay.pageIndex,
        text,
        width: clamp((line.right - line.left) / Math.max(1, overlay.cssWidth), 0.001, 1),
        x: clamp((line.left - pageRect.left) / Math.max(1, overlay.cssWidth), 0, 1),
        y: clamp((line.top - pageRect.top) / Math.max(1, overlay.cssHeight), 0, 1)
      };
    })
    .filter((line) => line.text.length > 0);
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 12;
  }
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function drawMarqueeBox(ctx: CanvasRenderingContext2D, start: InkPoint, end: InkPoint, cssWidth: number, cssHeight: number): void {
  const minX = Math.min(start.x, end.x) * cssWidth;
  const minY = Math.min(start.y, end.y) * cssHeight;
  const width = Math.abs(end.x - start.x) * cssWidth;
  const height = Math.abs(end.y - start.y) * cssHeight;

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#228be6";
  ctx.fillStyle = "rgba(34, 139, 230, 0.1)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.fillRect(minX, minY, width, height);
  ctx.strokeRect(minX, minY, width, height);
  ctx.restore();
}

function strokeBounds(
  stroke: InkStroke,
  cssWidth: number,
  cssHeight: number
): { maxX: number; maxY: number; minX: number; minY: number } | null {
  if (stroke.points.length === 0) {
    return null;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of stroke.points) {
    const x = point.x * cssWidth;
    const y = point.y * cssHeight;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return { maxX, maxY, minX, minY };
}

function textBounds(text: InkText, cssWidth: number, cssHeight: number): { maxX: number; maxY: number; minX: number; minY: number } {
  const lines = text.text.split(/\r?\n/);
  const maxChars = Math.max(1, ...lines.map((line) => line.length));
  const width = Math.max(text.fontSize, maxChars * text.fontSize * 0.58);
  const height = Math.max(text.fontSize, lines.length * text.fontSize * 1.2);
  const minX = text.x * cssWidth;
  const minY = text.y * cssHeight;
  return {
    maxX: minX + width,
    maxY: minY + height,
    minX,
    minY
  };
}

function strokeBoxContainsPoint(stroke: InkStroke, point: InkPoint, cssWidth: number, cssHeight: number): boolean {
  const box = strokeBounds(stroke, cssWidth, cssHeight);
  if (!box) {
    return false;
  }

  const displayWidth = strokeDisplayWidth(stroke, cssWidth);
  const pad = stroke.source === "external-ink"
    ? Math.max(22, displayWidth * 4)
    : Math.max(8, displayWidth * 1.8);
  const px = point.x * cssWidth;
  const py = point.y * cssHeight;

  return px >= box.minX - pad && px <= box.maxX + pad && py >= box.minY - pad && py <= box.maxY + pad;
}

function textBoxContainsPoint(text: InkText, point: InkPoint, cssWidth: number, cssHeight: number): boolean {
  const box = textBounds(text, cssWidth, cssHeight);
  const pad = Math.max(8, text.fontSize * 0.45);
  const px = point.x * cssWidth;
  const py = point.y * cssHeight;
  return px >= box.minX - pad && px <= box.maxX + pad && py >= box.minY - pad && py <= box.maxY + pad;
}

function strokeIntersectsSelection(
  stroke: InkStroke,
  start: InkPoint,
  end: InkPoint,
  cssWidth: number,
  cssHeight: number
): boolean {
  const box = strokeBounds(stroke, cssWidth, cssHeight);
  if (!box) {
    return false;
  }

  const minX = Math.min(start.x, end.x) * cssWidth;
  const maxX = Math.max(start.x, end.x) * cssWidth;
  const minY = Math.min(start.y, end.y) * cssHeight;
  const maxY = Math.max(start.y, end.y) * cssHeight;
  const pad = Math.max(8, strokeDisplayWidth(stroke, cssWidth) * 1.8);

  return box.maxX + pad >= minX && box.minX - pad <= maxX && box.maxY + pad >= minY && box.minY - pad <= maxY;
}

function textIntersectsSelection(text: InkText, start: InkPoint, end: InkPoint, cssWidth: number, cssHeight: number): boolean {
  const box = textBounds(text, cssWidth, cssHeight);
  const minX = Math.min(start.x, end.x) * cssWidth;
  const maxX = Math.max(start.x, end.x) * cssWidth;
  const minY = Math.min(start.y, end.y) * cssHeight;
  const maxY = Math.max(start.y, end.y) * cssHeight;
  return box.maxX >= minX && box.minX <= maxX && box.maxY >= minY && box.minY <= maxY;
}

function coverBoxContainsPoint(cover: InkCover | InkImage, point: InkPoint): boolean {
  return point.x >= cover.x && point.x <= cover.x + cover.width && point.y >= cover.y && point.y <= cover.y + cover.height;
}

function coverIntersectsSelection(cover: InkCover | InkImage, start: InkPoint, end: InkPoint): boolean {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  return cover.x + cover.width >= minX && cover.x <= maxX && cover.y + cover.height >= minY && cover.y <= maxY;
}

function imageBoxContainsPoint(image: InkImage, point: InkPoint): boolean {
  return coverBoxContainsPoint(image, point);
}

function imageIntersectsSelection(image: InkImage, start: InkPoint, end: InkPoint): boolean {
  return coverIntersectsSelection(image, start, end);
}

function rectsOverlap(
  a: { bottom: number; left: number; right: number; top: number },
  b: { bottom: number; left: number; right: number; top: number }
): boolean {
  return a.right >= b.left && a.left <= b.right && a.bottom >= b.top && a.top <= b.bottom;
}

function nativeRegionContainsPoint(region: PdfNativeObject, point: InkPoint): boolean {
  return point.x >= region.x && point.x <= region.x + region.width && point.y >= region.y && point.y <= region.y + region.height;
}

function translateStroke(stroke: InkStroke, dx: number, dy: number): void {
  for (const point of stroke.points) {
    point.x += dx;
    point.y += dy;
  }
}

function translateElement(element: InkElement, dx: number, dy: number): void {
  if (element.kind === "stroke") {
    translateStroke(element, dx, dy);
  } else {
    element.x += dx;
    element.y += dy;
  }
}

function cloneStroke(stroke: InkStroke): InkStroke {
  return {
    ...stroke,
    pdfPoints: stroke.pdfPoints?.map((point) => ({ ...point })),
    points: stroke.points.map((point) => ({ ...point }))
  };
}

function cloneElement(element: InkElement): InkElement {
  return element.kind === "stroke" ? cloneStroke(element) : { ...element };
}

function inkStrokesEquivalentForPdf(a: InkStroke, b: InkStroke): boolean {
  return (
    a.pageIndex === b.pageIndex &&
    a.color === b.color &&
    a.groupId === b.groupId &&
    Math.abs(a.opacity - b.opacity) <= 0.001 &&
    Math.abs(a.width - b.width) <= 0.001 &&
    a.tool === b.tool &&
    inkPointsApproximatelyEqual(a.points, b.points)
  );
}

function normalizedStrokeBounds(stroke: InkStroke): NormalizedBounds | null {
  if (stroke.points.length === 0) {
    return null;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of stroke.points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return { maxX, maxY, minX, minY };
}

function unionNormalizedBounds(a: NormalizedBounds, b: NormalizedBounds): NormalizedBounds {
  return {
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY)
  };
}

function normalizedBoundsAreNear(
  a: NormalizedBounds,
  b: NormalizedBounds,
  cssWidth: number,
  cssHeight: number,
  gapPx: number
): boolean {
  const gapX = Math.max(0, Math.max(a.minX, b.minX) - Math.min(a.maxX, b.maxX)) * Math.max(1, cssWidth);
  const gapY = Math.max(0, Math.max(a.minY, b.minY) - Math.min(a.maxY, b.maxY)) * Math.max(1, cssHeight);
  return Math.hypot(gapX, gapY) <= gapPx;
}

function strokesAreVisuallyConnected(
  a: InkStroke,
  b: InkStroke,
  cssWidth: number,
  cssHeight: number,
  gapPx: number
): boolean {
  const aBounds = normalizedStrokeBounds(a);
  const bBounds = normalizedStrokeBounds(b);
  return Boolean(aBounds && bBounds && normalizedBoundsAreNear(aBounds, bBounds, cssWidth, cssHeight, gapPx));
}

function normalizedTextBounds(text: InkText): NormalizedBounds {
  const lines = text.text.split(/\r?\n/);
  const maxChars = Math.max(1, ...lines.map((line) => line.length));
  const width = Math.max(text.fontSize, maxChars * text.fontSize * 0.58) / Math.max(1, text.pageCssWidth);
  const height = Math.max(text.fontSize, lines.length * text.fontSize * 1.2) / Math.max(1, text.pageCssHeight);
  return {
    maxX: text.x + width,
    maxY: text.y + height,
    minX: text.x,
    minY: text.y
  };
}

function normalizedCoverBounds(cover: InkCover | InkImage): NormalizedBounds {
  return {
    maxX: cover.x + cover.width,
    maxY: cover.y + cover.height,
    minX: cover.x,
    minY: cover.y
  };
}

function expandCoverToHideNativeText(cover: InkCover, overlay: PageOverlay): InkCover {
  const padLeft = Math.min(0.026, Math.max(3 / Math.max(1, overlay.cssWidth), cover.width * 0.12));
  const padRight = Math.min(0.065, Math.max(10 / Math.max(1, overlay.cssWidth), cover.width * 0.28));
  const padTop = Math.min(0.028, Math.max(3 / Math.max(1, overlay.cssHeight), cover.height * 0.24));
  const padBottom = Math.min(0.055, Math.max(8 / Math.max(1, overlay.cssHeight), cover.height * 0.55));
  const x = clamp(cover.x - padLeft, 0, 1);
  const y = clamp(cover.y - padTop * 0.7, 0, 1);
  const maxX = clamp(cover.x + cover.width + padRight, 0, 1);
  const maxY = clamp(cover.y + cover.height + padBottom, 0, 1);
  return {
    ...cover,
    height: Math.max(0.001, maxY - y),
    width: Math.max(0.001, maxX - x),
    x,
    y
  };
}

function normalizedElementBounds(element: InkElement): NormalizedBounds | null {
  if (element.kind === "stroke") {
    return normalizedStrokeBounds(element);
  }
  if (element.kind === "text") {
    return normalizedTextBounds(element);
  }
  return normalizedCoverBounds(element);
}

function normalizedElementsBounds(elements: InkElement[]): NormalizedBounds | null {
  let bounds: NormalizedBounds | null = null;
  for (const element of elements) {
    const box = normalizedElementBounds(element);
    if (!box) {
      continue;
    }
    bounds = bounds
      ? {
          maxX: Math.max(bounds.maxX, box.maxX),
          maxY: Math.max(bounds.maxY, box.maxY),
          minX: Math.min(bounds.minX, box.minX),
          minY: Math.min(bounds.minY, box.minY)
        }
      : box;
  }
  return bounds;
}

function getSelectionHandlePoints(bounds: NormalizedBounds): Array<{ handle: ResizeHandle; point: InkPoint }> {
  return [
    { handle: "nw", point: { x: bounds.minX, y: bounds.minY } },
    { handle: "ne", point: { x: bounds.maxX, y: bounds.minY } },
    { handle: "sw", point: { x: bounds.minX, y: bounds.maxY } },
    { handle: "se", point: { x: bounds.maxX, y: bounds.maxY } }
  ];
}

function findResizeHandleAt(bounds: NormalizedBounds, point: InkPoint, cssWidth: number, cssHeight: number, radius = 8, edgeBand = 0): ResizeHandle | null {
  const px = point.x * cssWidth;
  const py = point.y * cssHeight;

  for (const item of getSelectionHandlePoints(bounds)) {
    const hx = item.point.x * cssWidth;
    const hy = item.point.y * cssHeight;
    if (Math.abs(px - hx) <= radius && Math.abs(py - hy) <= radius) {
      return item.handle;
    }
  }

  if (edgeBand > 0) {
    const minX = bounds.minX * cssWidth;
    const maxX = bounds.maxX * cssWidth;
    const minY = bounds.minY * cssHeight;
    const maxY = bounds.maxY * cssHeight;
    const inside = px >= minX - edgeBand && px <= maxX + edgeBand && py >= minY - edgeBand && py <= maxY + edgeBand;
    if (inside) {
      const nearLeft = Math.abs(px - minX) <= edgeBand;
      const nearRight = Math.abs(px - maxX) <= edgeBand;
      const nearTop = Math.abs(py - minY) <= edgeBand;
      const nearBottom = Math.abs(py - maxY) <= edgeBand;
      if ((nearLeft || nearRight) && (nearTop || nearBottom)) {
        if (nearLeft && nearTop) return "nw";
        if (nearRight && nearTop) return "ne";
        if (nearLeft && nearBottom) return "sw";
        return "se";
      }
      if (nearLeft) return py < (minY + maxY) / 2 ? "nw" : "sw";
      if (nearRight) return py < (minY + maxY) / 2 ? "ne" : "se";
      if (nearTop) return px < (minX + maxX) / 2 ? "nw" : "ne";
      if (nearBottom) return px < (minX + maxX) / 2 ? "sw" : "se";
    }
  }

  return null;
}

function resizeElementsFromHandle(
  elements: InkElement[],
  bounds: NormalizedBounds,
  handle: ResizeHandle,
  point: InkPoint
): InkElement[] {
  const anchor = getResizeAnchor(bounds, handle);
  const originalCorner = getResizeCorner(bounds, handle);
  const originalDx = originalCorner.x - anchor.x;
  const originalDy = originalCorner.y - anchor.y;

  let scaleX = originalDx === 0 ? 1 : (point.x - anchor.x) / originalDx;
  let scaleY = originalDy === 0 ? 1 : (point.y - anchor.y) / originalDy;
  scaleX = Math.max(0.12, scaleX);
  scaleY = Math.max(0.12, scaleY);

  const scaleSize = clamp((Math.abs(scaleX) + Math.abs(scaleY)) / 2, 0.2, 8);
  const resized = elements.map((element) => {
    const next = cloneElement(element);
    if (next.kind === "stroke") {
      next.points = element.kind === "stroke"
        ? element.points.map((strokePoint) => ({
            x: anchor.x + (strokePoint.x - anchor.x) * scaleX,
            y: anchor.y + (strokePoint.y - anchor.y) * scaleY
          }))
        : next.points;
      next.width = clamp(next.width * scaleSize, 0.5, 80);
    } else if (next.kind === "text") {
      next.x = anchor.x + (next.x - anchor.x) * scaleX;
      next.y = anchor.y + (next.y - anchor.y) * scaleY;
      next.fontSize = clamp(next.fontSize * scaleSize, 4, 96);
    } else {
      next.x = anchor.x + (next.x - anchor.x) * scaleX;
      next.y = anchor.y + (next.y - anchor.y) * scaleY;
      next.width = clamp(next.width * Math.abs(scaleX), 0.001, 1);
      next.height = clamp(next.height * Math.abs(scaleY), 0.001, 1);
    }
    return next;
  });

  shiftElementsInsidePage(resized);
  return resized;
}

function scaleElementsAroundBoundsCenter(elements: InkElement[], bounds: NormalizedBounds, factor: number): InkElement[] {
  const center = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2
  };
  const resized = elements.map((element) => {
    const next = cloneElement(element);
    if (next.kind === "stroke") {
      next.points = next.points.map((strokePoint) => ({
        x: center.x + (strokePoint.x - center.x) * factor,
        y: center.y + (strokePoint.y - center.y) * factor
      }));
      next.width = clamp(next.width * factor, 0.5, 80);
    } else if (next.kind === "text") {
      next.x = center.x + (next.x - center.x) * factor;
      next.y = center.y + (next.y - center.y) * factor;
      next.fontSize = clamp(next.fontSize * factor, 4, 96);
    } else {
      next.x = center.x + (next.x - center.x) * factor;
      next.y = center.y + (next.y - center.y) * factor;
      next.width = clamp(next.width * factor, 0.001, 1);
      next.height = clamp(next.height * factor, 0.001, 1);
    }
    return next;
  });

  shiftElementsInsidePage(resized);
  return resized;
}

function getResizeAnchor(bounds: NormalizedBounds, handle: ResizeHandle): InkPoint {
  if (handle === "nw") {
    return { x: bounds.maxX, y: bounds.maxY };
  }
  if (handle === "ne") {
    return { x: bounds.minX, y: bounds.maxY };
  }
  if (handle === "sw") {
    return { x: bounds.maxX, y: bounds.minY };
  }
  return { x: bounds.minX, y: bounds.minY };
}

function getResizeCorner(bounds: NormalizedBounds, handle: ResizeHandle): InkPoint {
  if (handle === "nw") {
    return { x: bounds.minX, y: bounds.minY };
  }
  if (handle === "ne") {
    return { x: bounds.maxX, y: bounds.minY };
  }
  if (handle === "sw") {
    return { x: bounds.minX, y: bounds.maxY };
  }
  return { x: bounds.maxX, y: bounds.maxY };
}

function shiftElementsInsidePage(elements: InkElement[]): void {
  let box = normalizedElementsBounds(elements);
  if (!box) {
    return;
  }

  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;
  if (width > 0.98 || height > 0.98) {
    const factor = Math.min(
      width > 0 ? 0.98 / width : 1,
      height > 0 ? 0.98 / height : 1
    );
    const center = {
      x: (box.minX + box.maxX) / 2,
      y: (box.minY + box.maxY) / 2
    };
    for (const element of elements) {
      scaleElementAroundPointInPlace(element, center, factor);
    }
    box = normalizedElementsBounds(elements);
    if (!box) {
      return;
    }
  }

  let dx = 0;
  let dy = 0;
  if (box.minX < 0) {
    dx = -box.minX;
  } else if (box.maxX > 1) {
    dx = 1 - box.maxX;
  }

  if (box.minY < 0) {
    dy = -box.minY;
  } else if (box.maxY > 1) {
    dy = 1 - box.maxY;
  }

  if (dx === 0 && dy === 0) {
    return;
  }

  for (const element of elements) {
    translateElement(element, dx, dy);
  }
}

function scaleElementAroundPointInPlace(element: InkElement, center: InkPoint, factor: number): void {
  if (element.kind === "stroke") {
    element.points = element.points.map((point) => ({
      x: center.x + (point.x - center.x) * factor,
      y: center.y + (point.y - center.y) * factor
    }));
    element.width = clamp(element.width * factor, 0.5, 80);
    return;
  }

  element.x = center.x + (element.x - center.x) * factor;
  element.y = center.y + (element.y - center.y) * factor;
  if (element.kind === "text") {
    element.fontSize = clamp(element.fontSize * factor, 4, 96);
    return;
  }
  element.width = clamp(element.width * factor, 0.001, 1);
  element.height = clamp(element.height * factor, 0.001, 1);
}

function strokeContainsPoint(
  stroke: InkStroke,
  point: InkPoint,
  cssWidth: number,
  cssHeight: number,
  eraserWidth = 10
): boolean {
  if (stroke.points.length < 2) {
    return false;
  }

  const px = point.x * cssWidth;
  const py = point.y * cssHeight;
  const radius = Math.max(eraserWidth, strokeDisplayWidth(stroke, cssWidth) * 2.2);

  for (let i = 1; i < stroke.points.length; i += 1) {
    const start = stroke.points[i - 1];
    const end = stroke.points[i];
    const distance = pointToSegmentDistance(
      px,
      py,
      start.x * cssWidth,
      start.y * cssHeight,
      end.x * cssWidth,
      end.y * cssHeight
    );

    if (distance <= radius) {
      return true;
    }
  }

  return false;
}

function pointToSegmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;

  if (dx === 0 && dy === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  return Math.hypot(px - closestX, py - closestY);
}

function normalizedDistance(a: InkPoint, b: InkPoint, cssWidth: number, cssHeight: number): number {
  return Math.hypot((a.x - b.x) * cssWidth, (a.y - b.y) * cssHeight);
}

function inkPointsApproximatelyEqual(a: InkPoint[], b: InkPoint[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    if (Math.abs(a[index].x - b[index].x) > 0.0008 || Math.abs(a[index].y - b[index].y) > 0.0008) {
      return false;
    }
  }
  return true;
}

function dedupeInkElements(elements: InkElement[]): InkElement[] {
  const deduped: InkElement[] = [];
  for (const element of elements) {
    if (element.kind !== "stroke") {
      deduped.push(element);
      continue;
    }
    const duplicateIndex = deduped.findIndex((candidate) => (
      candidate.kind === "stroke" &&
      (candidate.id === element.id || isSamePdfInkStrokeCandidate(candidate, element))
    ));
    if (duplicateIndex === -1) {
      deduped.push(element);
      continue;
    }
    const existing = deduped[duplicateIndex];
    deduped[duplicateIndex] = existing.kind === "stroke" ? chooseInkStrokeToKeep(existing, element) : element;
  }
  return deduped;
}

function chooseInkStrokeToKeep(existing: InkStroke, candidate: InkStroke): InkStroke {
  if (existing.pdfSaved === true && candidate.pdfSaved !== true) {
    return candidate;
  }
  if (existing.saved && !candidate.saved) {
    return candidate;
  }
  if (candidate.externalDirty === true && existing.externalDirty !== true) {
    return candidate;
  }
  if (candidate.points.length > existing.points.length * 1.2) {
    return candidate;
  }
  return existing;
}

function isSamePdfInkStrokeCandidate(a: InkStroke, b: InkStroke): boolean {
  if (a.pageIndex !== b.pageIndex) {
    return false;
  }
  if (normalizeHexColor(a.color) !== normalizeHexColor(b.color)) {
    return false;
  }
  if (Math.abs(a.opacity - b.opacity) > 0.06 || Math.abs(a.width - b.width) > Math.max(2, Math.min(a.width, b.width) * 0.35)) {
    return false;
  }
  if (inkPointsApproximatelyEqual(a.points, b.points)) {
    return true;
  }
  const aBounds = normalizedStrokeBounds(a);
  const bBounds = normalizedStrokeBounds(b);
  if (!aBounds || !bBounds) {
    return false;
  }
  const boundsClose =
    Math.abs(aBounds.minX - bBounds.minX) <= 0.006 &&
    Math.abs(aBounds.minY - bBounds.minY) <= 0.006 &&
    Math.abs(aBounds.maxX - bBounds.maxX) <= 0.006 &&
    Math.abs(aBounds.maxY - bBounds.maxY) <= 0.006;
  if (!boundsClose) {
    return false;
  }
  const aFirst = a.points[0];
  const aLast = a.points[a.points.length - 1];
  const bFirst = b.points[0];
  const bLast = b.points[b.points.length - 1];
  return (
    Math.hypot(aFirst.x - bFirst.x, aFirst.y - bFirst.y) <= 0.012 &&
    Math.hypot(aLast.x - bLast.x, aLast.y - bLast.y) <= 0.012
  );
}

function collectPdfPathHints(rootEl: HTMLElement): string[] {
  const hints = new Set<string>();
  const add = (value: string | null | undefined): void => {
    if (!value) {
      return;
    }
    if (value.toLowerCase().includes(".pdf")) {
      hints.add(value);
    }
  };

  const attrs = [
    "alt",
    "aria-label",
    "data-file",
    "data-href",
    "data-linkpath",
    "data-path",
    "data-src",
    "href",
    "src",
    "title"
  ];

  for (const attr of attrs) {
    add(rootEl.getAttribute(attr));
  }

  const hintElements = Array.from(rootEl.querySelectorAll("a, embed, iframe, object, .internal-embed, .media-embed")).filter(isHTMLElement);
  for (const el of hintElements) {
    for (const attr of attrs) {
      add(el.getAttribute(attr));
    }
  }

  return Array.from(hints);
}

function cleanPdfPathHint(rawPath: string): string | null {
  let value = rawPath.trim();
  if (!value) {
    return null;
  }

  try {
    value = decodeURIComponent(value);
  } catch {
    // Keep the raw path when it is not URI-encoded.
  }

  const obsidianFileMatch = value.match(/[?&]file=([^&]+)/i);
  if (obsidianFileMatch?.[1]) {
    try {
      value = decodeURIComponent(obsidianFileMatch[1]);
    } catch {
      value = obsidianFileMatch[1];
    }
  }

  value = value
    .replace(/^app:\/\/local\//i, "")
    .replace(/^obsidian:\/\/open\?/i, "")
    .replace(/^file:\/+/i, "")
    .replace(/^vault:\/+/i, "")
    .replace(/^\/+/, "")
    .split("#")[0]
    .split("?")[0]
    .trim();

  const pdfIndex = value.toLowerCase().indexOf(".pdf");
  if (pdfIndex === -1) {
    return null;
  }

  return value.slice(0, pdfIndex + 4).replace(/\\/g, "/");
}

function makeStrokeId(): string {
  return `stroke-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function makeInkGroupId(): string {
  return `ink-group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeAnnotationKey(path: string): string {
  return encodeURIComponent(path).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function focusTextEditor(editor: HTMLTextAreaElement): void {
  editor.focus({ preventScroll: true });
  editor.select();
  window.setTimeout(() => {
    if (activeDocument.activeElement !== editor) {
      editor.focus({ preventScroll: true });
    }
    editor.select();
  }, 0);
}

async function fingerprintPdfBytes(buffer: ArrayBuffer, mtime?: number): Promise<PdfFingerprint> {
  return {
    mtime,
    sha256: await sha256Hex(buffer),
    size: buffer.byteLength
  };
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  if (!activeWindow.crypto?.subtle) {
    return fallbackBufferHash(buffer);
  }
  const digest = await activeWindow.crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function fallbackBufferHash(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  let h3 = 0x9e3779b9;
  let h4 = 0x85ebca6b;
  for (const byte of bytes) {
    h1 = Math.imul(h1 ^ byte, 0x01000193);
    h2 = Math.imul(h2 + byte, 0x85ebca6b);
    h3 = Math.imul(h3 ^ (byte + h1), 0xc2b2ae35);
    h4 = Math.imul(h4 + (byte ^ h2), 0x27d4eb2f);
  }
  return [h1, h2, h3, h4, bytes.byteLength, h1 ^ h3, h2 ^ h4, h1 ^ h2 ^ h3 ^ h4]
    .map((part) => (part >>> 0).toString(16).padStart(8, "0"))
    .join("");
}

function isPdfFingerprint(value: unknown): value is PdfFingerprint {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<PdfFingerprint>;
  return (
    typeof candidate.sha256 === "string" &&
    /^[0-9a-f]{64}$/i.test(candidate.sha256) &&
    typeof candidate.size === "number" &&
    Number.isFinite(candidate.size) &&
    (candidate.mtime === undefined || typeof candidate.mtime === "number")
  );
}

function normalizeHexColor(value: string): string {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed;
  }
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }
  return "#000000";
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((part) => clamp(Math.round(part), 0, 255).toString(16).padStart(2, "0")).join("")}`;
}

function cssColorToHex(value: string): string | null {
  const normalized = normalizeHexColor(value);
  if (normalized !== "#000000" || /^#0{3,6}$/i.test(value.trim())) {
    return normalized;
  }
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) {
    return null;
  }
  return rgbToHex(Number(match[1]), Number(match[2]), Number(match[3]));
}

function readableTextColor(backgroundColor: string): string {
  const hex = cssColorToHex(backgroundColor) ?? "#ffffff";
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5 ? "#ffffff" : "#000000";
}

function estimateTextEditorWidth(text: string, fontSize: number, fallbackWidth: number): number {
  const longestLine = text.split(/\r?\n/).reduce((max, line) => Math.max(max, line.length), 0);
  const estimated = longestLine * Math.max(6, fontSize) * 0.62;
  return Math.max(fallbackWidth, estimated);
}

function isInkElement(value: unknown): value is InkElement {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<InkElement>;
  if (typeof item.id !== "string" || typeof item.pageIndex !== "number" || typeof item.saved !== "boolean") {
    return false;
  }
  if (item.kind === "stroke") {
    const stroke = item as Partial<InkStroke>;
    return (
      typeof stroke.color === "string" &&
      typeof stroke.opacity === "number" &&
      typeof stroke.width === "number" &&
      Array.isArray(stroke.points) &&
      stroke.points.every((point) => typeof point?.x === "number" && typeof point?.y === "number")
    );
  }
  if (item.kind === "text") {
    const text = item as Partial<InkText>;
    return typeof text.text === "string" && typeof text.x === "number" && typeof text.y === "number" && typeof text.fontSize === "number";
  }
  if (item.kind === "cover") {
    const cover = item as Partial<InkCover>;
    return typeof cover.x === "number" && typeof cover.y === "number" && typeof cover.width === "number" && typeof cover.height === "number";
  }
  if (item.kind === "image") {
    const image = item as Partial<InkImage>;
    return (
      typeof image.dataUrl === "string" &&
      image.dataUrl.startsWith("data:image/") &&
      typeof image.x === "number" &&
      typeof image.y === "number" &&
      typeof image.width === "number" &&
      typeof image.height === "number" &&
      typeof image.opacity === "number"
    );
  }
  return false;
}

function markElementSaved<T extends InkElement>(element: T): T {
  return { ...element, saved: true };
}

function markElementUnsaved<T extends InkElement>(element: T): T {
  if (element.kind === "stroke") {
    return { ...element, pdfSaved: element.pdfSaved, saved: false };
  }
  const next = { ...element, saved: false };
  return next;
}

function hexToRgb(hex: string): { b: number; g: number; r: number } {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean, 16);
  return {
    b: ((value >> 0) & 255) / 255,
    g: ((value >> 8) & 255) / 255,
    r: ((value >> 16) & 255) / 255
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
