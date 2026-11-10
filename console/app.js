// Acadza Faculty Review Console Logic
(function() {
  // State
  const data = window.ACADZA_DATA || { groups: [], unreportedBonus: [], stats: {} };
  let groups = [...data.groups];
  const bonusQuestions = [...(data.unreportedBonus || [])];
  
  let currentFilter = 'all';
  let currentSubject = 'all';
  let searchQuery = '';
  let sortBy = 'urgency';
  let focusedCardId = null;
  let activeEditQid = null;

  // Load audit trail from localStorage
  const AUDIT_STORAGE_KEY = 'acadza_faculty_audit_trail_v1';
  let auditTrail = [];
  try {
    auditTrail = JSON.parse(localStorage.getItem(AUDIT_STORAGE_KEY)) || [];
  } catch (e) {
    auditTrail = [];
  }

  // DOM Elements
  const cardsContainer = document.getElementById('cards-container');
  const emptyState = document.getElementById('empty-state');
  const searchInput = document.getElementById('search-input');
  const sortSelect = document.getElementById('sort-select');
  const filterBanner = document.getElementById('filter-banner');
  const filterMatchCount = document.getElementById('filter-match-count');
  const btnClearFilter = document.getElementById('btn-clear-filter');
  const auditBadge = document.getElementById('audit-badge');
  const drawerAudit = document.getElementById('drawer-audit');
  const auditList = document.getElementById('audit-list');
  const auditEmpty = document.getElementById('audit-empty');
  const modalEdit = document.getElementById('modal-edit');
  const modalShortcuts = document.getElementById('modal-shortcuts');
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-msg');
  const toastIcon = document.getElementById('toast-icon');

  // Stats Counters
  document.getElementById('stat-total-q').textContent = `${groups.length} Questions`;
  document.getElementById('stat-total-r').textContent = `${data.stats.totalReports || 44} Reports`;
  document.getElementById('stat-pending').textContent = `${data.stats.facultyReviewCount || 5} Require Approval`;
  document.getElementById('stat-auto').textContent = `${data.stats.autoApplyCount || 22} Auto-Applied`;

  document.getElementById('count-all').textContent = groups.length;
  document.getElementById('count-review').textContent = data.stats.facultyReviewCount || 5;
  document.getElementById('count-auto').textContent = data.stats.autoApplyCount || 22;
  document.getElementById('count-nochange').textContent = data.stats.noChangeCount || 12;
  document.getElementById('count-bonus').textContent = bonusQuestions.length;

  // Initialize
  updateAuditBadge();
  render();

  // Event Listeners: Tabs
  document.querySelectorAll('#route-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#route-tabs .tab-btn').forEach(b => {
        b.classList.remove('active', 'bg-brand-600', 'text-white', 'shadow-sm');
        b.classList.add('text-gray-600', 'dark:text-gray-400');
      });
      btn.classList.add('active', 'bg-brand-600', 'text-white', 'shadow-sm');
      btn.classList.remove('text-gray-600', 'dark:text-gray-400');
      currentFilter = btn.getAttribute('data-filter');
      render();
    });
  });

  // Event Listeners: Subjects
  document.querySelectorAll('.subject-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.subject-btn').forEach(b => {
        b.classList.remove('active', 'bg-gray-200', 'dark:bg-dark-700', 'text-gray-800', 'dark:text-gray-200');
        b.classList.add('text-gray-500', 'dark:text-gray-400');
      });
      btn.classList.add('active', 'bg-gray-200', 'dark:bg-dark-700', 'text-gray-800', 'dark:text-gray-200');
      btn.classList.remove('text-gray-500', 'dark:text-gray-400');
      currentSubject = btn.getAttribute('data-subject');
      render();
    });
  });

  // Search & Sort
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    render();
  });

  sortSelect.addEventListener('change', (e) => {
    sortBy = e.target.value;
    render();
  });

  btnClearFilter.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    currentFilter = 'all';
    currentSubject = 'all';
    document.querySelectorAll('#route-tabs .tab-btn')[0].click();
    document.querySelectorAll('.subject-btn')[0].click();
  });

  // Theme Toggle
  const themeToggle = document.getElementById('btn-theme-toggle');
  const themeIcon = document.getElementById('theme-icon');
  themeToggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    themeIcon.textContent = isDark ? '🌙' : '☀️';
  });

  // Audit Drawer
  document.getElementById('btn-audit-log').addEventListener('click', () => {
    drawerAudit.classList.remove('translate-x-full');
    renderAuditList();
  });
  document.getElementById('btn-close-drawer').addEventListener('click', () => {
    drawerAudit.classList.add('translate-x-full');
  });

  // Shortcuts Modal
  document.getElementById('btn-shortcuts').addEventListener('click', () => {
    modalShortcuts.classList.remove('hidden');
    modalShortcuts.classList.add('flex');
  });
  document.getElementById('btn-close-shortcuts').addEventListener('click', () => {
    modalShortcuts.classList.add('hidden');
    modalShortcuts.classList.remove('flex');
  });
  document.getElementById('btn-ack-shortcuts').addEventListener('click', () => {
    modalShortcuts.classList.add('hidden');
    modalShortcuts.classList.remove('flex');
  });

  // Modal Edit Actions
  document.getElementById('btn-close-modal').addEventListener('click', closeModalEdit);
  document.getElementById('btn-cancel-modal').addEventListener('click', closeModalEdit);
  document.getElementById('btn-save-modal').addEventListener('click', saveModalEdit);

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Ignore inside text inputs/modals
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      if (e.key === 'Escape') document.activeElement.blur();
      return;
    }

    if (e.key === '/') {
      e.preventDefault();
      searchInput.focus();
    } else if (e.key === 'j' || e.key === 'J') {
      navigateCard(1);
    } else if (e.key === 'k' || e.key === 'K') {
      navigateCard(-1);
    } else if (e.key === 'a' || e.key === 'A') {
      actOnFocused('approve');
    } else if (e.key === 'r' || e.key === 'R') {
      actOnFocused('reject');
    } else if (e.key === 'e' || e.key === 'E') {
      actOnFocused('edit');
    } else if (e.key === 'Escape') {
      modalEdit.classList.add('hidden');
      modalEdit.classList.remove('flex');
      modalShortcuts.classList.add('hidden');
      modalShortcuts.classList.remove('flex');
      drawerAudit.classList.add('translate-x-full');
    }
  });

  // Filtering & Sorting Logic
  function getFilteredItems() {
    if (currentFilter === 'bonus') {
      return bonusQuestions.filter(q => {
        if (currentSubject !== 'all' && q.subject !== currentSubject) return false;
        if (searchQuery) {
          const hay = `${q.questionId} ${q.subject} ${q.chapter} ${q.questionHtml} ${q.defectNote}`.toLowerCase();
          if (!hay.includes(searchQuery)) return false;
        }
        return true;
      });
    }

    let list = groups.filter(g => {
      // Route filter
      if (currentFilter === 'faculty_review' && g.primaryRoute !== 'faculty_review') return false;
      if (currentFilter === 'auto_apply' && g.primaryRoute !== 'auto_apply') return false;
      if (currentFilter === 'no_change' && g.primaryRoute !== 'no_change') return false;

      // Subject filter
      if (currentSubject !== 'all' && g.subject !== currentSubject) return false;

      // Search query
      if (searchQuery) {
        const comments = g.reports.map(r => `${r.comment} ${r.studentId} ${r.reportId}`).join(' ');
        const hay = `${g.questionId} ${g.subject} ${g.chapter} ${g.questionHtml} ${g.evidence} ${comments}`.toLowerCase();
        if (!hay.includes(searchQuery)) return false;
      }
      return true;
    });

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'urgency') {
        return b.urgencyScore - a.urgencyScore;
      } else if (sortBy === 'recent') {
        return new Date(b.latestReportedAt) - new Date(a.latestReportedAt);
      } else if (sortBy === 'reports') {
        return b.reportCount - a.reportCount;
      } else if (sortBy === 'confidence') {
        return a.confidence - b.confidence;
      } else if (sortBy === 'subject') {
        return a.subject.localeCompare(b.subject) || a.chapter.localeCompare(b.chapter);
      }
      return 0;
    });

    return list;
  }

  // Main Render Function
  function render() {
    const items = getFilteredItems();
    cardsContainer.innerHTML = '';

    // Filter Banner State
    const hasFilter = currentFilter !== 'all' || currentSubject !== 'all' || searchQuery !== '';
    if (hasFilter) {
      filterBanner.classList.remove('hidden');
      filterBanner.classList.add('flex');
      filterMatchCount.textContent = items.length;
    } else {
      filterBanner.classList.add('hidden');
      filterBanner.classList.remove('flex');
    }

    if (items.length === 0) {
      emptyState.classList.remove('hidden');
      emptyState.classList.add('flex');
      return;
    } else {
      emptyState.classList.add('hidden');
      emptyState.classList.remove('flex');
    }

    if (!focusedCardId && items.length > 0) {
      focusedCardId = items[0].questionId;
    }

    if (currentFilter === 'bonus') {
      items.forEach(q => renderBonusCard(q));
    } else {
      items.forEach((g, idx) => renderQuestionCard(g, idx));
    }
  }

  // Render Standard Question Group Card
  function renderQuestionCard(g, idx) {
    const card = document.createElement('div');
    const isFocused = focusedCardId === g.questionId;
    
    // Check audit status
    const auditEntry = auditTrail.find(a => a.questionId === g.questionId);
    let auditBanner = '';
    if (auditEntry) {
      const isApproved = auditEntry.action === 'approve' || auditEntry.action === 'edit';
      const bg = isApproved ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400';
      auditBanner = `
        <div class="px-4 py-2 border-b ${bg} text-xs font-semibold flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <span>${isApproved ? '✅ Approved by Faculty' : '🛑 Rejected by Faculty'}</span>
            <span class="font-normal opacity-80">(${new Date(auditEntry.timestamp).toLocaleTimeString()})</span>
            ${auditEntry.note ? `<span class="italic font-normal opacity-90">— "${auditEntry.note}"</span>` : ''}
          </div>
          <button class="text-[11px] underline opacity-80 hover:opacity-100" onclick="undoAuditAction('${g.questionId}')">Undo</button>
        </div>
      `;
    }

    // Route Badge Config
    let routeBadge = '';
    if (g.primaryRoute === 'faculty_review') {
      routeBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">🚨 Faculty Review Required</span>`;
    } else if (g.primaryRoute === 'auto_apply') {
      routeBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">⚡ Safe to Auto-Apply</span>`;
    } else {
      routeBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-500/15 text-gray-600 dark:text-gray-400 border border-gray-500/30 flex items-center gap-1">🛡️ No Change Needed</span>`;
    }

    // Urgency Rank Badge
    const isTopUrgent = g.urgencyRank <= 3;
    const rankClass = isTopUrgent ? 'bg-red-500 text-white font-extrabold shadow-sm' : 'bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 font-semibold';

    // Diff Box Render
    let diffHtml = '';
    if (g.diff) {
      if (g.diff.field === 'answer') {
        diffHtml = `
          <div class="bg-indigo-50/70 dark:bg-dark-800/80 border border-indigo-200 dark:border-indigo-900/60 rounded-xl p-3 flex flex-col gap-2">
            <div class="flex items-center justify-between text-xs font-semibold text-indigo-700 dark:text-indigo-400">
              <span class="flex items-center gap-1.5">🎯 Proposed Key Change:</span>
              <span class="text-[11px] font-mono text-gray-400">field: answer</span>
            </div>
            <div class="flex items-center gap-4 text-sm font-mono">
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400 font-sans">Current Key:</span>
                <span class="diff-del px-2.5 py-1">${g.diff.find}</span>
              </div>
              <span class="text-gray-400 font-bold">&rarr;</span>
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400 font-sans">Proposed Key:</span>
                <span class="diff-add px-2.5 py-1">${g.diff.replace}</span>
              </div>
            </div>
          </div>
        `;
      } else {
        diffHtml = `
          <div class="bg-indigo-50/70 dark:bg-dark-800/80 border border-indigo-200 dark:border-indigo-900/60 rounded-xl p-3 flex flex-col gap-2">
            <div class="flex items-center justify-between text-xs font-semibold text-indigo-700 dark:text-indigo-400">
              <span class="flex items-center gap-1.5">✂️ Surgical Content Patch:</span>
              <span class="text-[11px] font-mono text-gray-400">field: ${g.diff.field}</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div class="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                <div class="text-[10px] uppercase font-bold text-red-500 mb-1">Remove (Find):</div>
                <div class="font-mono text-red-700 dark:text-red-300 break-words">${escapeHtml(g.diff.find)}</div>
              </div>
              <div class="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div class="text-[10px] uppercase font-bold text-emerald-500 mb-1">Insert (Replace):</div>
                <div class="font-mono text-emerald-700 dark:text-emerald-300 break-words">${escapeHtml(g.diff.replace)}</div>
              </div>
            </div>
          </div>
        `;
      }
    } else {
      diffHtml = `
        <div class="bg-gray-100/60 dark:bg-dark-800/60 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
          <span>🛡️ No file mutation proposed (Verified question is correct or requires external faculty action).</span>
          <span class="font-mono text-[11px]">field: none</span>
        </div>
      `;
    }

    // Student Reports Drawer
    const reportsList = g.reports.map((r, rIdx) => `
      <div class="p-2.5 rounded-xl bg-gray-50 dark:bg-dark-900 border border-gray-200/80 dark:border-gray-800 flex flex-col gap-1.5 text-xs">
        <div class="flex items-center justify-between text-gray-500 dark:text-gray-400 text-[11px]">
          <div class="flex items-center gap-1.5">
            <span class="font-bold text-gray-700 dark:text-gray-300 font-mono">${r.reportId}</span>
            <span class="px-1.5 py-0.2 rounded bg-gray-200 dark:bg-dark-750 text-[10px] uppercase">${r.source}</span>
            <span>•</span>
            <span class="font-mono text-[10px]">${r.studentId}</span>
          </div>
          <span>${formatDate(r.reportedAt)}</span>
        </div>
        <div class="font-medium text-gray-800 dark:text-gray-200 italic pl-1 border-l-2 border-indigo-500/50">
          "${escapeHtml(r.comment)}"
        </div>
      </div>
    `).join('');

    card.className = `question-card relative bg-white dark:bg-dark-850 rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md ${isFocused ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-gray-200 dark:border-gray-800'}`;
    card.id = `qcard-${g.questionId}`;
    
    card.innerHTML = `
      ${auditBanner}
      
      <!-- Card Top Bar: Urgency, Metadata, Status -->
      <div class="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-xl ${rankClass} flex items-center justify-center text-xs" title="Urgency Rank #${g.urgencyRank}">
            #${g.urgencyRank}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="font-bold text-sm tracking-tight">${g.subject}</span>
              <span class="text-gray-300 dark:text-gray-600">•</span>
              <span class="text-xs text-gray-600 dark:text-gray-300 font-medium">${g.chapter}</span>
              <span class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-dark-750 text-[10px] uppercase font-mono text-gray-500">${g.questionType}</span>
            </div>
            <div class="text-[11px] text-gray-400 font-mono flex items-center gap-2 mt-0.5">
              <span>QID: ${g.questionId}</span>
              <span>•</span>
              <span>${g.reportCount} ${g.reportCount === 1 ? 'Report' : 'Student Reports'}</span>
              <span>•</span>
              <span class="text-amber-500 font-medium">${g.urgencyReasons[0] || ''}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          ${routeBadge}
          <span class="px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-dark-800 border border-gray-200 dark:border-gray-700 text-[11px] font-semibold text-gray-600 dark:text-gray-300">
            ${g.primaryRepair || g.primaryVerdict}
          </span>
        </div>
      </div>

      <!-- Card Body: Grid with Question on left, Triage & Diff on right -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-gray-100 dark:divide-gray-800">
        
        <!-- Left Column: Rendered Question Stem & Stored Solution (6 cols) -->
        <div class="lg:col-span-6 p-5 flex flex-col gap-4">
          
          <!-- Question Render with Native MathML -->
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-400">
              <span>Question Stem</span>
              <span class="font-mono text-[11px] text-gray-500">Stored Key: <strong class="text-brand-600 dark:text-brand-400 text-sm">${Array.isArray(g.originalAnswer) ? g.originalAnswer.join(', ') : g.originalAnswer}</strong></span>
            </div>
            <div class="rendered-content text-sm bg-gray-50/70 dark:bg-dark-900/60 p-4 rounded-xl border border-gray-100 dark:border-gray-800/80 leading-relaxed overflow-x-auto">
              ${g.questionHtml}
            </div>
          </div>

          <!-- Stored Solution Render -->
          <div class="flex flex-col gap-1.5">
            <button class="toggle-sol-btn flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 py-1" onclick="toggleSolution('${g.questionId}')">
              <span class="flex items-center gap-1.5">
                <span>📖</span> Stored Solution Steps
              </span>
              <span id="sol-icon-${g.questionId}" class="text-xs">&darr; Expand</span>
            </button>
            <div id="sol-box-${g.questionId}" class="hidden rendered-content text-xs bg-gray-50 dark:bg-dark-900/80 p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 leading-relaxed overflow-x-auto">
              ${g.solutionHtml}
            </div>
          </div>

          <!-- Student Comments Accordion -->
          <div class="flex flex-col gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <div class="flex items-center justify-between text-xs">
              <span class="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <span>💬</span> Student Reports (${g.reportCount})
              </span>
              <span class="text-[11px] text-gray-400">Verbatim student feedback</span>
            </div>
            <div class="flex flex-col gap-2">
              ${reportsList}
            </div>
          </div>

        </div>

        <!-- Right Column: AI Triage, Diff & Action Controls (6 cols) -->
        <div class="lg:col-span-6 p-5 bg-white dark:bg-dark-850 flex flex-col justify-between gap-4">
          
          <div class="flex flex-col gap-4">
            <!-- Proposed Diff Inspector -->
            <div class="flex flex-col gap-1.5">
              <span class="text-xs font-bold uppercase tracking-wider text-gray-400">AI Proposed Surgical Change</span>
              ${diffHtml}
            </div>

            <!-- Evidence & Confidence -->
            <div class="p-3.5 rounded-xl bg-gray-50 dark:bg-dark-900 border border-gray-200/80 dark:border-gray-800 flex flex-col gap-2">
              <div class="flex items-center justify-between text-xs">
                <span class="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <span>🧠</span> AI Verification Evidence:
                </span>
                <div class="flex items-center gap-1.5 font-mono text-[11px]">
                  <span class="text-gray-400">Confidence:</span>
                  <strong class="text-emerald-600 dark:text-emerald-400">${Math.round(g.confidence * 100)}%</strong>
                </div>
              </div>
              <p class="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                ${g.evidence}
              </p>
            </div>

            <!-- Empathetic Student Reply Preview -->
            <div class="p-3.5 rounded-xl bg-brand-50/50 dark:bg-indigo-950/30 border border-brand-100 dark:border-indigo-900/50 flex flex-col gap-2">
              <div class="flex items-center justify-between text-xs">
                <span class="font-semibold text-brand-900 dark:text-brand-300 flex items-center gap-1">
                  <span>💌</span> Student Reply Preview (JEE Tone):
                </span>
                <button class="text-[11px] text-brand-600 dark:text-brand-400 hover:underline font-medium" onclick="copyReplyText('${escapeSingleQuotes(g.studentReply)}')">
                  Copy Text
                </button>
              </div>
              <p class="text-xs text-gray-700 dark:text-gray-200 italic leading-relaxed">
                "${g.studentReply}"
              </p>
            </div>
          </div>

          <!-- Bottom Action Buttons: Approve / Edit / Reject -->
          <div class="pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
            <div class="text-[11px] text-gray-400 hidden sm:block">
              Shortcuts: <kbd class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-dark-750 font-mono text-[10px] text-gray-600 dark:text-gray-300">A</kbd> Approve &bull; <kbd class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-dark-750 font-mono text-[10px] text-gray-600 dark:text-gray-300">R</kbd> Reject
            </div>

            <div class="flex items-center gap-2 ml-auto">
              <button onclick="handleFacultyAction('${g.questionId}', 'reject')" class="px-3.5 py-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/30 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 text-xs font-semibold transition flex items-center gap-1.5">
                <span>&times;</span> Reject Fix
              </button>
              <button onclick="openModalEdit('${g.questionId}')" class="px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-dark-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-700 text-xs font-medium transition flex items-center gap-1.5">
                <span>✏️</span> Edit Proposal
              </button>
              <button onclick="handleFacultyAction('${g.questionId}', 'approve')" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5">
                <span>&check;</span> Approve Fix
              </button>
            </div>
          </div>

        </div>
      </div>
    `;

    cardsContainer.appendChild(card);
  }

  // Render Bonus / Unreported Defect Card
  function renderBonusCard(q) {
    const card = document.createElement('div');
    card.className = "bg-white dark:bg-dark-850 rounded-2xl border border-purple-200 dark:border-purple-900/60 p-5 shadow-sm flex flex-col gap-4";
    card.innerHTML = `
      <div class="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
            ✨ Bonus: Unreported Latent Defect Found
          </span>
          <span class="font-bold text-sm">${q.subject} • ${q.chapter}</span>
        </div>
        <span class="font-mono text-xs text-gray-400">QID: ${q.questionId}</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <span class="text-xs font-bold uppercase text-gray-400 block mb-1">Question Content:</span>
          <div class="rendered-content text-xs bg-gray-50 dark:bg-dark-900 p-3 rounded-xl border border-gray-100 dark:border-gray-800 overflow-x-auto">
            ${q.questionHtml}
          </div>
        </div>
        <div>
          <span class="text-xs font-bold uppercase text-gray-400 block mb-1">Stored Solution & Key:</span>
          <div class="rendered-content text-xs bg-gray-50 dark:bg-dark-900 p-3 rounded-xl border border-gray-100 dark:border-gray-800 overflow-x-auto">
            ${q.solutionHtml}
          </div>
        </div>
      </div>

      <div class="p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 flex flex-col gap-1.5 text-xs">
        <strong class="text-purple-800 dark:text-purple-300">Latent Defect Diagnosis:</strong>
        <p class="text-gray-700 dark:text-gray-300 leading-relaxed">${q.defectNote}</p>
        <span class="text-[11px] text-gray-500 font-mono">Suggested repair type: ${q.suggestedRepair}</span>
      </div>

      <div class="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
        <button onclick="handleBonusAction('${q.questionId}', 'ignore')" class="px-3.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs">Dismiss</button>
        <button onclick="handleBonusAction('${q.questionId}', 'fix')" class="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold">Fix Latent Defect</button>
      </div>
    `;
    cardsContainer.appendChild(card);
  }

  // Action Handlers
  window.handleFacultyAction = function(qid, action) {
    const group = groups.find(g => g.questionId === qid);
    if (!group) return;

    const entry = {
      id: 'aud_' + Date.now(),
      questionId: qid,
      action: action,
      primaryRepair: group.primaryRepair,
      reportsCount: group.reportCount,
      timestamp: new Date().toISOString(),
      note: action === 'approve' ? 'Approved surgical proposal' : 'Rejected proposal by faculty review'
    };

    // Replace or prepend in audit trail
    auditTrail = auditTrail.filter(a => a.questionId !== qid);
    auditTrail.unshift(entry);
    saveAuditTrail();

    showToast(action === 'approve' ? '✅ Fix Approved & Logged' : '🛑 Fix Rejected & Logged', action === 'approve' ? '✅' : '🛑');
    render();
  };

  window.handleBonusAction = function(qid, action) {
    showToast(action === 'fix' ? '✨ Bonus defect fix queued for publication!' : 'Dismissed bonus notice', '✨');
  };

  window.undoAuditAction = function(qid) {
    auditTrail = auditTrail.filter(a => a.questionId !== qid);
    saveAuditTrail();
    showToast('Audit entry reversed', '↩️');
    render();
  };

  function saveAuditTrail() {
    try {
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(auditTrail));
    } catch (e) {}
    updateAuditBadge();
  }

  function updateAuditBadge() {
    auditBadge.textContent = auditTrail.length;
  }

  function renderAuditList() {
    auditList.innerHTML = '';
    if (auditTrail.length === 0) {
      auditList.appendChild(auditEmpty);
      return;
    }

    auditTrail.forEach(item => {
      const el = document.createElement('div');
      const isApproved = item.action === 'approve' || item.action === 'edit';
      const border = isApproved ? 'border-l-emerald-500' : 'border-l-red-500';
      el.className = `p-3 bg-gray-50 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-gray-700 border-l-4 ${border} flex flex-col gap-1 text-xs`;
      el.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="font-bold text-gray-800 dark:text-gray-200 uppercase text-[10px]">${item.action}</span>
          <span class="text-gray-400 text-[10px]">${new Date(item.timestamp).toLocaleTimeString()}</span>
        </div>
        <div class="font-mono text-gray-500 text-[11px]">QID: ${item.questionId}</div>
        <div class="text-gray-600 dark:text-gray-300 italic">${escapeHtml(item.note || '')}</div>
      `;
      auditList.appendChild(el);
    });
  }

  // Modal Edit Handlers
  window.openModalEdit = function(qid) {
    activeEditQid = qid;
    const g = groups.find(x => x.questionId === qid);
    if (!g) return;

    document.getElementById('edit-field').value = g.diff ? g.diff.field : 'answer';
    document.getElementById('edit-find').value = g.diff ? g.diff.find : g.originalAnswer;
    document.getElementById('edit-replace').value = g.diff ? g.diff.replace : '';
    document.getElementById('edit-note').value = 'Faculty verified and adjusted proposed fix';

    modalEdit.classList.remove('hidden');
    modalEdit.classList.add('flex');
  };

  function closeModalEdit() {
    modalEdit.classList.add('hidden');
    modalEdit.classList.remove('flex');
    activeEditQid = null;
  }

  function saveModalEdit() {
    if (!activeEditQid) return;
    const g = groups.find(x => x.questionId === activeEditQid);
    if (!g) return;

    const fld = document.getElementById('edit-field').value.trim();
    const fnd = document.getElementById('edit-find').value;
    const rpl = document.getElementById('edit-replace').value;
    const note = document.getElementById('edit-note').value.trim();

    g.diff = {
      field: fld,
      find: fnd,
      replace: rpl
    };

    const entry = {
      id: 'aud_' + Date.now(),
      questionId: activeEditQid,
      action: 'edit',
      primaryRepair: g.primaryRepair,
      reportsCount: g.reportCount,
      timestamp: new Date().toISOString(),
      note: note || 'Faculty customized surgical fix'
    };

    auditTrail = auditTrail.filter(a => a.questionId !== activeEditQid);
    auditTrail.unshift(entry);
    saveAuditTrail();

    closeModalEdit();
    showToast('✏️ Custom Fix Applied & Approved', '✏️');
    render();
  }

  // Keyboard navigation & quick action
  function navigateCard(delta) {
    const items = getFilteredItems();
    if (items.length === 0) return;

    const currentIndex = items.findIndex(g => g.questionId === focusedCardId);
    let nextIndex = currentIndex + delta;
    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex >= items.length) nextIndex = items.length - 1;

    focusedCardId = items[nextIndex].questionId;
    render();

    const targetEl = document.getElementById(`qcard-${focusedCardId}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function actOnFocused(action) {
    if (!focusedCardId) return;
    if (action === 'edit') {
      openModalEdit(focusedCardId);
    } else {
      handleFacultyAction(focusedCardId, action);
    }
  }

  // Solution Toggle
  window.toggleSolution = function(qid) {
    const box = document.getElementById(`sol-box-${qid}`);
    const icon = document.getElementById(`sol-icon-${qid}`);
    if (!box) return;
    if (box.classList.contains('hidden')) {
      box.classList.remove('hidden');
      icon.innerHTML = '&uarr; Collapse';
    } else {
      box.classList.add('hidden');
      icon.innerHTML = '&darr; Expand';
    }
  };

  // Toast Helper
  let toastTimer = null;
  function showToast(msg, icon = '✅') {
    if (toastTimer) clearTimeout(toastTimer);
    toastMsg.textContent = msg;
    toastIcon.textContent = icon;
    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
    toastTimer = setTimeout(() => {
      toast.classList.add('translate-y-20', 'opacity-0');
      toast.classList.remove('translate-y-0', 'opacity-100');
    }, 2800);
  }

  // Copy helper
  window.copyReplyText = function(text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Student reply copied to clipboard!', '📋');
    });
  };

  // Export audit log
  document.getElementById('btn-export-audit').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(auditTrail, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `acadza_faculty_audit_trail_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('btn-clear-audit').addEventListener('click', () => {
    if (confirm('Clear audit history?')) {
      auditTrail = [];
      saveAuditTrail();
      renderAuditList();
      render();
    }
  });

  // Utility String Functions
  function escapeHtml(str) {
    if (!str) return '';
    return str.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeSingleQuotes(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'");
  }

  function formatDate(isoStr) {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return isoStr;
    }
  }

})();
