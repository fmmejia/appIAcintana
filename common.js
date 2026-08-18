/* ==========================================================================
   LÓGICA COMÚN Y CENTRALIZADA DE PERIODOS Y CALENDARIO (common.js)
   ========================================================================== */

// Configuración por defecto si no existe en localStorage
const DEFAULT_PERIODS_CONFIG = {
  "Ciclo 1 - 2026": {
    status: "active",
    cycleStart: "2026-02-01",
    cycleEnd: "2026-06-30",
    unit1End: "2026-03-05",
    unit2End: "2026-04-10",
    unit3End: "2026-05-15",
    unit4End: "2026-06-20",
    simulationDate: ""
  }
};

const DEFAULT_ACTIVE_PERIOD = "Ciclo 1 - 2026";

// Umbrales y ponderaciones institucionales por defecto
const DEFAULT_SYSTEM_CONFIG = {
  thresholdFail: 6.0,
  thresholdCum: 7.0,
  weightLab: 0.4,
  weightPar: 0.6
};

// Variable compatible hacia atrás
const SYSTEM_CONFIG = { ...DEFAULT_SYSTEM_CONFIG };

// Obtener configuración de ponderaciones y umbrales
function getSystemConfig() {
  const data = localStorage.getItem("atenas_system_config");
  if (!data) {
    return { ...DEFAULT_SYSTEM_CONFIG };
  }
  try {
    const parsed = JSON.parse(data);
    return {
      thresholdFail: typeof parsed.thresholdFail === 'number' ? parsed.thresholdFail : 6.0,
      thresholdCum: typeof parsed.thresholdCum === 'number' ? parsed.thresholdCum : 7.0,
      weightLab: typeof parsed.weightLab === 'number' ? parsed.weightLab : 0.4,
      weightPar: typeof parsed.weightPar === 'number' ? parsed.weightPar : 0.6
    };
  } catch (e) {
    return { ...DEFAULT_SYSTEM_CONFIG };
  }
}

// Guardar configuración de ponderaciones y umbrales
function saveSystemConfig(config) {
  localStorage.setItem("atenas_system_config", JSON.stringify(config));
}

// Recalcular métricas de todos los estudiantes almacenados con la nueva configuración
function recalculateAllStudentsWithConfig(newConfig) {
  const saved = localStorage.getItem("atenas_students");
  if (!saved) return;
  try {
    const students = JSON.parse(saved);
    const periodsConfig = getPeriodsConfig();
    students.forEach(s => {
      const pConfig = periodsConfig[s.periodo] || DEFAULT_PERIODS_CONFIG["Ciclo 1 - 2026"];
      calculateStudentMetrics(s, newConfig, pConfig);
    });
    localStorage.setItem("atenas_students", JSON.stringify(students));
  } catch (e) {
    console.error("Error al recalcular estudiantes", e);
  }
}

// Obtener todas las configuraciones de periodos
function getPeriodsConfig() {
  const data = localStorage.getItem("atenas_periods_config");
  if (!data) {
    localStorage.setItem("atenas_periods_config", JSON.stringify(DEFAULT_PERIODS_CONFIG));
    return JSON.parse(JSON.stringify(DEFAULT_PERIODS_CONFIG));
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error("Error al parsear atenas_periods_config", e);
    return JSON.parse(JSON.stringify(DEFAULT_PERIODS_CONFIG));
  }
}

// Guardar configuraciones de periodos
function savePeriodsConfig(config) {
  localStorage.setItem("atenas_periods_config", JSON.stringify(config));
}

// Obtener periodo activo
function getActivePeriod() {
  const active = localStorage.getItem("atenas_active_period");
  if (!active) {
    localStorage.setItem("atenas_active_period", DEFAULT_ACTIVE_PERIOD);
    return DEFAULT_ACTIVE_PERIOD;
  }
  return active;
}

// Establecer periodo activo
function setActivePeriod(period) {
  localStorage.setItem("atenas_active_period", period);
}

// Parsear fecha en formato YYYY-MM-DD local para evitar desfases de zona horaria
function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}

// Formatear fecha Date a YYYY-MM-DD local
function formatLocalDate(date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Determinar qué unidad está activa basándose en la fecha actual/simulación
function getCurrentUnit(periodConfig) {
  if (!periodConfig) return 4;
  if (periodConfig.status === "completed") return 4;

  const targetDate = periodConfig.simulationDate ? parseLocalDate(periodConfig.simulationDate) : new Date();
  if (!targetDate) return 4;
  targetDate.setHours(0, 0, 0, 0);

  const u1 = parseLocalDate(periodConfig.unit1End);
  const u2 = parseLocalDate(periodConfig.unit2End);
  const u3 = parseLocalDate(periodConfig.unit3End);
  const u4 = parseLocalDate(periodConfig.unit4End);

  // Si no hay fechas configuradas, asumimos Unidad 4 por defecto
  if (!u1 || !u2 || !u3 || !u4) return 4;

  u1.setHours(23, 59, 59, 999);
  u2.setHours(23, 59, 59, 999);
  u3.setHours(23, 59, 59, 999);
  u4.setHours(23, 59, 59, 999);

  if (targetDate <= u1) return 1;
  if (targetDate <= u2) return 2;
  if (targetDate <= u3) return 3;
  return 4;
}

// Determinar qué unidad se debe usar para el cálculo del promedio (análisis de riesgo)
function getAnalysisUnit(periodConfig) {
  if (!periodConfig) return 4;
  if (periodConfig.status === "completed") return 4;

  const targetDate = periodConfig.simulationDate ? parseLocalDate(periodConfig.simulationDate) : new Date();
  if (!targetDate) return 4;
  targetDate.setHours(0, 0, 0, 0);

  const u1 = parseLocalDate(periodConfig.unit1End);
  const u2 = parseLocalDate(periodConfig.unit2End);
  const u3 = parseLocalDate(periodConfig.unit3End);
  const u4 = parseLocalDate(periodConfig.unit4End);

  if (!u1 || !u2 || !u3 || !u4) return 4;

  u1.setHours(23, 59, 59, 999);
  u2.setHours(23, 59, 59, 999);
  u3.setHours(23, 59, 59, 999);
  u4.setHours(23, 59, 59, 999);

  if (targetDate <= u1) return 1;
  if (targetDate <= u2) return 1; // Durante Unidad 2, el análisis de Unidad 1 sigue vigente
  if (targetDate <= u3) return 2; // Durante Unidad 3, el análisis de Unidad 2 sigue vigente
  if (targetDate <= u4) return 3; // Durante Unidad 4, el análisis de Unidad 3 sigue vigente
  return 4;
}

// Calcular notas parciales y finales de un estudiante según el calendario y periodo activo
function calculateStudentMetrics(student, config, periodConfig) {
  const unit = getAnalysisUnit(periodConfig);
  let sumFinalGrades = 0;
  let failingCount = 0;

  student.subjects.forEach(subj => {
    // Promedio de laboratorios según la unidad actual
    let sumLabs = 0;
    if (unit >= 1) sumLabs += subj.lab1;
    if (unit >= 2) sumLabs += subj.lab2;
    if (unit >= 3) sumLabs += subj.lab3;
    if (unit >= 4) sumLabs += subj.lab4;
    subj.calculatedPromLab = sumLabs / unit;

    // Promedio de parciales según la unidad actual
    let sumPars = 0;
    if (unit >= 1) sumPars += subj.par1;
    if (unit >= 2) sumPars += subj.par2;
    if (unit >= 3) sumPars += subj.par3;
    if (unit >= 4) sumPars += subj.par4;
    subj.calculatedPromPar = sumPars / unit;

    // Nota final de la asignatura
    subj.calculatedFinal = (subj.calculatedPromLab * config.weightLab) + (subj.calculatedPromPar * config.weightPar);

    // Nivel de riesgo por materia
    if (subj.calculatedFinal < config.thresholdFail) {
      subj.riskLevel = "high";
      failingCount++;
    } else if (subj.calculatedFinal < config.thresholdCum) {
      subj.riskLevel = "medium";
    } else {
      subj.riskLevel = "low";
    }

    sumFinalGrades += subj.calculatedFinal;
  });

  const totalSubjects = student.subjects.length;
  student.calculatedFinal = totalSubjects > 0 ? (sumFinalGrades / totalSubjects) : 0;
  student.failingCount = failingCount;

  // Regla general de riesgo
  if (failingCount > 0 || student.calculatedFinal < config.thresholdFail) {
    student.riskLevel = "high";
  } else if (student.calculatedFinal < config.thresholdCum) {
    student.riskLevel = "medium";
  } else {
    student.riskLevel = "low";
  }

  // Calcular puntaje de riesgo para ordenamiento prioritario (0-100)
  let score = 0;
  const final = student.calculatedFinal;
  if (student.riskLevel === "high") {
    const failRatio = totalSubjects > 0 ? (failingCount / totalSubjects) : 0;
    const cumPenalty = Math.max(0, (config.thresholdFail - final) / config.thresholdFail) * 20;
    score = 60 + (failRatio * 20) + cumPenalty;
  } else if (student.riskLevel === "medium") {
    score = 20 + ((config.thresholdCum - final) / (config.thresholdCum - config.thresholdFail)) * 40;
  } else {
    score = Math.max(0, 20 - ((final - config.thresholdCum) / (10.0 - config.thresholdCum)) * 20);
  }

  student.riskScore = Math.min(100, Math.max(0, score));
}

// Inicializar el selector de periodos global en la cabecera
function initGlobalPeriodSelector(onPeriodChangeCallback) {
  const selectEl = document.getElementById("global-period-select");
  if (!selectEl) return;

  const config = getPeriodsConfig();
  const activePeriod = getActivePeriod();

  // Rellenar selector
  selectEl.innerHTML = "";
  Object.keys(config).sort().forEach(periodName => {
    const opt = document.createElement("option");
    opt.value = periodName;
    opt.textContent = periodName;
    if (periodName === activePeriod) {
      opt.selected = true;
    }
    selectEl.appendChild(opt);
  });

  // Evento al cambiar de periodo
  selectEl.addEventListener("change", (e) => {
    const newPeriod = e.target.value;
    setActivePeriod(newPeriod);
    
    // Notificar a otras pestañas mediante un evento de almacenamiento manual si es necesario, 
    // pero localStorage.setItem ya gatilla el evento 'storage' automáticamente en otras ventanas
    if (onPeriodChangeCallback) {
      onPeriodChangeCallback(newPeriod);
    }
  });

  // Registrar escucha del evento storage
  window.addEventListener("storage", (e) => {
    if (e.key === "atenas_active_period") {
      const newActive = e.newValue;
      if (selectEl.value !== newActive) {
        selectEl.value = newActive;
        if (onPeriodChangeCallback) {
          onPeriodChangeCallback(newActive);
        }
      }
    }
  });
}

/* ==========================================================================
   SISTEMA DE TRADUCCIÓN MULTI-IDIOMA (i18n)
   ========================================================================== */

function getSelectedLanguage() {
  return localStorage.getItem("atenas_language") || "es";
}

function setSelectedLanguage(lang) {
  localStorage.setItem("atenas_language", lang);
}

// Retorna la traducción correspondiente a la clave
function t(key, params) {
  const lang = getSelectedLanguage();
  let text = "";
  
  if (typeof TRANSLATIONS !== "undefined" && TRANSLATIONS[lang] && TRANSLATIONS[lang][key] !== undefined) {
    text = TRANSLATIONS[lang][key];
  } else if (typeof TRANSLATIONS !== "undefined" && TRANSLATIONS["es"] && TRANSLATIONS["es"][key] !== undefined) {
    text = TRANSLATIONS["es"][key];
  } else {
    return key;
  }
  
  if (params && typeof params === "object") {
    Object.keys(params).forEach(pKey => {
      text = text.replace(new RegExp(`{${pKey}}`, "g"), params[pKey]);
    });
  }
  
  return text;
}

// Recorre el DOM traduciendo los elementos marcados
function translateDOM() {
  // Traducir textos y HTML interno
  const elements = document.querySelectorAll("[data-i18n]");
  elements.forEach(el => {
    const key = el.getAttribute("data-i18n");
    const text = t(key);
    if (text !== key) {
      if (text.includes("<") && text.includes(">")) {
        el.innerHTML = text;
      } else {
        el.textContent = text;
      }
    }
  });

  // Traducir placeholders
  const placeholders = document.querySelectorAll("[data-i18n-placeholder]");
  placeholders.forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    const text = t(key);
    if (text !== key) {
      el.setAttribute("placeholder", text);
    }
  });

  // Traducir títulos/tooltips
  const titles = document.querySelectorAll("[data-i18n-title]");
  titles.forEach(el => {
    const key = el.getAttribute("data-i18n-title");
    const text = t(key);
    if (text !== key) {
      el.setAttribute("title", text);
    }
  });
}

// Inicializar el selector de idiomas en la cabecera
function initLanguageSelector() {
  const container = document.getElementById("lang-toggle-container");
  if (!container) return;

  const btnEs = document.getElementById("lang-btn-es");
  const btnEn = document.getElementById("lang-btn-en");
  
  const currentLang = getSelectedLanguage();
  
  // Sincronizar UI inicial del selector
  if (currentLang === "en") {
    container.classList.add("lang-en");
    if (btnEs) btnEs.classList.remove("active");
    if (btnEn) btnEn.classList.add("active");
  } else {
    container.classList.remove("lang-en");
    if (btnEs) btnEs.classList.add("active");
    if (btnEn) btnEn.classList.remove("active");
  }

  // Traducir el DOM inicial
  translateDOM();

  const handleLangChange = (lang) => {
    const prevLang = getSelectedLanguage();
    if (prevLang === lang) return;
    
    setSelectedLanguage(lang);
    
    // Animar el toggle
    if (lang === "en") {
      container.classList.add("lang-en");
      if (btnEs) btnEs.classList.remove("active");
      if (btnEn) btnEn.classList.add("active");
    } else {
      container.classList.remove("lang-en");
      if (btnEs) btnEs.classList.add("active");
      if (btnEn) btnEn.classList.remove("active");
    }
    
    // Traducir DOM
    translateDOM();
    
    // Lanzar evento personalizado para que las páginas re-rendericen sus componentes dinámicos (ej: gráficos)
    window.dispatchEvent(new CustomEvent("languagechange", { detail: { language: lang } }));
  };

  if (btnEs) {
    btnEs.addEventListener("click", (e) => {
      e.stopPropagation();
      handleLangChange("es");
    });
  }
  
  if (btnEn) {
    btnEn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleLangChange("en");
    });
  }
  
  // Agregar también el click al contenedor mismo para alternar rápidamente
  container.addEventListener("click", () => {
    const nextLang = getSelectedLanguage() === "es" ? "en" : "es";
    handleLangChange(nextLang);
  });
}

// Escuchar cambios de idioma desde otras pestañas/páginas
window.addEventListener("storage", (e) => {
  if (e.key === "atenas_language") {
    const newLang = e.newValue || "es";
    const container = document.getElementById("lang-toggle-container");
    const btnEs = document.getElementById("lang-btn-es");
    const btnEn = document.getElementById("lang-btn-en");
    
    if (container) {
      if (newLang === "en") {
        container.classList.add("lang-en");
        if (btnEs) btnEs.classList.remove("active");
        if (btnEn) btnEn.classList.add("active");
      } else {
        container.classList.remove("lang-en");
        if (btnEs) btnEs.classList.add("active");
        if (btnEn) btnEn.classList.remove("active");
      }
    }
    
    translateDOM();
    window.dispatchEvent(new CustomEvent("languagechange", { detail: { language: newLang } }));
  }
});

// Autoejecutar al estar listo el DOM
document.addEventListener("DOMContentLoaded", () => {
  initLanguageSelector();
});

// Sistema de Notificaciones Toast Personalizado para reemplazar alert()
window.showToast = function(message, type = 'info') {
  // Asegurarnos de tener el contenedor en el DOM
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  // Crear el elemento del toast
  const toast = document.createElement("div");
  toast.className = `toast-item toast-${type}`;

  // Mapear icono según el tipo
  let iconName = "info";
  if (type === "success") iconName = "check-circle";
  else if (type === "warning") iconName = "alert-circle";
  else if (type === "danger") iconName = "alert-triangle";

  toast.innerHTML = `
    <i class="toast-icon" data-lucide="${iconName}"></i>
    <div class="toast-content">
      <p>${message}</p>
    </div>
    <button class="toast-close">&times;</button>
  `;

  // Añadir al contenedor
  container.appendChild(toast);

  // Inicializar icono de Lucide si está disponible
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons({
      attrs: {
        class: 'toast-icon'
      }
    });
  }

  // Evento para cerrar manualmente
  const closeBtn = toast.querySelector(".toast-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      closeToast(toast);
    });
  }

  // Autoeliminar después de 5 segundos
  const autoTimeout = setTimeout(() => {
    closeToast(toast);
  }, 5000);

  function closeToast(el) {
    if (el && el.parentNode) {
      el.classList.add("toast-fade-out");
      el.addEventListener("animationend", () => {
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
      // Fallback por si no dispara animationend
      setTimeout(() => {
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
        }
      }, 350);
    }
    clearTimeout(autoTimeout);
  }
};

// Sobrescribir el alert nativo del navegador
window.alert = function(message) {
  if (typeof message !== "string") {
    message = String(message || "");
  }
  let type = "info";
  const lower = message.toLowerCase();
  if (lower.includes("exito") || lower.includes("success") || lower.includes("guardado") || lower.includes("cargado") || lower.includes("exitosamente")) {
    type = "success";
  } else if (lower.includes("error") || lower.includes("invalido") || lower.includes("invalid") || lower.includes("no soportado") || lower.includes("fallo") || lower.includes("incorrecto") || lower.includes("eliminar") || lower.includes("completar") || lower.includes("ingrese")) {
    type = "danger";
  } else if (lower.includes("advertencia") || lower.includes("warning") || lower.includes("cuidado") || lower.includes("atencion") || lower.includes("atención")) {
    type = "warning";
  }
  window.showToast(message, type);
};

// Modal de Confirmación Estilizado Premium (Reemplazo de confirm())
window.showConfirmModal = function(title, text, type = 'warning', confirmBtnText = '', cancelBtnText = '') {
  return new Promise((resolve) => {
    // Asegurarnos de remover cualquier modal previo si existiera
    const activeOverlays = document.querySelectorAll(".confirm-modal-overlay");
    activeOverlays.forEach(el => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });

    // Crear overlay
    const overlay = document.createElement("div");
    overlay.className = "confirm-modal-overlay";
    
    // Generar icono animado según tipo
    let iconHTML = "";
    if (type === "warning") {
      iconHTML = `
        <div class="confirm-icon confirm-icon-warning">
          <span>!</span>
        </div>
      `;
    } else if (type === "success") {
      iconHTML = `
        <div class="confirm-icon">
          <svg class="checkmark-svg" viewBox="0 0 52 52">
            <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
            <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
          </svg>
        </div>
      `;
    } else if (type === "error" || type === "danger") {
      iconHTML = `
        <div class="confirm-icon">
          <svg class="error-svg" viewBox="0 0 52 52">
            <circle class="error-circle" cx="26" cy="26" r="25" fill="none"/>
            <path class="error-line-1" fill="none" d="M16 16 36 36"/>
            <path class="error-line-2" fill="none" d="M36 16 16 36"/>
          </svg>
        </div>
      `;
    } else { // info
      iconHTML = `
        <div class="confirm-icon confirm-icon-info">
          <span>i</span>
        </div>
      `;
    }
    
    // Traducir dinámicamente los textos de los botones si el usuario no los pasa específicos
    const finalConfirmText = confirmBtnText || (t("modal_confirm_yes") !== "modal_confirm_yes" ? t("modal_confirm_yes") : "Sí, proceder");
    const finalCancelText = cancelBtnText || (t("modal_confirm_cancel") !== "modal_confirm_cancel" ? t("modal_confirm_cancel") : "Cancelar");

    overlay.innerHTML = `
      <div class="confirm-modal-card type-${type}">
        <div class="confirm-modal-icon-wrapper">
          ${iconHTML}
        </div>
        <h3 class="confirm-modal-title">${title}</h3>
        <p class="confirm-modal-text">${text}</p>
        <div class="confirm-modal-actions">
          <button class="confirm-btn confirm-btn-cancel">${finalCancelText}</button>
          <button class="confirm-btn confirm-btn-confirm">${finalConfirmText}</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Forzar reflow para animación
    overlay.offsetHeight; 
    overlay.classList.add("active");
    
    const confirmBtn = overlay.querySelector(".confirm-btn-confirm");
    const cancelBtn = overlay.querySelector(".confirm-btn-cancel");
    
    let resolved = false;

    const closeWithResult = (result) => {
      if (resolved) return;
      resolved = true;

      overlay.classList.remove("active");
      
      const transitionEndHandler = () => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        resolve(result);
      };

      overlay.addEventListener("transitionend", transitionEndHandler);
      
      // Fallback
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        resolve(result);
      }, 350);
    };
    
    confirmBtn.addEventListener("click", () => closeWithResult(true));
    cancelBtn.addEventListener("click", () => closeWithResult(false));
    
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeWithResult(false);
      }
    });

    const handleKeydown = (e) => {
      if (e.key === "Escape") {
        closeWithResult(false);
        document.removeEventListener("keydown", handleKeydown);
      } else if (e.key === "Enter") {
        e.preventDefault();
        closeWithResult(true);
        document.removeEventListener("keydown", handleKeydown);
      }
    };
    document.addEventListener("keydown", handleKeydown);
  });
};

// Modal de Entrada de Texto Estilizado Premium (Reemplazo de prompt())
window.showInputModal = function(title, text, placeholder = '', confirmBtnText = '', cancelBtnText = '') {
  return new Promise((resolve) => {
    // Asegurarnos de remover cualquier modal previo si existiera
    const activeOverlays = document.querySelectorAll(".confirm-modal-overlay");
    activeOverlays.forEach(el => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });

    // Crear overlay
    const overlay = document.createElement("div");
    overlay.className = "confirm-modal-overlay";
    
    // Icono animado de escritura (estilo info)
    let iconHTML = `
      <div class="confirm-icon confirm-icon-info">
        <span>+</span>
      </div>
    `;
    
    const finalConfirmText = confirmBtnText || (t("modal_confirm_yes") !== "modal_confirm_yes" ? t("modal_confirm_yes") : "Aceptar");
    const finalCancelText = cancelBtnText || (t("modal_confirm_cancel") !== "modal_confirm_cancel" ? t("modal_confirm_cancel") : "Cancelar");

    overlay.innerHTML = `
      <div class="confirm-modal-card type-info">
        <div class="confirm-modal-icon-wrapper">
          ${iconHTML}
        </div>
        <h3 class="confirm-modal-title">${title}</h3>
        <p class="confirm-modal-text">${text}</p>
        <div class="confirm-modal-input-wrapper" style="width: 100%; margin-bottom: 20px;">
          <input type="text" id="confirm-modal-text-input" placeholder="${placeholder}" style="width: 100%; height: 40px; background: var(--bg-secondary); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-main); padding: 0 12px; font-family: inherit; font-size: 0.9rem; box-sizing: border-box; outline: none; transition: var(--transition-smooth); text-align: center;">
        </div>
        <div class="confirm-modal-actions">
          <button class="confirm-btn confirm-btn-cancel">${finalCancelText}</button>
          <button class="confirm-btn confirm-btn-confirm">${finalConfirmText}</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    const textInput = overlay.querySelector("#confirm-modal-text-input");
    
    // Forzar reflow para animación
    overlay.offsetHeight; 
    overlay.classList.add("active");
    
    if (textInput) {
      // Estilo de foco hermoso
      textInput.addEventListener("focus", () => {
        textInput.style.borderColor = "var(--color-primary)";
        textInput.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.15)";
      });
      textInput.addEventListener("blur", () => {
        textInput.style.borderColor = "var(--glass-border)";
        textInput.style.boxShadow = "none";
      });
      
      setTimeout(() => textInput.focus(), 150);
    }
    
    const confirmBtn = overlay.querySelector(".confirm-btn-confirm");
    const cancelBtn = overlay.querySelector(".confirm-btn-cancel");
    
    let resolved = false;

    const closeWithResult = (result) => {
      if (resolved) return;
      resolved = true;

      overlay.classList.remove("active");
      
      const transitionEndHandler = () => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        resolve(result);
      };

      overlay.addEventListener("transitionend", transitionEndHandler);
      
      // Fallback
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        resolve(result);
      }, 350);
    };
    
    confirmBtn.addEventListener("click", () => {
      const val = textInput ? textInput.value : "";
      closeWithResult(val);
    });
    
    cancelBtn.addEventListener("click", () => closeWithResult(null));
    
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeWithResult(null);
      }
    });

    const handleKeydown = (e) => {
      if (e.key === "Escape") {
        closeWithResult(null);
        document.removeEventListener("keydown", handleKeydown);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const val = textInput ? textInput.value : "";
        closeWithResult(val);
        document.removeEventListener("keydown", handleKeydown);
      }
    };
    document.addEventListener("keydown", handleKeydown);
  });
};

// Plantilla CSV global
const CSV_TEMPLATE_CONTENT = `Docente,Materia,Carnet,Nombre,Lab 1,Lab 2,Lab 3,Parcial 1,Parcial 2,Asistencias,Observaciones\nDocente Ejemplo,Materia Ejemplo,AB12345,Estudiante Ejemplo,8.5,9.0,7.5,8.0,6.5,95%,Excelente alumno`;

// Función global de descarga de plantilla CSV
window.downloadTemplateCSV = function() {
  const blob = new Blob([CSV_TEMPLATE_CONTENT], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "plantilla_estudiantes.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
};

// ==========================================================================
// SISTEMA DE EXPORTACIÓN A PDF (FICHA ACADÉMICA DEL ESTUDIANTE)
// ==========================================================================

// Carga dinámica de html2pdf.js si no está presente
function ensureHtml2PdfLoaded(callback) {
  if (window.html2pdf) {
    if (callback) callback();
    return;
  }
  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
  script.onload = () => {
    if (callback) callback();
  };
  document.head.appendChild(script);
}

// Inyección dinámica de la plantilla de impresión y botón de descarga
document.addEventListener("DOMContentLoaded", () => {
  // 1. Inyectar botón de descarga al modal al abrirse/cargarse si existe el botón de cerrar
  const btnClose = document.getElementById("btn-close-modal");
  if (btnClose && !document.getElementById("btn-download-pdf")) {
    const parent = btnClose.parentNode;
    
    // Contenedor flex para agrupar botones
    const btnContainer = document.createElement("div");
    btnContainer.style.display = "flex";
    btnContainer.style.gap = "8px";
    
    // Botón Descargar PDF
    const btnDownload = document.createElement("button");
    btnDownload.className = "btn-demo";
    btnDownload.id = "btn-download-pdf";
    btnDownload.style.background = "var(--color-primary)";
    btnDownload.style.border = "1px solid var(--color-primary)";
    btnDownload.style.color = "white";
    btnDownload.style.padding = "6px 12px";
    btnDownload.style.fontSize = "0.78rem";
    btnDownload.style.display = "flex";
    btnDownload.style.alignItems = "center";
    btnDownload.style.gap = "6px";
    btnDownload.style.cursor = "pointer";
    btnDownload.style.fontWeight = "600";
    btnDownload.style.borderRadius = "var(--radius-sm)";
    
    // Traducir dinámicamente con t() si está disponible, o usar fallback
    const btnLabel = typeof t !== "undefined" ? t("modal_download_pdf_btn") : "Descargar Ficha (PDF)";
    btnDownload.innerHTML = `<i data-lucide="download"></i> <span data-i18n="modal_download_pdf_btn">${btnLabel}</span>`;
    
    // Insertar contenedor
    parent.replaceChild(btnContainer, btnClose);
    btnContainer.appendChild(btnDownload);
    btnContainer.appendChild(btnClose);
    
    // Refrescar iconos lucide
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // 2. Inyectar la plantilla HTML oculta para renderizado de PDF
  if (!document.getElementById("pdf-report-template")) {
    const pdfContainer = document.createElement("div");
    pdfContainer.style.position = "absolute";
    pdfContainer.style.left = "-9999px";
    pdfContainer.style.top = "-9999px";
    
    pdfContainer.innerHTML = `
      <style>
        #pdf-report-template .risk-badge-print {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
        }
        #pdf-report-template .risk-high {
          background-color: #fee2e2;
          color: #b91c1c;
          border: 1px solid #fca5a5;
        }
        #pdf-report-template .risk-medium {
          background-color: #fef3c7;
          color: #b45309;
          border: 1px solid #fde68a;
        }
        #pdf-report-template .risk-low {
          background-color: #d1fae5;
          color: #047857;
          border: 1px solid #6ee7b7;
        }
        #pdf-report-template .text-center {
          text-align: center !important;
        }
      </style>
      <div id="pdf-report-template" style="width: 800px; background: #ffffff; color: #0f172a; padding: 24px 30px; font-family: 'Jost', 'Inter', sans-serif; box-sizing: border-box; position: relative;">
        <!-- Encabezado membretado del reporte -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 44px; height: 44px; background: #1565c0; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff;">
              <i data-lucide="graduation-cap" style="width: 24px; height: 24px;"></i>
            </div>
            <div>
              <h2 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #0f172a; letter-spacing: 0.5px;">UNIVERSIDAD FRANCISCO GAVIDIA</h2>
              <span style="font-size: 0.75rem; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Dirección de Permanencia Estudiantil</span>
            </div>
          </div>
          <div style="text-align: right;">
            <h3 style="margin: 0; font-size: 1.1rem; font-weight: 700; color: #0f172a;">FICHA ACADÉMICA INDIVIDUAL</h3>
            <p style="margin: 4px 0 0 0; font-size: 0.75rem; color: #64748b; font-weight: 500;">Sistema Atenas - Reporte de Permanencia</p>
          </div>
        </div>

        <!-- Meta Grid: Información del Estudiante -->
        <div style="display: flex; flex-wrap: wrap; gap: 10px 20px; margin-bottom: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px;">
          <div style="flex: 1 1 calc(50% - 10px); min-width: 200px; font-size: 0.82rem;">
            <strong style="color: #475569; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.5px; display: block; margin-bottom: 1px;">Nombre Completo</strong>
            <span id="pdf-p-name" style="font-weight: 600; color: #0f172a; font-size: 0.9rem;">-</span>
          </div>
          <div style="flex: 1 1 calc(50% - 10px); min-width: 200px; font-size: 0.82rem;">
            <strong style="color: #475569; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.5px; display: block; margin-bottom: 1px;">Carnet de Estudiante</strong>
            <span id="pdf-p-carnet" style="font-weight: 600; color: #0f172a; font-size: 0.9rem; font-family: monospace;">-</span>
          </div>
          <div style="flex: 1 1 calc(50% - 10px); min-width: 200px; font-size: 0.82rem;">
            <strong style="color: #475569; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.5px; display: block; margin-bottom: 1px;">Carrera Universitaria</strong>
            <span id="pdf-p-career" style="font-weight: 600; color: #0f172a; font-size: 0.9rem;">-</span>
          </div>
          <div style="flex: 1 1 calc(50% - 10px); min-width: 200px; font-size: 0.82rem;">
            <strong style="color: #475569; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.5px; display: block; margin-bottom: 1px;">Ciclo Académico Activo</strong>
            <span id="pdf-p-period" style="font-weight: 600; color: #0f172a; font-size: 0.9rem;">-</span>
          </div>
          <div style="flex: 1 1 calc(50% - 10px); min-width: 200px; font-size: 0.82rem;">
            <strong style="color: #475569; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.5px; display: block; margin-bottom: 1px;">Promedio General</strong>
            <span id="pdf-p-cum" style="font-weight: 700; color: #0f172a; font-size: 0.9rem;">0.00</span>
          </div>
          <div style="flex: 1 1 calc(50% - 10px); min-width: 200px; font-size: 0.82rem;">
            <strong style="color: #475569; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.5px; display: block; margin-bottom: 1px;">Estado de Alerta de Deserción</strong>
            <div>
              <span id="pdf-p-risk-badge" class="risk-badge-print">-</span>
            </div>
          </div>
        </div>

        <!-- Historial / Desglose de Notas -->
        <h4 style="font-size: 0.85rem; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px 0; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 6px;">
          <i data-lucide="table" style="width: 14px; height: 14px; vertical-align: middle;"></i>
          Desglose de Calificaciones por Materias
        </h4>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 0.82rem;">
          <thead>
            <tr>
              <th style="background: #f1f5f9; color: #334155; font-weight: 700; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.5px; padding: 6px 12px; border-bottom: 2px solid #cbd5e1; text-align: left;">Asignatura</th>
              <th class="text-center" style="width: 100px; background: #f1f5f9; color: #334155; font-weight: 700; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.5px; padding: 6px 12px; border-bottom: 2px solid #cbd5e1; text-align: center;">Lab. Prom (40%)</th>
              <th class="text-center" style="width: 100px; background: #f1f5f9; color: #334155; font-weight: 700; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.5px; padding: 6px 12px; border-bottom: 2px solid #cbd5e1; text-align: center;">Parc. Prom (60%)</th>
              <th class="text-center" style="width: 100px; background: #f1f5f9; color: #334155; font-weight: 700; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.5px; padding: 6px 12px; border-bottom: 2px solid #cbd5e1; text-align: center;">Nota Final</th>
              <th style="width: 120px; background: #f1f5f9; color: #334155; font-weight: 700; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.5px; padding: 6px 12px; border-bottom: 2px solid #cbd5e1; text-align: left;">Estado de Alerta</th>
            </tr>
          </thead>
          <tbody id="pdf-p-table-body">
            <!-- Calificaciones dinámicas -->
          </tbody>
        </table>

        <!-- Diagnóstico Analítico -->
        <h4 style="font-size: 0.85rem; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px 0; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 6px;">
          <i data-lucide="activity" style="width: 14px; height: 14px; vertical-align: middle;"></i>
          Diagnóstico y Alertas Críticas
        </h4>
        <div id="pdf-p-diagnostic" style="border: 1px solid #e2e8f0; border-left: 4px solid #1565c0; background: #f8fafc; border-radius: 6px; padding: 10px 12px; font-size: 0.82rem; line-height: 1.5; color: #334155; margin-bottom: 16px;">
          -
        </div>

        <!-- Plan de Acompañamiento -->
        <h4 style="font-size: 0.85rem; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px 0; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 6px;">
          <i data-lucide="clipboard-list" style="width: 14px; height: 14px; vertical-align: middle;"></i>
          Recomendaciones y Plan de Acompañamiento
        </h4>
        <ul id="pdf-p-recommendations" style="margin: 0; padding-left: 20px; font-size: 0.8rem; color: #475569; line-height: 1.6;">
          <!-- Recomendaciones dinámicas -->
        </ul>

        <!-- Firma de Reporte -->
        <div style="margin-top: 55px; display: flex; justify-content: space-between; gap: 40px; text-align: center; font-size: 0.75rem; color: #64748b;">
          <div style="flex: 1;">
            <div style="border-top: 1px solid #cbd5e1; padding-top: 8px; margin-top: 35px;">Firma del Consejero / Tutor</div>
          </div>
          <div style="flex: 1;">
            <div style="border-top: 1px solid #cbd5e1; padding-top: 8px; margin-top: 35px;">Firma del Estudiante</div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(pdfContainer);
  }
});

// Manejador del clic del botón de descarga utilizando delegación de eventos
document.addEventListener("click", (e) => {
  if (e.target && (e.target.id === "btn-download-pdf" || e.target.closest("#btn-download-pdf"))) {
    ensureHtml2PdfLoaded(() => {
      exportStudentPDF();
    });
  }
});

// Rellenado dinámico de la plantilla PDF con la información cargada en el modal activo
function populatePDFTemplate(student) {
  document.getElementById("pdf-p-name").textContent = `${student.apellidos}, ${student.nombres}`;
  document.getElementById("pdf-p-carnet").textContent = student.carnet;
  
  const careerName = (typeof CAREER_NAMES !== "undefined" && CAREER_NAMES[student.carrera]) || student.carrera;
  document.getElementById("pdf-p-career").textContent = careerName;
  document.getElementById("pdf-p-period").textContent = student.periodo;
  document.getElementById("pdf-p-cum").textContent = student.calculatedFinal.toFixed(2);
  
  const badge = document.getElementById("pdf-p-risk-badge");
  let riskClass = "risk-low";
  let riskText = typeof t !== "undefined" ? t("risk_low") : "Riesgo Bajo";
  
  if (student.riskLevel === "high") {
    riskClass = "risk-high";
    riskText = typeof t !== "undefined" ? t("risk_high") : "Riesgo Alto";
  } else if (student.riskLevel === "medium") {
    riskClass = "risk-medium";
    riskText = typeof t !== "undefined" ? t("risk_medium") : "Riesgo Medio";
  }
  
  badge.className = `risk-badge-print ${riskClass}`;
  badge.textContent = riskText;
  
  // Tabla de calificaciones
  const tbody = document.getElementById("pdf-p-table-body");
  tbody.innerHTML = "";
  
  const thresholdFail = (typeof state !== "undefined" && state.config && state.config.thresholdFail) || 6.0;
  const thresholdCum = (typeof state !== "undefined" && state.config && state.config.thresholdCum) || 7.0;

  student.subjects.forEach(subj => {
    let alertClass = "risk-low";
    let alertText = typeof t !== "undefined" ? t("status_passed") : "Aprobado";
    
    if (subj.calculatedFinal < thresholdFail) {
      alertClass = "risk-high";
      alertText = typeof t !== "undefined" ? t("status_failed") : "Reprobado";
    } else if (subj.calculatedFinal < thresholdCum) {
      alertClass = "risk-medium";
      alertText = typeof t !== "undefined" ? (t("status_passed") + " (Alerta)") : "Aprobado (Alerta)";
    }
    
    tbody.innerHTML += `
      <tr>
        <td style="font-weight: 700; border-bottom: 1px solid #e2e8f0; padding: 6px 12px; color: #334155;">${subj.materia}</td>
        <td class="text-center" style="font-family: monospace; border-bottom: 1px solid #e2e8f0; padding: 6px 12px; color: #334155;">${subj.calculatedPromLab.toFixed(2)}</td>
        <td class="text-center" style="font-family: monospace; border-bottom: 1px solid #e2e8f0; padding: 6px 12px; color: #334155;">${subj.calculatedPromPar.toFixed(2)}</td>
        <td class="text-center" style="font-family: monospace; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding: 6px 12px; color: #334155;">${subj.calculatedFinal.toFixed(2)}</td>
        <td style="border-bottom: 1px solid #e2e8f0; padding: 6px 12px;"><span class="risk-badge-print ${alertClass}">${alertText}</span></td>
      </tr>
    `;
  });
  
  // Diagnóstico
  const screenDiagDesc = document.getElementById("modal-diagnostic-desc");
  const screenDiagTitle = document.getElementById("modal-diagnostic-title");
  const pdfDiag = document.getElementById("pdf-p-diagnostic");
  
  if (screenDiagDesc && pdfDiag) {
    const title = screenDiagTitle ? screenDiagTitle.textContent : "Diagnóstico";
    pdfDiag.textContent = `${title}: ${screenDiagDesc.textContent}`;
  } else if (pdfDiag) {
    pdfDiag.textContent = student.riskLevel === "high" 
      ? "Estudiante en Riesgo Alto por materias reprobadas." 
      : "Rendimiento académico regular.";
  }
  
  if (pdfDiag) {
    if (student.riskLevel === "high") {
      pdfDiag.style.borderLeft = "4px solid #ef4444";
    } else if (student.riskLevel === "medium") {
      pdfDiag.style.borderLeft = "4px solid #f59e0b";
    } else {
      pdfDiag.style.borderLeft = "4px solid #10b981";
    }
  }

  // Recomendaciones del Plan de Acompañamiento
  const screenRecs = document.querySelectorAll("#modal-recommendations-container .rec-item p");
  const pdfRecList = document.getElementById("pdf-p-recommendations");
  
  if (pdfRecList) {
    pdfRecList.innerHTML = "";
    if (screenRecs && screenRecs.length > 0) {
      screenRecs.forEach(p => {
        pdfRecList.innerHTML += `<li style="margin-bottom: 3px;">${p.textContent}</li>`;
      });
    } else {
      if (student.riskLevel === "high") {
        pdfRecList.innerHTML = `<li style="margin-bottom: 3px;">Asignar tutorías académicas obligatorias.</li><li style="margin-bottom: 3px;">Monitoreo preventivo semanal.</li>`;
      } else {
        pdfRecList.innerHTML = `<li style="margin-bottom: 3px;">Mantener seguimiento académico de rutina.</li>`;
      }
    }
  }
  
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Exportación del PDF a través del renderizado de canvas y compilación del documento Carta
function exportStudentPDF() {
  const currentStudent = typeof state !== "undefined" ? state.selectedStudent : null;
  if (!currentStudent) return;
  
  populatePDFTemplate(currentStudent);
  
  const element = document.getElementById('pdf-report-template');
  const filename = `Ficha_Academica_${currentStudent.carnet}.pdf`;

  const opt = {
    margin:       [0.15, 0.4, 0.15, 0.4],
    filename:     filename,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { 
      scale: 2, 
      useCORS: true, 
      letterRendering: true,
      scrollY: 0,
      scrollX: 0
    },
    jsPDF:        { 
      unit: 'in', 
      format: 'letter', 
      orientation: 'portrait' 
    }
  };

  html2pdf().set(opt).from(element).save();
}

