(() => {
  const STORAGE_KEY = 'dagachi_lab_v1';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
  const CATEGORIES = ['회의 참여', '작업 진행', '산출물 업로드', '기타'];

  const app = document.getElementById('app');
  let toastEl = null;
  let toastTimer = null;

  /* ---------- persistence ---------- */
  function defaultState() {
    return { codeIndex: {}, rooms: {}, session: null };
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return Object.assign(defaultState(), parsed);
    } catch (e) {
      return defaultState();
    }
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  let state = loadState();
  let ui = { screen: 'entry', pendingRoomId: null, error: null };

  /* ---------- helpers ---------- */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function nowISO() { return new Date().toISOString(); }
  function randomId(prefix) {
    return prefix + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
  }
  function randomCode(len) {
    len = len || 6;
    let code;
    do {
      code = '';
      for (let i = 0; i < len; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    } while (state.codeIndex[code]);
    return code;
  }
  function timeAgo(iso) {
    const diffMs = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return '방금 전';
    if (min < 60) return min + '분 전';
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + '시간 전';
    const day = Math.floor(hr / 24);
    return day + '일 전';
  }
  function currentRoom() {
    if (!state.session) return null;
    return state.rooms[state.session.roomId] || null;
  }
  function currentMember() {
    const room = currentRoom();
    if (!room || !state.session || !state.session.memberId) return null;
    return room.members.find(m => m.id === state.session.memberId) || null;
  }
  function averageScore(room, memberId) {
    const scores = room.evaluations.filter(e => e.toId === memberId).map(e => e.score);
    if (!scores.length) return null;
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  }
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 1800);
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => toast('복사했어요'),
        () => toast('복사에 실패했어요. 직접 선택해 복사해주세요')
      );
    } else {
      toast('이 브라우저에서는 자동 복사를 지원하지 않아요');
    }
  }

  /* ---------- sample room seed ---------- */
  const SAMPLE_ROOM_ID = 'sample-room';
  function hoursAgoISO(h) { return new Date(Date.now() - h * 3600 * 1000).toISOString(); }
  function ensureSampleRoom() {
    if (state.rooms[SAMPLE_ROOM_ID]) return;
    const m1 = 'sample-m1', m2 = 'sample-m2', m3 = 'sample-m3';
    const memberCode = 'DEMO-01';
    const profCode = 'DEMO-PF';
    state.rooms[SAMPLE_ROOM_ID] = {
      id: SAMPLE_ROOM_ID,
      name: '캡스톤디자인 3팀 (샘플)',
      leaderName: '김도현',
      createdAt: hoursAgoISO(96),
      memberCode, profCode,
      members: [
        { id: m1, name: '김도현', role: '기획 · PM', deadline: '2026-09-20', joinedAt: hoursAgoISO(96), isLeader: true },
        { id: m2, name: '이서연', role: '디자인', deadline: '2026-09-18', joinedAt: hoursAgoISO(90) },
        { id: m3, name: '박준우', role: '개발', deadline: '2026-09-22', joinedAt: hoursAgoISO(88) },
      ],
      activities: [
        { id: randomId('act'), memberId: m1, memberName: '김도현', category: '회의 참여', content: '킥오프 회의 진행, 역할 분담 정리', createdAt: hoursAgoISO(90) },
        { id: randomId('act'), memberId: m2, memberName: '이서연', category: '산출물 업로드', content: '와이어프레임 초안 업로드', createdAt: hoursAgoISO(60) },
        { id: randomId('act'), memberId: m3, memberName: '박준우', category: '작업 진행', content: 'DB 스키마 설계 완료, PR 올림', createdAt: hoursAgoISO(40) },
        { id: randomId('act'), memberId: m1, memberName: '김도현', category: '회의 참여', content: '중간 점검 회의, 일정 재조정', createdAt: hoursAgoISO(20) },
        { id: randomId('act'), memberId: m2, memberName: '이서연', category: '작업 진행', content: '피드백 반영해 시안 2차 수정', createdAt: hoursAgoISO(5) },
      ],
      evaluations: [
        { id: randomId('ev'), fromId: m1, fromName: '김도현', toId: m2, toName: '이서연', score: 5, comment: '항상 기한보다 먼저 공유해줘서 좋았어요.', updatedAt: hoursAgoISO(50) },
        { id: randomId('ev'), fromId: m1, fromName: '김도현', toId: m3, toName: '박준우', score: 4, comment: '', updatedAt: hoursAgoISO(50) },
        { id: randomId('ev'), fromId: m2, fromName: '이서연', toId: m1, toName: '김도현', score: 5, comment: '진행 상황 공유가 명확해요.', updatedAt: hoursAgoISO(30) },
        { id: randomId('ev'), fromId: m2, fromName: '이서연', toId: m3, toName: '박준우', score: 4, comment: '', updatedAt: hoursAgoISO(30) },
      ],
    };
    state.codeIndex[memberCode] = { roomId: SAMPLE_ROOM_ID, kind: 'member' };
    state.codeIndex[profCode] = { roomId: SAMPLE_ROOM_ID, kind: 'professor' };
    saveState();
  }

  /* ---------- actions ---------- */
  function createRoom(name, leaderName, leaderRole, leaderDeadline) {
    const roomId = randomId('room');
    const memberCode = randomCode();
    const profCode = randomCode();
    const leaderId = randomId('mem');
    state.rooms[roomId] = {
      id: roomId, name, leaderName, createdAt: nowISO(), memberCode, profCode,
      members: [{ id: leaderId, name: leaderName, role: leaderRole, deadline: leaderDeadline, joinedAt: nowISO(), isLeader: true }],
      activities: [], evaluations: [],
    };
    state.codeIndex[memberCode] = { roomId, kind: 'member' };
    state.codeIndex[profCode] = { roomId, kind: 'professor' };
    state.session = { roomId, memberId: leaderId, role: 'leader', name: leaderName };
    ui = { screen: 'room' };
    saveState(); render();
  }
  function lookupCode(code) {
    const norm = code.trim().toUpperCase();
    const entry = state.codeIndex[norm];
    if (!entry) { ui.error = '유효하지 않은 코드예요. 코드를 다시 확인해주세요.'; render(); return; }
    ui.pendingRoomId = entry.roomId;
    ui.error = null;
    ui.screen = entry.kind === 'professor' ? 'join-professor' : 'join-member';
    render();
  }
  function joinAsMember(name, role, deadline) {
    const room = state.rooms[ui.pendingRoomId];
    if (!room) return;
    const memberId = randomId('mem');
    room.members.push({ id: memberId, name, role, deadline, joinedAt: nowISO() });
    state.session = { roomId: room.id, memberId, role: 'member', name };
    ui = { screen: 'room' };
    saveState(); render();
  }
  function joinAsProfessor(name) {
    const room = state.rooms[ui.pendingRoomId];
    if (!room) return;
    state.session = { roomId: room.id, memberId: null, role: 'professor', name };
    ui = { screen: 'room' };
    saveState(); render();
  }
  function enterSample() {
    ensureSampleRoom();
    const room = state.rooms[SAMPLE_ROOM_ID];
    const leader = room.members.find(m => m.isLeader);
    state.session = { roomId: SAMPLE_ROOM_ID, memberId: leader.id, role: 'leader', name: leader.name, isSample: true };
    ui = { screen: 'room' };
    saveState(); render();
  }
  function switchSampleRole(role) {
    const room = state.rooms[SAMPLE_ROOM_ID];
    if (role === 'professor') {
      state.session = { roomId: SAMPLE_ROOM_ID, memberId: null, role: 'professor', name: '교수님', isSample: true };
    } else {
      const member = role === 'leader' ? room.members.find(m => m.isLeader) : room.members.find(m => !m.isLeader);
      state.session = { roomId: SAMPLE_ROOM_ID, memberId: member.id, role: role === 'leader' ? 'leader' : 'member', name: member.name, isSample: true };
    }
    saveState(); render();
  }
  function leaveRoom() {
    state.session = null;
    ui = { screen: 'entry' };
    saveState(); render();
  }
  function addActivity(category, content) {
    const room = currentRoom(); const me = currentMember();
    if (!room || !me || !content.trim()) return;
    room.activities.unshift({ id: randomId('act'), memberId: me.id, memberName: me.name, category, content: content.trim(), createdAt: nowISO() });
    saveState(); render();
    toast('활동을 기록했어요');
  }
  function saveEvaluation(toId, score, comment) {
    const room = currentRoom(); const me = currentMember();
    if (!room || !me) return;
    let ev = room.evaluations.find(e => e.fromId === me.id && e.toId === toId);
    if (ev) { ev.score = score; ev.comment = comment; ev.updatedAt = nowISO(); }
    else { room.evaluations.push({ id: randomId('ev'), fromId: me.id, fromName: me.name, toId, toName: (room.members.find(m => m.id === toId) || {}).name || '', score, comment, updatedAt: nowISO() }); }
    saveState(); render();
    toast('평가를 저장했어요');
  }

  /* ---------- render: entry ---------- */
  function renderEntry() {
    app.innerHTML = `
      <div class="entry-grid">
        <button class="entry-card" data-action="show-create">
          <span class="entry-card-icon">1</span>
          <h3>팀장으로 팀방 만들기</h3>
          <p>팀방을 만들고 팀원용·교수님용 초대 코드를 발급받아요.</p>
        </button>
        <button class="entry-card" data-action="show-join">
          <span class="entry-card-icon">2</span>
          <h3>초대 코드로 참여하기</h3>
          <p>전달받은 코드를 입력해 팀원 또는 교수님으로 입장해요.</p>
        </button>
        <button class="entry-card" data-action="enter-sample">
          <span class="entry-card-icon">3</span>
          <h3>샘플 팀방 체험하기</h3>
          <p>이미 활동이 쌓인 팀방에 들어가 기능을 바로 눌러봐요.</p>
        </button>
      </div>
      ${ui.error ? `<p class="lab-error">${escapeHtml(ui.error)}</p>` : ''}
    `;
    app.querySelector('[data-action="show-create"]').addEventListener('click', () => { ui = { screen: 'create' }; render(); });
    app.querySelector('[data-action="show-join"]').addEventListener('click', () => { ui = { screen: 'join-code' }; render(); });
    app.querySelector('[data-action="enter-sample"]').addEventListener('click', enterSample);
  }

  /* ---------- render: create room ---------- */
  function renderCreate() {
    app.innerHTML = `
      <a href="#" class="lab-back" data-action="back">← 처음으로</a>
      <div class="lab-panel">
        <h2>팀방 만들기</h2>
        <p class="lab-panel-sub">팀장으로 팀방을 개설해요. 만든 뒤 팀원용/교수님용 코드가 각각 발급돼요.</p>
        <form class="lab-form" id="form-create">
          <div class="lab-row">
            <label for="room-name">팀방 이름</label>
            <input id="room-name" required placeholder="예: 캡스톤디자인 3팀">
          </div>
          <div class="lab-row">
            <label for="leader-name">내 이름</label>
            <input id="leader-name" required placeholder="이름을 입력해주세요">
          </div>
          <div class="lab-row">
            <label for="leader-role">내 역할</label>
            <input id="leader-role" required placeholder="예: 기획 · PM">
          </div>
          <div class="lab-row">
            <label for="leader-deadline">내 기한</label>
            <input id="leader-deadline" type="date">
          </div>
          <button type="submit" class="btn btn-primary btn-full">팀방 만들고 코드 발급받기</button>
        </form>
      </div>
    `;
    app.querySelector('[data-action="back"]').addEventListener('click', (e) => { e.preventDefault(); ui = { screen: 'entry' }; render(); });
    app.querySelector('#form-create').addEventListener('submit', (e) => {
      e.preventDefault();
      createRoom(
        app.querySelector('#room-name').value.trim(),
        app.querySelector('#leader-name').value.trim(),
        app.querySelector('#leader-role').value.trim(),
        app.querySelector('#leader-deadline').value
      );
    });
  }

  /* ---------- render: join by code ---------- */
  function renderJoinCode() {
    app.innerHTML = `
      <a href="#" class="lab-back" data-action="back">← 처음으로</a>
      <div class="lab-panel">
        <h2>초대 코드 입력</h2>
        <p class="lab-panel-sub">팀장에게 받은 코드를 입력하세요. 팀원용 코드와 교수님용 코드는 자동으로 구분돼요.</p>
        <form class="lab-form" id="form-code">
          <div class="lab-row">
            <label for="invite-code">초대 코드</label>
            <input id="invite-code" required placeholder="예: AB3D9F" style="text-transform:uppercase; letter-spacing:.08em;">
          </div>
          ${ui.error ? `<p class="lab-error">${escapeHtml(ui.error)}</p>` : ''}
          <button type="submit" class="btn btn-primary btn-full">입장하기</button>
        </form>
        <p class="lab-panel-sub" style="margin:16px 0 0;">코드가 없으신가요? 샘플 팀방 코드로 시도해보세요 — 팀원용 <strong>DEMO-01</strong>, 교수님용 <strong>DEMO-PF</strong> (먼저 샘플 팀방을 한 번 열어야 활성화돼요).</p>
      </div>
    `;
    app.querySelector('[data-action="back"]').addEventListener('click', (e) => { e.preventDefault(); ui = { screen: 'entry' }; render(); });
    app.querySelector('#form-code').addEventListener('submit', (e) => {
      e.preventDefault();
      lookupCode(app.querySelector('#invite-code').value);
    });
  }

  function renderJoinMember() {
    const room = state.rooms[ui.pendingRoomId];
    app.innerHTML = `
      <a href="#" class="lab-back" data-action="back">← 처음으로</a>
      <div class="lab-panel">
        <h2>${escapeHtml(room.name)} 팀원으로 참여</h2>
        <p class="lab-panel-sub">이름, 역할, 기한을 자유롭게 입력해주세요.</p>
        <form class="lab-form" id="form-join-member">
          <div class="lab-row"><label for="m-name">이름</label><input id="m-name" required placeholder="이름을 입력해주세요"></div>
          <div class="lab-row"><label for="m-role">역할</label><input id="m-role" required placeholder="예: 디자인, 개발, 자료조사 ..."></div>
          <div class="lab-row"><label for="m-deadline">기한</label><input id="m-deadline" type="date"></div>
          <button type="submit" class="btn btn-primary btn-full">팀방 입장하기</button>
        </form>
      </div>
    `;
    app.querySelector('[data-action="back"]').addEventListener('click', (e) => { e.preventDefault(); ui = { screen: 'entry' }; render(); });
    app.querySelector('#form-join-member').addEventListener('submit', (e) => {
      e.preventDefault();
      joinAsMember(
        app.querySelector('#m-name').value.trim(),
        app.querySelector('#m-role').value.trim(),
        app.querySelector('#m-deadline').value
      );
    });
  }

  function renderJoinProfessor() {
    const room = state.rooms[ui.pendingRoomId];
    app.innerHTML = `
      <a href="#" class="lab-back" data-action="back">← 처음으로</a>
      <div class="lab-panel">
        <h2>${escapeHtml(room.name)} 교수님으로 열람</h2>
        <p class="lab-panel-sub">성함을 입력하시면 팀 활동 기록과 상호평가 결과를 열람 전용으로 확인하실 수 있어요.</p>
        <form class="lab-form" id="form-join-prof">
          <div class="lab-row"><label for="p-name">성함</label><input id="p-name" required placeholder="예: 최민준 교수님"></div>
          <button type="submit" class="btn btn-primary btn-full">열람 화면 들어가기</button>
        </form>
      </div>
    `;
    app.querySelector('[data-action="back"]').addEventListener('click', (e) => { e.preventDefault(); ui = { screen: 'entry' }; render(); });
    app.querySelector('#form-join-prof').addEventListener('submit', (e) => {
      e.preventDefault();
      joinAsProfessor(app.querySelector('#p-name').value.trim());
    });
  }

  /* ---------- render: room dashboard ---------- */
  const ROLE_LABEL = { leader: '팀장', member: '팀원', professor: '교수님 (열람 전용)' };
  const ROLE_CLASS = { leader: 'role-leader', member: 'role-member', professor: 'role-professor' };

  function renderRoom() {
    const room = currentRoom();
    if (!room) { ui = { screen: 'entry' }; render(); return; }
    const session = state.session;
    const me = currentMember();
    const canEdit = session.role === 'leader' || session.role === 'member';

    const switcherHtml = session.isSample ? `
      <div class="switcher">
        <span>다른 시점으로 미리보기</span>
        <button data-switch="leader" class="${session.role === 'leader' ? 'is-active' : ''}">팀장</button>
        <button data-switch="member" class="${session.role === 'member' ? 'is-active' : ''}">팀원</button>
        <button data-switch="professor" class="${session.role === 'professor' ? 'is-active' : ''}">교수님</button>
      </div>` : '';

    const codesHtml = session.role === 'leader' ? `
      <div class="lab-panel">
        <h2>초대 코드</h2>
        <p class="lab-panel-sub">팀원과 교수님께 각각 다른 코드를 전달하세요.</p>
        <div class="code-grid">
          <div class="code-card code-card-member">
            <span class="code-card-label">팀원 초대 코드</span>
            <div class="code-card-value"><span>${escapeHtml(room.memberCode)}</span><button class="code-copy" data-copy="${escapeHtml(room.memberCode)}">복사</button></div>
            <p class="code-card-hint">이 코드로 들어오면 이름·역할·기한을 입력하고 팀원으로 참여해요.</p>
          </div>
          <div class="code-card code-card-professor">
            <span class="code-card-label">교수님 초대 코드</span>
            <div class="code-card-value"><span>${escapeHtml(room.profCode)}</span><button class="code-copy" data-copy="${escapeHtml(room.profCode)}">복사</button></div>
            <p class="code-card-hint">이 코드로 들어오면 열람 전용으로 활동 기록과 상호평가 결과를 확인해요.</p>
          </div>
        </div>
      </div>` : '';

    const rosterRows = room.members.map(m => {
      const isYou = me && m.id === me.id;
      const avg = averageScore(room, m.id);
      return `<tr>
        <td class="roster-name ${isYou ? 'roster-name-you' : ''}">${escapeHtml(m.name)}${m.isLeader ? ' · 팀장' : ''}${isYou ? ' (나)' : ''}</td>
        <td>${escapeHtml(m.role || '-')}</td>
        <td>${escapeHtml(m.deadline || '-')}</td>
        <td class="${avg === null ? 'roster-score roster-score-empty' : 'roster-score'}">${avg === null ? '평가 없음' : avg + ' / 5'}</td>
      </tr>`;
    }).join('');

    const activityFormHtml = canEdit ? `
      <form class="lab-form" id="form-activity" style="margin-bottom:24px;">
        <div class="lab-row">
          <label for="act-category">활동 유형</label>
          <select id="act-category">${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
        </div>
        <div class="lab-row">
          <label for="act-content">내용</label>
          <textarea id="act-content" rows="2" placeholder="무엇을 했는지 간단히 기록해주세요" required></textarea>
        </div>
        <button type="submit" class="btn btn-outline" style="align-self:flex-start;">활동 기록 남기기</button>
      </form>` : `<p class="readonly-note">교수님 계정은 열람 전용이라 활동을 직접 기록할 수 없어요.</p>`;

    const activityItems = room.activities.length ? room.activities.map(a => `
      <div class="activity-item">
        <div class="activity-top">
          <span class="activity-name">${escapeHtml(a.memberName)}</span>
          <span class="activity-tag">${escapeHtml(a.category)}</span>
          <span class="activity-time">${timeAgo(a.createdAt)}</span>
        </div>
        <p class="activity-content">${escapeHtml(a.content)}</p>
      </div>`).join('') : `<p class="lab-empty">아직 기록된 활동이 없어요.</p>`;

    let evalHtml;
    if (canEdit) {
      const teammates = room.members.filter(m => m.id !== me.id);
      evalHtml = teammates.length ? `<div class="eval-list">${teammates.map(t => {
        const mine = room.evaluations.find(e => e.fromId === me.id && e.toId === t.id);
        const score = mine ? mine.score : 0;
        const comment = mine ? mine.comment : '';
        const stars = [1, 2, 3, 4, 5].map(n => `<button type="button" class="star-btn ${n <= score ? 'is-filled' : ''}" data-star="${n}" data-target="${t.id}">★</button>`).join('');
        return `<div class="eval-row" data-eval-row="${t.id}">
          <div class="eval-row-top"><span class="eval-target">${escapeHtml(t.name)}</span><div class="star-rating">${stars}</div></div>
          <textarea class="eval-comment" data-comment-for="${t.id}" placeholder="한 줄 코멘트 (선택)">${escapeHtml(comment)}</textarea>
          <button type="button" class="eval-save" data-save-for="${t.id}">저장</button>
        </div>`;
      }).join('')}</div>` : `<p class="lab-empty">아직 함께 평가할 팀원이 없어요.</p>`;
    } else {
      evalHtml = `<div class="table-scroll"><table class="roster-table"><thead><tr><th>팀원</th><th>평균 점수</th><th>평가 수</th></tr></thead><tbody>
        ${room.members.map(m => {
          const scores = room.evaluations.filter(e => e.toId === m.id);
          const avg = averageScore(room, m.id);
          return `<tr><td class="roster-name">${escapeHtml(m.name)}</td><td class="${avg === null ? 'roster-score roster-score-empty' : 'roster-score'}">${avg === null ? '평가 없음' : avg + ' / 5'}</td><td>${scores.length}건</td></tr>`;
        }).join('')}
      </tbody></table></div>`;
    }

    app.innerHTML = `
      ${switcherHtml}
      <div class="room-head">
        <div>
          <h2>${escapeHtml(room.name)}</h2>
          <div class="room-meta">
            <span class="role-badge ${ROLE_CLASS[session.role]}">${ROLE_LABEL[session.role]}</span>
            <span style="font-size:13px; color:var(--gray);">${escapeHtml(session.name)}님으로 접속 중</span>
          </div>
        </div>
        <button class="btn-leave" id="btn-leave">나가기</button>
      </div>

      ${codesHtml}

      <div class="lab-panel">
        <h2>팀원 현황</h2>
        <p class="lab-panel-sub">이름, 역할, 기한과 동료평가 평균 점수를 한눈에 확인해요.</p>
        <div class="table-scroll">
          <table class="roster-table">
            <thead><tr><th>이름</th><th>역할</th><th>기한</th><th>동료평가 평균</th></tr></thead>
            <tbody>${rosterRows}</tbody>
          </table>
        </div>
      </div>

      <div class="lab-panel">
        <h2>활동 기록</h2>
        <p class="lab-panel-sub">회의, 작업, 산출물 등 협업 과정을 자동으로 쌓아두는 화면이에요.</p>
        ${activityFormHtml}
        <div class="activity-list">${activityItems}</div>
      </div>

      <div class="lab-panel">
        <h2>상호평가</h2>
        <p class="lab-panel-sub">${canEdit ? '팀원별로 기여도를 평가해주세요. 점수는 팀 전체 평균으로 집계돼요.' : '팀 전체의 동료평가 결과를 열람 전용으로 확인해요.'}</p>
        ${evalHtml}
      </div>
    `;

    bindRoomEvents();
  }

  function bindRoomEvents() {
    const leave = document.getElementById('btn-leave');
    if (leave) leave.addEventListener('click', leaveRoom);

    document.querySelectorAll('[data-switch]').forEach(btn => {
      btn.addEventListener('click', () => switchSampleRole(btn.getAttribute('data-switch')));
    });
    document.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', () => copyText(btn.getAttribute('data-copy')));
    });

    const actForm = document.getElementById('form-activity');
    if (actForm) {
      actForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const category = document.getElementById('act-category').value;
        const content = document.getElementById('act-content').value;
        addActivity(category, content);
      });
    }

    document.querySelectorAll('[data-star]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const score = Number(btn.getAttribute('data-star'));
        const row = document.querySelector(`[data-eval-row="${targetId}"]`);
        row.querySelectorAll('.star-btn').forEach(s => {
          s.classList.toggle('is-filled', Number(s.getAttribute('data-star')) <= score);
        });
        row.dataset.pendingScore = score;
      });
    });
    document.querySelectorAll('[data-save-for]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-save-for');
        const row = document.querySelector(`[data-eval-row="${targetId}"]`);
        const filled = row.querySelectorAll('.star-btn.is-filled').length;
        const comment = row.querySelector('.eval-comment').value;
        if (!filled) { toast('별점을 먼저 선택해주세요'); return; }
        saveEvaluation(targetId, filled, comment);
      });
    });
  }

  /* ---------- router ---------- */
  function render() {
    if (state.session) { renderRoom(); return; }
    switch (ui.screen) {
      case 'create': renderCreate(); break;
      case 'join-code': renderJoinCode(); break;
      case 'join-member': renderJoinMember(); break;
      case 'join-professor': renderJoinProfessor(); break;
      default: renderEntry();
    }
  }

  render();
})();
