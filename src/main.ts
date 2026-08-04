import { Notice, Plugin, PluginSettingTab, Setting, TFile, WorkspaceLeaf, setIcon } from "obsidian";
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFString, degrees, rgb } from "pdf-lib";
import { getExtendedPdftionTranslation } from "./i18n";

// Mobile WebViews do not expose Obsidian desktop-only activeWindow globals.
const activeWindow = window;
const activeDocument = document;

type ToolMode = "select" | "pen" | "highlight" | "eraser" | "text" | "comment" | "cover" | "image-crop";
type ResizeHandle = "nw" | "ne" | "sw" | "se";
type PdfFontkitModule = typeof import("@pdf-lib/fontkit");

const AUTO_SAVE_IDLE_DELAY_MS = 5200;
const AUTO_SAVE_CLOSE_DELAY_MS = 200;
const DATA_MAINTENANCE_DELETE_DELAY_MS = 30_000;
const DATA_MAINTENANCE_START_DELAY_MS = 15_000;
const OVERLAY_HEALTH_CHECK_MS = 5000;
const OVERLAY_MAX_DPR = 2;
const PDF_ZOOM_SETTLE_DELAY_MS = 160;
const PDF_SURFACE_MISSING_GRACE_MS = 2500;
const INK_AUTO_GROUP_GAP_PX = 28;
const INK_AUTO_GROUP_WINDOW_MS = 3500;
const NATIVE_POPUP_SUPPRESS_MS = 650;
const STROKE_FAST_SAVE_DELAY_MS = 180;
const STROKE_MIN_POINT_DISTANCE_PX = 0.35;
const STROKE_INTERPOLATION_STEP_PX = 0.75;
const VISUAL_EXPORT_PAGE_GAP_RATIO = 0.025;
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
type PdftionLanguageSetting = "auto" | PdftionLocale;
const PDFTION_LANGUAGE_OPTIONS: ReadonlyArray<{ label: string; value: PdftionLanguageSetting }> = [
  { label: "", value: "auto" },
  { label: "简体中文", value: "zh" },
  { label: "English", value: "en" },
  { label: "العربية", value: "ar" },
  { label: "Deutsch", value: "de" },
  { label: "Español", value: "es" },
  { label: "Français", value: "fr" },
  { label: "Bahasa Indonesia", value: "id" },
  { label: "日本語", value: "ja" },
  { label: "한국어", value: "ko" },
  { label: "Português", value: "pt" },
  { label: "Русский", value: "ru" },
  { label: "Türkçe", value: "tr" },
  { label: "Tiếng Việt", value: "vi" }
];
let pdftionLanguagePreference: PdftionLanguageSetting = "auto";
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
  language: PdftionLanguageSetting;
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
  nativeTextSelectionAction: "copy" | "highlight";
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
  language: "auto",
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
  nativeTextSelectionAction: "copy",
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
  if (pdftionLanguagePreference !== "auto") {
    return pdftionLanguagePreference;
  }
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
  return PDFTION_TRANSLATIONS[locale]?.[en] ?? getExtendedPdftionTranslation(locale, en) ?? en;
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
  onLoadFile?: (file: TFile) => Promise<void>;
  viewer?: {
    child?: {
      pdfViewer?: NativePdfViewerAppLike;
    };
  };
}

interface NativePdfPageViewLike {
  cancelRendering?: () => void;
  canvas?: HTMLCanvasElement | null;
  div?: HTMLElement;
  draw?: () => Promise<unknown>;
  pdfPage?: NativePdfPageLike;
  renderingState?: number;
  reset?: () => void;
  resume?: (() => void) | null;
  viewport?: NativePdfViewportLike;
}

interface NativePdfTextContentItemLike {
  fontName?: string;
  hasEOL?: boolean;
  height?: number;
  str?: string;
  transform?: number[];
  width?: number;
}

interface NativePdfTextContentLike {
  items?: NativePdfTextContentItemLike[];
  styles?: Record<string, { fontFamily?: string }>;
}

interface NativePdfAnnotationLike {
  dest?: string | unknown[];
  rect?: number[];
  unsafeUrl?: string;
  url?: string;
}

interface NativePdfPageLike {
  getAnnotations?: (options?: { intent?: string }) => Promise<NativePdfAnnotationLike[]>;
  getTextContent?: () => Promise<NativePdfTextContentLike>;
  render?: (options: {
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    intent?: "display" | "print";
    transform?: number[];
    viewport: NativePdfViewportLike;
  }) => { cancel?: () => void; promise?: Promise<unknown> } | Promise<unknown>;
}

interface NativePdfViewportLike {
  height?: number;
  scale?: number;
  transform?: number[];
  width?: number;
}

interface NativePdfRenderingQueueLike {
  highestPriorityPage?: NativePdfPageViewLike | null;
  renderHighestPriority?: () => void;
  renderView?: (page: NativePdfPageViewLike) => void;
}

interface NativePdfViewerLike {
  _pages?: NativePdfPageViewLike[];
  currentPageNumber?: number;
  forceRendering?: () => void;
  getPageView?: (pageIndex: number) => NativePdfPageViewLike | null;
  renderingQueue?: NativePdfRenderingQueueLike;
  scrollPageIntoView?: (options: { pageNumber: number }) => void;
  update?: () => void;
}

interface NativePdfViewerAppLike {
  forceRendering?: () => void;
  pdfRenderingQueue?: NativePdfRenderingQueueLike;
  pdfViewer?: NativePdfViewerLike;
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
  zIndex?: number;
}

interface InkText {
  color: string;
  createdAt?: number;
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
  presentation?: "text" | "comment";
  x: number;
  y: number;
  zIndex?: number;
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
  zIndex?: number;
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
  zIndex?: number;
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
  geometryFrame?: number | null;
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
  images: VisualConversionImage[];
  lines: EditableMarkdownLine[];
  pageIndex: number;
  path?: string;
  sourceVisualRatio: number;
  width: number;
}

interface VisualConversionImage {
  dataUrl: string;
  height: number;
  id: string;
  link?: string;
  opacity: number;
  width: number;
  x: number;
  y: number;
  zIndex?: number;
}

interface EditableMarkdownTextRun {
  bold: boolean;
  code?: boolean;
  color: string;
  fontFamily: string;
  fontSize: number;
  italic: boolean;
  left?: number;
  link?: string;
  opacity?: number;
  strike: boolean;
  text: string;
  underline: boolean;
  width?: number;
}

interface EditableMarkdownLine {
  height: number;
  left: number;
  runs: EditableMarkdownTextRun[];
  top: number;
  width: number;
}

interface EditableMarkdownTableCell {
  left: number;
  runs: EditableMarkdownTextRun[];
}

interface EditableMarkdownTable {
  bottom: number;
  columnStarts: number[];
  left: number;
  lines: EditableMarkdownLine[];
  right: number;
  rows: EditableMarkdownTableCell[][];
  top: number;
}

interface EditableMarkdownPage {
  height: number;
  lines: EditableMarkdownLine[];
  pageIndex: number;
  width: number;
}

interface EditableMarkdownHeadingProfile {
  baseFontSize: number;
  ratios: number[];
}

type NativeExportBlockKind =
  | "callout-body"
  | "callout-title"
  | "code"
  | "heading"
  | "image"
  | "ordered-list"
  | "paragraph"
  | "quote"
  | "separator"
  | "table"
  | "task"
  | "unordered-list";

interface NativeExportBlock {
  checked?: boolean;
  height?: number;
  headingLevel?: number;
  image?: NoteDrawExportImage;
  kind: NativeExportBlockKind;
  leadingImages?: NoteDrawExportImage[];
  left: number;
  listLevel?: number;
  marker?: string;
  ordinal?: number;
  runs: EditableMarkdownTextRun[];
  table?: EditableMarkdownTable;
  top: number;
  width: number;
}

interface NativeExportPage {
  blocks: NativeExportBlock[];
  height: number;
  pageIndex: number;
  width: number;
}

interface NativeExportDocument {
  baseFontSize: number;
  headingProfile: EditableMarkdownHeadingProfile;
  pages: NativeExportPage[];
}

interface VisualCaptureOptions {
  includeCovers?: boolean;
  includeImages?: boolean;
  includeStrokes?: boolean;
  includeText?: boolean;
}

interface SourcePdfSnapshot {
  bytes: ArrayBuffer;
  fingerprint: string;
  path: string;
}

interface NoteDrawExportPoint {
  t: number;
  x: number;
  y: number;
}

interface NoteDrawExportStroke {
  assetMime?: string;
  assetName?: string;
  assetPath?: string;
  assetSize?: number;
  brush: "pen" | "watercolor";
  color: string;
  count: number;
  embedType?: "image";
  exportImageDataUrl?: string;
  kind?: "embed";
  opacity: number;
  points: NoteDrawExportPoint[];
  previewHeight?: number;
  previewWidth?: number;
  text?: string;
  width: number;
}

interface NoteDrawExportImage extends VisualConversionImage {
  assetMime: string;
  assetName: string;
  assetPath?: string;
  assetSize?: number;
  placement?: "floating" | "flow" | "ink-preview";
  pageIndex: number;
  zIndex?: number;
}

interface NoteDrawExportData {
  sourcePath: string;
  strokes: NoteDrawExportStroke[];
  version: number;
  visible: boolean;
  webEdits: unknown[];
}

interface NoteDrawWriteApi {
  writeDrawings(fileOrPath: string | TFile, data: NoteDrawExportData): Promise<unknown>;
}

interface NoteDrawRuntime extends NoteDrawWriteApi {
  v1?: NoteDrawWriteApi;
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
  elements?: InkElement[];
  handle?: ResizeHandle;
  historyRecorded?: boolean;
  moved: boolean;
  mode: "move" | "marquee" | "resize";
  originalBounds?: NormalizedBounds;
  originalElements?: InkElement[];
  pageIndex: number;
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
  exportAnnotationsHtml(): Promise<string | null>;
  exportAnnotationsMarkdown(): Promise<string | null>;
  exportAnnotationsPng(): Promise<string | null>;
  exportAnnotationsPptx(): Promise<string | null>;
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
    NoteDraw?: NoteDrawRuntime;
    PdftionAI?: PdftionAiApi;
  }
}

interface PdfInkEditTransactionRecord {
  annotationStateExisted: boolean;
  backupAnnotationStatePath?: string;
  backupPdfPath: string;
  filePath: string;
  pageIndexes: number[];
  phase: "committed" | "editing";
  startedAt: string;
  version: 1;
}

export default class PdftionPlugin extends Plugin {
  private annotationFontBytes: Uint8Array | null = null;
  private dataMaintenancePending = false;
  private dataMaintenanceRunning = false;
  private dataMaintenanceTimer: number | null = null;
  private inkCommitPromises = new Map<string, Promise<boolean>>();
  private missingPdfSurfaces = new Map<HTMLElement, number>();
  private sessions = new Map<HTMLElement, InkSession>();
  private surfaceScanTimers: number[] = [];
  settings: PdftionSettings = { ...DEFAULT_SETTINGS };

  async onload(): Promise<void> {
    await this.loadSettings();
    await this.recoverPendingInkEditTransactions();
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
      id: "export-annotations-docx",
      name: uiText("导出批注 DOCX", "Export annotations to DOCX"),
      callback: () => {
        const session = this.getActivePdfSession();
        if (!session) {
          new Notice(uiText("请先打开 PDF。", "Open a PDF first."));
          return;
        }
        void session.exportConvertedDocx();
      }
    });

    this.addCommand({
      id: "export-annotations-pptx",
      name: uiText("导出批注 PPTX", "Export annotations to PPTX"),
      callback: () => {
        const session = this.getActivePdfSession();
        if (!session) {
          new Notice(uiText("请先打开 PDF。", "Open a PDF first."));
          return;
        }
        void session.exportConvertedPptx();
      }
    });

    this.addCommand({
      id: "export-annotations-html",
      name: uiText("导出 HTML", "Export HTML"),
      callback: () => {
        const session = this.getActivePdfSession();
        if (!session) {
          new Notice(uiText("请先打开 PDF。", "Open a PDF first."));
          return;
        }
        void session.exportConvertedHtml();
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

    this.registerEvent(this.app.workspace.on("active-leaf-change", (leaf) => {
      this.flushSessionsOutsideLeaf(leaf);
      this.queuePdfSurfaceScans();
    }));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.queuePdfSurfaceScans()));
    this.registerEvent(this.app.workspace.on("file-open", (file) => {
      this.flushSessionsOutsideFile(file);
      this.queuePdfSurfaceScans();
    }));
    this.registerEvent(this.app.vault.on("delete", (file) => {
      if (file instanceof TFile && file.extension.toLowerCase() === "pdf") {
        this.scheduleDataMaintenance(DATA_MAINTENANCE_DELETE_DELAY_MS);
      }
    }));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      if (file instanceof TFile && (file.extension.toLowerCase() === "pdf" || oldPath.toLowerCase().endsWith(".pdf"))) {
        void this.migratePdfData(oldPath, file.path);
      }
    }));
    this.registerDomEvent(activeDocument, "pointerdown", (event) => this.commitEditorsOnOutsidePointer(event), { capture: true });
    this.registerDomEvent(activeWindow, "pagehide", () => this.checkpointAllSessionsSoon());
    this.registerDomEvent(activeWindow, "beforeunload", () => this.checkpointAllSessionsSoon());
    this.register(() => this.clearSurfaceScanTimers());
    this.register(() => this.clearDataMaintenanceTimer());

    this.queuePdfSurfaceScans();
    this.scheduleDataMaintenance(DATA_MAINTENANCE_START_DELAY_MS);
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
      session.destroy(false);
    }
    this.sessions.clear();
    this.missingPdfSurfaces.clear();
    this.clearSurfaceScanTimers();
    this.clearDataMaintenanceTimer();
  }

  refreshGlobalEditingClass(): void {
    const hasActiveSession = Array.from(this.sessions.values()).some((session) => session.isEnabled());
    getActiveBody().classList.toggle("pdftion-editing-active", hasActiveSession);
  }

  applyRuntimeSettings(): void {
    pdftionLanguagePreference = this.settings.language;
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
    for (const delay of [0, 120, 480, 1400, 3200]) {
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

  private scheduleDataMaintenance(delay: number): void {
    this.clearDataMaintenanceTimer();
    this.dataMaintenanceTimer = window.setTimeout(() => {
      this.dataMaintenanceTimer = null;
      void this.runDataMaintenance();
    }, delay);
  }

  private clearDataMaintenanceTimer(): void {
    if (this.dataMaintenanceTimer !== null) {
      window.clearTimeout(this.dataMaintenanceTimer);
      this.dataMaintenanceTimer = null;
    }
  }

  private async runDataMaintenance(): Promise<void> {
    if (this.dataMaintenanceRunning) {
      this.dataMaintenancePending = true;
      return;
    }
    this.dataMaintenanceRunning = true;
    let removed = 0;
    try {
      removed = await this.pruneObsoletePdfData();
      if (removed > 0) {
        console.info(`pdftion removed ${removed} obsolete data files.`);
      }
    } catch (error) {
      console.warn("pdftion could not finish background data maintenance.", error);
    } finally {
      this.dataMaintenanceRunning = false;
      if (this.dataMaintenancePending) {
        this.dataMaintenancePending = false;
        this.scheduleDataMaintenance(1000);
      }
    }
  }

  private async listAdapterFiles(dir: string): Promise<string[]> {
    try {
      return (await this.app.vault.adapter.list(dir)).files ?? [];
    } catch {
      return [];
    }
  }

  private async removeAdapterFile(path: string): Promise<boolean> {
    try {
      if (!(await this.app.vault.adapter.exists(path))) {
        return false;
      }
      await this.app.vault.adapter.remove(path);
      return true;
    } catch (error) {
      console.debug("pdftion could not remove obsolete data.", path, error);
      return false;
    }
  }

  private async moveAdapterFile(from: string, to: string): Promise<boolean> {
    if (!(await this.app.vault.adapter.exists(from))) {
      return false;
    }
    if (await this.app.vault.adapter.exists(to)) {
      await this.app.vault.adapter.remove(to);
    }
    await this.app.vault.adapter.rename(from, to);
    return true;
  }

  private async adapterFileIsOlderThan(path: string, ageMs: number): Promise<boolean> {
    try {
      const stat = await this.app.vault.adapter.stat(path);
      return Boolean(stat && Date.now() - stat.mtime >= ageMs);
    } catch {
      return false;
    }
  }

  private getAnnotationStatePathForPath(filePath: string): string {
    return `${this.manifest.dir}/data/annotations/${safeAnnotationKey(filePath)}.json`;
  }

  private async migratePdfData(oldPath: string, newPath: string): Promise<void> {
    if (oldPath === newPath) {
      return;
    }
    const oldKey = safeAnnotationKey(oldPath);
    const newKey = safeAnnotationKey(newPath);
    try {
      const oldStatePath = this.getAnnotationStatePathForPath(oldPath);
      const newStatePath = this.getAnnotationStatePathForPath(newPath);
      if (await this.app.vault.adapter.exists(oldStatePath)) {
        const state = JSON.parse(await this.app.vault.adapter.read(oldStatePath)) as Record<string, unknown>;
        state.filePath = newPath;
        await this.app.vault.adapter.write(newStatePath, JSON.stringify(state, null, 2));
        await this.removeAdapterFile(oldStatePath);
      }

      const baseDir = `${this.manifest.dir}/data/base-pdfs`;
      for (const path of await this.listAdapterFiles(baseDir)) {
        const name = path.slice(path.lastIndexOf("/") + 1);
        if (name.startsWith(`${oldKey}--`)) {
          await this.moveAdapterFile(path, `${baseDir}/${newKey}${name.slice(oldKey.length)}`);
        }
      }

      const rewriteDir = `${this.manifest.dir}/data/rewrite-backups`;
      const oldRewritePdf = `${rewriteDir}/${oldKey}.pdf`;
      const newRewritePdf = `${rewriteDir}/${newKey}.pdf`;
      const oldRewriteJson = `${rewriteDir}/${oldKey}.json`;
      const newRewriteJson = `${rewriteDir}/${newKey}.json`;
      await this.moveAdapterFile(oldRewritePdf, newRewritePdf);
      if (await this.app.vault.adapter.exists(oldRewriteJson)) {
        const record = JSON.parse(await this.app.vault.adapter.read(oldRewriteJson)) as Partial<PdfRewriteBackupRecord>;
        record.filePath = newPath;
        record.pdfPath = newRewritePdf;
        await this.app.vault.adapter.write(newRewriteJson, JSON.stringify(record, null, 2));
        await this.removeAdapterFile(oldRewriteJson);
      }

      const transactionDir = `${this.manifest.dir}/data/ink-edit-transactions`;
      const oldTransactionJson = `${transactionDir}/${oldKey}.json`;
      const newTransactionJson = `${transactionDir}/${newKey}.json`;
      if (await this.app.vault.adapter.exists(oldTransactionJson)) {
        const record = JSON.parse(await this.app.vault.adapter.read(oldTransactionJson)) as PdfInkEditTransactionRecord;
        const newBackupPdfPath = `${transactionDir}/${newKey}.pdf`;
        const newBackupStatePath = record.backupAnnotationStatePath ? `${transactionDir}/${newKey}.state.json` : undefined;
        await this.moveAdapterFile(record.backupPdfPath, newBackupPdfPath);
        if (record.backupAnnotationStatePath && newBackupStatePath) {
          await this.moveAdapterFile(record.backupAnnotationStatePath, newBackupStatePath);
        }
        record.filePath = newPath;
        record.backupPdfPath = newBackupPdfPath;
        record.backupAnnotationStatePath = newBackupStatePath;
        await this.app.vault.adapter.write(newTransactionJson, JSON.stringify(record, null, 2));
        await this.removeAdapterFile(oldTransactionJson);
      }
    } catch (error) {
      console.warn("pdftion could not migrate PDF data after rename.", oldPath, newPath, error);
    } finally {
      this.scheduleDataMaintenance(1000);
    }
  }

  private async pruneObsoletePdfData(): Promise<number> {
    const dataDir = `${this.manifest.dir}/data`;
    const annotationDir = `${dataDir}/annotations`;
    const baseDir = `${dataDir}/base-pdfs`;
    const rewriteDir = `${dataDir}/rewrite-backups`;
    const transactionDir = `${dataDir}/ink-edit-transactions`;
    const referencedBasePaths = new Set<string>();
    let removed = 0;
    let processed = 0;
    const yieldIfNeeded = async (): Promise<void> => {
      processed += 1;
      if (processed % 12 === 0) {
        await sleepMs(0);
      }
    };
    const remove = async (path: string): Promise<void> => {
      if (await this.removeAdapterFile(path)) {
        removed += 1;
      }
      await yieldIfNeeded();
    };

    for (const path of await this.listAdapterFiles(annotationDir)) {
      if (!path.endsWith(".json")) {
        continue;
      }
      const name = path.slice(path.lastIndexOf("/") + 1, -5);
      let keyPath = "";
      try {
        keyPath = decodeURIComponent(name);
      } catch {
        await remove(path);
        continue;
      }
      try {
        const state = JSON.parse(await this.app.vault.adapter.read(path)) as Partial<AnnotationStateRecord>;
        const source = this.app.vault.getAbstractFileByPath(keyPath);
        const elements = Array.isArray(state.elements) ? state.elements.filter(isInkElement) : [];
        if (!(source instanceof TFile) || source.extension.toLowerCase() !== "pdf" || state.filePath !== keyPath || elements.length === 0) {
          await remove(path);
          continue;
        }
        if (isPdfFingerprint(state.basePdfFingerprint)) {
          referencedBasePaths.add(`${baseDir}/${safeAnnotationKey(keyPath)}--${state.basePdfFingerprint.sha256}.pdf`);
        }
        await yieldIfNeeded();
      } catch {
        await remove(path);
      }
    }

    for (const path of await this.listAdapterFiles(baseDir)) {
      const name = path.slice(path.lastIndexOf("/") + 1);
      const match = name.match(/^(.*)--([0-9a-f]{64})\.pdf$/i);
      if (!match) {
        await remove(path);
        continue;
      }
      let sourcePath = "";
      try {
        sourcePath = decodeURIComponent(match[1]);
      } catch {
        await remove(path);
        continue;
      }
      const source = this.app.vault.getAbstractFileByPath(sourcePath);
      const unreferencedAndOld = !referencedBasePaths.has(path) && await this.adapterFileIsOlderThan(path, 60 * 60 * 1000);
      if (!(source instanceof TFile) || source.extension.toLowerCase() !== "pdf" || unreferencedAndOld) {
        await remove(path);
      } else {
        await yieldIfNeeded();
      }
    }

    const validRewritePdfs = new Set<string>();
    for (const path of (await this.listAdapterFiles(rewriteDir)).filter((item) => item.endsWith(".json"))) {
      try {
        const record = JSON.parse(await this.app.vault.adapter.read(path)) as PdfRewriteBackupRecord;
        const source = this.app.vault.getAbstractFileByPath(record.filePath);
        if (!(source instanceof TFile) || source.extension.toLowerCase() !== "pdf" || !(await this.app.vault.adapter.exists(record.pdfPath))) {
          await remove(record.pdfPath);
          await remove(path);
          continue;
        }
        validRewritePdfs.add(record.pdfPath);
        await yieldIfNeeded();
      } catch {
        await remove(path);
      }
    }
    for (const path of (await this.listAdapterFiles(rewriteDir)).filter((item) => item.endsWith(".pdf"))) {
      if (!validRewritePdfs.has(path)) {
        await remove(path);
      }
    }

    const validTransactionFiles = new Set<string>();
    for (const path of (await this.listAdapterFiles(transactionDir)).filter((item) => item.endsWith(".json"))) {
      try {
        const record = JSON.parse(await this.app.vault.adapter.read(path)) as PdfInkEditTransactionRecord;
        const source = this.app.vault.getAbstractFileByPath(record.filePath);
        if (!(source instanceof TFile) || source.extension.toLowerCase() !== "pdf" || !(await this.app.vault.adapter.exists(record.backupPdfPath))) {
          await remove(record.backupPdfPath);
          if (record.backupAnnotationStatePath) {
            await remove(record.backupAnnotationStatePath);
          }
          await remove(path);
          continue;
        }
        validTransactionFiles.add(record.backupPdfPath);
        if (record.backupAnnotationStatePath) {
          validTransactionFiles.add(record.backupAnnotationStatePath);
        }
        await yieldIfNeeded();
      } catch {
        await remove(path);
      }
    }
    for (const path of await this.listAdapterFiles(transactionDir)) {
      if (!path.endsWith(".json") && !validTransactionFiles.has(path)) {
        await remove(path);
      }
    }
    return removed;
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
    if (!(await this.app.vault.adapter.exists(this.getAnnotationStatePath(file)))) {
      return null;
    }
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
          version: 7,
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
          version: 7,
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
    return this.getAnnotationStatePathForPath(file.path);
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
      if (filePath !== file.path) {
        console.warn("pdftion removed annotation state assigned to another PDF.", file.path, filePath);
        await this.removeAdapterFile(this.getAnnotationStatePath(file));
        return null;
      }
      if (parsed.pdfFingerprint.sha256 !== currentFingerprint.sha256) {
        console.warn("pdftion skipped annotation state for a replaced PDF.", file.path);
        await this.removeAdapterFile(this.getAnnotationStatePath(file));
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
          this.missingPdfSurfaces.delete(surface.rootEl);
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
          this.missingPdfSurfaces.delete(surface.rootEl);
          existing.updateFile(surface.file);
          existing.scheduleQuietScan();
          continue;
        }

        const session = new InkSession(this, currentLeaf, surface.file, surface.rootEl);
        this.sessions.set(surface.rootEl, session);
      }
    }

    const now = Date.now();
    for (const [rootEl, session] of this.sessions.entries()) {
      if (activeDocument.body.contains(rootEl) && liveRoots.has(rootEl)) {
        this.missingPdfSurfaces.delete(rootEl);
        continue;
      }
      const missingSince = this.missingPdfSurfaces.get(rootEl);
      if (missingSince === undefined) {
        this.missingPdfSurfaces.set(rootEl, now);
        continue;
      }
      if (now - missingSince < PDF_SURFACE_MISSING_GRACE_MS) {
        continue;
      }
      session.destroy();
      this.sessions.delete(rootEl);
      this.missingPdfSurfaces.delete(rootEl);
    }
    this.refreshGlobalEditingClass();
  }

  private findLeafForFile(file: TFile): WorkspaceLeaf | null {
    const recentLeaf = this.app.workspace.getMostRecentLeaf();
    const recentView = recentLeaf?.view as unknown as PdfViewLike | undefined;
    if (recentLeaf && recentView?.file?.path === file.path && recentView.getViewType?.() === "pdf") {
      return recentLeaf;
    }

    let matchedPdf: WorkspaceLeaf | null = null;
    let visiblePdf: WorkspaceLeaf | null = null;
    let matchedOther: WorkspaceLeaf | null = null;
    let visibleOther: WorkspaceLeaf | null = null;
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view as unknown as PdfViewLike;
      if (view.file?.path === file.path) {
        const isPdfView = view.getViewType?.() === "pdf";
        if (isPdfView) {
          matchedPdf = leaf;
        } else {
          matchedOther = leaf;
        }
        const rootEl = view.containerEl ?? view.contentEl;
        const rect = rootEl?.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
          if (isPdfView) {
            visiblePdf = leaf;
          } else {
            visibleOther = leaf;
          }
        }
      }
    });
    return visiblePdf ?? visibleOther ?? matchedPdf ?? matchedOther;
  }

  async beginInkEditTransaction(file: TFile, pageIndexes: Set<number>): Promise<void> {
    const normalizedPages = Array.from(pageIndexes)
      .filter((pageIndex) => Number.isInteger(pageIndex) && pageIndex >= 0)
      .sort((a, b) => a - b);
    if (normalizedPages.length === 0) {
      return;
    }
    const existing = await this.readInkEditTransaction(file);
    if (existing) {
      if (
        existing.filePath === file.path &&
        normalizedPages.every((pageIndex) => existing.pageIndexes.includes(pageIndex))
      ) {
        return;
      }
      throw new Error(`An ink edit transaction is already active for ${existing.filePath} page ${existing.pageIndexes.join(", ")}.`);
    }

    const dir = `${this.manifest.dir}/data/ink-edit-transactions`;
    const safeKey = safeAnnotationKey(file.path);
    const backupPdfPath = `${dir}/${safeKey}.pdf`;
    const transactionPath = `${dir}/${safeKey}.json`;
    const currentBytes = await this.app.vault.readBinary(file);
    const pdf = await PDFDocument.load(currentBytes, { ignoreEncryption: true, updateMetadata: false });
    const transactionPages = normalizedPages.filter((pageIndex) => pageIndex < pdf.getPageCount());
    if (transactionPages.length === 0) {
      return;
    }
    await this.ensureAdapterFolder(dir);
    await this.app.vault.adapter.writeBinary(backupPdfPath, currentBytes);
    const annotationStatePath = this.getAnnotationStatePath(file);
    const annotationStateExisted = await this.app.vault.adapter.exists(annotationStatePath);
    const backupAnnotationStatePath = annotationStateExisted ? `${dir}/${safeKey}.state.json` : undefined;
    if (backupAnnotationStatePath) {
      await this.app.vault.adapter.write(
        backupAnnotationStatePath,
        await this.app.vault.adapter.read(annotationStatePath)
      );
    }
    const record: PdfInkEditTransactionRecord = {
      annotationStateExisted,
      backupAnnotationStatePath,
      backupPdfPath,
      filePath: file.path,
      pageIndexes: transactionPages,
      phase: "editing",
      startedAt: new Date().toISOString(),
      version: 1
    };
    await this.app.vault.adapter.write(transactionPath, JSON.stringify(record, null, 2));

    try {
      removeAllInkAnnotationsOnPages(pdf, new Set(transactionPages));
      const saved = await pdf.save({ addDefaultPage: false, useObjectStreams: false });
      const detachedBytes = new ArrayBuffer(saved.byteLength);
      new Uint8Array(detachedBytes).set(saved);
      await this.app.vault.modifyBinary(file, detachedBytes);
    } catch (error) {
      await this.restoreInkEditTransaction(file, record, true);
      throw error;
    }
  }

  async completeInkEditTransaction(file: TFile, elements: InkElement[], pageIndexes: Set<number>): Promise<boolean> {
    const existing = this.inkCommitPromises.get(file.path);
    if (existing) {
      return existing;
    }
    const commit = this.completeInkEditTransactionNow(file, elements, pageIndexes);
    this.inkCommitPromises.set(file.path, commit);
    try {
      return await commit;
    } finally {
      if (this.inkCommitPromises.get(file.path) === commit) {
        this.inkCommitPromises.delete(file.path);
      }
    }
  }

  async finishInkEditTransaction(file: TFile, elements: InkElement[], pageIndexes: Set<number>): Promise<boolean> {
    const record = await this.readInkEditTransaction(file);
    if (!record) {
      return true;
    }
    const pages = new Set(record.pageIndexes.filter((pageIndex) => pageIndexes.has(pageIndex)));
    if (pages.size === 0) {
      return true;
    }
    const backupElements = await this.readInkEditBackupElements(record);
    if (!backupElements || !inkStrokeSetsEquivalent(elements, backupElements, pages)) {
      return this.completeInkEditTransaction(file, elements, pages);
    }

    try {
      await this.restoreInkEditTransaction(file, record, true);
      const restoredBytes = await this.app.vault.readBinary(file);
      const preserved = elements.map((element): InkElement => {
        if (element.kind !== "stroke" || !pages.has(element.pageIndex)) {
          return markElementSaved(cloneElement(element));
        }
        return {
          ...cloneStroke(element),
          externalDirty: false,
          pdfPoints: element.points.map((point) => ({ ...point })),
          pdfSaved: true,
          saved: true
        };
      });
      await this.saveEditableAnnotationState(file, preserved, restoredBytes);
      return true;
    } catch (error) {
      console.error("pdftion could not restore an unchanged PDF ink edit transaction.", error);
      return false;
    }
  }

  private async completeInkEditTransactionNow(file: TFile, elements: InkElement[], pageIndexes: Set<number>): Promise<boolean> {
    const record = await this.readInkEditTransaction(file);
    if (!record) {
      return true;
    }
    const pagesToCommit = new Set(record.pageIndexes.filter((pageIndex) => pageIndexes.has(pageIndex)));
    if (pagesToCommit.size === 0) {
      return true;
    }
    const currentBytes = await this.app.vault.readBinary(file);
    try {
      const pdf = await PDFDocument.load(currentBytes, { ignoreEncryption: true, updateMetadata: false });
      removeAllInkAnnotationsOnPages(pdf, pagesToCommit);
      const pages = pdf.getPages();
      const strokes = elements.filter((element): element is InkStroke => (
        element.kind === "stroke" && pagesToCommit.has(element.pageIndex) && element.points.length >= 2
      ));
      for (const stroke of strokes) {
        const page = pages[stroke.pageIndex];
        if (!page || !addStandardInkAnnotation(pdf, page, stroke)) {
          throw new Error(`Could not write ink annotation for ${stroke.id}.`);
        }
      }
      const saved = await pdf.save({ addDefaultPage: false, useObjectStreams: false });
      const committedBytes = new ArrayBuffer(saved.byteLength);
      new Uint8Array(committedBytes).set(saved);
      await this.app.vault.modifyBinary(file, committedBytes);
      const verifyPdf = await PDFDocument.load(committedBytes, { ignoreEncryption: true, updateMetadata: false });
      const actual = extractPdfInkAnnotations(verifyPdf, pagesToCommit);
      for (const expected of strokes) {
        const match = actual.find((candidate) => (
          candidate.id === expected.id || isSamePdfInkStrokeCandidate(candidate, expected)
        ));
        if (!match || !inkPointsApproximatelyEqual(
          match.points,
          simplifyInkPoints(smoothInkPointsForPdf(expected.points, 1600), 900)
        )) {
          throw new Error(`Ink verification failed for ${expected.id}.`);
        }
      }
      if (actual.length !== strokes.length) {
        throw new Error(`Ink verification count mismatch: ${actual.length}/${strokes.length}.`);
      }
      const marked = elements.map((element) => {
        if (element.kind !== "stroke" || !pagesToCommit.has(element.pageIndex)) {
          return cloneElement(element);
        }
        return {
          ...element,
          externalDirty: false,
          pdfPoints: element.points.map((point) => ({ ...point })),
          pdfSaved: true,
          saved: true,
          source: "pdftion" as const
        };
      });
      await this.saveEditableAnnotationState(file, marked, committedBytes);
      const remainingPages = record.pageIndexes.filter((pageIndex) => !pagesToCommit.has(pageIndex));
      if (remainingPages.length === 0) {
        const committedRecord: PdfInkEditTransactionRecord = { ...record, phase: "committed" };
        await this.writeInkEditTransaction(file, committedRecord);
        try {
          await this.deleteInkEditTransaction(committedRecord);
        } catch (error) {
          console.warn("pdftion committed ink edits but could not remove all transaction backup files.", error);
        }
      } else {
        await this.writeInkEditTransaction(file, { ...record, pageIndexes: remainingPages });
      }
      return true;
    } catch (error) {
      console.error("pdftion could not commit the PDF ink edit transaction; restoring the backup.", error);
      await this.restoreInkEditTransaction(file, record, true);
      return false;
    }
  }

  async rollbackInkEditTransaction(file: TFile): Promise<boolean> {
    const record = await this.readInkEditTransaction(file);
    if (!record) {
      return true;
    }
    await this.restoreInkEditTransaction(file, record, true);
    return true;
  }

  async getInkEditTransactionPages(file: TFile): Promise<Set<number>> {
    const record = await this.readInkEditTransaction(file);
    return new Set(record?.phase === "editing" ? record.pageIndexes : []);
  }

  private getInkEditTransactionPath(filePath: string): string {
    return `${this.manifest.dir}/data/ink-edit-transactions/${safeAnnotationKey(filePath)}.json`;
  }

  private async readInkEditTransaction(file: TFile): Promise<PdfInkEditTransactionRecord | null> {
    try {
      const raw = await this.app.vault.adapter.read(this.getInkEditTransactionPath(file.path));
      const record = JSON.parse(raw) as Partial<PdfInkEditTransactionRecord>;
      if (
        record.version !== 1 || record.filePath !== file.path || typeof record.backupPdfPath !== "string" ||
        !Array.isArray(record.pageIndexes) || !record.pageIndexes.every((value) => Number.isInteger(value) && value >= 0)
      ) {
        return null;
      }
      return {
        annotationStateExisted: record.annotationStateExisted === true,
        backupAnnotationStatePath: typeof record.backupAnnotationStatePath === "string" ? record.backupAnnotationStatePath : undefined,
        backupPdfPath: record.backupPdfPath,
        filePath: record.filePath,
        pageIndexes: record.pageIndexes,
        phase: record.phase === "committed" ? "committed" : "editing",
        startedAt: typeof record.startedAt === "string" ? record.startedAt : "",
        version: 1
      };
    } catch {
      return null;
    }
  }

  private async readInkEditBackupElements(record: PdfInkEditTransactionRecord): Promise<InkElement[] | null> {
    if (!record.backupAnnotationStatePath) {
      return null;
    }
    try {
      const raw = await this.app.vault.adapter.read(record.backupAnnotationStatePath);
      const parsed = JSON.parse(raw) as { elements?: unknown };
      return Array.isArray(parsed.elements) ? parsed.elements.filter(isInkElement) : null;
    } catch {
      return null;
    }
  }

  private async writeInkEditTransaction(file: TFile, record: PdfInkEditTransactionRecord): Promise<void> {
    await this.ensureAdapterFolder(`${this.manifest.dir}/data/ink-edit-transactions`);
    await this.app.vault.adapter.write(this.getInkEditTransactionPath(file.path), JSON.stringify(record, null, 2));
  }

  private async deleteInkEditTransaction(record: PdfInkEditTransactionRecord): Promise<void> {
    const transactionPath = this.getInkEditTransactionPath(record.filePath);
    if (await this.app.vault.adapter.exists(transactionPath)) {
      await this.app.vault.adapter.remove(transactionPath);
    }
    if (await this.app.vault.adapter.exists(record.backupPdfPath)) {
      await this.app.vault.adapter.remove(record.backupPdfPath);
    }
    if (record.backupAnnotationStatePath && await this.app.vault.adapter.exists(record.backupAnnotationStatePath)) {
      await this.app.vault.adapter.remove(record.backupAnnotationStatePath);
    }
  }

  private async restoreInkEditTransaction(file: TFile, record: PdfInkEditTransactionRecord, removeRecord: boolean): Promise<void> {
    const backupBytes = await this.app.vault.adapter.readBinary(record.backupPdfPath);
    await this.app.vault.modifyBinary(file, backupBytes);
    const annotationStatePath = this.getAnnotationStatePath(file);
    if (record.annotationStateExisted && record.backupAnnotationStatePath) {
      const state = await this.app.vault.adapter.read(record.backupAnnotationStatePath);
      await this.app.vault.adapter.write(annotationStatePath, state);
    } else if (await this.app.vault.adapter.exists(annotationStatePath)) {
      await this.app.vault.adapter.remove(annotationStatePath);
    }
    if (removeRecord) {
      await this.deleteInkEditTransaction(record);
    }
  }

  private async recoverPendingInkEditTransactions(): Promise<void> {
    const dir = `${this.manifest.dir}/data/ink-edit-transactions`;
    let listing: { files?: string[] };
    try {
      listing = await this.app.vault.adapter.list(dir);
    } catch {
      return;
    }
    for (const path of listing.files ?? []) {
      if (!path.endsWith(".json")) {
        continue;
      }
      try {
        const raw = await this.app.vault.adapter.read(path);
        const record = JSON.parse(raw) as PdfInkEditTransactionRecord;
        const file = this.app.vault.getAbstractFileByPath(record.filePath);
        if (!(file instanceof TFile) || record.version !== 1 || typeof record.backupPdfPath !== "string") {
          continue;
        }
        if (record.phase === "committed") {
          await this.deleteInkEditTransaction(record);
          continue;
        }
        const elements = await this.readPendingInkEditElements(file);
        if (elements) {
          const committed = await this.finishInkEditTransaction(file, elements, new Set(record.pageIndexes));
          if (committed) {
            console.info(`pdftion completed interrupted PDF ink editing for ${file.path}.`);
            continue;
          }
        } else {
          await this.restoreInkEditTransaction(file, record, true);
        }
        console.info(`pdftion restored interrupted PDF ink editing for ${file.path}.`);
      } catch (error) {
        console.warn("pdftion could not recover an interrupted PDF ink transaction.", path, error);
      }
    }
  }

  private async readPendingInkEditElements(file: TFile): Promise<InkElement[] | null> {
    try {
      const raw = await this.app.vault.adapter.read(this.getAnnotationStatePath(file));
      const parsed = JSON.parse(raw) as { elements?: unknown };
      return Array.isArray(parsed.elements) ? parsed.elements.filter(isInkElement) : null;
    } catch {
      return null;
    }
  }

  private flushAllSessionsSoon(): void {
    for (const session of this.sessions.values()) {
      session.flushSoon();
    }
  }

  private flushSessionsOutsideLeaf(activeLeaf: WorkspaceLeaf | null): void {
    for (const session of this.sessions.values()) {
      if (!session.isForLeaf(activeLeaf)) {
        session.flushSoon();
      }
    }
  }

  private flushSessionsOutsideFile(activeFile: TFile | null): void {
    for (const session of this.sessions.values()) {
      if (!activeFile || session.getFilePath() !== activeFile.path) {
        session.flushSoon();
      }
    }
  }

  private checkpointAllSessionsSoon(): void {
    for (const session of this.sessions.values()) {
      session.checkpointSoon();
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
      exportAnnotationsHtml: () => this.getActivePdfSession()?.exportConvertedHtml() ?? Promise.resolve(null),
      exportAnnotationsMarkdown: () => this.getActivePdfSession()?.exportAnnotationsMarkdown() ?? Promise.resolve(null),
      exportAnnotationsPng: () => this.getActivePdfSession()?.exportConvertedPng() ?? Promise.resolve(null),
      exportAnnotationsPptx: () => this.getActivePdfSession()?.exportConvertedPptx() ?? Promise.resolve(null),
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

    new Setting(containerEl)
      .setName(uiText("界面语言", "Interface language"))
      .setDesc(uiText(
        "默认跟随 Obsidian。切换后立即生效；如果已打开的 PDF 仍有少量旧文字，请重新打开该 PDF。",
        "Follow Obsidian by default. Changes apply immediately; reopen an existing PDF if a few labels remain unchanged."
      ))
      .addDropdown((dropdown) => {
        for (const option of PDFTION_LANGUAGE_OPTIONS) {
          dropdown.addOption(
            option.value,
            option.value === "auto" ? uiText("跟随 Obsidian", "Follow Obsidian") : option.label
          );
        }
        dropdown
          .setValue(this.plugin.settings.language)
          .onChange(async (value) => {
            this.plugin.settings.language = normalizePdftionLanguageSetting(value);
            await this.plugin.saveSettings();
            this.display();
          });
      });

    this.addSection(uiText("导出", "Export"));
    new Setting(containerEl)
      .setName(uiText("导出后自动打开", "Open after export"))
      .setDesc(uiText("自动打开生成的 PDF、MD、DOCX、PPTX、PNG 或 HTML 文件。", "Automatically open generated PDF, MD, DOCX, PPTX, PNG, or HTML files."))
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
    key: Exclude<
      { [K in keyof PdftionSettings]: PdftionSettings[K] extends string ? K : never }[keyof PdftionSettings],
      "language" | "nativeTextSelectionAction"
    >
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
    language: normalizePdftionLanguageSetting(record.language),
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
    nativeTextSelectionAction: record.nativeTextSelectionAction === "copy" ? "copy" : "highlight",
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

function normalizePdftionLanguageSetting(value: unknown): PdftionLanguageSetting {
  if (value === "auto") {
    return "auto";
  }
  return typeof value === "string" ? normalizePdftionLocale(value) ?? DEFAULT_SETTINGS.language : DEFAULT_SETTINGS.language;
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
  private layerMenu: HTMLElement | null = null;
  private layerLongPressTimer: number | null = null;
  private layerLongPressStart: { clientX: number; clientY: number; elementId: string; pageIndex: number } | null = null;
  private layerLongPressTriggered = false;
  private textMenu: HTMLElement | null = null;
  private shareMenu: HTMLElement | null = null;
  private mutationObserver: MutationObserver;
  private hiddenNativeAnnotationStyles = new Map<HTMLElement, NativeAnnotationStyleSnapshot>();
  private pendingNativeInkHidePages = new Set<number>();
  private detachedInkEditPages = new Set<number>();
  private overlays = new Map<HTMLElement, PageOverlay>();
  private activeTouchId: number | null = null;
  private annotationLoadToken = 0;
  private annotationLoadPromise: Promise<void> | null = null;
  private checkpointPending = false;
  private checkpointing = false;
  private conversionInProgress = false;
  private exportRenderFallbackPages = new Set<number>();
  private preparingPdfInkForEditing = false;
  private pendingEditableInkPrepareAfterSave = false;
  private pendingSaveAfterCurrentSave = false;
  private finishingPdfInkEditing: Promise<boolean> | null = null;
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
  private externalInkLayerFrame: number | null = null;
  private visibleOverlayRefreshFrame: number | null = null;
  private zoomGeometryTimer: number | null = null;
  private inkPrepareTimer: number | null = null;
  private inkPrepareTimerForce = false;
  private nativeAnnotationPopupTimer: number | null = null;
  private nativePopupHideTimers = new Set<number>();
  private nativePopupSuppressUntil = 0;
  private recentInkGroup: RecentInkGroup | null = null;
  private selectionDrag: SelectionDragState | null = null;
  private nativeSelection: PdfNativeObject | null = null;
  private nativeInkScannedPages = new Set<number>();
  private pendingImageCrop: PdfNativeObject | null = null;
  private pageNavigator: HTMLElement | null = null;
  private commentManager: HTMLElement | null = null;
  private commentPopover: HTMLElement | null = null;
  private selectedPageIndexes = new Set<number>();
  private selectedStrokeIds = new Set<string>();
  private selectionChangedAt = 0;
  private dirtyInkPages = new Set<number>();
  private deletedExternalInkIds = new Set<string>();
  private deletedPdftionInkIds = new Set<string>();
  private nativeTextSelectionMenu: HTMLElement | null = null;
  private nativeTextSelectionInfo: NativeTextSelectionInfo | null = null;
  private nativeTextAutoHighlight: { createdIds: string[]; ids: string[]; key: string; pageIndex: number } | null = null;
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
  private nativeTextSelectionAction: "copy" | "highlight" = DEFAULT_SETTINGS.nativeTextSelectionAction;

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
          this.scheduleExternalInkLayerUpdate();
          this.scheduleEditableInkPrepare(320, true);
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
      this.scheduleScanPages(90);
      this.scheduleEditableInkPrepare(180);
      this.scheduleVisibleOverlayRefresh();
    }, {
      capture: true,
      passive: true,
      signal: this.nativeTextSelectionAbort.signal
    });
    activeDocument.addEventListener("scroll", () => {
      this.scheduleScanPages(90);
      this.scheduleEditableInkPrepare(180);
      this.scheduleVisibleOverlayRefresh();
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

  destroy(commitInk = true): void {
    if (!commitInk) {
      this.checkpointSoon();
    } else if (this.detachedInkEditPages.size > 0) {
      const file = this.file;
      const elements = this.getEditableElements().map(cloneElement);
      const pages = new Set(this.detachedInkEditPages);
      void this.plugin.finishInkEditTransaction(file, elements, pages);
    } else if (this.detachedInkEditPages.size === 0) {
      this.flushSoon();
    }
    this.destroyed = true;
    this.enabled = false;
    this.restoreHiddenNativeInkAnnotations();
    this.clearAutoSaveTimer();
    this.clearToolSettingsSaveTimer();
    this.clearScanTimer();
    this.clearEditableInkPrepareTimer();
    this.clearZoomGeometryTimer();
    if (this.externalInkLayerFrame !== null) {
      window.cancelAnimationFrame(this.externalInkLayerFrame);
      this.externalInkLayerFrame = null;
    }
    if (this.visibleOverlayRefreshFrame !== null) {
      window.cancelAnimationFrame(this.visibleOverlayRefreshFrame);
      this.visibleOverlayRefreshFrame = null;
    }
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
    this.commentManager?.remove();
    this.commentPopover?.remove();
    this.imageMenu?.remove();
    this.clearLayerLongPress();
    this.layerMenu?.remove();
    this.textMenu?.remove();
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
      if (overlay.geometryFrame !== null && overlay.geometryFrame !== undefined) {
        window.cancelAnimationFrame(overlay.geometryFrame);
      }
      if (overlay.resizeTimer !== null && overlay.resizeTimer !== undefined) {
        window.clearTimeout(overlay.resizeTimer);
      }
      overlay.canvas.remove();
      overlay.staticCanvas.remove();
      overlay.pageEl.classList.remove("pdftion-page", "pdftion-hide-native-ink-layer");
    }
    this.overlays.clear();
    this.imageCache.clear();
    this.pendingImageCrop = null;
    this.rootEl.classList.remove("pdftion-enabled", "pdftion-root", "pdftion-selecting");
    this.plugin.refreshGlobalEditingClass();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isForLeaf(leaf: WorkspaceLeaf | null): boolean {
    return leaf === this.leaf;
  }

  updateFile(file: TFile): void {
    if (file.path === this.file.path) {
      return;
    }

    const previousFile = this.file;
    const previousPages = new Set(this.detachedInkEditPages);
    const previousElements = this.getEditableElements().map(cloneElement);
    if (previousPages.size > 0) {
      void this.plugin.finishInkEditTransaction(previousFile, previousElements, previousPages);
    } else {
      this.flushSoon();
    }
    this.restoreHiddenNativeInkAnnotations();
    this.closeNativeTextEditor(false);
    this.clearOverlayCanvases();
    this.file = file;
    this.clearAutoSaveTimer();
    this.clearEditableInkPrepareTimer();
    this.clearCurrentStroke();
    this.currentCover = null;
    this.recentInkGroup = null;
    this.activeTouchId = null;
    this.touchScroll = null;
    this.dirty = false;
    this.cropByPage.clear();
    this.cropPreview = null;
    this.imageCache.clear();
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
    this.selectedPageIndexes.clear();
    this.savedInkIsBurnedIntoPdf = false;
    this.savedTextIsBurnedIntoPdf = false;
    this.lastTap = null;
    this.nativeTextAutoHighlight = null;
    this.strokeHistory = [];
    this.textHistory = [];
    this.coverHistory = [];
    this.imageHistory = [];
    this.nativeInkScannedPages.clear();
    this.clearLayerLongPress();
    this.layerMenu?.remove();
    this.layerMenu = null;
    this.textMenu?.remove();
    this.textMenu = null;
    this.commentManager?.remove();
    this.commentManager = null;
    this.commentPopover?.remove();
    this.commentPopover = null;
    this.pageNavigator?.remove();
    this.pageNavigator = null;
    this.detachedInkEditPages.clear();
    this.loadedAnnotationState = false;
    this.annotationLoadToken += 1;
    this.annotationLoadPromise = null;
    void this.loadEditableAnnotations();
    this.redrawAll();
  }

  private clearOverlayCanvases(): void {
    for (const overlay of this.overlays.values()) {
      overlay.staticCanvas.width = overlay.staticCanvas.width;
      overlay.canvas.width = overlay.canvas.width;
    }
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
    const pdfInkStrokes: InkStroke[] = [];
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
    const transactionPages = await this.plugin.getInkEditTransactionPages(this.file);
    if (loadToken !== this.annotationLoadToken || this.file.path !== filePath) {
      return;
    }
    this.detachedInkEditPages = transactionPages;
    this.savedInkIsBurnedIntoPdf = state !== null && !state.overlayAnnotationsOnly && this.strokeHistory.some((stroke) => !Array.isArray(stroke.pdfPoints));
    this.savedTextIsBurnedIntoPdf = state !== null && !state.overlayAnnotationsOnly && !state.overlayTextOnly && this.textHistory.length > 0;
    if (this.savedInkIsBurnedIntoPdf || this.savedTextIsBurnedIntoPdf) {
      this.dirty = true;
      this.scheduleAutoSave(250);
    }
    this.loadedAnnotationState = true;
    this.redrawAll();
    this.refreshCommentManager();
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
    const viewportCenter = activeWindow.innerHeight / 2;
    const retainedPages = pageEls
      .map((pageEl, index) => {
        const rect = pageEl.getBoundingClientRect();
        return { distance: Math.abs((rect.top + rect.bottom) / 2 - viewportCenter), index, pageEl };
      })
      .filter((item) => this.isPageElementNearViewport(item.pageEl))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 12);
    const retainedElements = new Set(retainedPages.map((item) => item.pageEl));
    for (const item of retainedPages) {
      this.ensureOverlay(item.pageEl, item.index);
    }
    this.cleanupUnretainedOverlays(retainedElements);

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
    if (node.closest(".pdftion-toolbar-host, .pdftion-toolbar, .pdftion-palette-panel, .pdftion-image-menu, .pdftion-text-menu, .pdftion-share-menu, .pdftion-comment-popover, .pdftion-embed-actions, .pdftion-inline-actions")) {
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
    const visibleCandidates = candidates.filter((candidate) => {
      if (unique.has(candidate)) {
        return false;
      }
      unique.add(candidate);
      return candidate.clientWidth > 0 && candidate.clientHeight > 0;
    });

    if (visibleCandidates.length === 0) {
      // Cancip's document workbench renders the visible PDF page into NoteDraw's
      // static canvas instead of exposing PDF.js .page elements.
      const canvas = this.rootEl.querySelector<HTMLCanvasElement>(
        ".notedraw-static-canvas:not(.pdftion-canvas), canvas:not(.pdftion-canvas)"
      );
      const stage = canvas?.parentElement;
      if (canvas && stage && canvas.width > 1 && canvas.height > 1 && stage.clientWidth > 0 && stage.clientHeight > 0) {
        return [stage];
      }
    }

    return visibleCandidates;
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
        geometryFrame: null,
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
    if (overlay.geometryFrame === null || overlay.geometryFrame === undefined) {
      overlay.geometryFrame = window.requestAnimationFrame(() => {
        overlay.geometryFrame = null;
        if (overlay.pageEl.isConnected) {
          this.syncOverlayCssGeometry(overlay);
        }
      });
    }
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

  private scheduleVisibleOverlayRefresh(): void {
    if (this.visibleOverlayRefreshFrame !== null) {
      return;
    }
    this.visibleOverlayRefreshFrame = window.requestAnimationFrame(() => {
      this.visibleOverlayRefreshFrame = null;
      this.refreshVisibleOverlays();
    });
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
      this.clearLayerLongPress();
      this.layerMenu?.remove();
      this.layerMenu = null;
      this.imageMenu?.remove();
      this.imageMenu = null;
      this.textMenu?.remove();
      this.textMenu = null;
      this.shareMenu?.remove();
      this.shareMenu = null;
      this.commentManager?.remove();
      this.commentManager = null;
      this.commentPopover?.remove();
      this.commentPopover = null;
      this.toolbar?.remove();
      this.toolbar = null;
      void this.finishPdfInkEditing();
      this.redrawAll();
    }
  }

  private async prepareEditableInkForCurrentPage(force = false): Promise<void> {
    try {
      if (this.conversionInProgress) {
        return;
      }
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
      await this.preparePdfInkOverlayForEditing(pageIndexes);
    } catch (error) {
      console.warn("pdftion could not prepare PDF ink for editable mode.", error);
    }
  }

  private scheduleEditableInkPrepare(delay = 160, force = false): void {
    if (!this.enabled || this.conversionInProgress) {
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
    const candidates: Array<{ overlay: PageOverlay; visibleHeight: number }> = [];
    for (const overlay of this.overlays.values()) {
      const rect = overlay.pageEl.getBoundingClientRect();
      if (rect.bottom >= -margin && rect.top <= viewportHeight + margin) {
        candidates.push({
          overlay,
          visibleHeight: Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0))
        });
      }
    }
    const best = candidates.sort((a, b) => (
      b.visibleHeight - a.visibleHeight || a.overlay.pageIndex - b.overlay.pageIndex
    ))[0]?.overlay;
    if (best) {
      pages.add(best.pageIndex);
    } else {
      const overlay = this.getVisibleOverlay() ?? Array.from(this.overlays.values()).sort((a, b) => a.pageIndex - b.pageIndex)[0];
      if (overlay) {
        pages.add(overlay.pageIndex);
      }
    }
    return pages;
  }

  private async preparePdfInkOverlayForEditing(pageIndexes: Set<number>): Promise<void> {
    if (pageIndexes.size === 0 || this.preparingPdfInkForEditing) {
      return;
    }

    this.preparingPdfInkForEditing = true;
    let transactionActive = false;
    try {
      if (this.detachedInkEditPages.size > 0) {
        const alreadyPrepared = Array.from(pageIndexes).every((pageIndex) => this.detachedInkEditPages.has(pageIndex));
        if (alreadyPrepared) {
          return;
        }
        if (!await this.commitDetachedInkPages(new Set(this.detachedInkEditPages))) {
          return;
        }
      }
      for (const pageIndex of pageIndexes) {
        this.pendingNativeInkHidePages.add(pageIndex);
      }
      this.updateExternalInkLayerState();
      await this.importPdfInkForPages();
      const hasNativeInk = this.strokeHistory.some((stroke) => stroke.pdfSaved === true);
      if (!hasNativeInk) {
        for (const pageIndex of pageIndexes) {
          this.pendingNativeInkHidePages.delete(pageIndex);
        }
        this.updateExternalInkLayerState();
        return;
      }
      const sourceBytes = await this.plugin.app.vault.readBinary(this.file);
      await this.plugin.saveEditableAnnotationState(this.file, this.getEditableElements().map(cloneElement), sourceBytes);
      await this.plugin.beginInkEditTransaction(this.file, pageIndexes);
      transactionActive = true;
      const detachedBytes = await this.plugin.app.vault.readBinary(this.file);
      await this.plugin.saveEditableAnnotationState(this.file, this.getEditableElements().map(cloneElement), detachedBytes);
      await this.reloadNativePdfView();
      this.detachedInkEditPages = await this.plugin.getInkEditTransactionPages(this.file);
      for (const pageIndex of this.detachedInkEditPages) {
        this.pendingNativeInkHidePages.delete(pageIndex);
      }
      this.updateExternalInkLayerState();
      this.redrawAll();
    } catch (error) {
      console.warn("pdftion could not prepare PDF ink annotations for editing.", error);
      if (transactionActive) {
        try {
          await this.plugin.rollbackInkEditTransaction(this.file);
          await this.reloadEditableAnnotationsAfterInkRollback();
        } catch (rollbackError) {
          console.error("pdftion could not roll back the failed ink edit preparation.", rollbackError);
        }
      }
      for (const pageIndex of pageIndexes) {
        this.pendingNativeInkHidePages.delete(pageIndex);
      }
      this.updateExternalInkLayerState();
    } finally {
      this.preparingPdfInkForEditing = false;
    }
  }

  private async commitDetachedInkPages(pageIndexes = new Set(this.detachedInkEditPages)): Promise<boolean> {
    if (pageIndexes.size === 0) {
      return true;
    }
    if (this.finishingPdfInkEditing) {
      return this.finishingPdfInkEditing;
    }
    const targetFile = this.file;
    const targetPath = targetFile.path;
    const elements = this.getEditableElements().map(cloneElement);
    this.clearAutoSaveTimer();
    this.finishingPdfInkEditing = this.plugin.finishInkEditTransaction(targetFile, elements, pageIndexes)
      .then(async (committed) => {
        if (this.file.path !== targetPath) {
          return committed;
        }
        if (!committed) {
          await this.reloadEditableAnnotationsAfterInkRollback();
          return false;
        }
        for (const stroke of this.strokeHistory) {
          if (!pageIndexes.has(stroke.pageIndex)) {
            continue;
          }
          stroke.externalDirty = false;
          stroke.pdfPoints = stroke.points.map((point) => ({ ...point }));
          stroke.pdfSaved = true;
          stroke.saved = true;
          stroke.source = "pdftion";
        }
        for (const pageIndex of pageIndexes) {
          this.detachedInkEditPages.delete(pageIndex);
          this.pendingNativeInkHidePages.delete(pageIndex);
          this.dirtyInkPages.delete(pageIndex);
        }
        if (this.dirtyInkPages.size === 0) {
          this.deletedExternalInkIds.clear();
          this.deletedPdftionInkIds.clear();
        }
        this.dirty = this.getEditableElements().some((element) => !element.saved);
        this.updateExternalInkLayerState();
        this.redrawAll();
        await this.reloadNativePdfView();
        this.scheduleQuietScan();
        return true;
      })
      .finally(() => {
        this.finishingPdfInkEditing = null;
      });
    return this.finishingPdfInkEditing;
  }

  private async finishPdfInkEditing(): Promise<boolean> {
    this.clearEditableInkPrepareTimer();
    this.commitNativeTextEditor();
    if (this.detachedInkEditPages.size > 0) {
      const committed = await this.commitDetachedInkPages(new Set(this.detachedInkEditPages));
      if (!committed) {
        return false;
      }
    }
    if (this.hasPendingPdfWrite()) {
      await this.saveIntoPdf(true);
    }
    return true;
  }

  private async reloadEditableAnnotationsAfterInkRollback(): Promise<void> {
    this.detachedInkEditPages.clear();
    this.pendingNativeInkHidePages.clear();
    this.dirtyInkPages.clear();
    this.deletedExternalInkIds.clear();
    this.deletedPdftionInkIds.clear();
    this.strokeHistory = [];
    this.textHistory = [];
    this.coverHistory = [];
    this.imageHistory = [];
    this.loadedAnnotationState = false;
    this.annotationLoadToken += 1;
    this.annotationLoadPromise = null;
    await this.loadEditableAnnotations();
    await this.reloadNativePdfView();
    this.updateExternalInkLayerState();
    this.redrawAll();
  }

  private async reloadNativePdfView(): Promise<void> {
    const view = this.leaf.view as unknown as PdfViewLike;
    if (view.file?.path !== this.file.path || typeof view.onLoadFile !== "function") {
      return;
    }
    try {
      await view.onLoadFile(this.file);
    } catch (error) {
      console.debug("pdftion could not reload the current PDF view after an ink transaction.", error);
    }
  }

  private async importPdfInkForPages(pageIndexes?: Set<number>): Promise<boolean> {
    if (pageIndexes?.size === 0) {
      return false;
    }
    const pagesToScan = pageIndexes
      ? new Set(Array.from(pageIndexes).filter((pageIndex) => !this.nativeInkScannedPages.has(pageIndex)))
      : undefined;
    if (pagesToScan?.size === 0) {
      return false;
    }
    const targetPath = this.file.path;
    const pdfInkStrokes = await this.plugin.loadPdfInkAnnotations(this.file, pagesToScan);
    if (this.file.path !== targetPath) {
      return false;
    }
    for (const pageIndex of pagesToScan ?? []) {
      this.nativeInkScannedPages.add(pageIndex);
    }
    if (pdfInkStrokes.length === 0) {
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
    text.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.tool !== "text" && this.tool !== "comment") {
        this.setTool("text");
      }
      this.toggleTextMenu();
    });
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
    this.toolbar.querySelector<HTMLElement>(".pdftion-text-button")?.classList.toggle("is-active", this.tool === "text" || this.tool === "comment");
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
    if (this.tool === "text" || this.tool === "comment" || this.hasSelectedText()) {
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
    this.textMenu?.remove();
    this.textMenu = null;
    this.shareMenu?.remove();
    this.shareMenu = null;
    if (this.palette?.isConnected) {
      this.showPalette();
    }
    this.updateToolbarState();
  }

  private toggleTextMenu(): void {
    if (this.textMenu?.isConnected) {
      this.textMenu.remove();
      this.textMenu = null;
      return;
    }
    this.imageMenu?.remove();
    this.imageMenu = null;
    this.shareMenu?.remove();
    this.shareMenu = null;
    this.showTextMenu();
  }

  private showTextMenu(): void {
    this.textMenu?.remove();
    const button = this.toolbar?.querySelector<HTMLElement>(".pdftion-text-button");
    const panel = activeDocument.createElement("div");
    panel.className = "pdftion-text-menu";

    const text = createIconButton("type", uiText("文字", "Text"));
    text.classList.add("pdftion-text-menu-button");
    text.addEventListener("click", () => {
      panel.remove();
      this.textMenu = null;
      this.setTool("text");
    });
    panel.appendChild(text);

    const comment = createIconButton("message-square-text", uiText("批注", "Comment"));
    comment.classList.add("pdftion-text-menu-button");
    comment.addEventListener("click", () => {
      panel.remove();
      this.textMenu = null;
      this.setTool("comment");
      new Notice(uiText("点击页面添加批注。", "Click the page to add a comment."));
    });
    panel.appendChild(comment);

    const manage = createIconButton("list-tree", uiText("批注管理", "Comment manager"));
    manage.classList.add("pdftion-text-menu-button");
    manage.addEventListener("click", () => {
      panel.remove();
      this.textMenu = null;
      this.showCommentManager();
    });
    panel.appendChild(manage);

    appendToActiveBody(panel);
    const rect = button?.getBoundingClientRect();
    const fallbackTop = Math.max(76, (this.toolbarHost?.getBoundingClientRect().bottom ?? 68) + 6);
    panel.setCssStyles({
      left: `${Math.min(activeWindow.innerWidth - 150, Math.max(8, rect ? rect.left : 16))}px`,
      top: `${Math.min(activeWindow.innerHeight - 96, Math.max(8, rect ? rect.bottom + 6 : fallbackTop))}px`
    });
    this.textMenu = panel;
  }

  private toggleImageMenu(): void {
    if (this.imageMenu?.isConnected) {
      this.imageMenu.remove();
      this.imageMenu = null;
      return;
    }
    this.shareMenu?.remove();
    this.shareMenu = null;
    this.textMenu?.remove();
    this.textMenu = null;
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
    this.textMenu?.remove();
    this.textMenu = null;
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

    const png = createIconButton("image", uiText("导出 PNG", "Export PNG"));
    png.classList.add("pdftion-share-menu-button");
    png.addEventListener("click", () => {
      panel.remove();
      this.shareMenu = null;
      void this.exportConvertedPng();
    });
    panel.appendChild(png);

    const pptx = createIconButton("presentation", uiText("导出 PPTX", "Export PPTX"));
    pptx.classList.add("pdftion-share-menu-button");
    pptx.addEventListener("click", () => {
      panel.remove();
      this.shareMenu = null;
      void this.exportConvertedPptx();
    });
    panel.appendChild(pptx);

    const html = createIconButton("file-code-2", uiText("导出 HTML", "Export HTML"));
    html.classList.add("pdftion-share-menu-button");
    html.addEventListener("click", () => {
      panel.remove();
      this.shareMenu = null;
      void this.exportConvertedHtml();
    });
    panel.appendChild(html);

    appendToActiveBody(panel);
    const rect = button?.getBoundingClientRect();
    const fallbackTop = Math.max(76, (this.toolbarHost?.getBoundingClientRect().bottom ?? 68) + 6);
    panel.setCssStyles({
      left: `${Math.min(activeWindow.innerWidth - 232, Math.max(8, rect ? rect.left : 16))}px`,
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
      this.clearLayerLongPress();
      return;
    }
    overlay.canvas.setPointerCapture(event.pointerId);
    const hitElement = this.findElementAt(overlay, point);
    this.startLayerLongPress(overlay, point, event.clientX, event.clientY, hitElement);
    this.beginInkInteraction(point, overlay, hitElement);
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
    const element = this.findElementAt(overlay, point);
    if (element?.kind === "text") {
      this.clearCurrentStroke();
      this.currentCover = null;
      this.selectionDrag = null;
      this.setSingleSelectedElement(element.id);
      this.nativeSelection = null;
      if (element.presentation === "comment") {
        void this.editCommentAnnotation(element);
      } else {
        this.openExistingTextEditor(element, overlay);
      }
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

  private beginInkInteraction(point: InkPoint, overlay: PageOverlay, hitElement = this.findElementAt(overlay, point)): void {
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
    const selectedElements = this.getSelectedEditableElements(overlay.pageIndex);
    const selectionBounds = normalizedElementsBounds(selectedElements);
    const selectionHandle = selectionBounds ? this.findSelectionHandleAt(overlay, point, selectionBounds) : null;
    const startsInsideEditableSelection = selectionHandle !== null || (selectionBounds !== null && this.selectionBoxContainsPoint(overlay, point, selectionBounds));
    const canDragSelection =
      tool !== "eraser" &&
      tool !== "cover" &&
      !drawingTool &&
      selectedElements.length > 0 &&
      startsInsideEditableSelection &&
      this.canDragSelectedElements(overlay.pageIndex, selectedElements);
    if (canDragSelection) {
      this.beginSelectionInteraction(point, overlay, hitElement, selectedElements, selectionBounds, selectionHandle);
      return;
    }

    if (hitElement?.kind === "text" && hitElement.presentation === "comment" && tool !== "eraser" && tool !== "cover") {
      this.setSingleSelectedElement(hitElement.id);
      this.showCommentPopover(hitElement, overlay);
      this.redrawAll();
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
      this.beginSelectionInteraction(point, overlay, hitElement, selectedElements, selectionBounds, selectionHandle);
      return;
    }

    if (tool === "select") {
      this.beginSelectionInteraction(point, overlay, hitElement, selectedElements, selectionBounds, selectionHandle);
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

    if (tool === "comment") {
      void this.addCommentAnnotation(point, overlay);
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

  private async addCommentAnnotation(point: InkPoint, overlay: PageOverlay): Promise<void> {
    const targetPath = this.file.path;
    const content = await showPromptModal({
      actionLabel: uiText("添加", "Add"),
      message: uiText("输入批注内容。", "Enter the comment content."),
      title: uiText("添加批注", "Add comment")
    });
    if (!content || this.destroyed || this.file.path !== targetPath) {
      return;
    }
    const comment: InkText = {
      color: this.textColor,
      createdAt: Date.now(),
      fontFamily: this.textFontFamily,
      fontSize: this.textFontSize,
      id: makeStrokeId(),
      kind: "text",
      opacity: 1,
      pageCssHeight: overlay.cssHeight,
      pageCssWidth: overlay.cssWidth,
      pageIndex: overlay.pageIndex,
      presentation: "comment",
      saved: false,
      text: content,
      x: point.x,
      y: point.y,
      zIndex: this.getNextLayerIndex(overlay.pageIndex)
    };
    this.rememberHistory();
    this.textHistory.push(comment);
    this.redoStack = [];
    this.setSingleSelectedElement(comment.id);
    this.markDirty();
    this.redrawOverlay(overlay);
    this.scheduleAutoSave();
    this.refreshCommentManager();
    this.showCommentPopover(comment, overlay);
  }

  private async editCommentAnnotation(comment: InkText): Promise<void> {
    if (comment.presentation !== "comment") {
      return;
    }
    const content = await showPromptModal({
      actionLabel: uiText("保存", "Save"),
      defaultValue: comment.text,
      message: uiText("修改批注内容。", "Edit the comment content."),
      title: uiText("编辑批注", "Edit comment")
    });
    if (!content || content === comment.text || !this.findElementById(comment.id)) {
      return;
    }
    this.rememberHistory();
    comment.text = content;
    comment.saved = false;
    this.markDirty();
    this.redrawAll();
    this.scheduleAutoSave();
    this.refreshCommentManager();
    const overlay = this.findOverlayByPageIndex(comment.pageIndex);
    if (overlay) {
      this.showCommentPopover(comment, overlay);
    }
  }

  private deleteCommentAnnotation(comment: InkText): void {
    if (comment.presentation !== "comment" || !this.findElementById(comment.id)) {
      return;
    }
    this.rememberHistory();
    this.removeElementById(comment.id);
    this.selectedStrokeIds.delete(comment.id);
    this.commentPopover?.remove();
    this.commentPopover = null;
    this.markDirty();
    this.redrawAll();
    this.scheduleAutoSave();
    this.refreshCommentManager();
  }

  private showCommentPopover(comment: InkText, overlay: PageOverlay): void {
    this.commentPopover?.remove();
    const panel = activeDocument.createElement("div");
    panel.className = "pdftion-comment-popover";
    panel.addEventListener("pointerdown", (event) => event.stopPropagation());
    panel.addEventListener("click", (event) => event.stopPropagation());

    const header = activeDocument.createElement("div");
    header.className = "pdftion-comment-popover-header";
    const page = activeDocument.createElement("span");
    page.textContent = uiText(`第 ${comment.pageIndex + 1} 页批注`, `Page ${comment.pageIndex + 1} comment`);
    header.appendChild(page);
    const close = createIconButton("x", uiText("关闭", "Close"));
    close.addEventListener("click", () => {
      panel.remove();
      this.commentPopover = null;
    });
    header.appendChild(close);
    panel.appendChild(header);

    const content = activeDocument.createElement("div");
    content.className = "pdftion-comment-content";
    content.textContent = comment.text;
    panel.appendChild(content);

    const actions = activeDocument.createElement("div");
    actions.className = "pdftion-comment-actions";
    const edit = createIconButton("pencil", uiText("编辑批注", "Edit comment"));
    edit.addEventListener("click", () => void this.editCommentAnnotation(comment));
    actions.appendChild(edit);
    const remove = createIconButton("trash-2", uiText("删除批注", "Delete comment"));
    remove.addEventListener("click", () => this.deleteCommentAnnotation(comment));
    actions.appendChild(remove);
    panel.appendChild(actions);

    appendToActiveBody(panel);
    const overlayRect = this.getOverlayClientRect(overlay);
    const iconX = overlayRect.left + comment.x * overlay.cssWidth;
    const iconY = overlayRect.top + comment.y * overlay.cssHeight;
    panel.setCssStyles({
      left: `${clamp(iconX + 18, 8, Math.max(8, activeWindow.innerWidth - 292))}px`,
      top: `${clamp(iconY - 8, 8, Math.max(8, activeWindow.innerHeight - 220))}px`
    });
    this.commentPopover = panel;
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
    const noColor = createIconButton("ban", uiText("无色", "No highlight"));
    noColor.classList.add("pdftion-native-selection-color", "pdftion-native-selection-color-none");
    noColor.addEventListener("click", () => this.applyNativeTextNoHighlight());
    colorRow.appendChild(noColor);
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
    this.nativeTextAutoHighlight = null;
  }

  private applyNativeTextHighlight(color: string): void {
    const info = this.nativeTextSelectionInfo;
    if (!info) {
      return;
    }

    const normalizedColor = normalizeHexColor(color);
    this.nativeTextHighlightColor = normalizedColor;
    this.nativeTextSelectionAction = "highlight";
    this.scheduleToolSettingsSave();
    const selectionKey = this.getNativeTextSelectionKey(info);
    const pending = this.nativeTextAutoHighlight?.key === selectionKey ? this.nativeTextAutoHighlight : null;
    const collapsed = this.collapseNativeTextHighlightCovers(info, this.findNativeTextHighlightCovers(info));
    const pendingCovers = collapsed.kept;

    if (pendingCovers.length === 0) {
      this.ensureNativeTextAutoHighlight(info, normalizedColor);
    } else if (collapsed.duplicates.length > 0 || pendingCovers.some((cover) => normalizeHexColor(cover.color) !== normalizedColor)) {
      this.rememberHistory();
      const duplicateIds = new Set(collapsed.duplicates.map((cover) => cover.id));
      this.coverHistory = this.coverHistory.filter((cover) => !duplicateIds.has(cover.id));
      for (const cover of pendingCovers) {
        cover.color = normalizedColor;
        cover.saved = false;
      }
      this.redoStack = [];
      this.markDirty();
      this.redrawOverlay(info.overlay);
      this.scheduleAutoSave();
    }
    const currentCovers = this.findNativeTextHighlightCovers(info);
    this.nativeTextAutoHighlight = {
      createdIds: pending?.createdIds ?? currentCovers.map((cover) => cover.id),
      ids: currentCovers.map((cover) => cover.id),
      key: selectionKey,
      pageIndex: info.overlay.pageIndex
    };

    activeDocument.getSelection()?.removeAllRanges();
    this.hideNativeTextSelectionMenu();
  }

  private applyNativeTextNoHighlight(): void {
    const info = this.nativeTextSelectionInfo;
    if (!info) {
      return;
    }
    this.nativeTextSelectionAction = "copy";
    this.scheduleToolSettingsSave();
    const covers = this.findNativeTextHighlightCovers(info);
    if (covers.length > 0) {
      this.rememberHistory();
      const ids = new Set(covers.map((cover) => cover.id));
      this.coverHistory = this.coverHistory.filter((cover) => !ids.has(cover.id));
      this.redoStack = [];
      this.markDirty();
      this.redrawOverlay(info.overlay);
      this.scheduleAutoSave();
    }
    this.nativeTextAutoHighlight = null;
    activeDocument.getSelection()?.removeAllRanges();
    this.hideNativeTextSelectionMenu();
  }

  private ensureNativeTextAutoHighlight(info: NativeTextSelectionInfo, color = this.nativeTextHighlightColor): void {
    const selectionKey = this.getNativeTextSelectionKey(info);
    const collapsed = this.collapseNativeTextHighlightCovers(info, this.findNativeTextHighlightCovers(info));
    const existing = collapsed.kept;
    const missing = info.objects.filter((object) => !existing.some((cover) => this.nativeTextHighlightMatchesObject(cover, object, info.overlay)));
    if (missing.length === 0 && collapsed.duplicates.length === 0) {
      this.nativeTextAutoHighlight = {
        createdIds: [],
        ids: existing.map((cover) => cover.id),
        key: selectionKey,
        pageIndex: info.overlay.pageIndex
      };
      return;
    }

    this.rememberHistory();
    const duplicateIds = new Set(collapsed.duplicates.map((cover) => cover.id));
    this.coverHistory = this.coverHistory.filter((cover) => !duplicateIds.has(cover.id));
    const normalizedColor = normalizeHexColor(color);
    const createdIds = missing.map((object) => {
      const id = makeStrokeId();
      this.coverHistory.push({
        color: normalizedColor,
        height: object.height,
        id,
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
      return id;
    });
    this.nativeTextAutoHighlight = {
      createdIds,
      ids: [...existing.map((cover) => cover.id), ...createdIds],
      key: selectionKey,
      pageIndex: info.overlay.pageIndex
    };
    this.redoStack = [];
    this.markDirty();
    this.redrawOverlay(info.overlay);
    this.scheduleAutoSave();
  }

  private findNativeTextHighlightCovers(info: NativeTextSelectionInfo): InkCover[] {
    return this.coverHistory.filter((cover) => (
      cover.pageIndex === info.overlay.pageIndex &&
      cover.source === "native-text" &&
      cover.opacity < 0.9 &&
      info.objects.some((object) => this.nativeTextHighlightMatchesObject(cover, object, info.overlay))
    ));
  }

  private collapseNativeTextHighlightCovers(
    info: NativeTextSelectionInfo,
    covers: InkCover[]
  ): { duplicates: InkCover[]; kept: InkCover[] } {
    const keptByObject = new Map<number, InkCover>();
    const duplicates: InkCover[] = [];
    for (const cover of covers) {
      const objectIndex = info.objects.findIndex((object) => this.nativeTextHighlightMatchesObject(cover, object, info.overlay));
      if (objectIndex < 0) {
        continue;
      }
      const previous = keptByObject.get(objectIndex);
      if (previous) {
        duplicates.push(previous);
      }
      keptByObject.set(objectIndex, cover);
    }
    return {
      duplicates,
      kept: Array.from(keptByObject.entries()).sort((a, b) => a[0] - b[0]).map(([, cover]) => cover)
    };
  }

  private nativeTextHighlightMatchesObject(cover: InkCover, object: PdfNativeObject, overlay: PageOverlay): boolean {
    const toleranceX = Math.max(3 / Math.max(1, overlay.cssWidth), 0.002);
    const toleranceY = Math.max(3 / Math.max(1, overlay.cssHeight), 0.002);
    const coverRight = cover.x + cover.width;
    const coverBottom = cover.y + cover.height;
    const objectRight = object.x + object.width;
    const objectBottom = object.y + object.height;
    const overlapWidth = Math.max(0, Math.min(coverRight, objectRight) - Math.max(cover.x, object.x));
    const overlapHeight = Math.max(0, Math.min(coverBottom, objectBottom) - Math.max(cover.y, object.y));
    const horizontalOverlap = overlapWidth / Math.max(toleranceX, Math.min(cover.width, object.width));
    const verticalOverlap = overlapHeight / Math.max(toleranceY, Math.min(cover.height, object.height));
    return horizontalOverlap >= 0.55 && verticalOverlap >= 0.6;
  }

  private getNativeTextSelectionKey(info: NativeTextSelectionInfo): string {
    const geometry = info.objects
      .map((object) => [object.x, object.y, object.width, object.height].map((value) => value.toFixed(5)).join(","))
      .join(";");
    return `${info.overlay.pageIndex}:${geometry}:${info.text}`;
  }

  private prepareNativeTextCopy(info: NativeTextSelectionInfo): void {
    this.nativeTextSelectionAction = "copy";
    this.scheduleToolSettingsSave();
    const pending = this.nativeTextAutoHighlight;
    if (!pending || pending.key !== this.getNativeTextSelectionKey(info)) {
      return;
    }

    const ids = new Set(pending.createdIds);
    if (this.coverHistory.some((cover) => ids.has(cover.id))) {
      this.rememberHistory();
      this.coverHistory = this.coverHistory.filter((cover) => !ids.has(cover.id));
      this.redoStack = [];
      this.markDirty();
      this.redrawOverlay(info.overlay);
      this.scheduleAutoSave();
    }
    this.nativeTextAutoHighlight = null;
  }

  private async copyNativeTextSelectionLink(): Promise<void> {
    const info = this.nativeTextSelectionInfo;
    if (!info) {
      return;
    }

    this.prepareNativeTextCopy(info);
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

    this.prepareNativeTextCopy(info);
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
    const viewer = this.getNativePdfViewerApp()?.pdfViewer;
    const pageViewCanvas = viewer?.getPageView?.(overlay.pageIndex)?.canvas ?? viewer?._pages?.[overlay.pageIndex]?.canvas ?? null;
    const wrappedCanvas = overlay.pageEl.querySelector<HTMLCanvasElement>(
      ".canvasWrapper canvas:not(.pdftion-canvas), .notedraw-static-canvas:not(.pdftion-canvas)"
    );
    const candidates = Array.from(new Set([
      pageViewCanvas,
      wrappedCanvas,
      overlay.observedCanvas ?? null,
      ...Array.from(overlay.pageEl.querySelectorAll<HTMLCanvasElement>("canvas"))
    ].filter((canvas): canvas is HTMLCanvasElement => (
      canvas !== null &&
      !canvas.classList.contains("pdftion-canvas") &&
      canvas.closest(".annotationLayer, .annotationEditorLayer") === null
    ))));
    return candidates
      .filter((canvas) => canvas.width > 1 && canvas.height > 1)
      .sort((a, b) => {
        const score = (canvas: HTMLCanvasElement): number => {
          const nativePriority = canvas === pageViewCanvas ? 1_000_000_000 : 0;
          const wrapperPriority = canvas === wrappedCanvas || canvas.closest(".canvasWrapper") !== null ? 100_000_000 : 0;
          const visibleContent = measureCanvasVisualRatio(canvas) * 10_000_000;
          return nativePriority + wrapperPriority + visibleContent + canvas.width * canvas.height;
        };
        return score(b) - score(a);
      })[0] ?? candidates[0] ?? null;
  }

  private async renderPdfPageCanvasForExport(overlay: PageOverlay): Promise<HTMLCanvasElement | null> {
    if (this.exportRenderFallbackPages.has(overlay.pageIndex)) {
      return this.getPdfCanvas(overlay);
    }
    const viewer = this.getNativePdfViewerApp()?.pdfViewer;
    const pageView = viewer?.getPageView?.(overlay.pageIndex) ?? viewer?._pages?.[overlay.pageIndex] ?? null;
    const pdfPage = pageView?.pdfPage;
    const viewport = pageView?.viewport;
    if (!pdfPage?.render || !viewport?.width || !viewport.height) {
      return this.getPdfCanvas(overlay);
    }
    const maxSize = 1200;
    const outputScale = Math.min(2, maxSize / Math.max(viewport.width, viewport.height));
    const canvas = activeDocument.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width * outputScale));
    canvas.height = Math.max(1, Math.round(viewport.height * outputScale));
    const context = canvas.getContext("2d");
    if (!context) {
      return this.getPdfCanvas(overlay);
    }
    try {
      const task = pdfPage.render({
        canvas,
        canvasContext: context,
        intent: "print",
        transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
        viewport
      });
      const renderPromise = task && "promise" in task && task.promise
        ? task.promise
        : Promise.resolve(task);
      const completed = await Promise.race([
        renderPromise.then(() => true),
        sleepMs(8_000).then(() => false)
      ]);
      if (!completed) {
        this.exportRenderFallbackPages.add(overlay.pageIndex);
        if (task && "cancel" in task && typeof task.cancel === "function") {
          task.cancel();
        }
        await Promise.race([renderPromise.catch(() => undefined), sleepMs(250)]);
        console.warn("pdftion timed out rendering an offscreen PDF page; using the displayed canvas.", overlay.pageIndex + 1);
        return this.getPdfCanvas(overlay);
      }
      return canvas;
    } catch (error) {
      this.exportRenderFallbackPages.add(overlay.pageIndex);
      console.warn("pdftion could not render an offscreen PDF page for conversion.", error);
      return this.getPdfCanvas(overlay);
    }
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
        ".pdftion-live-canvas, .pdftion-native-editor, .pdftion-native-selection-menu, .pdftion-palette-panel, .pdftion-text-menu, .pdftion-comment-popover, .pdftion-panel"
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
      if (candidate.closest(".pdftion-root, .pdftion-toolbar, .pdftion-panel, .pdftion-palette-panel, .pdftion-text-menu, .pdftion-comment-popover, .pdftion-native-selection-menu")) {
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

  private beginSelectionInteraction(
    point: InkPoint,
    overlay: PageOverlay,
    hitElement = this.findElementAt(overlay, point),
    selectedElements = this.getSelectedEditableElements(overlay.pageIndex),
    selectionBounds = normalizedElementsBounds(selectedElements),
    selectionHandle = selectionBounds ? this.findSelectionHandleAt(overlay, point, selectionBounds) : null
  ): void {
    if (selectionHandle && this.canDragSelectedElements(overlay.pageIndex, selectedElements)) {
      const selected = selectedElements;
      const bounds = selectionBounds;
      if (selected.length > 0 && bounds) {
        this.selectionDrag = {
          current: point,
          elements: selected,
          handle: selectionHandle,
          mode: "resize",
          moved: false,
          originalBounds: bounds,
          originalElements: selected.map(cloneElement),
          pageIndex: overlay.pageIndex,
          start: point
        };
        this.redrawSelectionState();
        return;
      }
    }

    const selected = hitElement;
    if (selected) {
      if (!this.selectedStrokeIds.has(selected.id)) {
        this.setSelectedElementForEditing(selected);
        const dragElements = [selected];
        this.selectionDrag = this.canDragSelectedElements(overlay.pageIndex, dragElements)
          ? {
              current: point,
              elements: dragElements,
              mode: "move",
              moved: false,
              pageIndex: overlay.pageIndex,
              start: point
            }
          : null;
        this.redrawSelectionState();
        return;
      }
      if (!this.canDragSelectedElements(overlay.pageIndex, selectedElements)) {
        this.nativeSelection = null;
        this.selectionDrag = null;
        this.redrawSelectionState();
        return;
      }
      this.nativeSelection = null;
      this.selectionDrag = {
        current: point,
        elements: selectedElements,
        mode: "move",
        moved: false,
        pageIndex: overlay.pageIndex,
        start: point
      };
      this.redrawSelectionState();
      return;
    }

    if (selectedElements.length > 0 && selectionBounds && this.selectionBoxContainsPoint(overlay, point, selectionBounds) && this.canDragSelectedElements(overlay.pageIndex, selectedElements)) {
      this.nativeSelection = null;
      this.selectionDrag = {
        clearSelectionOnTap: true,
        current: point,
        elements: selectedElements,
        mode: "move",
        moved: false,
        pageIndex: overlay.pageIndex,
        start: point
      };
      this.redrawSelectionState();
      return;
    }

    if (!selected) {
      if (this.selectedStrokeIds.size > 0 || this.nativeSelection !== null) {
        this.clearEditableSelection();
        this.selectionDrag = null;
        this.redrawSelectionState();
        return;
      }
      const blockingCover = this.findCoverElementAt(overlay, point, true);
      if (blockingCover?.source === "native-text") {
        this.clearEditableSelection();
        this.selectionDrag = null;
        this.redrawSelectionState();
        return;
      }
      const native = this.findNativeObjectAt(overlay, point);
      if (native) {
        this.clearEditableSelection();
        this.nativeSelection = native;
        this.selectionDrag = null;
        this.redrawSelectionState();
        return;
      }
      this.clearEditableSelection();
      this.selectionDrag = {
        current: point,
        mode: "marquee",
        moved: false,
        pageIndex: overlay.pageIndex,
        start: point
      };
    } else {
      this.selectionDrag = null;
    }

    this.redrawSelectionState();
  }

  private startLayerLongPress(overlay: PageOverlay, point: InkPoint, clientX: number, clientY: number, hitElement = this.findElementAt(overlay, point)): void {
    this.clearLayerLongPress();
    this.layerMenu?.remove();
    this.layerMenu = null;
    const element = hitElement;
    if (!element) {
      return;
    }

    this.layerLongPressStart = { clientX, clientY, elementId: element.id, pageIndex: overlay.pageIndex };
    this.layerLongPressTimer = window.setTimeout(() => {
      this.layerLongPressTimer = null;
      const start = this.layerLongPressStart;
      const live = start ? this.findElementById(start.elementId) : null;
      const liveOverlay = start ? this.findOverlayByPageIndex(start.pageIndex) : null;
      if (!start || !live || !liveOverlay || !this.enabled) {
        this.layerLongPressStart = null;
        return;
      }

      this.layerLongPressTriggered = true;
      this.clearCurrentStroke();
      this.currentCover = null;
      this.selectionDrag = null;
      this.setSingleSelectedElement(live.id);
      this.showLayerMenuForElement(live, liveOverlay);
      this.redrawAll();
      this.updateToolbarState();
    }, 520);
  }

  private cancelLayerLongPressOnMove(clientX: number, clientY: number): void {
    const start = this.layerLongPressStart;
    if (!start || this.layerLongPressTriggered) {
      return;
    }
    if (Math.hypot(clientX - start.clientX, clientY - start.clientY) > 9) {
      this.clearLayerLongPress();
    }
  }

  private clearLayerLongPress(): void {
    if (this.layerLongPressTimer !== null) {
      window.clearTimeout(this.layerLongPressTimer);
      this.layerLongPressTimer = null;
    }
    this.layerLongPressStart = null;
  }

  private consumeLayerLongPress(): boolean {
    this.clearLayerLongPress();
    if (!this.layerLongPressTriggered) {
      return false;
    }
    this.layerLongPressTriggered = false;
    return true;
  }

  private showLayerMenuForElement(element: InkElement, overlay: PageOverlay): void {
    this.layerMenu?.remove();
    const panel = activeDocument.createElement("div");
    panel.className = "pdftion-layer-menu";
    panel.setAttribute("role", "toolbar");
    panel.setAttribute("aria-label", uiText("元素层级", "Element layer"));
    panel.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    panel.addEventListener("click", (event) => event.stopPropagation());

    const actions: Array<{ icon: string; mode: "up" | "down" | "top" | "bottom"; title: string }> = [
      { icon: "arrow-up", mode: "up", title: uiText("上移一层", "Move one layer up") },
      { icon: "arrow-down", mode: "down", title: uiText("下移一层", "Move one layer down") },
      { icon: "chevrons-up", mode: "top", title: uiText("置于顶层", "Bring to front") },
      { icon: "chevrons-down", mode: "bottom", title: uiText("置于底层", "Send to back") }
    ];
    for (const action of actions) {
      const button = createIconButton(action.icon, action.title);
      button.addEventListener("click", () => {
        this.reorderSelectedLayers(action.mode);
        panel.remove();
        this.layerMenu = null;
      });
      panel.appendChild(button);
    }

    appendToActiveBody(panel);
    const bounds = normalizedElementBounds(element);
    const rect = this.getOverlayClientRect(overlay);
    const menuWidth = 4 * 30 + 3 * 5 + 12;
    const menuHeight = 42;
    const centerX = bounds ? rect.left + ((bounds.minX + bounds.maxX) / 2) * rect.width : rect.left + rect.width / 2;
    const elementTop = bounds ? rect.top + bounds.minY * rect.height : rect.top;
    const elementBottom = bounds ? rect.top + bounds.maxY * rect.height : rect.bottom;
    const top = elementTop - menuHeight - 7 >= 8 ? elementTop - menuHeight - 7 : elementBottom + 7;
    panel.setCssStyles({
      left: `${clamp(centerX - menuWidth / 2, 8, Math.max(8, activeWindow.innerWidth - menuWidth - 8))}px`,
      top: `${clamp(top, 8, Math.max(8, activeWindow.innerHeight - menuHeight - 8))}px`
    });
    this.layerMenu = panel;
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
    } else if (this.tool === "text" || this.tool === "comment") {
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

  private getCommentElements(): InkText[] {
    return this.textHistory
      .filter((text) => text.presentation === "comment")
      .sort(compareInkElements);
  }

  private showCommentManager(): void {
    if (this.commentManager?.isConnected) {
      this.commentManager.remove();
      this.commentManager = null;
      return;
    }

    const panel = activeDocument.createElement("div");
    panel.className = "pdftion-panel pdftion-comment-manager";
    panel.addEventListener("pointerdown", (event) => event.stopPropagation());
    panel.addEventListener("click", (event) => event.stopPropagation());

    const header = activeDocument.createElement("div");
    header.className = "pdftion-panel-header";
    header.textContent = uiText("批注管理", "Comment manager");
    const close = createIconButton("x", uiText("关闭", "Close"));
    close.addEventListener("click", () => {
      panel.remove();
      this.commentManager = null;
    });
    header.appendChild(close);
    panel.appendChild(header);

    const list = activeDocument.createElement("div");
    list.className = "pdftion-comment-list";
    panel.appendChild(list);
    this.populateCommentManagerList(list);

    appendToActiveBody(panel);
    const button = this.toolbar?.querySelector<HTMLElement>(".pdftion-text-button");
    const rect = button?.getBoundingClientRect();
    panel.setCssStyles({
      left: `${clamp(rect?.left ?? 12, 8, Math.max(8, activeWindow.innerWidth - 340))}px`,
      top: `${clamp((rect?.bottom ?? 72) + 8, 8, Math.max(8, activeWindow.innerHeight - 420))}px`
    });
    this.commentManager = panel;
  }

  private populateCommentManagerList(list: HTMLElement): void {
    list.textContent = "";
    const comments = this.getCommentElements();
    if (comments.length === 0) {
      const empty = activeDocument.createElement("div");
      empty.className = "pdftion-comment-empty";
      empty.textContent = uiText("暂无批注", "No comments");
      list.appendChild(empty);
      return;
    }

    for (const comment of comments) {
      const row = activeDocument.createElement("div");
      row.className = "pdftion-comment-row";

      const locate = activeDocument.createElement("button");
      locate.type = "button";
      locate.className = "pdftion-comment-locate";
      const page = activeDocument.createElement("span");
      page.className = "pdftion-comment-page";
      page.textContent = uiText(`第 ${comment.pageIndex + 1} 页`, `Page ${comment.pageIndex + 1}`);
      locate.appendChild(page);
      const preview = activeDocument.createElement("span");
      preview.className = "pdftion-comment-preview";
      preview.textContent = comment.text.trim();
      locate.appendChild(preview);
      locate.addEventListener("click", () => {
        this.setSingleSelectedElement(comment.id);
        this.jumpToPage(comment.pageIndex);
        window.setTimeout(() => {
          const overlay = this.findOverlayByPageIndex(comment.pageIndex);
          if (overlay) {
            this.showCommentPopover(comment, overlay);
            this.redrawAll();
          }
        }, 180);
      });
      row.appendChild(locate);

      const edit = createIconButton("pencil", uiText("编辑批注", "Edit comment"));
      edit.addEventListener("click", () => void this.editCommentAnnotation(comment));
      row.appendChild(edit);
      const remove = createIconButton("trash-2", uiText("删除批注", "Delete comment"));
      remove.addEventListener("click", () => this.deleteCommentAnnotation(comment));
      row.appendChild(remove);
      list.appendChild(row);
    }
  }

  private refreshCommentManager(): void {
    const list = this.commentManager?.querySelector<HTMLElement>(".pdftion-comment-list");
    if (list) {
      this.populateCommentManagerList(list);
    }
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
    this.nativeTextSelectionAction = this.plugin.settings.nativeTextSelectionAction;
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
    this.refreshCommentManager();
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
    this.cancelLayerLongPressOnMove(event.clientX, event.clientY);
    if (this.layerLongPressTriggered) {
      return;
    }
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
      const selected = drag.elements ?? this.getSelectedEditableElements(overlay.pageIndex);
      if (selected.length === 0 || !moved) {
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
      this.redrawPageOverlays(overlay.pageIndex);
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
      this.redrawPageOverlays(overlay.pageIndex);
      return;
    }

    drag.current = point;
    drag.moved = drag.moved || moved;
    this.requestOverlayRedraw(overlay);
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

    if (this.consumeLayerLongPress()) {
      return;
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
        this.setSelectedElementForEditing(selected);
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
        this.scheduleExternalInkLayerUpdate();
        this.redrawPageOverlays(overlay.pageIndex);
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
        this.scheduleExternalInkLayerUpdate();
        this.redrawPageOverlays(overlay.pageIndex);
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

  private redrawPageOverlays(pageIndex: number): void {
    for (const candidate of this.overlays.values()) {
      if (candidate.pageIndex === pageIndex) {
        this.requestOverlayRedraw(candidate);
      }
    }
  }

  private redrawSelectionState(): void {
    for (const overlay of this.overlays.values()) {
      if (this.isOverlayNearViewport(overlay)) {
        this.requestOverlayRedraw(overlay);
      }
    }
  }

  private onTouchStart(event: TouchEvent, overlay: PageOverlay): void {
    if (!this.enabled) {
      return;
    }

    if (event.touches.length >= 2) {
      event.preventDefault();
      event.stopPropagation();
      this.clearLayerLongPress();
      this.touchGestureCooldownUntil = Date.now() + 450;
      this.clearCurrentStroke();
      this.activeTouchId = null;
      this.redrawAll();
      this.resizeOverlay(overlay);
      const center = getTouchCenter(event.touches);
      const centerPoint = this.getOverlayInputPoint(overlay, center.x, center.y);
      const selected = this.getSelectedEditableElements(overlay.pageIndex);
      const bounds = normalizedElementsBounds(selected);
      const resizeSelection = this.tool === "select" && selected.length > 0 && bounds !== null && this.selectionBoxContainsPoint(overlay, centerPoint, bounds);
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
      this.clearLayerLongPress();
      this.activeTouchId = null;
      return;
    }
    const hitElement = this.findElementAt(overlay, point);
    this.startLayerLongPress(overlay, point, touch.clientX, touch.clientY, hitElement);
    this.beginInkInteraction(point, overlay, hitElement);
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
    this.cancelLayerLongPressOnMove(touch.clientX, touch.clientY);
    if (this.layerLongPressTriggered) {
      return;
    }
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
    if (this.consumeLayerLongPress()) {
      return;
    }
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
        this.refreshCommentManager();
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
    this.refreshCommentManager();
    this.scheduleAutoSave();
  }

  private redrawAll(): void {
    this.pruneImageCache();
    this.scheduleExternalInkLayerUpdate();
    for (const overlay of this.overlays.values()) {
      if (this.isOverlayNearViewport(overlay)) {
        this.requestOverlayRedraw(overlay);
      }
    }
  }

  private pruneImageCache(): void {
    const activeDataUrls = new Set(this.imageHistory.map((image) => image.dataUrl));
    for (const dataUrl of this.imageCache.keys()) {
      if (!activeDataUrls.has(dataUrl)) {
        this.imageCache.delete(dataUrl);
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
    return this.isPageElementNearViewport(overlay.pageEl);
  }

  private isPageElementNearViewport(pageEl: HTMLElement): boolean {
    const rect = pageEl.getBoundingClientRect();
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

    if (this.nativeTextEditorCover && this.nativeTextEditorCover.pageIndex === overlay.pageIndex) {
      drawCoverElement(ctx, this.nativeTextEditorCover, overlay.cssWidth, overlay.cssHeight, false);
    }

    const orderedElements = this.getEditableElementsForPage(overlay.pageIndex);
    for (const element of orderedElements) {
      const selected = tintEditableSelection && this.selectedStrokeIds.has(element.id);
      if (element.kind === "cover") {
        drawCoverElement(ctx, element, overlay.cssWidth, overlay.cssHeight, selected);
      } else if (element.kind === "image") {
        this.drawImageElement(ctx, element, overlay.cssWidth, overlay.cssHeight, selected);
      } else if (element.kind === "stroke") {
        if (!this.savedInkIsBurnedIntoPdf || !element.saved || Array.isArray(element.pdfPoints)) {
          drawStroke(ctx, element, overlay.cssWidth, overlay.cssHeight, selected);
        }
      } else if (!element.saved || !this.savedTextIsBurnedIntoPdf || element.presentation === "comment") {
        drawTextElement(ctx, element, overlay.cssWidth, overlay.cssHeight, selected);
      }
    }

    if (this.currentCover && this.currentCover.pageIndex === overlay.pageIndex) {
      drawCoverElement(ctx, this.currentCover, overlay.cssWidth, overlay.cssHeight, false);
    }

    if (showEditableSelectionControls && this.selectionDrag?.mode === "marquee" && this.selectionDrag.pageIndex === overlay.pageIndex) {
      drawMarqueeBox(ctx, this.selectionDrag.start, this.selectionDrag.current, overlay.cssWidth, overlay.cssHeight);
    }

    const selected = orderedElements.filter((element) => this.selectedStrokeIds.has(element.id));
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
    if (this.detachedInkEditPages.size > 0) {
      await this.commitDetachedInkPages(new Set(this.detachedInkEditPages));
      return;
    }
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
    this.scheduleEditableInkPrepare(0);
  }

  async exportAnnotationsMarkdown(): Promise<string | null> {
    return this.exportConvertedMarkdown();
  }

  async exportAnnotationsDocx(): Promise<string | null> {
    return this.exportConvertedDocx();
  }

  async exportMarkdownDocxBridge(): Promise<string | null> {
    const mdPath = await this.exportConvertedMarkdown({ notice: false });
    const docxPath = await this.exportConvertedDocx({ notice: false });
    if (mdPath || docxPath) {
      new Notice(uiText(`已导出转换文档：${[mdPath, docxPath].filter(Boolean).join(", ")}`, `Exported converted documents: ${[mdPath, docxPath].filter(Boolean).join(", ")}`));
    }
    return mdPath ?? docxPath;
  }

  private async prepareExportSnapshot(): Promise<SourcePdfSnapshot> {
    this.conversionInProgress = true;
    this.clearAutoSaveTimer();
    this.clearEditableInkPrepareTimer();
    try {
      if (this.finishingPdfInkEditing) {
        await Promise.race([this.finishingPdfInkEditing, sleepMs(10_000)]);
      }
      for (let attempt = 0; attempt < 200 && (this.saving || this.preparingPdfInkForEditing || this.finishingPdfInkEditing); attempt += 1) {
        await sleepMs(50);
      }
      if (this.saving || this.preparingPdfInkForEditing || this.finishingPdfInkEditing) {
        throw new Error("PDF editing state is still being prepared; conversion did not start.");
      }
      const sourceSnapshot = await this.captureSourcePdfSnapshot();
      await this.loadEditableAnnotations();
      this.commitNativeTextEditor();
      await sleepMs(0);
      this.redrawAll();
      await waitForNextFrame();
      return sourceSnapshot;
    } catch (error) {
      this.conversionInProgress = false;
      throw error;
    }
  }

  private async captureSourcePdfSnapshot(): Promise<SourcePdfSnapshot> {
    const bytes = await this.plugin.app.vault.readBinary(this.file);
    return {
      bytes,
      fingerprint: await sha256Hex(bytes),
      path: this.file.path
    };
  }

  private async assertSourcePdfSnapshot(snapshot: SourcePdfSnapshot): Promise<void> {
    const sourceIntegrityError = await this.verifySourcePdfAfterConversion(
      snapshot.path,
      snapshot.bytes,
      snapshot.fingerprint
    );
    if (sourceIntegrityError) {
      throw sourceIntegrityError;
    }
  }

  private async verifySourcePdfAfterConversion(
    sourcePath: string,
    sourceBytes: ArrayBuffer,
    sourceFingerprint: string
  ): Promise<Error | null> {
    try {
      const source = this.plugin.app.vault.getAbstractFileByPath(sourcePath);
      if (!(source instanceof TFile)) {
        const restored = await this.plugin.app.vault.createBinary(sourcePath, sourceBytes.slice(0));
        this.file = restored;
        return new Error(`The source PDF disappeared during conversion and was restored: ${sourcePath}`);
      }
      const finalBytes = await this.plugin.app.vault.readBinary(source);
      if (await sha256Hex(finalBytes) === sourceFingerprint) {
        this.file = source;
        return null;
      }
      await this.plugin.app.vault.modifyBinary(source, sourceBytes.slice(0));
      this.file = source;
      return new Error(`The source PDF changed during conversion and was restored: ${sourcePath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return new Error(`Could not verify or restore the source PDF after conversion: ${sourcePath}. ${message}`);
    }
  }

  async exportConvertedMarkdown(options: { notice?: boolean } = {}): Promise<string | null> {
    try {
      const sourceSnapshot = await this.prepareExportSnapshot();
      const noteDraw = getNoteDrawWriteApi();
      const visualPages = await this.captureVisualConversionPages({
        includeCovers: false,
        includeImages: false,
        includeStrokes: false,
        includeText: false
      }, sourceSnapshot);
      const pages: EditableMarkdownPage[] = visualPages.map((page) => ({
        height: page.height,
        lines: page.lines,
        pageIndex: page.pageIndex,
        width: page.width
      }));
      const targetPath = await this.getUniqueConvertedPath("pdftion-converted", "md");
      const persistedImages = await this.persistNoteDrawExportImages(
        targetPath,
        collectNoteDrawExportImages(visualPages, this.getEditableElements()).filter(isUsefulMarkdownExportImage)
      );
      const { floating: floatingImages, inline: inlineImages } = partitionMarkdownExportImages(pages, persistedImages);
      const markdown = buildEditableMarkdown(
        this.file,
        pages,
        noteDraw ? inlineImages : [...inlineImages, ...floatingImages],
        targetPath
      );
      const targetFile = await this.plugin.app.vault.create(targetPath, markdown);
      if (noteDraw) {
        await noteDraw.writeDrawings(
          targetFile,
          buildNoteDrawExportData(targetPath, pages, this.getEditableElements(), floatingImages)
        );
      }
      const opened = await this.openConvertedMarkdownFile(targetFile);
      await this.assertSourcePdfSnapshot(sourceSnapshot);
      if (options.notice !== false) {
        new Notice(noteDraw
          ? uiText(`已转换${opened ? "并打开" : ""} MD，文字与插图可直接编辑，涂鸦已转为 NoteDraw：${targetPath}`, `Converted${opened ? " and opened" : ""} editable MD with native images and NoteDraw ink: ${targetPath}`)
          : uiText(`已转换${opened ? "并打开" : ""} MD，插图已使用原生 Markdown 引用：${targetPath}`, `Converted${opened ? " and opened" : ""} MD with native image references: ${targetPath}`));
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
      const sourceSnapshot = await this.prepareExportSnapshot();
      const pages = await this.captureVisualConversionPages({}, sourceSnapshot);
      const targetPath = await this.getUniqueConvertedPath("pdftion-converted", "docx");
      const docx = await buildDocxFromPageImages(pages, this.file.basename);
      const buffer = toArrayBufferCopy(docx);
      const targetFile = await this.plugin.app.vault.createBinary(targetPath, buffer);
      const opened = await this.openConvertedFile(targetFile);
      await this.assertSourcePdfSnapshot(sourceSnapshot);
      if (options.notice !== false) {
        new Notice(uiText(`已转换${opened ? "并打开" : ""} DOCX：${targetPath}`, `Converted${opened ? " and opened" : ""} DOCX: ${targetPath}`));
      }
      return targetPath;
    } catch (error) {
      console.error(error);
      new Notice(uiText("转换 DOCX 失败，请查看控制台。", "DOCX conversion failed. Check the console."));
      return null;
    }
  }

  private async openConvertedFile(file: TFile): Promise<boolean> {
    if (!this.plugin.settings.openBurnedPdfAfterExport) {
      return false;
    }
    try {
      await this.plugin.app.workspace.getLeaf("tab").openFile(file);
      return true;
    } catch (error) {
      console.warn("pdftion could not open the converted file.", error);
      return false;
    }
  }

  private async openConvertedMarkdownFile(file: TFile): Promise<boolean> {
    if (!this.plugin.settings.openBurnedPdfAfterExport) {
      return false;
    }
    try {
      const leaf = this.plugin.app.workspace.getLeaf("tab");
      await leaf.openFile(file);
      await leaf.setViewState({
        active: true,
        state: { file: file.path, mode: "preview", source: false },
        type: "markdown"
      });
      return true;
    } catch (error) {
      console.warn("pdftion could not open converted Markdown in preview mode.", error);
      return false;
    }
  }

  async exportConvertedPng(options: { notice?: boolean } = {}): Promise<string | null> {
    try {
      const sourceSnapshot = await this.prepareExportSnapshot();
      const pages = await this.captureVisualConversionPages({}, sourceSnapshot);
      const targetPath = await this.getUniqueConvertedPath("pdftion-converted", "png");
      const png = await buildCombinedPagePng(pages);
      const targetFile = await this.plugin.app.vault.createBinary(targetPath, toArrayBufferCopy(png));
      const opened = await this.openConvertedFile(targetFile);
      await this.assertSourcePdfSnapshot(sourceSnapshot);
      if (options.notice !== false) {
        new Notice(uiText(`已转换${opened ? "并打开" : ""} PNG：${targetPath}`, `Converted${opened ? " and opened" : ""} PNG: ${targetPath}`));
      }
      return targetPath;
    } catch (error) {
      console.error(error);
      new Notice(uiText("转换 PNG 失败，请查看控制台。", "PNG conversion failed. Check the console."));
      return null;
    }
  }

  async exportConvertedPptx(options: { notice?: boolean } = {}): Promise<string | null> {
    try {
      const sourceSnapshot = await this.prepareExportSnapshot();
      const pages = await this.captureVisualConversionPages({}, sourceSnapshot);
      const targetPath = await this.getUniqueConvertedPath("pdftion-converted", "pptx");
      const pptx = await buildPptxFromPageImages(pages, this.file.basename);
      const targetFile = await this.plugin.app.vault.createBinary(targetPath, toArrayBufferCopy(pptx));
      const opened = await this.openConvertedFile(targetFile);
      await this.assertSourcePdfSnapshot(sourceSnapshot);
      if (options.notice !== false) {
        new Notice(uiText(`已转换${opened ? "并打开" : ""} PPTX：${targetPath}`, `Converted${opened ? " and opened" : ""} PPTX: ${targetPath}`));
      }
      return targetPath;
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : String(error);
      new Notice(uiText(`转换 PPTX 失败：${message}`, `PPTX conversion failed: ${message}`), 12_000);
      return null;
    }
  }

  async exportConvertedHtml(options: { notice?: boolean } = {}): Promise<string | null> {
    try {
      const sourceSnapshot = await this.prepareExportSnapshot();
      const pages = await this.captureVisualConversionPages({}, sourceSnapshot);
      const targetPath = await this.getUniqueConvertedPath("pdftion-converted", "html");
      const targetFile = await this.plugin.app.vault.create(targetPath, buildSelfContainedVisualHtml(this.file, pages));
      const opened = await this.openConvertedFile(targetFile);
      await this.assertSourcePdfSnapshot(sourceSnapshot);
      if (options.notice !== false) {
        new Notice(uiText(`已转换${opened ? "并打开" : ""} HTML：${targetPath}`, `Converted${opened ? " and opened" : ""} HTML: ${targetPath}`));
      }
      return targetPath;
    } catch (error) {
      console.error(error);
      new Notice(uiText("转换 HTML 失败，请查看控制台。", "HTML conversion failed. Check the console."));
      return null;
    }
  }

  private async captureVisualConversionPages(
    options: VisualCaptureOptions = {},
    sourceSnapshot?: SourcePdfSnapshot
  ): Promise<VisualConversionPage[]> {
    this.conversionInProgress = true;
    this.clearAutoSaveTimer();
    this.clearEditableInkPrepareTimer();
    this.exportRenderFallbackPages.clear();
    if (this.finishingPdfInkEditing) {
      await Promise.race([this.finishingPdfInkEditing, sleepMs(10_000)]);
    }
    for (let attempt = 0; attempt < 200 && (this.saving || this.preparingPdfInkForEditing); attempt += 1) {
      await sleepMs(50);
    }
    if (this.saving || this.preparingPdfInkForEditing || this.finishingPdfInkEditing) {
      throw new Error("PDF editing state is still being saved; conversion did not start.");
    }
    const pageElements = this.findPageElements();
    const screenOnlySurface = pageElements.length === 1 && !pageElements[0].matches(
      ".pdfViewer .page, .pdf-viewer .page, .pdf-container .page, .page[data-page-number]"
    );
    const pageCount = screenOnlySurface ? 1 : await this.getCurrentPdfPageCount();
    const pages: VisualConversionPage[] = [];
    const firstPage = this.findPdfPageElementForExport(0) ?? this.rootEl;
    const scrollEl = findScrollableAncestor(firstPage);
    const originalScrollLeft = scrollEl.scrollLeft;
    const originalScrollTop = scrollEl.scrollTop;
    const snapshot = sourceSnapshot ?? await this.captureSourcePdfSnapshot();
    let sourceIntegrityError: Error | null = null;
    try {
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
        const pageEl = this.findPdfPageElementForExport(pageIndex);
        pageEl?.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });
        await this.ensurePdfPageRenderedForExport(pageIndex, pageEl);
        let captured: VisualConversionPage | null = null;
        for (let attempt = 0; attempt < 16 && !captured; attempt += 1) {
          await sleepMs(attempt === 0 ? 140 : 120);
          this.scanPages();
          const overlay = this.findOverlayByPageIndex(pageIndex);
          if (!overlay) {
            continue;
          }
          this.resizeOverlay(overlay);
          await waitForNextFrame();
          const candidate = await this.captureVisualPageImage(overlay, options);
          if (!candidate) {
            continue;
          }
          const canvasStillBlank = candidate.sourceVisualRatio < 0.00035 && candidate.lines.length > 0;
          if (canvasStillBlank && attempt < 15) {
            continue;
          }
          captured = candidate;
        }
        if (captured) {
          pages.push(captured);
        }
      }
    } finally {
      scrollEl.scrollLeft = originalScrollLeft;
      scrollEl.scrollTop = originalScrollTop;
      scrollEl.dispatchEvent(new Event("scroll"));
      this.scanPages();
      this.conversionInProgress = false;
      sourceIntegrityError = await this.verifySourcePdfAfterConversion(
        snapshot.path,
        snapshot.bytes,
        snapshot.fingerprint
      );
    }

    if (sourceIntegrityError) {
      throw sourceIntegrityError;
    }
    if (pages.length !== pageCount) {
      throw new Error(`Only ${pages.length}/${pageCount} PDF pages rendered for conversion.`);
    }
    return pages;
  }

  private getNativePdfViewerApp(): NativePdfViewerAppLike | null {
    const view = this.leaf.view as unknown as PdfViewLike;
    return view.viewer?.child?.pdfViewer ?? null;
  }

  private requestNativePdfPageRender(pageIndex: number): void {
    const app = this.getNativePdfViewerApp();
    const viewer = app?.pdfViewer;
    if (!viewer) {
      return;
    }
    const pageNumber = pageIndex + 1;
    const pageView = viewer.getPageView?.(pageIndex) ?? viewer._pages?.[pageIndex] ?? null;
    try {
      viewer.scrollPageIntoView?.({ pageNumber });
      viewer.currentPageNumber = pageNumber;
      viewer.update?.();
      if (pageView?.renderingState === 2 && typeof pageView.resume === "function") {
        pageView.resume();
      } else if (pageView && pageView.renderingState !== 3) {
        (app?.pdfRenderingQueue ?? viewer.renderingQueue)?.renderView?.(pageView);
      }
      app?.forceRendering?.();
      viewer.forceRendering?.();
      (app?.pdfRenderingQueue ?? viewer.renderingQueue)?.renderHighestPriority?.();
    } catch (error) {
      console.debug("pdftion could not explicitly request PDF page rendering.", error);
    }
  }

  private async ensurePdfPageRenderedForExport(pageIndex: number, pageEl: HTMLElement | null): Promise<void> {
    const app = this.getNativePdfViewerApp();
    const viewer = app?.pdfViewer;
    const directPageView = viewer?.getPageView?.(pageIndex) ?? viewer?._pages?.[pageIndex] ?? null;
    if (directPageView?.pdfPage?.render && directPageView.viewport?.width && directPageView.viewport.height) {
      return;
    }
    const directCanvas = directPageView?.canvas ?? pageEl?.querySelector<HTMLCanvasElement>(".canvasWrapper canvas, canvas");
    if (directCanvas && directCanvas.width > 1 && directCanvas.height > 1 && measureCanvasVisualRatio(directCanvas) > 0.00035) {
      return;
    }
    for (let attempt = 0; attempt < 180; attempt += 1) {
      this.scanPages();
      const overlay = this.findOverlayByPageIndex(pageIndex);
      const pageView = viewer?.getPageView?.(pageIndex) ?? viewer?._pages?.[pageIndex] ?? null;
      const canvas = (overlay ? this.getPdfCanvas(overlay) : null) ??
        pageView?.canvas ??
        pageEl?.querySelector<HTMLCanvasElement>(".canvasWrapper canvas, canvas");
      const canvasReady = Boolean(
        canvas &&
        canvas.width > 1 &&
        canvas.height > 1 &&
        measureCanvasVisualRatio(canvas) > 0.00035
      );
      if (canvasReady) {
        return;
      }
      if (attempt === 0 && pageView?.draw) {
        try {
          pageView.cancelRendering?.();
          pageView.reset?.();
          await Promise.race([pageView.draw(), sleepMs(8_000)]);
          continue;
        } catch (error) {
          console.debug("pdftion could not directly render a PDF page for export.", error);
        }
      }
      if (attempt === 0 || attempt % 4 === 0 || pageView?.renderingState === 2) {
        this.requestNativePdfPageRender(pageIndex);
      }
      await sleepMs(250);
    }
  }

  private findPdfPageElementForExport(pageIndex: number): HTMLElement | null {
    const candidates = Array.from(this.rootEl.querySelectorAll<HTMLElement>(
      ".pdfViewer .page, .pdf-viewer .page, .pdf-container .page, .page[data-page-number]"
    ));
    return candidates.find((page, index) => getPageIndex(page, index) === pageIndex) ??
      candidates[pageIndex] ??
      this.findPageElements()[pageIndex] ??
      null;
  }

  private async captureVisualPageImage(overlay: PageOverlay, options: VisualCaptureOptions = {}): Promise<VisualConversionPage | null> {
    const displayedCanvas = this.getPdfCanvas(overlay);
    const pdfCanvas = displayedCanvas && measureCanvasVisualRatio(displayedCanvas) > 0.00035
      ? displayedCanvas
      : await this.renderPdfPageCanvasForExport(overlay);
    if (!pdfCanvas || pdfCanvas.width <= 1 || pdfCanvas.height <= 1) {
      return null;
    }

    const sourceWidth = Math.max(1, pdfCanvas.width);
    const sourceHeight = Math.max(1, pdfCanvas.height);
    const maxSize = 1200;
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
    const pageView = this.getNativePdfViewerApp()?.pdfViewer?.getPageView?.(overlay.pageIndex) ??
      this.getNativePdfViewerApp()?.pdfViewer?._pages?.[overlay.pageIndex] ??
      null;
    const renderedLines = collectEditableMarkdownLines(overlay);
    const pdfLines = await collectPdfJsEditableLines(pageView, overlay);
    const elements = this.getEditableElements();
    const lines = mergeInkTextExportLines(
      selectCompleteEditableLines(renderedLines, pdfLines),
      collectInkTextExportLines(elements, overlay)
    );
    sampleEditableTextColors(pdfCanvas, lines);
    const nativeVisuals = attachLinksToVisualConversionImages(
      await extractHtmlDerivedVisualLayers(canvas, lines, overlay.pageIndex),
      collectDomExportLinkRects(overlay.pageEl),
      overlay
    );
    const annotationVisuals = await buildInkVisualExportImages(
      elements.filter((element) => (
        element.pageIndex === overlay.pageIndex && (
          element.kind === "cover" || (
            element.kind === "stroke" &&
            (!element.saved || !this.savedInkIsBurnedIntoPdf || Array.isArray(element.pdfPoints))
          )
        )
      )),
      overlay,
      outputWidth,
      outputHeight
    );
    ctx.save();
    ctx.scale(outputWidth / Math.max(1, overlay.cssWidth), outputHeight / Math.max(1, overlay.cssHeight));
    const images: VisualConversionImage[] = [...nativeVisuals, ...annotationVisuals];
    for (const image of elements.filter((element): element is InkImage => element.kind === "image" && element.pageIndex === overlay.pageIndex)) {
      images.push({
        dataUrl: await convertImageDataUrlToPng(image.dataUrl),
        height: image.height,
        id: image.id,
        opacity: image.opacity,
        width: image.width,
        x: image.x,
        y: image.y,
        zIndex: image.zIndex
      });
    }
    for (const element of elements.filter((candidate) => candidate.pageIndex === overlay.pageIndex)) {
      if (element.kind === "cover" && options.includeCovers !== false) {
        drawCoverElement(ctx, element, overlay.cssWidth, overlay.cssHeight, false);
      } else if (element.kind === "image" && options.includeImages !== false) {
        await this.drawImageElementForExport(ctx, element, overlay.cssWidth, overlay.cssHeight);
      } else if (
        element.kind === "stroke" &&
        options.includeStrokes !== false &&
        (!element.saved || !this.savedInkIsBurnedIntoPdf || Array.isArray(element.pdfPoints))
      ) {
        drawStroke(ctx, element, overlay.cssWidth, overlay.cssHeight, false);
      } else if (
        element.kind === "text" &&
        options.includeText !== false &&
        (!element.saved || !this.savedTextIsBurnedIntoPdf || element.presentation === "comment")
      ) {
        drawTextElement(ctx, element, overlay.cssWidth, overlay.cssHeight, false);
      }
    }
    ctx.restore();

    const dataUrl = canvas.toDataURL("image/png");
    return {
      bytes: dataUrlToBytes(dataUrl),
      height: outputHeight,
      images,
      lines,
      pageIndex: overlay.pageIndex,
      sourceVisualRatio: measureCanvasVisualRatio(pdfCanvas),
      width: outputWidth
    };
  }

  private async persistNoteDrawExportImages(targetPath: string, images: NoteDrawExportImage[]): Promise<NoteDrawExportImage[]> {
    if (images.length === 0) {
      return [];
    }
    const assetDir = `${targetPath.replace(/\.md$/i, "")}-assets`;
    if (!await this.plugin.app.vault.adapter.exists(assetDir)) {
      await this.plugin.app.vault.adapter.mkdir(assetDir);
    }
    const targetBase = sanitizeNoteDrawAssetName(targetPath.replace(/\.md$/i, ""));
    const persisted: NoteDrawExportImage[] = [];
    for (const [index, image] of images.entries()) {
      const extension = dataUrlImageExtension(image.dataUrl);
      const assetName = `${targetBase}-${sanitizeNoteDrawAssetName(image.id || String(index + 1))}.${extension}`;
      const assetPath = `${assetDir}/${assetName}`;
      const bytes = dataUrlToBytes(image.dataUrl);
      await this.plugin.app.vault.adapter.writeBinary(assetPath, toArrayBufferCopy(bytes));
      persisted.push({
        ...image,
        assetMime: dataUrlMimeType(image.dataUrl),
        assetName,
        assetPath,
        assetSize: bytes.byteLength
      });
    }
    return persisted;
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
      const fontBytes = elements.some((element) => element.kind === "text" && element.presentation !== "comment") ? await this.plugin.loadAnnotationFontBytes() : null;
      await drawVisibleInkElementsOnPdf(pdf, elements, fontBytes);

      const saved = await pdf.save({ addDefaultPage: false, useObjectStreams: false });
      const buffer = new ArrayBuffer(saved.byteLength);
      new Uint8Array(buffer).set(saved);
      const exportedFile = await this.plugin.app.vault.createBinary(targetPath, buffer);
      const opened = await this.openConvertedFile(exportedFile);

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

    normalizeInkElementLayers(elements);
    for (const element of elements.sort(compareInkElements)) {
      if (element.kind === "cover") {
        drawCoverElement(ctx, element, overlay.cssWidth, overlay.cssHeight, false);
      } else if (mode === "all" && element.kind === "image") {
        await drawImageDataUrl(ctx, element, overlay.cssWidth, overlay.cssHeight);
      } else if (mode === "all" && element.kind === "stroke") {
        drawStroke(ctx, element, overlay.cssWidth, overlay.cssHeight, false);
      } else if (mode === "all" && element.kind === "text") {
        drawTextElement(ctx, element, overlay.cssWidth, overlay.cssHeight, false);
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
    const ordered = this.getEditableElementsForPage(overlay.pageIndex).reverse();
    for (const element of ordered) {
      if (element.kind === "text" && textBoxContainsPoint(element, point, overlay.cssWidth, overlay.cssHeight)) {
        return element;
      }
      if (element.kind === "image" && imageBoxContainsPoint(element, point, overlay.cssWidth, overlay.cssHeight, 7)) {
        return element;
      }
      if (element.kind === "stroke" && strokeBoxContainsPoint(element, point, overlay.cssWidth, overlay.cssHeight)) {
        return element;
      }
      if (element.kind === "cover" && coverBoxContainsPoint(element, point, overlay.cssWidth, overlay.cssHeight, 7)) {
        return element;
      }
    }
    return null;
  }

  private findCoverElementAt(overlay: PageOverlay, point: InkPoint, includeNativeTextCover = true): InkCover | null {
    const covers = this.getEditableElementsForPage(overlay.pageIndex).filter((element): element is InkCover => element.kind === "cover").reverse();
    for (const cover of covers) {
      if (!includeNativeTextCover && cover.source === "native-text") {
        continue;
      }
      if (coverBoxContainsPoint(cover, point, overlay.cssWidth, overlay.cssHeight, 7)) {
        return cover;
      }
    }

    return null;
  }

  private findElementsInSelection(overlay: PageOverlay, start: InkPoint, end: InkPoint): InkElement[] {
    return this.getEditableElementsForPage(overlay.pageIndex).filter((element) => {
      if (element.kind === "stroke") {
        return strokeIntersectsSelection(element, start, end, overlay.cssWidth, overlay.cssHeight);
      }
      if (element.kind === "text") {
        return textIntersectsSelection(element, start, end, overlay.cssWidth, overlay.cssHeight);
      }
      return coverIntersectsSelection(element, start, end);
    });
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
  }

  private setSelectedElementForEditing(element: InkElement): void {
    this.setSingleSelectedElement(element.id);
  }

  private setSingleSelectedElement(id: string): void {
    this.selectedStrokeIds.clear();
    this.selectedStrokeIds.add(id);
    this.nativeSelection = null;
    this.selectionChangedAt = Date.now();
  }

  private clearEditableSelection(): void {
    const hadSelection = this.selectedStrokeIds.size > 0 || this.nativeSelection !== null;
    this.selectedStrokeIds.clear();
    this.nativeSelection = null;
    if (hadSelection) {
      this.selectionChangedAt = Date.now();
    }
  }

  private canDragSelectedElements(pageIndex?: number, selectedElements?: InkElement[]): boolean {
    if (this.nativeTextEditor !== null) {
      return false;
    }
    return (selectedElements ?? this.getSelectedEditableElements(pageIndex)).every((element) => element.kind !== "text" || element.text.trim().length > 0);
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
    return [...this.strokeHistory, ...this.textHistory, ...this.coverHistory, ...this.imageHistory].filter((element) => {
      if (!this.selectedStrokeIds.has(element.id)) {
        return false;
      }
      return pageIndex === undefined || element.pageIndex === pageIndex;
    }).sort(compareInkElements);
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

  private scheduleExternalInkLayerUpdate(): void {
    if (this.externalInkLayerFrame !== null) {
      return;
    }
    this.externalInkLayerFrame = window.requestAnimationFrame(() => {
      this.externalInkLayerFrame = null;
      if (!this.destroyed) {
        this.updateExternalInkLayerState();
      }
    });
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

  private selectionBoxContainsPoint(overlay: PageOverlay, point: InkPoint, selectionBounds?: NormalizedBounds): boolean {
    const bounds = selectionBounds ?? normalizedElementsBounds(this.getSelectedEditableElements(overlay.pageIndex));
    if (!bounds) {
      return false;
    }

    const padX = 9 / Math.max(1, overlay.cssWidth);
    const padY = 9 / Math.max(1, overlay.cssHeight);
    return point.x >= bounds.minX - padX && point.x <= bounds.maxX + padX && point.y >= bounds.minY - padY && point.y <= bounds.maxY + padY;
  }

  private findSelectionHandleAt(overlay: PageOverlay, point: InkPoint, selectionBounds?: NormalizedBounds): ResizeHandle | null {
    const bounds = selectionBounds ?? normalizedElementsBounds(this.getSelectedEditableElements(overlay.pageIndex));
    if (!bounds) {
      return null;
    }

    return findResizeHandleAt(bounds, point, overlay.cssWidth, overlay.cssHeight, 8, 0);
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
    const elements = [...this.strokeHistory, ...this.textHistory, ...this.coverHistory, ...this.imageHistory];
    normalizeInkElementLayers(elements);
    return elements.sort(compareInkElements);
  }

  private getEditableElementsForPage(pageIndex: number): InkElement[] {
    const elements = [
      ...this.strokeHistory.filter((element) => element.pageIndex === pageIndex),
      ...this.textHistory.filter((element) => element.pageIndex === pageIndex),
      ...this.coverHistory.filter((element) => element.pageIndex === pageIndex),
      ...this.imageHistory.filter((element) => element.pageIndex === pageIndex)
    ];
    normalizeInkElementLayers(elements);
    return elements.sort(compareInkElements);
  }

  private getNextLayerIndex(pageIndex: number): number {
    const layers = this.getEditableElements()
      .filter((element) => element.pageIndex === pageIndex)
      .map((element) => element.zIndex ?? 0);
    return (layers.length > 0 ? Math.max(...layers) : 0) + 1;
  }

  private reorderSelectedLayers(mode: "up" | "down" | "top" | "bottom"): void {
    const selected = this.getSelectedEditableElements();
    if (selected.length === 0) {
      return;
    }
    this.rememberHistory();
    const selectedIds = new Set(selected.map((element) => element.id));
    const pages = new Set(selected.map((element) => element.pageIndex));

    for (const pageIndex of pages) {
      const ordered = this.getEditableElements().filter((element) => element.pageIndex === pageIndex);
      let next = [...ordered];
      if (mode === "top") {
        next = [
          ...ordered.filter((element) => !selectedIds.has(element.id)),
          ...ordered.filter((element) => selectedIds.has(element.id))
        ];
      } else if (mode === "bottom") {
        next = [
          ...ordered.filter((element) => selectedIds.has(element.id)),
          ...ordered.filter((element) => !selectedIds.has(element.id))
        ];
      } else if (mode === "up") {
        for (let index = next.length - 2; index >= 0; index -= 1) {
          if (selectedIds.has(next[index].id) && !selectedIds.has(next[index + 1].id)) {
            [next[index], next[index + 1]] = [next[index + 1], next[index]];
          }
        }
      } else {
        for (let index = 1; index < next.length; index += 1) {
          if (selectedIds.has(next[index].id) && !selectedIds.has(next[index - 1].id)) {
            [next[index], next[index - 1]] = [next[index - 1], next[index]];
          }
        }
      }

      next.forEach((element, index) => {
        if (element.zIndex !== index + 1) {
          this.markElementChanged(element);
          element.zIndex = index + 1;
          element.saved = false;
        }
      });
    }

    this.markDirty();
    this.updateExternalInkLayerState();
    for (const pageIndex of pages) {
      const overlay = this.findOverlayByPageIndex(pageIndex);
      if (overlay) {
        this.redrawOverlay(overlay);
      }
    }
    this.refreshCommentManager();
    this.scheduleAutoSave();
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
    this.refreshCommentManager();
    this.scheduleAutoSave();
  }

  private rememberHistory(): void {
    const snapshot = this.createHistorySnapshot();
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
      if (element.pdfSaved === true) {
        if (!element.pdfPoints) {
          element.pdfPoints = element.points.map((point) => ({ ...point }));
        }
        this.pendingNativeInkHidePages.add(element.pageIndex);
        this.updateExternalInkLayerState();
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
      this.refreshCommentManager();
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
      this.refreshCommentManager();
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
    if (this.destroyed || this.conversionInProgress || !this.hasPendingPdfWrite()) {
      return;
    }
    this.clearAutoSaveTimer();
    if (this.enabled) {
      const checkpointDelay = clamp(delay, 250, 700);
      this.saveTimer = window.setTimeout(() => {
        this.saveTimer = null;
        void this.checkpointEditableState();
      }, checkpointDelay);
      return;
    }
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.saveIntoPdf(true);
    }, delay);
  }

  flushSoon(): void {
    if (this.destroyed || (this.detachedInkEditPages.size === 0 && !this.hasPendingPdfWrite())) {
      return;
    }
    this.clearAutoSaveTimer();
    void this.finishPdfInkEditing();
  }

  checkpointSoon(): void {
    if (this.destroyed || !this.hasPendingPdfWrite()) {
      return;
    }
    this.clearAutoSaveTimer();
    void this.checkpointEditableState();
  }

  private async checkpointEditableState(): Promise<void> {
    if (this.checkpointing) {
      this.checkpointPending = true;
      return;
    }
    const targetFile = this.file;
    const targetPath = targetFile.path;
    const elements = this.getEditableElements().map(cloneElement);
    this.checkpointing = true;
    try {
      const binary = await this.plugin.app.vault.readBinary(targetFile);
      await this.plugin.saveEditableAnnotationState(targetFile, elements, binary);
    } catch (error) {
      console.warn("pdftion could not checkpoint editable annotations.", error);
    } finally {
      this.checkpointing = false;
      if (this.checkpointPending) {
        this.checkpointPending = false;
        if (!this.destroyed && this.file.path === targetPath) {
          this.scheduleAutoSave(250);
        }
      }
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
    this.plugin.settings.nativeTextSelectionAction = this.nativeTextSelectionAction;

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
      this.releaseOverlay(pageEl, overlay);
    }
  }

  private cleanupUnretainedOverlays(retained: Set<HTMLElement>): void {
    for (const [pageEl, overlay] of this.overlays.entries()) {
      if (!retained.has(pageEl)) {
        this.releaseOverlay(pageEl, overlay);
      }
    }
  }

  private releaseOverlay(pageEl: HTMLElement, overlay: PageOverlay): void {
    for (const [element, snapshot] of Array.from(this.hiddenNativeAnnotationStyles)) {
      if (pageEl.contains(element)) {
        if (element.isConnected) {
          this.restoreHiddenNativeAnnotationElement(element, snapshot);
        }
        this.hiddenNativeAnnotationStyles.delete(element);
      }
    }
    overlay.abort.abort();
    overlay.resizeObserver?.disconnect();
    if (overlay.redrawFrame !== null && overlay.redrawFrame !== undefined) {
      window.cancelAnimationFrame(overlay.redrawFrame);
    }
    if (overlay.geometryFrame !== null && overlay.geometryFrame !== undefined) {
      window.cancelAnimationFrame(overlay.geometryFrame);
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

function removeAllInkAnnotationsOnPages(pdf: PDFDocument, pageIndexes: Set<number>): void {
  if (pageIndexes.size === 0) {
    return;
  }
  const pages = pdf.getPages();
  for (const pageIndex of pageIndexes) {
    const annots = pages[pageIndex]?.node.Annots?.();
    if (!annots) {
      continue;
    }
    for (let index = annots.size() - 1; index >= 0; index -= 1) {
      const annot = annots.lookupMaybe(index, PDFDict);
      const subtype = annot?.lookupMaybe(PDFName.of("Subtype"), PDFName);
      if (subtype?.decodeText() === "Ink") {
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
  normalizeInkElementLayers(elements);
  const orderedElements = elements.sort(compareInkElements);

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

    if (element.presentation === "comment") {
      addStandardTextCommentAnnotation(pdf, page, element, size.width, size.height);
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
    const type = element.presentation === "comment" ? "Comment" : "Text";
    return `${type} (${element.id}): ${element.text.replace(/\s+/g, " ")}; x=${element.x.toFixed(3)}, y=${element.y.toFixed(3)}, size=${element.fontSize}, layer=${element.zIndex ?? 0}`;
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

function uint8ArrayToDataUrl(bytes: Uint8Array, mime: string): string {
  return arrayBufferToDataUrl(toArrayBufferCopy(bytes), mime);
}

function dataUrlMimeType(dataUrl: string): string {
  return dataUrl.match(/^data:([^;,]+)/i)?.[1]?.toLowerCase() ?? "image/png";
}

function dataUrlImageExtension(dataUrl: string): string {
  const mime = dataUrlMimeType(dataUrl);
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "image/svg+xml") return "svg";
  return "png";
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeout);
      resolve();
    };
    const timeout = window.setTimeout(finish, 120);
    window.requestAnimationFrame(finish);
  });
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

function matchEditableTaskMarker(text: string): { checked: boolean; length: number; marker: string } | null {
  const markdown = text.match(/^(?:[-*+]\s*)?\[([ xX✓✔])\]\s*/u);
  if (markdown) {
    const checked = !/^\s*$/u.test(markdown[1]);
    return { checked, length: markdown[0].length, marker: checked ? "☑" : "☐" };
  }
  const unicode = text.match(/^(☐|□|◻|⬜|🔲|☑|☒|✅|✓️?|✔️?)\s*/u);
  if (!unicode) {
    return null;
  }
  return {
    checked: /^(?:☑|☒|✅|✓|✔)/u.test(unicode[1]),
    length: unicode[0].length,
    marker: unicode[1]
  };
}

function matchEditableUnorderedListMarker(text: string): { length: number; marker: string } | null {
  const match = text.match(/^([*+\-•‣⁃◦●○▪▫■◆◇▶▸])\s+/u);
  return match ? { length: match[0].length, marker: match[1] } : null;
}

function matchEditableOrderedListMarker(text: string): { length: number; ordinal: number } | null {
  const match = text.match(/^(?:\(\s*)?(\d{1,4})(?:\s*\)|[.、．）])\s+/u);
  if (!match) {
    return null;
  }
  const ordinal = Number.parseInt(match[1], 10);
  return Number.isFinite(ordinal) ? { length: match[0].length, ordinal } : null;
}

function buildEditableListLefts(lines: EditableMarkdownLine[]): number[] {
  const lefts: number[] = [];
  for (const line of lines) {
    const text = line.runs.map((run) => run.text).join("").trim();
    if (!matchEditableTaskMarker(text) && !matchEditableUnorderedListMarker(text) && !matchEditableOrderedListMarker(text)) {
      continue;
    }
    const existing = lefts.findIndex((left) => Math.abs(left - line.left) <= 0.022);
    if (existing >= 0) {
      lefts[existing] = (lefts[existing] + line.left) / 2;
    } else {
      lefts.push(line.left);
    }
  }
  return lefts.sort((a, b) => a - b).slice(0, 7);
}

function getEditableListLevel(line: EditableMarkdownLine, lefts: number[]): number {
  return lefts
    .map((left, index) => ({ distance: Math.abs(left - line.left), index }))
    .sort((a, b) => a.distance - b.distance)[0]?.index ?? 0;
}

function isEditableCodeLine(line: EditableMarkdownLine, text: string): boolean {
  if (/^`{3,}|`{3,}$/u.test(text)) {
    return true;
  }
  const visibleLength = Math.max(1, text.replace(/\s+/gu, "").length);
  const monospaceLength = line.runs.reduce((total, run) => (
    /(?:mono|consolas|courier|code)/iu.test(run.fontFamily) ? total + run.text.replace(/\s+/gu, "").length : total
  ), 0);
  return visibleLength >= 3 && monospaceLength / visibleLength >= 0.78;
}

function isEditableCalloutTitle(text: string): boolean {
  return /^(?:ℹ️?|💡|⚠️?|❓)?\s*(?:note|tip|info|important|warning|caution|danger|注意|提示|信息|重要|警告|危险)(?:\s*[:：]|$)/iu.test(text);
}

function buildNativeExportDocument(
  pages: EditableMarkdownPage[],
  images: NoteDrawExportImage[] = []
): NativeExportDocument {
  const headingProfile = buildEditableMarkdownHeadingProfile(pages);
  const baseFontSize = headingProfile.baseFontSize;
  const nativePages = pages.map((page) => {
    const tables = detectEditableMarkdownTables(page.lines);
    const tableLines = new Set(tables.flatMap((table) => table.lines));
    const contentLines = page.lines.filter((line) => !tableLines.has(line));
    const listLefts = buildEditableListLefts(contentLines);
    const inlineGlyphsByLine = new Map<EditableMarkdownLine, NoteDrawExportImage[]>();
    const pageImages: NoteDrawExportImage[] = [];
    for (const image of images
      .filter((image) => image.pageIndex === page.pageIndex)
      .sort((a, b) => (a.y - b.y) || ((a.zIndex ?? 0) - (b.zIndex ?? 0)) || a.id.localeCompare(b.id))) {
      if (image.id.startsWith("pdf-inline-")) {
        const line = contentLines
          .map((candidate) => ({
            candidate,
            gap: candidate.left - (image.x + image.width),
            verticalDistance: Math.abs(
              image.y + image.height / 2 - (candidate.top + candidate.height / 2)
            )
          }))
          .filter(({ candidate, gap, verticalDistance }) => (
            gap >= -0.01 && gap <= 0.09 &&
            verticalDistance <= Math.max(0.012, candidate.height * 1.15)
          ))
          .sort((a, b) => (a.verticalDistance - b.verticalDistance) || (a.gap - b.gap))[0]?.candidate;
        if (line) {
          const glyphs = inlineGlyphsByLine.get(line) ?? [];
          glyphs.push(image);
          inlineGlyphsByLine.set(line, glyphs);
          if (!image.id.startsWith("pdf-inline-checkbox-")) {
            pageImages.push(image);
          }
          continue;
        }
      }
      pageImages.push(image);
    }
    const items: Array<
      | { kind: "image"; position: number; value: NoteDrawExportImage }
      | { kind: "line"; position: number; value: EditableMarkdownLine }
      | { kind: "table"; position: number; value: EditableMarkdownTable }
    > = [
      ...contentLines
        .map((line) => ({ kind: "line" as const, position: line.top, value: line })),
      ...tables.map((table) => ({ kind: "table" as const, position: table.top, value: table })),
      ...pageImages.map((image) => ({ kind: "image" as const, position: image.y + image.height / 2, value: image }))
    ].sort((a, b) => (a.position - b.position) || (a.kind === "image" ? -1 : 1));
    const blocks: NativeExportBlock[] = [];

    for (const item of items) {
      if (item.kind === "image") {
        blocks.push({
          height: item.value.height,
          image: item.value,
          kind: "image",
          left: item.value.x,
          runs: [],
          top: item.value.y,
          width: item.value.width
        });
        continue;
      }
      if (item.kind === "table") {
        blocks.push({
          height: item.value.bottom - item.value.top,
          kind: "table",
          left: item.value.left,
          runs: [],
          table: item.value,
          top: item.value.top,
          width: item.value.right - item.value.left
        });
        continue;
      }

      const line = item.value;
      const leadingImages = inlineGlyphsByLine.get(line);
      const text = line.runs.map((run) => run.text).join("").trim();
      if (!text) {
        continue;
      }
      const explicitHeading = text.match(/^(#{1,6})\s+/u);
      const detectedHeadingLevel = getEditableMarkdownHeadingLevel(line, baseFontSize, text, headingProfile);
      if (detectedHeadingLevel !== null) {
        blocks.push({
          height: line.height,
          headingLevel: detectedHeadingLevel,
          kind: "heading",
          leadingImages,
          left: line.left,
          runs: explicitHeading ? removeEditableRunPrefix(line.runs, explicitHeading[0].length) : line.runs,
          top: line.top,
          width: line.width
        });
        if (/^(?:分割线|水平线|horizontal\s+rule|separator)$/iu.test(text.replace(/\s+/g, " ").trim())) {
          blocks.push({ height: 0.002, kind: "separator", left: line.left, runs: [], top: line.top + line.height, width: line.width });
        }
        continue;
      }
      const taskMarker = matchEditableTaskMarker(text);
      const bullet = matchEditableUnorderedListMarker(text);
      const ordered = matchEditableOrderedListMarker(text);
      const quote = text.match(/^>\s*/u);
      const removePrefix = (prefix: string): EditableMarkdownTextRun[] => removeEditableRunPrefix(line.runs, prefix.length);
      const listLevel = getEditableListLevel(line, listLefts);
      const visualTaskImage = leadingImages?.find((image) => image.id.startsWith("pdf-inline-checkbox-"));
      const remainingLeadingImages = leadingImages?.filter((image) => image !== visualTaskImage);

      if (taskMarker || visualTaskImage) {
        blocks.push({
          checked: taskMarker?.checked ?? visualTaskImage?.id.startsWith("pdf-inline-checkbox-checked-") ?? false,
          height: line.height,
          kind: "task",
          leadingImages: remainingLeadingImages,
          left: line.left,
          listLevel,
          marker: taskMarker?.marker,
          runs: taskMarker ? removeEditableRunPrefix(line.runs, taskMarker.length) : line.runs,
          top: line.top,
          width: line.width
        });
      } else if (bullet) {
        blocks.push({
          height: line.height,
          kind: "unordered-list",
          leadingImages,
          left: line.left,
          listLevel,
          marker: bullet.marker,
          runs: removeEditableRunPrefix(line.runs, bullet.length),
          top: line.top,
          width: line.width
        });
      } else if (ordered) {
        blocks.push({
          height: line.height,
          kind: "ordered-list",
          leadingImages,
          left: line.left,
          listLevel,
          ordinal: ordered.ordinal,
          runs: removeEditableRunPrefix(line.runs, ordered.length),
          top: line.top,
          width: line.width
        });
      } else if (quote) {
        blocks.push({
          height: line.height,
          kind: "quote",
          leadingImages,
          left: line.left,
          runs: quote ? removePrefix(quote[0]) : line.runs,
          top: line.top,
          width: line.width
        });
      } else if (isEditableCodeLine(line, text)) {
        blocks.push({
          height: line.height,
          kind: "code",
          leadingImages,
          left: line.left,
          runs: line.runs.map((run) => ({ ...run, code: true })),
          top: line.top,
          width: line.width
        });
      } else if (isEditableCalloutTitle(text)) {
        blocks.push({
          height: line.height,
          kind: "callout-title",
          leadingImages,
          left: line.left,
          runs: line.runs,
          top: line.top,
          width: line.width
        });
      } else {
        const styledRuns = line.runs.map((run) => ({
          ...run,
          code: run.code || /(?:mono|consolas|courier|code)/i.test(run.fontFamily)
        }));
        blocks.push({ height: line.height, kind: "paragraph", leadingImages, left: line.left, runs: styledRuns, top: line.top, width: line.width });
      }
    }

    return { blocks, height: page.height, pageIndex: page.pageIndex, width: page.width };
  });
  return { baseFontSize, headingProfile, pages: nativePages };
}

function buildNativeExportDocumentFromVisualPages(pages: VisualConversionPage[]): NativeExportDocument {
  const editablePages = pages.map((page) => ({
    height: page.height,
    lines: page.lines,
    pageIndex: page.pageIndex,
    width: page.width
  }));
  const images: NoteDrawExportImage[] = pages.flatMap((page) => page.images
    .filter(isUsefulNativeExportImage)
    .map((image) => ({
      ...image,
      assetMime: dataUrlMimeType(image.dataUrl),
      assetName: `pdftion-image-${image.id}.${dataUrlImageExtension(image.dataUrl)}`,
      pageIndex: page.pageIndex
    })));
  return buildNativeExportDocument(editablePages, images);
}

function buildHtmlExportDocumentFromVisualPages(pages: VisualConversionPage[]): NativeExportDocument {
  const editablePages = pages.map((page) => ({
    height: page.height,
    lines: page.lines,
    pageIndex: page.pageIndex,
    width: page.width
  }));
  const images: NoteDrawExportImage[] = pages.flatMap((page) => page.images
    .filter(isUsefulHtmlExportImage)
    .map((image) => ({
      ...image,
      assetMime: dataUrlMimeType(image.dataUrl),
      assetName: `pdftion-image-${image.id}.${dataUrlImageExtension(image.dataUrl)}`,
      pageIndex: page.pageIndex
    })));
  return buildNativeExportDocument(editablePages, images);
}

function removeEditableRunPrefix(runs: EditableMarkdownTextRun[], prefixLength: number): EditableMarkdownTextRun[] {
  let remaining = prefixLength;
  return runs
    .map((run) => {
      if (remaining <= 0) {
        return { ...run };
      }
      const removed = Math.min(remaining, run.text.length);
      remaining -= removed;
      return { ...run, text: run.text.slice(removed) };
    })
    .filter((run) => run.text.length > 0);
}

function buildEditableMarkdown(
  file: TFile,
  pages: EditableMarkdownPage[],
  images: NoteDrawExportImage[] = [],
  targetPath = ""
): string {
  const document = buildNativeExportDocument(pages, images);
  const output: string[] = [];
  for (const page of document.pages) {
    for (const block of page.blocks) {
      const text = block.runs.map((run) => renderEditableMarkdownRun(run, document.baseFontSize, false, file)).join("").trim();
      const leadingVisuals = (block.leadingImages ?? [])
        .map((image) => renderMarkdownExportImage(file, image, targetPath))
        .filter(Boolean)
        .join(" ");
      const content = [leadingVisuals, text].filter(Boolean).join(" ");
      if (block.kind === "heading") {
        output.push(`${"#".repeat(block.headingLevel ?? 1)} ${content}`, "");
      } else if (block.kind === "paragraph") {
        output.push(content, "");
      } else if (block.kind === "unordered-list") {
        output.push(`${"    ".repeat(block.listLevel ?? 0)}- ${content}`, "");
      } else if (block.kind === "ordered-list") {
        output.push(`${"    ".repeat(block.listLevel ?? 0)}${block.ordinal ?? 1}. ${content}`, "");
      } else if (block.kind === "task") {
        output.push(`${"    ".repeat(block.listLevel ?? 0)}- [${block.checked ? "x" : " "}] ${content}`, "");
      } else if (block.kind === "quote") {
        output.push(`> ${content}`, "");
      } else if (block.kind === "callout-title") {
        output.push(`> ${getCommonCalloutIcon(block.runs.map((run) => run.text).join(""))} **${content}**`, "");
      } else if (block.kind === "callout-body") {
        output.push(`> ${text}`, "");
      } else if (block.kind === "code") {
        const raw = block.runs.map((run) => run.text).join("");
        const fence = raw.includes("```") ? "````" : "```";
        if (leadingVisuals) {
          output.push(leadingVisuals, "");
        }
        output.push(fence, raw, fence, "");
      } else if (block.kind === "separator") {
        output.push("---", "");
      } else if (block.kind === "table" && block.table) {
        output.push(...renderEditableMarkdownTable(block.table, document.baseFontSize, file), "");
      } else if (
        block.kind === "image" && block.image?.assetPath &&
        !block.image.id.startsWith("pdf-inline-")
      ) {
        output.push(renderMarkdownExportImage(file, block.image, targetPath), "");
      }
    }
  }
  return `${output.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

function getCommonCalloutIcon(title: string): string {
  const normalized = title.toLowerCase();
  if (/warn|caution|danger|警告|危险/u.test(normalized)) return "⚠️";
  if (/tip|success|技巧|提示/u.test(normalized)) return "💡";
  if (/question|help|问题|帮助/u.test(normalized)) return "❓";
  return "ℹ️";
}

function getRelativeMarkdownPath(fromFile: string, target: string): string {
  const fromParts = fromFile.replace(/\\/g, "/").split("/").filter(Boolean);
  const targetParts = target.replace(/\\/g, "/").split("/").filter(Boolean);
  fromParts.pop();
  while (fromParts.length > 0 && targetParts.length > 0 && fromParts[0] === targetParts[0]) {
    fromParts.shift();
    targetParts.shift();
  }
  return `${"../".repeat(fromParts.length)}${targetParts.join("/")}` || "./";
}

function escapeMarkdownImageAlt(value: string): string {
  return value.replace(/[\[\]\\]/g, "\\$&").replace(/\r?\n/g, " ");
}

function renderMarkdownExportImage(file: TFile, image: NoteDrawExportImage, targetPath: string): string {
  if (!image.assetPath) {
    return "";
  }
  const relativePath = getRelativeMarkdownPath(targetPath, image.assetPath);
  const alt = escapeMarkdownImageAlt(image.assetName || file.basename);
  const commonImage = `![${alt}](${escapeMarkdownLinkDestination(relativePath)})`;
  if (image.link) {
    const destination = normalizeMarkdownExportLinkDestination(image.link, file, targetPath);
    return destination ? `[${commonImage}](${escapeMarkdownLinkDestination(destination)})` : commonImage;
  }
  return `![[${escapeObsidianWikilink(image.assetPath)}]]`;
}

function detectEditableMarkdownTables(lines: EditableMarkdownLine[]): EditableMarkdownTable[] {
  const sorted = [...lines].sort((a, b) => (a.top - b.top) || (a.left - b.left));
  const tables: EditableMarkdownTable[] = [];
  let group: Array<{ cells: EditableMarkdownTableCell[]; line: EditableMarkdownLine }> = [];

  const flush = (): void => {
    if (group.length < 2) {
      group = [];
      return;
    }
    const columnCount = group[0].cells.length;
    const columnStarts = Array.from({ length: columnCount }, (_, columnIndex) => (
      group.reduce((sum, row) => sum + row.cells[columnIndex].left, 0) / group.length
    ));
    const measuredRight = Math.max(...group.flatMap((row) => row.cells.flatMap((cell) => cell.runs.map((run) => (
      (run.left ?? cell.left) + (run.width ?? 0)
    )))));
    const estimatedLastWidth = columnStarts.length > 1
      ? columnStarts[columnStarts.length - 1] - columnStarts[columnStarts.length - 2]
      : measuredRight - columnStarts[0];
    tables.push({
      bottom: Math.max(...group.map((row) => row.line.top + row.line.height)),
      columnStarts,
      left: Math.min(...group.flatMap((row) => row.cells.map((cell) => cell.left))),
      lines: group.map((row) => row.line),
      right: clamp(Math.max(measuredRight, columnStarts[columnStarts.length - 1] + estimatedLastWidth), 0, 0.98),
      rows: group.map((row) => row.cells),
      top: Math.min(...group.map((row) => row.line.top))
    });
    group = [];
  };

  for (const line of sorted) {
    const cells = splitEditableMarkdownTableRow(line);
    if (!cells) {
      flush();
      continue;
    }
    const previous = group[group.length - 1];
    const sameColumns = !previous || previous.cells.length === cells.length;
    const closeVertically = !previous || line.top - (previous.line.top + previous.line.height) <= 0.045;
    const aligned = !previous || cells.every((cell, index) => Math.abs(cell.left - previous.cells[index].left) <= 0.055);
    if (!sameColumns || !closeVertically || !aligned) {
      flush();
    }
    group.push({ cells, line });
  }
  flush();
  return tables;
}

function splitEditableMarkdownTableRow(line: EditableMarkdownLine): EditableMarkdownTableCell[] | null {
  const runs = line.runs
    .filter((run) => run.text.trim().length > 0 && typeof run.left === "number" && typeof run.width === "number")
    .sort((a, b) => (a.left ?? 0) - (b.left ?? 0));
  if (runs.length < 2) {
    return null;
  }
  const boundaries: number[] = [];
  for (let index = 1; index < runs.length; index += 1) {
    const previousRight = (runs[index - 1].left ?? line.left) + (runs[index - 1].width ?? 0);
    const nextLeft = runs[index].left ?? previousRight;
    if (nextLeft - previousRight >= 0.08) {
      boundaries.push((previousRight + nextLeft) / 2);
    }
  }
  if (boundaries.length === 0) {
    return null;
  }
  const cells: EditableMarkdownTableCell[] = Array.from({ length: boundaries.length + 1 }, () => ({ left: 1, runs: [] }));
  for (const run of runs) {
    const left = run.left ?? line.left;
    const cellIndex = boundaries.findIndex((boundary) => left < boundary);
    const targetIndex = cellIndex === -1 ? cells.length - 1 : cellIndex;
    cells[targetIndex].left = Math.min(cells[targetIndex].left, left);
    cells[targetIndex].runs.push(run);
  }
  return cells.every((cell) => cell.runs.length > 0) ? cells : null;
}

function renderEditableMarkdownTable(table: EditableMarkdownTable, baseFontSize: number, file?: TFile): string[] {
  const rows = table.rows.map((row) => row.map((cell) => (
    cell.runs
      .map((run) => renderEditableMarkdownRun(run, baseFontSize, true, file))
      .join("")
      .replace(/\s*\n\s*/g, " ")
      .trim() || " "
  )));
  if (rows.length === 0) {
    return [];
  }
  return [
    `| ${rows[0].join(" | ")} |`,
    `| ${rows[0].map(() => "---").join(" | ")} |`,
    ...rows.slice(1).map((row) => `| ${row.join(" | ")} |`)
  ];
}

function getEditableTableColumnWidths(table: EditableMarkdownTable, totalWidth: number): number[] {
  const starts = table.columnStarts;
  if (starts.length === 0) {
    return [];
  }
  const rawWidths = starts.map((start, index) => Math.max(0.01, (starts[index + 1] ?? table.right) - start));
  const rawTotal = rawWidths.reduce((sum, width) => sum + width, 0);
  return rawWidths.map((width) => totalWidth * width / Math.max(0.01, rawTotal));
}

function partitionMarkdownExportImages(
  pages: EditableMarkdownPage[],
  images: NoteDrawExportImage[]
): { floating: NoteDrawExportImage[]; inline: NoteDrawExportImage[] } {
  const pageByIndex = new Map(pages.map((page) => [page.pageIndex, page]));
  const floating: NoteDrawExportImage[] = [];
  const inline: NoteDrawExportImage[] = [];

  for (const image of images) {
    const page = pageByIndex.get(image.pageIndex);
    if (image.link || image.placement === "flow" || !page || page.lines.length === 0 || image.id.startsWith("native-page-")) {
      inline.push(image);
      continue;
    }
    if (image.placement === "floating" || isClearlyFloatingMarkdownRaster(page, image)) {
      floating.push(image);
      continue;
    }
    inline.push(image);
  }

  return { floating, inline };
}

function isClearlyFloatingMarkdownRaster(
  page: EditableMarkdownPage,
  image: NoteDrawExportImage
): boolean {
  if (!image.id.startsWith("pdf-raster-page-") || image.width * image.height > 0.035) {
    return false;
  }
  const imageArea = Math.max(0.0001, image.width * image.height);
  const overlapArea = page.lines.reduce((total, line) => {
    const overlapWidth = Math.max(0, Math.min(image.x + image.width, line.left + line.width) - Math.max(image.x, line.left));
    const overlapHeight = Math.max(0, Math.min(image.y + image.height, line.top + line.height) - Math.max(image.y, line.top));
    return total + overlapWidth * overlapHeight;
  }, 0);
  if (overlapArea / imageArea >= 0.12) {
    return true;
  }
  const textLeft = Math.min(...page.lines.map((line) => line.left));
  const textRight = Math.max(...page.lines.map((line) => line.left + line.width));
  const outsideTextColumn = image.x + image.width < textLeft - 0.01 || image.x > textRight + 0.01;
  const besideText = page.lines.some((line) => {
    const verticalOverlap = normalizedRangesOverlap(image.y, image.y + image.height, line.top, line.top + line.height, 0.006);
    const horizontalGap = Math.max(line.left - (image.x + image.width), image.x - (line.left + line.width), 0);
    return verticalOverlap && horizontalGap <= 0.03;
  });
  return outsideTextColumn && besideText;
}

function normalizedRangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
  padding = 0
): boolean {
  return startA < endB + padding && endA > startB - padding;
}

function normalizedRectsOverlap(
  xA: number,
  yA: number,
  widthA: number,
  heightA: number,
  xB: number,
  yB: number,
  widthB: number,
  heightB: number,
  padding = 0
): boolean {
  return normalizedRangesOverlap(xA, xA + widthA, xB, xB + widthB, padding) &&
    normalizedRangesOverlap(yA, yA + heightA, yB, yB + heightB, padding);
}

interface EditableTextFragment {
  bottom: number;
  left: number;
  right: number;
  run: EditableMarkdownTextRun;
  top: number;
}

interface ExportLinkRect {
  bottom: number;
  href: string;
  left: number;
  right: number;
  top: number;
}

function collectEditableMarkdownLines(overlay: PageOverlay): EditableMarkdownLine[] {
  const overlayRect = overlay.pageEl.getBoundingClientRect();
  const textSpans = Array.from(overlay.pageEl.querySelectorAll<HTMLElement>(".textLayer span"));
  const candidates = textSpans.length > 0
    ? textSpans
    : Array.from(overlay.pageEl.querySelectorAll<HTMLElement>("[data-canvas-width]"));
  const linkRects = collectDomExportLinkRects(overlay.pageEl);
  const fragments: EditableTextFragment[] = [];

  for (const span of candidates) {
    const text = (span.textContent ?? "").replace(/\u00a0/g, " ").replace(/[\t\r\n ]+/g, " ");
    if (!text.trim()) {
      continue;
    }
    const rect = span.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) {
      continue;
    }
    const style = activeWindow.getComputedStyle(span);
    const fontSize = Number.parseFloat(style.fontSize || "") || Math.max(4, rect.height * 0.82);
    const fontWeight = Number.parseInt(style.fontWeight || "400", 10);
    const decoration = style.textDecorationLine || style.textDecoration || "";
    const directLink = getDomExportLinkTarget(span.closest<HTMLElement>(
      "a[href], [data-href], [data-linkpath], [data-dest], [data-url]"
    ));
    fragments.push({
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      run: {
        bold: fontWeight >= 600 || /bold/i.test(style.fontWeight),
        color: cssColorToHex(style.color) ?? "#000000",
        fontFamily: style.fontFamily || "",
        fontSize,
        italic: /italic|oblique/i.test(style.fontStyle),
        link: directLink ?? findOverlappingExportLink(rect, linkRects),
        opacity: Number.parseFloat(style.opacity || "1") || 1,
        strike: /line-through/i.test(decoration),
        text,
        underline: /underline/i.test(decoration)
      },
      top: rect.top
    });
  }

  return buildEditableLinesFromFragments(fragments, {
    height: overlay.cssHeight,
    left: overlayRect.left,
    top: overlayRect.top,
    width: overlay.cssWidth
  });
}

function collectDomExportLinkRects(pageEl: HTMLElement): ExportLinkRect[] {
  const links = Array.from(pageEl.querySelectorAll<HTMLElement>(
    ".annotationLayer a, .linkAnnotation a, a[data-annotation-id], [data-href], [data-linkpath], [data-dest], [data-url]"
  ));
  return links.flatMap((link) => {
    const href = getDomExportLinkTarget(link);
    const rect = link.getBoundingClientRect();
    return href && rect.width > 0 && rect.height > 0
      ? [{ bottom: rect.bottom, href, left: rect.left, right: rect.right, top: rect.top }]
      : [];
  });
}

function getDomExportLinkTarget(element: HTMLElement | null): string | undefined {
  if (!element) {
    return undefined;
  }
  for (const attribute of ["href", "data-href", "data-linkpath", "data-url"]) {
    const value = element.getAttribute(attribute)?.trim();
    if (value && value !== "#") {
      return value;
    }
  }
  const destination = element.getAttribute("data-dest")?.trim();
  return destination ? `#nameddest=${encodeURIComponent(destination)}` : undefined;
}

function findOverlappingExportLink(
  rect: Pick<DOMRect, "bottom" | "left" | "right" | "top">,
  links: ExportLinkRect[]
): string | undefined {
  const width = Math.max(1, rect.right - rect.left);
  const height = Math.max(1, rect.bottom - rect.top);
  return links
    .map((link) => {
      const overlapWidth = Math.max(0, Math.min(rect.right, link.right) - Math.max(rect.left, link.left));
      const overlapHeight = Math.max(0, Math.min(rect.bottom, link.bottom) - Math.max(rect.top, link.top));
      return { href: link.href, ratio: overlapWidth * overlapHeight / (width * height) };
    })
    .filter((candidate) => candidate.ratio >= 0.18)
    .sort((a, b) => b.ratio - a.ratio)[0]?.href;
}

async function collectPdfJsEditableLines(
  pageView: NativePdfPageViewLike | null,
  overlay: PageOverlay
): Promise<EditableMarkdownLine[]> {
  const pdfPage = pageView?.pdfPage;
  const viewport = pageView?.viewport;
  if (!pdfPage?.getTextContent || !viewport?.transform || viewport.transform.length < 6) {
    return [];
  }
  try {
    const content = await Promise.race([
      pdfPage.getTextContent(),
      sleepMs(8_000).then(() => null)
    ]);
    if (!content) {
      console.debug("pdftion timed out reading the native PDF text model; using the rendered text layer.");
      return [];
    }
    const viewportWidth = Math.max(1, viewport.width ?? overlay.cssWidth);
    const viewportHeight = Math.max(1, viewport.height ?? overlay.cssHeight);
    const scaleX = overlay.cssWidth / viewportWidth;
    const scaleY = overlay.cssHeight / viewportHeight;
    const annotations = pdfPage.getAnnotations
      ? await Promise.race([
        pdfPage.getAnnotations({ intent: "display" }).catch(() => []),
        sleepMs(4_000).then(() => null)
      ])
      : [];
    if (!annotations) {
      console.debug("pdftion timed out reading native PDF links; continuing without link metadata.");
    }
    const links = (annotations ?? []).flatMap((annotation) => {
      const href = getPdfAnnotationExportLink(annotation);
      const rect = annotation.rect;
      if (!href || !rect || rect.length < 4) {
        return [];
      }
      const first = applyPdfMatrix(viewport.transform ?? [], rect[0], rect[1]);
      const second = applyPdfMatrix(viewport.transform ?? [], rect[2], rect[3]);
      return [{
        bottom: Math.max(first.y, second.y) * scaleY,
        href,
        left: Math.min(first.x, second.x) * scaleX,
        right: Math.max(first.x, second.x) * scaleX,
        top: Math.min(first.y, second.y) * scaleY
      }];
    });
    const fragments: EditableTextFragment[] = [];
    for (const item of content.items ?? []) {
      const text = (item.str ?? "").replace(/\u00a0/g, " ").replace(/[\t\r\n ]+/g, " ");
      if (!text.trim() || !item.transform || item.transform.length < 6) {
        continue;
      }
      const transform = multiplyPdfMatrices(viewport.transform, item.transform);
      const fontHeight = Math.max(
        4,
        Math.hypot(transform[2] ?? 0, transform[3] ?? 0),
        (item.height ?? 0) * (viewport.scale ?? 1)
      );
      const left = (transform[4] ?? 0) * scaleX;
      const top = ((transform[5] ?? 0) - fontHeight) * scaleY;
      const width = Math.max(1, (item.width ?? text.length * fontHeight * 0.52) * (viewport.scale ?? 1) * scaleX);
      const height = Math.max(1, fontHeight * scaleY);
      const fontName = item.fontName ?? "";
      const fontFamily = content.styles?.[fontName]?.fontFamily ?? fontName;
      const rect = { bottom: top + height, left, right: left + width, top };
      fragments.push({
        ...rect,
        run: {
          bold: /bold|black|semibold|demi/i.test(fontName),
          color: "#000000",
          fontFamily,
          fontSize: fontHeight * Math.min(scaleX, scaleY),
          italic: /italic|oblique/i.test(fontName),
          link: findOverlappingExportLink(rect, links),
          opacity: 1,
          strike: false,
          text,
          underline: false
        }
      });
    }
    return buildEditableLinesFromFragments(fragments, {
      height: overlay.cssHeight,
      left: 0,
      top: 0,
      width: overlay.cssWidth
    });
  } catch (error) {
    console.debug("pdftion could not read the native PDF text model for conversion.", error);
    return [];
  }
}

function getPdfAnnotationExportLink(annotation: NativePdfAnnotationLike): string | undefined {
  const url = (annotation.url ?? annotation.unsafeUrl)?.trim();
  if (url) {
    return url;
  }
  const destination = typeof annotation.dest === "string"
    ? annotation.dest.trim()
    : Array.isArray(annotation.dest) && typeof annotation.dest[0] === "string"
      ? annotation.dest[0].trim()
      : "";
  return destination ? `#nameddest=${encodeURIComponent(destination)}` : undefined;
}

function multiplyPdfMatrices(left: number[], right: number[]): number[] {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5]
  ];
}

function applyPdfMatrix(matrix: number[], x: number, y: number): { x: number; y: number } {
  return {
    x: matrix[0] * x + matrix[2] * y + matrix[4],
    y: matrix[1] * x + matrix[3] * y + matrix[5]
  };
}

function buildEditableLinesFromFragments(
  fragments: EditableTextFragment[],
  bounds: { height: number; left: number; top: number; width: number }
): EditableMarkdownLine[] {

  const sorted = fragments.sort((a, b) => (a.top - b.top) || (a.left - b.left));
  const lines: Array<{ bottom: number; fragments: EditableTextFragment[]; left: number; right: number; top: number }> = [];
  for (const fragment of sorted) {
    const fragmentHeight = Math.max(1, fragment.bottom - fragment.top);
    const existing = lines
      .map((line) => {
        const overlap = Math.max(0, Math.min(line.bottom, fragment.bottom) - Math.max(line.top, fragment.top));
        const lineHeight = Math.max(1, line.bottom - line.top);
        const overlapRatio = overlap / Math.min(lineHeight, fragmentHeight);
        const baselineDistance = Math.abs(line.bottom - fragment.bottom);
        return { baselineDistance, line, overlapRatio };
      })
      .filter(({ baselineDistance, overlapRatio }) => (
        overlapRatio >= 0.24 || baselineDistance <= Math.max(4, fragment.run.fontSize * 0.72)
      ))
      .sort((a, b) => (b.overlapRatio - a.overlapRatio) || (a.baselineDistance - b.baselineDistance))[0]?.line;
    if (existing) {
      existing.fragments.push(fragment);
      existing.bottom = Math.max(existing.bottom, fragment.bottom);
      existing.left = Math.min(existing.left, fragment.left);
      existing.right = Math.max(existing.right, fragment.right);
      existing.top = Math.min(existing.top, fragment.top);
    } else {
      lines.push({ bottom: fragment.bottom, fragments: [fragment], left: fragment.left, right: fragment.right, top: fragment.top });
    }
  }

  return lines
    .sort((a, b) => (a.top - b.top) || (a.left - b.left))
    .map((line) => {
      const fragments = line.fragments.sort((a, b) => a.left - b.left);
      let previous: typeof fragments[number] | null = null;
      const runs = fragments.map((fragment) => {
        const run = { ...fragment.run };
        const gap = previous ? fragment.left - previous.right : 0;
        const previousText = previous?.run.text ?? "";
        const startsLatin = /^[A-Za-z0-9]/u.test(run.text);
        const endsLatin = /[A-Za-z0-9]$/u.test(previousText);
        const visibleWordGap = gap > Math.max(0.18, run.fontSize * 0.035);
        const joinsPunctuation = /^[,.;:!?，。；：！？、)\]}]/u.test(run.text) || /[(\[{]$/u.test(previousText);
        if (previous && visibleWordGap && !joinsPunctuation && (startsLatin || endsLatin || gap > run.fontSize * 0.22)) {
          run.text = ` ${run.text}`;
        }
        run.left = clamp((fragment.left - bounds.left) / Math.max(1, bounds.width), 0, 1);
        run.width = clamp(fragment.right - fragment.left, 0, bounds.width) / Math.max(1, bounds.width);
        previous = fragment;
        return run;
      });
      return {
        height: clamp((line.bottom - line.top) / Math.max(1, bounds.height), 0.001, 1),
        left: clamp((line.left - bounds.left) / Math.max(1, bounds.width), 0, 1),
        runs,
        top: clamp((line.top - bounds.top) / Math.max(1, bounds.height), 0, 1),
        width: clamp((line.right - line.left) / Math.max(1, bounds.width), 0.001, 1)
      };
    })
    .filter((line) => line.runs.some((run) => run.text.length > 0));
}

function selectCompleteEditableLines(
  renderedLines: EditableMarkdownLine[],
  pdfLines: EditableMarkdownLine[]
): EditableMarkdownLine[] {
  const textLength = (lines: EditableMarkdownLine[]): number => lines.reduce(
    (total, line) => total + line.runs.reduce((lineTotal, run) => lineTotal + run.text.replace(/\s+/g, "").length, 0),
    0
  );
  const hasLinks = (lines: EditableMarkdownLine[]): boolean => lines.some((line) => line.runs.some((run) => Boolean(run.link)));
  if (hasLinks(pdfLines) && !hasLinks(renderedLines)) {
    return enrichEditableLineMetadata(pdfLines, renderedLines);
  }
  if (textLength(pdfLines) <= textLength(renderedLines) * 1.04) {
    return enrichEditableLineMetadata(renderedLines, pdfLines);
  }
  return enrichEditableLineMetadata(pdfLines, renderedLines);
}

function enrichEditableLineMetadata(
  primaryLines: EditableMarkdownLine[],
  supplementalLines: EditableMarkdownLine[]
): EditableMarkdownLine[] {
  const supplementalRuns = supplementalLines.flatMap((line) => line.runs.map((run) => ({ line, run })));
  return primaryLines.map((line) => ({
    ...line,
    runs: line.runs.map((run) => {
      const runLeft = run.left ?? line.left;
      const runRight = runLeft + (run.width ?? line.width);
      const runWidth = Math.max(0.0001, runRight - runLeft);
      const runHeight = Math.max(0.0001, line.height);
      const normalizedText = run.text.replace(/\s+/gu, "").trim();
      const matching = supplementalRuns
        .map((candidate) => {
          const candidateLeft = candidate.run.left ?? candidate.line.left;
          const candidateRight = candidateLeft + (candidate.run.width ?? candidate.line.width);
          const horizontal = Math.max(0, Math.min(runRight, candidateRight) - Math.max(runLeft, candidateLeft));
          const vertical = Math.max(
            0,
            Math.min(line.top + line.height, candidate.line.top + candidate.line.height) - Math.max(line.top, candidate.line.top)
          );
          const candidateWidth = Math.max(0.0001, candidateRight - candidateLeft);
          const candidateHeight = Math.max(0.0001, candidate.line.height);
          const horizontalRatio = Math.max(horizontal / runWidth, horizontal / candidateWidth);
          const verticalRatio = Math.max(vertical / runHeight, vertical / candidateHeight);
          const candidateText = candidate.run.text.replace(/\s+/gu, "").trim();
          const textMatches = normalizedText.length > 0 && normalizedText === candidateText;
          const geometricOverlap = horizontalRatio * verticalRatio;
          const score = geometricOverlap + (textMatches ? 2 : 0) + (candidate.run.link ? 0.05 : 0);
          return { candidate, geometricOverlap, score, textMatches };
        })
        .sort((a, b) => b.score - a.score)[0];
      const supplemental = matching && matching.score >= 0.12 ? matching.candidate.run : null;
      const supplementalLink = matching && (matching.textMatches || matching.geometricOverlap >= 0.35)
        ? supplemental?.link
        : undefined;
      const link = run.link ?? supplementalLink;
      return supplemental
        ? {
            ...run,
            bold: run.bold || supplemental.bold,
            color: isNearDefaultTextColor(run.color) && !isNearDefaultTextColor(supplemental.color)
              ? supplemental.color
              : run.color,
            fontFamily: run.fontFamily || supplemental.fontFamily,
            italic: run.italic || supplemental.italic,
            link,
            opacity: run.opacity ?? supplemental.opacity,
            strike: run.strike || supplemental.strike,
            underline: run.underline || supplemental.underline || Boolean(link)
          }
        : run;
    })
  }));
}

function collectInkTextExportLines(elements: InkElement[], overlay: PageOverlay): EditableMarkdownLine[] {
  const lines: EditableMarkdownLine[] = [];
  for (const element of elements) {
    if (element.kind !== "text" || element.pageIndex !== overlay.pageIndex || !element.text.trim()) {
      continue;
    }
    const fontSize = Math.max(4, element.fontSize);
    const sourceLines = element.text.split(/\r?\n/);
    for (const [lineIndex, sourceLine] of sourceLines.entries()) {
      const text = `${element.presentation === "comment" ? "💬 " : ""}${sourceLine}`.trimEnd();
      if (!text.trim()) {
        continue;
      }
      const width = clamp(Math.max(fontSize, text.length * fontSize * 0.58) / Math.max(1, overlay.cssWidth), 0.01, 1 - element.x);
      const height = clamp(fontSize * 1.2 / Math.max(1, overlay.cssHeight), 0.002, 1);
      const top = clamp(element.y + lineIndex * height, 0, 1 - height);
      lines.push({
        height,
        left: element.x,
        runs: [{
          bold: false,
          color: element.color,
          fontFamily: element.fontFamily ?? "sans-serif",
          fontSize,
          italic: false,
          left: element.x,
          opacity: element.opacity,
          strike: false,
          text,
          underline: false,
          width
        }],
        top,
        width
      });
    }
  }
  return lines;
}

function mergeInkTextExportLines(
  lines: EditableMarkdownLine[],
  inkLines: EditableMarkdownLine[]
): EditableMarkdownLine[] {
  const merged = [...lines];
  for (const inkLine of inkLines) {
    const text = inkLine.runs.map((run) => run.text).join("").trim();
    const duplicate = merged.some((line) => {
      const existingText = line.runs.map((run) => run.text).join("").trim();
      return text === existingText && normalizedRectsOverlap(
        inkLine.left,
        inkLine.top,
        inkLine.width,
        inkLine.height,
        line.left,
        line.top,
        line.width,
        line.height,
        0.012
      );
    });
    if (!duplicate) {
      merged.push(inkLine);
    }
  }
  return merged.sort((a, b) => (a.top - b.top) || (a.left - b.left));
}

function getEditableMarkdownHeadingLevel(
  line: EditableMarkdownLine,
  baseFontSize: number,
  text: string,
  headingProfile?: EditableMarkdownHeadingProfile
): number | null {
  const explicit = text.match(/^(#{1,6})\s+/u);
  if (explicit) {
    return explicit[1].length;
  }
  if (!text || text.length > 120 || baseFontSize <= 0) {
    return null;
  }
  const effectiveBaseFontSize = headingProfile?.baseFontSize ?? baseFontSize;
  const largestFontSize = Math.max(...line.runs.map((run) => run.fontSize), effectiveBaseFontSize);
  const ratio = largestFontSize / effectiveBaseFontSize;
  const visibleLength = Math.max(1, text.replace(/\s+/gu, "").length);
  const boldLength = line.runs.reduce((total, run) => (
    run.bold ? total + run.text.replace(/\s+/gu, "").length : total
  ), 0);
  const compactBoldHeading = boldLength / visibleLength >= 0.72 && text.length <= 72 && line.width <= 0.82;
  const hasListMarker = Boolean(
    matchEditableTaskMarker(text) ||
    matchEditableUnorderedListMarker(text) ||
    matchEditableOrderedListMarker(text) ||
    /^>\s*/u.test(text)
  );
  if (ratio < 1.12 && !compactBoldHeading) {
    return null;
  }
  if (hasListMarker && ratio < 1.34) {
    return null;
  }
  const absoluteLevel = ratio >= 1.85
    ? 1
    : ratio >= 1.58
      ? 2
      : ratio >= 1.36
        ? 3
        : ratio >= 1.22
          ? 4
          : ratio >= 1.12
            ? 5
            : 6;
  if (headingProfile && headingProfile.ratios.length > 0) {
    const nearest = headingProfile.ratios
      .map((profileRatio, index) => ({ distance: Math.abs(profileRatio - ratio), index, profileRatio }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (nearest && nearest.distance <= Math.max(0.03, nearest.profileRatio * 0.025)) {
      return Math.min(6, nearest.index + 1);
    }
  }
  return absoluteLevel;
}

function buildEditableMarkdownHeadingProfile(
  pages: Array<Pick<EditableMarkdownPage, "lines">>
): EditableMarkdownHeadingProfile {
  const baseFontSize = getEditableMarkdownDocumentBaseFontSize(pages);
  const ratios = pages.flatMap((page) => {
    return page.lines.flatMap((line) => {
      const text = line.runs.map((run) => run.text).join("").trim();
      if (!text || text.length > 120) {
        return [];
      }
      const ratio = Math.max(...line.runs.map((run) => run.fontSize), baseFontSize) / baseFontSize;
      const visibleLength = Math.max(1, text.replace(/\s+/gu, "").length);
      const boldLength = line.runs.reduce((total, run) => (
        run.bold ? total + run.text.replace(/\s+/gu, "").length : total
      ), 0);
      const plausibleShape = line.width <= 0.92 && (
        ratio >= 1.12 || (boldLength / visibleLength >= 0.72 && text.length <= 72)
      );
      const listLike = Boolean(
        matchEditableTaskMarker(text) ||
        matchEditableUnorderedListMarker(text) ||
        matchEditableOrderedListMarker(text) ||
        /^>\s*/u.test(text)
      );
      return plausibleShape && (!listLike || ratio >= 1.34) ? [ratio] : [];
    });
  }).sort((a, b) => b - a);
  const clusters: Array<{ count: number; ratio: number }> = [];
  for (const ratio of ratios) {
    const cluster = clusters.find((candidate) => (
      Math.abs(candidate.ratio - ratio) <= Math.max(0.025, candidate.ratio * 0.018)
    ));
    if (cluster) {
      cluster.ratio = (cluster.ratio * cluster.count + ratio) / (cluster.count + 1);
      cluster.count += 1;
    } else {
      clusters.push({ count: 1, ratio });
    }
  }
  return {
    baseFontSize,
    ratios: clusters
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 6)
      .map((cluster) => cluster.ratio)
  };
}

function getEditableMarkdownDocumentBaseFontSize(
  pages: Array<Pick<EditableMarkdownPage, "lines">>
): number {
  const clusters: Array<{ size: number; weight: number }> = [];
  for (const run of pages.flatMap((page) => page.lines.flatMap((line) => line.runs))) {
    if (!Number.isFinite(run.fontSize) || run.fontSize <= 0) {
      continue;
    }
    const weight = Math.max(1, run.text.replace(/\s+/gu, "").length);
    const cluster = clusters.find((candidate) => (
      Math.abs(candidate.size - run.fontSize) <= Math.max(0.18, candidate.size * 0.015)
    ));
    if (cluster) {
      cluster.size = (cluster.size * cluster.weight + run.fontSize * weight) / (cluster.weight + weight);
      cluster.weight += weight;
    } else {
      clusters.push({ size: run.fontSize, weight });
    }
  }
  return clusters.sort((a, b) => (b.weight - a.weight) || (a.size - b.size))[0]?.size ?? 16;
}

function renderEditableMarkdownRun(
  run: EditableMarkdownTextRun,
  baseFontSize = 16,
  suppressFontSize = false,
  sourceFile?: TFile
): string {
  const validLink = normalizeSafeMarkdownExportLink(run.link);
  const leadingSpace = run.text.match(/^\s*/u)?.[0] ?? "";
  const trailingSpace = run.text.match(/\s*$/u)?.[0] ?? "";
  const coreText = run.text.slice(leadingSpace.length, run.text.length - trailingSpace.length);
  if (!coreText) {
    return run.text;
  }
  const codeDelimiter = coreText.includes("``") ? "```" : coreText.includes("`") ? "``" : "`";
  let content = run.code
    ? `${codeDelimiter}${coreText}${codeDelimiter}`
    : escapeMarkdownInline(coreText);
  if (!run.code && run.bold && run.italic) {
    content = `***${content}***`;
  } else if (!run.code && run.bold) {
    content = `**${content}**`;
  } else if (!run.code && run.italic) {
    content = `*${content}*`;
  }
  if (!run.code && run.strike) {
    content = `~~${content}~~`;
  }
  if (validLink) {
    const obsidianTarget = getObsidianOpenFileTarget(validLink);
    const pdfTarget = sourceFile && /^#(?:page=\d+|nameddest=)/i.test(validLink)
      ? `${sourceFile.path}${validLink}`
      : null;
    if (obsidianTarget || pdfTarget) {
      content = `[[${escapeObsidianWikilink(obsidianTarget ?? pdfTarget ?? "")}|${escapeObsidianWikilink(coreText)}]]`;
    } else {
      content = `[${content}](${escapeMarkdownLinkDestination(validLink)})`;
    }
  }
  return `${leadingSpace}${content}${trailingSpace}`;
}

function normalizeSafeMarkdownExportLink(raw: string | undefined): string | null {
  const value = raw?.trim() ?? "";
  if (!value || /[\u0000-\u001f\u007f]/u.test(value) || /^(?:data|javascript|vbscript):/i.test(value)) {
    return null;
  }
  return value;
}

function normalizeMarkdownExportLinkDestination(raw: string, sourceFile: TFile, targetPath: string): string | null {
  const value = normalizeSafeMarkdownExportLink(raw);
  if (!value) {
    return null;
  }
  return /^#(?:page=\d+|nameddest=)/i.test(value)
    ? `${getRelativeMarkdownPath(targetPath, sourceFile.path)}${value}`
    : value;
}

function getObsidianOpenFileTarget(value: string): string | null {
  if (!/^obsidian:\/\/open\?/i.test(value)) {
    return null;
  }
  try {
    const query = value.slice(value.indexOf("?") + 1);
    return new URLSearchParams(query).get("file")?.trim().replace(/\\/g, "/") || null;
  } catch {
    return null;
  }
}

function isNearDefaultTextColor(value: string): boolean {
  const match = value.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) {
    return value.toLowerCase() === "black";
  }
  return Math.max(Number.parseInt(match[1], 16), Number.parseInt(match[2], 16), Number.parseInt(match[3], 16)) <= 72;
}

function escapeMarkdownInline(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/([`*_[\]{}<>#+!|~])/g, "\\$1");
}

function escapeMarkdownLinkDestination(value: string): string {
  return value.trim().replace(/\\/g, "%5C").replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29");
}

function escapeObsidianWikilink(value: string): string {
  return value.replace(/\\/g, "/").replace(/\|/g, "\\|").replace(/\]/g, "\\]");
}

function getNoteDrawWriteApi(): NoteDrawWriteApi | null {
  const runtime = activeWindow.NoteDraw;
  if (runtime?.v1 && typeof runtime.v1.writeDrawings === "function") {
    return runtime.v1;
  }
  return runtime && typeof runtime.writeDrawings === "function" ? runtime : null;
}

function buildNoteDrawExportData(
  sourcePath: string,
  pages: Array<Pick<VisualConversionPage, "height" | "pageIndex" | "width">>,
  elements: InkElement[],
  images: NoteDrawExportImage[] = []
): NoteDrawExportData {
  const sortedPages = [...pages].sort((a, b) => a.pageIndex - b.pageIndex);
  const logicalWidth = 1000;
  const logicalGap = logicalWidth * VISUAL_EXPORT_PAGE_GAP_RATIO;
  const layouts = new Map<number, { height: number; top: number }>();
  let top = 0;
  for (const page of sortedPages) {
    const height = logicalWidth * page.height / Math.max(1, page.width);
    layouts.set(page.pageIndex, { height, top });
    top += height + logicalGap;
  }
  const totalHeight = Math.max(1, top - (sortedPages.length > 0 ? logicalGap : 0));
  const exported: NoteDrawExportStroke[] = [];

  const orderedItems: Array<
    | { element: InkStroke; kind: "stroke"; pageIndex: number; zIndex: number }
    | { image: NoteDrawExportImage; kind: "image"; pageIndex: number; zIndex: number }
  > = [
    ...elements
      .filter((element): element is InkStroke => element.kind === "stroke" && element.points.length > 0)
      .map((element) => ({ element, kind: "stroke" as const, pageIndex: element.pageIndex, zIndex: element.zIndex ?? 0 })),
    ...images.map((image) => ({ image, kind: "image" as const, pageIndex: image.pageIndex, zIndex: image.zIndex ?? 0 }))
  ].sort((a, b) => (a.pageIndex - b.pageIndex) || (a.zIndex - b.zIndex));

  for (const item of orderedItems) {
    const layout = layouts.get(item.pageIndex);
    if (!layout) {
      continue;
    }
    const mapPoint = (point: InkPoint, timestamp: number): NoteDrawExportPoint => ({
      t: timestamp,
      x: clamp(point.x, 0, 1),
      y: clamp((layout.top + point.y * layout.height) / totalHeight, 0, 1)
    });

    if (item.kind === "stroke") {
      const element = item.element;
      const createdAt = element.createdAt ?? Date.now();
      exported.push({
        brush: element.tool === "highlight" ? "watercolor" : "pen",
        color: element.color,
        count: 1,
        opacity: element.opacity,
        points: element.points.map((point, index) => mapPoint(point, createdAt + index)),
        width: clamp(element.width, 0.5, 80)
      });
      continue;
    }

    const image = item.image;
    exported.push({
      assetMime: image.assetMime,
      assetName: image.assetName,
      assetPath: image.assetPath,
      assetSize: image.assetSize,
      brush: "pen",
      color: "#1971c2",
      count: 1,
      embedType: "image",
      exportImageDataUrl: image.dataUrl,
      kind: "embed",
      opacity: image.opacity,
      points: [{
        t: Date.now(),
        x: clamp(image.x, 0, 1),
        y: clamp((layout.top + image.y * layout.height) / totalHeight, 0, 1)
      }],
      previewHeight: Math.max(40, image.height * layout.height),
      previewWidth: Math.max(80, image.width * logicalWidth),
      text: image.assetName,
      width: 3
    });
  }

  return {
    sourcePath,
    strokes: exported,
    version: 3,
    visible: true,
    webEdits: []
  };
}

function collectNoteDrawExportImages(pages: VisualConversionPage[], elements: InkElement[]): NoteDrawExportImage[] {
  const imagesById = new Map<string, NoteDrawExportImage>();
  for (const page of pages) {
    const usesFullPageImage = page.lines.length === 0 && page.sourceVisualRatio >= 0.045;
    for (const image of page.images) {
      if (usesFullPageImage && image.id.startsWith("pdf-raster-page-")) {
        continue;
      }
      imagesById.set(image.id, {
        ...image,
        assetMime: dataUrlMimeType(image.dataUrl),
        assetName: `pdftion-image-${image.id}.${dataUrlImageExtension(image.dataUrl)}`,
        placement: image.id.startsWith("pdftion-stroke-")
          ? "ink-preview"
          : image.id.startsWith("pdftion-cover-")
            ? "floating"
            : image.id.startsWith("native-page-")
              ? "flow"
              : undefined,
        pageIndex: page.pageIndex
      });
    }
  }
  for (const image of elements
    .filter((element): element is InkImage => element.kind === "image")
    .map((image) => ({
      assetMime: dataUrlMimeType(image.dataUrl),
      assetName: `pdftion-image-${image.id}.${dataUrlImageExtension(image.dataUrl)}`,
      dataUrl: image.dataUrl,
      height: image.height,
      id: image.id,
      opacity: image.opacity,
      pageIndex: image.pageIndex,
      placement: "floating" as const,
      width: image.width,
      x: image.x,
      y: image.y,
      zIndex: image.zIndex
    }))) {
    imagesById.set(image.id, image);
  }
  const images = Array.from(imagesById.values());

  for (const page of pages) {
    const usesFullPageImage = page.lines.length === 0 && page.sourceVisualRatio >= 0.045;
    if (!usesFullPageImage) {
      continue;
    }
    images.push({
      assetMime: "image/png",
      assetName: `pdf-page-${page.pageIndex + 1}.png`,
      dataUrl: uint8ArrayToDataUrl(page.bytes, "image/png"),
      height: 1,
      id: `native-page-${page.pageIndex + 1}`,
      opacity: 1,
      pageIndex: page.pageIndex,
      placement: "flow",
      width: 1,
      x: 0,
      y: 0,
      zIndex: 0
    });
  }
  return images;
}

function isUsefulMarkdownExportImage(image: NoteDrawExportImage): boolean {
  return !image.id.startsWith("html-visual-page-") &&
    image.placement !== "ink-preview" &&
    (image.id.startsWith("pdf-inline-") || (
      image.id.startsWith("pdf-raster-page-")
        ? estimatedDataUrlBytes(image.dataUrl) >= 2_500 || image.width * image.height >= 0.004
        : true
    ));
}

function isUsefulNativeExportImage(image: VisualConversionImage): boolean {
  if (image.id.startsWith("pdf-inline-")) {
    return false;
  }
  if (!image.id.startsWith("pdf-raster-page-")) {
    return true;
  }
  const estimatedBytes = estimatedDataUrlBytes(image.dataUrl);
  return estimatedBytes >= 16_000 || image.width * image.height >= 0.12;
}

function isUsefulHtmlExportImage(image: VisualConversionImage): boolean {
  if (image.id.startsWith("pdf-inline-")) {
    return false;
  }
  if (!image.id.startsWith("pdf-raster-page-")) {
    return true;
  }
  const estimatedBytes = estimatedDataUrlBytes(image.dataUrl);
  return estimatedBytes >= 2_500 || image.width * image.height >= 0.004;
}

function estimatedDataUrlBytes(dataUrl: string): number {
  const separator = dataUrl.indexOf(",");
  return separator >= 0 ? Math.floor((dataUrl.length - separator - 1) * 0.75) : 0;
}

function mergeVisualConversionPageImages(
  pages: VisualConversionPage[],
  collectedImages: NoteDrawExportImage[]
): VisualConversionPage[] {
  const collectedByPage = new Map<number, NoteDrawExportImage[]>();
  for (const image of collectedImages) {
    if (image.id.startsWith("native-page-")) {
      continue;
    }
    const pageImages = collectedByPage.get(image.pageIndex) ?? [];
    pageImages.push(image);
    collectedByPage.set(image.pageIndex, pageImages);
  }
  return pages.map((page) => {
    const imagesById = new Map(page.images.map((image) => [image.id, image]));
    for (const image of collectedByPage.get(page.pageIndex) ?? []) {
      imagesById.set(image.id, image);
    }
    return { ...page, images: Array.from(imagesById.values()) };
  });
}

async function buildMarkdownInlineVisualExportPages(
  pages: VisualConversionPage[],
  elements: InkElement[]
): Promise<VisualConversionPage[]> {
  const extractedImages = collectNoteDrawExportImages(pages, elements).filter(isUsefulMarkdownExportImage);
  const visibleImages = await Promise.all(extractedImages.map(async (image) => ({
    ...image,
    dataUrl: await flattenImageDataUrlOnWhite(image.dataUrl, image.opacity),
    opacity: 1
  })));

  return mergeVisualConversionPageImages(
    pages.map((page) => ({ ...page, images: [] })),
    visibleImages
  );
}

async function flattenImageDataUrlOnWhite(dataUrl: string, opacity = 1): Promise<string> {
  const image = await loadDataUrlImage(dataUrl);
  const canvas = activeDocument.createElement("canvas");
  canvas.width = Math.max(1, image.naturalWidth || image.width);
  canvas.height = Math.max(1, image.naturalHeight || image.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return convertImageDataUrlToPng(dataUrl);
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = clamp(opacity, 0, 1);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 1;
  return canvas.toDataURL("image/png");
}

function sampleEditableTextColors(canvas: HTMLCanvasElement, lines: EditableMarkdownLine[]): void {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return;
  }
  let pixels: ImageData;
  try {
    pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    return;
  }
  const readColor = (line: EditableMarkdownLine, run: EditableMarkdownTextRun): string | null => {
    const left = Math.max(0, Math.floor((run.left ?? line.left) * canvas.width));
    const right = Math.min(canvas.width, Math.ceil(((run.left ?? line.left) + (run.width ?? line.width)) * canvas.width));
    const top = Math.max(0, Math.floor(line.top * canvas.height));
    const bottom = Math.min(canvas.height, Math.ceil((line.top + line.height) * canvas.height));
    if (right - left < 2 || bottom - top < 2) {
      return null;
    }
    const stride = Math.max(1, Math.floor(Math.sqrt(((right - left) * (bottom - top)) / 12_000)));
    const buckets = new Map<number, { blue: number; count: number; green: number; red: number }>();
    for (let y = top; y < bottom; y += stride) {
      for (let x = left; x < right; x += stride) {
        const offset = (y * canvas.width + x) * 4;
        if (pixels.data[offset + 3] < 96) {
          continue;
        }
        const red = pixels.data[offset];
        const green = pixels.data[offset + 1];
        const blue = pixels.data[offset + 2];
        const key = (red >> 4) << 8 | (green >> 4) << 4 | (blue >> 4);
        const bucket = buckets.get(key) ?? { blue: 0, count: 0, green: 0, red: 0 };
        bucket.count += 1;
        bucket.red += red;
        bucket.green += green;
        bucket.blue += blue;
        buckets.set(key, bucket);
      }
    }
    const sorted = Array.from(buckets.values()).sort((a, b) => b.count - a.count);
    const background = sorted[0];
    if (!background || sorted.length < 2) {
      return null;
    }
    const backgroundColor = {
      b: background.blue / background.count,
      g: background.green / background.count,
      r: background.red / background.count
    };
    const candidate = sorted.slice(1)
      .map((bucket) => {
        const color = {
          b: bucket.blue / bucket.count,
          g: bucket.green / bucket.count,
          r: bucket.red / bucket.count
        };
        const distance = Math.hypot(
          color.r - backgroundColor.r,
          color.g - backgroundColor.g,
          color.b - backgroundColor.b
        );
        return { bucket, color, score: distance * Math.sqrt(bucket.count) };
      })
      .filter((entry) => entry.bucket.count >= 2 && entry.score >= 60)
      .sort((a, b) => b.score - a.score)[0];
    if (!candidate) {
      return null;
    }
    return rgbToHex(candidate.color.r, candidate.color.g, candidate.color.b);
  };

  for (const line of lines) {
    for (const run of line.runs) {
      if (!isNearDefaultTextColor(run.color)) {
        continue;
      }
      const sampled = readColor(line, run);
      if (sampled) {
        run.color = sampled;
      }
    }
  }
}

function attachLinksToVisualConversionImages(
  images: VisualConversionImage[],
  links: ExportLinkRect[],
  overlay: PageOverlay
): VisualConversionImage[] {
  const overlayRect = overlay.pageEl.getBoundingClientRect();
  const normalizedLinks = links.map((link) => ({
    bottom: clamp((link.bottom - overlayRect.top) / Math.max(1, overlay.cssHeight), 0, 1),
    href: link.href,
    left: clamp((link.left - overlayRect.left) / Math.max(1, overlay.cssWidth), 0, 1),
    right: clamp((link.right - overlayRect.left) / Math.max(1, overlay.cssWidth), 0, 1),
    top: clamp((link.top - overlayRect.top) / Math.max(1, overlay.cssHeight), 0, 1)
  }));
  return images.map((image) => {
    const match = normalizedLinks
      .map((link) => {
        const overlapWidth = Math.max(0, Math.min(image.x + image.width, link.right) - Math.max(image.x, link.left));
        const overlapHeight = Math.max(0, Math.min(image.y + image.height, link.bottom) - Math.max(image.y, link.top));
        return { href: link.href, ratio: overlapWidth * overlapHeight / Math.max(0.0001, image.width * image.height) };
      })
      .filter((candidate) => candidate.ratio >= 0.08)
      .sort((a, b) => b.ratio - a.ratio)[0];
    return match ? { ...image, link: match.href } : image;
  });
}

async function buildInkVisualExportImages(
  elements: InkElement[],
  overlay: PageOverlay,
  outputWidth: number,
  outputHeight: number
): Promise<VisualConversionImage[]> {
  const images: VisualConversionImage[] = [];
  for (const element of elements) {
    if (element.kind !== "stroke" && element.kind !== "cover") {
      continue;
    }
    const bounds = normalizedElementBounds(element);
    if (!bounds) {
      continue;
    }
    const strokePadX = element.kind === "stroke"
      ? Math.max(3, strokeDisplayWidth(element, overlay.cssWidth) * 2) / Math.max(1, overlay.cssWidth)
      : 2 / Math.max(1, overlay.cssWidth);
    const strokePadY = element.kind === "stroke"
      ? Math.max(3, strokeDisplayWidth(element, overlay.cssWidth) * 2) / Math.max(1, overlay.cssHeight)
      : 2 / Math.max(1, overlay.cssHeight);
    const left = clamp(bounds.minX - strokePadX, 0, 1);
    const top = clamp(bounds.minY - strokePadY, 0, 1);
    const right = clamp(bounds.maxX + strokePadX, 0, 1);
    const bottom = clamp(bounds.maxY + strokePadY, 0, 1);
    const width = Math.max(0.001, right - left);
    const height = Math.max(0.001, bottom - top);
    const canvas = activeDocument.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(width * outputWidth));
    canvas.height = Math.max(1, Math.ceil(height * outputHeight));
    const context = canvas.getContext("2d");
    if (!context) {
      continue;
    }
    context.setTransform(
      outputWidth / Math.max(1, overlay.cssWidth),
      0,
      0,
      outputHeight / Math.max(1, overlay.cssHeight),
      -left * outputWidth,
      -top * outputHeight
    );
    if (element.kind === "stroke") {
      drawStroke(context, element, overlay.cssWidth, overlay.cssHeight, false);
    } else {
      drawCoverElement(context, element, overlay.cssWidth, overlay.cssHeight, false);
    }
    images.push({
      dataUrl: canvas.toDataURL("image/png"),
      height,
      id: `pdftion-${element.kind}-${element.id}`,
      opacity: 1,
      width,
      x: left,
      y: top,
      zIndex: element.zIndex
    });
  }
  return images;
}

async function extractHtmlDerivedVisualLayers(
  pageCanvas: HTMLCanvasElement,
  lines: EditableMarkdownLine[],
  pageIndex: number
): Promise<VisualConversionImage[]> {
  if (pageCanvas.width <= 1 || pageCanvas.height <= 1) {
    return [];
  }
  const layer = activeDocument.createElement("canvas");
  layer.width = pageCanvas.width;
  layer.height = pageCanvas.height;
  const ctx = layer.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return [];
  }
  const bodyFontSize = getEditableMarkdownDocumentBaseFontSize([{ lines }]);
  ctx.drawImage(pageCanvas, 0, 0);

  for (const line of lines) {
    const fallbackLeft = line.left;
    const fallbackWidth = line.width;
    for (const run of line.runs) {
      const left = run.left ?? fallbackLeft;
      const width = run.width ?? fallbackWidth;
      const x = left * layer.width;
      const y = line.top * layer.height;
      const w = width * layer.width;
      const h = line.height * layer.height;
      const padX = Math.max(2, layer.width * 0.0015);
      const padY = Math.max(2, h * 0.35);
      ctx.clearRect(
        Math.max(0, x - padX),
        Math.max(0, y - padY),
        Math.min(layer.width, w + padX * 2),
        Math.min(layer.height, h + padY * 2)
      );
    }
  }

  let pixels: ImageData;
  try {
    pixels = ctx.getImageData(0, 0, layer.width, layer.height);
  } catch {
    return [];
  }
  const cellSize = Math.max(4, Math.round(Math.max(layer.width, layer.height) / 180));
  const columns = Math.ceil(layer.width / cellSize);
  const rows = Math.ceil(layer.height / cellSize);
  const cellCounts = new Uint32Array(columns * rows);
  for (let y = 0; y < layer.height; y += 1) {
    if (y > 0 && y % 160 === 0) {
      await sleepMs(0);
    }
    for (let x = 0; x < layer.width; x += 1) {
      const offset = (y * layer.width + x) * 4;
      const alpha = pixels.data[offset + 3];
      const nearWhite = pixels.data[offset] >= 247 && pixels.data[offset + 1] >= 247 && pixels.data[offset + 2] >= 247;
      if (alpha <= 12 || nearWhite) {
        pixels.data[offset + 3] = 0;
        continue;
      }
      const cellX = Math.floor(x / cellSize);
      const cellY = Math.floor(y / cellSize);
      cellCounts[cellY * columns + cellX] += 1;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  const occupied = new Uint8Array(columns * rows);
  for (let cellY = 0; cellY < rows; cellY += 1) {
    for (let cellX = 0; cellX < columns; cellX += 1) {
      const cellWidth = Math.min(cellSize, layer.width - cellX * cellSize);
      const cellHeight = Math.min(cellSize, layer.height - cellY * cellSize);
      const threshold = Math.max(2, Math.round(cellWidth * cellHeight * 0.018));
      const index = cellY * columns + cellX;
      occupied[index] = cellCounts[index] >= threshold ? 1 : 0;
    }
  }

  const visited = new Uint8Array(columns * rows);
  const componentBoxes: Array<{ maxCellX: number; maxCellY: number; minCellX: number; minCellY: number }> = [];
  for (let start = 0; start < occupied.length; start += 1) {
    if (!occupied[start] || visited[start]) {
      continue;
    }
    const queue = [start];
    visited[start] = 1;
    let minCellX = start % columns;
    let maxCellX = minCellX;
    let minCellY = Math.floor(start / columns);
    let maxCellY = minCellY;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      const currentX = current % columns;
      const currentY = Math.floor(current / columns);
      minCellX = Math.min(minCellX, currentX);
      maxCellX = Math.max(maxCellX, currentX);
      minCellY = Math.min(minCellY, currentY);
      maxCellY = Math.max(maxCellY, currentY);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const nextX = currentX + dx;
          const nextY = currentY + dy;
          if (nextX < 0 || nextY < 0 || nextX >= columns || nextY >= rows) {
            continue;
          }
          const next = nextY * columns + nextX;
          if (occupied[next] && !visited[next]) {
            visited[next] = 1;
            queue.push(next);
          }
        }
      }
    }
    componentBoxes.push({ maxCellX, maxCellY, minCellX, minCellY });
  }

  const visuals: VisualConversionImage[] = [];
  for (const box of componentBoxes) {
    const scanLeft = box.minCellX * cellSize;
    const scanTop = box.minCellY * cellSize;
    const scanRight = Math.min(layer.width - 1, (box.maxCellX + 1) * cellSize - 1);
    const scanBottom = Math.min(layer.height - 1, (box.maxCellY + 1) * cellSize - 1);
    let minX = scanRight;
    let minY = scanBottom;
    let maxX = -1;
    let maxY = -1;
    let visible = 0;
    const colors = new Set<number>();
    for (let y = scanTop; y <= scanBottom; y += 1) {
      if (y > scanTop && (y - scanTop) % 160 === 0) {
        await sleepMs(0);
      }
      for (let x = scanLeft; x <= scanRight; x += 1) {
        const offset = (y * layer.width + x) * 4;
        if (pixels.data[offset + 3] <= 12) {
          continue;
        }
        visible += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        if (colors.size < 64) {
          colors.add((pixels.data[offset] >> 4) << 8 | (pixels.data[offset + 1] >> 4) << 4 | (pixels.data[offset + 2] >> 4));
        }
      }
    }
    if (maxX < minX || maxY < minY) {
      continue;
    }
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    const normalizedWidth = width / layer.width;
    const normalizedHeight = height / layer.height;
    const normalizedArea = normalizedWidth * normalizedHeight;
    const density = visible / Math.max(1, width * height);
    const normalizedLeft = minX / layer.width;
    const normalizedTop = minY / layer.height;
    const inlineLine = lines
      .map((line) => ({
        gap: line.left - (normalizedLeft + normalizedWidth),
        line,
        verticalDistance: Math.abs(
          normalizedTop + normalizedHeight / 2 - (line.top + line.height / 2)
        )
      }))
      .filter(({ gap, line, verticalDistance }) => (
        Math.max(...line.runs.map((run) => run.fontSize), bodyFontSize) <= bodyFontSize * 1.1 &&
        gap >= -0.01 && gap <= 0.09 &&
        verticalDistance <= Math.max(0.012, line.height * 1.15)
      ))
      .sort((a, b) => (a.verticalDistance - b.verticalDistance) || (a.gap - b.gap))[0]?.line;
    const likelyInlineGlyph = Boolean(inlineLine) &&
      visible >= 3 && density >= 0.005 &&
      normalizedWidth >= 0.001 && normalizedWidth <= 0.09 &&
      normalizedHeight >= 0.002 && normalizedHeight <= 0.05 &&
      normalizedArea <= 0.005;
    const likelyCheckboxGlyph = Boolean(inlineLine) && likelyInlineGlyph &&
      normalizedWidth >= Math.max(0.018, (inlineLine?.height ?? 0) * 1.8) &&
      normalizedHeight >= (inlineLine?.height ?? 0) * 0.85;
    const likelyRasterImage = normalizedWidth >= 0.08 && normalizedHeight >= 0.04 && normalizedArea >= 0.004 &&
      colors.size >= 8 && density >= 0.055;
    if (!likelyRasterImage && !likelyInlineGlyph) {
      continue;
    }
    const padding = 2;
    const cropLeft = Math.max(0, minX - padding);
    const cropTop = Math.max(0, minY - padding);
    const cropRight = Math.min(layer.width - 1, maxX + padding);
    const cropBottom = Math.min(layer.height - 1, maxY + padding);
    const cropWidth = cropRight - cropLeft + 1;
    const cropHeight = cropBottom - cropTop + 1;
    const cropped = activeDocument.createElement("canvas");
    cropped.width = cropWidth;
    cropped.height = cropHeight;
    const croppedCtx = cropped.getContext("2d");
    if (!croppedCtx) {
      continue;
    }
    croppedCtx.drawImage(layer, cropLeft, cropTop, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    visuals.push({
      dataUrl: cropped.toDataURL("image/png"),
      height: cropHeight / layer.height,
      id: `${likelyCheckboxGlyph
        ? `pdf-inline-checkbox-${density >= 0.45 ? "checked" : "unchecked"}`
        : likelyInlineGlyph
          ? "pdf-inline-glyph"
          : "pdf-raster"}-page-${pageIndex + 1}-${visuals.length + 1}`,
      opacity: 1,
      width: cropWidth / layer.width,
      x: cropLeft / layer.width,
      y: cropTop / layer.height,
      zIndex: -1
    });
  }
  return visuals;
}

function sanitizeNoteDrawAssetName(value: string): string {
  const normalized = value
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .replace(/\s+/g, "-")
    .replace(/_+/g, "_")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");
  return (normalized || "pdftion-image").slice(-120);
}

function measureCanvasVisualRatio(canvas: HTMLCanvasElement): number {
  const sample = activeDocument.createElement("canvas");
  sample.width = 48;
  sample.height = 48;
  const ctx = sample.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return 0;
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, sample.width, sample.height);
  ctx.drawImage(canvas, 0, 0, sample.width, sample.height);
  const pixels = ctx.getImageData(0, 0, sample.width, sample.height).data;
  let visual = 0;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (pixels[offset + 3] > 16 && (pixels[offset] < 245 || pixels[offset + 1] < 245 || pixels[offset + 2] < 245)) {
      visual += 1;
    }
  }
  return visual / Math.max(1, pixels.length / 4);
}

async function buildCombinedPagePng(pages: VisualConversionPage[]): Promise<Uint8Array> {
  const sortedPages = [...pages].sort((a, b) => a.pageIndex - b.pageIndex);
  const margin = 24;
  const gap = 24;
  const rawWidth = Math.max(1, ...sortedPages.map((page) => page.width)) + margin * 2;
  const rawHeight = sortedPages.reduce((sum, page) => sum + page.height, margin * 2 + gap * Math.max(0, sortedPages.length - 1));
  const maxPixels = 16_000_000;
  const scale = Math.min(1, 30_000 / Math.max(rawWidth, rawHeight), Math.sqrt(maxPixels / Math.max(1, rawWidth * rawHeight)));
  const canvas = activeDocument.createElement("canvas");
  canvas.width = Math.max(1, Math.round(rawWidth * scale));
  canvas.height = Math.max(1, Math.round(rawHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create PNG export canvas.");
  }
  ctx.fillStyle = "#dfe3e8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  let y = margin;
  for (const page of sortedPages) {
    const image = await loadDataUrlImage(uint8ArrayToDataUrl(page.bytes, "image/png"));
    const x = margin + (rawWidth - margin * 2 - page.width) / 2;
    ctx.drawImage(image, Math.round(x * scale), Math.round(y * scale), Math.round(page.width * scale), Math.round(page.height * scale));
    y += page.height + gap;
  }
  return dataUrlToBytes(canvas.toDataURL("image/png"));
}

function getNativeExportBlockPrefix(block: NativeExportBlock): string {
  if (block.kind === "unordered-list") return `${block.marker ?? "•"} `;
  if (block.kind === "ordered-list") return `${block.ordinal ?? 1}. `;
  if (block.kind === "task") return `${block.marker ?? (block.checked ? "☑" : "☐")} `;
  if (block.kind === "callout-title") return `${getCommonCalloutIcon(block.runs.map((run) => run.text).join(""))} `;
  return "";
}

function containsEmojiPresentation(value: string): boolean {
  return /[\p{Extended_Pictographic}\u2600-\u27bf]/u.test(value);
}

function containsCjkPresentation(value: string): boolean {
  return /[\u2e80-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/u.test(value);
}

function exportFontFaceForRun(run: EditableMarkdownTextRun, code = false): string {
  if (code || run.code) {
    return "Consolas";
  }
  if (containsEmojiPresentation(run.text)) {
    return "Segoe UI Emoji";
  }
  return exportFontFace(run.fontFamily, run.text);
}

function getPortableExportFontSizePt(
  run: EditableMarkdownTextRun,
  block: NativeExportBlock,
  baseFontSize: number
): number {
  if (block.kind === "heading") {
    return [24, 20, 17, 15, 13, 12][clamp((block.headingLevel ?? 1) - 1, 0, 5)];
  }
  const baseSize = block.kind === "code" ? 10 : block.kind === "callout-title" ? 12 : block.kind === "table" ? 10 : 11;
  const ratio = clamp(run.fontSize / Math.max(1, baseFontSize), 0.85, 1.35);
  return Math.round(clamp(baseSize * ratio, 8.5, 18) * 2) / 2;
}

function getPortableExportCssFontStack(run: EditableMarkdownTextRun, code = false): string {
  const primary = exportFontFaceForRun(run, code);
  if (primary === "Consolas") {
    return 'Consolas,"Liberation Mono","Noto Sans Mono",monospace';
  }
  if (primary === "Segoe UI Emoji") {
    return '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
  }
  if (containsCjkPresentation(run.text)) {
    return primary === "SimSun"
      ? 'SimSun,"Noto Serif CJK SC","Source Han Serif SC",serif'
      : '"Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC",Arial,sans-serif';
  }
  return primary === "Times New Roman"
    ? '"Times New Roman","Liberation Serif",serif'
    : 'Arial,"Liberation Sans",sans-serif';
}

function isAnnotationExportImage(image: VisualConversionImage): boolean {
  return /^pdftion-(?:cover|stroke)-/.test(image.id);
}

function getHtmlVisualAlignment(image: VisualConversionImage): "center" | "left" | "right" {
  const center = image.x + image.width / 2;
  if (center < 0.38) return "left";
  if (center > 0.62) return "right";
  return "center";
}

function renderNativeExportHtmlBlock(
  block: NativeExportBlock,
  document: NativeExportDocument
): string {
  if (block.kind === "image" && block.image) {
    const image = block.image;
    const annotation = isAnnotationExportImage(image);
    const visualKind = annotation ? "annotation" : image.id.startsWith("pdf-raster-page-") ? "native" : "embedded";
    const width = clamp(image.width * 100, visualKind === "native" ? 24 : 10, 100);
    const align = getHtmlVisualAlignment(image);
    const imageMarkup = `<img class="block-image" src="${htmlAttributeEscape(image.dataUrl)}" alt="${htmlAttributeEscape(image.assetName)}">`;
    const linkedImage = image.link
      ? `<a class="block-image-link" href="${htmlAttributeEscape(image.link)}">${imageMarkup}</a>`
      : imageMarkup;
    const visualStyle = annotation
      ? `--visual-left:${clamp(image.x * 100, 0, 100).toFixed(3)}%;--visual-top:${clamp(image.y * 100, 0, 100).toFixed(3)}%;--visual-width:${clamp(image.width * 100, 0.05, 100).toFixed(3)}%;--visual-height:${clamp(image.height * 100, 0.05, 100).toFixed(3)}%;--visual-opacity:${clamp(image.opacity, 0, 1).toFixed(3)}`
      : `--visual-width:${width.toFixed(2)}%;--visual-opacity:${clamp(image.opacity, 0, 1).toFixed(3)}`;
    return `<figure class="block block-visual block-visual-${visualKind} align-${align}" style="${visualStyle}">${linkedImage}</figure>`;
  }
  if (block.kind === "separator") {
    return `<hr class="block block-separator">`;
  }
  if (block.kind === "table" && block.table) {
    const rows = block.table.rows.map((row) => `<tr>${row.map((cell) => (
      `<td>${renderNativeHtmlRuns(cell.runs, block, document)}</td>`
    )).join("")}</tr>`).join("");
    return `<div class="block-table-wrap"><table class="block block-table"><tbody>${rows}</tbody></table></div>`;
  }
  const prefix = getNativeExportBlockPrefix(block);
  const content = `${prefix ? `<span>${htmlEscape(prefix)}</span>` : ""}${renderNativeHtmlRuns(block.runs, block, document)}`;
  const style = block.listLevel ? ` style="--list-indent:${(1.5 + block.listLevel * 1.25).toFixed(2)}rem"` : "";
  if (block.kind === "heading") {
    const level = clamp(block.headingLevel ?? 1, 1, 6);
    return `<h${level} class="block">${content}</h${level}>`;
  }
  if (block.kind === "code") {
    return `<pre class="block block-code"><code>${renderNativeHtmlRuns(block.runs, block, document)}</code></pre>`;
  }
  if (block.kind === "quote") {
    return `<blockquote class="block block-quote"${style}>${content}</blockquote>`;
  }
  if (block.kind === "callout-title" || block.kind === "callout-body") {
    return `<aside class="block block-callout"${style}>${content}</aside>`;
  }
  if (block.kind === "unordered-list") {
    return `<ul class="block block-list"${style}><li>${renderNativeHtmlRuns(block.runs, block, document)}</li></ul>`;
  }
  if (block.kind === "ordered-list") {
    return `<ol class="block block-list" start="${block.ordinal ?? 1}"${style}><li>${renderNativeHtmlRuns(block.runs, block, document)}</li></ol>`;
  }
  if (block.kind === "task") {
    return `<p class="block block-list" role="checkbox" aria-checked="${block.checked ? "true" : "false"}"${style}>${content}</p>`;
  }
  return `<p class="block"${style}>${content}</p>`;
}

function renderNativeHtmlRuns(
  runs: EditableMarkdownTextRun[],
  block: NativeExportBlock,
  document: NativeExportDocument
): string {
  const baseFontSize = Math.max(1, document.baseFontSize);
  return runs.map((run) => {
    const decorations = [run.underline ? "underline" : "", run.strike ? "line-through" : ""].filter(Boolean).join(" ");
    const style = [
      `color:#${exportHexColor(run.color)}`,
      `font-family:${htmlAttributeEscape(getPortableExportCssFontStack(run, block.kind === "code"))}`,
      `font-size:${(getPortableExportFontSizePt(run, block, baseFontSize) * 4 / 3).toFixed(1)}px`,
      `font-style:${run.italic ? "italic" : "normal"}`,
      `font-weight:${run.bold || block.kind === "callout-title" ? "700" : "400"}`,
      `opacity:${clamp(run.opacity ?? 1, 0, 1).toFixed(3)}`,
      decorations ? `text-decoration:${decorations}` : ""
    ].filter(Boolean).join(";");
    const span = `<span style="${style}">${htmlEscape(run.text)}</span>`;
    return run.link ? `<a href="${htmlAttributeEscape(run.link)}">${span}</a>` : span;
  }).join("");
}

async function buildPptxFromPageImages(pages: VisualConversionPage[], title: string): Promise<Uint8Array> {
  const module = await import("pptxgenjs");
  const PptxGenJS = module.default;
  const pptx = new PptxGenJS();
  const first = pages[0];
  if (!first) {
    throw new Error("No pages are available for PPTX export.");
  }
  const slideWidth = 10;
  const slideHeight = clamp(slideWidth * first.height / Math.max(1, first.width), 5.625, 14.2);
  pptx.defineLayout({ name: "PDFTION_EXPORT", width: slideWidth, height: slideHeight });
  pptx.layout = "PDFTION_EXPORT";
  pptx.author = "Murat";
  pptx.subject = title;
  pptx.theme = { bodyFontFace: "Arial", headFontFace: "Arial" };
  pptx.title = title;
  const document = buildNativeExportDocumentFromVisualPages(pages);

  for (const page of document.pages) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    const pageRatio = page.width / Math.max(1, page.height);
    const slideRatio = slideWidth / slideHeight;
    const width = pageRatio >= slideRatio ? slideWidth : slideHeight * pageRatio;
    const height = pageRatio >= slideRatio ? slideWidth / pageRatio : slideHeight;
    const imageX = (slideWidth - width) / 2;
    const imageY = (slideHeight - height) / 2;
    const imageBlocks = page.blocks.filter((block) => block.kind === "image" && block.image);
    const foregroundImages = imageBlocks.filter((block) => block.image?.id.startsWith("pdftion-") === true);
    const backgroundImages = imageBlocks.filter((block) => !foregroundImages.includes(block));
    const addImage = (block: NativeExportBlock): void => {
      const image = block.image;
      if (!image) return;
      slide.addImage({
        data: image.dataUrl,
        h: Math.max(0.01, image.height * height),
        hyperlink: image.link ? { url: image.link } : undefined,
        transparency: Math.round((1 - clamp(image.opacity, 0, 1)) * 100),
        w: Math.max(0.01, image.width * width),
        x: imageX + image.x * width,
        y: imageY + image.y * height
      });
    };
    backgroundImages.forEach(addImage);

    for (const block of page.blocks) {
      if (block.kind === "image") {
        continue;
      }
      const x = imageX + block.left * width;
      const y = imageY + block.top * height;
      const blockWidth = Math.max(0.02, Math.min(imageX + width - x, block.width * width + 0.18));
      const portableSizes = block.runs.map((run) => getPortableExportFontSizePt(run, block, document.baseFontSize));
      const targetMaxSize = Math.max(9, ...portableSizes);
      const blockHeight = Math.max(targetMaxSize * 1.35 / 72, (block.height ?? 0.02) * height * 1.35);
      if (block.kind === "separator") {
        slide.addShape(pptx.ShapeType.line, {
          h: 0,
          line: { color: "8A8A8A", width: 1 },
          w: blockWidth,
          x,
          y
        });
        continue;
      }
      if (block.kind === "table" && block.table) {
        const rows = block.table.rows.map((row, rowIndex) => row.map((cell) => ({
          options: {
            bold: rowIndex === 0,
            color: exportHexColor(cell.runs[0]?.color ?? "#000000"),
            fontFace: cell.runs[0] ? exportFontFaceForRun(cell.runs[0]) : "Arial",
            fontSize: cell.runs[0] ? getPortableExportFontSizePt(cell.runs[0], block, document.baseFontSize) : 10,
            margin: 0.04
          },
          text: cell.runs.map((run) => run.text).join("")
        })));
        slide.addTable(rows, {
          border: { color: "B7BCC4", pt: 0.75 },
          fill: { color: "FFFFFF" },
          h: Math.max(0.25, (block.height ?? 0.06) * height),
          margin: 0.04,
          rowH: Math.max(0.18, (block.height ?? 0.06) * height / Math.max(1, rows.length)),
          w: blockWidth,
          x,
          y
        });
        continue;
      }
      const prefix = getNativeExportBlockPrefix(block);
      const textRuns = [
        ...(prefix ? [{
          options: {
            bold: block.kind === "callout-title",
            breakLine: false,
            color: "333333",
            fontFace: "Segoe UI Symbol",
            fontSize: targetMaxSize
          },
          text: prefix
        }] : []),
        ...block.runs.map((run) => ({
          text: run.text,
          options: {
            bold: run.bold || block.kind === "callout-title",
            breakLine: false,
            color: exportHexColor(run.color),
            fontFace: exportFontFaceForRun(run, block.kind === "code"),
            fontSize: getPortableExportFontSizePt(run, block, document.baseFontSize),
            hyperlink: run.link ? { url: run.link } : undefined,
            italic: run.italic,
            strike: run.strike ? ("sngStrike" as const) : undefined,
            transparency: Math.round((1 - clamp(run.opacity ?? 1, 0, 1)) * 100),
            underline: run.underline ? { style: "sng" as const } : undefined
          }
        }))
      ];
      if (textRuns.length === 0) {
        continue;
      }
      slide.addText(textRuns, {
        breakLine: false,
        fill: block.kind === "code"
          ? { color: "F3F4F6" }
          : block.kind === "callout-title" || block.kind === "callout-body"
            ? { color: "EEF5FF", transparency: 10 }
            : undefined,
        fit: "none",
        h: blockHeight,
        isTextBox: true,
        margin: 0,
        paraSpaceAfter: 0,
        paraSpaceBefore: 0,
        valign: "top",
        w: blockWidth,
        wrap: false,
        x,
        y
      });
    }
    foregroundImages.forEach(addImage);
  }

  const output = await pptx.write({ outputType: "arraybuffer" });
  let bytes: Uint8Array;
  if (output instanceof ArrayBuffer) {
    bytes = new Uint8Array(output);
  } else if (output instanceof Uint8Array) {
    bytes = output;
  } else if (output instanceof Blob) {
    bytes = new Uint8Array(await output.arrayBuffer());
  } else {
    throw new Error("PPTX generation returned an unsupported output type.");
  }
  return injectOfficePreviewPages(bytes, pages, slideWidth * 72, slideHeight * 72);
}

function buildSelfContainedVisualHtml(file: TFile, pages: VisualConversionPage[]): string {
  const document = buildHtmlExportDocumentFromVisualPages(pages);
  const pageMarkup = document.pages
    .filter((page) => page.blocks.length > 0)
    .map((page) => {
      const contentBlocks = page.blocks.filter((block) => !block.image || !isAnnotationExportImage(block.image));
      const annotationBlocks = page.blocks.filter((block) => block.image && isAnnotationExportImage(block.image));
      const content = contentBlocks.map((block) => renderNativeExportHtmlBlock(block, document)).join("");
      const annotations = annotationBlocks.length > 0
        ? `<aside class="page-annotations" aria-label="Page ${page.pageIndex + 1} annotations">${annotationBlocks.map((block) => renderNativeExportHtmlBlock(block, document)).join("")}</aside>`
        : "";
      const pageClass = annotations ? "page page-has-annotations" : "page";
      return `<section class="${pageClass}" style="--page-aspect:${Math.max(1, page.width).toFixed(2)} / ${Math.max(1, page.height).toFixed(2)}" aria-label="Page ${page.pageIndex + 1}"><div class="page-content">${content}</div>${annotations}</section>`;
    }).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(file.basename)}</title><style>
*{box-sizing:border-box}html{background:#e7e9ed;color:#202124;font-family:Arial,"Microsoft YaHei","Noto Sans CJK SC",sans-serif}body{margin:0;padding:18px}main{margin:0 auto;max-width:900px}
.page{background:#fff;box-shadow:0 2px 10px #0002;isolation:isolate;margin:0 auto 18px;overflow:hidden;padding:32px 42px;position:relative;width:100%}.page-has-annotations{display:grid}.page-has-annotations::before,.page-has-annotations>.page-content{grid-area:1/1}.page-has-annotations::before{aspect-ratio:var(--page-aspect);content:"";display:block;width:100%}.page-content{position:relative;z-index:1}
.block{letter-spacing:0;line-height:1.55;margin:.55rem 0;overflow-wrap:anywhere;white-space:pre-wrap}.block a,a.block-image-link{color:#0b57d0;text-decoration:underline;text-underline-offset:2px}
.page h1,.page h2,.page h3,.page h4,.page h5,.page h6{line-height:1.25;margin:1.15rem 0 .5rem}.page h1:first-child,.page h2:first-child,.page h3:first-child,.page p:first-child{margin-top:0}
.block-code{background:#f3f4f6;border-radius:4px;font-family:Consolas,"Liberation Mono","Noto Sans Mono",monospace;overflow-x:auto;padding:.75rem;white-space:pre-wrap}.block-callout{background:#eef5ff;border-left:4px solid #4b8fd8;padding:.55rem .75rem}.block-callout+.block-callout{margin-top:-.55rem}.block-quote{border-left:3px solid #9aa0a6;margin-left:0;padding-left:.8rem}
.block-list{margin:.3rem 0;padding-left:var(--list-indent,1.5rem)}.block-list+.block-list{margin-top:-.12rem}.block-separator{border:0;border-top:1px solid #888;margin:1rem 0}.block-table-wrap{margin:.8rem 0;overflow-x:auto}.block-table{border-collapse:collapse;table-layout:fixed;width:100%}.block-table td{border:1px solid #b7bcc4;padding:.45rem .55rem;vertical-align:top}.block-table tr:first-child td{background:#f4f5f7;font-weight:700}
.block-visual{display:block;margin:.8rem 0;max-width:100%;opacity:var(--visual-opacity);width:min(100%,var(--visual-width))}.block-visual.align-left{margin-right:auto}.block-visual.align-center{margin-left:auto;margin-right:auto}.block-visual.align-right{margin-left:auto}.block-image,.block-image-link{display:block;max-width:100%}.block-image{height:auto;max-height:760px;object-fit:contain;width:100%}.block-visual.align-center .block-image{margin-left:auto;margin-right:auto}.block-visual.align-right .block-image{margin-left:auto}.block-visual-native .block-image{max-height:720px}
.page-annotations{aspect-ratio:var(--page-aspect);left:0;pointer-events:none;position:absolute;top:0;width:100%;z-index:3}.page-annotations .block-visual{height:var(--visual-height);left:var(--visual-left);margin:0;max-width:none;position:absolute;top:var(--visual-top);width:var(--visual-width)}.page-annotations .block-image,.page-annotations .block-image-link{height:100%;max-height:none;width:100%}.page-annotations .block-image{object-fit:contain}
@media(max-width:640px){body{padding:0}.page{box-shadow:none;margin-bottom:8px;padding:18px 16px}.block{line-height:1.5}.block-visual{width:100%}}
@media print{html,body{background:#fff;padding:0}.page{box-shadow:none;margin:0;padding:18mm;break-after:page}.page:last-child{break-after:auto}}
</style></head><body><main>${pageMarkup}</main></body></html>`;
}

async function buildDocxFromPageImages(pages: VisualConversionPage[], title: string): Promise<Uint8Array> {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    ExternalHyperlink,
    HeadingLevel,
    HorizontalPositionRelativeFrom,
    ImageRun,
    LineRuleType,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    TextWrappingType,
    UnderlineType,
    VerticalPositionRelativeFrom,
    WidthType
  } = await import("docx");
  const nativeDocument = buildNativeExportDocumentFromVisualPages(pages);
  const pageWidthTwips = 11906;
  const pageMarginTwips = 540;
  const contentWidthTwips = pageWidthTwips - pageMarginTwips * 2;
  const headingLevels = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6
  ];
  const makeTextRun = (run: EditableMarkdownTextRun, block: NativeExportBlock): InstanceType<typeof TextRun> => {
    const fontSizePt = getPortableExportFontSizePt(run, block, nativeDocument.baseFontSize);
    return new TextRun({
      bold: run.bold || block.kind === "callout-title",
      color: exportHexColor(run.color),
      font: exportFontFaceForRun(run, block.kind === "code"),
      italics: run.italic,
      size: Math.round(fontSizePt * 2),
      strike: run.strike,
      text: run.text,
      underline: run.underline ? { type: UnderlineType.SINGLE } : undefined
    });
  };
  const makeRuns = (block: NativeExportBlock): Array<InstanceType<typeof TextRun> | InstanceType<typeof ExternalHyperlink>> => {
    const prefix = getNativeExportBlockPrefix(block);
    const children: Array<InstanceType<typeof TextRun> | InstanceType<typeof ExternalHyperlink>> = prefix
      ? [new TextRun({ bold: block.kind === "callout-title", font: "Segoe UI Symbol", text: prefix })]
      : [];
    for (const run of block.runs) {
      const textRun = makeTextRun(run, block);
      children.push(run.link ? new ExternalHyperlink({ children: [textRun], link: run.link }) : textRun);
    }
    return children;
  };
  const sections = nativeDocument.pages.map((page) => {
    const pageHeightTwips = Math.round(pageWidthTwips * page.height / Math.max(1, page.width));
    const contentHeightTwips = pageHeightTwips - pageMarginTwips * 2;
    const children: Array<InstanceType<typeof Paragraph> | InstanceType<typeof Table>> = [];
    const annotationChildren: Array<InstanceType<typeof ImageRun> | InstanceType<typeof ExternalHyperlink>> = [];
    for (const block of page.blocks) {
      const image = block.image;
      if (block.kind !== "image" || !image || !isAnnotationExportImage(image)) {
        continue;
      }
      const annotationRun = new ImageRun({
        data: dataUrlToBytes(image.dataUrl),
        floating: {
          allowOverlap: true,
          behindDocument: false,
          horizontalPosition: {
            offset: Math.round(image.x * pageWidthTwips * 635),
            relative: HorizontalPositionRelativeFrom.PAGE
          },
          lockAnchor: true,
          verticalPosition: {
            offset: Math.round(image.y * pageHeightTwips * 635),
            relative: VerticalPositionRelativeFrom.PAGE
          },
          wrap: { type: TextWrappingType.NONE }
        },
        transformation: {
          height: Math.max(1, Math.round(image.height * pageHeightTwips / 1440 * 96)),
          width: Math.max(1, Math.round(image.width * pageWidthTwips / 1440 * 96))
        },
        type: "png"
      });
      annotationChildren.push(image.link
        ? new ExternalHyperlink({ children: [annotationRun], link: image.link })
        : annotationRun);
    }
    if (annotationChildren.length > 0) {
      children.push(new Paragraph({
        children: annotationChildren,
        spacing: { after: 0, before: 0, line: 1, lineRule: LineRuleType.EXACT },
        widowControl: false
      }));
    }
    let previousBottom = 0;
    for (const block of page.blocks) {
      if (block.kind === "image" && block.image && isAnnotationExportImage(block.image)) {
        continue;
      }
      const sourceGap = Math.max(0, block.top - previousBottom);
      const gapBefore = Math.round(clamp(
        (previousBottom === 0 ? block.top * pageHeightTwips - pageMarginTwips : sourceGap * pageHeightTwips),
        0,
        contentHeightTwips
      ));
      previousBottom = Math.max(previousBottom, block.top + (block.height ?? 0));
      if (block.kind === "image" && block.image) {
        const image = block.image;
        const contentWidthPx = contentWidthTwips / 1440 * 96;
        const contentHeightPx = Math.max(1, contentHeightTwips / 1440 * 96);
        const requestedWidthPx = Math.max(1, image.width * pageWidthTwips / 1440 * 96);
        const requestedHeightPx = Math.max(1, image.height * pageHeightTwips / 1440 * 96);
        const scale = Math.min(1, contentWidthPx / requestedWidthPx, contentHeightPx * 0.9 / requestedHeightPx);
        const imageRun = new ImageRun({
          data: dataUrlToBytes(image.dataUrl),
          transformation: {
            height: Math.max(1, Math.round(requestedHeightPx * scale)),
            width: Math.max(1, Math.round(requestedWidthPx * scale))
          },
          type: "png"
        });
        const imageChild = image.link
          ? new ExternalHyperlink({ children: [imageRun], link: image.link })
          : imageRun;
        const center = image.x + image.width / 2;
        children.push(new Paragraph({
          alignment: center < 0.38 ? AlignmentType.LEFT : center > 0.62 ? AlignmentType.RIGHT : AlignmentType.CENTER,
          children: [imageChild],
          keepLines: true,
          spacing: { after: 0, before: gapBefore },
          widowControl: false
        }));
        continue;
      }
      if (block.kind === "table" && block.table) {
        const tableWidthTwips = Math.round(clamp(block.width * pageWidthTwips, 720, contentWidthTwips));
        const columnWidths = getEditableTableColumnWidths(block.table, tableWidthTwips).map((width) => Math.round(width));
        children.push(new Table({
          columnWidths,
          indent: { size: Math.round(clamp(block.left * pageWidthTwips - pageMarginTwips, 0, contentWidthTwips - tableWidthTwips)), type: WidthType.DXA },
          layout: TableLayoutType.FIXED,
          rows: block.table.rows.map((row, rowIndex) => new TableRow({
            cantSplit: true,
            children: row.map((cell, columnIndex) => new TableCell({
              children: [new Paragraph({
                children: cell.runs.map((run) => makeTextRun(run, block)),
                keepLines: true,
                spacing: { after: 20, before: 20 }
              })],
              shading: rowIndex === 0 ? { fill: "F2F3F5" } : undefined,
              width: { size: columnWidths[columnIndex] ?? Math.round(tableWidthTwips / Math.max(1, row.length)), type: WidthType.DXA }
            }))
          })),
          width: { size: tableWidthTwips, type: WidthType.DXA }
        }));
        continue;
      }
      if (block.kind === "separator") {
        children.push(new Paragraph({
          border: { bottom: { color: "888888", size: 6, space: 1, style: BorderStyle.SINGLE } },
          children: [],
          spacing: { after: 80, before: Math.max(40, gapBefore) }
        }));
        continue;
      }
      const isCallout = block.kind === "callout-title" || block.kind === "callout-body";
      const maxFontSizePt = Math.max(9, ...block.runs.map((run) => getPortableExportFontSizePt(run, block, nativeDocument.baseFontSize)));
      const sourceLeftTwips = Math.round(clamp(block.left * pageWidthTwips - pageMarginTwips, 0, contentWidthTwips - 1));
      const sourceRightTwips = Math.round(clamp(
        (1 - block.left - block.width) * pageWidthTwips - pageMarginTwips - 120,
        0,
        contentWidthTwips - sourceLeftTwips - 1
      ));
      const semanticLeftTwips = block.kind === "quote" || isCallout
        ? 360
        : block.kind === "task" || block.kind === "unordered-list" || block.kind === "ordered-list"
          ? 360 + (block.listLevel ?? 0) * 360
          : 0;
      const lineHeightTwips = Math.round(Math.max(
        maxFontSizePt * 1.1 * 20,
        (block.height ?? 0) * pageHeightTwips
      ));
      children.push(new Paragraph({
        border: block.kind === "quote" || isCallout
          ? { left: { color: isCallout ? "4B8FD8" : "9AA0A6", size: 12, space: 8, style: BorderStyle.SINGLE } }
          : undefined,
        children: makeRuns(block),
        heading: block.kind === "heading" ? headingLevels[clamp((block.headingLevel ?? 1) - 1, 0, 5)] : undefined,
        indent: {
          hanging: block.kind === "task" || block.kind === "unordered-list" || block.kind === "ordered-list" ? 180 : undefined,
          left: Math.max(sourceLeftTwips, semanticLeftTwips),
          right: sourceRightTwips
        },
        keepLines: true,
        keepNext: block.kind === "heading",
        shading: block.kind === "code"
          ? { fill: "F3F4F6" }
          : isCallout
            ? { fill: "EEF5FF" }
            : undefined,
        spacing: {
          after: 0,
          before: gapBefore,
          line: lineHeightTwips,
          lineRule: LineRuleType.EXACT
        },
        widowControl: false
      }));
    }
    if (children.length === 0) {
      children.push(new Paragraph({ children: [] }));
    }
    return {
      children,
      properties: {
        page: {
          margin: { bottom: pageMarginTwips, left: pageMarginTwips, right: pageMarginTwips, top: pageMarginTwips },
          size: { height: pageHeightTwips, width: pageWidthTwips }
        }
      }
    };
  });

  const document = new Document({
    compatabilityModeVersion: 15,
    creator: "Murat",
    description: "Pdftion native editable conversion with text, tables, links, images, and drawings.",
    sections,
    styles: {
      default: {
        document: {
          paragraph: { spacing: { after: 0, before: 0 } },
          run: { font: "Arial", size: 22 }
        }
      }
    },
    title
  });
  const blob = await Packer.toBlob(document);
  const previewPageHeightTwips = Math.round(
    pageWidthTwips * (nativeDocument.pages[0]?.height ?? 1) / Math.max(1, nativeDocument.pages[0]?.width ?? 1)
  );
  return injectOfficePreviewPages(
    new Uint8Array(await blob.arrayBuffer()),
    pages,
    pageWidthTwips / 20,
    previewPageHeightTwips / 20,
    { persistDocxText: true, stripPreviewText: true }
  );
}

async function buildTextFreeOfficePreviewPage(page: VisualConversionPage): Promise<Uint8Array> {
  if (page.lines.length === 0) {
    return page.bytes;
  }
  const image = await loadDataUrlImage(uint8ArrayToDataUrl(page.bytes, "image/png"));
  const canvas = activeDocument.createElement("canvas");
  canvas.width = Math.max(1, image.naturalWidth || page.width);
  canvas.height = Math.max(1, image.naturalHeight || page.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return page.bytes;
  }
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  for (const line of page.lines) {
    const lineHeight = line.height * canvas.height;
    const padX = Math.max(3, canvas.width * 0.003);
    const padY = Math.max(2, lineHeight * 0.45);
    for (const run of line.runs) {
      const left = (run.left ?? line.left) * canvas.width;
      const width = (run.width ?? line.width) * canvas.width;
      ctx.clearRect(
        Math.max(0, left - padX),
        Math.max(0, line.top * canvas.height - padY),
        Math.min(canvas.width - Math.max(0, left - padX), width + padX * 2),
        Math.min(canvas.height, lineHeight + padY * 2)
      );
    }
  }
  return dataUrlToBytes(canvas.toDataURL("image/png"));
}

async function injectOfficePreviewPages(
  officeBytes: Uint8Array,
  pages: VisualConversionPage[],
  pageWidthPt: number,
  pageHeightPt: number,
  options: { persistDocxText?: boolean; stripPreviewText?: boolean } = {}
): Promise<Uint8Array> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(officeBytes);
  const sortedPages = [...pages].sort((a, b) => a.pageIndex - b.pageIndex);
  const manifest: {
    cancipEditedLocatorKeys?: string[];
    generator: string;
    pageCount: number;
    pageHeightPt: number;
    pageWidthPt: number;
    producer: string;
    schemaVersion: number;
  } = {
    generator: "Obsidian Mobile PDF Exporter",
    pageCount: sortedPages.length,
    pageHeightPt,
    pageWidthPt,
    producer: "Pdftion",
    schemaVersion: 1
  };
  if (options.persistDocxText) {
    const documentXml = await zip.file("word/document.xml")?.async("text");
    if (documentXml) {
      const wordNamespace = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
      const parsed = new DOMParser().parseFromString(documentXml, "application/xml");
      manifest.cancipEditedLocatorKeys = Array.from(parsed.getElementsByTagNameNS(wordNamespace, "p"))
        .flatMap((paragraph, paragraphIndex) => (
          paragraph.getElementsByTagNameNS(wordNamespace, "t").length > 0
            ? [`text:word/document.xml:p:${paragraphIndex}`]
            : []
        ));
    }
  }
  zip.file("mpe/preview/manifest.json", JSON.stringify(manifest));
  for (const [pageIndex, page] of sortedPages.entries()) {
    const previewBytes = options.stripPreviewText ? await buildTextFreeOfficePreviewPage(page) : page.bytes;
    zip.file(`mpe/preview/page-${String(pageIndex + 1).padStart(4, "0")}.png`, previewBytes);
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

function exportHexColor(value: string): string {
  const match = value.match(/#?([0-9a-f]{6})/i);
  return (match?.[1] ?? "000000").toUpperCase();
}

function exportFontFace(value: string, text = ""): string {
  const normalized = value.toLowerCase();
  if (/(?:mono|consolas|courier|code)/u.test(normalized)) {
    return "Consolas";
  }
  if (containsCjkPresentation(text)) {
    return /(?:serif|simsun|song|宋体)/u.test(normalized) ? "SimSun" : "Microsoft YaHei";
  }
  if (/(?:serif|times|georgia)/u.test(normalized) && !/(?:sans-serif|sans serif)/u.test(normalized)) {
    return "Times New Roman";
  }
  return "Arial";
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function htmlEscape(value: string): string {
  return xmlEscape(value).replace(/'/g, "&#39;");
}

function htmlAttributeEscape(value: string): string {
  return htmlEscape(value);
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
  ctx.save();
  ctx.globalAlpha = selected ? Math.max(0.14, text.opacity * 0.38) : text.opacity;
  const x = text.x * cssWidth;
  const y = text.y * cssHeight;
  if (text.presentation === "comment") {
    const size = clamp(text.fontSize * 1.65, 22, 32);
    const radius = size * 0.42;
    const centerX = x + radius;
    const centerY = y + radius;
    ctx.fillStyle = text.color;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + size * 0.28, y + size * 0.72);
    ctx.lineTo(x + size * 0.18, y + size);
    ctx.lineTo(x + size * 0.52, y + size * 0.78);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = selected ? 0.7 : 0.94;
    ctx.fillStyle = readableTextColor(text.color);
    for (let index = 0; index < 3; index += 1) {
      ctx.fillRect(x + size * 0.28, y + size * (0.29 + index * 0.16), size * (index === 2 ? 0.3 : 0.46), Math.max(1.5, size * 0.055));
    }
    ctx.restore();
    return;
  }
  const lines = text.text.split(/\r?\n/);
  ctx.fillStyle = text.color;
  ctx.font = `${text.fontSize}px ${text.fontFamily ?? "sans-serif"}`;
  ctx.textBaseline = "top";
  let lineY = y;
  for (const line of lines) {
    ctx.fillText(line, x, lineY);
    lineY += text.fontSize * 1.2;
  }
  ctx.restore();
}

async function convertImageDataUrlToPng(dataUrl: string): Promise<string> {
  if (/^data:image\/png;base64,/i.test(dataUrl)) {
    return dataUrl;
  }
  const image = await loadDataUrlImage(dataUrl);
  const canvas = activeDocument.createElement("canvas");
  canvas.width = Math.max(1, image.naturalWidth || image.width);
  canvas.height = Math.max(1, image.naturalHeight || image.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return dataUrl;
  }
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
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
  if (text.presentation === "comment") {
    const size = clamp(text.fontSize * 1.65, 22, 32);
    const minX = text.x * cssWidth;
    const minY = text.y * cssHeight;
    return { maxX: minX + size, maxY: minY + size, minX, minY };
  }
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
  if (stroke.points.length === 0) {
    return false;
  }
  const displayWidth = strokeDisplayWidth(stroke, cssWidth);
  const hitRadius = stroke.source === "external-ink"
    ? Math.max(16, displayWidth * 3)
    : Math.max(12, displayWidth * 2.4);
  if (stroke.points.length === 1) {
    return normalizedDistance(stroke.points[0], point, cssWidth, cssHeight) <= hitRadius;
  }
  return strokeContainsPoint(stroke, point, cssWidth, cssHeight, hitRadius);
}

function textBoxContainsPoint(text: InkText, point: InkPoint, cssWidth: number, cssHeight: number): boolean {
  const box = textBounds(text, cssWidth, cssHeight);
  const pad = Math.max(11, text.fontSize * 0.5);
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

function coverBoxContainsPoint(
  cover: InkCover | InkImage,
  point: InkPoint,
  cssWidth = 1,
  cssHeight = 1,
  paddingPx = 0
): boolean {
  const padX = paddingPx / Math.max(1, cssWidth);
  const padY = paddingPx / Math.max(1, cssHeight);
  return point.x >= cover.x - padX && point.x <= cover.x + cover.width + padX && point.y >= cover.y - padY && point.y <= cover.y + cover.height + padY;
}

function coverIntersectsSelection(cover: InkCover | InkImage, start: InkPoint, end: InkPoint): boolean {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  return cover.x + cover.width >= minX && cover.x <= maxX && cover.y + cover.height >= minY && cover.y <= maxY;
}

function imageBoxContainsPoint(image: InkImage, point: InkPoint, cssWidth = 1, cssHeight = 1, paddingPx = 0): boolean {
  return coverBoxContainsPoint(image, point, cssWidth, cssHeight, paddingPx);
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

function inkStrokeSetsEquivalent(a: InkElement[], b: InkElement[], pageIndexes: Set<number>): boolean {
  const signature = (elements: InkElement[]): string[] => elements
    .filter((element): element is InkStroke => element.kind === "stroke" && pageIndexes.has(element.pageIndex))
    .map((stroke) => JSON.stringify({
      color: stroke.color,
      id: stroke.id,
      opacity: Number(stroke.opacity.toFixed(4)),
      pageIndex: stroke.pageIndex,
      points: stroke.points.map((point) => [Number(point.x.toFixed(6)), Number(point.y.toFixed(6))]),
      tool: stroke.tool,
      width: Number(stroke.width.toFixed(4))
    }))
    .sort();
  const left = signature(a);
  const right = signature(b);
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function legacyInkLayerRank(element: InkElement): number {
  if (element.kind === "cover") {
    return 0;
  }
  if (element.kind === "image") {
    return 1;
  }
  if (element.kind === "stroke") {
    return 2;
  }
  return 3;
}

function compareInkElements(a: InkElement, b: InkElement): number {
  return (
    (a.pageIndex - b.pageIndex) ||
    ((a.zIndex ?? Number.MAX_SAFE_INTEGER) - (b.zIndex ?? Number.MAX_SAFE_INTEGER)) ||
    (legacyInkLayerRank(a) - legacyInkLayerRank(b)) ||
    a.id.localeCompare(b.id)
  );
}

function normalizeInkElementLayers(elements: InkElement[]): void {
  const pages = new Map<number, Array<{ element: InkElement; index: number }>>();
  elements.forEach((element, index) => {
    const page = pages.get(element.pageIndex) ?? [];
    page.push({ element, index });
    pages.set(element.pageIndex, page);
  });

  for (const page of pages.values()) {
    const hasStoredLayers = page.some(({ element }) => Number.isFinite(element.zIndex));
    if (hasStoredLayers) {
      let nextLayer = page.reduce((max, { element }) => Math.max(max, Number.isFinite(element.zIndex) ? element.zIndex ?? 0 : 0), 0) + 1;
      for (const item of page) {
        if (!Number.isFinite(item.element.zIndex)) {
          item.element.zIndex = nextLayer;
          nextLayer += 1;
        }
      }
      page.sort((a, b) => ((a.element.zIndex ?? 0) - (b.element.zIndex ?? 0)) || (a.index - b.index));
    } else {
      page.sort((a, b) => (legacyInkLayerRank(a.element) - legacyInkLayerRank(b.element)) || (a.index - b.index));
    }
    page.forEach(({ element }, index) => {
      element.zIndex = index + 1;
    });
  }
}

function addStandardTextCommentAnnotation(
  pdf: PDFDocument,
  page: ReturnType<PDFDocument["getPage"]>,
  comment: InkText,
  pageWidth: number,
  pageHeight: number
): void {
  const iconSize = Math.max(16, Math.min(28, comment.fontSize * 1.65)) * (pageWidth / Math.max(1, comment.pageCssWidth));
  const x = comment.x * pageWidth;
  const y = pageHeight - comment.y * pageHeight;
  const annotation = pdf.context.obj({
    C: pdf.context.obj([hexToRgb(comment.color).r, hexToRgb(comment.color).g, hexToRgb(comment.color).b]),
    Contents: PDFHexString.fromText(comment.text),
    F: PDFNumber.of(4),
    M: PDFHexString.fromText(new Date(comment.createdAt ?? Date.now()).toISOString()),
    Name: PDFName.of("Comment"),
    NM: PDFHexString.fromText(`PdftionComment:${comment.id}`),
    Open: false,
    Rect: pdf.context.obj([x, Math.max(0, y - iconSize), Math.min(pageWidth, x + iconSize), Math.min(pageHeight, y)]),
    Subtype: PDFName.of("Text"),
    T: PDFHexString.fromText("Pdftion"),
    Type: PDFName.of("Annot")
  });
  const annotationRef = pdf.context.register(annotation);
  const pageNode = page.node as unknown as {
    addAnnot?: (annotRef: unknown) => void;
    Annots?: () => PDFArray | undefined;
    set: (key: PDFName, value: PDFArray) => void;
  };
  if (typeof pageNode.addAnnot === "function") {
    pageNode.addAnnot(annotationRef);
    return;
  }
  let annots = pageNode.Annots?.();
  if (!annots) {
    annots = pdf.context.obj([]);
    pageNode.set(PDFName.of("Annots"), annots);
  }
  annots.push(annotationRef);
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

function normalizedTextBounds(text: InkText): NormalizedBounds {
  if (text.presentation === "comment") {
    const size = clamp(text.fontSize * 1.65, 22, 32);
    return {
      maxX: text.x + size / Math.max(1, text.pageCssWidth),
      maxY: text.y + size / Math.max(1, text.pageCssHeight),
      minX: text.x,
      minY: text.y
    };
  }
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
  const box = strokeBounds(stroke, cssWidth, cssHeight);
  if (!box || px < box.minX - radius || px > box.maxX + radius || py < box.minY - radius || py > box.maxY + radius) {
    return false;
  }

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
