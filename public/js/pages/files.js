let fileCurrentPath = '/';
let fileItems = [];
let fileSelectedItems = new Set();
let fileClipboard = null;
let fileHistory = ['/'];
let fileHistoryIndex = 0;
let fileViewMode = localStorage.getItem('fileViewMode');
if (!fileViewMode) fileViewMode = window.innerWidth <= 768 ? 'list' : 'grid';
let fileSortField = localStorage.getItem('fileSortField') || 'name';
let fileSortDir = localStorage.getItem('fileSortDir') || 'asc';
let fileFilter = 'all';
let fileSearchQuery = '';
let lastClickedIndex = -1;
let fileBookmarks = JSON.parse(localStorage.getItem('fileBookmarks') || '[]');
let fileDragCounter = 0;
let _fileLongPress = 0;
let _fileCtxOpen = 0;

async function renderFiles(el) {
  fileCurrentPath = localStorage.getItem('filePath') || '/';
  fileSelectedItems = new Set();
  fileHistory = [fileCurrentPath];
  fileHistoryIndex = 0;

  el.innerHTML = `
    <div class="file-manager" id="file-manager-root">
      <div class="file-toolbar" id="file-toolbar">
        <div class="toolbar-row primary">
          <div class="toolbar-group"><button onclick="fileNavBack()" class="btn btn-icon btn-sm" id="file-back-btn" disabled title="后退"><i class="fas fa-arrow-left"></i></button>
            <button onclick="fileNavForward()" class="btn btn-icon btn-sm" id="file-forward-btn" disabled title="前进"><i class="fas fa-arrow-right"></i></button>
            <button onclick="fileNavUp()" class="btn btn-icon btn-sm" title="上级"><i class="fas fa-arrow-up"></i></button>
            <button onclick="fileRefresh()" class="btn btn-icon btn-sm" title="刷新"><i class="fas fa-sync-alt"></i></button>
          </div>
          <div class="toolbar-path" id="file-breadcrumb"></div>
          <div class="toolbar-group"><button onclick="fileToggleFilter()" class="btn btn-icon btn-sm" id="file-filter-btn" title="过滤"><i class="fas fa-filter"></i></button>
            <button onclick="fileToggleSearch()" class="btn btn-icon btn-sm" id="file-search-btn" title="搜索"><i class="fas fa-search"></i></button>
            <button onclick="fileToggleView()" class="btn btn-icon btn-sm" id="file-view-btn" title="切换视图"><i class="fas fa-${fileViewMode === 'grid' ? 'list' : 'th'}"></i></button>
            ${window.innerWidth <= 768 ? `<button onclick="fileShowMobileActions()" class="btn btn-icon btn-sm" id="file-more-btn" title="更多操作"><i class="fas fa-plus"></i></button>` : ''}
          </div>
        </div>
        <div class="toolbar-row secondary" id="file-secondary-bar"${window.innerWidth <= 768 ? ' style="display:none"' : ''}>
          <div class="toolbar-group">
            <button onclick="fileNewFolder()" class="btn btn-sm"><i class="fas fa-folder-plus"></i> 新建文件夹</button>
            <button onclick="fileNewFile()" class="btn btn-sm"><i class="fas fa-file-plus"></i> 新建文件</button>
            <button onclick="fileUpload()" class="btn btn-sm"><i class="fas fa-upload"></i> 上传</button>
            <button onclick="fileDownloadSelected()" class="btn btn-sm" id="file-download-btn" disabled><i class="fas fa-download"></i> 下载</button>
            <button onclick="fileDeleteSelected()" class="btn btn-sm btn-danger" id="file-delete-btn" disabled><i class="fas fa-trash"></i> 删除</button>
            <button onclick="fileCompressSelected()" class="btn btn-sm" id="file-compress-btn" disabled><i class="fas fa-file-archive"></i> 压缩</button>
          </div>
        </div>
        <div class="toolbar-row search" id="file-search-area" style="display:none">
          <input type="text" id="file-search-input" class="form-control sm" placeholder="搜索文件名..." onkeydown="if(event.key==='Enter')fileDoSearch()">
          <button class="btn btn-sm btn-primary" onclick="fileDoSearch()"><i class="fas fa-search"></i></button>
          <button class="btn btn-sm btn-ghost" onclick="fileToggleSearch()"><i class="fas fa-times"></i></button>
        </div>
        <div class="toolbar-row sort" id="file-sort-area" style="display:none">
          <label style="font-size:13px;color:var(--md-on-surface-variant);margin-right:6px">排序:</label>
          <select id="file-sort-field" class="form-control sm" style="width:auto" onchange="fileSetSort(this.value, fileSortDir)">
            <option value="name">名称</option><option value="size">大小</option><option value="modified">修改时间</option>
          </select>
          <button class="btn btn-icon btn-sm" onclick="fileToggleSortDir()" id="file-sort-dir-btn" title="切换排序方向"><i class="fas fa-arrow-${fileSortDir === 'asc' ? 'up' : 'down'}"></i></button>
          <label style="font-size:13px;color:var(--md-on-surface-variant);margin:0 6px 0 12px">显示:</label>
          <select id="file-filter-select" class="form-control sm" style="width:auto" onchange="fileSetFilter(this.value)">
            <option value="all">全部</option><option value="dirs">文件夹</option><option value="files">文件</option>
          </select>
        </div>
      </div>
      <input type="file" id="file-upload-input" multiple style="display:none" onchange="fileHandleUpload(this.files)">
      <div class="file-drop-zone" id="file-drop-zone">
        <div class="file-grid" id="file-grid"><div class="file-loading"><i class="fas fa-spinner fa-spin"></i> 加载中...</div></div>
        <div class="file-drop-overlay" id="file-drop-overlay"><i class="fas fa-cloud-upload-alt"></i><p>释放文件以上传</p></div>
      </div>
      <div class="file-status-bar"><div class="file-status-left"><span id="file-status-info">就绪</span></div>
        <div class="file-status-right"><span id="file-status-selection"></span></div>
      </div>
      <div class="file-progress-bar" id="file-progress-bar" style="display:none"><div class="file-progress-fill" id="file-progress-fill"></div><span id="file-progress-text">0%</span></div>
    </div>`;
  fileLoadList(fileCurrentPath);
  setupFileDragDrop();
  setupFileKeyboard();
  updateBreadcrumb();
}

function setupFileDragDrop() {
  const zone = document.getElementById('file-drop-zone');
  if (!zone) return;
  zone.addEventListener('dragenter', (e) => { e.preventDefault(); fileDragCounter++; document.getElementById('file-drop-overlay').classList.add('show'); });
  zone.addEventListener('dragover', (e) => e.preventDefault());
  zone.addEventListener('dragleave', (e) => { e.preventDefault(); fileDragCounter--; if (fileDragCounter <= 0) { fileDragCounter = 0; document.getElementById('file-drop-overlay').classList.remove('show'); } });
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDragCounter = 0;
    document.getElementById('file-drop-overlay').classList.remove('show');
    if (e.dataTransfer.files.length) fileHandleUpload(e.dataTransfer.files);
  });
}

function setupFileKeyboard() {
  document.addEventListener('keydown', fileGlobalKeydown);
}

let fileKeydownHandler = null;
function fileGlobalKeydown(e) {
  const active = document.activeElement;
  const inEditor = active && (active.id === 'file-editor' || active.id === 'file-path-input' || active.id === 'file-search-input' || active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
  if (inEditor) return;
  const fm = document.getElementById('file-manager-root');
  if (!fm || fm.offsetParent === null) return;
  if (e.ctrlKey && e.key === 'a') { e.preventDefault(); fileSelectAll(); }
  if (e.ctrlKey && e.key === 'c' && fileSelectedItems.size === 1) { fileCopyItem(Array.from(fileSelectedItems)[0]); }
  if (e.ctrlKey && e.key === 'x' && fileSelectedItems.size === 1) { fileCutItem(Array.from(fileSelectedItems)[0]); }
  if (e.ctrlKey && e.key === 'v') { e.preventDefault(); filePaste(); }
  if (e.ctrlKey && e.key === 'd') { e.preventDefault(); fileDuplicateSelected(); }
  if (e.key === 'Delete' || e.key === 'Backspace') { if (fileSelectedItems.size > 0) { e.preventDefault(); fileDeleteSelected(); } }
  if (e.key === 'F2') { e.preventDefault(); if (fileSelectedItems.size === 1) fileRename(Array.from(fileSelectedItems)[0]); }
  if (e.key === 'F5') { e.preventDefault(); fileRefresh(); }
  if (e.ctrlKey && e.key === 'f') { e.preventDefault(); fileToggleSearch(); }
}

async function fileLoadList(dirPath) {
  const grid = document.getElementById('file-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="file-loading"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>';
  const data = await apiRequest('GET', `/files/list?path=${encodeURIComponent(dirPath)}`);
  if (!data) { grid.innerHTML = '<div class="file-loading error">加载失败</div>'; return; }
  fileCurrentPath = data.currentPath;
  localStorage.setItem('filePath', fileCurrentPath);
  document.getElementById('file-path-input') && (document.getElementById('file-path-input').value = fileCurrentPath);
  fileItems = data.items || [];
  updateFileNavButtons();
  updateBreadcrumb();
  lastClickedIndex = -1;
  fileSelectedItems.clear();
  renderFileItems();
}

function renderFileItems() {
  const grid = document.getElementById('file-grid');
  if (!grid) return;
  const isDriveList = fileItems.some(i => i.isDrive);
  if (isDriveList) {
    grid.innerHTML = fileItems.map(d => `<div class="file-item drive" ondblclick="fileLoadList('${d.path}')" onclick="fileToggleSelect(this, '${escapeHtml(d.path)}')"><div class="file-icon"><i class="fas fa-hdd" style="color:#4A90D9;font-size:48px"></i></div><div class="file-name">${escapeHtml(d.name)}</div></div>`).join('');
    updateFileStatus(fileItems);
    return;
  }
  let filtered = [...fileItems];
  if (fileFilter === 'dirs') filtered = filtered.filter(i => i.isDirectory);
  else if (fileFilter === 'files') filtered = filtered.filter(i => !i.isDirectory);
  if (fileSearchQuery) {
    const q = fileSearchQuery.toLowerCase();
    filtered = filtered.filter(i => i.name.toLowerCase().includes(q));
  }
  const sorted = sortItems(filtered, fileSortField, fileSortDir);
  if (sorted.length === 0) {
    const msg = fileSearchQuery ? '未找到匹配的文件' : '此文件夹为空';
    grid.innerHTML = `<div class="file-empty"><i class="fas fa-folder-open"></i><p>${msg}</p></div>`;
    updateFileStatus(filtered);
    return;
  }
  if (fileViewMode === 'grid') {
    grid.innerHTML = sorted.map((item, idx) => `<div class="file-item${item.isDirectory ? ' directory' : ' file'}" style="animation-delay:${(idx * 0.025).toFixed(2)}s" onclick="fileToggleSelect(this, '${escapeHtml(item.path)}', ${idx})" ondblclick="fileDoubleClick('${escapeHtml(item.path)}', ${item.isDirectory})" oncontextmenu="fileContextMenu(event, '${escapeHtml(item.path)}', ${item.isDirectory})"><div class="file-icon">${item.isDirectory ? '<i class="fas fa-folder" style="color:#FFB300;font-size:38px"></i>' : getFileIcon(item.name)}</div><div class="file-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div><div class="file-details"><span>${item.isDirectory ? '-' : formatSize(item.size)}</span><span>${formatDate(item.modified)}</span></div></div>`).join('');
  } else {
    grid.innerHTML = `<div class="file-list-header"><span class="fl-col-name">名称</span><span class="fl-col-size" onclick="fileSetSort('size')">大小</span><span class="fl-col-date" onclick="fileSetSort('modified')">修改时间</span><span class="fl-col-perms">权限</span></div>` + sorted.map((item, idx) => `<div class="file-item list${item.isDirectory ? ' directory' : ' file'} ${item.isDrive ? 'drive' : ''}" onclick="fileToggleSelect(this, '${escapeHtml(item.path)}', ${idx})" ondblclick="fileDoubleClick('${escapeHtml(item.path)}', ${item.isDirectory})" oncontextmenu="fileContextMenu(event, '${escapeHtml(item.path)}', ${item.isDirectory})"><div class="fl-icon">${item.isDirectory ? '<i class="fas fa-folder" style="color:#FFB300"></i>' : getFileIcon(item.name)}</div><div class="fl-col-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div><div class="fl-col-size">${item.isDirectory ? '-' : formatSize(item.size)}</div><div class="fl-col-date">${item.modified ? new Date(item.modified).toLocaleDateString('zh-CN') + ' ' + new Date(item.modified).toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'}) : '-'}</div><div class="fl-col-perms">${item.permissions || '-'}</div></div>`).join('');
  }
  updateFileStatus(sorted);
}

function sortItems(items, field, dir) {
  const sorted = [...items];
  sorted.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    let cmp = 0;
    if (field === 'name') cmp = a.name.localeCompare(b.name, 'zh-CN');
    else if (field === 'size') cmp = (a.size || 0) - (b.size || 0);
    else if (field === 'modified') cmp = new Date(a.modified || 0) - new Date(b.modified || 0);
    return dir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

function getFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const icons = {
    txt:'fa-file-alt', md:'fa-file-alt', json:'fa-file-code', xml:'fa-file-code',
    html:'fa-file-code', css:'fa-file-code', js:'fa-file-code', ts:'fa-file-code',
    py:'fa-file-code', java:'fa-file-code', c:'fa-file-code', cpp:'fa-file-code',
    zip:'fa-file-archive', rar:'fa-file-archive', '7z':'fa-file-archive', tar:'fa-file-archive', gz:'fa-file-archive',
    jpg:'fa-file-image', jpeg:'fa-file-image', png:'fa-file-image', gif:'fa-file-image', bmp:'fa-file-image', svg:'fa-file-image', webp:'fa-file-image',
    mp4:'fa-file-video', avi:'fa-file-video', mkv:'fa-file-video', mov:'fa-file-video',
    mp3:'fa-file-audio', wav:'fa-file-audio', flac:'fa-file-audio',
    pdf:'fa-file-pdf', doc:'fa-file-word', docx:'fa-file-word', xls:'fa-file-excel', xlsx:'fa-file-excel',
    exe:'fa-file-code', dll:'fa-file-code', msi:'fa-file-code',
    sh:'fa-terminal', bat:'fa-terminal', ps1:'fa-terminal',
    iso:'fa-compact-disc', img:'fa-compact-disc'
  };
  return `<i class="fas ${icons[ext] || 'fa-file'}" style="color:#607D8B;font-size:38px"></i>`;
}

function fileToggleSelect(el, path, idx) {
  if (_fileLongPress) { _fileLongPress = 0; return; }
  if (idx !== undefined) {
    if (window.event && window.event.shiftKey && lastClickedIndex >= 0) {
      const items = document.querySelectorAll('#file-grid .file-item:not(.file-list-header)');
      const start = Math.min(lastClickedIndex, idx);
      const end = Math.max(lastClickedIndex, idx);
      for (let i = start; i <= end; i++) {
        const itemEl = items[i];
        if (!itemEl) continue;
        const p = itemEl.getAttribute('data-path') || (fileItems[i] ? fileItems[i].path : null);
        if (p) { itemEl.classList.add('selected'); fileSelectedItems.add(p); }
      }
      updateFileActionButtons();
      return;
    }
    lastClickedIndex = idx;
  }
  if (el.classList.contains('selected')) {
    el.classList.remove('selected');
    fileSelectedItems.delete(path);
  } else {
    el.classList.add('selected');
    fileSelectedItems.add(path);
  }
  updateFileActionButtons();
}

function fileSelectAll() {
  const els = document.querySelectorAll('#file-grid .file-item:not(.file-list-header)');
  const allSelected = fileSelectedItems.size === els.length && els.length > 0;
  els.forEach(el => {
    if (allSelected) { el.classList.remove('selected'); }
    else { el.classList.add('selected'); }
  });
  if (allSelected) fileSelectedItems.clear();
  else fileSelectedItems = new Set(fileItems.map(i => i.path));
  updateFileActionButtons();
}

function fileInvertSelection() {
  const els = document.querySelectorAll('#file-grid .file-item:not(.file-list-header)');
  fileSelectedItems.clear();
  els.forEach(el => {
    if (el.classList.contains('selected')) el.classList.remove('selected');
    else { el.classList.add('selected'); const p = el.getAttribute('data-path'); if (p) fileSelectedItems.add(p); }
  });
  updateFileActionButtons();
}

async function fileDoubleClick(path, isDir) {
  if (isDir) {
    fileHistory = fileHistory.slice(0, fileHistoryIndex + 1);
    fileHistory.push(path);
    fileHistoryIndex = fileHistory.length - 1;
    fileLoadList(path);
  } else {
    const ext = path.split('.').pop().toLowerCase();
    const imageExts = ['jpg','jpeg','png','gif','bmp','svg','webp','ico'];
    const videoExts = ['mp4','webm','avi','mkv','mov','flv'];
    const audioExts = ['mp3','wav','flac','ogg','aac','wma'];
    if (imageExts.includes(ext)) { filePreviewImage(path); return; }
    if (videoExts.includes(ext)) { filePreviewVideo(path); return; }
    if (audioExts.includes(ext)) { filePreviewAudio(path); return; }
    const data = await apiRequest('GET', `/files/read?path=${encodeURIComponent(path)}`);
    if (data && data.type === 'text') { showFileEditor(path, data.content, data.name); }
    else { fileDownload(path); }
  }
}

function filePreviewImage(path) {
  createModal('图片预览', `<div class="preview-container"><img src="${API}/files/preview?path=${encodeURIComponent(path)}" class="preview-image" onclick="this.classList.toggle('zoomed')"></div>`, `<div class="preview-actions"><button class="btn btn-sm" onclick="fileDownload('${escapeHtml(path)}')"><i class="fas fa-download"></i> 下载</button><button class="btn btn-sm btn-ghost" onclick="this.closest('.modal-overlay').remove()">关闭</button></div>`);
}

function filePreviewVideo(path) {
  createModal('视频预览', `<div class="preview-container"><video src="${API}/files/preview?path=${encodeURIComponent(path)}" controls autoplay class="preview-video"></video></div>`, `<button class="btn btn-sm btn-ghost" onclick="this.closest('.modal-overlay').remove()">关闭</button>`);
}

function filePreviewAudio(path) {
  createModal('音频播放', `<div class="preview-container audio"><i class="fas fa-music"></i><p>${escapeHtml(path.split('/').pop().split('\\').pop())}</p><audio src="${API}/files/preview?path=${encodeURIComponent(path)}" controls autoplay></audio></div>`, `<button class="btn btn-sm btn-ghost" onclick="this.closest('.modal-overlay').remove()">关闭</button>`);
}

function showFileEditor(filePath, content, fileName) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const lineCount = (content || '').split('\n').length;
  const highlighted = highlightSyntax(content || '');
  overlay.innerHTML = `<div class="modal editor-modal"><div class="modal-header"><h3>${escapeHtml(fileName)}</h3><div class="modal-header-actions"><span class="editor-info">${lineCount} 行</span><button class="btn btn-sm btn-ghost" onclick="toggleEditorHighlight()" title="语法高亮"><i class="fas fa-paint-brush"></i></button><button class="modal-close" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-times"></i></button></div></div><div class="modal-body"><div class="editor-wrap"><div class="editor-lines" id="editor-lines">${Array.from({length: lineCount}, (_, i) => `<span>${i + 1}</span>`).join('\n')}</div><div class="editor-code"><pre class="editor-highlight" id="editor-highlight"><code>${highlighted}</code></pre><textarea id="file-editor" class="file-editor" spellcheck="false">${escapeHtml(content || '')}</textarea></div></div></div><div class="modal-footer"><button class="btn btn-primary" onclick="fileSave('${escapeHtml(filePath)}')"><i class="fas fa-save"></i> 保存</button><button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">取消</button></div></div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  setTimeout(() => {
    const editor = document.getElementById('file-editor');
    if (editor) { editor.focus(); syncEditorAll(); editor.addEventListener('input', syncEditorAll); editor.addEventListener('scroll', syncEditorScroll); editor.addEventListener('keydown', editorKeydown); }
  }, 50);
}

function editorKeydown(e) {
  if (e.key === 'Tab') {
    e.preventDefault();
    const ta = e.target;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    ta.value = ta.value.substring(0, start) + '  ' + ta.value.substring(end);
    ta.selectionStart = ta.selectionEnd = start + 2;
    syncEditorAll();
  }
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault();
    const btn = document.querySelector('.modal-footer .btn-primary');
    if (btn) btn.click();
  }
}

function toggleEditorHighlight() {
  const hl = document.getElementById('editor-highlight');
  if (!hl) return;
  const on = hl.style.display !== 'none';
  hl.style.display = on ? 'none' : '';
  const editor = document.getElementById('file-editor');
  if (editor) editor.style.color = on ? '#E6E1E5' : 'transparent';
}

function syncEditorAll() {
  const editor = document.getElementById('file-editor');
  const lines = document.getElementById('editor-lines');
  const hl = document.getElementById('editor-highlight');
  if (!editor) return;
  const val = editor.value;
  const count = val.split('\n').length;
  if (lines) {
    const currentCount = lines.children.length;
    if (count !== currentCount) {
      lines.innerHTML = Array.from({length: count}, (_, i) => `<span>${i + 1}</span>`).join('');
    }
  }
  if (hl) {
    hl.innerHTML = '<code>' + highlightSyntax(val) + '</code>';
  }
}

function syncEditorScroll() {
  const editor = document.getElementById('file-editor');
  const lines = document.getElementById('editor-lines');
  const hl = document.getElementById('editor-highlight');
  if (lines) lines.scrollTop = editor.scrollTop;
  if (hl) hl.scrollTop = editor.scrollTop;
}

function highlightSyntax(code) {
  return escapeHtml(code)
    .replace(/(\/\/[^\n]*)/g, '<span class="hl-cm">$1</span>')
    .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="hl-cm">$1</span>')
    .replace(/\b(function|var|let|const|if|else|for|while|do|switch|case|break|continue|return|import|export|from|class|extends|new|this|async|await|try|catch|finally|throw|typeof|instanceof|in|of|true|false|null|undefined|void|delete)\b/g, '<span class="hl-kw">$1</span>')
    .replace(/\b(int|float|double|char|bool|string|void|long|short|unsigned|signed|struct|enum|union|typedef|namespace|using|template|typename|public|private|protected|static|virtual|override|const|volatile|inline|friend|class|define|include|ifdef|endif|pragma)\b/g, '<span class="hl-kw">$1</span>')
    .replace(/\b(import|def|class|if|elif|else|for|while|break|continue|return|lambda|yield|with|as|pass|raise|try|except|finally|from|global|nonlocal|True|False|None|in|not|and|or|is|del|print)\b/g, '<span class="hl-kw">$1</span>')
    .replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, '<span class="hl-str">"$1"</span>')
    .replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '<span class="hl-str">\'$1\'</span>')
    .replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-num">$1</span>')
    .replace(/`([^`]*)`/g, '<span class="hl-str">`$1`</span>');
}

async function fileSave(filePath) {
  const content = document.getElementById('file-editor')?.value;
  if (content === undefined) return;
  showLoading(true);
  const result = await apiRequest('POST', '/files/save', { path: filePath, content });
  showLoading(false);
  if (result && result.success) { document.querySelector('.modal-overlay')?.remove(); showToast('保存成功'); }
  else showToast(result?.error || '保存失败', 'error');
}

function fileDownload(filePath) {
  window.open(`${API}/files/download?path=${encodeURIComponent(filePath)}`, '_blank');
}

async function fileDownloadSelected() {
  if (fileSelectedItems.size === 0) return;
  const paths = Array.from(fileSelectedItems);
  if (paths.length === 1) { window.open(`${API}/files/download?path=${encodeURIComponent(paths[0])}`, '_blank'); return; }
  const form = document.createElement('form');
  form.method = 'POST'; form.action = `${API}/files/download-multiple`; form.target = '_blank';
  const input = document.createElement('input'); input.type = 'hidden'; input.name = 'paths'; input.value = JSON.stringify(paths);
  form.appendChild(input); document.body.appendChild(form); form.submit(); form.remove();
}

function fileNavBack() { if (fileHistoryIndex > 0) { fileHistoryIndex--; fileLoadList(fileHistory[fileHistoryIndex]); } }
function fileNavForward() { if (fileHistoryIndex < fileHistory.length - 1) { fileHistoryIndex++; fileLoadList(fileHistory[fileHistoryIndex]); } }

function fileNavUp() {
  if (fileCurrentPath === '/') return;
  const parts = fileCurrentPath.replace(/\\/g, '/').replace(/\/$/, '').split('/');
  parts.pop();
  const parent = parts.join('/') || '/';
  fileHistory = fileHistory.slice(0, fileHistoryIndex + 1);
  fileHistory.push(parent);
  fileHistoryIndex = fileHistory.length - 1;
  fileLoadList(parent);
}

function fileRefresh() { fileLoadList(fileCurrentPath); }

function updateFileNavButtons() {
  const backBtn = document.getElementById('file-back-btn');
  const fwdBtn = document.getElementById('file-forward-btn');
  if (backBtn) backBtn.disabled = fileHistoryIndex <= 0;
  if (fwdBtn) fwdBtn.disabled = fileHistoryIndex >= fileHistory.length - 1;
}

function updateFileActionButtons() {
  const count = fileSelectedItems.size;
  const dlBtn = document.getElementById('file-download-btn');
  const delBtn = document.getElementById('file-delete-btn');
  const cpBtn = document.getElementById('file-compress-btn');
  if (dlBtn) dlBtn.disabled = count === 0;
  if (delBtn) delBtn.disabled = count === 0;
  if (cpBtn) cpBtn.disabled = count === 0;
  const selEl = document.getElementById('file-status-selection');
  if (selEl) selEl.textContent = count > 0 ? `已选择 ${count} 项` : '';
}

function updateFileStatus(items) {
  const el = document.getElementById('file-status-info');
  if (!el) return;
  if (items) {
    const dirs = items.filter(i => i.isDirectory).length;
    const files = items.filter(i => !i.isDirectory).length;
    const total = items.length;
    el.textContent = `${dirs} 个文件夹, ${files} 个文件${fileSearchQuery ? ` (筛选自 ${fileItems.length} 项)` : ''}`;
  }
}

function updateBreadcrumb() {
  const el = document.getElementById('file-breadcrumb');
  if (!el) return;
  const parts = fileCurrentPath.replace(/\\/g, '/').replace(/\/$/, '').split('/').filter(Boolean);
  let html = '';
  if (fileCurrentPath === '/') { html = `<span class="bc-item bc-root" onclick="fileLoadList('/')"><i class="fas fa-home"></i></span>`; }
  else {
    html = `<span class="bc-item bc-root" onclick="fileLoadList('/')"><i class="fas fa-home"></i></span><span class="bc-sep">/</span>`;
    let acc = '';
    parts.forEach((p, i) => {
      acc += '/' + p;
      const isLast = i === parts.length - 1;
      html += `<span class="bc-item${isLast ? ' active' : ''}" onclick="${isLast ? '' : "fileLoadList('" + acc + "')"}">${escapeHtml(p)}</span>`;
      if (!isLast) html += '<span class="bc-sep">/</span>';
    });
  }
  el.innerHTML = html;
}

function fileNavigateToPath(val) { fileLoadList(val.trim()); }

async function fileNewFolder() {
  showPrompt('请输入文件夹名称', '', async name => {
    const sep = fileCurrentPath.includes('\\') ? '\\' : '/';
    const newPath = fileCurrentPath.replace(/\/$/, '').replace(/\\$/, '') + sep + name;
    showLoading(true);
    const result = await apiRequest('POST', '/files/mkdir', { path: newPath });
    showLoading(false);
    if (result && result.success) { fileRefresh(); showToast('创建成功'); }
    else showToast(result?.error || '创建失败', 'error');
  });
}

async function fileNewFile() {
  showPrompt('请输入文件名', '', async name => {
    const sep = fileCurrentPath.includes('\\') ? '\\' : '/';
    const newPath = fileCurrentPath.replace(/\/$/, '').replace(/\\$/, '') + sep + name;
    showLoading(true);
    const result = await apiRequest('POST', '/files/mkfile', { path: newPath });
    showLoading(false);
    if (result && result.success) { fileRefresh(); showToast('创建成功'); }
    else showToast(result?.error || '创建失败', 'error');
  });
}

function fileUpload() { document.getElementById('file-upload-input').click(); }

async function fileHandleUpload(files) {
  if (!files.length) return;
  showUploadProgress(0, `上传 ${files.length} 个文件...`);
  const formData = new FormData();
  for (const file of files) formData.append('files', file);
  formData.append('path', fileCurrentPath);
  let lastProgress = 0;
  const simulateProgress = setInterval(() => { if (lastProgress < 90) { lastProgress += Math.random() * 10; showUploadProgress(Math.min(lastProgress, 90)); } }, 300);
  showLoading(true);
  const result = await apiRequest('POST', '/files/upload', formData);
  clearInterval(simulateProgress);
  showLoading(false);
  hideUploadProgress();
  if (result && result.success) { fileRefresh(); showToast(`上传完成 (${result.files.length}个文件)`); }
  else showToast(result?.error || '上传失败', 'error');
}

function showUploadProgress(pct, text) {
  const bar = document.getElementById('file-progress-bar');
  const fill = document.getElementById('file-progress-fill');
  const txt = document.getElementById('file-progress-text');
  if (bar) bar.style.display = 'flex';
  if (fill) fill.style.width = pct + '%';
  if (txt) txt.textContent = text || Math.round(pct) + '%';
}

function hideUploadProgress() {
  const bar = document.getElementById('file-progress-bar');
  if (bar) setTimeout(() => bar.style.display = 'none', 800);
}

async function fileDeleteSelected() {
  if (fileSelectedItems.size === 0) return;
  showConfirm(`确定删除 ${fileSelectedItems.size} 个项目？此操作不可恢复。`, async () => {
    showLoading(true);
    let success = 0, fail = 0;
    for (const p of fileSelectedItems) {
      const r = await apiRequest('POST', '/files/delete', { path: p });
      if (r && r.success) success++; else fail++;
    }
    showLoading(false);
    fileSelectedItems.clear();
    fileRefresh();
    showToast(fail === 0 ? `已删除 ${success} 项` : `删除完成: ${success} 成功, ${fail} 失败`, fail > 0 ? 'error' : 'success');
  });
}

async function fileCompressSelected() {
  if (fileSelectedItems.size === 0) return;
  const defaultName = fileSelectedItems.size === 1 ? fileSelectedItems.values().next().value.split('/').pop().split('\\').pop() + '.zip' : 'archive.zip';
  showPrompt('压缩文件名', defaultName, async name => {
    showLoading(true);
    const result = await apiRequest('POST', '/files/compress', { paths: Array.from(fileSelectedItems), dest: fileCurrentPath, name });
    showLoading(false);
    if (result && result.success) { fileRefresh(); showToast('压缩成功'); }
    else showToast(result?.error || '压缩失败', 'error');
  });
}

async function fileDuplicateSelected() {
  if (fileSelectedItems.size === 0) return;
  showLoading(true);
  for (const p of fileSelectedItems) {
    await apiRequest('POST', '/files/duplicate', { path: p });
  }
  showLoading(false);
  fileRefresh(); showToast('已复制');
}

async function fileSearch(query) {
  if (!query) return;
  const data = await apiRequest('GET', `/files/search?q=${encodeURIComponent(query)}&dir=${encodeURIComponent(fileCurrentPath)}`);
  if (data) {
    const grid = document.getElementById('file-grid');
    if (data.items.length === 0) { grid.innerHTML = '<div class="file-empty"><i class="fas fa-search"></i><p>未找到匹配的文件</p></div>'; }
    else {
      grid.innerHTML = data.items.map((item, i) => `<div class="file-item ${item.isDirectory ? 'directory' : 'file'}" onclick="fileToggleSelect(this, '${escapeHtml(item.path)}', ${i})" ondblclick="fileDoubleClick('${escapeHtml(item.path)}', ${item.isDirectory})" oncontextmenu="fileContextMenu(event, '${escapeHtml(item.path)}', ${item.isDirectory})"><div class="file-icon">${item.isDirectory ? '<i class="fas fa-folder" style="color:#FFB300;font-size:38px"></i>' : getFileIcon(item.name)}</div><div class="file-name" title="${escapeHtml(item.path)}">${escapeHtml(item.name)}</div><div class="file-details"><span>${formatSize(item.size)}</span></div></div>`).join('');
    }
    updateFileStatus(data.items);
  }
}

async function fileDoSearch() {
  const q = document.getElementById('file-search-input')?.value.trim();
  if (!q) return;
  fileSearchQuery = q;
  if (q) { fileSearch(q); }
  else { fileRefresh(); }
}

function fileToggleSearch() {
  const area = document.getElementById('file-search-area');
  if (!area) return;
  area.style.display = area.style.display === 'none' ? 'flex' : 'none';
  if (area.style.display !== 'none') { document.getElementById('file-search-input')?.focus(); }
  else { fileSearchQuery = ''; fileRefresh(); }
}

function fileToggleView() {
  fileViewMode = fileViewMode === 'grid' ? 'list' : 'grid';
  localStorage.setItem('fileViewMode', fileViewMode);
  const btn = document.getElementById('file-view-btn');
  if (btn) btn.innerHTML = `<i class="fas fa-${fileViewMode === 'grid' ? 'list' : 'th'}"></i>`;
  renderFileItems();
}

function fileSetSort(field, dir) {
  if (dir) { fileSortDir = dir; }
  else {
    if (field === fileSortField) fileSortDir = fileSortDir === 'asc' ? 'desc' : 'asc';
    else { fileSortField = field; fileSortDir = 'asc'; }
  }
  localStorage.setItem('fileSortField', fileSortField);
  localStorage.setItem('fileSortDir', fileSortDir);
  const sel = document.getElementById('file-sort-field');
  if (sel) sel.value = fileSortField;
  const dirBtn = document.getElementById('file-sort-dir-btn');
  if (dirBtn) dirBtn.innerHTML = `<i class="fas fa-arrow-${fileSortDir === 'asc' ? 'up' : 'down'}"></i>`;
  renderFileItems();
}

function fileToggleSortDir() {
  fileSortDir = fileSortDir === 'asc' ? 'desc' : 'asc';
  localStorage.setItem('fileSortDir', fileSortDir);
  renderFileItems();
}

function fileSetFilter(val) {
  fileFilter = val;
  renderFileItems();
}

function fileToggleFilter() {
  const area = document.getElementById('file-sort-area');
  if (area) area.style.display = area.style.display === 'none' ? 'flex' : 'none';
}

function fileShowMobileActions() {
  showBottomSheet('文件操作', [
    { id:'folder', label:'新建文件夹', icon:'folder-plus', action: fileNewFolder },
    { id:'file', label:'新建文件', icon:'file-plus', action: fileNewFile },
    { id:'upload', label:'上传文件', icon:'upload', action: fileUpload },
    { id:'divider' },
    { id:'download', label:'下载选中', icon:'download', action: fileDownloadSelected, disabled: fileSelectedItems.size === 0 },
    { id:'delete', label:'删除选中', icon:'trash', action: fileDeleteSelected, danger: true, disabled: fileSelectedItems.size === 0 },
    { id:'compress', label:'压缩选中', icon:'file-archive', action: fileCompressSelected, disabled: fileSelectedItems.size === 0 },
  ]);
}

function fileContextMenu(e, path, isDir) {
  e.preventDefault();
  e.stopPropagation();
  if (_fileCtxOpen) return;
  _fileCtxOpen = 1;
  _fileLongPress = 1;
  setTimeout(() => { _fileLongPress = 0; }, 800);
  const items = [
    { id:'open', label: isDir ? '打开' : '查看', icon: isDir ? 'folder-open' : 'eye', action: () => fileDoubleClick(path, isDir) },
    { id:'preview', label: '预览', icon: 'eye', action: () => fileQuickPreview(path), disabled: isDir },
    { id:'divider' },
    { id:'download', label: '下载', icon: 'download', action: () => window.open(`${API}/files/download?path=${encodeURIComponent(path)}`, '_blank'), disabled: isDir },
    { id:'rename', label: '重命名', icon: 'edit', action: () => fileRename(path) },
    { id:'duplicate', label: '复制到此', icon: 'copy', action: () => fileDuplicateSingle(path) },
    { id:'copy-path', label: '复制路径', icon: 'link', action: () => { copyToClipboard(path); showToast('路径已复制'); } },
    { id:'divider' },
    { id:'copy', label: '复制', icon: 'copy', action: () => { fileCopyItem(path); } },
    { id:'cut', label: '剪切', icon: 'cut', action: () => { fileCutItem(path); } },
    { id:'paste', label: '粘贴', icon: 'paste', action: () => filePaste(), disabled: !fileClipboard },
    { id:'divider' },
    { id:'compress', label: '压缩', icon: 'file-archive', action: () => fileCompressSingle(path), disabled: isDir },
    { id:'divider' },
    { id:'delete', label: '删除', icon: 'trash', danger: true, action: () => fileDelete(path) },
    { id:'info', label: '属性', icon: 'info-circle', action: () => fileInfo(path) },
    { id:'bookmark', label: fileBookmarks.includes(path) ? '取消书签' : '添加书签', icon: 'bookmark', action: () => fileToggleBookmark(path) }
  ];
  if (window.innerWidth <= 768) {
    showBottomSheet(isDir ? '文件夹操作' : '文件操作', items);
  } else {
    openContextMenu(e, items);
  }
  setTimeout(() => {
    const clr = () => { _fileCtxOpen = 0; document.removeEventListener('pointerdown', clr); document.removeEventListener('touchstart', clr); };
    document.addEventListener('pointerdown', clr, { once: true });
    document.addEventListener('touchstart', clr, { once: true });
  }, 0);
}

async function fileQuickPreview(path) {
  const ext = path.split('.').pop().toLowerCase();
  const imgExts = ['jpg','jpeg','png','gif','bmp','svg','webp'];
  const vidExts = ['mp4','webm','avi','mkv','mov'];
  const audExts = ['mp3','wav','flac','ogg','aac'];
  if (imgExts.includes(ext)) { filePreviewImage(path); return; }
  if (vidExts.includes(ext)) { filePreviewVideo(path); return; }
  if (audExts.includes(ext)) { filePreviewAudio(path); return; }
  const data = await apiRequest('GET', `/files/read?path=${encodeURIComponent(path)}`);
  if (data && data.type === 'text') {
    const lineCount = (data.content || '').split('\n').length;
    const previewContent = data.content.split('\n').slice(0, 50).join('\n');
    const truncated = lineCount > 50 ? `\n\n... (共 ${lineCount} 行，已截断)` : '';
    createModal('预览: ' + path.split('/').pop().split('\\').pop(), `<pre class="file-quick-preview">${escapeHtml(previewContent + truncated)}</pre>`, `<button class="btn btn-sm" onclick="showFileEditor('${escapeHtml(path)}', ${JSON.stringify(escapeHtml(data.content))}, '${escapeHtml(data.name)}')"><i class="fas fa-edit"></i> 编辑</button><button class="btn btn-sm btn-ghost" onclick="this.closest('.modal-overlay').remove()">关闭</button>`);
  }
}

async function fileRename(path) {
  const oldName = path.split(/[/\\]/).pop();
  showPrompt('请输入新名称', oldName, async newName => {
    if (newName === oldName) return;
    showLoading(true);
    const result = await apiRequest('POST', '/files/rename', { path, newName });
    showLoading(false);
    if (result && result.success) { fileRefresh(); showToast('重命名成功'); }
    else showToast(result?.error || '重命名失败', 'error');
  });
}

function fileCopyItem(path) { fileClipboard = { action: 'copy', path }; showToast('已复制: ' + path.split(/[/\\]/).pop()); }
function fileCutItem(path) { fileClipboard = { action: 'cut', path }; showToast('已剪切: ' + path.split(/[/\\]/).pop()); }

async function filePaste() {
  if (!fileClipboard) return;
  const name = fileClipboard.path.split(/[/\\]/).pop();
  const sep = fileCurrentPath.includes('\\') ? '\\' : '/';
  const dest = fileCurrentPath.replace(/\/$/, '').replace(/\\$/, '') + sep + name;
  showLoading(true);
  let result;
  if (fileClipboard.action === 'copy') result = await apiRequest('POST', '/files/copy', { source: fileClipboard.path, dest });
  else result = await apiRequest('POST', '/files/move', { source: fileClipboard.path, dest });
  showLoading(false);
  fileClipboard = null;
  fileRefresh();
  if (result && result.success) showToast('粘贴完成');
  else showToast(result?.error || '粘贴失败', 'error');
}

async function fileDuplicateSingle(path) {
  showLoading(true);
  const result = await apiRequest('POST', '/files/duplicate', { path });
  showLoading(false);
  if (result && result.success) { fileRefresh(); showToast('已复制'); }
  else showToast(result?.error || '复制失败', 'error');
}

async function fileCompressSingle(path) {
  const name = path.split(/[/\\]/).pop() + '.zip';
  showLoading(true);
  const result = await apiRequest('POST', '/files/compress', { paths: [path], dest: fileCurrentPath, name });
  showLoading(false);
  if (result && result.success) { fileRefresh(); showToast('压缩成功'); }
  else showToast(result?.error || '压缩失败', 'error');
}

async function fileDelete(path) {
  const name = path.split(/[/\\]/).pop();
  showConfirm(`确定删除 ${name}？此操作不可恢复。`, async () => {
    showLoading(true);
    const result = await apiRequest('POST', '/files/delete', { path });
    showLoading(false);
    if (result && result.success) { fileRefresh(); showToast('已删除'); }
    else showToast(result?.error || '删除失败', 'error');
  });
}

async function fileInfo(path) {
  const data = await apiRequest('GET', `/files/info?path=${encodeURIComponent(path)}`);
  if (!data) return;
  const isLinux = navigator.platform.includes('Linux') || navigator.platform.includes('Mac');
  let chmodHtml = '';
  if (isLinux && !data.isDirectory) {
    chmodHtml = `<div class="info-row"><span>权限</span><span><input type="text" id="file-chmod-input" value="${data.permissions || '644'}" style="width:80px;padding:4px 8px;text-align:center;font-family:monospace" maxlength="4"></span><button class="btn btn-sm" onclick="fileChmod('${escapeHtml(path)}')">应用</button></div>`;
  }
  createModal('文件属性', `<div class="info-table"><div class="info-row"><span>名称</span><span>${escapeHtml(data.name)}</span></div><div class="info-row"><span>路径</span><span style="word-break:break-all">${escapeHtml(data.path)}</span></div><div class="info-row"><span>类型</span><span>${data.isDirectory ? '文件夹' : '文件'}</span></div><div class="info-row"><span>大小</span><span>${formatSize(data.size)}</span></div><div class="info-row"><span>修改时间</span><span>${formatDate(data.modified)}</span></div><div class="info-row"><span>创建时间</span><span>${formatDate(data.created)}</span></div>${chmodHtml}</div>`, `<button class="btn btn-sm" onclick="copyToClipboard('${escapeHtml(data.path)}');showToast('路径已复制')"><i class="fas fa-link"></i> 复制路径</button><button class="btn btn-sm btn-ghost" onclick="this.closest('.modal-overlay').remove()">关闭</button>`);
}

async function fileChmod(path) {
  const val = document.getElementById('file-chmod-input')?.value;
  if (!val) return;
  showLoading(true);
  const result = await apiRequest('POST', '/files/chmod', { path, mode: val });
  showLoading(false);
  if (result && result.success) showToast('权限已更改');
  else showToast(result?.error || '更改失败', 'error');
}

function fileToggleBookmark(path) {
  const idx = fileBookmarks.indexOf(path);
  if (idx >= 0) { fileBookmarks.splice(idx, 1); showToast('已取消书签'); }
  else { fileBookmarks.push(path); showToast('已添加书签'); }
  localStorage.setItem('fileBookmarks', JSON.stringify(fileBookmarks));
}

function copyToClipboard(text) {
  if (navigator.clipboard) { navigator.clipboard.writeText(text); }
  else { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
}
