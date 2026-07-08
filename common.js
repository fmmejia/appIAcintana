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

// Umbrales fijos institucionales
const SYSTEM_CONFIG = {
  thresholdFail: 6.0,
  thresholdCum: 7.0,
  weightLab: 0.4,
  weightPar: 0.6
};

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

