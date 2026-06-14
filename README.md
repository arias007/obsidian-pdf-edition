# pdftion

pdftion is a PDF annotation and editing plugin for note-taking workflows. It adds editable ink, highlights, text, covers, image overlays, visual PDF export, Markdown/DOCX helpers, and an AI-friendly operation API to PDF views and embedded PDF previews.

## Features

- Draw pen and highlighter annotations directly on PDF pages.
- Add editable text, cover regions, and inserted images as reusable overlay elements.
- Move, resize, delete, undo, and redo plugin-created annotation elements.
- Export a visible annotated PDF copy, plus Markdown and DOCX conversion helpers.
- Use the Pdftion AI API to inspect, select, update, delete, and export annotation data from scripts or AI agents.

## Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the matching GitHub release.
2. Create a folder named `pdftion` inside your vault's `.obsidian/plugins/` folder.
3. Copy the three downloaded files into `.obsidian/plugins/pdftion/`.
4. Restart Obsidian or reload community plugins.
5. Enable `pdftion` in Settings -> Community plugins.

## Usage

1. Open a PDF file or an embedded PDF preview.
2. Click the pen button in the PDF toolbar.
3. Draw, highlight, add text, cover content, select elements, or use the share menu.
4. Edits are saved automatically as editable annotation data.
5. Use the share menu to export a burned-in PDF copy when you need a file that looks like the current annotated view.

## 中文说明

pdftion 给 Obsidian PDF 阅读器和笔记内嵌 PDF 加批注、编辑、导出、AI 操作接口和 Obsidian 融合能力。

## 功能

- 在 PDF 顶部菜单增加 pdftion 按钮；参考 PDF++ 的原生 PDF 工具栏增强方向，优先挂到 `.pdf-toolbar` / `.pdf-toolbar-actions` 等官方 PDF 工具栏，其次才退到 Obsidian 页签动作区或引用兜底按钮。
- 开放 Pdftion AI API 给 AI/脚本统计、整理、选择、批量增删改、导出 Markdown、导出带标注 PDF、跳页和记录裁剪参数。
- AI/脚本接口新增 `findElements()`、`applyPlan()`、`getAnnotationsMarkdown()`、`insertObsidianLink()`、`insertVaultImage()` 和 `exportMarkdownDocxBridge()`，用于统计、整理、批量操作和自动导出。
- 工具栏分享按钮是三项子菜单：导出烧录 PDF、转换 DOCX 文档、转换 MD 文件。
- 0.3.7 修复分享里的“导出烧录 PDF”：恢复稳定的同目录 `*-annotated.pdf` 生成路径，直接把当前可编辑标注烧录到副本，不再走 0.3.4 引入的遮挡页重建导出流程。
- 0.3.8 修复导出按钮无反馈/无文件：烧录 PDF 不再依赖等待页面下一帧的前置快照，点击后立即提示并进入同目录写出流程；失败时显示具体原因。
- 0.3.9 修复纯涂鸦导出卡在烧录阶段：无文字元素时跳过中文字体加载/嵌入，并在写入前提示目标路径。
- 0.3.10 放宽工具栏横向空间，减少按钮溢出；页面/标注导航面板移除“固化遮挡”按钮。
- 0.3.11 页面/标注导航面板改为窄竖排，页码列表独立滚动，避免横向按钮挤出屏幕。
- 0.3.12 自动保存改为只写可编辑标注数据，不再后台改写当前 PDF；批注开启时低频自检并修复失效画布，减少过段时间不能涂鸦。
- 0.3.13 笔/高亮拖动优先涂鸦，只有轻点元素才选择；已选中元素时点空白会取消选择，不再留下小点。
- 0.3.14 点空白取消选择也覆盖原生文字/区域选择，避免取消选择时误画小点。
- 工具栏新增 OB 链接入口，可把 `[[笔记]]` 写成 PDF 文字批注；`![[图片.png]]` 会优先解析 Vault 图片并插入为可移动/缩放图片。
- 支持导出 PDF 标注为 Markdown，便于整理到 Obsidian 笔记、复习卡片或后续 AI 处理。
- 文字调色板增加字体选择，选中文字时调色板会直接修改当前选中文字；文字颜色/字体与钢笔设置分开保存，避免互串。
- 分享/导出带标注 PDF 使用 object streams 压缩写出；被遮挡区域的真正内容流删除属于后续 redact/压缩引擎能力。
- MD/DOCX 互转入口现在会导出标注 Markdown 和一个基础 DOCX 摘要文件；完整 PDF 原文往返 DOCX 仍需后续接入转换引擎。
- 点击后在 PDF 页面上叠加手写画布。
- 支持钢笔、高亮笔、PDF 文字、覆盖原内容、选择、橡皮、撤销、重做、框选四角缩放、删除选中元素或清空本插件标注。
- 主工具条只保留一个调色板按钮，调色板按当前工具显示对应设置；橡皮只显示大小条。
- 触摸屏上单指用于标注；双指在空白处优先顺畅上下滑动 PDF，明显捏合时缩放 PDF；双指在选中元素框内捏合可缩放选中元素。
- PDF 打开后会短时补扫挂载按钮；书写过程中暂停页面重扫，减少刷新感。
- PDF 重开、工具栏重绘、引用块重绘后会补扫重挂载按钮和画布，减少重新打开后不能涂鸦的问题。
- 引用 PDF 优先使用外层引用块作为挂载根节点，避免只挂到内层 PDF 容器导致引用菜单看不到标注按钮。
- 自动保存改为空闲批量写入，避免每一笔都触发 PDF 预览重载。
- 已选元素在钢笔、水彩笔或选择工具下都可拖动、四角缩放和双指捏合缩放；支持撤销和重做。
- 钢笔和水彩笔轻点当前会话内未保存标注时会选中元素，不会新增小点。
- 笔和水彩笔各自保留独立颜色、大小和透明度。
- 画完后自动保存为可编辑标注数据，不再用保存按钮占工具条空间；分享/导出时再生成烧录 PDF。
- 选择工具可点击标注外框内区域选中当前会话中的标注，显示框选并让选中标注半透明。
- 画完新笔迹不会自动选中新笔迹，避免刚写完就出现选框或半透明状态。
- 去掉后台 1.2 秒轮询扫描，避免 PDF/嵌入区域不停刷新。
- 保留 PDF 菜单层级和按钮可点性，但不再强制拉高 PDF 顶部菜单高度，避免 PDF 与顶部之间出现大空白。
- 标注工具条显示在 PDF 上方的预留工具栏区，不再浮在 PDF 页面上挡正文。
- 调色板仍是临时弹层，用完可关闭。
- 切换页面、隐藏窗口、关闭/重开 PDF 前会尽量立即保存未写入 PDF 的笔迹，降低漏保存概率。
- 双指滚动恢复上下左右滑动；只有明显捏合时才触发 PDF 或选中元素缩放。
- 打开 PDF 文件窗口并启用批注后，PDF 顶部会预留一小段空间给标注工具条，减少挡住正文。
- 引用 PDF 在批注状态下会阻止原生单指滚动抢占，减少边滑动边涂鸦导致笔迹中断。
- PDF 文字工具支持中文字体，新增的文字批注可选中、拖动、四角缩放、删除，并自动保存为可编辑标注数据。
- 本插件标注会保存可编辑元数据和基底 PDF；重开 PDF 后，本插件做过的手写、文字、覆盖块仍可继续选择、移动、缩放和删除。
- 覆盖工具可用白色矩形遮住 PDF 原有文字、图片或对象，再叠加新文字；这是覆盖式硬编辑，不直接拆 PDF 原内容流。

## 安装

1. 关闭 Obsidian 或至少先关闭目标 Vault。
2. 把 `pdftion` 文件夹复制到：

   ```text
   <YourVault>\.obsidian\plugins\pdftion
   ```

3. 打开 Obsidian。
4. 设置 → 第三方插件 → 关闭安全模式或允许第三方插件。
5. 启用 `pdftion`。

## 使用

1. 在 Obsidian 打开 PDF。
2. 点击 PDF 顶部菜单里的笔头按钮。
3. 在页面上直接写字、划高亮，或点文字工具添加 PDF 文字。
4. 要“删除/改掉”PDF 原有文字或图片时，先用覆盖工具框住原内容，再添加新的文字或标注。
5. 画完后会自动保存为可编辑标注数据；要生成所见即所得文件时点分享里的“导出烧录 PDF”。

## 注意

- 自动保存不直接修改原 PDF；分享里的“导出烧录 PDF”会生成同目录副本。
- 当前版本重点支持自由手写和高亮墨迹，不是完整替代品。
- 保存后的墨迹/文字/覆盖块会保留为可编辑标注；分享/导出烧录 PDF 时才写入副本文件。
- 0.2.20 及更早版本已经烧录但没有 sidecar 元数据的旧标注，无法可靠反解析成独立可编辑对象。
- PDF 原文件里已经存在的文字、图片和对象采用覆盖块方式硬改；不直接解析并删除 PDF 内容流里的原对象。
- 如果 PDF 加密、只读、被其他程序占用，保存可能失败。
- 连续快速书写会合并延迟保存，避免每一笔都立刻重写 PDF。



