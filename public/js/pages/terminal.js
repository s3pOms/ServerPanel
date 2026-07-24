let terminalWS = null;
let termBuffer = '';
let termResizeObserver = null;
let termDecoder = null;

function ansiToHtml(text) {
  if (!text) return '';

  // Strip all ANSI escape sequences that are NOT SGR color codes (end with 'm')
  // First, extract SGR sequences, then strip everything else
  let result = '';
  const sgrRegex = /\x1b\[[\d;]*m/g;
  const stripRegex = /\x1b\[[0-9;]*[A-Za-jl-z]/g;

  // Remove non-SGR ANSI sequences (cursor movement, erase, etc.)
  text = text.replace(stripRegex, '');

  // Now process SGR codes
  const fg = {
    '30': '#1C1B1F', '31': '#E53935', '32': '#43A047', '33': '#FDD835',
    '34': '#1E88E5', '35': '#8E24AA', '36': '#00ACC1', '37': '#E6E1E5',
    '90': '#7F7F7F', '91': '#FF5252', '92': '#69F0AE', '93': '#FFF176',
    '94': '#448AFF', '95': '#CE93D8', '96': '#4DD0E1', '97': '#FFFFFF',
  };
  const bg = {
    '40': '#1C1B1F', '41': '#E53935', '42': '#43A047', '43': '#FDD835',
    '44': '#1E88E5', '45': '#8E24AA', '46': '#00ACC1', '47': '#E6E1E5',
  };
  const parts = [];
  let lastEnd = 0;
  let match;
  while ((match = sgrRegex.exec(text)) !== null) {
    if (match.index > lastEnd) {
      parts.push(escapeHtml(text.slice(lastEnd, match.index)));
    }
    const codes = match[1].split(';');
    let style = '';
    let isReset = false;
    for (const c of codes) {
      const n = parseInt(c);
      if (n === 0) { isReset = true; style = ''; break; }
      if (n === 1) style += 'font-weight:bold;';
      else if (n === 3) style += 'font-style:italic;';
      else if (n === 4) style += 'text-decoration:underline;';
      else if (n >= 30 && n <= 37 && fg[''+n]) style += 'color:' + fg[''+n] + ';';
      else if (n >= 90 && n <= 97 && fg[''+n]) style += 'color:' + fg[''+n] + ';';
      else if (n >= 40 && n <= 47 && bg[''+n]) style += 'background:' + bg[''+n] + ';';
    }
    if (isReset) {
      parts.push('</span>');
    } else if (style) {
      parts.push('<span style="' + style + '">');
    }
    lastEnd = match.index + match[0].length;
  }
  if (lastEnd < text.length) {
    parts.push(escapeHtml(text.slice(lastEnd)));
  }
  result = parts.join('');
  const openCount = (result.match(/<span /g) || []).length;
  const closeCount = (result.match(/<\/span>/g) || []).length;
  if (openCount > closeCount) {
    result += '</span>'.repeat(openCount - closeCount);
  }
  return result;
}

function resizeTerminal() {
  const container = document.querySelector('.terminal-container');
  const output = document.getElementById('term-output');
  if (!container || !output) return;
  const pageContent = document.getElementById('page-content');
  const pageHeader = document.querySelector('.page-header');
  const toolbar = document.querySelector('.terminal-toolbar');
  const status = document.querySelector('.term-status');
  const inputBar = document.querySelector('.term-input-bar');
  const headerH = pageHeader ? pageHeader.offsetHeight : 0;
  const toolbarH = toolbar ? toolbar.offsetHeight : 0;
  const statusH = status ? status.offsetHeight : 0;
  const inputH = (inputBar && inputBar.style.display !== 'none') ? inputBar.offsetHeight : 0;
  const padding = 28;
  const appBarH = window.getComputedStyle(document.querySelector('.app-bar')).display !== 'none' ? 57 : 0;
  const navH = window.getComputedStyle(document.querySelector('.bottom-nav')).display !== 'none' ? 65 : 0;
  const h = window.innerHeight - headerH - toolbarH - statusH - inputH - padding - appBarH - navH;
  container.style.height = Math.max(200, h) + 'px';
  container.style.overflow = 'visible';
  output.style.maxHeight = 'none';
}

function setupTerminalResize() {
  if (termResizeObserver) termResizeObserver.disconnect();
  termResizeObserver = new ResizeObserver(() => resizeTerminal());
  termResizeObserver.observe(document.getElementById('page-content'));
  window.addEventListener('resize', resizeTerminal);
}

function termScrollBottom() {
  const output = document.getElementById('term-output');
  if (output) requestAnimationFrame(() => { output.scrollTop = output.scrollHeight; });
}

function termDecodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return termDecoder.decode(bytes, { stream: true });
}

function createTermDecoder(charset) {
  try {
    return new TextDecoder(charset, { fatal: false });
  } catch {
    showToast(`浏览器不支持 ${charset}，已使用 UTF-8`, 'info');
    return new TextDecoder('utf-8', { fatal: false });
  }
}

async function renderTerminal(el) {
  el.innerHTML = `
    <div class="terminal-container">
      <div class="terminal-toolbar">
        <div class="form-row">
          <div class="form-group sm"><label>主机</label><input type="text" id="term-host" value="127.0.0.1" class="form-control" placeholder="127.0.0.1"></div>
          <div class="form-group sm"><label>端口</label><input type="number" id="term-port" value="22" class="form-control" placeholder="22"></div>
          <div class="form-group sm"><label>用户</label><input type="text" id="term-user" value="root" class="form-control" placeholder="root"></div>
          <div class="form-group sm"><label>密码</label><input type="password" id="term-pass" class="form-control" placeholder="密码"></div>
          <div class="form-group sm"><label>字符集</label><select id="term-charset" class="form-control"><option value="utf-8">UTF-8</option><option value="gb18030">GBK / GB18030</option><option value="big5">Big5</option><option value="shift-jis">Shift_JIS</option></select></div>
          <div class="form-group sm" style="align-self:flex-end">
            <button class="btn btn-primary btn-sm" onclick="termConnect()" id="term-connect-btn"><i class="fas fa-plug"></i> 连接</button>
            <button class="btn btn-danger btn-sm" onclick="termDisconnect()" id="term-disconnect-btn" style="display:none"><i class="fas fa-power-off"></i> 断开</button>
          </div>
        </div>
      </div>
      <div id="term-status" class="term-status"><span class="status-dot yellow"></span> 未连接</div>
      <div class="term-output" id="term-output">
        <div class="term-welcome">
          <i class="fas fa-terminal"></i>
          <h3>SSH 终端</h3>
          <p>输入服务器信息并点击连接</p>
        </div>
      </div>
      <div class="term-input-bar" id="term-input-bar" style="display:none">
        <span class="term-prompt" id="term-prompt">$</span>
        <input type="text" id="term-input" class="term-input" autofocus onkeydown="termHandleKey(event)" placeholder="输入命令...">
        <button class="btn btn-icon btn-sm" onclick="termClear()" id="term-clear-btn" title="清屏" style="display:none;color:#888;flex-shrink:0"><i class="fas fa-eraser"></i></button>
      </div>
    </div>`;
  resizeTerminal();
  setupTerminalResize();
}

async function termConnect() {
  const host = document.getElementById('term-host').value.trim();
  const port = parseInt(document.getElementById('term-port').value) || 22;
  const username = document.getElementById('term-user').value.trim();
  const password = document.getElementById('term-pass').value;
  const charset = document.getElementById('term-charset').value;
  if (!host || !username) { showToast('请输入主机和用户名', 'error'); return; }
  if (!password) { showToast('请输入密码', 'error'); return; }

  const outputEl = document.getElementById('term-output');
  const inputBar = document.getElementById('term-input-bar');
  const statusEl = document.getElementById('term-status');
  const connectBtn = document.getElementById('term-connect-btn');
  const disconnectBtn = document.getElementById('term-disconnect-btn');
  const clearBtn = document.getElementById('term-clear-btn');

  outputEl.innerHTML = '<div class="term-line"><span class="term-info">正在连接 ' + host + ':' + port + ' ...</span></div>';
  statusEl.innerHTML = '<span class="status-dot yellow"></span> 连接中...';
  termBuffer = '';
  termDecoder = createTermDecoder(charset);

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = protocol + '//' + window.location.host + '/api/terminal/ws';

  try {
    terminalWS = new WebSocket(wsUrl);
    terminalWS.onopen = () => {
      terminalWS.send(JSON.stringify({ type: 'connect', host, port, username, password, charset, cols: 80, rows: 32 }));
    };
    terminalWS.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      switch (msg.type) {
        case 'connected':
          statusEl.innerHTML = '<span class="status-dot green"></span> ' + username + '@' + host + ':' + port;
          connectBtn.style.display = 'none';
          disconnectBtn.style.display = 'inline-flex';
          inputBar.style.display = 'flex';
          clearBtn.style.display = 'inline-flex';
          outputEl.innerHTML += '<div class="term-line"><span class="term-success">连接成功</span></div>';
          document.getElementById('term-input').focus();
          resizeTerminal();
          break;
        case 'data':
          termBuffer += msg.encoding === 'base64' ? termDecodeBase64(msg.data) : msg.data;
          if (termBuffer.includes('\n') || termBuffer.includes('\r')) {
            const lines = termBuffer.split(/\r?\n/);
            for (let i = 0; i < lines.length - 1; i++) {
              const line = lines[i].replace(/\r/g, '');
              if (line) outputEl.innerHTML += '<div class="term-line">' + ansiToHtml(line) + '</div>';
              else outputEl.innerHTML += '<div class="term-line"><br></div>';
            }
            termBuffer = lines[lines.length - 1];
          } else if (termBuffer.includes('\x1b')) {
            outputEl.innerHTML += '<div class="term-line">' + ansiToHtml(termBuffer) + '</div>';
            termBuffer = '';
          }
          termScrollBottom();
          break;
        case 'error':
          outputEl.innerHTML += '<div class="term-line"><span class="term-error">' + escapeHtml(msg.message) + '</span></div>';
          statusEl.innerHTML = '<span class="status-dot red"></span> 连接失败';
          termScrollBottom();
          break;
        case 'closed':
          if (termDecoder) termBuffer += termDecoder.decode();
          if (termBuffer) { outputEl.innerHTML += '<div class="term-line">' + ansiToHtml(termBuffer) + '</div>'; termBuffer = ''; }
          statusEl.innerHTML = '<span class="status-dot red"></span> 连接已关闭';
          connectBtn.style.display = 'inline-flex';
          disconnectBtn.style.display = 'none';
          inputBar.style.display = 'none';
          clearBtn.style.display = 'none';
          resizeTerminal();
          break;
      }
    };
    terminalWS.onerror = () => {
      outputEl.innerHTML += '<div class="term-line"><span class="term-error">WebSocket 连接失败</span></div>';
      statusEl.innerHTML = '<span class="status-dot red"></span> 连接失败';
      termScrollBottom();
    };
    terminalWS.onclose = () => {
      if (termDecoder) termBuffer += termDecoder.decode();
      if (termBuffer) { outputEl.innerHTML += '<div class="term-line">' + ansiToHtml(termBuffer) + '</div>'; termBuffer = ''; }
      connectBtn.style.display = 'inline-flex';
      disconnectBtn.style.display = 'none';
      inputBar.style.display = 'none';
      clearBtn.style.display = 'none';
      if (statusEl.innerHTML.includes('连接中')) statusEl.innerHTML = '<span class="status-dot red"></span> 连接失败';
      resizeTerminal();
    };
  } catch (e) {
    outputEl.innerHTML += '<div class="term-line"><span class="term-error">' + escapeHtml(e.message) + '</span></div>';
    termScrollBottom();
  }
}

function termDisconnect() {
  if (terminalWS) { terminalWS.send(JSON.stringify({ type: 'disconnect' })); terminalWS.close(); terminalWS = null; }
  document.getElementById('term-connect-btn').style.display = 'inline-flex';
  document.getElementById('term-disconnect-btn').style.display = 'none';
  document.getElementById('term-input-bar').style.display = 'none';
  document.getElementById('term-clear-btn').style.display = 'none';
  document.getElementById('term-status').innerHTML = '<span class="status-dot red"></span> 已断开';
  resizeTerminal();
}

function termHandleKey(e) {
  if (e.key === 'Enter') {
    const input = document.getElementById('term-input');
    const cmd = input.value;
    if (terminalWS && terminalWS.readyState === WebSocket.OPEN) {
      terminalWS.send(JSON.stringify({ type: 'data', data: cmd + '\n', encoding: document.getElementById('term-charset').value }));
    }
    input.value = '';
  }
}

function termClear() {
  document.getElementById('term-output').innerHTML = '<div class="term-line"><span class="term-info">终端已清屏</span></div>';
  termBuffer = '';
}
