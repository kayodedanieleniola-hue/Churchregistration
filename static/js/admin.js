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

function formatBirthday(value) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });
}

function daysUntilBirthday(dob) {
  if (!dob) {
    return null;
  }

  const parsed = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let birthday = new Date(today.getFullYear(), parsed.getMonth(), parsed.getDate());

  if (birthday < startOfToday) {
    birthday = new Date(today.getFullYear() + 1, parsed.getMonth(), parsed.getDate());
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((birthday - startOfToday) / msPerDay);
}

function normalizeWhatsappPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  if (digits.startsWith("234")) {
    return digits;
  }

  if (digits.startsWith("0")) {
    return `234${digits.slice(1)}`;
  }

  return digits;
}

function buildBirthdayMessage(item, daysAway) {
  const firstName = (item.full_name || "dear member").split(" ")[0];
  const birthdayText = daysAway === 0
    ? "today"
    : daysAway === 1
      ? "tomorrow"
      : `in ${daysAway} days`;

  return `Hello ${firstName}, Global Harvest Outer Ringroad is celebrating you. We noticed your birthday is ${birthdayText}. Happy birthday in advance and God bless you.`;
}

function renderBirthdayReminders(items) {
  const container = document.getElementById("birthdayReminders");
  const upcoming = items
    .map((item) => ({
      ...item,
      daysAway: daysUntilBirthday(item.dob),
    }))
    .filter((item) => item.daysAway === 0 || item.daysAway === 3 || item.daysAway === 7)
    .sort((a, b) => a.daysAway - b.daysAway || (a.full_name || "").localeCompare(b.full_name || ""));

  if (!upcoming.length) {
    container.className = "birthday-grid empty-state";
    container.textContent = "No birthdays coming up.";
    return;
  }

  container.className = "birthday-grid";
  container.innerHTML = upcoming
    .map((item) => {
      const phone = normalizeWhatsappPhone(item.phone);
      const message = encodeURIComponent(buildBirthdayMessage(item, item.daysAway));
      const whatsappHref = phone ? `https://wa.me/${phone}?text=${message}` : "";
      const timing = item.daysAway === 0
        ? "Today"
        : item.daysAway === 1
          ? "Tomorrow"
          : `In ${item.daysAway} days`;

      return `
        <article class="birthday-card">
          <div>
            <strong>${item.full_name || "-"}</strong>
            <span>${timing} · ${formatBirthday(item.dob)}</span>
            <span>${item.phone || "No phone number"}</span>
          </div>
          ${whatsappHref
            ? `<a href="${whatsappHref}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`
            : `<button type="button" disabled>No Phone</button>`}
        </article>
      `;
    })
    .join("");
}

async function sendBirthdayReminders() {
  const button = document.getElementById("sendBirthdayRemindersBtn");
  const status = document.getElementById("birthdayReminderStatus");
  button.disabled = true;
  status.textContent = "Sending WhatsApp birthday reminders...";

  try {
    const response = await fetch("/api/admin/birthday-reminders/send", {
      method: "POST",
    });
    const payload = await response.json();

    if (!response.ok && response.status !== 207) {
      throw new Error(payload.error || "Could not send birthday reminders.");
    }

    const sentCount = payload.sent?.length || 0;
    const failedCount = payload.failed?.length || 0;
    const memberCount = payload.members?.length || 0;
    status.textContent = failedCount
      ? `Sent to ${sentCount} recipient(s), ${failedCount} failed. ${memberCount} birthday item(s) included.`
      : `Sent to ${sentCount} recipient(s). ${memberCount} birthday item(s) included.`;
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
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
    <p>Last card download: ${formatDate(item.last_downloaded_at)}</p>
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
          <td>
            <div class="download-meta">
              <strong>${item.download_count || 0} total</strong>
              <span>${formatDate(item.last_downloaded_at)}</span>
              <span>${item.last_downloaded_by ? `Last by ${item.last_downloaded_by}` : "Not downloaded yet"}</span>
            </div>
          </td>
          <td>${formatDate(item.created_at)}</td>
          <td>
            <div class="table-actions">
              <a href="/admin/id-card/${item.id}" target="_blank" rel="noopener noreferrer">Open ID Card</a>
              <a href="/admin/id-card/${item.id}?autodownload=1" target="_blank" rel="noopener noreferrer">Download PNG</a>
              <button type="button" class="danger-btn" data-delete-id="${item.id}" data-delete-name="${item.full_name || "member"}">Delete</button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");
}

function applyRegistrationFilters() {
  const searchInput = document.getElementById("searchInput");
  const departmentFilter = document.getElementById("departmentFilter");
  const query = (searchInput?.value || "").trim().toLowerCase();
  const department = departmentFilter?.value || "";

  const filtered = allRegistrations.filter((item) => {
    const matchesDepartment = !department || item.department === department;
    const matchesSearch = !query || [
      item.full_name,
      item.email,
      item.phone,
      item.member_id,
      item.department,
    ]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query));

    return matchesDepartment && matchesSearch;
  });

  renderRegistrations(filtered);
}

async function deleteRegistration(registrationId, fullName) {
  const confirmed = window.confirm(`Delete ${fullName}'s registration? This will remove the saved ID and photo file.`);
  if (!confirmed) {
    return;
  }

  const status = document.getElementById("tableStatus");
  status.textContent = "Deleting registration...";

  const response = await fetch(`/api/registrations/${registrationId}`, {
    method: "DELETE",
  });
  const payload = await response.json();

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || "Could not delete registration.");
  }

  await loadDashboard();
}

function filterRegistrations(query) {
  applyRegistrationFilters();
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
  document.getElementById("totalDownloads").textContent = payload.overview.total_downloads;

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
  renderBirthdayReminders(allRegistrations);
  applyRegistrationFilters();
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

document.getElementById("departmentFilter").addEventListener("change", () => {
  applyRegistrationFilters();
});
document.getElementById("sendBirthdayRemindersBtn").addEventListener("click", sendBirthdayReminders);
document.getElementById("registrationsTable").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-id]");
  if (!button) {
    return;
  }

  try {
    await deleteRegistration(button.dataset.deleteId, button.dataset.deleteName);
  } catch (error) {
    document.getElementById("tableStatus").textContent = error.message;
  }
});

loadDashboard();
