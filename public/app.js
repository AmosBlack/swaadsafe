// SwaadSafe Client Application

let currentTab = "tab-samples";
let uploadedImageBase64 = null;
let sampleMenus = {};

document.addEventListener("DOMContentLoaded", async () => {
  setupPills();
  setupTabs();
  setupImageUpload();
  await loadSampleMenus();

  document.getElementById("btnAnalyze").addEventListener("click", handleAnalyze);
  document.getElementById("btnCopyWaiter").addEventListener("click", copyWaiterCard);
});

// Setup clickable pills for allergens, diets, and taste
function setupPills() {
  document.querySelectorAll(".pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      if (pill.dataset.value) {
        if (pill.closest("#allergenPills")) {
          pill.classList.toggle("selected-allergen");
        } else if (pill.closest("#tastePills")) {
          pill.classList.toggle("selected-taste");
        } else if (pill.closest("#dietPills")) {
          // Single select or multi select for diet
          pill.classList.toggle("selected-diet");
        }
      }
    });
  });

  // Custom allergen input
  const customInput = document.getElementById("customAllergen");
  customInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && customInput.value.trim()) {
      const val = customInput.value.trim();
      const pill = document.createElement("div");
      pill.className = "pill selected-allergen";
      pill.dataset.value = val;
      pill.textContent = `⚠️ ${val}`;
      pill.addEventListener("click", () => pill.remove());
      document.getElementById("allergenPills").appendChild(pill);
      customInput.value = "";
    }
  });
}

// Setup tabs
function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));

      btn.classList.add("active");
      currentTab = btn.dataset.tab;
      document.getElementById(currentTab).classList.add("active");
    });
  });
}

// Setup image upload & preview
function setupImageUpload() {
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("menuFileInput");
  const previewContainer = document.getElementById("previewContainer");
  const previewImg = document.getElementById("previewImg");
  const btnRemoveImg = document.getElementById("btnRemoveImg");

  dropzone.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        uploadedImageBase64 = event.target.result;
        previewImg.src = uploadedImageBase64;
        previewContainer.style.display = "block";
        dropzone.style.display = "none";
      };
      reader.readAsDataURL(file);
    }
  });

  btnRemoveImg.addEventListener("click", () => {
    uploadedImageBase64 = null;
    fileInput.value = "";
    previewContainer.style.display = "none";
    dropzone.style.display = "block";
  });
}

// Load sample menus from server
async function loadSampleMenus() {
  try {
    const res = await fetch("/api/sample-menus");
    sampleMenus = await res.json();
    const select = document.getElementById("sampleSelect");
    const preview = document.getElementById("samplePreviewText");

    const updatePreview = () => {
      const selectedKey = select.value;
      if (sampleMenus[selectedKey]) {
        preview.value = sampleMenus[selectedKey].text;
      }
    };

    select.addEventListener("change", updatePreview);
    updatePreview();
  } catch (err) {
    console.error("Failed to load sample menus:", err);
  }
}

// Execute analysis with Sarvam AI
async function handleAnalyze() {
  const allergens = Array.from(document.querySelectorAll("#allergenPills .selected-allergen")).map(
    (el) => el.dataset.value
  );
  const diets = Array.from(document.querySelectorAll("#dietPills .selected-diet")).map(
    (el) => el.dataset.value
  );
  const tastes = Array.from(document.querySelectorAll("#tastePills .selected-taste")).map(
    (el) => el.dataset.value
  );
  const preferredLanguage = document.getElementById("waiterLanguage").value;

  let menuText = "";
  let imageBase64 = null;

  if (currentTab === "tab-samples") {
    menuText = document.getElementById("samplePreviewText").value;
  } else if (currentTab === "tab-paste") {
    menuText = document.getElementById("customMenuText").value.trim();
    if (!menuText) {
      alert("Please paste or type in some dishes from the menu.");
      return;
    }
  } else if (currentTab === "tab-upload") {
    if (!uploadedImageBase64) {
      alert("Please select or upload a menu photo first.");
      return;
    }
    imageBase64 = uploadedImageBase64;
  }

  // UI state
  const btn = document.getElementById("btnAnalyze");
  const loadingCard = document.getElementById("loadingCard");
  const resultsCard = document.getElementById("resultsCard");
  const errorCard = document.getElementById("errorCard");
  const errorMessage = document.getElementById("errorMessage");

  btn.disabled = true;
  loadingCard.style.display = "block";
  resultsCard.style.display = "none";
  if (errorCard) errorCard.style.display = "none";

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menuText,
        imageBase64,
        allergens,
        dietaryRestrictions: diets,
        tastePreferences: tastes,
        preferredLanguage
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Analysis failed");
    }

    renderResults(data);
    resultsCard.style.display = "block";
    resultsCard.scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    console.error("Analysis Error:", err);
    if (errorCard && errorMessage) {
      errorMessage.textContent = err.message;
      errorCard.style.display = "block";
      errorCard.scrollIntoView({ behavior: "smooth" });
    } else {
      alert("Error: " + err.message);
    }
  } finally {
    btn.disabled = false;
    loadingCard.style.display = "none";
  }
}

// Render analysis results
function renderResults(data) {
  // Summary
  const summaryBanner = document.getElementById("summaryBanner");
  summaryBanner.innerHTML = `<strong>Advisory Summary:</strong> ${data.summary || "Menu analysis completed."}`;

  // Top Recommendations
  const topRecContainer = document.getElementById("topRecommendations");
  topRecContainer.innerHTML = "";
  if (Array.isArray(data.top_recommendations) && data.top_recommendations.length > 0) {
    data.top_recommendations.forEach((rec) => {
      const item = document.createElement("div");
      item.style.padding = "10px 14px";
      item.style.background = "#ecfdf5";
      item.style.borderRadius = "8px";
      item.style.marginBottom = "8px";
      item.style.border = "1px solid #a7f3d0";
      item.innerHTML = `<strong>✨ ${rec.name}</strong>: ${rec.reason}`;
      topRecContainer.appendChild(item);
    });
  } else {
    topRecContainer.innerHTML = `<p style="color: #64748b;">No direct recommendations match all criteria.</p>`;
  }

  // Dishes List
  const dishesList = document.getElementById("dishesList");
  dishesList.innerHTML = "";

  if (Array.isArray(data.dishes)) {
    data.dishes.forEach((dish) => {
      const card = document.createElement("div");
      const status = (dish.safety_status || "CAUTION").toLowerCase();
      card.className = `dish-card ${status}`;

      const allergensText = dish.detected_allergens && dish.detected_allergens.length > 0
        ? dish.detected_allergens.join(", ")
        : "None identified";

      let alertHtml = "";
      if (dish.hidden_allergen_alert && dish.hidden_allergen_alert !== "None detected") {
        alertHtml = `<div class="allergen-alert-box"><strong>⚠️ Hidden Allergen Detail:</strong> ${dish.hidden_allergen_alert}</div>`;
      }

      let customHtml = "";
      if (dish.can_customize && dish.customization_request) {
        customHtml = `
          <div class="customization-box">
            <strong>🧑‍🍳 How to customize:</strong> ${dish.customization_request}
            ${dish.customization_request_local ? `<div style="font-style: italic; margin-top: 4px; color: #064e3b;">"${dish.customization_request_local}"</div>` : ""}
          </div>
        `;
      }

      card.innerHTML = `
        <div class="dish-header">
          <div>
            <span class="dish-name">${dish.name}</span>
            <span style="font-size: 0.8rem; color: #64748b; margin-left: 8px;">(${dish.category || "Dish"})</span>
          </div>
          <span class="dish-badge ${status}">${dish.safety_status}</span>
        </div>
        <div class="dish-meta">
          <span class="score-badge">Taste Match: ${dish.taste_score || 75}/100</span>
          <span>Allergens: ${allergensText}</span>
        </div>
        <p style="font-size: 0.9rem; color: #334155; margin-bottom: 6px;">${dish.taste_profile_notes || ""}</p>
        ${alertHtml}
        ${customHtml}
      `;
      dishesList.appendChild(card);
    });
  }

  // Waiter Card
  const waiterBody = document.getElementById("waiterCardBody");
  if (data.waiter_safety_card) {
    const en = data.waiter_safety_card.english || "";
    const local = data.waiter_safety_card.local_language || "";
    waiterBody.innerHTML = `
      <strong>In Local Language (show directly to staff):</strong>
      <div style="font-size: 1.1rem; font-weight: 600; margin: 8px 0; color: #78350f;">${local}</div>
      <hr style="border: 0; border-top: 1px solid #fed7aa; margin: 12px 0;">
      <strong>In English:</strong>
      <div style="margin-top: 4px;">${en}</div>
    `;
  }
}

// Copy waiter card text
function copyWaiterCard() {
  const body = document.getElementById("waiterCardBody");
  if (body) {
    navigator.clipboard.writeText(body.innerText).then(() => {
      const btn = document.getElementById("btnCopyWaiter");
      const original = btn.textContent;
      btn.textContent = "Copied! ✓";
      setTimeout(() => (btn.textContent = original), 2000);
    });
  }
}
