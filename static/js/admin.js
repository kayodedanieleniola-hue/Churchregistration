let allRegistrations = [];

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function renderLatestRegistration(item) {
  const container = document.getElementById("latestRegistration");
  if (!item) {
    container.className = "latest-registration empty-state";
    container.textContent = "No registrations yet.";
    return;
  }

  container.className = "latest-registration";
  container.innerHTML = `
    <strong>${item.full_name || "-"}</strong>
    <p>Member ID: ${item.member_id || "-"}</p>
    <p>Submitted: ${formatDate(item.created_at)}</p>
  `;
}

function renderBreakdown(targetId, items, emptyText) {
  const container = document.getElementById(targetId);
  if (!items.length) {
    container.className = "list-stack empty-state";
    container.textContent = emptyText;
    return;
  }

  container.className = "list-stack";
  container.innerHTML = items
    .map(
      (item) => `
        <div class="list-item">
          <span>${item.label}</span>
          <strong>${item.total}</strong>
        </div>
      `
    )
    .join("");
}

function renderBackupInfo(summary) {
  document.getElementById("databaseEngine").textContent = summary.database.engine;
  document.getElementById("csvRows").textContent = summary.csv_backup.rows;
  document.getElementById("csvUpdatedAt").textContent = formatDate(summary.csv_backup.modified_at);
  document.getElementById("csvFilename").textContent = summary.csv_backup.filename;
}

function renderRegistrations(items) {
  const tbody = document.getElementById("registrationsTable");
  const status = document.getElementById("tableStatus");

  if (!items.length) {
    tbody.innerHTML = "";
    status.textContent = "No registrations found.";
    return;
  }

  status.textContent = `${items.length} registration${items.length === 1 ? "" : "s"} shown.`;
  tbody.innerHTML = items
    .map(
      (item) => `
        <tr>
          <td>
            <strong>${item.full_name || "-"}</strong><br>
            <span>${item.gender || "Unspecified"}</span>
          </td>
          <td>${item.member_id || "-"}</td>
          <td>
            <strong>${item.email || "-"}</strong><br>
            <span>${item.phone || "-"}</span>
          </td>
          <td>${item.department || "-"}</td>
          <td><span class="pill">${item.first_time || "No"}</span></td>
          <td>${formatDate(item.created_at)}</td>
          <td>
            <div class="table-actions">
              <a href="/admin/id-card/${item.id}" target="_blank" rel="noopener noreferrer">Open ID Card</a>
            </div>
          </td>
        </tr>
      `
    )
    .join("");
}

function filterRegistrations(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    renderRegistrations(allRegistrations);
    return;
  }

  const filtered = allRegistrations.filter((item) => {
    return [
      item.full_name,
      item.email,
      item.phone,
      item.member_id,
      item.department,
    ]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalized));
  });

  renderRegistrations(filtered);
}

async function loadSummary() {
  const response = await fetch("/api/admin/summary");
  const payload = await response.json();

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || "Could not load summary.");
  }

  document.getElementById("totalMembers").textContent = payload.overview.total_members;
  document.getElementById("firstTimers").textContent = payload.overview.first_timers;
  document.getElementById("capturedPhotos").textContent = payload.overview.captured_photos;
  document.getElementById("recentSignups").textContent = payload.overview.recent_signups;

  renderLatestRegistration(payload.overview.latest_registration);
  renderBreakdown("genderBreakdown", payload.gender_breakdown, "No gender data yet.");
  renderBreakdown("departmentBreakdown", payload.department_breakdown, "No department data yet.");
  renderBackupInfo(payload);
}

async function loadRegistrations() {
  const response = await fetch("/api/registrations");
  const payload = await response.json();

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || "Could not load registrations.");
  }

  allRegistrations = payload.registrations;
  renderRegistrations(allRegistrations);
}

async function loadDashboard() {
  const status = document.getElementById("tableStatus");
  status.textContent = "Loading registrations...";

  try {
    await Promise.all([loadSummary(), loadRegistrations()]);
  } catch (error) {
    status.textContent = error.message;
  }
}

document.getElementById("refreshBtn").addEventListener("click", loadDashboard);
document.getElementById("searchInput").addEventListener("input", (event) => {
  filterRegistrations(event.target.value);
});

loadDashboard();
