/**
 * Student Record Management System - Frontend Application
 * Interacts with Node.js Express backend and AWS DynamoDB / Mock Storage.
 */

// State
let studentsList = [];
let currentFilterCourse = 'all';
let searchQuery = '';
let pendingDeleteStudent = null;
let systemStatus = null;

// DOM Elements
const systemStatusBadge = document.getElementById('systemStatusBadge');
const statusBadgeText = document.getElementById('statusBadgeText');
const statusBanner = document.getElementById('statusBanner');
const bannerTitle = document.getElementById('bannerTitle');
const bannerModeTag = document.getElementById('bannerModeTag');
const bannerDescription = document.getElementById('bannerDescription');
const bannerIcon = document.getElementById('bannerIcon');
const metaTable = document.getElementById('metaTable');
const metaRegion = document.getElementById('metaRegion');

const statTotalStudents = document.getElementById('statTotalStudents');
const statTotalCourses = document.getElementById('statTotalCourses');
const statBackendType = document.getElementById('statBackendType');
const statUptime = document.getElementById('statUptime');

const studentForm = document.getElementById('studentForm');
const inputStudentId = document.getElementById('studentId');
const inputName = document.getElementById('name');
const inputCourse = document.getElementById('course');
const inputEmail = document.getElementById('email');
const btnSubmitStudent = document.getElementById('btnSubmitStudent');

const btnGenId = document.getElementById('btnGenId');
const btnAutoGenerate = document.getElementById('btnAutoGenerate');
const btnRecheckStatus = document.getElementById('btnRecheckStatus');
const btnResetMock = document.getElementById('btnResetMock');
const btnHealthCheck = document.getElementById('btnHealthCheck');
const btnRefreshList = document.getElementById('btnRefreshList');
const searchInput = document.getElementById('searchInput');
const btnClearSearch = document.getElementById('btnClearSearch');

const studentsTableBody = document.getElementById('studentsTableBody');
const emptyState = document.getElementById('emptyState');
const emptyStateMessage = document.getElementById('emptyStateMessage');
const tableLoading = document.getElementById('tableLoading');
const badgeRecordCount = document.getElementById('badgeRecordCount');
const filterChipsContainer = document.getElementById('filterChipsContainer');
const btnEmptyAdd = document.getElementById('btnEmptyAdd');

// Modals
const deleteModal = document.getElementById('deleteModal');
const deleteTargetName = document.getElementById('deleteTargetName');
const deleteTargetId = document.getElementById('deleteTargetId');
const btnConfirmDelete = document.getElementById('btnConfirmDelete');
const btnCancelDelete = document.getElementById('btnCancelDelete');
const btnCloseDeleteModal = document.getElementById('btnCloseDeleteModal');

const archModal = document.getElementById('archModal');
const btnArchModal = document.getElementById('btnArchModal');
const btnCloseArchModal = document.getElementById('btnCloseArchModal');
const btnCloseArchModalBottom = document.getElementById('btnCloseArchModalBottom');

const toastContainer = document.getElementById('toastContainer');

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  generateSuggestedId();
  await fetchSystemStatus();
  await loadStudents();
  startUptimeTracker();
});

// ==========================================================================
// Event Listeners
// ==========================================================================
function setupEventListeners() {
  // Form submission
  studentForm.addEventListener('submit', handleFormSubmit);

  // Form helpers
  btnGenId.addEventListener('click', generateSuggestedId);
  btnAutoGenerate.addEventListener('click', handleQuickFill);

  // System actions
  btnRecheckStatus.addEventListener('click', handleRecheckConnection);
  btnResetMock.addEventListener('click', handleResetMockData);
  btnHealthCheck.addEventListener('click', handleHealthCheck);
  btnRefreshList.addEventListener('click', () => loadStudents(true));

  // Search & Filters
  searchInput.addEventListener('input', handleSearchInput);
  btnClearSearch.addEventListener('click', handleClearSearch);

  filterChipsContainer.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    currentFilterCourse = chip.dataset.filter;
    renderTable();
  });

  btnEmptyAdd.addEventListener('click', () => {
    inputStudentId.focus();
  });

  // Delete modal
  btnCancelDelete.addEventListener('click', closeDeleteModal);
  btnCloseDeleteModal.addEventListener('click', closeDeleteModal);
  btnConfirmDelete.addEventListener('click', handleConfirmDelete);

  // Architecture modal
  btnArchModal.addEventListener('click', () => (archModal.style.display = 'flex'));
  btnCloseArchModal.addEventListener('click', () => (archModal.style.display = 'none'));
  btnCloseArchModalBottom.addEventListener('click', () => (archModal.style.display = 'none'));

  // Close modals on clicking backdrop
  window.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeDeleteModal();
    if (e.target === archModal) archModal.style.display = 'none';
  });
}

// ==========================================================================
// API Operations
// ==========================================================================

/**
 * Fetch DB & System Status
 */
async function fetchSystemStatus() {
  try {
    const res = await fetch('/api/status');
    const json = await res.json();
    if (json.success) {
      systemStatus = json.data;
      updateStatusUI(systemStatus);
    }
  } catch (error) {
    console.error('Failed to fetch status:', error);
    updateStatusFallback();
  }
}

/**
 * Update UI according to AWS vs Mock storage status
 */
function updateStatusUI(status) {
  metaTable.textContent = status.tableName || 'StudentRecords';
  metaRegion.textContent = status.region || 'ap-south-1';

  if (!status.isMock) {
    // AWS DynamoDB Connected
    systemStatusBadge.className = 'status-badge status-aws';
    statusBadgeText.textContent = 'Connected: AWS DynamoDB';

    statusBanner.className = 'status-banner banner-aws';
    bannerIcon.className = 'fa-solid fa-cloud-check';
    bannerTitle.textContent = 'Connected to AWS DynamoDB';
    bannerModeTag.className = 'tag tag-aws';
    bannerModeTag.textContent = 'Live AWS Cloud';
    bannerDescription.innerHTML = `
      Authenticated via AWS Default Credential Chain. All student records are persisted in 
      real-time to Amazon DynamoDB table <strong>${status.tableName}</strong> in <strong>${status.region}</strong>.
    `;

    statBackendType.textContent = 'AWS DynamoDB';
    statBackendType.className = 'stat-value text-mono text-success';
    btnResetMock.style.display = 'none';
  } else {
    // Running on Local Mock Data
    systemStatusBadge.className = 'status-badge status-mock';
    statusBadgeText.textContent = 'Mock Mode (Local)';

    statusBanner.className = 'status-banner banner-mock';
    bannerIcon.className = 'fa-solid fa-database';
    bannerTitle.textContent = 'Running on Local Mock Data';
    bannerModeTag.className = 'tag tag-mock';
    bannerModeTag.textContent = 'Local In-Memory Mode';
    bannerDescription.innerHTML = `
      AWS credentials or table not detected locally. App is running seamlessly in mock mode without crashing.
      Once deployed to an EC2 instance with an IAM role attached, it will auto-connect to AWS DynamoDB.
    `;

    statBackendType.textContent = 'Local Mock Data';
    statBackendType.className = 'stat-value text-mono text-warning';
    btnResetMock.style.display = 'inline-flex';
  }
}

function updateStatusFallback() {
  systemStatusBadge.className = 'status-badge status-loading';
  statusBadgeText.textContent = 'Status Unavailable';
}

/**
 * Recheck AWS Link via backend
 */
async function handleRecheckConnection() {
  const icon = btnRecheckStatus.querySelector('i');
  icon.classList.add('fa-spin');
  btnRecheckStatus.disabled = true;

  try {
    showToast('Probing AWS DynamoDB connectivity...', 'info', 2500);
    const res = await fetch('/api/status/recheck', { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      systemStatus = json.data;
      updateStatusUI(systemStatus);
      if (!systemStatus.isMock) {
        showToast('Successfully linked to AWS DynamoDB!', 'success');
      } else {
        showToast('Still in Mock Mode: AWS table or credentials unreachable.', 'warning', 4000);
      }
      await loadStudents();
    }
  } catch (error) {
    showToast('Failed to probe connection: ' + error.message, 'error');
  } finally {
    icon.classList.remove('fa-spin');
    btnRecheckStatus.disabled = false;
  }
}

/**
 * Reset Mock Data
 */
async function handleResetMockData() {
  try {
    const res = await fetch('/api/mock/reset', { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      showToast('Sample student records restored.', 'success');
      await loadStudents();
    }
  } catch (error) {
    showToast('Error resetting mock data: ' + error.message, 'error');
  }
}

/**
 * Health Check trigger
 */
async function handleHealthCheck() {
  try {
    const start = performance.now();
    const res = await fetch('/health');
    const elapsed = Math.round(performance.now() - start);
    const data = await res.json();
    
    showToast(`Health: ${data.status.toUpperCase()} | Uptime: ${Math.round(data.uptime)}s | Latency: ${elapsed}ms`, 'info', 4500);
  } catch (err) {
    showToast('Health check failed: ' + err.message, 'error');
  }
}

/**
 * Load student records from server
 */
async function loadStudents(showNotification = false) {
  tableLoading.style.display = 'flex';
  emptyState.style.display = 'none';

  try {
    const res = await fetch('/api/students');
    const json = await res.json();
    if (json.success) {
      studentsList = json.data || [];
      renderTable();
      updateStats();
      if (showNotification) {
        showToast(`Refreshed ${studentsList.length} student records`, 'info', 2000);
      }
    } else {
      throw new Error(json.message || 'Error fetching records');
    }
  } catch (error) {
    console.error('Error loading students:', error);
    showToast('Failed to load student records: ' + error.message, 'error');
  } finally {
    tableLoading.style.display = 'none';
  }
}

/**
 * Handle new student form submission
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  const studentId = inputStudentId.value.trim();
  const name = inputName.value.trim();
  const course = inputCourse.value;
  const email = inputEmail.value.trim();

  // Basic validation
  if (!studentId || !name || !course || !email) {
    showToast('Please fill out all required fields.', 'warning');
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showToast('Please enter a valid email address.', 'warning');
    inputEmail.focus();
    return;
  }

  // Toggle button loader
  setButtonLoading(btnSubmitStudent, true);

  try {
    const payload = { studentId, name, course, email };
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.message || 'Could not save student record.');
    }

    showToast(`Student "${name}" (${studentId}) saved successfully!`, 'success');
    
    // Reset inputs but generate fresh ID for rapid input
    studentForm.reset();
    generateSuggestedId();
    
    // Refresh table
    await loadStudents();
  } catch (error) {
    showToast(error.message, 'error', 4500);
  } finally {
    setButtonLoading(btnSubmitStudent, false);
  }
}

/**
 * Prompt delete confirmation modal
 */
function promptDeleteStudent(student) {
  pendingDeleteStudent = student;
  deleteTargetName.textContent = student.name;
  deleteTargetId.textContent = student.studentId;
  deleteModal.style.display = 'flex';
}

function closeDeleteModal() {
  deleteModal.style.display = 'none';
  pendingDeleteStudent = null;
}

/**
 * Confirm and execute deletion
 */
async function handleConfirmDelete() {
  if (!pendingDeleteStudent) return;

  const id = pendingDeleteStudent.studentId;
  setButtonLoading(btnConfirmDelete, true);

  try {
    const res = await fetch(`/api/students/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.message || 'Failed to delete record.');
    }

    showToast(`Student record "${id}" deleted.`, 'success');
    closeDeleteModal();
    await loadStudents();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setButtonLoading(btnConfirmDelete, false);
  }
}

// ==========================================================================
// Rendering & Filtering
// ==========================================================================

function renderTable() {
  studentsTableBody.innerHTML = '';

  // Apply filters
  const filtered = studentsList.filter((student) => {
    // Course filter
    const matchesCourse = currentFilterCourse === 'all' || student.course === currentFilterCourse;

    // Search query
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      student.studentId.toLowerCase().includes(q) ||
      student.name.toLowerCase().includes(q) ||
      student.course.toLowerCase().includes(q) ||
      student.email.toLowerCase().includes(q);

    return matchesCourse && matchesSearch;
  });

  badgeRecordCount.textContent = filtered.length;

  if (filtered.length === 0) {
    emptyState.style.display = 'flex';
    if (searchQuery || currentFilterCourse !== 'all') {
      emptyStateMessage.textContent = 'No students match your active filters or search terms.';
    } else {
      emptyStateMessage.textContent = 'The student registry is currently empty.';
    }
    return;
  }

  emptyState.style.display = 'none';

  filtered.forEach((student) => {
    const tr = document.createElement('tr');

    const formattedDate = formatTimestamp(student.timestamp);

    tr.innerHTML = `
      <td>
        <span class="student-id-badge">
          ${escapeHtml(student.studentId)}
          <button class="btn-copy-id" title="Copy Student ID" data-id="${escapeHtml(student.studentId)}">
            <i class="fa-regular fa-copy"></i>
          </button>
        </span>
      </td>
      <td class="student-name-cell">${escapeHtml(student.name)}</td>
      <td><span class="course-tag">${escapeHtml(student.course)}</span></td>
      <td><a href="mailto:${escapeHtml(student.email)}" class="text-muted text-sm">${escapeHtml(student.email)}</a></td>
      <td class="date-cell">${formattedDate}</td>
      <td class="text-right actions-cell">
        <button class="btn-delete-row" title="Delete record" data-id="${escapeHtml(student.studentId)}">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;

    // Copy event
    const copyBtn = tr.querySelector('.btn-copy-id');
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(student.studentId);
      showToast(`Copied ID "${student.studentId}" to clipboard`, 'info', 1800);
    });

    // Delete event
    const deleteBtn = tr.querySelector('.btn-delete-row');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      promptDeleteStudent(student);
    });

    studentsTableBody.appendChild(tr);
  });
}

/**
 * Update stats cards
 */
function updateStats() {
  statTotalStudents.textContent = studentsList.length;

  const uniqueCourses = new Set(studentsList.map((s) => s.course));
  statTotalCourses.textContent = uniqueCourses.size;
}

/**
 * Search handler
 */
function handleSearchInput(e) {
  searchQuery = e.target.value;
  btnClearSearch.style.display = searchQuery ? 'block' : 'none';
  renderTable();
}

function handleClearSearch() {
  searchInput.value = '';
  searchQuery = '';
  btnClearSearch.style.display = 'none';
  renderTable();
  searchInput.focus();
}

// ==========================================================================
// Form Generation Helpers
// ==========================================================================

function generateSuggestedId() {
  const randomNum = Math.floor(100 + Math.random() * 900);
  inputStudentId.value = `STU-2026-${randomNum}`;
}

const SAMPLE_NAMES = [
  'Aarav Sharma', 'Sophia Chen', 'Liam Patel', 'Elena Rostova', 
  'Marcus Vance', 'Priya Nair', 'David Kim', 'Amara Okafor', 'Lucas Silva'
];

const SAMPLE_COURSES = [
  'Cloud Computing & AWS Architecture',
  'Full-Stack Modern Web Engineering',
  'DevOps, CI/CD & Kubernetes',
  'Data Science & Machine Learning Systems',
  'Cyber Security & Cloud Defense'
];

function handleQuickFill() {
  const randomName = SAMPLE_NAMES[Math.floor(Math.random() * SAMPLE_NAMES.length)];
  const randomCourse = SAMPLE_COURSES[Math.floor(Math.random() * SAMPLE_COURSES.length)];
  const emailSlug = randomName.toLowerCase().replace(/[^a-z]/g, '.');
  const randomEmail = `${emailSlug}@university.edu`;

  generateSuggestedId();
  inputName.value = randomName;
  inputCourse.value = randomCourse;
  inputEmail.value = randomEmail;

  showToast('Quick sample filled! Click "Save Student Record" to submit.', 'info', 2500);
}

// ==========================================================================
// Uptime Tracker & Utility Helpers
// ==========================================================================

function startUptimeTracker() {
  let seconds = 0;
  setInterval(async () => {
    seconds += 1;
    statUptime.textContent = formatDuration(seconds);
  }, 1000);
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) {
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  }
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatTimestamp(isoStr) {
  if (!isoStr) return '--';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setButtonLoading(btn, isLoading) {
  const textSpan = btn.querySelector('.btn-text');
  const loaderSpan = btn.querySelector('.btn-loader');
  if (isLoading) {
    btn.disabled = true;
    if (textSpan) textSpan.style.display = 'none';
    if (loaderSpan) loaderSpan.style.display = 'inline-block';
  } else {
    btn.disabled = false;
    if (textSpan) textSpan.style.display = 'inline-flex';
    if (loaderSpan) loaderSpan.style.display = 'none';
  }
}

/**
 * Toast Notification Dispatcher
 */
function showToast(message, type = 'info', duration = 3500) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconClass = 'fa-solid fa-circle-info';
  if (type === 'success') iconClass = 'fa-solid fa-circle-check';
  if (type === 'error') iconClass = 'fa-solid fa-triangle-exclamation';
  if (type === 'warning') iconClass = 'fa-solid fa-circle-exclamation';

  toast.innerHTML = `
    <i class="${iconClass}"></i>
    <span class="toast-message">${escapeHtml(message)}</span>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px) scale(0.95)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, duration);
}
