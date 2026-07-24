async function renderUsers(el) {
  if (currentUser.role !== 'admin') {
    el.innerHTML = '<div class="error-page"><i class="fas fa-lock"></i><p>需要管理员权限</p></div>';
    return;
  }
  el.innerHTML = `
    <div class="card">
      <div class="card-header"><i class="fas fa-users"></i> 用户管理 <button class="btn btn-sm btn-primary" style="margin-left:auto" onclick="userAdd()"><i class="fas fa-plus"></i> 添加用户</button></div>
      <div class="card-body">
        <div class="table-wrap">
          <table class="table" id="users-table">
            <thead><tr><th>ID</th><th>用户名</th><th>角色</th><th>创建时间</th><th>操作</th></tr></thead>
            <tbody id="users-tbody"><tr><td colspan="5"><div class="page-loading"><i class="fas fa-spinner fa-spin"></i></div></td></tr></tbody>
          </table>
        </div>
      </div>
    </div>`;
  await userLoadList();
}

async function userLoadList() {
  const data = await apiRequest('GET', '/auth/users');
  const tbody = document.getElementById('users-tbody');
  if (!data) return;
  tbody.innerHTML = data.map(u => `
    <tr>
      <td>${u.id}</td>
      <td><i class="fas fa-user" style="color:var(--md-primary);margin-right:6px"></i> ${escapeHtml(u.username)}</td>
      <td><span class="badge ${u.role === 'admin' ? 'badge-primary' : ''}">${u.role}</span></td>
      <td>${formatDate(u.createdAt)}</td>
      <td class="actions">
        ${u.id !== currentUser.id ? `<button class="btn btn-icon btn-sm btn-danger" onclick="userDelete(${u.id})" title="删除"><i class="fas fa-trash"></i></button>` : ''}
        <button class="btn btn-icon btn-sm" onclick="userChangePassword(${u.id}, '${escapeHtml(u.username)}')" title="修改密码"><i class="fas fa-key"></i></button>
      </td>
    </tr>
  `).join('');
}

function userAdd() {
  createModal('添加用户', `
    <div class="form-group"><label>用户名</label><input type="text" id="u-username" class="form-control"></div>
    <div class="form-group"><label>密码</label><input type="password" id="u-password" class="form-control"></div>
    <div class="form-group"><label>角色</label><select id="u-role" class="form-control">
      <option value="user">普通用户</option>
      <option value="admin">管理员</option>
    </select></div>
  `, `
    <button class="btn btn-primary" onclick="userDoAdd()"><i class="fas fa-plus"></i> 添加</button>
    <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">取消</button>
  `);
}

async function userDoAdd() {
  const username = document.getElementById('u-username').value.trim();
  const password = document.getElementById('u-password').value.trim();
  const role = document.getElementById('u-role').value;
  if (!username || !password) { showToast('请填写完整信息', 'error'); return; }
  showLoading(true);
  const result = await apiRequest('POST', '/auth/users', { username, password, role });
  showLoading(false);
  document.querySelector('.modal-overlay')?.remove();
  if (result && result.success) { userLoadList(); showToast('添加成功'); }
  else showToast(result?.error || '添加失败', 'error');
}

async function userDelete(id) {
  showConfirm('确定删除此用户？', async () => {
    showLoading(true);
    const result = await apiRequest('DELETE', `/auth/users/${id}`);
    showLoading(false);
    if (result && result.success) { userLoadList(); showToast('删除成功'); }
    else showToast(result?.error || '删除失败', 'error');
  });
}

function userChangePassword(id, username) {
  createModal(`修改 ${escapeHtml(username)} 的密码`, `
    <div class="form-group"><label>新密码</label><input type="password" id="up-password" class="form-control"></div>
  `, `
    <button class="btn btn-primary" onclick="userDoChangePassword(${id})"><i class="fas fa-save"></i> 保存</button>
    <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">取消</button>
  `);
}

async function userDoChangePassword(id) {
  const password = document.getElementById('up-password').value.trim();
  if (!password) { showToast('密码不能为空', 'error'); return; }
  showLoading(true);
  const result = await apiRequest('PUT', `/auth/users/${id}/password`, { password });
  showLoading(false);
  document.querySelector('.modal-overlay')?.remove();
  if (result && result.success) showToast('密码修改成功');
  else showToast(result?.error || '修改失败', 'error');
}
